import { DishQueryService } from './dish-query.service';

function baseDish(dishIngredients: any[]) {
  return {
    id: 'd1',
    name: 'Chả lá lốt',
    shortDescription: 'Món cuốn thơm',
    categories: [{ id: 'c1' }],
    mealTypes: [{ id: 'm1' }],
    media: [{ isPrimary: true }],
    nutrition: { calories: 300 },
    recipeSteps: [{ stepOrder: 1 }],
    sources: [{ url: 'https://x' }],
    dishIngredients,
  };
}

function makeService(dish: any) {
  const config = { get: jest.fn().mockReturnValue('') };
  const service = new DishQueryService({ db: {} } as any, config as any);
  jest.spyOn(service, 'adminDetail').mockResolvedValue(dish);
  return service;
}

describe('DishQueryService.getValidation ingredient gate', () => {
  it('allows submit when all ingredients are ACTIVE', async () => {
    const service = makeService(
      baseDish([
        { id: 'di1', rawText: 'Thịt heo', ingredientId: 'i1', ingredient: { id: 'i1', name: 'Thịt heo', status: 'ACTIVE' } },
      ]),
    );
    const v = await service.getValidation('d1');
    expect(v.canSubmitReview).toBe(true);
    expect(v.ingredientIssues).toEqual([]);
    expect(v.blockingErrors.find((e) => e.code === 'INGREDIENTS_NOT_APPROVED')).toBeUndefined();
  });

  it('blocks with INGREDIENTS_NOT_APPROVED and lists pending / unlinked / rejected ingredients', async () => {
    const service = makeService(
      baseDish([
        { id: 'di1', rawText: 'Thịt heo', ingredientId: 'i1', ingredient: { id: 'i1', name: 'Thịt heo', status: 'ACTIVE' } },
        {
          id: 'di2', rawText: 'Lá lốt', ingredientId: 'i2',
          ingredient: { id: 'i2', name: 'Lá lốt', status: 'PENDING_REVIEW', imageStatus: 'PENDING_REVIEW', imageUrl: 'u', createdVia: 'AI_IMPORT' },
        },
        { id: 'di3', rawText: 'Gia vị bí mật', ingredientId: null, ingredient: null },
        { id: 'di4', rawText: 'Mỡ chài', ingredientId: 'i4', ingredient: { id: 'i4', name: 'Mỡ chài', status: 'REJECTED' } },
      ]),
    );

    const v = await service.getValidation('d1');

    expect(v.canSubmitReview).toBe(false);
    const err = v.blockingErrors.find((e) => e.code === 'INGREDIENTS_NOT_APPROVED');
    expect(err).toBeDefined();
    expect(err!.section).toBe('INGREDIENTS');
    expect(err!.message).toContain('3 nguyên liệu');
    expect(err!.message).toContain('Lá lốt');
    expect(v.ingredientIssues.map((i: any) => [i.dishIngredientId, i.reason])).toEqual([
      ['di2', 'PENDING_REVIEW'],
      ['di3', 'UNLINKED'],
      ['di4', 'REJECTED'],
    ]);
    expect(v.ingredientIssues[0]).toMatchObject({ createdVia: 'AI_IMPORT', imageStatus: 'PENDING_REVIEW' });
    expect(v.sections.find((s) => s.key === 'INGREDIENTS')?.status).toBe('ERROR');
  });
});
