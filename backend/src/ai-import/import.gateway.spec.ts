import { ImportGateway } from './import.gateway';

describe('ImportGateway rooms', () => {
  const jobId = 'f2a33f8a-b46a-4a31-9ec2-aa6c4dc6dad7';

  function client(userId: string, roles: string[]) {
    return {
      data: { userId, roles },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    } as never;
  }

  it('chỉ cho CONTENT_ADMIN subscribe job do chính mình tạo', async () => {
    const model = {
      findUnique: jest.fn().mockResolvedValue({ id: jobId, requestedBy: 'user-1' }),
    };
    const gateway = new ImportGateway({} as never, {
      db: { importJob: model },
    } as never);
    const socket = client('user-1', ['CONTENT_ADMIN']);

    await expect(gateway.subscribe(socket, { jobId })).resolves.toEqual({
      ok: true,
      room: `import-job:${jobId}`,
    });
    expect((socket as any).join).toHaveBeenCalledWith(`import-job:${jobId}`);
  });

  it('từ chối CONTENT_ADMIN subscribe job của người khác', async () => {
    const gateway = new ImportGateway({} as never, {
      db: {
        importJob: {
          findUnique: jest.fn().mockResolvedValue({
            id: jobId,
            requestedBy: 'owner',
          }),
        },
      },
    } as never);
    const socket = client('other-user', ['CONTENT_ADMIN']);

    await expect(gateway.subscribe(socket, { jobId })).resolves.toEqual({
      ok: false,
      code: 'FORBIDDEN',
    });
    expect((socket as any).join).not.toHaveBeenCalled();
  });

  it('cho SUPER_ADMIN subscribe mọi job', async () => {
    const gateway = new ImportGateway({} as never, {
      db: {
        importJob: {
          findUnique: jest.fn().mockResolvedValue({
            id: jobId,
            requestedBy: 'owner',
          }),
        },
      },
    } as never);
    const socket = client('super-user', ['SUPER_ADMIN']);

    await expect(gateway.subscribe(socket, { jobId })).resolves.toMatchObject({
      ok: true,
    });
  });

  it('emit đúng room, không broadcast namespace', () => {
    const gateway = new ImportGateway({} as never, { db: {} } as never);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to, emit: jest.fn() } as never;
    const payload = {
      eventId: `${jobId}:1`,
      sequence: 1,
      occurredAt: new Date().toISOString(),
      jobId,
      status: 'PENDING' as const,
      step: 'PENDING',
      stepIndex: 0,
      totalSteps: 6,
      progress: 0,
      message: 'queued',
    };

    gateway.emitProgress(payload);

    expect(to).toHaveBeenCalledWith(`import-job:${jobId}`);
    expect((gateway.server as any).emit).not.toHaveBeenCalled();
  });
});
