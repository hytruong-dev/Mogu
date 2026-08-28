import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class NutritionTodayQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-12',
    description: 'Ngày local của user (YYYY-MM-DD). Mặc định: ngày hôm nay theo VN timezone.',
  })
  @IsOptional()
  @IsDateString()
  localDate?: string;
}

export class NutritionTodayResponseDto {
  @ApiProperty({ example: '2026-08-12' })
  date: string;

  @ApiProperty({
    enum: ['no_data', 'partial', 'complete'],
    description: '"no_data" khi chưa có bữa ăn nào (HOME-BR-012: không hiển thị số 0)',
  })
  dataStatus: 'no_data' | 'partial' | 'complete';

  @ApiPropertyOptional({ example: 1250, description: 'Tổng kcal đã tiêu thụ hôm nay' })
  caloriesConsumed?: number;

  @ApiPropertyOptional({ example: 2000, description: 'Mục tiêu kcal từ hồ sơ user' })
  calorieTarget?: number;

  @ApiPropertyOptional({ example: 55.5, description: 'Tổng protein (gram) từ meal items' })
  proteinG?: number;

  @ApiPropertyOptional({ example: 1500, description: 'Tổng nước (ml) — nếu có ghi nhận' })
  waterMl?: number;

  @ApiPropertyOptional({ example: 3, description: 'Số bữa ăn đã ghi hôm nay' })
  mealsLogged?: number;
}
