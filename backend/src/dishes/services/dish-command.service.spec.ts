import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DishCommandService } from './dish-command.service';
import { DishQueryService } from './dish-query.service';

const mockDishQueryService = {
  getValidation: jest.fn().mockResolvedValue({ canSubmitReview: true, blockingErrors: [] }),
};

// Mock PrismaService
const mockDb = {
  dish: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  dishEditorAuditLog: {
    create: jest.fn(),
  },
  dishSource: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  dishCategoryLink: {
    deleteMany: jest.fn(),
  },
  dishMealType: {
    deleteMany: jest.fn(),
  },
  dishDietType: {
    deleteMany: jest.fn(),
  },
  dishGoal: {
    deleteMany: jest.fn(),
  },
};

const mockPrismaService = {
  db: {
    ...mockDb,
    $transaction: jest.fn((fn: (tx: typeof mockDb) => unknown) => fn(mockDb)),
  },
};

describe('DishCommandService', () => {
  let service: DishCommandService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishCommandService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DishQueryService, useValue: mockDishQueryService },
      ],
    }).compile();

    service = module.get<DishCommandService>(DishCommandService);
    jest.clearAllMocks();
    mockPrismaService.db.dishEditorAuditLog.create.mockResolvedValue({});
  });

  // â”€â”€ State Transition Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('submitForReview', () => {
    it('AT-04: DRAFT â†’ PENDING_REVIEW thÃ nh cÃ´ng', async () => {
      const mockDish = { id: 'd1', status: DishStatus.DRAFT, deletedAt: null };
      mockPrismaService.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrismaService.db.dish.update.mockResolvedValue({ ...mockDish, status: DishStatus.PENDING_REVIEW });
      const result = await service.submitForReview('d1', 'actor1');
      expect(result.status).toBe(DishStatus.PENDING_REVIEW);
      expect(mockPrismaService.db.dishEditorAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'DISH_SUBMITTED_REVIEW', fromStatus: 'DRAFT', toStatus: 'PENDING_REVIEW' }),
        }),
      );
    });

    it('PUBLISHED khÃ´ng thá»ƒ submit review', async () => {
      mockPrismaService.db.dish.findUnique.mockResolvedValue({ id: 'd1', status: DishStatus.PUBLISHED, deletedAt: null });

      await expect(service.submitForReview('d1', 'actor1')).rejects.toThrow(BadRequestException);
    });

    it('Tráº£ NotFoundException khi khÃ´ng tÃ¬m tháº¥y dish', async () => {
      mockPrismaService.db.dish.findUnique.mockResolvedValue(null);
      await expect(service.submitForReview('nonexistent', 'actor1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update â€” optimistic locking', () => {
    it('AT-05: PATCH vá»›i version sai â†’ 409 DISH_VERSION_CONFLICT', async () => {
      mockPrismaService.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.DRAFT,
        deletedAt: null,
        version: 5,
        name: 'Test',
        alternateNames: [],
      });

      await expect(
        service.update('d1', { name: 'Updated' }, 'actor1', '3'), // Pass version 3 but current is 5
      ).rejects.toThrow(ConflictException);
    });

    it('PATCH vá»›i version Ä‘Ãºng â†’ thÃ nh cÃ´ng', async () => {
      const mockDish = {
        id: 'd1',
        status: DishStatus.DRAFT,
        deletedAt: null,
        version: 5,
        name: 'Test',
        alternateNames: [],
      };
      mockPrismaService.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrismaService.db.dish.update.mockResolvedValue({ ...mockDish, name: 'Updated', version: 6 });
      const result = await service.update('d1', { name: 'Updated' }, 'actor1', '5');
      expect(result.name).toBe('Updated');
    });

    it('PUBLISHED khÃ´ng thá»ƒ sá»­a', async () => {
      mockPrismaService.db.dish.findUnique.mockResolvedValue({
        id: 'd1',
        status: DishStatus.PUBLISHED,
        deletedAt: null,
        version: 1,
        name: 'Test',
      });

      await expect(service.update('d1', { name: 'Hack' }, 'actor1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createDraftAggregate', () => {
    it('tạo DRAFT có attribution, provenance media an toàn và audit cùng transaction', async () => {
      mockPrismaService.db.dish.create.mockResolvedValue({
        id: 'dish-ai',
        status: DishStatus.DRAFT,
      });

      const result = await service.createDraftAggregate(
        mockPrismaService.db as never,
        {
          name: 'Phở bò',
          slug: 'pho-bo',
          nutrition: {
            calories: 450,
            method: 'AI_ESTIMATED',
            basis: 'PER_SERVING',
            sourceUrl: null,
            provenance: { generatedBy: 'AI', sourceVerified: false },
          },
          media: [{
            storageKey: 'dishes/dish-ai/cover.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 123,
            sourceUrl: 'https://example.com/source.jpg',
            credit: 'Example',
            isPrimary: true,
          }],
        },
        'actor-ai',
        {
          action: 'AI_IMPORT_DRAFT_CREATED',
          payload: { jobId: 'job-ai' },
        },
      );

      expect(result.status).toBe(DishStatus.DRAFT);
      expect(mockPrismaService.db.dish.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
            createdBy: 'actor-ai',
            updatedBy: 'actor-ai',
            nutrition: {
              create: expect.objectContaining({
                method: 'AI_ESTIMATED',
                sourceUrl: null,
                provenance: expect.objectContaining({ sourceVerified: false }),
              }),
            },
            media: {
              create: [
                expect.objectContaining({
                  sourceUrl: 'https://example.com/source.jpg',
                  credit: 'Example',
                  moderationStatus: 'PENDING',
                }),
              ],
            },
          }),
        }),
      );
      expect(mockPrismaService.db.dishEditorAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dishId: 'dish-ai',
          actorId: 'actor-ai',
          action: 'AI_IMPORT_DRAFT_CREATED',
          toStatus: 'DRAFT',
        }),
      });
    });
  });

  describe('archive', () => {
    it('PUBLISHED â†’ ARCHIVED thÃ nh cÃ´ng', async () => {
      const mockDish = { id: 'd1', status: DishStatus.PUBLISHED, deletedAt: null };
      mockPrismaService.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrismaService.db.dish.update.mockResolvedValue({ ...mockDish, status: DishStatus.ARCHIVED });
      const result = await service.archive('d1', 'actor1');
      expect(result.status).toBe(DishStatus.ARCHIVED);
    });
  });

  describe('restore', () => {
    it('AT-12: Chá»‰ ARCHIVED má»›i restore Ä‘Æ°á»£c', async () => {
      mockPrismaService.db.dish.findUnique.mockResolvedValue({ id: 'd1', status: DishStatus.DRAFT });
      await expect(service.restore('d1', 'actor1')).rejects.toThrow(BadRequestException);
    });

    it('ARCHIVED â†’ DRAFT thÃ nh cÃ´ng', async () => {
      const mockDish = { id: 'd1', status: DishStatus.ARCHIVED };
      mockPrismaService.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrismaService.db.dish.update.mockResolvedValue({ ...mockDish, status: DishStatus.DRAFT, archivedAt: null });
      const result = await service.restore('d1', 'actor1');
      expect(result.status).toBe(DishStatus.DRAFT);
    });
  });

  describe('unpublish', () => {
    it('AT-12: Unpublish xÃ³a khá»i public/search', async () => {
      const mockDish = { id: 'd1', status: DishStatus.PUBLISHED, deletedAt: null };
      mockPrismaService.db.dish.findUnique.mockResolvedValue(mockDish);
      mockPrismaService.db.dish.update.mockResolvedValue({ ...mockDish, status: DishStatus.UNPUBLISHED });
      const result = await service.unpublish('d1', 'actor1');
      expect(result.status).toBe(DishStatus.UNPUBLISHED);
    });
  });
});

