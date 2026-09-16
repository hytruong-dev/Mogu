import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DishStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DishReviewService } from './dish-review.service';

const mockPrisma = {
  db: {
    dish: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    dishIngredient: {
      findMany: jest.fn(),
    },
    dishAuditLog: {
      create: jest.fn(),
    },
    dishVersion: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    fieldEvidence: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
};

describe('DishReviewService', () => {
  let service: DishReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishReviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: () => '' } },
      ],
    }).compile();

    service = module.get<DishReviewService>(DishReviewService);
    jest.clearAllMocks();
  });

  describe('requestChanges', () => {
    it('Trạng thái không phải PENDING_REVIEW → 400', async () => {
      mockPrisma.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.DRAFT,
        deletedAt: null,
      });

      await expect(
        service.requestChanges('d1', 'reviewer1', {
          reasonCode: 'CONTENT_QUALITY' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PENDING_REVIEW → CHANGES_REQUESTED thành công', async () => {
      const mockDish = { id: 'd1', status: DishStatus.PENDING_REVIEW, deletedAt: null };
      mockPrisma.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrisma.db.dish.update.mockResolvedValue({
        ...mockDish,
        status: DishStatus.CHANGES_REQUESTED,
      });

      const result = await service.requestChanges('d1', 'reviewer1', {
        reasonCode: 'CONTENT_QUALITY' as any,
        note: 'Cần ảnh đẹp hơn',
      });
      expect(result.status).toBe(DishStatus.CHANGES_REQUESTED);
    });
  });

  describe('reject', () => {
    it('PENDING_REVIEW → REJECTED thành công', async () => {
      const mockDish = { id: 'd1', status: DishStatus.PENDING_REVIEW, deletedAt: null };
      mockPrisma.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrisma.db.dish.update.mockResolvedValue({
        ...mockDish,
        status: DishStatus.REJECTED,
      });

      const result = await service.reject('d1', 'reviewer1', {});
      expect(result.status).toBe(DishStatus.REJECTED);
    });
  });

  describe('approve — ingredient gate', () => {
    it('chặn publish khi còn ingredient PENDING/null', async () => {
      mockPrisma.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.PENDING_REVIEW,
        deletedAt: null,
      });
      mockPrisma.db.dishIngredient.findMany.mockResolvedValue([
        {
          id: 'di1',
          ingredientId: 'ing1',
          rawText: 'Thịt bò',
          ingredient: { id: 'ing1', status: 'PENDING_REVIEW', name: 'Thịt bò' },
        },
      ]);

      await expect(service.approve('d1', 'reviewer1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.db.dish.update).not.toHaveBeenCalled();
    });

    it('publish khi mọi ingredient ACTIVE', async () => {
      const mockDish = {
        id: 'd1',
        status: DishStatus.PENDING_REVIEW,
        deletedAt: null,
      };
      mockPrisma.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrisma.db.dishIngredient.findMany.mockResolvedValue([
        {
          id: 'di1',
          ingredientId: 'ing1',
          rawText: 'Thịt bò',
          ingredient: { id: 'ing1', status: 'ACTIVE', name: 'Thịt bò' },
        },
      ]);
      mockPrisma.db.dish.update.mockResolvedValue({
        ...mockDish,
        status: DishStatus.PUBLISHED,
      });

      const result = await service.approve('d1', 'reviewer1', {});
      expect(result.status).toBe(DishStatus.PUBLISHED);
    });
  });
});
