import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

// ─── Query ───────────────────────────────────────────────────────────────────

export class WeatherQueryDto {
  @ApiProperty({ example: 21.03, description: 'Vĩ độ (latitude)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 105.85, description: 'Kinh độ (longitude)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export type WeatherIconCode = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'unknown';

export class WeatherResponseDto {
  @ApiProperty({ example: 28, description: 'Nhiệt độ hiện tại (°C)' })
  tempC: number;

  @ApiProperty({ example: 'Trời đẹp', description: 'Mô tả thời tiết tiếng Việt' })
  description: string;

  @ApiProperty({
    example: 'sunny',
    enum: ['sunny', 'cloudy', 'rainy', 'stormy', 'foggy', 'unknown'],
    description: 'Icon code để mobile map sang icon',
  })
  iconCode: WeatherIconCode;
}
