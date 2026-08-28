import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { CreateDishDto } from './create-dish.dto';

export class UpdateDishDto extends PartialType(CreateDishDto) {
  @ApiPropertyOptional({
    description:
      'Version hiện tại của dish — dùng cho optimistic locking qua If-Match header. ' +
      'Nếu gửi trong body cũng được chấp nhận (số nguyên).',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  version?: number;
}
