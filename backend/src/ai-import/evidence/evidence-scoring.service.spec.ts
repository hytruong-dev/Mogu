import { SourceFieldClaim, SourceReference } from '../sources/source-adapter';
import { EvidenceScoringService } from './evidence-scoring.service';

describe('EvidenceScoringService', () => {
  const service = new EvidenceScoringService();
  const source = (uri: string): SourceReference => ({
    kind: 'WEBSITE',
    uri,
    retrievedAt: '2026-08-28T00:00:00.000Z',
  });
  const claim = (
    value: unknown,
    confidence: number,
    uri: string,
  ): SourceFieldClaim => ({
    fieldPath: 'recipe.servings',
    value,
    confidence,
    source: source(uri),
  });

  it('combines independent agreeing evidence', () => {
    const result = service.score([
      claim(4, 80, 'https://a.test'),
      claim(4, 80, 'https://b.test'),
    ]);

    expect(result.evidence[0]).toMatchObject({
      value: 4,
      score: 96,
      sourceCount: 2,
      decision: 'AUTO_ACCEPT',
    });
    expect(result.conflicts).toEqual([]);
  });

  it('marks similarly strong contradictory claims as conflict', () => {
    const result = service.score([
      claim(4, 92, 'https://a.test'),
      claim(6, 90, 'https://b.test'),
    ]);

    expect(result.evidence[0].decision).toBe('CONFLICT');
    expect(result.conflicts[0]).toMatchObject({
      fieldPath: 'recipe.servings',
      severity: 'BLOCKING',
    });
  });

  it('does not double-count the same source URI', () => {
    const result = service.score([
      claim(4, 60, 'https://a.test'),
      claim(4, 60, 'https://a.test'),
    ]);

    expect(result.evidence[0]).toMatchObject({
      score: 60,
      sourceCount: 1,
      decision: 'REJECT',
    });
  });
});
