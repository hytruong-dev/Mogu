import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Widget status ──────────────────────────────────────────────────────────

export class WidgetErrorDto {
  @ApiProperty({ example: 'error' })
  status: 'ok' | 'error' | 'empty';

  @ApiPropertyOptional({ example: 'SERVICE_TIMEOUT' })
  errorCode?: string;
}

// ─── Greeting ────────────────────────────────────────────────────────────────

export class GreetingDto {
  @ApiProperty({ example: 'Chào buổi sáng' })
  phrase: string;

  @ApiProperty({ example: 'Huy' })
  name: string;

  @ApiProperty({ example: 'Chào buổi sáng, Huy!' })
  full: string;
}

// ─── Recommendation Card ─────────────────────────────────────────────────────

export class RecommendationCardDto {
  @ApiProperty()
  dishId: string;

  @ApiProperty({ example: 'Phở bò' })
  name: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty({ example: 450 })
  calories: number;

  @ApiProperty({ example: 20 })
  prepMinutes: number;

  @ApiPropertyOptional({ example: '25000-50000' })
  priceRange?: string;

  @ApiPropertyOptional({ example: 'Phù hợp với mục tiêu cân bằng của bạn' })
  reasonShort?: string;

  @ApiProperty({ example: false })
  isSaved: boolean;
}

// ─── Nutrition Summary ───────────────────────────────────────────────────────

export class NutritionSummaryDto {
  @ApiProperty({ example: '2026-08-12' })
  date: string;

  @ApiProperty({ enum: ['no_data', 'partial', 'complete'] })
  dataStatus: 'no_data' | 'partial' | 'complete';

  @ApiPropertyOptional({ example: 1200 })
  caloriesConsumed?: number;

  @ApiPropertyOptional({ example: 2000 })
  calorieTarget?: number;

  @ApiPropertyOptional({ example: 55 })
  proteinG?: number;

  @ApiPropertyOptional({ example: 1500 })
  waterMl?: number;
}

// ─── Home Dashboard ──────────────────────────────────────────────────────────

export class HomeDashboardResponseDto {
  @ApiProperty({ example: '2026-08-12T03:00:00.000Z' })
  generatedAt: string;

  @ApiProperty({ example: '2026-08-12' })
  localDate: string;

  @ApiProperty({ example: 300 })
  cacheTtl: number;

  @ApiProperty({ example: 2 })
  profileVersion: number;

  // Greeting widget
  @ApiProperty({ enum: ['ok', 'error'] })
  greetingStatus: 'ok' | 'error';

  @ApiPropertyOptional({ type: GreetingDto })
  greeting?: GreetingDto;

  // Recommendations widget
  @ApiProperty({ enum: ['ok', 'error', 'empty'] })
  recommendationsStatus: 'ok' | 'error' | 'empty';

  @ApiPropertyOptional({ type: [RecommendationCardDto] })
  recommendations?: RecommendationCardDto[];

  // Nutrition widget
  @ApiProperty({ enum: ['ok', 'error', 'empty'] })
  nutritionStatus: 'ok' | 'error' | 'empty';

  @ApiPropertyOptional({ type: NutritionSummaryDto })
  nutritionSummary?: NutritionSummaryDto;

  // Notification widget
  @ApiProperty({ enum: ['ok', 'error'] })
  notificationStatus: 'ok' | 'error';

  @ApiProperty({ example: 3 })
  unreadCount: number;
}
