import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteWeeklyPlanSlotDto {
  @ApiProperty({ description: 'Chi phi thuc te (VND), mac dinh = snapshot', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  actualCostVnd?: number;

  @ApiProperty({ description: 'Kcal thuc te, mac dinh = snapshot', required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  actualKcal?: number;

  @ApiProperty({ description: 'Slot version for optimistic lock' })
  @IsInt()
  @Min(1)
  version: number;
}
