import { Module } from '@nestjs/common';
import { RandomizationController } from './randomization.controller';
import { RandomizationService } from './randomization.service';
import { AiImportModule } from '../ai-import/ai-import.module';

@Module({
  imports: [AiImportModule],
  controllers: [RandomizationController],
  providers: [RandomizationService],
  exports: [RandomizationService],
})
export class RandomizationModule {}
