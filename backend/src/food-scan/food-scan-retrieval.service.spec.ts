import { PrismaService } from '../prisma/prisma.service';
import {
  FoodScanRetrievalService,
  ChannelHit,
} from './food-scan-retrieval.service';

describe('FoodScanRetrievalService', () => {
  let service: FoodScanRetrievalService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      db: {
        $queryRaw: jest.fn(),
      },
    };
    service = new FoodScanRetrievalService(mockPrisma as PrismaService);
  });

  describe('fuse (Reciprocal Rank Fusion)', () => {
    it('fuses hits from multiple channels and prioritizes consensus', () => {
      const lexicalHits: ChannelHit[] = [
        { dishId: 'dish-1', rank: 1, score: 0.9 },
        { dishId: 'dish-2', rank: 2, score: 0.7 },
      ];
      const textHits: ChannelHit[] = [
        { dishId: 'dish-1', rank: 1, score: 0.85 },
        { dishId: 'dish-3', rank: 2, score: 0.6 },
      ];
      const imageHits: ChannelHit[] = [
        { dishId: 'dish-1', rank: 1, score: 0.88 },
        { dishId: 'dish-2', rank: 2, score: 0.8 },
      ];

      const fused = service.fuse(lexicalHits, textHits, imageHits, null, 5);

      expect(fused.length).toBe(3);
      // dish-1 has rank 1 in lexical, text, and image -> top score & consensus 3
      expect(fused[0].dishId).toBe('dish-1');
      expect(fused[0].channelConsensus).toBe(3);
      expect(fused[0].matchSource).toBe('RRF');
    });

    it('boosts candidate found in pHash cache', () => {
      const lexicalHits: ChannelHit[] = [
        { dishId: 'dish-1', rank: 1, score: 0.9 },
      ];
      const fused = service.fuse(lexicalHits, [], [], 'dish-2', 5);

      // dish-2 has pHash boost (+2.0)
      expect(fused[0].dishId).toBe('dish-2');
      expect(fused[0].matchSource).toBe('PHASH');
      expect(fused[0].rrfNorm).toBe(1.0);
    });
  });

  describe('shouldSkipRerank (gating)', () => {
    it('skips rerank when top candidate has multi-channel consensus and strong separation', () => {
      const fused = [
        {
          dishId: 'dish-1',
          rrfScore: 0.05,
          rrfNorm: 0.95,
          channelConsensus: 3,
          matchSource: 'RRF' as const,
          lexicalScore: 1,
        },
        {
          dishId: 'dish-2',
          rrfScore: 0.02,
          rrfNorm: 0.6,
          channelConsensus: 1,
          matchSource: 'LEXICAL' as const,
        },
      ];

      expect(service.shouldSkipRerank(fused, true)).toBe(true);
    });

    it('does NOT skip rerank when top candidate is only from 1 channel or margin is narrow', () => {
      const fused = [
        {
          dishId: 'dish-1',
          rrfScore: 0.03,
          rrfNorm: 0.7,
          channelConsensus: 1,
          matchSource: 'LEXICAL' as const,
        },
        {
          dishId: 'dish-2',
          rrfScore: 0.028,
          rrfNorm: 0.68,
          channelConsensus: 1,
          matchSource: 'LEXICAL' as const,
        },
      ];

      expect(service.shouldSkipRerank(fused, true)).toBe(false);
    });

    it('does NOT skip rerank on image + text-embedding consensus without a name match', () => {
      const fused = [
        {
          dishId: 'dish-1',
          rrfScore: 0.05,
          rrfNorm: 0.95,
          channelConsensus: 2,
          matchSource: 'RRF' as const,
          textSim: 0.9,
          imageSim: 0.85,
        },
        {
          dishId: 'dish-2',
          rrfScore: 0.02,
          rrfNorm: 0.5,
          channelConsensus: 1,
          matchSource: 'LEXICAL' as const,
        },
      ];
      expect(service.shouldSkipRerank(fused, true)).toBe(false);
    });
  });

  describe('searchPHash', () => {
    it('returns dish_id if event has confirmed dish with matching pHash within hamming distance <= 4', async () => {
      mockPrisma.db.$queryRaw.mockResolvedValueOnce([
        { chosen_dish_id: 'dish-phash-1', dist: 2 },
      ]);

      const result = await service.searchPHash('0123456789abcdef');
      expect(result).toBe('dish-phash-1');
    });

    it('returns null if no matching pHash event found', async () => {
      mockPrisma.db.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.searchPHash('0123456789abcdef');
      expect(result).toBeNull();
    });
  });
});
