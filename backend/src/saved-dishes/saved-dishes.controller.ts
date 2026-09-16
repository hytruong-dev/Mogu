import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
  @ApiQuery({ name: 'q', required: false })
  list(
    @CurrentUser() user: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('q') q?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.savedDishesService.list(userId, cursor, limit, q);
  }

  @Put(':dishId')
  @Post(':dishId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lưu món (idempotent PUT/POST)' })
  save(@CurrentUser() user: any, @Param('dishId') dishId: string) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.savedDishesService.save(userId, dishId);
  }

  @Delete(':dishId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bỏ lưu món (idempotent, 204)' })
  async unsave(@CurrentUser() user: any, @Param('dishId') dishId: string) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    await this.savedDishesService.unsave(userId, dishId);
  }
}
