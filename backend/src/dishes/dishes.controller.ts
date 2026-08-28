import { Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
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

@ApiTags('Dishes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dishes')
export class DishesController {
  constructor(private readonly dishesService: DishesService) {}

  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lưu món ăn',
    description: 'Lưu món vào danh sách yêu thích. Idempotent — gọi nhiều lần không tạo bản sao.',
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
    summary: 'Bỏ lưu món ăn',
    description: 'Xóa món khỏi danh sách yêu thích. Idempotent — nếu chưa lưu thì không báo lỗi.',
  })
  @ApiParam({ name: 'id', description: 'UUID của món ăn' })
  @ApiOkResponse({ type: UnsaveDishResponseDto })
  @ApiNotFoundResponse({ description: 'Món không tồn tại' })
  async unsaveDish(
    @CurrentUser('sub') userId: string,
    @Param('id') dishId: string,
  ): Promise<UnsaveDishResponseDto> {
    return this.dishesService.unsaveDish(userId, dishId);
  }
}
