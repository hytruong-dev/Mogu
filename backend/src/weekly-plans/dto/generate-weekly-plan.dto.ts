import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWeeklyPlanDto {
  @ApiProperty({
    description: 'Ngay bat dau ke hoach (ISO date, YYYY-MM-DD)',
    example: '2026-08-25',
  })
  @IsDateString()
  startDate: string;
}
