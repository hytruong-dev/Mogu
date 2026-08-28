import { DuplicateScoringService } from './duplicate-scoring.service';

describe('DuplicateScoringService', () => {
  const service = new DuplicateScoringService();

  it('flags a strongly matching published dish without authorizing overwrite', () => {
    const result = service.score(
      {
        name: 'Phở bò Hà Nội',
        regionCode: 'NORTH',
        provinceCode: 'HA_NOI',
        categoryCodes: ['NOODLE'],
        mainIngredients: ['xương bò', 'bánh phở'],
        recipeTokens: ['ninh xương', 'chan bánh phở'],
      },
      {
        id: 'dish-1',
        name: 'Phở bò Hà Nội',
        status: 'PUBLISHED',
        regionCode: 'NORTH',
        provinceCode: 'HA_NOI',
        categoryCodes: ['NOODLE'],
        mainIngredients: ['xương bò', 'bánh phở'],
        recipeTokens: ['ninh xương', 'chan bánh phở'],
      },
    );

    expect(result).toMatchObject({
      candidateId: 'dish-1',
      score: 100,
      decision: 'LIKELY_DUPLICATE',
      protectedPublishedCandidate: true,
    });
  });

  it('ranks unrelated dishes below the review threshold', () => {
    const result = service.score(
      {
        name: 'Phở bò',
        regionCode: 'NORTH',
        mainIngredients: ['xương bò'],
      },
      {
        id: 'dish-2',
        name: 'Chè đậu xanh',
        regionCode: 'SOUTH',
        mainIngredients: ['đậu xanh', 'đường'],
      },
    );

    expect(result.decision).toBe('NONE');
    expect(result.score).toBeLessThan(70);
  });
});
