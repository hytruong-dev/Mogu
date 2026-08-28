import { Injectable } from '@nestjs/common';
import {
  ExtractedIngredient,
  IngredientCandidate,
  IngredientResolution,
} from './ai-import.types';

const UNIT_ALIASES: Record<string, string> = {
  g: 'G', gram: 'G', kg: 'KG', mg: 'MG',
  ml: 'ML', l: 'L', lit: 'L', lít: 'L',
  tsp: 'TSP', 'muỗng cà phê': 'TSP', 'thìa cà phê': 'TSP',
  tbsp: 'TBSP', 'muỗng canh': 'TBSP', 'thìa canh': 'TBSP',
  cup: 'CUP', chén: 'CHÉN', bát: 'BÁT', tô: 'TÔ', đĩa: 'ĐĨA',
  cái: 'CÁI', quả: 'QUẢ', trái: 'QUẢ', củ: 'CỦ', tép: 'TÉP',
  cây: 'CÂY', nhánh: 'NHÁNH', lá: 'LÁ', miếng: 'MIẾNG', gói: 'GÓI',
  phần: 'PHẦN',
};

const PREPARATION_VERBS =
  /\b(lọc|rửa|thái|băm|xay|giã|ngâm|ướp|luộc|chiên|rang|nướng|đập|bóc|gọt|cắt|vắt|để ráo|phi|chần)\b/i;

export function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(',', '.');
  if (normalized.includes('/')) {
    const [numerator, denominator] = normalized.split('/').map(Number);
    return denominator ? numerator / denominator : null;
  }
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function titleCase(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toLocaleUpperCase('vi') + trimmed.slice(1) : '';
}

@Injectable()
export class IngredientParserService {
  parse(rawText: string): ExtractedIngredient {
    const normalizedRaw = rawText.normalize('NFC').replace(/\s+/g, ' ').trim();
    const parenthetical: string[] = [];
    let remaining = normalizedRaw.replace(/\(([^()]*)\)/g, (_, value: string) => {
      if (value.trim()) parenthetical.push(value.trim());
      return ' ';
    }).replace(/\s+/g, ' ').trim();

    let optional = /\b(tùy chọn|không bắt buộc|optional)\b/i.test(remaining);
    remaining = remaining.replace(/\b(tùy chọn|không bắt buộc|optional)\b/gi, '').trim();

    let quantity: number | null = null;
    let quantityTo: number | null = null;
    let quantityText: string | null = null;
    const numericPattern = '(?:\\d+\\/\\d+|\\d+(?:[.,]\\d+)?)';
    const range = remaining.match(
      new RegExp(`^(${numericPattern})\\s*[–—-]\\s*(${numericPattern})\\s*`),
    );
    const single = remaining.match(new RegExp(`^(${numericPattern})\\s*`));
    if (range) {
      quantity = parseNumber(range[1]);
      quantityTo = parseNumber(range[2]);
      remaining = remaining.slice(range[0].length);
    } else if (single) {
      quantity = parseNumber(single[1]);
      remaining = remaining.slice(single[0].length);
    }

    let unitCode: string | null = null;
    const aliases = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length);
    const normalizedRemaining = remaining.toLocaleLowerCase('vi');
    const matchedUnit = aliases.find((alias) =>
      normalizedRemaining === alias ||
      normalizedRemaining.startsWith(`${alias} `),
    );
    if (matchedUnit) {
      unitCode = UNIT_ALIASES[matchedUnit];
      remaining = remaining.slice(matchedUnit.length).trim();
    }

    const qualitative = remaining.match(/(?:^|\s)(vừa đủ|một ít|ít)(?=\s|$)/i);
    if (qualitative) {
      quantityText = qualitative[1].toLocaleLowerCase('vi');
      unitCode ??= quantityText === 'vừa đủ' ? 'VỪA_ĐỦ' : 'MỘT_ÍT';
      remaining = remaining.replace(qualitative[0], '').trim();
    }

    const preparation = parenthetical.filter((item) => PREPARATION_VERBS.test(item));
    const specification = parenthetical.filter((item) => !PREPARATION_VERBS.test(item));
    const alternative = remaining.match(/\s+(?:hoặc|hay)\s+(.+)$/i);
    if (alternative) {
      specification.push(`Có thể thay bằng ${alternative[1].trim()}`);
      remaining = remaining.slice(0, alternative.index).trim();
    }

    return {
      rawText: normalizedRaw,
      name: titleCase(remaining.replace(/^[,;:\s]+|[,;:\s]+$/g, '')),
      canonicalNameCandidate: titleCase(remaining),
      quantity,
      quantityTo,
      quantityText,
      unitCode,
      specification: specification.length ? specification.join('; ') : null,
      preparation: preparation.length ? preparation.join('; ') : null,
      group: null,
      optional,
      normalizedWeightGram: unitCode === 'G'
        ? quantity
        : unitCode === 'KG' && quantity !== null
          ? quantity * 1000
          : unitCode === 'MG' && quantity !== null
            ? quantity / 1000
            : null,
    };
  }
}

@Injectable()
export class IngredientResolverService {
  resolve(
    parsed: ExtractedIngredient,
    dictionary: IngredientCandidate[],
  ): IngredientResolution {
    const target = normalizeVietnamese(parsed.canonicalNameCandidate ?? parsed.name);
    const exact = dictionary.find((item) => item.name === parsed.name);
    if (exact) return this.result(parsed, exact, 'EXACT', 100);

    const alias = dictionary.find((item) =>
      item.aliases?.some((value) => normalizeVietnamese(value) === target),
    );
    if (alias) return this.result(parsed, alias, 'ALIAS', 98);

    const normalized = dictionary.find(
      (item) => normalizeVietnamese(item.name) === target,
    );
    if (normalized) return this.result(parsed, normalized, 'NORMALIZED', 95);

    const candidates = dictionary
      .map((item) => ({
        ingredientId: item.id,
        name: item.name,
        score: Math.round(this.similarity(target, normalizeVietnamese(item.name)) * 100),
      }))
      .filter((item) => item.score >= 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const best = candidates[0];
    if (best && best.score >= 90) {
      const item = dictionary.find((candidate) => candidate.id === best.ingredientId)!;
      return { ...this.result(parsed, item, 'FUZZY', best.score), candidates };
    }
    return {
      rawText: parsed.rawText,
      parsed,
      matchedIngredientId: null,
      matchMethod: 'NONE',
      confidence: best?.score ?? 0,
      candidates,
    };
  }

  private result(
    parsed: ExtractedIngredient,
    item: IngredientCandidate,
    matchMethod: IngredientResolution['matchMethod'],
    confidence: number,
  ): IngredientResolution {
    return {
      rawText: parsed.rawText,
      parsed,
      matchedIngredientId: item.id,
      matchMethod,
      confidence,
    };
  }

  private similarity(left: string, right: string): number {
    if (!left || !right) return 0;
    const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
    for (let j = 1; j <= right.length; j++) {
      let previous = rows[0];
      rows[0] = j;
      for (let i = 1; i <= left.length; i++) {
        const current = rows[i];
        rows[i] = Math.min(
          rows[i] + 1,
          rows[i - 1] + 1,
          previous + (left[i - 1] === right[j - 1] ? 0 : 1),
        );
        previous = current;
      }
    }
    return 1 - rows[left.length] / Math.max(left.length, right.length);
  }
}
