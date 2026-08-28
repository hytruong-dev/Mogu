import {
  IngredientParserService,
  IngredientResolverService,
  normalizeVietnamese,
} from './ingredient.service';

describe('IngredientParserService', () => {
  const parser = new IngredientParserService();

  it.each([
    ['1–2 muỗng canh nước mắm', 1, 2, 'TBSP'],
    ['1/2 muỗng cà phê muối', 0.5, null, 'TSP'],
    ['muối vừa đủ', null, null, 'VỪA_ĐỦ'],
  ])('parse quantity %s', (raw, quantity, quantityTo, unitCode) => {
    expect(parser.parse(raw)).toMatchObject({ quantity, quantityTo, unitCode });
  });

  it('tách specification và preparation', () => {
    expect(
      parser.parse(
        '45 ml Mắm ruốt (loại mịn, màu nâu đỏ) (Lọc qua rây để bỏ xác)',
      ),
    ).toMatchObject({
      name: 'Mắm ruốt',
      specification: 'loại mịn, màu nâu đỏ',
      preparation: 'Lọc qua rây để bỏ xác',
    });
  });

  it('chuẩn hóa Unicode và dấu tiếng Việt', () => {
    expect(normalizeVietnamese('  MẮM   RUỐT ')).toBe('mam ruot');
  });
});

describe('IngredientResolverService', () => {
  const resolver = new IngredientResolverService();
  const dictionary = [
    { id: '1', name: 'Mắm ruốt', aliases: ['mắm ruốc Huế'] },
    { id: '2', name: 'Thịt ba chỉ', aliases: ['ba chỉ heo'] },
  ];

  it('ưu tiên alias exact', () => {
    const parsed = new IngredientParserService().parse('mắm ruốc Huế');
    expect(resolver.resolve(parsed, dictionary)).toMatchObject({
      matchedIngredientId: '1',
      matchMethod: 'ALIAS',
      confidence: 98,
    });
  });

  it('không tự link fuzzy confidence thấp', () => {
    const parsed = new IngredientParserService().parse('mắm lạ hoàn toàn');
    expect(resolver.resolve(parsed, dictionary).matchedIngredientId).toBeNull();
  });
});
