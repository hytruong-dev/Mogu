import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { DishesService } from './dishes.service';
import { SaveDishResponseDto, UnsaveDishResponseDto } from './dto/dish.dto';

class DishEventDto {
  @ApiProperty({ enum: ['view', 'click', 'share'] })
  @IsIn(['view', 'click', 'share'])
  event!: 'view' | 'click' | 'share';

  @ApiPropertyOptional({
    description: 'Nguồn mở món: explore | random | search | weekly_plan | ...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}

/**
 * Authenticated dish interaction routes (save + engagement events).
 * Public dish GET lives in controllers/dishes.controller.ts.
 */
@ApiTags('Dishes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dishes')
export class DishInteractionController {
  constructor(private readonly dishesService: DishesService) {}

  @Public()
  @Post(':id/events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi nhận sự kiện tương tác món (view/click/share)' })
  @ApiParam({ name: 'id', description: 'UUID hoặc slug của món ăn' })
  async logEvent(
    @CurrentUser('sub') userId: string | undefined,
    @Param('id') dishId: string,
    @Body() dto: DishEventDto,
  ) {
    const effectiveUserId = userId ?? '00000000-0000-0000-0000-000000000000';
    return this.dishesService.logEvent(effectiveUserId, dishId, dto.event, dto.source);
  }

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
