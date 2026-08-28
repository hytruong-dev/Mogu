import {
  DisabledNutritionSourceAdapter,
  NutritionSourceAdapter,
  NutritionSourceRegistry,
} from './nutrition-source-adapter';

describe('NutritionSourceRegistry', () => {
  it('keeps future providers disabled by default', async () => {
    const registry = new NutritionSourceRegistry([
      new DisabledNutritionSourceAdapter('USDA_FDC'),
      new DisabledNutritionSourceAdapter('VIETNAM_FCT'),
    ]);

    expect(registry.enabled()).toEqual([]);
    await expect(
      registry.lookup({ canonicalName: 'xương bò', amountGram: 100 }),
    ).resolves.toEqual([]);
  });

  it('queries only enabled adapters and ranks matches', async () => {
    const disabled: NutritionSourceAdapter = {
      providerCode: 'DISABLED',
      isEnabled: () => false,
      lookup: jest.fn(),
    };
    const enabled: NutritionSourceAdapter = {
      providerCode: 'TEST',
      isEnabled: () => true,
      lookup: async () => [
        {
          sourceFoodId: '1',
          sourceFoodName: 'Beef',
          basisGram: 100,
          nutrients: { proteinG: 26 },
          confidence: 91,
          source: {
            kind: 'NUTRITION_DATABASE',
            uri: 'https://nutrition.test/1',
            retrievedAt: '2026-08-28T00:00:00.000Z',
          },
        },
      ],
    };

    const result = await new NutritionSourceRegistry([
      disabled,
      enabled,
    ]).lookup({ canonicalName: 'thịt bò' });

    expect(disabled.lookup).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ sourceFoodId: '1', confidence: 91 });
  });
});
