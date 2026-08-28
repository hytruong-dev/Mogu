import { Module } from '@nestjs/common'
import { DishesModule } from '../dishes/dishes.module'
import { DishFileImportsController } from './dish-file-imports.controller'
import { DishFileImportsService } from './dish-file-imports.service'

@Module({
  imports: [DishesModule],
  controllers: [DishFileImportsController],
  providers: [DishFileImportsService],
})
export class DishFileImportsModule {}
