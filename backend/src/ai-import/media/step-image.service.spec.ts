import { StepImageService, StepImageUploader } from './step-image.service';
import { ExtractedRecipeStep, RecipeEvidence } from '../ai-import.types';

function service(): StepImageService {
  // Không có SUPABASE_URL -> supabase = null; uploader được inject trong test.
  return new StepImageService({ get: () => undefined } as never);
}

function uploaderMock(fail: string[] = []): StepImageUploader & { upload: jest.Mock } {
  return {
    upload: jest.fn(async (imageUrl: string, storageKey: string) =>
      fail.includes(imageUrl)
        ? null
        : { publicUrl: `https://cdn.mogu.test/${storageKey}`, storageKey },
    ),
  };
}

const aiSteps: ExtractedRecipeStep[] = [
  { stepNumber: 1, title: 'Sơ chế nguyên liệu', description: 'Rửa sạch giò heo, xương.' },
  { stepNumber: 2, title: 'Hầm xương', description: 'Hầm xương 2 tiếng.' },
  { stepNumber: 3, title: 'Hoàn thành', description: 'Trình bày tô bún.' },
];

function evidence(
  steps: RecipeEvidence['steps'],
  sourceUrl = 'https://www.dienmayxanh.com/vao-bep/bun-bo-hue',
): RecipeEvidence {
  return { sourceUrl, sourceDomain: new URL(sourceUrl).hostname.replace(/^www\./, ''), ingredients: [], steps };
}

describe('StepImageService', () => {
  it('maps by index when source and AI have the same number of steps', async () => {
    const uploader = uploaderMock();
    const result = await service().attach({
      jobId: 'job-1',
      steps: aiSteps,
      evidences: [
        evidence([
          { title: 'Sơ chế', text: 'x', imageUrls: ['https://cdn.tgdd.vn/1.jpg'] },
          { title: 'Hầm', text: 'y', imageUrls: ['https://cdn.tgdd.vn/2.png'] },
          { title: 'Xong', text: 'z', imageUrls: ['https://cdn.tgdd.vn/3.webp'] },
        ]),
      ],
      uploader,
    });

    expect(result.assignments).toHaveLength(3);
    expect(result.missingSteps).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.assignments[0]).toMatchObject({
      step: 1,
      matchedBy: 'INDEX',
      sourceStepIndex: 0,
      sourceUrl: 'https://cdn.tgdd.vn/1.jpg',
      credit: 'dienmayxanh.com',
      storageKey: 'dishes/job-1/steps/step-1.jpg',
    });
    expect(result.assignments[1].storageKey).toBe('dishes/job-1/steps/step-2.png');
    expect(result.assignments[2].storageKey).toBe('dishes/job-1/steps/step-3.webp');
    expect(result.assignments[0].imageUrl).toContain('dishes/job-1/steps/step-1.jpg');
  });

  it('maps by title similarity when step counts differ', async () => {
    const uploader = uploaderMock();
    const result = await service().attach({
      jobId: 'job-2',
      steps: aiSteps,
      evidences: [
        evidence([
          { title: 'Hầm xương heo', text: 'Hầm xương trong 2 tiếng', imageUrls: ['https://cdn.tgdd.vn/ham.jpg'] },
          { title: 'Sơ chế nguyên liệu', text: 'Rửa sạch giò heo', imageUrls: ['https://cdn.tgdd.vn/soche.jpg'] },
        ]),
      ],
      uploader,
    });

    const step1 = result.assignments.find((a) => a.step === 1);
    const step2 = result.assignments.find((a) => a.step === 2);
    expect(step1).toMatchObject({ matchedBy: 'TITLE', sourceUrl: 'https://cdn.tgdd.vn/soche.jpg' });
    expect(step2).toMatchObject({ matchedBy: 'TITLE', sourceUrl: 'https://cdn.tgdd.vn/ham.jpg' });
  });

  it('falls back to the second source when the first has no image for a step, and tries next image on upload failure', async () => {
    const uploader = uploaderMock(['https://cdn.tgdd.vn/bad.jpg']);
    const result = await service().attach({
      jobId: 'job-3',
      steps: aiSteps,
      evidences: [
        evidence([
          { title: 'Sơ chế', text: 'x', imageUrls: ['https://cdn.tgdd.vn/bad.jpg', 'https://cdn.tgdd.vn/ok.jpg'] },
          { title: 'Hầm', text: 'y', imageUrls: [] },
          { title: 'Xong', text: 'z', imageUrls: ['https://cdn.tgdd.vn/3.jpg'] },
        ]),
        evidence(
          [
            { title: 'Sơ chế', text: 'x', imageUrls: ['https://cooky.vn/1.jpg'] },
            { title: 'Hầm xương', text: 'y', imageUrls: ['https://cooky.vn/2.jpg'] },
            { title: 'Hoàn thành', text: 'z', imageUrls: ['https://cooky.vn/3.jpg'] },
          ],
          'https://www.cooky.vn/cong-thuc/bun-bo-hue',
        ),
      ],
      uploader,
    });

    const byStep = Object.fromEntries(result.assignments.map((a) => [a.step, a]));
    expect(byStep[1].sourceUrl).toBe('https://cdn.tgdd.vn/ok.jpg');
    expect(byStep[2].sourceUrl).toBe('https://cooky.vn/2.jpg');
    expect(byStep[2].credit).toBe('cooky.vn');
    expect(byStep[3].sourceUrl).toBe('https://cdn.tgdd.vn/3.jpg');
    expect(result.missingSteps).toEqual([]);
  });

  it('reports STEP_IMAGE_MISSING without assigning wrong images when no evidence has images', async () => {
    const uploader = uploaderMock();
    const result = await service().attach({
      jobId: 'job-4',
      steps: aiSteps,
      evidences: [evidence([{ title: 'a', text: 'b' }])],
      uploader,
    });
    expect(uploader.upload).not.toHaveBeenCalled();
    expect(result.assignments).toEqual([]);
    expect(result.missingSteps).toEqual([1, 2, 3]);
    expect(result.warnings).toEqual(['STEP_IMAGE_MISSING']);
  });

  it('marks individual steps missing when every upload fails', async () => {
    const uploader = uploaderMock(['https://cdn.tgdd.vn/1.jpg']);
    const result = await service().attach({
      jobId: 'job-5',
      steps: [aiSteps[0]],
      evidences: [evidence([{ title: 'Sơ chế', text: 'x', imageUrls: ['https://cdn.tgdd.vn/1.jpg'] }])],
      uploader,
    });
    expect(result.assignments).toEqual([]);
    expect(result.missingSteps).toEqual([1]);
    expect(result.warnings).toContain('STEP_IMAGE_MISSING');
  });

  it('downloadAndUpload returns null when Supabase is not configured (fail-soft)', async () => {
    await expect(
      service().downloadAndUpload('https://cdn.tgdd.vn/1.jpg', 'dishes/x/steps/step-1.jpg'),
    ).resolves.toBeNull();
  });
});
