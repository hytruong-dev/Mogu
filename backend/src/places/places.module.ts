import { Module } from '@nestjs/common';
import { AdminPlacesController, PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  controllers: [PlacesController, AdminPlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
