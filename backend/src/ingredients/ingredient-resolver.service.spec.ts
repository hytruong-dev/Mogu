import { IngredientStatus } from '@prisma/client';
import { CatalogIngredientResolverService } from './ingredient-resolver.service';
import { IngredientNormalizerService } from './ingredient-normalizer.service';

const normalizer = new IngredientNormalizerService();

function row(
  id: string,
  name: string,
  synonyms: string[] = [],
  status: IngredientStatus = IngredientStatus.ACTIVE,
) {
  return {
    id,
    name,
    status,
    identityNormalized: normalizer.identityKey(name),
    searchFolded: normalizer.searchFolded(name),
    synonyms,
  };
}

function makeService(
  rows: ReturnType<typeof row>[],
  trigram: 'off' | 'on' = 'off',
) {
  const prisma = {
    db: {
      ingredient: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
      $queryRaw: jest.fn().mockImplementation(async () => {
        if (trigram === 'off')
          throw new Error(
            'function similarity(character varying, text) does not exist',
          );
        return [];
      }),
    },
  };
  return {
    service: new CatalogIngredientResolverService(prisma as any, normalizer),
    prisma,
  };
}

describe('CatalogIngredientResolverService — chống trùng', () => {
  it('links via synonym even when folded prefix differs (bug "chân giò heo" → "giò heo")', async () => {
    const { service } = makeService([
      row('gio-heo', 'Giò heo', ['chân giò heo', 'chân giò']),
      row('ca-chua', 'Cà chua'),
    ]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'Chân giò heo' },
    ]);
    const hit = res.get('a')!;
    expect(hit.outcome).toBe('EXISTING_SYNONYM');
    expect(hit.ingredientId).toBe('gio-heo');
    expect(hit.confidence).toBe(98);
  });

  it('links via synonym without diacritics', async () => {
    const { service } = makeService([
      row('gio-heo', 'Giò heo', ['chan gio heo']),
    ]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'Chân giò heo' },
    ]);
    expect(res.get('a')!.ingredientId).toBe('gio-heo');
  });

  it('does not auto-link through an over-broad synonym that changes meaning (ớt bột ↛ ớt)', async () => {
    const { service } = makeService([row('ot', 'Ớt', ['ớt bột', 'ớt tươi'])]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'Ớt bột' },
      { clientRef: 'b', rawName: 'Ớt tươi' },
    ]);
    // "bột" đổi bản chất → chỉ là ứng viên.
    expect(res.get('a')!.ingredientId).toBeNull();
    expect(res.get('a')!.candidates[0]?.id).toBe('ot');
    // "tươi" là bổ nghĩa trung tính → link.
    expect(res.get('b')!.ingredientId).toBe('ot');
  });

  it('links via canonical key (thịt lợn = thịt heo) as EXISTING_NORMALIZED', async () => {
    const { service } = makeService([row('thit-heo', 'Thịt heo')]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'Thịt lợn' },
    ]);
    const hit = res.get('a')!;
    expect(hit.outcome).toBe('EXISTING_NORMALIZED');
    expect(hit.ingredientId).toBe('thit-heo');
  });

  it('matches PENDING_REVIEW rows too, preferring ACTIVE when both exist', async () => {
    const { service } = makeService([
      row('pending', 'Lá lốt', [], IngredientStatus.PENDING_REVIEW),
      row('active', 'Lá lốt', [], IngredientStatus.ACTIVE),
    ]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'lá lốt' },
    ]);
    expect(res.get('a')!.ingredientId).toBe('active');
  });

  it('does NOT auto-link containment; returns AMBIGUOUS with ranked candidates', async () => {
    const { service } = makeService([
      row('gio-heo', 'Giò heo'),
      row('mong-heo', 'Móng heo'),
      row('ca-chua', 'Cà chua'),
    ]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'Chân giò heo' },
    ]);
    const hit = res.get('a')!;
    expect(hit.ingredientId).toBeNull();
    expect(hit.outcome).toBe('AMBIGUOUS');
    expect(hit.candidates[0].id).toBe('gio-heo');
    expect(hit.candidates[0].score).toBeGreaterThanOrEqual(90);
    expect(hit.candidates.map((c) => c.id)).not.toContain('ca-chua');
  });

  it('never links cá to cà chua', async () => {
    const { service } = makeService([row('ca-chua', 'Cà chua')]);
    const res = await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'cá' },
    ]);
    const hit = res.get('a')!;
    expect(hit.ingredientId).toBeNull();
    expect(hit.outcome).toBe('INVALID');
  });

  it('skips REJECTED/MERGED rows via query filter', async () => {
    const { service, prisma } = makeService([]);
    await service.resolveExistingBatch([{ clientRef: 'a', rawName: 'Muối' }]);
    const where = prisma.db.ingredient.findMany.mock.calls[0][0].where;
    expect(where.status.in).toEqual([
      IngredientStatus.ACTIVE,
      IngredientStatus.PENDING_REVIEW,
    ]);
  });

  it('falls back gracefully when pg_trgm is missing and caches the fact', async () => {
    const { service, prisma } = makeService([row('x', 'Xoài')], 'off');
    await service.resolveExistingBatch([
      { clientRef: 'a', rawName: 'Sầu riêng' },
    ]);
    await service.resolveExistingBatch([{ clientRef: 'b', rawName: 'Mít' }]);
    expect(prisma.db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
