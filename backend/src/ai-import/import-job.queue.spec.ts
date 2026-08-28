import { ImportJobQueue } from './import-job.queue';
import { ImportSourceType } from './dto/create-import-job.dto';

describe('ImportJobQueue', () => {
  it('dùng job id ổn định và retry exponential', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new ImportJobQueue(queue as never);

    await service.enqueue({
      jobId: 'f2a33f8a-b46a-4a31-9ec2-aa6c4dc6dad7',
      actorId: 'actor-1',
      request: {
        query: 'Phở bò',
        sourceTypes: [ImportSourceType.AI_GENERATED],
      },
    });

    expect(queue.add).toHaveBeenCalledWith(
      'process-import',
      expect.objectContaining({ actorId: 'actor-1' }),
      expect.objectContaining({
        jobId: 'f2a33f8a-b46a-4a31-9ec2-aa6c4dc6dad7',
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
      }),
    );
  });

  it('trả false khi Redis chưa cấu hình', async () => {
    const service = new ImportJobQueue(null);
    await expect(
      service.enqueue({
        jobId: 'job-1',
        actorId: 'actor-1',
        request: { query: 'Bún bò' },
      }),
    ).resolves.toBe(false);
  });
});
