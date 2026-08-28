import { IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LockWeeklyPlanSlotDto {
  @ApiProperty({ description: 'Khoa hay mo slot' })
  @IsBoolean()
  isLocked: boolean;

  @ApiProperty({ description: 'Slot version for optimistic lock' })
  @IsInt()
  @Min(1)
  version: number;
}
