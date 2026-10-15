import { Search, X, RotateCcw } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { CREATED_VIA_LABELS, ALLERGEN_LABELS } from './types'

interface IngredientsFilterBarProps {
  search: string
  onSearchChange: (val: string) => void
  status: string
  onStatusChange: (val: string) => void
  allergenCode?: string
  onAllergenCodeChange: (val?: string) => void
  allergenOptions?: Array<{ value: string; label: string }>
  createdVia?: string
  onCreatedViaChange: (val?: string) => void
  onReset: () => void
  totalCount: number
}

const STATUS_TABS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'PENDING_REVIEW', label: 'Cần duyệt' },
  { value: 'INACTIVE', label: 'Đã ẩn' },
]

export function IngredientsFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  allergenCode,
  onAllergenCodeChange,
  allergenOptions,
  createdVia,
  onCreatedViaChange,
  onReset,
  totalCount,
}: IngredientsFilterBarProps) {
  const hasActiveFilters = Boolean(
    search || status !== 'ALL' || allergenCode || createdVia
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 mb-4 shadow-sm space-y-3">
      {/* Top row: Status tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={onStatusChange}
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

        {/* Search */}
        <div className="relative w-full md:w-80 flex-shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo tên nguyên liệu, mã..."
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
        {/* Allergen Select */}
        <div className="w-52">
          <Select
            value={allergenCode ?? ''}
            onChange={(e) => onAllergenCodeChange(e.target.value || undefined)}
            className="h-8 text-xs bg-slate-50 border-slate-200"
          >
            <option value="">Tất cả dị ứng</option>
            {allergenOptions && allergenOptions.length > 0
              ? allergenOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : Object.entries(ALLERGEN_LABELS)
                  .filter(([code]) => code === code.toUpperCase())
                  .map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
          </Select>
        </div>

        {/* CreatedVia Select */}
        <div className="w-44">
          <Select
            value={createdVia ?? ''}
            onChange={(e) => onCreatedViaChange(e.target.value || undefined)}
            className="h-8 text-xs bg-slate-50 border-slate-200"
          >
            <option value="">Nguồn tạo</option>
            {Object.entries(CREATED_VIA_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
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

        {/* Counter */}
        <div className="ml-auto text-xs text-slate-500 font-medium">
          Tìm thấy <span className="font-bold text-slate-900">{totalCount}</span> nguyên liệu
        </div>
      </div>
    </div>
  )
}
