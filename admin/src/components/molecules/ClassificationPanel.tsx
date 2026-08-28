import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  DollarSign,
  Dumbbell,
  Leaf,
  Moon,
  Scale,
  Sun,
  SunMedium,
  Timer,
  Trash2,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { SectionLabel } from '../atoms/SectionLabel'
import { FilterChip } from '../atoms/FilterChip'
import { TagCheckbox } from './TagCheckbox'
import { Input } from '../ui/input'
import { cn } from '@/lib/utils'

export interface ClassificationState {
  categoryIds: string[]
  mealTypeIds: string[]
  goalIds: string[]
  dietTypeIds: string[]
  flavors: string[]
  dishType: 'monNuoc' | 'monKho' | 'batKy'
  priceFrom: string
  priceTo: string
}

interface ClassificationPanelProps {
  state: ClassificationState
  onChange: (next: ClassificationState) => void
  /** Dữ liệu taxonomy từ API */
  categories: { id: string; name: string }[]
  mealTypes: { id: string; name: string }[]
  goals: { id: string; name: string }[]
  dietTypes: { id: string; name: string }[]
}

const MEAL_ICONS: Record<string, LucideIcon> = {
  sang: Sun,
  trua: SunMedium,
  toi: Moon,
  phu: Utensils,
}

const GOAL_ICONS: Record<string, LucideIcon> = {
  canBang: Scale,
  giamCan: Leaf,
  tangCo: Dumbbell,
  tietKiem: DollarSign,
  nhanhGon: Timer,
}

const FLAVOR_OPTIONS = ['Thanh nhẹ', 'Đậm đà', 'Cay', 'Không cay', 'Chua', 'Ngọt', 'Béo', 'Mặn']
const DISH_TYPE_OPTIONS = [
  { k: 'monNuoc', l: 'Món nước' },
  { k: 'monKho', l: 'Món khô' },
  { k: 'batKy', l: 'Bất kỳ' },
] as const

const DIET_OPTIONS = ['Chay', 'Vegan', 'Eat clean', 'Ít tinh bột', 'Không yêu cầu cụ thể']

/**
 * Panel "Phân loại & khả năng phù hợp" (Bước 2 của modal Thêm món).
 * Bao gồm: Danh mục, Loại bữa ăn, Mục tiêu, Chế độ ăn, Khẩu vị, Loại món, Khoảng giá.
 */
export function ClassificationPanel({
  state,
  onChange,
  categories,
  mealTypes,
  goals,
  dietTypes,
}: ClassificationPanelProps) {
  const [openDiet, setOpenDiet] = useState(false)
  const [openCategory, setOpenCategory] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')
  const categoryBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!categoryBoxRef.current?.contains(e.target as Node)) setOpenCategory(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const categoryList = (categories ?? []).filter((c) => c?.id && c?.name)
  const visibleCategories = categoryList.filter((c) =>
    !categoryQuery.trim() || c.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
  )

  const toggle = (key: keyof ClassificationState, id: string) => {
    const arr = state[key] as string[]
    const exists = arr.includes(id)
    onChange({
      ...state,
      [key]: exists ? arr.filter((x) => x !== id) : [...arr, id],
    } as ClassificationState)
  }

  const selectedDietName =
    dietTypes.find((d) => state.dietTypeIds[0] === d.id)?.name ?? DIET_OPTIONS[4]

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold">Phân loại & khả năng phù hợp</h3>

      {/* Danh mục món ăn */}
      <div>
        <SectionLabel required>Danh mục món ăn</SectionLabel>
        <div ref={categoryBoxRef} className="relative mt-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpenCategory((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setOpenCategory((v) => !v)
              }
            }}
            className="flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-left"
          >
            {state.categoryIds.length === 0 && (
              <span className="text-[15px] text-gray-400">Chọn danh mục từ hệ thống...</span>
            )}
            {state.categoryIds.map((id) => {
              const cat = categoryList.find((c) => c.id === id)
              if (!cat) return null
              return (
                <FilterChip
                  key={id}
                  label={cat.name}
                  onRemove={() => toggle('categoryIds', id)}
                />
              )
            })}
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400" />
          </div>
          {openCategory && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
              <div className="border-b border-black/5 p-2">
                <input
                  autoFocus
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  placeholder="Tìm danh mục..."
                  className="h-10 w-full rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-mogu-yellow"
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {visibleCategories.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-400">
                    {categoryList.length === 0
                      ? 'Chưa có danh mục trong database. Thêm ở trang Danh mục.'
                      : 'Không tìm thấy danh mục phù hợp.'}
                  </p>
                )}
                {visibleCategories.map((c) => {
                  const selected = state.categoryIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle('categoryIds', c.id)}
                      className={cn(
                        'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-mogu-yellow/20',
                        selected && 'bg-mogu-yellow-light font-semibold',
                      )}
                    >
                      <span>{c.name}</span>
                      {selected && <span className="text-xs text-gray-500">Đã chọn</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loại bữa ăn */}
      <div>
        <SectionLabel required>Loại bữa ăn</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-3">
          {mealTypes.map((m) => {
            const Icon = MEAL_ICONS[m.id] ?? Utensils
            return (
              <TagCheckbox
                key={m.id}
                icon={Icon}
                label={m.name}
                checked={state.mealTypeIds.includes(m.id)}
                onClick={() => toggle('mealTypeIds', m.id)}
              />
            )
          })}
        </div>
      </div>

      {/* Mục tiêu phù hợp */}
      <div>
        <SectionLabel>Mục tiêu phù hợp</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-3">
          {goals.map((g) => {
            const Icon = GOAL_ICONS[g.id] ?? Scale
            return (
              <TagCheckbox
                key={g.id}
                icon={Icon}
                label={g.name}
                checked={state.goalIds.includes(g.id)}
                onClick={() => toggle('goalIds', g.id)}
              />
            )
          })}
        </div>
      </div>

      {/* Chế độ ăn + Khẩu vị */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="relative">
          <SectionLabel>Chế độ ăn</SectionLabel>
          <button
            type="button"
            onClick={() => setOpenDiet((v) => !v)}
            className="mt-2 flex w-full items-center justify-between rounded-full border border-border px-4 py-2.5 text-sm"
          >
            <span className="rounded-full border border-[var(--mogu-yellow)]/40 bg-[var(--mogu-yellow-light)] px-3 py-0.5">
              {selectedDietName}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {openDiet && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card py-1 shadow-lg">
              {dietTypes.length ? (
                dietTypes.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onChange({ ...state, dietTypeIds: [d.id] })
                      setOpenDiet(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    {d.name}
                  </button>
                ))
              ) : (
                DIET_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onChange({ ...state, dietTypeIds: [d] })
                      setOpenDiet(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    {d}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <SectionLabel>Khẩu vị</SectionLabel>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-full border border-border px-3 py-2">
            {state.flavors.map((f) => (
              <FilterChip
                key={f}
                label={f}
                onRemove={() => onChange({ ...state, flavors: state.flavors.filter((x) => x !== f) })}
              />
            ))}
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
          </div>
          {state.flavors.length === 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FLAVOR_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...state, flavors: [...state.flavors, f] })}
                  className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-[var(--mogu-yellow)]"
                >
                  + {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loại món */}
      <div>
        <SectionLabel>Loại món</SectionLabel>
        <div className="mt-2 inline-flex w-fit rounded-full border border-border p-1">
          {DISH_TYPE_OPTIONS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => onChange({ ...state, dishType: t.k })}
              className={cn(
                'rounded-full px-5 py-1.5 text-sm font-medium transition-colors',
                state.dishType === t.k
                  ? 'bg-[var(--mogu-yellow)] text-black'
                  : 'text-muted-foreground',
              )}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Khoảng giá */}
      <div>
        <SectionLabel>Khoảng giá tham khảo</SectionLabel>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Từ</span>
          <div className="flex w-36 items-center rounded-full border border-border px-4 py-2">
            <Input
              value={state.priceFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...state, priceFrom: e.target.value })}
              className="w-full border-0 p-0 shadow-none focus-visible:ring-0"
              placeholder="35.000"
            />
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Đến</span>
          <div className="flex w-36 items-center rounded-full border border-border px-4 py-2">
            <Input
              value={state.priceTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...state, priceTo: e.target.value })}
              className="w-full border-0 p-0 shadow-none focus-visible:ring-0"
              placeholder="65.000"
            />
            <span className="text-sm text-muted-foreground">đ</span>
          </div>
        </div>
      </div>
    </div>
  )
}
