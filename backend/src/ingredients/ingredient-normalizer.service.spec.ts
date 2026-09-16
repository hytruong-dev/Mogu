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
    expect(normalizer.identityKey('cá')).not.toBe(normalizer.identityKey('cà chua'));
  });

  it('does not treat prefix as equal identity', () => {
    expect(normalizer.identityKey('gạo')).not.toBe(normalizer.identityKey('gạo nếp'));
    expect(normalizer.identityKey('sả')).not.toBe(normalizer.identityKey('sả chanh'));
  });

  it('folds diacritics for search only', () => {
    expect(normalizer.searchFolded('Cà chua')).toBe('ca chua');
  });
});
