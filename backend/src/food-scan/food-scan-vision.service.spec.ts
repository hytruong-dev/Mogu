import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractJsonPayload,
  FoodScanVisionService,
  sanitizeFoodScanRaw,
  validateFoodScanExtraction,
} from './food-scan-vision.service';

const valid = {
  primaryName: 'Phở bò',
  alternateNames: ['Beef pho'],
  guesses: [
    { nameVi: 'Phở bò', nameEn: 'Beef Pho', confidence: 0.9 },
    { nameVi: 'Bún bò', nameEn: 'Spicy Beef Noodle', confidence: 0.6 },
  ],
  category: 'soup_noodle',
  cuisine: 'Vietnamese',
  visibleIngredients: ['Bò'],
  isFood: true,
  quality: 'GOOD',
};

describe('FoodScan vision validation', () => {
  it('accepts bounded evidence only', () =>
    expect(validateFoodScanExtraction(valid).primaryName).toBe('Phở bò'));
  it.each([
    null,
    [],
    {},
    { ...valid, dishId: 'invented' },
    { ...valid, isFood: 'true' },
    { ...valid, primaryName: 'x'.repeat(151) },
    { ...valid, primaryName: '  ' },
    { ...valid, alternateNames: Array(6).fill('a') },
    { ...valid, guesses: Array(4).fill({ nameVi: 'a', nameEn: null, confidence: 0.5 }) },
    { ...valid, category: 'invalid_category' },
    { ...valid, visibleIngredients: Array(16).fill('a') },
    { ...valid, quality: 'GREAT' },
    { ...valid, isFood: false },
  ])('rejects malformed/extra/unbounded fields %j', (value) => {
    expect(() => validateFoodScanExtraction(value)).toThrow(
      BadGatewayException,
    );
  });
  it('accepts explicit NOT_FOOD', () => {
    expect(
      validateFoodScanExtraction({
        ...valid,
        primaryName: null,
        alternateNames: [],
        guesses: [],
        category: null,
        cuisine: null,
        visibleIngredients: [],
        isFood: false,
      }).isFood,
    ).toBe(false);
  });
  it('fails explicitly without credentials rather than guessing', async () => {
    const vision = new FoodScanVisionService(new ConfigService({}));
    await expect(vision.recognize(Buffer.from('test'))).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
  it('never inherits a text-only XKIRO model', () => {
    const vision = new FoodScanVisionService(
      new ConfigService({
        XKIRO_MODEL: 'deepseek-chat',
        XKIRO_API_KEY: 'test',
        XKIRO_BASE_URL: 'https://provider.example/v1',
      }),
    );
    expect(vision.model).toBe('gpt-4o-mini');
  });
  it('requires a configured fallback provider URL', async () => {
    const vision = new FoodScanVisionService(
      new ConfigService({ XKIRO_API_KEY: 'test' }),
    );
    await expect(vision.recognize(Buffer.from('test'))).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
  it('uses configured vision model', () => {
    expect(
      new FoodScanVisionService(
        new ConfigService({ FOOD_SCAN_MODEL: 'vision-custom' }),
      ).model,
    ).toBe('vision-custom');
  });

  describe('sanitizeFoodScanRaw', () => {
    it('normalizes LLM output with title-case quality and unlisted category', () => {
      const llmOutput = {
        primaryName: 'Cơm tấm',
        alternateNames: ['Com tam'],
        guesses: [
          { nameVi: 'Cơm tấm sườn', nameEn: 'Broken rice with pork', confidence: 0.95 },
        ],
        category: 'Main course',
        cuisine: 'Vietnamese',
        visibleIngredients: ['rice', 'pork'],
        isFood: true,
        quality: 'Good',
      };
      const sanitized = sanitizeFoodScanRaw(llmOutput);
      expect(sanitized.quality).toBe('GOOD');
      expect(sanitized.category).toBe('rice'); // 'Cơm tấm' maps to 'rice'
      expect(() => validateFoodScanExtraction(sanitized)).not.toThrow();
    });

    it('salvages Gemini object-detection output (box_2d/label) as guesses', () => {
      const llmOutput = [
        { box_2d: [538, 107, 729, 563], label: 'pho' },
        { box_2d: [100, 100, 200, 200], label: 'herbs' },
      ];
      const sanitized = sanitizeFoodScanRaw(llmOutput);
      expect(sanitized.isFood).toBe(true);
      expect(sanitized.primaryName).toBe('pho');
      expect(sanitized.quality).toBe('POOR');
      expect(sanitized.guesses).toHaveLength(2);
      expect(() => validateFoodScanExtraction(sanitized)).not.toThrow();
    });

    it('normalizes non-food response that omits quality', () => {
      const llmOutput = {
        isFood: false,
        primaryName: null,
        guesses: [],
        category: null,
        cuisine: null,
        alternateNames: [],
        visibleIngredients: [],
      };
      const sanitized = sanitizeFoodScanRaw(llmOutput);
      expect(sanitized.quality).toBe('POOR');
      expect(sanitized.isFood).toBe(false);
      expect(() => validateFoodScanExtraction(sanitized)).not.toThrow();
    });
  });

  describe('extractJsonPayload', () => {
    it('strips markdown fences', () => {
      expect(extractJsonPayload('```json\n{"isFood": true}\n```')).toBe(
        '{"isFood": true}',
      );
    });
    it('extracts object embedded in prose', () => {
      expect(
        extractJsonPayload('Here is the result: {"isFood": true} Done.'),
      ).toBe('{"isFood": true}');
    });
    it('extracts array embedded in prose', () => {
      expect(extractJsonPayload('Detected: [{"label": "pho"}]')).toBe(
        '[{"label": "pho"}]',
      );
    });
    it('passes through clean JSON', () => {
      expect(extractJsonPayload('{"a":1}')).toBe('{"a":1}');
    });
  });
});
