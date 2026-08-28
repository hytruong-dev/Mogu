import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateImportJobDto,
  ImportSourceType,
} from './create-import-job.dto';

describe('CreateImportJobDto', () => {
  it('trim dữ liệu và chấp nhận request hợp lệ', async () => {
    const dto = plainToInstance(CreateImportJobDto, {
      query: '  Phở bò  ',
      relatedKeywords: ['  phở tái  '],
      regionHint: 'north',
      sourceTypes: [ImportSourceType.AI_GENERATED],
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.query).toBe('Phở bò');
    expect(dto.relatedKeywords).toEqual(['phở tái']);
  });

  it('từ chối region, source và số lượng keyword ngoài contract', async () => {
    const dto = plainToInstance(CreateImportJobDto, {
      query: 'Phở bò',
      relatedKeywords: Array.from({ length: 11 }, () => 'keyword'),
      regionHint: 'unknown',
      sourceTypes: ['CRAWLER'],
    });

    const fields = (await validate(dto)).map((error) => error.property);
    expect(fields).toEqual(
      expect.arrayContaining(['relatedKeywords', 'regionHint', 'sourceTypes']),
    );
  });
});
