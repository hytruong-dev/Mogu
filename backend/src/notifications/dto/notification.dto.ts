import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class NotificationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
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

  @ApiPropertyOptional({ example: '/dishes/abc-123' })
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
  @ApiProperty({ example: 3, description: 'Số thông báo chưa đọc (raw count, client hiển thị 99+ nếu > 99)' })
  count: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationDto] })
  data: NotificationDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: false })
  hasMore: boolean;
}
