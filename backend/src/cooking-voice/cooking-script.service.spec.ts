import { PrismaService } from '../prisma/prisma.service';
import {
  CookingScriptService,
  ingredientsSummary,
} from './cooking-script.service';
import { VoiceCacheService } from './voice-cache.service';
describe('authoritative cooking script', () => {
  const dish = {
    id: 'dish',
    name: 'Canh',
    version: 2,
    dishIngredients: [
      { rawText: '200g thịt', quantity: 200, unit: 'g', groupLabel: 'Chính' },
      {
        rawText: 'muối',
        quantityText: 'một ít',
        isOptional: true,
        groupLabel: 'Gia vị',
      },
    ],
    recipeSteps: [
      { stepOrder: 2, instruction: 'Nấu', durationMin: 10 },
      { stepOrder: 3, instruction: 'Ăn', durationMin: null },
    ],
  };
  const setup = (value: unknown) => {
    const findFirst = jest.fn(async () => value);
    const speech = jest.fn(async (text: string) => ({
      text,
      audioUrl: null,
      durationMs: null,
    }));
    return {
      service: new CookingScriptService(
        { db: { dish: { findFirst } } } as unknown as PrismaService,
        { publicRecipeSpeech: speech } as unknown as VoiceCacheService,
      ),
      findFirst,
      speech,
    };
  };
  it('reads ingredient quantities/ranges/group labels/optional and clean names', () => {
    const text = ingredientsSummary(dish.dishIngredients);
    expect(text).toContain('Chính: 200 g thịt');
    expect(text).toContain('Gia vị: một ít muối, tùy chọn');
    expect(
      ingredientsSummary([
        {
          rawText: 'trứng',
          quantity: 1,
          quantityTo: 2,
          unit: 'quả',
          ingredient: { name: 'Trứng gà' },
        },
      ]),
    ).toContain('1 đến 2 quả Trứng gà');
    expect(
      ingredientsSummary([{ rawText: 'nước', quantity: 0, unit: 'ml' }]),
    ).toContain('0 ml nước');
    expect(ingredientsSummary([])).toContain('chưa có thông tin');
  });
  it('queries published recipe with stable authoritative ordering and never claims timer started', async () => {
    const { service, findFirst } = setup(dish);
    const result = await service.script('dish');
    expect(findFirst.mock.calls[0]).toBeDefined();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          deletedAt: null,
        }),
        include: expect.objectContaining({
          recipeSteps: { orderBy: { stepOrder: 'asc' } },
        }),
      }),
    );
    expect(result.steps.map((s) => s.stepOrder)).toEqual([2, 3]);
    expect(result.greeting.text).toContain('NOAN đây!');
    expect(result.steps[0].text).toContain('Thời gian gợi ý là 10 phút');
    expect(result.steps[0].text).not.toContain('đã hẹn giờ');
    expect(result.steps[0].audioUrl).toBeNull();
    expect(result.recipeVersion).toHaveLength(64);
  });
  it('bounds rendering concurrency', async () => {
    let active = 0;
    let peak = 0;
    const { service, speech } = setup({
      ...dish,
      recipeSteps: Array.from({ length: 12 }, (_, i) => ({
        stepOrder: i + 1,
        instruction: 'Nấu',
      })),
    });
    speech.mockImplementation(async (text) => {
      active++;
      peak = Math.max(active, peak);
      await Promise.resolve();
      active--;
      return { text, audioUrl: null, durationMs: null };
    });
    await service.script('dish');
    expect(peak).toBeLessThanOrEqual(3);
  });
  it('rejects unknown/empty/oversized recipes before synthesis', async () => {
    await expect(setup(null).service.script('dish')).rejects.toThrow(
      'COOKING_DISH_NOT_FOUND',
    );
    await expect(
      setup({ ...dish, recipeSteps: [] }).service.script('dish'),
    ).rejects.toThrow('COOKING_RECIPE_HAS_NO_STEPS');
    const { service, speech } = setup({
      ...dish,
      recipeSteps: [{ stepOrder: 1, instruction: 'a'.repeat(4001) }],
    });
    await expect(service.script('dish')).rejects.toThrow(
      'COOKING_RECIPE_TOO_LARGE',
    );
    expect(speech).not.toHaveBeenCalled();
  });
});
