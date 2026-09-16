import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ProfileVisibility } from '@prisma/client';

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mealRemindersEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  waterRemindersEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weeklyPlanNotif?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  communityNotif?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingNotif?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shareData?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  analyticsEnabled?: boolean;

  @ApiPropertyOptional({ enum: ProfileVisibility })
  @IsOptional()
  @IsEnum(ProfileVisibility)
  profileVisibility?: ProfileVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showDietActivity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiPropertyOptional({ description: 'Alias of theme' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Alias of theme' })
  @IsOptional()
  @IsString()
  appTheme?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;
}
