import { IngredientCatalogService } from './ingredient-catalog.service';
import {
  IngredientCreatedVia,
  IngredientImageStatus,
  IngredientStatus,
} from '@prisma/client';

const baseNormalizer = {
  identityKey: (v: string) => v.toLowerCase().trim(),
  searchFolded: (v: string) => v.toLowerCase().trim(),
  cleanDisplayName: (v: string) => v.trim(),
  slugCode: () => 'code-x',
};

function makeService(prisma: any, resolver: any = {}, queue: any = {}) {
  return new IngredientCatalogService(
    prisma,
    baseNormalizer as any,
    resolver,
    { enqueueNewIngredients: jest.fn().mockResolvedValue(0), enabled: false, ...queue },
  );
}

describe('IngredientCatalogService createdVia / approve / merge / findUnapprovedForDish', () => {
  it('passes createdVia to newly provisioned ingredients', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'n1', name: 'Lá lốt' });
    const prisma = { db: { ingredient: { create, findUnique: jest.fn() } } };
    const resolver = {
      resolveExistingBatch: jest.fn().mockResolvedValue(
        new Map([
          ['x', { clientRef: 'x', inputKey: 'lá lốt', outcome: 'INVALID', ingredientId: null, canonicalName: 'Lá lốt', isNew: false, candidates: [] }],
        ]),
      ),
    };
    const service = makeService(prisma, resolver);

    await service.resolveOrProvisionBatch([{ clientRef: 'x', rawName: 'Lá lốt' }], {
      createMissing: true,
      enqueueImageEnrichment: false,
      createdVia: IngredientCreatedVia.AI_IMPORT,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdVia: IngredientCreatedVia.AI_IMPORT,
          status: IngredientStatus.PENDING_REVIEW,
          isActive: false,
        }),
      }),
    );
  });

  it('approve promotes provisional image to APPROVED and applies metadata patch', async () => {
    const update = jest.fn().mockImplementation(async ({ data }) => ({ id: 'i1', ...data }));
    const prisma = {
      db: {
        ingredient: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'i1',
            imageUrl: 'https://cdn/x.jpg',
            imageKey: 'x.jpg',
            imageStatus: IngredientImageStatus.PENDING_REVIEW,
          }),
          update,
        },
      },
    };
    const service = makeService(prisma);

    await service.approveIngredient('i1', {
      nameEn: 'betel leaf',
      description: 'Lá thơm',
      synonyms: ['lá lốt rừng'],
    });

    const data = update.mock.calls[0][0].data;
    expect(data.status).toBe(IngredientStatus.ACTIVE);
    expect(data.isActive).toBe(true);
    expect(data.imageStatus).toBe(IngredientImageStatus.APPROVED);
    expect(data.imageUrl).toBe('https://cdn/x.jpg');
    expect(data.nameEn).toBe('betel leaf');
    expect(data.synonyms).toEqual(['lá lốt rừng']);
  });

  it('approve without image keeps imageStatus untouched', async () => {
    const update = jest.fn().mockImplementation(async ({ data }) => data);
    const prisma = {
      db: {
        ingredient: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'i1',
            imageUrl: null,
            imageKey: null,
            imageStatus: IngredientImageStatus.NOT_FOUND,
          }),
          update,
        },
      },
    };
    await makeService(prisma).approveIngredient('i1');
    expect(update.mock.calls[0][0].data.imageStatus).toBe(IngredientImageStatus.NOT_FOUND);
  });

  it('merge repoints dish ingredients, adds synonym to target, marks source MERGED', async () => {
    const tx = {
      dishIngredient: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      ingredient: { update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })) },
    };
    const prisma = {
      db: {
        ingredient: {
          findUnique: jest.fn().mockImplementation(async ({ where }) =>
            where.id === 'src'
              ? { id: 'src', name: 'Thịt heo', status: IngredientStatus.PENDING_REVIEW, synonyms: [] }
              : { id: 'dst', name: 'Thịt lợn', status: IngredientStatus.ACTIVE, synonyms: ['heo'] },
          ),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
      },
    };

    const res = await makeService(prisma).mergeIngredient('src', 'dst');

    expect(tx.dishIngredient.updateMany).toHaveBeenCalledWith({
      where: { ingredientId: 'src' },
      data: { ingredientId: 'dst' },
    });
    expect(tx.ingredient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dst' },
        data: expect.objectContaining({ synonyms: ['heo', 'Thịt heo'] }),
      }),
    );
    expect(tx.ingredient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'src' },
        data: expect.objectContaining({ status: IngredientStatus.MERGED, mergedIntoId: 'dst', isActive: false }),
      }),
    );
    expect(res.redirectedDishesCount).toBe(3);
  });

  it('merge rejects merging into itself', async () => {
    await expect(makeService({ db: {} }).mergeIngredient('a', 'a')).rejects.toThrow();
  });

  it('findUnapprovedForDish returns only non-ACTIVE / unlinked rows with reason', async () => {
    const prisma = {
      db: {
        dishIngredient: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'd1', rawText: 'Muối', parsedName: 'Muối', ingredientId: 'a', ingredient: { id: 'a', name: 'Muối', status: IngredientStatus.ACTIVE } },
            { id: 'd2', rawText: 'Lá lốt', parsedName: 'Lá lốt', ingredientId: 'b', ingredient: { id: 'b', name: 'Lá lốt', status: IngredientStatus.PENDING_REVIEW, imageUrl: 'u', imageStatus: IngredientImageStatus.PENDING_REVIEW } },
            { id: 'd3', rawText: 'Bột ngọt lạ', parsedName: null, ingredientId: null, ingredient: null },
            { id: 'd4', rawText: 'X', parsedName: 'X', ingredientId: 'c', ingredient: { id: 'c', name: 'X', status: IngredientStatus.REJECTED } },
          ]),
        },
      },
    };

    const issues = await makeService(prisma).findUnapprovedForDish('dish-1');

    expect(issues.map((i) => [i.dishIngredientId, i.reason])).toEqual([
      ['d2', 'PENDING_REVIEW'],
      ['d3', 'UNLINKED'],
      ['d4', 'REJECTED'],
    ]);
    expect(issues[0].imageStatus).toBe(IngredientImageStatus.PENDING_REVIEW);
    expect(issues[1].name).toBe('Bột ngọt lạ');
  });
});

describe('IngredientCatalogService.resolveOrProvisionBatch linking', () => {
  it('maps same identity to one id across clientRefs and links all rows', async () => {
    const created = { id: 'ing-1', name: 'Thịt bò' };
    const prisma = {
      db: {
        ingredient: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue(created),
          findUnique: jest.fn(),
        },
      },
    };
    const normalizer = {
      identityKey: (v: string) => v.toLowerCase().trim(),
      searchFolded: (v: string) =>
        v
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\u0111/g, 'd')
          .trim(),
      cleanDisplayName: (v: string) => v.trim(),
      slugCode: () => 'thit-bo-abc',
    };
    const resolver = {
      resolveExistingBatch: jest.fn().mockImplementation(async (items: any[]) => {
        const map = new Map();
        for (const item of items) {
          map.set(item.clientRef, {
            clientRef: item.clientRef,
            inputKey: normalizer.identityKey(item.rawName),
            outcome: 'INVALID',
            ingredientId: null,
            canonicalName: item.rawName,
            isNew: false,
            candidates: [],
          });
        }
        return map;
      }),
    };
    const enrichmentQueue = {
      enqueueNewIngredients: jest.fn().mockResolvedValue(1),
    };

    const service = new IngredientCatalogService(
      prisma as any,
      normalizer as any,
      resolver as any,
      enrichmentQueue as any,
    );

    const result = await service.resolveOrProvisionBatch(
      [
        { clientRef: 'a', rawName: 'Thịt bò', unit: 'g' },
        { clientRef: 'b', rawName: 'thịt bò', unit: 'g' },
      ],
      { createMissing: true, enqueueImageEnrichment: true },
    );

    expect(prisma.db.ingredient.create).toHaveBeenCalledTimes(1);
    expect(result.createdIds).toEqual(['ing-1']);
    expect(result.byClientRef.get('a')?.ingredientId).toBe('ing-1');
    expect(result.byClientRef.get('b')?.ingredientId).toBe('ing-1');
    expect(result.items.every((i) => i.outcome === 'CREATED_PENDING')).toBe(true);
    expect(enrichmentQueue.enqueueNewIngredients).toHaveBeenCalledWith(['ing-1']);
  });

  it('does not auto-link via prefix and reuses existing exact', async () => {
    const prisma = { db: { ingredient: { create: jest.fn(), findUnique: jest.fn() } } };
    const normalizer = {
      identityKey: (v: string) => v.toLowerCase().trim(),
      searchFolded: (v: string) => v,
      cleanDisplayName: (v: string) => v,
      slugCode: () => 'x',
    };
    const resolver = {
      resolveExistingBatch: jest.fn().mockResolvedValue(
        new Map([
          [
            'ca',
            {
              clientRef: 'ca',
              inputKey: 'cá',
              outcome: 'INVALID',
              ingredientId: null,
              canonicalName: 'cá',
              isNew: false,
              candidates: [],
            },
          ],
          [
            'ca-chua',
            {
              clientRef: 'ca-chua',
              inputKey: 'cà chua',
              outcome: 'EXISTING_EXACT',
              ingredientId: 'existing-tomato',
              canonicalName: 'Cà chua',
              isNew: false,
              candidates: [],
            },
          ],
        ]),
      ),
    };
    const enrichmentQueue = { enqueueNewIngredients: jest.fn().mockResolvedValue(0) };
    prisma.db.ingredient.create.mockResolvedValue({
      id: 'new-fish',
      name: 'cá',
      status: IngredientStatus.PENDING_REVIEW,
    });

    const service = new IngredientCatalogService(
      prisma as any,
      normalizer as any,
      resolver as any,
      enrichmentQueue as any,
    );

    const result = await service.resolveOrProvisionBatch(
      [
        { clientRef: 'ca', rawName: 'cá' },
        { clientRef: 'ca-chua', rawName: 'cà chua' },
      ],
      { createMissing: true },
    );

    expect(result.byClientRef.get('ca-chua')?.ingredientId).toBe('existing-tomato');
    expect(result.byClientRef.get('ca')?.ingredientId).toBe('new-fish');
    expect(result.byClientRef.get('ca')?.ingredientId).not.toBe(
      result.byClientRef.get('ca-chua')?.ingredientId,
    );
  });
});
