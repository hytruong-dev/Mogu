import { ImportJobsStore } from './import-jobs.store';

describe('ImportJobsStore', () => {
  it('fallback sang memory khi generated Prisma client chưa có ImportJob', async () => {
    const store = new ImportJobsStore({ db: {} } as never);
    const created = await store.create({
      id: 'job-1',
      query: 'Cơm tấm',
      actorId: 'actor-1',
    });

    expect(created.status).toBe('PENDING');
    expect(await store.get('job-1')).toEqual(
      expect.objectContaining({ query: 'Cơm tấm', actorId: 'actor-1' }),
    );
  });

  it('ưu tiên persistence khi Prisma ImportJob khả dụng', async () => {
    const row = {
      id: 'job-2',
      query: 'Bánh xèo',
      status: 'PENDING',
      currentStep: 0,
      totalSteps: 6,
      progress: 0,
      sourceTypes: [],
      logs: [],
      createdAt: new Date('2026-08-28T00:00:00.000Z'),
      completedAt: null,
    };
    const model = {
      findUnique: jest.fn().mockResolvedValue(row),
    };
    const store = new ImportJobsStore({ db: { importJob: model } } as never);

    expect(await store.get('job-2')).toEqual(
      expect.objectContaining({
        id: 'job-2',
        createdAt: '2026-08-28T00:00:00.000Z',
      }),
    );
  });

  it('ánh xạ actorId sang requestedBy và không ghi field DTO không có trong Prisma', async () => {
    const model = { create: jest.fn().mockResolvedValue(undefined) };
    const store = new ImportJobsStore({ db: { importJob: model } } as never);

    await store.create({
      id: 'job-3',
      query: 'Mì Quảng',
      actorId: 'actor-3',
      relatedKeywords: ['Quảng Nam'],
    });

    const data = model.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      id: 'job-3',
      query: 'Mì Quảng',
      requestedBy: 'actor-3',
      relatedKeywords: ['Quảng Nam'],
      cancelRequested: false,
    });
    expect(data).not.toHaveProperty('actorId');
    expect(data).not.toHaveProperty('logs');
  });

  it('persist cancelRequested và dùng DB làm source of truth', async () => {
    const model = {
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn().mockResolvedValue({
        status: 'CANCELLED',
        cancelRequested: true,
      }),
    };
    const store = new ImportJobsStore({ db: { importJob: model } } as never);
    await store.create({ id: 'job-4', query: 'Bún riêu' });
    await store.cancel('job-4');

    expect(model.update).toHaveBeenCalledWith({
      where: { id: 'job-4' },
      data: expect.objectContaining({
        status: 'CANCELLED',
        cancelRequested: true,
      }),
    });
    await expect(store.isCancellationRequested('job-4')).resolves.toBe(true);
  });
});
