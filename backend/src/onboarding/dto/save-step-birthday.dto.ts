import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class SaveStepBirthdayDto {
  /**
   * ISO date string: YYYY-MM-DD
   * Validation: không được là ngày tương lai
   */
  @ApiProperty({
    description: 'Ngày sinh (ISO date). Không được là ngày tương lai.',
    example: '1995-06-15',
  })
  @IsNotEmpty({ message: 'Vui lòng nhập ngày sinh.' })
  @IsDateString({}, { message: 'Ngày sinh chưa hợp lệ. Vui lòng kiểm tra lại.' })
  dateOfBirth!: string;
}
