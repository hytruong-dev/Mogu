import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CookingVoiceController,
  CookingVoiceRateLimiter,
} from './cooking-voice.controller';
import { CookingTtsService } from './tts.provider';
import { VoiceCacheService } from './voice-cache.service';
import { CookingScriptService } from './cooking-script.service';
import { CookingAskService } from './cooking-ask.service';
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CookingVoiceController],
  providers: [
    JwtAuthGuard,
    CookingVoiceRateLimiter,
    CookingTtsService,
    VoiceCacheService,
    CookingScriptService,
    CookingAskService,
  ],
})
export class CookingVoiceModule {}
