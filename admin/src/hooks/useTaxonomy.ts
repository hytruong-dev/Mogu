import { useQuery } from '@tanstack/react-query'
import { taxonomyApi, taxonomyAdminApi } from '../api/taxonomy'

type TaxonomyItem = {
  id: string
  name: string
  code?: string
  isActive?: boolean
  [key: string]: unknown
}

function asList(rows: unknown): TaxonomyItem[] {
  return Array.isArray(rows) ? rows.filter((row): row is TaxonomyItem => {
    const item = row as Partial<TaxonomyItem>
    return typeof item.id === 'string' && typeof item.name === 'string'
  }) : []
}

export function useRegions() {
  return useQuery({
    queryKey: ['taxonomy', 'regions'],
    queryFn: taxonomyApi.getRegions,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}

export function useProvinces(regionId?: string) {
  return useQuery({
    queryKey: ['taxonomy', 'provinces', regionId],
    queryFn: () => taxonomyApi.getProvinces(regionId),
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['taxonomy', 'categories'],
    queryFn: async () => {
      try {
        const rows = asList(await taxonomyAdminApi.listCategories())
        const active = rows.filter((c) => c.isActive !== false)
        return active.length ? active : rows
      } catch {
        return asList(await taxonomyApi.getCategories())
      }
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}

export function useMealTypes() {
  return useQuery({
    queryKey: ['taxonomy', 'meal-types'],
    queryFn: taxonomyApi.getMealTypes,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}

export function useDietTypes() {
  return useQuery({
    queryKey: ['taxonomy', 'diet-types'],
    queryFn: taxonomyApi.getDietTypes,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}

export function useGoals() {
  return useQuery({
    queryKey: ['taxonomy', 'goals'],
    queryFn: taxonomyApi.getGoals,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}

export function useAllergens() {
  return useQuery({
    queryKey: ['taxonomy', 'allergens'],
    queryFn: taxonomyApi.getAllergens,
    staleTime: 10 * 60 * 1000,
    placeholderData: [],
  })
}
