import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomFoodsService } from './custom-foods.service';

export class CustomFoodDto {
  name: string;
  calories: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
  servingSize?: string;
}

@ApiTags('CustomFoods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/custom-foods')
export class CustomFoodsController {
  constructor(private readonly customFoodsService: CustomFoodsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo món ăn tùy chỉnh' })
  create(
    @CurrentUser() user: any,
    @Body() dto: CustomFoodDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.customFoodsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách món ăn tùy chỉnh của tôi' })
  list(@CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.customFoodsService.list(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật món ăn tùy chỉnh (yêu cầu If-Match)' })
  @ApiHeader({ name: 'If-Match', required: true })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: Partial<CustomFoodDto>,
    @Headers('if-match') ifMatch?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.customFoodsService.update(userId, id, dto, ifMatch);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa món ăn tùy chỉnh (yêu cầu If-Match)' })
  @ApiHeader({ name: 'If-Match', required: true })
  remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user.sub ?? user.id);
    return this.customFoodsService.remove(userId, id, ifMatch);
  }
}
