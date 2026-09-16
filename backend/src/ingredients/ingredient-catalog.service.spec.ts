import { IngredientCatalogService } from './ingredient-catalog.service';
import { IngredientStatus } from '@prisma/client';

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
