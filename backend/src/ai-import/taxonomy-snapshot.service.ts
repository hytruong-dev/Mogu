import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TaxonomyItem, TaxonomySnapshot } from './ai-import.types';

export class TaxonomyNotReadyError extends Error {
  readonly code = 'AI_IMPORT_TAXONOMY_NOT_READY';

  constructor(readonly missing: string[]) {
    super('Danh mục phân loại món chưa được cấu hình đầy đủ.');
  }
}

@Injectable()
export class TaxonomySnapshotService {
  constructor(private readonly prisma: PrismaService) { }

  async load(): Promise<TaxonomySnapshot> {
    const [regions, provinces, categories, mealTypes, goals, dietTypes] =
      await Promise.all([
        this.prisma.db.region.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.db.province.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true, regionId: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.db.dishCategory.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true, description: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
        }),
        this.prisma.db.mealTypeTag.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
        }),
        this.prisma.db.goal.findMany({
          where: { active: true },
          select: { id: true, code: true, name: true, description: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
        }),
        this.prisma.db.dietType.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true, description: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
        }),
      ]);

    const missing = [
      categories.length ? null : 'categories',
      mealTypes.length ? null : 'mealTypes',
    ].filter((key): key is string => Boolean(key));
    if (missing.length) throw new TaxonomyNotReadyError(missing);

    const snapshotData = {
      regions,
      provinces,
      categories,
      mealTypes,
      goals,
      dietTypes,
      // Khẩu vị đang là controlled vocabulary, chưa cần bảng taxonomy riêng.
      flavors: [
        { id: 'THANH_NHE', code: 'THANH_NHE', name: 'Thanh nhẹ' },
        { id: 'DAM_DA', code: 'DAM_DA', name: 'Đậm đà' },
        { id: 'CAY', code: 'CAY', name: 'Cay' },
        { id: 'KHONG_CAY', code: 'KHONG_CAY', name: 'Không cay' },
        { id: 'CHUA', code: 'CHUA', name: 'Chua' },
        { id: 'NGOT', code: 'NGOT', name: 'Ngọt' },
        { id: 'BEO', code: 'BEO', name: 'Béo' },
        { id: 'MAN', code: 'MAN', name: 'Mặn' },
      ] as TaxonomyItem[],
      dishTypes: [] as TaxonomyItem[],
      units: [
        'G', 'KG', 'MG', 'ML', 'L', 'TSP', 'TBSP', 'CUP',
        'CÁI', 'QUẢ', 'CỦ', 'TÉP', 'CÂY', 'NHÁNH', 'LÁ', 'MIẾNG', 'GÓI',
        'TÔ', 'CHÉN', 'BÁT', 'ĐĨA', 'PHẦN', 'VỪA_ĐỦ', 'MỘT_ÍT',
      ],
    };
    const version = createHash('sha256')
      .update(JSON.stringify(snapshotData))
      .digest('hex')
      .slice(0, 16);
    return {
      version,
      createdAt: new Date().toISOString(),
      ...snapshotData,
    };
  }

  resolveCodes(
    codes: string[],
    items: TaxonomyItem[],
  ): { ids: string[]; unknownCodes: string[] } {
    const byCode = new Map(items.map((item) => [item.code.toUpperCase(), item.id]));
    const ids: string[] = [];
    const unknownCodes: string[] = [];
    for (const rawCode of [...new Set(codes)]) {
      const id = byCode.get(rawCode.toUpperCase());
      if (id) ids.push(id);
      else unknownCodes.push(rawCode);
    }
    return { ids, unknownCodes };
  }

  provinceBelongsToRegion(
    provinceCode: string,
    regionCode: string,
    snapshot: TaxonomySnapshot,
  ): boolean {
    const region = snapshot.regions.find(
      (item) => item.code.toUpperCase() === regionCode.toUpperCase(),
    );
    const province = snapshot.provinces.find(
      (item) => item.code.toUpperCase() === provinceCode.toUpperCase(),
    );
    return Boolean(region && province && province.regionId === region.id);
  }

  toProviderCandidates(snapshot: TaxonomySnapshot) {
    const compact = (items: TaxonomyItem[]) =>
      items.map(({ code, name, aliases, description }) => ({
        code,
        name,
        ...(aliases?.length ? { aliases } : {}),
        ...(description ? { description } : {}),
      }));
    return {
      version: snapshot.version,
      regions: compact(snapshot.regions),
      provinces: snapshot.provinces.map(({ code, name, regionId }) => ({
        code,
        name,
        regionCode:
          snapshot.regions.find((region) => region.id === regionId)?.code ?? null,
      })),
      categories: compact(snapshot.categories),
      mealTypes: compact(snapshot.mealTypes),
      goals: compact(snapshot.goals),
      dietTypes: compact(snapshot.dietTypes),
      flavors: compact(snapshot.flavors),
      dishTypes: compact(snapshot.dishTypes),
      units: snapshot.units,
    };
  }
}
