import { Injectable } from '@nestjs/common';
import { SourceFieldClaim } from '../sources/source-adapter';

export type EvidenceDecision =
  | 'AUTO_ACCEPT'
  | 'REVIEW'
  | 'REJECT'
  | 'CONFLICT';

export interface EvidenceScore {
  fieldPath: string;
  value: unknown;
  score: number;
  sourceCount: number;
  decision: EvidenceDecision;
  claims: SourceFieldClaim[];
}

export interface FieldConflict {
  fieldPath: string;
  severity: 'REVIEW' | 'BLOCKING';
  candidates: Array<{
    value: unknown;
    score: number;
    sourceCount: number;
  }>;
}

export interface EvidenceScoringOptions {
  autoAcceptThreshold?: number;
  reviewThreshold?: number;
  conflictTolerance?: number;
}

@Injectable()
export class EvidenceScoringService {
  score(
    claims: SourceFieldClaim[],
    options: EvidenceScoringOptions = {},
  ): { evidence: EvidenceScore[]; conflicts: FieldConflict[] } {
    const autoAccept = options.autoAcceptThreshold ?? 90;
    const review = options.reviewThreshold ?? 70;
    const tolerance = options.conflictTolerance ?? 5;
    const grouped = this.groupClaims(claims);
    const evidence: EvidenceScore[] = [];
    const conflicts: FieldConflict[] = [];

    for (const [fieldPath, valueGroups] of grouped) {
      const candidates = [...valueGroups.values()]
        .map((group) => ({
          value: group[0].value,
          score: this.combinedConfidence(group),
          sourceCount: new Set(group.map((claim) => claim.source.uri)).size,
          claims: group,
        }))
        .sort((a, b) => b.score - a.score);
      const first = candidates[0];
      if (!first) continue;

      const hasConflict =
        candidates.length > 1 &&
        candidates[1].score >= review &&
        Math.abs(first.score - candidates[1].score) <= tolerance;
      if (hasConflict) {
        conflicts.push({
          fieldPath,
          severity: candidates[1].score >= autoAccept ? 'BLOCKING' : 'REVIEW',
          candidates: candidates.map(({ value, score, sourceCount }) => ({
            value,
            score,
            sourceCount,
          })),
        });
      }
      evidence.push({
        fieldPath,
        value: first.value,
        score: first.score,
        sourceCount: first.sourceCount,
        decision: hasConflict
          ? 'CONFLICT'
          : first.score >= autoAccept
            ? 'AUTO_ACCEPT'
            : first.score >= review
              ? 'REVIEW'
              : 'REJECT',
        claims: first.claims,
      });
    }
    return { evidence, conflicts };
  }

  private combinedConfidence(claims: SourceFieldClaim[]): number {
    const unique = [
      ...new Map(claims.map((claim) => [claim.source.uri, claim])).values(),
    ];
    const probabilityAllWrong = unique.reduce(
      (product, claim) =>
        product * (1 - this.clamp(claim.confidence) / 100),
      1,
    );
    return Math.round((1 - probabilityAllWrong) * 100);
  }

  private groupClaims(
    claims: SourceFieldClaim[],
  ): Map<string, Map<string, SourceFieldClaim[]>> {
    const fields = new Map<string, Map<string, SourceFieldClaim[]>>();
    for (const claim of claims) {
      const values = fields.get(claim.fieldPath) ?? new Map();
      const key = this.stableValue(claim.value);
      values.set(key, [...(values.get(key) ?? []), claim]);
      fields.set(claim.fieldPath, values);
    }
    return fields;
  }

  private stableValue(value: unknown): string {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.map((item) => this.stableValue(item)).join(',')}]`;
      }
      const object = value as Record<string, unknown>;
      return `{${Object.keys(object)
        .sort()
        .map((key) => `${key}:${this.stableValue(object[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}
