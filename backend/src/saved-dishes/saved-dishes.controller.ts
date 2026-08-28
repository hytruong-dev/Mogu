import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SavedDishesService } from './saved-dishes.service';

@ApiTags('me/saved-dishes')
@Controller('me/saved-dishes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SavedDishesController {
  constructor(private readonly savedDishesService: SavedDishesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách món đã lưu' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @CurrentUser('sub') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.savedDishesService.list(userId, cursor, limit);
  }

  @Post(':dishId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lưu món (idempotent)' })
  save(@CurrentUser('sub') userId: string, @Param('dishId') dishId: string) {
    return this.savedDishesService.save(userId, dishId);
  }

  @Delete(':dishId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bỏ lưu món (idempotent)' })
  unsave(@CurrentUser('sub') userId: string, @Param('dishId') dishId: string) {
    return this.savedDishesService.unsave(userId, dishId);
  }
}
