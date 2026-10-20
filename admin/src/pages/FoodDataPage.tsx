import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, Leaf, Plus, ShieldAlert, Tag } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { PageContainer, PageHeader } from '../components/layout'
import { FoodDataActionsProvider, useFoodDataActions } from '../components/food-data/food-data-context'
import { ingredientsApi } from '../api/ingredients'
import { taxonomyAdminApi } from '../api/taxonomy'
import IngredientsPage from './IngredientsPage'
import CategoriesPage from './CategoriesPage'
import DietTypesPage from './DietTypesPage'
import AllergenPage from './AllergenPage'

export type FoodDataTab = 'ingredients' | 'categories' | 'diet-types' | 'allergens'

const TABS: Array<{
  id: FoodDataTab
  label: string
  icon: typeof Leaf
  createLabel: string
}> = [
  { id: 'ingredients', label: 'Nguyên liệu', icon: Leaf, createLabel: 'Thêm nguyên liệu' },
  { id: 'categories', label: 'Danh mục', icon: Tag, createLabel: 'Thêm danh mục' },
  { id: 'diet-types', label: 'Chế độ ăn', icon: Heart, createLabel: 'Thêm chế độ ăn' },
  { id: 'allergens', label: 'Dị ứng', icon: ShieldAlert, createLabel: 'Thêm dị ứng' },
]

function asTab(value: string | null): FoodDataTab {
  return TABS.some((tab) => tab.id === value) ? (value as FoodDataTab) : 'ingredients'
}

function FoodDataShell() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = asTab(searchParams.get('tab'))
  const { triggerCreate } = useFoodDataActions()

  const { data: ingredientResponse } = useQuery({
    queryKey: ['food-data-tab-count', 'ingredients'],
    queryFn: () => ingredientsApi.adminList({ page: 1, limit: 1 }),
    staleTime: 60_000,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['food-data-tab-count', 'categories'],
    queryFn: taxonomyAdminApi.listCategories,
    staleTime: 60_000,
  })
  const { data: dietTypes = [] } = useQuery({
    queryKey: ['food-data-tab-count', 'diet-types'],
    queryFn: taxonomyAdminApi.listDietTypes,
    staleTime: 60_000,
  })
  const { data: allergens = [] } = useQuery({
    queryKey: ['food-data-tab-count', 'allergens'],
    queryFn: taxonomyAdminApi.listAllergens,
    staleTime: 60_000,
  })

  const counts = useMemo<Record<FoodDataTab, number>>(
    () => ({
      ingredients: ingredientResponse?.pagination.total ?? 0,
      categories: categories.length,
      'diet-types': dietTypes.length,
      allergens: allergens.length,
    }),
    [ingredientResponse?.pagination.total, categories.length, dietTypes.length, allergens.length]
  )

  const selectTab = (tab: FoodDataTab) => {
    if (tab === activeTab) return
    setSearchParams({ tab }, { replace: true })
  }

  const currentTab = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]

  return (
    <PageContainer>
      <PageHeader
        title="Dữ liệu món ăn"
        description="Quản lý từ điển nguyên liệu, phân loại danh mục, chế độ ăn và cảnh báo dị ứng dùng chung."
        actions={
          <Button
            type="button"
            size="sm"
            onClick={triggerCreate}
            className="text-xs h-9 gap-1.5 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
          >
            <Plus size={15} />
            {currentTab.createLabel}
          </Button>
        }
        tabs={
          <Tabs
            value={activeTab}
            onValueChange={(val) => selectTab(val as FoodDataTab)}
            className="w-full"
          >
            <TabsList className="h-auto p-1 bg-muted rounded-xl gap-1.5 flex flex-wrap justify-start">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground"
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                    <Badge
                      variant="secondary"
                      className="ml-1 text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-muted-foreground/15 text-foreground"
                    >
                      {counts[tab.id].toLocaleString('vi-VN')}
                    </Badge>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        }
      />

      {/* Tab Panels */}
      <div className="mt-4">
        <div hidden={activeTab !== 'ingredients'}>
          <IngredientsPage embedded isActive={activeTab === 'ingredients'} />
        </div>
        <div hidden={activeTab !== 'categories'}>
          <CategoriesPage embedded isActive={activeTab === 'categories'} />
        </div>
        <div hidden={activeTab !== 'diet-types'}>
          <DietTypesPage embedded isActive={activeTab === 'diet-types'} />
        </div>
        <div hidden={activeTab !== 'allergens'}>
          <AllergenPage embedded isActive={activeTab === 'allergens'} />
        </div>
      </div>
    </PageContainer>
  )
}

export default function FoodDataPage() {
  return (
    <FoodDataActionsProvider>
      <FoodDataShell />
    </FoodDataActionsProvider>
  )
}
