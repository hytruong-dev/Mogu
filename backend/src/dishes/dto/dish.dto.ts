import { ApiProperty } from '@nestjs/swagger';

export class SaveDishResponseDto {
  @ApiProperty({ example: 'dish-uuid-123' })
  dishId: string;

  @ApiProperty({ example: true })
  saved: boolean;

  @ApiProperty({ example: '2026-08-12T03:00:00.000Z' })
  savedAt: string;
}

export class UnsaveDishResponseDto {
  @ApiProperty({ example: 'dish-uuid-123' })
  dishId: string;

  @ApiProperty({ example: false })
  saved: boolean;
}
