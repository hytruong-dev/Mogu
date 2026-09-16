import { Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DishesService } from './dishes.service';
import { SaveDishResponseDto, UnsaveDishResponseDto } from './dto/dish.dto';

/**
 * Legacy dish save routes — deprecated in favor of /me/saved-dishes (Docs 02).
 * Kept as temporary proxies so older clients do not hard-fail; prefer /me/saved-dishes.
 */
@ApiTags('Dishes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dishes')
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Deprecated] Dùng PUT /me/saved-dishes/:dishId',
    deprecated: true,
  })
  @ApiParam({ name: 'id', description: 'UUID của món ăn' })
  @ApiOkResponse({ type: SaveDishResponseDto })
  @ApiNotFoundResponse({ description: 'Món không tồn tại hoặc đã bị ẩn' })
  async saveDish(
    @CurrentUser('sub') userId: string,
    @Param('id') dishId: string,
  ): Promise<SaveDishResponseDto> {
    return this.dishesService.saveDish(userId, dishId);
  }

  @Delete(':id/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Deprecated] Dùng DELETE /me/saved-dishes/:dishId',
    deprecated: true,
  })
  @ApiParam({ name: 'id', description: 'UUID của món ăn' })
  @ApiOkResponse({ type: UnsaveDishResponseDto })
  async unsaveDish(
    @CurrentUser('sub') userId: string,
    @Param('id') dishId: string,
  ): Promise<UnsaveDishResponseDto> {
    return this.dishesService.unsaveDish(userId, dishId);
  }
}
