import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminIngredientsController, IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  imports: [ConfigModule],
  controllers: [IngredientsController, AdminIngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
