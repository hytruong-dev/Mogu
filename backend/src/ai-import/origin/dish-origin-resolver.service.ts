import { Injectable, Logger } from '@nestjs/common';
import { normalizeVietnamese } from '../ingredient.service';
import { OriginCandidate, TaxonomySnapshot } from '../ai-import.types';
import {
  DishOriginRule,
  normalizeRegionCode,
  REGION_DISPLAY_NAMES,
  VIETNAM_DISH_ORIGIN_RULES,
} from './vietnam-dish-origin.gazetteer';

export type OriginSource = 'GAZETTEER' | 'AI' | 'HINT' | 'NONE';

export interface ResolvedDishOrigin {
  regionId: string | null;
  provinceId: string | null;
  regionCode: string | null;
  provinceCode: string | null;
  originText: string | null;
  isRegionalSpecialty: boolean;
  confidence: number;
  source: OriginSource;
  /** Ghi chú để audit (vd: AI trả tỉnh/vùng mâu thuẫn -> đã sửa). */
  notes: string[];
}

export interface ResolveOriginInput {
  dishName: string;
  alternateNames?: string[];
  aiOrigin?: OriginCandidate | null;
  regionHint?: string | null;
  snapshot: TaxonomySnapshot;
}

export const PROVINCE_ALIASES: Record<string, string[]> = {
  HUE: ['HUE', 'THUATHIENHUE'],
  QN: ['QUANGNAM', 'QN'],
  DN: ['DANANG', 'DN'],
  KH: ['KHANHHOA', 'KH'],
  BH: ['BINHDINH', 'BH'],
  GL: ['GIALAI', 'GL'],
  DL: ['DAKLAK', 'DL'],
  KT: ['KONTUM', 'KT'],
  QT: ['QUANGTRI', 'QT'],
  NTR: ['NINHTHUAN', 'NTR'],
  HN: ['HANOI', 'HN'],
  HP: ['HAIPHONG', 'HP'],
  NA: ['NGHEAN', 'NA'],
  TH: ['THANHHOA', 'TH'],
  QB: ['QUANGBINH', 'QB'],
  HG: ['HAGIANG', 'HG'],
  SL: ['SONLA', 'SL'],
  LC: ['LAOCAI', 'LC'],
  YB: ['YENBAI', 'YB'],
  TQ: ['TUYENQUANG', 'TQ'],
  NT: ['NINHBINH', 'NT'],
  HD: ['HAIDUONG', 'HD'],
  HB: ['HOABINH', 'HB'],
  BN: ['BACNINH', 'BN'],
  PY: ['PHUYEN', 'PY'],
  HCM: ['HOCHIMINH', 'SAIGON', 'HCM'],
  TG: ['TIENGIANG', 'TG'],
  AG: ['ANGIANG', 'AG'],
  CT: ['CANTHO', 'CT'],
  VT: ['BARIAVUNGTAU', 'VUNGTAU', 'VT'],
  BD: ['BINHDUONG', 'BD'],
  DN2: ['DONGNAI', 'DN2'],
  LA: ['LONGAN', 'LA'],
  BT: ['BENTRE', 'BT'],
  VL: ['VINHLONG', 'VL'],
  KG: ['KIENGIANG', 'KG'],
  CM: ['CAMAU', 'CM'],
  TN: ['TAYNINH', 'TN'],
  ST: ['SOCTRANG', 'ST'],
  BL: ['BACLIEU', 'BL'],
  BP: ['BINHPHUOC', 'BP'],
  DT: ['DONGTHAP', 'DT'],
  HG2: ['HAUGIANG', 'HG2'],
  BGI: ['BACGIANG', 'BGI'],
  BK: ['BACKAN', 'BK'],
  CB: ['CAOBANG', 'CB'],
  DB: ['DIENBIEN', 'DB'],
  HNA: ['HANAM', 'HNA'],
  HT: ['HATINH', 'HT'],
  HY: ['HUNGYEN', 'HY'],
  LCH: ['LAICHAU', 'LCH'],
  LS: ['LANGSON', 'LS'],
  ND: ['NAMDINH', 'ND'],
  PT: ['PHUTHO', 'PT'],
  QN2: ['QUANGNINH', 'QN2'],
  TB: ['THAIBINH', 'TB'],
  TN2: ['THAINGUYEN', 'TN2'],
  VP: ['VINHPHUC', 'VP'],
  BTH: ['BINHTHUAN', 'BTH'],
  DKN: ['DAKNONG', 'DKN'],
  LD: ['LAMDONG', 'LD'],
  QNG: ['QUANGNGAI', 'QNG'],
  TV: ['TRAVINH', 'TV'],
};

function matchesProvince(provinceCodeInDb: string, queryCode: string): boolean {
  const normP = provinceCodeInDb.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normQ = queryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normP === normQ) return true;

  const aliases = PROVINCE_ALIASES[normQ];
  if (aliases && aliases.some((a) => a.replace(/[^A-Z0-9]/g, '') === normP)) return true;

  for (const [key, aliasList] of Object.entries(PROVINCE_ALIASES)) {
    const normKey = key.replace(/[^A-Z0-9]/g, '');
    const cleanAliases = aliasList.map((a) => a.replace(/[^A-Z0-9]/g, ''));
    if (
      (normKey === normQ || cleanAliases.includes(normQ)) &&
      (normKey === normP || cleanAliases.includes(normP))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Xác định vùng miền + tỉnh/thành cho món ăn.
 * Ưu tiên: gazetteer tĩnh (đặc sản nổi tiếng) -> AI origin hợp lệ -> regionHint từ người dùng.
 * Luôn suy ra regionCode từ province.regionId để tránh mismatch.
 */
@Injectable()
export class DishOriginResolverService {
  private readonly logger = new Logger(DishOriginResolverService.name);
  private readonly rules: DishOriginRule[];

  constructor() {
    // Pattern dài hơn ưu tiên hơn (so khớp cụ thể trước).
    this.rules = [...VIETNAM_DISH_ORIGIN_RULES].sort(
      (a, b) => b.pattern.length - a.pattern.length,
    );
  }

  resolve(input: ResolveOriginInput): ResolvedDishOrigin {
    const notes: string[] = [];
    const { snapshot } = input;

    // 1) Gazetteer
    const gazetteer = this.matchGazetteer([input.dishName, ...(input.alternateNames ?? [])]);
    if (gazetteer) {
      const resolved = this.fromCodes(
        snapshot,
        gazetteer.regionCode,
        gazetteer.provinceCode || null,
        gazetteer.originText,
        gazetteer.confidence ?? 90,
        'GAZETTEER',
        notes,
      );
      if (resolved.regionId || resolved.provinceId) return resolved;
    }

    // 2) AI origin
    if (input.aiOrigin && (input.aiOrigin.regionCode || input.aiOrigin.provinceCode)) {
      const resolved = this.fromCodes(
        snapshot,
        input.aiOrigin.regionCode ?? null,
        input.aiOrigin.provinceCode ?? null,
        input.aiOrigin.originText ?? null,
        input.aiOrigin.confidence ?? 60,
        'AI',
        notes,
      );
      if (resolved.regionId || resolved.provinceId) return resolved;
    }

    // 3) regionHint từ người dùng (vd: ingest query "thịt kho miền nam")
    const hint = normalizeRegionCode(input.regionHint);
    if (hint) {
      const resolved = this.fromCodes(snapshot, hint, null, null, 60, 'HINT', notes);
      if (resolved.regionId) return resolved;
    }

    // 4) Fallback: không nhận diện được vùng miền
    return {
      regionId: null,
      provinceId: null,
      regionCode: null,
      provinceCode: null,
      originText: null,
      isRegionalSpecialty: false,
      confidence: 0,
      source: 'NONE',
      notes,
    };
  }

  matchGazetteer(names: string[]): DishOriginRule | null {
    for (const raw of names) {
      if (!raw) continue;
      const normalized = ` ${normalizeVietnamese(raw)} `;
      for (const rule of this.rules) {
        if (normalized.includes(` ${rule.pattern} `)) return rule;
      }
    }
    return null;
  }

  private fromCodes(
    snapshot: TaxonomySnapshot,
    regionCode: string | null,
    provinceCode: string | null,
    originText: string | null,
    confidence: number,
    source: OriginSource,
    notes: string[],
  ): ResolvedDishOrigin {
    const province = provinceCode
      ? snapshot.provinces.find((p) => matchesProvince(p.code, provinceCode))
      : undefined;
    let region = regionCode
      ? snapshot.regions.find((r) => r.code.toUpperCase() === regionCode.toUpperCase())
      : undefined;

    if (province) {
      const provinceRegion = snapshot.regions.find((r) => r.id === province.regionId);
      if (provinceRegion && region && provinceRegion.id !== region.id) {
        notes.push(
          `Vùng "${region.code}" không khớp tỉnh "${province.code}" — đã sửa thành "${provinceRegion.code}".`,
        );
      }
      if (provinceRegion) region = provinceRegion;
    }

    if (!province && provinceCode) {
      notes.push(`Không tìm thấy tỉnh "${provinceCode}" trong taxonomy.`);
      this.logger.debug(`Province code ${provinceCode} not found in snapshot`);
    }

    const finalOriginText =
      originText?.trim() ||
      (province && region
        ? `${province.name}, ${REGION_DISPLAY_NAMES[region.code] ?? region.name}`
        : region
          ? REGION_DISPLAY_NAMES[region.code] ?? region.name
          : null);

    return {
      regionId: region?.id ?? null,
      provinceId: province?.id ?? null,
      regionCode: region?.code ?? null,
      provinceCode: province?.code ?? (provinceCode ? provinceCode.toUpperCase() : null),
      originText: finalOriginText ? finalOriginText.substring(0, 200) : null,
      isRegionalSpecialty: Boolean(province),
      confidence: province ? confidence : region ? Math.min(confidence, 70) : 0,
      source,
      notes,
    };
  }

  toCandidate(resolved: ResolvedDishOrigin): OriginCandidate {
    return {
      regionCode: resolved.regionCode,
      provinceCode: resolved.provinceCode,
      originText: resolved.originText,
      isRegionalSpecialty: resolved.isRegionalSpecialty,
      confidence: resolved.confidence,
      reason: resolved.notes.length > 0 ? resolved.notes.join('; ') : `Nguồn: ${resolved.source}`,
    };
  }
}
