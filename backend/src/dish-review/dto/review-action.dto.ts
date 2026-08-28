import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewActionDto {
  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ description: 'Mã lý do (tùy chọn)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reasonCode?: string;
}

export class RequestChangesDto extends ReviewActionDto {
  @ApiPropertyOptional({ description: 'Danh sách trường cần sửa', isArray: true, type: String })
  @IsOptional()
  @IsString({ each: true })
  fieldsToCorrected?: string[];
}
