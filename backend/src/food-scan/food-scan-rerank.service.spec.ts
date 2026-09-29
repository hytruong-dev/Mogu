import { ConfigService } from '@nestjs/config';
import { FoodScanRerankService } from './food-scan-rerank.service';

describe('FoodScanRerankService', () => {
  let service: FoodScanRerankService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    const config = new ConfigService({
      FOOD_SCAN_RERANK_MODEL: 'qwen-vl-rerank',
      DASHSCOPE_API_KEY: 'test-key',
    });
    service = new FoodScanRerankService(config);
    // Inject mock client
    (service as any).client = mockClient;
  });

  it('selects valid candidate index from closed-set prompt', async () => {
    mockClient.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              bestIndex: 2,
              confidence: 0.92,
              reason: 'Matches ingredients and appearance of bún bò',
            }),
          },
        },
      ],
    });

    const candidates = [
      {
        index: 1,
        dishId: 'd1',
        name: 'Phở bò',
        alternateNames: [],
        categoryName: 'Món nước',
        keyIngredients: ['Bánh phở', 'Thịt bò'],
      },
      {
        index: 2,
        dishId: 'd2',
        name: 'Bún bò Huế',
        alternateNames: ['Bún bò'],
        categoryName: 'Món nước',
        keyIngredients: ['Bún', 'Bắp bò', 'Chả cua'],
      },
    ];

    const result = await service.rerank(Buffer.from('fake-image'), candidates);

    expect(result.bestIndex).toBe(2);
    expect(result.confidence).toBe(0.92);
    expect(result.reason).toContain('bún bò');
  });

  it('rejects index that is out of candidate bounds', async () => {
    mockClient.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              bestIndex: 99, // out of range
              confidence: 0.95,
              reason: 'Hallucinated index',
            }),
          },
        },
      ],
    });

    const candidates = [
      {
        index: 1,
        dishId: 'd1',
        name: 'Phở bò',
        alternateNames: [],
        categoryName: 'Món nước',
        keyIngredients: ['Bánh phở'],
      },
    ];

    const result = await service.rerank(Buffer.from('fake-image'), candidates);

    expect(result.bestIndex).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('handles provider error gracefully without throwing', async () => {
    mockClient.chat.completions.create.mockRejectedValueOnce(
      new Error('API rate limit or network timeout'),
    );

    const candidates = [
      {
        index: 1,
        dishId: 'd1',
        name: 'Phở bò',
        alternateNames: [],
        categoryName: 'Món nước',
        keyIngredients: [],
      },
    ];

    const result = await service.rerank(Buffer.from('fake-image'), candidates);

    expect(result.bestIndex).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.ran).toBe(false);
  });

  it('reports ran=true with bestIndex=null when the model says no candidate matches', async () => {
    mockClient.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              bestIndex: null,
              confidence: 0.1,
              reason: 'Don Quảng Ngãi, không phải canh cua',
            }),
          },
        },
      ],
    });
    const result = await service.rerank(Buffer.from('fake-image'), [
      {
        index: 1,
        dishId: 'd1',
        name: 'Canh cua',
        alternateNames: [],
        categoryName: 'Canh',
        keyIngredients: ['Cua đồng'],
      },
    ]);
    expect(result.bestIndex).toBeNull();
    expect(result.ran).toBe(true);
  });
});
