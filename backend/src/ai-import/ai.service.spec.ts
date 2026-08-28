import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { TaxonomySnapshot } from './ai-import.types';

const taxonomy: TaxonomySnapshot = {
  version: 'test',
  createdAt: new Date(0).toISOString(),
  regions: [],
  provinces: [],
  categories: [{ id: 'c1', code: 'MAIN', name: 'Món chính' }],
  mealTypes: [{ id: 'm1', code: 'DINNER', name: 'Bữa tối' }],
  goals: [],
  dietTypes: [],
  flavors: [],
  dishTypes: [],
  units: ['G'],
};

const validExtraction = {
  schemaVersion: '1.1',
  basic: {
    name: 'Món thử',
    alternateNames: [],
    shortDescription: 'Mô tả',
    difficulty: 'EASY',
    prepMinutes: 1,
    cookMinutes: 2,
    servings: 1,
    origin: { isRegionalSpecialty: false, confidence: 50 },
  },
  classification: {
    categoryCodes: ['MAIN'],
    mealTypeCodes: ['DINNER'],
    goalCodes: [],
    dietTypeCodes: [],
    flavorCodes: [],
    confidenceByField: {},
  },
  ingredients: [{ rawText: '1 g muối', name: 'Muối', optional: false }],
  recipe: {
    title: 'Cách làm Món thử',
    servings: 1,
    prepMinutes: 1,
    cookMinutes: 2,
    difficulty: 'EASY',
    steps: [{ stepNumber: 1, title: 'Nấu', description: 'Nấu chín' }],
  },
};

describe('AiService structured provider', () => {
  const service = new AiService({
    get: jest.fn((key: string) => key === 'XKIRO_API_KEY' ? 'test-key' : undefined),
  } as unknown as ConfigService);

  it('validate structured extraction và không fallback im lặng', async () => {
    (service as any).client.chat.completions.create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validExtraction) } }],
    });
    await expect(service.extractDish({ dishName: 'Món thử', taxonomy }))
      .resolves.toMatchObject({ schemaVersion: '1.1' });

    (service as any).client.chat.completions.create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: '{"schemaVersion":"1.1"}' } }],
    });
    await expect(service.extractDish({ dishName: 'Món thử', taxonomy }))
      .rejects.toThrow('DishExtractionV11 không hợp lệ');
  });

  it('repairFields trả object JSON thực', async () => {
    (service as any).client.chat.completions.create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: '{"recipe":{"title":"Cách làm Món thử"}}' } }],
    });
    await expect(service.repairFields({
      jobId: 'job',
      dishContext: { name: 'Món thử', existingValidData: {} },
      invalidFields: [{ path: 'recipe.title', reason: 'TITLE_DISH_MISMATCH' }],
    })).resolves.toEqual({ recipe: { title: 'Cách làm Món thử' } });
  });
});
