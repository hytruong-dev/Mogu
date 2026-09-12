import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GreetingDto {
  @ApiProperty({ example: 'Chào buổi sáng' })
  phrase: string;

  @ApiProperty({ example: 'Huy' })
  name: string;

  @ApiProperty({ example: 'Chào buổi sáng, Huy!' })
  full: string;
}

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

// ─── Widgets Contract (§4) ───────────────────────────────────────────────────

export class WidgetEnvelopeDto<T> {
  @ApiProperty({ enum: ['ok', 'unavailable', 'no_data', 'error'] })
  status: 'ok' | 'unavailable' | 'no_data' | 'error';

  @ApiPropertyOptional()
  data?: T | null;
}

export class HomeWidgetsDto {
  greeting: WidgetEnvelopeDto<{
    text: string;
    timeOfDay: 'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING';
  }>;

  weather: WidgetEnvelopeDto<{
    condition: string;
    temperatureC: number;
    suggestionText: string;
  }>;

  weeklyPlan: WidgetEnvelopeDto<{
    planId?: string;
    status?: string;
    todayMealsCount: number;
    completedMealsCount: number;
    remainingBudgetVnd: number;
  } | null>;

  nutrition: WidgetEnvelopeDto<{
    consumedKcal: number;
    targetKcal: number;
    remainingKcal: number;
    waterMl: number;
    waterTargetMl: number;
  } | null>;

  recommendations: WidgetEnvelopeDto<
    Array<{
      id: string;
      name: string;
      imageUrl?: string;
      energyKcal: number;
      priceMin?: number;
      cookingTimeMinutes: number;
      isSaved: boolean;
    }>
  >;

  notifications: WidgetEnvelopeDto<{
    unreadCount: number;
  }>;
}

export class HomeDashboardResponseDto {
  @ApiProperty({ example: '2026-08-12T03:00:00.000Z' })
  generatedAt: string;

  @ApiProperty({ example: '2026-08-12' })
  localDate: string;

  @ApiProperty({ example: 300 })
  cacheTtl: number;

  @ApiProperty({ example: 300 })
  cacheTtlSec: number;

  @ApiProperty({ example: 2 })
  profileVersion: number;

  // Widgets envelope object (§4)
  widgets: HomeWidgetsDto;

  // Legacy top-level fields for backwards compatibility
  @ApiProperty({ enum: ['ok', 'error'] })
  greetingStatus: 'ok' | 'error';

  @ApiPropertyOptional({ type: GreetingDto })
  greeting?: GreetingDto;

  @ApiProperty({ enum: ['ok', 'error', 'empty'] })
  recommendationsStatus: 'ok' | 'error' | 'empty';

  @ApiPropertyOptional({ type: [RecommendationCardDto] })
  recommendations?: RecommendationCardDto[];

  @ApiProperty({ enum: ['ok', 'error', 'empty'] })
  nutritionStatus: 'ok' | 'error' | 'empty';

  @ApiPropertyOptional({ type: NutritionSummaryDto })
  nutritionSummary?: NutritionSummaryDto;

  @ApiProperty({ enum: ['ok', 'error'] })
  notificationStatus: 'ok' | 'error';

  @ApiProperty({ example: 3 })
  unreadCount: number;
}
