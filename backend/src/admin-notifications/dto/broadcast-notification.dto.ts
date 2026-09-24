import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum BroadcastScope {
  ALL = 'ALL',
  SPECIFIC_USER = 'SPECIFIC_USER',
}

export enum BroadcastType {
  SYSTEM = 'SYSTEM',
  PROMO = 'PROMO',
  REMINDER = 'REMINDER',
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: 'Tiêu đề thông báo' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Nội dung thông báo' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ enum: BroadcastType, default: BroadcastType.SYSTEM })
  @IsOptional()
  @IsEnum(BroadcastType)
  type?: BroadcastType = BroadcastType.SYSTEM;

  @ApiPropertyOptional({ enum: BroadcastScope, default: BroadcastScope.ALL })
  @IsOptional()
  @IsEnum(BroadcastScope)
  scope?: BroadcastScope = BroadcastScope.ALL;

  @ApiPropertyOptional({ description: 'Target userId hoặc username nếu scope = SPECIFIC_USER' })
  @IsOptional()
  @IsString()
  targetUser?: string;

  @ApiPropertyOptional({ description: 'Deep link mở màn hình app (mogu://...)' })
  @IsOptional()
  @IsString()
  deepLink?: string;
}
