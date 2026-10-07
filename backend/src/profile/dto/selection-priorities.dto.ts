import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SelectionPriorityItemDto {
  @ApiProperty({ example: 'HEALTHY' })
  @IsString()
  @Matches(/^[A-Z_]{2,32}$/, { message: 'Mã ưu tiên không hợp lệ.' })
  code!: string;

  @ApiProperty({ example: 0.8, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  weight!: number;
}

export class PutSelectionPrioritiesDto {
  @ApiProperty({ type: [SelectionPriorityItemDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SelectionPriorityItemDto)
  items!: SelectionPriorityItemDto[];
}
