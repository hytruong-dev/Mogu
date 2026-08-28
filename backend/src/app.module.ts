import { Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ProfileModule } from './profile/profile.module';
// BA-003: Home & Navigation
import { HomeModule } from './home/home.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { DishesModule } from './dishes/dishes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { WeatherModule } from './weather/weather.module';
// BA-004: Dishes module full
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { DishReviewModule } from './dish-review/dish-review.module';
import { RandomizationModule } from './randomization/randomization.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SavedDishesModule } from './saved-dishes/saved-dishes.module';
import { DishMediaModule } from './dish-media/dish-media.module';
// BA-005: Explore (Topics, Articles, Community, Explore Feed)
import { TopicsModule } from './topics/topics.module';
import { ArticlesModule } from './articles/articles.module';
import { CommunityModule } from './community/community.module';
import { ExploreModule } from './explore/explore.module';
// AI Import Pipeline
import { AiImportModule } from './ai-import/ai-import.module';
// BA-005: Weekly Meal Plan
import { WeeklyPlansModule } from './weekly-plans/weekly-plans.module';
import { DishFileImportsModule } from './dish-file-imports/dish-file-imports.module';
import appConfig from './config/app.config';

// Chá»‰ load BullMQ khi REDIS_URL Ä‘Æ°á»£c set rÃµ rÃ ng
const REDIS_URL = process.env.REDIS_URL;
const bullModules: DynamicModule[] = REDIS_URL
  ? [
      BullModule.forRoot({
        connection: {
          url: REDIS_URL,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true,
          retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 500, 2000)),
        },
      }),
    ]
  : [];

@Module({
  imports: [
    // â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // â”€â”€ BullMQ Redis (chá»‰ khi REDIS_URL Ä‘Æ°á»£c set) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ...bullModules,

    // â”€â”€ Logger (Pino) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization'],
        serializers: {
          req(req) {
            return { method: req.method, url: req.url };
          },
        },
      },
    }),

    // â”€â”€ Database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    PrismaModule,

    // â”€â”€ Core Modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    AuthModule,
    CatalogModule,
    OnboardingModule,
    ProfileModule,

    // â”€â”€ BA-003: Home & Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    HomeModule,
    RecommendationsModule,
    DishesModule,
    NotificationsModule,
    NutritionModule,
    WeatherModule,

    // â”€â”€ BA-004: Full Dishes System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    TaxonomyModule,
    IngredientsModule,
    DishReviewModule,
    RandomizationModule,
    SavedDishesModule,
    ReviewsModule,
    DishMediaModule,

    // ── BA-005: Explore ────────────────────────────────────────────────────
    TopicsModule,
    ArticlesModule,
    CommunityModule,
    ExploreModule,

    // ── AI Import Pipeline ─────────────────────────────────────────────────
    AiImportModule,

    // ── BA-005: Weekly Meal Plan ────────────────────────────────────────────────
    WeeklyPlansModule,
    DishFileImportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }



