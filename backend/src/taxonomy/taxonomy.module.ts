import { Module } from '@nestjs/common';
import { TaxonomyController } from './taxonomy.controller';
import { AdminTaxonomyController } from './admin-taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';

@Module({
  controllers: [TaxonomyController, AdminTaxonomyController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
