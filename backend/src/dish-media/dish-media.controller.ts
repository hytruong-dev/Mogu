import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommitMediaDto, DishMediaService } from './dish-media.service';

@ApiTags('admin/media')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DishMediaController {
  constructor(private readonly mediaService: DishMediaService) {}

  // ── Presign Upload ─────────────────────────────────────────────────────────

  @Post('media/presign-upload')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary: '[Admin] Tạo signed URL upload ảnh/video lên Supabase Storage',
    description:
      'Trả về `uploadUrl` (Supabase signed PUT URL). Client upload file trực tiếp bằng HTTP PUT, sau đó gọi `POST /admin/dishes/:id/media` để commit metadata.',
  })
  @ApiBody({
    schema: {
      properties: {
        dishId: { type: 'string', format: 'uuid' },
        mimeType: {
          type: 'string',
          example: 'image/jpeg',
          enum: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
        },
      },
      required: ['dishId', 'mimeType'],
    },
  })
  presignUpload(
    @Body() body: { dishId: string; mimeType: string },
    @CurrentUser('sub') actorId: string,
  ) {
    return this.mediaService.presignUpload(body.dishId, body.mimeType, actorId);
  }

  // ── Commit after Upload ────────────────────────────────────────────────────

  @Post('dishes/:id/media')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary: '[Admin] Commit metadata sau khi upload lên Supabase Storage',
    description:
      'Sau khi client PUT file lên `uploadUrl`, gọi endpoint này để lưu metadata và tạo record DishMedia (trạng thái PENDING, chờ duyệt).',
  })
  @ApiParam({ name: 'id', description: 'UUID của món ăn' })
  commitMedia(
    @Param('id') dishId: string,
    @Body() dto: CommitMediaDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.mediaService.commitMedia(dishId, dto, actorId);
  }

  // ── Approve Media ──────────────────────────────────────────────────────────

  @Post('dishes/:id/media/:mediaId/approve')
  @Roles(SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary: '[Reviewer] Duyệt media (PENDING → APPROVED)',
    description: 'Chỉ media APPROVED mới xuất hiện ở public API và được tính là ảnh chính.',
  })
  approveMedia(
    @Param('mediaId') mediaId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.mediaService.approveMedia(mediaId, actorId);
  }

  // ── Delete Media ───────────────────────────────────────────────────────────

  @Delete('dishes/:id/media/:mediaId')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary: '[Admin] Xóa media khỏi DB và Supabase Storage',
  })
  deleteMedia(
    @Param('mediaId') mediaId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.mediaService.deleteMedia(mediaId, actorId);
  }

  // ── Signed Download URL ────────────────────────────────────────────────────

  @Get('media/signed-url')
  @Roles(SystemRole.CONTENT_ADMIN, SystemRole.REVIEWER, SystemRole.SUPER_ADMIN)
  @ApiOperation({
    summary: '[Admin] Tạo signed URL để tải file (private access)',
    description: 'Hữu ích khi cần truy cập file chưa được duyệt hoặc xem trước.',
  })
  @ApiQuery({ name: 'storageKey', description: 'Path của file trong bucket' })
  @ApiQuery({ name: 'expiresIn', required: false, description: 'Thời gian hiệu lực (giây, mặc định 3600)' })
  getSignedDownloadUrl(
    @Query('storageKey') storageKey: string,
    @Query('expiresIn') expiresIn?: number,
  ) {
    return this.mediaService.createSignedDownloadUrl(storageKey, expiresIn ? Number(expiresIn) : 3600);
  }
}
