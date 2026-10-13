import { Module } from '@nestjs/common';
import { AdminPlacesController, PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { DishMatcherService } from './ingest/dish-matcher.service';
import { PlaceIngestService } from './ingest/place-ingest.service';
import { GoogleLiveService } from './ingest/google-live.service';

@Module({
  controllers: [PlacesController, AdminPlacesController],
  providers: [PlacesService, DishMatcherService, PlaceIngestService, GoogleLiveService],
  exports: [PlacesService, DishMatcherService, PlaceIngestService, GoogleLiveService],
})
export class PlacesModule {}
