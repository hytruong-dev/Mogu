import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
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
      ],
    }).compile();

    service = module.get<DishReviewService>(DishReviewService);
    jest.clearAllMocks();
  });

  describe('requestChanges', () => {
    it('AT-14: Thiáº¿u reasonCode â†’ 400', async () => {
      mockPrisma.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.PENDING_REVIEW,
        deletedAt: null,
      });

      await expect(service.requestChanges('d1', 'reviewer1', {})).rejects.toThrow(BadRequestException);
    });

    it('Tráº¡ng thÃ¡i khÃ´ng pháº£i PENDING_REVIEW â†’ 400', async () => {
      mockPrisma.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.DRAFT,
        deletedAt: null,
      });

      await expect(
        service.requestChanges('d1', 'reviewer1', { reasonCode: 'CONTENT_QUALITY' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('PENDING_REVIEW â†’ CHANGES_REQUESTED thÃ nh cÃ´ng', async () => {
      const mockDish = { id: 'd1', status: DishStatus.PENDING_REVIEW, deletedAt: null };
      mockPrisma.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrisma.db.dish.update.mockResolvedValue({ ...mockDish, status: DishStatus.CHANGES_REQUESTED });
      mockPrisma.db.dishAuditLog.create.mockResolvedValue({});

      const result = await service.requestChanges('d1', 'reviewer1', {
        reasonCode: 'CONTENT_QUALITY' as any,
        note: 'Cáº§n áº£nh Ä‘áº¹p hÆ¡n',
      });
      expect(result.status).toBe(DishStatus.CHANGES_REQUESTED);
    });
  });

  describe('reject', () => {
    it('Pháº£i cÃ³ reasonCode khi reject', async () => {
      mockPrisma.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.PENDING_REVIEW,
        deletedAt: null,
      });

      await expect(service.reject('d1', 'reviewer1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve â€” publish validation', () => {
    it('AT-02: Publish thiáº¿u source â†’ 422', async () => {
      const mockDish = {
        id: 'd1',
        status: DishStatus.PENDING_REVIEW,
        deletedAt: null,
        publishVersion: 0,
      };
      mockPrisma.db.dish.findUnique.mockResolvedValueOnce(mockDish); // findOrFail
      mockPrisma.db.dish.findUnique.mockResolvedValueOnce({
        ...mockDish,
        name: 'Test',
        provinceId: null,
        regionId: null,
        categories: [{ id: 'cat1' }],
        mealTypes: [{ id: 'mt1' }],
        sources: [], // Thiáº¿u source
        media: [{ id: 'media1', moderationStatus: 'APPROVED', isPrimary: true }],
        nutritionProfiles: [{ isPrimary: true, method: 'ESTIMATED', calculationVersion: '1.0' }],
        dishAllergens: [],
        province: null,
      });

      await expect(service.approve('d1', 'reviewer1', {})).rejects.toThrow(UnprocessableEntityException);
    });

    it('AT-03: Publish vá»›i media chÆ°a approved â†’ 422', async () => {
      const mockDish = {
        id: 'd1',
        status: DishStatus.PENDING_REVIEW,
        deletedAt: null,
        publishVersion: 0,
      };
      mockPrisma.db.dish.findUnique.mockResolvedValueOnce(mockDish);
      mockPrisma.db.dish.findUnique.mockResolvedValueOnce({
        ...mockDish,
        name: 'Test',
        categories: [{ id: 'cat1' }],
        mealTypes: [{ id: 'mt1' }],
        sources: [{ id: 's1' }],
        media: [], // KhÃ´ng cÃ³ APPROVED media
        nutritionProfiles: [{ isPrimary: true, method: 'ESTIMATED', calculationVersion: '1.0' }],
        dishAllergens: [],
        province: null,
        regionId: null,
      });

      await expect(service.approve('d1', 'reviewer1', {})).rejects.toThrow(UnprocessableEntityException);
    });
  });

});

