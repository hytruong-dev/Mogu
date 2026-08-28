import { ImportJobsService } from './import-jobs.service';

describe('ImportJobsService event sequencing', () => {
  it('tăng sequence độc lập theo từng job', () => {
    const emitProgress = jest.fn();
    const service = Object.create(ImportJobsService.prototype) as any;
    service.eventSequences = new Map<string, number>();
    service.gateway = { emitProgress };

    const job = {
      id: 'job-1',
      query: 'Phở bò',
      status: 'SEARCHING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0,
      sourceTypes: [],
      createdAt: new Date().toISOString(),
    };

    service.emitProgress(job, 'step 1', 'SEARCHING');
    service.emitProgress({ ...job, progress: 16 }, 'step 2', 'EXTRACTING');
    service.emitProgress({ ...job, id: 'job-2' }, 'step 1', 'SEARCHING');

    expect(emitProgress.mock.calls.map(([payload]) => ({
      eventId: payload.eventId,
      sequence: payload.sequence,
    }))).toEqual([
      { eventId: 'job-1:1', sequence: 1 },
      { eventId: 'job-1:2', sequence: 2 },
      { eventId: 'job-2:1', sequence: 1 },
    ]);
  });
});
