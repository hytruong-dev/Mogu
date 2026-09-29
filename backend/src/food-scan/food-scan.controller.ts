import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  Injectable,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoodScanVisionService } from './food-scan-vision.service';
import { FoodScanMatcherService } from './food-scan-matcher.service';
import { FoodScanFeedbackDto } from './dto/food-scan.dto';

export const FOOD_SCAN_MAX_BYTES = 5 * 1024 * 1024;

export async function validateFoodScanImage(
  bytes: Buffer,
  mime: string,
): Promise<Buffer> {
  if (!bytes.length) throw new BadRequestException('FOOD_SCAN_EMPTY_FILE');
  if (bytes.length > FOOD_SCAN_MAX_BYTES)
    throw new PayloadTooLargeException('FOOD_SCAN_FILE_TOO_LARGE');
  if (!['image/jpeg', 'image/png'].includes(mime))
    throw new BadRequestException('FOOD_SCAN_UNSUPPORTED_IMAGE');
  try {
    const image = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: 20_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png'].includes(metadata.format ?? '') ||
      mime !== `image/${metadata.format}` ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new Error('Invalid image format');
    }
    // Decode and re-encode, not just magic bytes/metadata: rejects corrupted images and strips metadata.
    return await image
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new BadRequestException('FOOD_SCAN_INVALID_IMAGE_BYTES');
  }
}

/** Read exactly one `file` part and validate/re-encode it. */
async function readSingleImage(request: FastifyRequest): Promise<Buffer | null> {
  if (!request.isMultipart())
    throw new BadRequestException('FOOD_SCAN_MULTIPART_REQUIRED');
  let image: Buffer | null = null;
  for await (const part of request.parts({
    limits: { fileSize: FOOD_SCAN_MAX_BYTES, files: 1, fields: 0, parts: 1 },
  })) {
    if (part.type !== 'file' || part.fieldname !== 'file' || image) {
      throw new BadRequestException('FOOD_SCAN_SINGLE_FILE_REQUIRED');
    }
    const bytes = await part.toBuffer();
    if (part.file.truncated)
      throw new PayloadTooLargeException('FOOD_SCAN_FILE_TOO_LARGE');
    image = await validateFoodScanImage(bytes, part.mimetype);
  }
  return image;
}

function mapMultipartError(error: unknown): unknown {
  if (error instanceof HttpException) return error;
  const code = (error as { code?: string }).code;
  if (code === 'FST_REQ_FILE_TOO_LARGE')
    return new PayloadTooLargeException('FOOD_SCAN_FILE_TOO_LARGE');
  if (
    code?.startsWith('FST_') ||
    (error instanceof Error && /multipart|boundary/i.test(error.message))
  ) {
    return new BadRequestException('FOOD_SCAN_INVALID_MULTIPART');
  }
  return error;
}

/** Per-process abuse protection, consistent with existing in-memory action limits. */
@Injectable()
export class FoodScanRateLimiter {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  private readonly active = new Set<string>();
  acquire(userId: string): () => void {
    const now = Date.now();
    for (const [key, value] of this.windows)
      if (now - value.start >= 60_000) this.windows.delete(key);
    const window = this.windows.get(userId) ?? { start: now, count: 0 };
    if (
      window.count >= 5 ||
      this.active.has(userId) ||
      this.active.size >= 20
    ) {
      throw new HttpException('FOOD_SCAN_RATE_LIMITED', 429);
    }
    window.count++;
    this.windows.set(userId, window);
    this.active.add(userId);
    return () => {
      this.active.delete(userId);
    };
  }
}

@ApiTags('food-scan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('food-scan')
export class FoodScanController {
  constructor(
    private readonly vision: FoodScanVisionService,
    private readonly matcher: FoodScanMatcherService,
    private readonly limiter: FoodScanRateLimiter,
  ) {}

  @Post('recognize')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      additionalProperties: false,
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async recognize(@Req() request: FastifyRequest & { user: { sub: string } }) {
    const release = this.limiter.acquire(request.user.sub);
    try {
      const image = await readSingleImage(request);
      if (!image) throw new BadRequestException('FOOD_SCAN_FILE_REQUIRED');
      return await this.matcher.match(
        await this.vision.recognize(image),
        this.vision.model,
        image,
        request.user?.sub,
      );
    } catch (error) {
      throw mapMultipartError(error);
    } finally {
      release();
    }
  }

  @Post(':scanId/report-missing')
  @HttpCode(200)
  @ApiOperation({
    summary: 'User reports the scanned dish is not in Mogu (queued for admins)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async reportMissing(
    @Param('scanId', ParseUUIDPipe) scanId: string,
    @Req() request: FastifyRequest & { user: { sub: string } },
  ) {
    const release = this.limiter.acquire(request.user.sub);
    try {
      // Photo is optional: the report still records the AI guesses without it.
      const image = request.isMultipart() ? await readSingleImage(request) : null;
      return await this.matcher.reportMissing(scanId, request.user?.sub, image);
    } catch (error) {
      throw mapMultipartError(error);
    } finally {
      release();
    }
  }

  @Post(':scanId/feedback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit user feedback for food scan result' })
  async feedback(
    @Param('scanId', ParseUUIDPipe) scanId: string,
    @Body() dto: FoodScanFeedbackDto,
    @Req() request: FastifyRequest & { user?: { sub: string } },
  ) {
    return this.matcher.recordFeedback(scanId, request.user?.sub, dto);
  }
}
