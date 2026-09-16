import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class NotificationQueryDto {
  @ApiPropertyOptional({ example: 1, deprecated: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Cursor = notification id' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class NotificationDto {
  @ApiProperty({ example: 'notif-uuid-123' })
  id: string;

  @ApiProperty({ enum: ['SYSTEM', 'PROMO', 'REMINDER', 'ACHIEVEMENT'] })
  type: string;

  @ApiProperty({ example: 'Gợi ý bữa trưa cho bạn!' })
  title: string;

  @ApiProperty({ example: 'Hôm nay thử Phở bò nhé?' })
  body: string;

  @ApiPropertyOptional({ example: 'mogu://dishes/abc-123' })
  deepLink?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty({ enum: ['UNREAD', 'READ'] })
  status: string;

  @ApiPropertyOptional()
  readAt?: string;

  @ApiProperty()
  createdAt: string;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  count: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationDto] })
  data: NotificationDto[];

  @ApiProperty({ type: [NotificationDto] })
  items: NotificationDto[];

  @ApiPropertyOptional()
  page?: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: false })
  hasMore: boolean;

  @ApiPropertyOptional()
  nextCursor?: string | null;

  @ApiPropertyOptional()
  pageInfo?: { nextCursor: string | null; hasMore: boolean };
}

export class RegisterPushInstallationDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'ios' })
  @IsString()
  platform: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appVersion?: string;
}
