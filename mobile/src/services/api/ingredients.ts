import { apiRequest } from './client';

export interface IngredientItem {
  id: string;
  code: string;
  name: string;
  synonyms?: string[];
  unit?: string | null;
  allergenCode?: string | null;
  imageUrl?: string | null;
  status?: string;
  imageStatus?: string;
  isActive?: boolean;
}

export interface AllergenItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  active?: boolean;
  displayOrder?: number;
}

export const ingredientsApi = {
  search: (q: string, limit = 20) => {
    const query = new URLSearchParams();
    if (q) query.set('q', q.trim());
    query.set('limit', String(limit));
    return apiRequest<IngredientItem[]>(`/ingredients?${query.toString()}`);
  },

  getAllergens: () => {
    return apiRequest<AllergenItem[]>('/taxonomy/allergens');
  },
};
