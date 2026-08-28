import { IsUUID, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { WeeklyPlanSwapReason } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class SwapWeeklyPlanSlotDto {
  @ApiProperty({ description: 'ID mon an muon doi sang (optional - neu khong co se auto pick)' })
  @IsUUID()
  @IsOptional()
  newDishId?: string;

  @ApiProperty({ enum: WeeklyPlanSwapReason, default: WeeklyPlanSwapReason.USER_REQUEST })
  @IsEnum(WeeklyPlanSwapReason)
  @IsOptional()
  reason?: WeeklyPlanSwapReason;

  @ApiProperty({ description: 'Slot version for optimistic lock' })
  @IsInt()
  @Min(1)
  version: number;
}
