import { ConflictException, NotFoundException } from '@nestjs/common';
import { DishCommandService } from '../dishes/services/dish-command.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiImportDraftPersistenceService } from './ai-import-draft-persistence.service';

describe('AiImportDraftPersistenceService', () => {
  const tx = {
    importJob: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    db: {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  };
  const dishCommand = {
    createDraftAggregate: jest.fn(),
  };
  let service: AiImportDraftPersistenceService;

  const command = {
    jobId: 'job-1',
    actorId: 'actor-1',
    aggregate: {
      name: 'Phở bò',
      slug: 'pho-bo',
      nutrition: {
        calories: 450,
        method: 'AI_ESTIMATED' as const,
        basis: 'PER_SERVING' as const,
        sourceUrl: null,
        provenance: { generatedBy: 'AI', sourceVerified: false },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiImportDraftPersistenceService(
      prisma as unknown as PrismaService,
      dishCommand as unknown as DishCommandService,
    );
  });

  it('ghi aggregate, audit và resultDishId trong đúng một transaction', async () => {
    tx.importJob.findUnique.mockResolvedValueOnce({
      id: 'job-1',
      resultDishId: null,
      requestedBy: 'requester-1',
      status: 'DRAFTING',
      pipelineVersion: '1.1',
      schemaVersion: '1.1',
    });
    tx.importJob.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    dishCommand.createDraftAggregate.mockResolvedValue({ id: 'dish-1', status: 'DRAFT' });

    await expect(service.persist(command)).resolves.toEqual({
      dishId: 'dish-1',
      created: true,
    });

    expect(prisma.db.$transaction).toHaveBeenCalledTimes(1);
    expect(dishCommand.createDraftAggregate).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        nutrition: expect.objectContaining({
          method: 'AI_ESTIMATED',
          sourceUrl: null,
          provenance: expect.objectContaining({ sourceVerified: false }),
        }),
      }),
      'actor-1',
      expect.objectContaining({
        action: 'AI_IMPORT_DRAFT_CREATED',
        payload: expect.objectContaining({ jobId: 'job-1' }),
      }),
    );
    expect(tx.importJob.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', resultDishId: null },
        data: expect.objectContaining({
          resultDishId: 'dish-1',
          status: 'DONE',
        }),
      }),
    );
  });

  it('trả lại resultDishId hiện có khi worker retry', async () => {
    tx.importJob.findUnique.mockResolvedValue({
      id: 'job-1',
      resultDishId: 'dish-existing',
      requestedBy: 'actor-1',
      status: 'DONE',
      pipelineVersion: '1.1',
      schemaVersion: '1.1',
    });

    await expect(service.persist(command)).resolves.toEqual({
      dishId: 'dish-existing',
      created: false,
    });
    expect(dishCommand.createDraftAggregate).not.toHaveBeenCalled();
    expect(tx.importJob.updateMany).not.toHaveBeenCalled();
  });

  it('rollback khi aggregate không được tạo ở DRAFT', async () => {
    tx.importJob.findUnique.mockResolvedValue({
      id: 'job-1',
      resultDishId: null,
      requestedBy: 'actor-1',
      status: 'DRAFTING',
      pipelineVersion: '1.1',
      schemaVersion: '1.1',
    });
    tx.importJob.updateMany.mockResolvedValue({ count: 1 });
    dishCommand.createDraftAggregate.mockResolvedValue({
      id: 'dish-1',
      status: 'PUBLISHED',
    });

    await expect(service.persist(command)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.importJob.updateMany).toHaveBeenCalledTimes(1);
  });

  it('từ chối persistence thiếu actor attribution', async () => {
    tx.importJob.findUnique.mockResolvedValue({
      id: 'job-1',
      resultDishId: null,
      requestedBy: null,
      status: 'DRAFTING',
      pipelineVersion: '1.1',
      schemaVersion: '1.1',
    });

    await expect(
      service.persist({ ...command, actorId: undefined }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('báo lỗi job không tồn tại', async () => {
    tx.importJob.findUnique.mockResolvedValue(null);
    await expect(service.persist(command)).rejects.toBeInstanceOf(NotFoundException);
  });
});
