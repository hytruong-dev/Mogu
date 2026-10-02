import { IngredientNormalizerService } from './ingredient-normalizer.service';

describe('IngredientNormalizerService', () => {
  const normalizer = new IngredientNormalizerService();

  it('strips parentheses and hoặc tails', () => {
    expect(normalizer.cleanDisplayName('Rau thơm (húng lủi)')).toBe('Rau thơm');
    expect(normalizer.cleanDisplayName('Dầu ăn hoặc dầu oliu')).toBe('Dầu ăn');
  });

  it('keeps diacritics in identity key so cá ≠ cà chua', () => {
    expect(normalizer.identityKey('cá')).toBe('cá');
    expect(normalizer.identityKey('cà chua')).toBe('cà chua');
    expect(normalizer.identityKey('cá')).not.toBe(
      normalizer.identityKey('cà chua'),
    );
  });

  it('does not treat prefix as equal identity', () => {
    expect(normalizer.identityKey('gạo')).not.toBe(
      normalizer.identityKey('gạo nếp'),
    );
    expect(normalizer.identityKey('sả')).not.toBe(
      normalizer.identityKey('sả chanh'),
    );
  });

  it('folds diacritics for search only', () => {
    expect(normalizer.searchFolded('Cà chua')).toBe('ca chua');
  });

  describe('canonicalKey (đồng nghĩa theo cụm)', () => {
    it('maps lợn → heo only inside known phrases', () => {
      expect(normalizer.canonicalKey('Thịt lợn')).toBe('thit heo');
      expect(normalizer.canonicalKey('Chân giò lợn')).toBe('chan gio heo');
      // "lớn" (to) fold thành "lon" nhưng không nằm trong cụm → giữ nguyên.
      expect(normalizer.canonicalKey('Tôm lớn')).toBe('tom lon');
    });

    it('maps common herb / legume synonyms', () => {
      expect(normalizer.canonicalKey('Hành hoa')).toBe(
        normalizer.canonicalKey('Hành lá'),
      );
      expect(normalizer.canonicalKey('Lạc rang')).toBe(
        normalizer.canonicalKey('Đậu phộng rang'),
      );
      expect(normalizer.canonicalKey('Rau mùi')).toBe(
        normalizer.canonicalKey('Ngò rí'),
      );
    });

    it('does not collapse bắp bò into ngô', () => {
      expect(normalizer.canonicalKey('Bắp bò')).toBe('bap bo');
      expect(normalizer.canonicalKey('Bắp Mỹ')).toBe('ngo my');
    });
  });

  describe('containmentScore', () => {
    it('scores chân giò heo ⊇ giò heo as a strong candidate but not 100', () => {
      const score = normalizer.containmentScore('Chân giò heo', 'Giò heo');
      expect(score).toBeGreaterThanOrEqual(90);
      expect(score).toBeLessThan(100);
    });

    it('treats neutral modifiers as identical', () => {
      expect(normalizer.containmentScore('Cà chua tươi', 'Cà chua')).toBe(100);
    });

    it('does not relate unrelated names', () => {
      expect(normalizer.containmentScore('Cá', 'Cà chua')).toBe(0);
    });

    it('ignores preparation verbs leaked into names (tỏi băm = tỏi, sả cây = sả)', () => {
      expect(normalizer.containmentScore('tỏi băm', 'Tỏi')).toBe(100);
      expect(normalizer.containmentScore('sả cây', 'Sả')).toBe(100);
      expect(normalizer.containmentScore('ớt xay', 'Ớt')).toBe(100);
    });

    it('does not confuse giò sống with giò heo or dứa with dừa', () => {
      expect(normalizer.containmentScore('giò sống', 'giò heo')).toBeLessThan(
        90,
      );
      expect(normalizer.containmentScore('dứa', 'dừa')).toBe(0);
      expect(normalizer.containmentScore('giá đỗ', 'đỗ')).toBeLessThan(100);
    });

    it('keeps meaning-changing modifiers as weaker candidates', () => {
      // "chay" đổi bản chất → chỉ 80, không đủ để tự link.
      expect(normalizer.containmentScore('Nước mắm chay', 'Nước mắm')).toBe(80);
    });
  });
});
