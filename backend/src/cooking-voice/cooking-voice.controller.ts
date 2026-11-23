import {
  Body,
  Controller,
  Get,
  HttpException,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CookingScriptService } from './cooking-script.service';
import { CookingAskService } from './cooking-ask.service';
import { VoiceCacheService } from './voice-cache.service';
import { AskDto, TtsDto } from './dto/cooking-voice.dto';
import { VOICESTUDIO_COOKING_VOICES } from './noan-voice-profile';

@Injectable()
export class CookingVoiceRateLimiter {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();
  private readonly active = new Set<string>();
  acquire(userId: string): () => void {
    if (!userId) throw new UnauthorizedException();
    const now = Date.now();
    for (const [key, window] of this.windows)
      if (now - window.start >= 60_000) this.windows.delete(key);
    const window = this.windows.get(userId) || { start: now, count: 0 };
    if (
      window.count >= 20 ||
      this.active.has(userId) ||
      this.active.size >= 12 ||
      (this.windows.size >= 10_000 && !this.windows.has(userId))
    )
      throw new HttpException('COOKING_VOICE_RATE_LIMITED', 429);
    window.count++;
    this.windows.set(userId, window);
    this.active.add(userId);
    return () => {
      this.active.delete(userId);
    };
  }
}
@ApiTags('Cooking voice')
@ApiBearerAuth()
@Controller('cooking-voice')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class CookingVoiceController {
  constructor(
    private readonly voice: VoiceCacheService,
    private readonly scripts: CookingScriptService,
    private readonly questions: CookingAskService,
    private readonly limiter: CookingVoiceRateLimiter,
  ) {}
  private async limited<T>(
    request: { user?: { sub?: string }; ip?: string },
    work: () => Promise<T>,
  ): Promise<T> {
    const id = request.user?.sub || request.ip || 'anonymous';
    const release = this.limiter.acquire(id);
    try {
      return await work();
    } finally {
      release();
    }
  }

  @Public()
  @Get('voices')
  voices() {
    return {
      voices: VOICESTUDIO_COOKING_VOICES,
      defaultVoice: 'noan_female_cooking',
    };
  }

  @Public()
  @Post('tts')
  tts(@Req() request: { user?: { sub?: string }; ip?: string }, @Body() dto: TtsDto) {
    return this.limited(request, async () => {
      const result = await this.voice.privateSpeech(dto.text, dto.rate, dto.voice);
      return { text: result.text, audioUrl: result.audioUrl };
    });
  }

  @Public()
  @Get('dishes/:id/script')
  script(
    @Req() request: { user?: { sub?: string }; ip?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('voice') voice?: string,
  ) {
    return this.limited(request, () => this.scripts.script(id, voice));
  }

  @Post('ask')
  ask(@Req() request: { user?: { sub?: string }; ip?: string }, @Body() dto: AskDto) {
    return this.limited(request, () => this.questions.ask(dto));
  }
}
