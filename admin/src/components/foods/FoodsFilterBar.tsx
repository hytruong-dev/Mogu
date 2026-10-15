import { Search, X, RotateCcw } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import type { DishStatus } from '../../types'

interface FoodsFilterBarProps {
  search: string
  onSearchChange: (val: string) => void
  status: DishStatus | 'ALL'
  onStatusChange: (val: DishStatus | 'ALL') => void
  categoryId?: string
  onCategoryChange: (val?: string) => void
  categories: Array<{ id: string; name: string }>
  mealTypeId?: string
  onMealTypeChange: (val?: string) => void
  mealTypes: Array<{ id: string; name: string }>
  regionId?: string
  onRegionChange: (val?: string) => void
  regions: Array<{ id: string; name: string }>
  onReset: () => void
  totalCount: number
}

const STATUS_TABS: Array<{ value: DishStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PUBLISHED', label: 'Xuất bản' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
]

export function FoodsFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  categoryId,
  onCategoryChange,
  categories,
  mealTypeId,
  onMealTypeChange,
  mealTypes,
  regionId,
  onRegionChange,
  regions,
  onReset,
  totalCount,
}: FoodsFilterBarProps) {
  const hasActiveFilters = Boolean(
    search || status !== 'ALL' || categoryId || mealTypeId || regionId
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 mb-4 shadow-sm space-y-3">
      {/* Top row: Status tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(val) => onStatusChange(val as DishStatus | 'ALL')}
          className="w-full md:w-auto"
        >
          <TabsList className="bg-slate-100 p-1 rounded-lg h-auto flex flex-wrap gap-1">
            {STATUS_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="text-xs font-semibold px-3 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-600"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search Input */}
        <div className="relative w-full md:w-80 flex-shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo tên món, từ khóa..."
            className="pl-9 pr-8 h-9 text-xs rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Filter selectors */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100">
        {/* Category Select */}
        <div className="w-44">
          <Select
            value={categoryId ?? ''}
            onChange={(e) => onCategoryChange(e.target.value || undefined)}
            className="h-8 text-xs bg-slate-50 border-slate-200"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        {/* Meal Type Select */}
        <div className="w-40">
          <Select
            value={mealTypeId ?? ''}
            onChange={(e) => onMealTypeChange(e.target.value || undefined)}
            className="h-8 text-xs bg-slate-50 border-slate-200"
          >
            <option value="">Tất cả bữa ăn</option>
            {mealTypes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>

        {/* Region Select */}
        <div className="w-40">
          <Select
            value={regionId ?? ''}
            onChange={(e) => onRegionChange(e.target.value || undefined)}
            className="h-8 text-xs bg-slate-50 border-slate-200"
          >
            <option value="">Tất cả vùng miền</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 px-2.5 text-xs text-slate-500 hover:text-slate-800 gap-1.5"
          >
            <RotateCcw size={12} />
            Đặt lại bộ lọc
          </Button>
        )}

        {/* Result counter */}
        <div className="ml-auto text-xs text-slate-500 font-medium">
          Tìm thấy <span className="font-bold text-slate-900">{totalCount}</span> món ăn
        </div>
      </div>
    </div>
  )
}
