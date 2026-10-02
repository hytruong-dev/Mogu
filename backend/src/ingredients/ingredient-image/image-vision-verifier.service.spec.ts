import { ImageVisionVerifierService } from './image-vision-verifier.service';

describe('ImageVisionVerifierService', () => {
  it('returns null when vision credentials are not configured', async () => {
    const config = { get: jest.fn().mockReturnValue('') };
    const service = new ImageVisionVerifierService(config as any);
    const result = await service.verify('https://img/test.jpg', 'ớt');
    expect(result).toBeNull();
  });

  it('parses valid vision evaluation JSON', async () => {
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'FOOD_SCAN_API_KEY') return 'test-key';
        if (k === 'FOOD_SCAN_BASE_URL') return 'https://api.openai.com/v1';
        return undefined;
      }),
    };
    const service = new ImageVisionVerifierService(config as any);

    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              isIngredient: true,
              matchesName: true,
              isRawOrTypicalForm: true,
              confidence: 0.92,
              reason: 'Hình ảnh quả ớt hiểm tươi đỏ',
            }),
          },
        },
      ],
    });

    (service as any).client = {
      chat: { completions: { create: mockCreate } },
    };

    const result = await service.verify('https://img/chili.jpg', 'ớt', 'chili pepper');
    expect(result).toEqual({
      isIngredient: true,
      matchesName: true,
      isRawOrTypicalForm: true,
      confidence: 0.92,
      reason: 'Hình ảnh quả ớt hiểm tươi đỏ',
    });
  });

  it('returns null on model error without throwing', async () => {
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'FOOD_SCAN_API_KEY') return 'test-key';
        return undefined;
      }),
    };
    const service = new ImageVisionVerifierService(config as any);
    (service as any).client = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('Rate limit')),
        },
      },
    };

    const result = await service.verify('https://img/chili.jpg', 'ớt');
    expect(result).toBeNull();
  });
});
