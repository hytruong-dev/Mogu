import { BadRequestException, ConflictException } from '@nestjs/common';
import { DiaryItemReferenceType, DiaryMealSlot, Prisma } from '@prisma/client';
import { MealLogsService } from './meal-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMealLogDto } from './dto/health.dto';

describe('MealLogsService create idempotency', () => {
  let service: MealLogsService;
  let db: {
    diaryMealLog: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    dish: { findFirst: jest.Mock };
  };
  const dto: CreateMealLogDto = {
    mealSlot: DiaryMealSlot.LUNCH,
    items: [
      {
        referenceType: DiaryItemReferenceType.CUSTOM_FOOD,
        displayName: 'Rice',
        quantity: 1,
      },
    ],
  };
  const record = (data: any) => ({
    ...data,
    id: 'meal-1',
    version: 1,
    deletedAt: null,
    items: data.items.create.map((item: any, index: number) => ({
      ...item,
      id: `item-${index}`,
    })),
  });
  const uniqueError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '7',
    });

  beforeEach(() => {
    db = {
      diaryMealLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => record(data)),
      },
      dish: { findFirst: jest.fn() },
    };
    service = new MealLogsService({ db } as unknown as PrismaService);
  });

  it('persists a normalized key/hash and replays without resolving or inserting again', async () => {
    const first = await service.create('user-1', dto, '  scan-1  ');
    const data = db.diaryMealLog.create.mock.calls[0][0].data;
    expect(data.idempotencyKey).toBe('scan-1');
    expect(data.requestHash).toMatch(/^[a-f0-9]{64}$/);
    db.diaryMealLog.findUnique.mockResolvedValue(record(data));
    expect(await service.create('user-1', dto, 'scan-1')).toEqual(first);
    expect(db.diaryMealLog.create).toHaveBeenCalledTimes(1);
    expect(db.dish.findFirst).not.toHaveBeenCalled();
    expect(db.diaryMealLog.findUnique).toHaveBeenLastCalledWith({
      where: {
        userId_idempotencyKey: { userId: 'user-1', idempotencyKey: 'scan-1' },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  it('logs the same per-serving nutrition displayed by the scan for whole recipes', async () => {
    db.dish.findFirst.mockResolvedValue({
      id: 'dish-1',
      name: 'Phở bò',
      nutrition: {
        calories: 1000,
        proteinG: 80,
        carbsG: 120,
        fatG: 20,
        basis: 'WHOLE_RECIPE',
        servings: 4,
      },
    });
    await service.create(
      'user-1',
      {
        mealSlot: DiaryMealSlot.LUNCH,
        items: [
          {
            referenceType: DiaryItemReferenceType.DISH,
            referenceId: 'dish-1',
            quantity: 2,
          },
        ],
      },
      'scan-recipe',
    );
    const data = db.diaryMealLog.create.mock.calls[0][0].data;
    expect(data.totalKcal).toBe(500);
    expect(data.totalProteinG).toBe(40);
    expect(data.items.create[0]).toMatchObject({
      caloriesSnapshot: 250,
      nutritionBasis: 'PER_SERVING',
      quantity: 2,
    });
  });

  it('leaves unkeyed requests independent', async () => {
    await service.create('user-1', dto);
    await service.create('user-1', dto);
    expect(db.diaryMealLog.findUnique).not.toHaveBeenCalled();
    expect(db.diaryMealLog.create).toHaveBeenCalledTimes(2);
    expect(db.diaryMealLog.create.mock.calls[0][0].data).toMatchObject({
      idempotencyKey: null,
      requestHash: null,
    });
  });

  it('scopes the same key independently for different users', async () => {
    await service.create('user-1', dto, 'scan-1');
    await service.create('user-2', dto, 'scan-1');
    expect(db.diaryMealLog.findUnique.mock.calls[1][0].where).toEqual({
      userId_idempotencyKey: { userId: 'user-2', idempotencyKey: 'scan-1' },
    });
    expect(db.diaryMealLog.create).toHaveBeenCalledTimes(2);
  });

  it('returns the winner of a P2002 insert race', async () => {
    let winner: any;
    db.diaryMealLog.create.mockImplementation(async ({ data }) => {
      winner = record(data);
      throw uniqueError();
    });
    db.diaryMealLog.findUnique.mockImplementation(async () => winner ?? null);
    const result = await service.create('user-1', dto, 'scan-1');
    expect(result.id).toBe('meal-1');
    expect(db.diaryMealLog.findUnique).toHaveBeenCalledTimes(2);
    expect(db.diaryMealLog.create).toHaveBeenCalledTimes(1);
  });

  it('does not swallow unrelated unique violations', async () => {
    const error = uniqueError();
    db.diaryMealLog.create.mockRejectedValue(error);
    await expect(service.create('user-1', dto, 'scan-1')).rejects.toBe(error);
  });

  it('does not swallow non-P2002 database failures', async () => {
    const error = new Error('database unavailable');
    db.diaryMealLog.create.mockRejectedValue(error);
    await expect(service.create('user-1', dto, 'scan-1')).rejects.toBe(error);
    expect(db.diaryMealLog.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse with a different payload', async () => {
    await service.create('user-1', dto, 'scan-1');
    db.diaryMealLog.findUnique.mockResolvedValue(
      record(db.diaryMealLog.create.mock.calls[0][0].data),
    );
    await expect(
      service.create('user-1', { ...dto, note: 'changed' }, 'scan-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.diaryMealLog.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a mismatching winner in a race', async () => {
    await service.create('user-1', dto, 'scan-1');
    const winner = record(db.diaryMealLog.create.mock.calls[0][0].data);
    db.diaryMealLog.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    db.diaryMealLog.create.mockRejectedValue(uniqueError());
    await expect(
      service.create('user-1', { ...dto, note: 'changed' }, 'scan-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps soft-deleted keys reserved', async () => {
    await service.create('user-1', dto, 'scan-1');
    db.diaryMealLog.findUnique.mockResolvedValue({
      ...record(db.diaryMealLog.create.mock.calls[0][0].data),
      deletedAt: new Date(),
    });
    await expect(
      service.create('user-1', dto, 'scan-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(['', '   ', 'x'.repeat(129), 'bad key', 'bad\nkey', 'non-ascii-é'])(
    'rejects an invalid key: %p',
    async (key) => {
      await expect(service.create('user-1', dto, key)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.diaryMealLog.create).not.toHaveBeenCalled();
      expect(db.diaryMealLog.findUnique).not.toHaveBeenCalled();
    },
  );

  it('accepts the maximum key length', async () => {
    await service.create('user-1', dto, 'x'.repeat(128));
    expect(db.diaryMealLog.create).toHaveBeenCalledTimes(1);
  });

  it('canonicalizes defaults and timestamps rather than object field order', async () => {
    await service.create(
      'user-1',
      {
        ...dto,
        occurredAt: '2026-09-28T12:00:00+07:00',
      },
      'scan-1',
    );
    db.diaryMealLog.findUnique.mockResolvedValue(
      record(db.diaryMealLog.create.mock.calls[0][0].data),
    );
    await expect(
      service.create(
        'user-1',
        {
          items: dto.items.map((item) => ({
            quantity: item.quantity,
            displayName: item.displayName,
            referenceType: item.referenceType,
            unitCode: 'SERVING',
          })),
          timezone: 'Asia/Ho_Chi_Minh',
          mealSlot: dto.mealSlot,
          occurredAt: '2026-09-28T05:00:00.000Z',
        },
        'scan-1',
      ),
    ).resolves.toMatchObject({ id: 'meal-1' });
  });

  it('scopes weekly-plan replay to the current user', async () => {
    await service.create('user-1', {
      ...dto,
      source: { type: 'WEEKLY_PLAN', weeklyPlanSlotId: 'slot-1' },
    } as CreateMealLogDto);
    expect(db.diaryMealLog.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', weeklyPlanSlotId: 'slot-1', deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });
});
