import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SaveStepBodyDto {
  @ApiPropertyOptional({
    description: 'Chiều cao (cm). Hợp lệ: 80–250.',
    example: 170,
    minimum: 80,
    maximum: 250,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Chiều cao phải là số.' })
  @Min(80, { message: 'Chiều cao cần nằm trong khoảng 80–250 cm.' })
  @Max(250, { message: 'Chiều cao cần nằm trong khoảng 80–250 cm.' })
  heightCm?: number | null;

  @ApiPropertyOptional({
    description: 'Cân nặng (kg). Hợp lệ: 20–350, tối đa 1 chữ số thập phân.',
    example: 65.5,
    minimum: 20,
    maximum: 350,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Cân nặng tối đa 1 chữ số thập phân.' })
  @Min(20, { message: 'Cân nặng cần nằm trong khoảng 20–350 kg.' })
  @Max(350, { message: 'Cân nặng cần nằm trong khoảng 20–350 kg.' })
  weightKg?: number | null;
}
