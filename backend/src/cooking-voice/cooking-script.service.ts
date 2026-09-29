import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceCacheService } from './voice-cache.service';
import { MAX_TEXT_LENGTH, SCRIPT_VERSION } from './tts.provider';

export const recipeInclude = {
  dishIngredients: {
    include: { ingredient: true },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  recipeSteps: { orderBy: { stepOrder: 'asc' as const } },
  dishAllergens: { include: { allergen: true } },
};
@Injectable()
export class CookingScriptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly voice: VoiceCacheService,
  ) {}
  async recipe(dishId: string) {
    const dish = await this.prisma.db.dish.findFirst({
      where: {
        id: dishId,
        status: 'PUBLISHED',
        deletedAt: null,
        archivedAt: null,
      },
      include: recipeInclude,
    });
    if (!dish) throw new NotFoundException('COOKING_DISH_NOT_FOUND');
    if (!dish.recipeSteps.length)
      throw new BadRequestException('COOKING_RECIPE_HAS_NO_STEPS');
    if (dish.recipeSteps.length > 40 || dish.dishIngredients.length > 100)
      throw new BadRequestException('COOKING_RECIPE_TOO_LARGE');
    return dish;
  }
  async script(dishId: string) {
    const dish = await this.recipe(dishId);
    const greeting = `Chào bạn, mình là NOAN. Hôm nay cùng nấu món ${dish.name} nhé. Khi sẵn sàng, bạn nói bắt đầu nhé.`;
    const ingredients = ingredientsSummary(dish.dishIngredients);
    const steps = dish.recipeSteps.map((step) => ({
      stepOrder: step.stepOrder,
      text: `Bước ${step.stepOrder}. ${step.instruction.replace(/\*\*/g, '').replace(/\\n/g, '\n').trim()}${step.durationMin && step.durationMin > 0 ? ` Thời gian gợi ý là ${step.durationMin} phút; bạn có thể yêu cầu hẹn giờ.` : ''} Xong thì nói bước tiếp nhé.`,
    }));
    const texts = [greeting, ingredients, ...steps.map((s) => s.text)];
    if (
      texts.some((t) => t.length > MAX_TEXT_LENGTH) ||
      texts.reduce((n, t) => n + t.length, 0) > 24_000
    )
      throw new BadRequestException('COOKING_RECIPE_TOO_LARGE');
    // At most three workers, with duplicate utterances synthesized only once per request.
    const unique = [...new Set(texts)];
    const audios = new Map<string, string | null>();
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, unique.length) }, async () => {
        while (next < unique.length) {
          const text = unique[next++];
          const speech = await this.voice.publicRecipeSpeech(text);
          audios.set(text, speech.audioUrl);
        }
      }),
    );
    const part = (text: string) => ({
      text,
      audioUrl: audios.get(text) ?? null,
    });
    return {
      dishId: dish.id,
      dishName: dish.name,
      greeting: part(greeting),
      ingredients: part(ingredients),
      steps: steps.map((s) => ({ stepOrder: s.stepOrder, ...part(s.text) })),
      recipeVersion: createHash('sha256')
        .update(
          JSON.stringify({
            script: SCRIPT_VERSION,
            version: dish.version,
            texts,
          }),
        )
        .digest('hex'),
    };
  }
}
interface IngredientSpeech {
  rawText: string;
  parsedName?: string | null;
  ingredient?: { name: string } | null;
  quantity?: unknown;
  quantityTo?: unknown;
  quantityText?: string | null;
  unit?: string | null;
  groupLabel?: string | null;
  isOptional?: boolean;
  preparation?: string | null;
}
export function ingredientsSummary(items: IngredientSpeech[]): string {
  if (!items.length)
    return 'Công thức chưa có thông tin nguyên liệu. Hãy kiểm tra lại trước khi nấu.';
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const group = item.groupLabel?.trim() || 'Nguyên liệu';
    const quantity = item.quantity != null ? Number(item.quantity) : null;
    const to = item.quantityTo != null ? Number(item.quantityTo) : null;
    const q =
      item.quantityText?.trim() ||
      (quantity != null && Number.isFinite(quantity)
        ? `${quantity}${to != null && Number.isFinite(to) ? ` đến ${to}` : ''}${item.unit ? ` ${item.unit}` : ''}`
        : '');
    const clean =
      item.ingredient?.name ||
      item.parsedName ||
      (q
        ? item.rawText.replace(
            /^\d+([.,]\d+)?\s*(g|kg|mg|ml|l|cl|cái|muỗng|tsp|tbsp)?\s+/i,
            '',
          )
        : item.rawText);
    const lines = groups.get(group) || [];
    lines.push(
      `${q ? `${q} ` : ''}${clean}${item.preparation ? `, ${item.preparation}` : ''}${item.isOptional ? ', tùy chọn' : ''}`,
    );
    groups.set(group, lines);
  }
  return [...groups]
    .map(([group, lines]) => `${group}: ${lines.join('; ')}.`)
    .join(' ');
}
