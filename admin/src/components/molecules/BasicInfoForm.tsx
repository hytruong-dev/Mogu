import { useEffect, useMemo } from 'react'
import { ChevronDown, Moon, Soup, Sun, SunMedium, X, type LucideIcon } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { cn } from '@/lib/utils'
import {
  type MealTypeOption,
  mealTypesForBasicSlots,
  migrateMealTypeIds,
} from '@/lib/meal-types'

export interface BasicInfoState {
  name: string
  altName: string
  shortDescription: string
  regionId?: string
  provinceId?: string
  categoryIds: string[]
  mealTypeIds: string[]
  status?: string
}

interface BasicInfoFormProps {
  state: BasicInfoState
  onChange: (next: BasicInfoState) => void
  categories: { id: string; name: string }[]
  mealTypes: MealTypeOption[]
  regions: { id: string; name: string }[]
  provinces: { id: string; name: string; regionId?: string }[]
}

const MEAL_ICONS_BY_CODE: Record<string, LucideIcon> = {
  BREAKFAST: Sun,
  LUNCH: SunMedium,
  DINNER: Moon,
  SNACK: Soup,
}

/** Form Thông tin cơ bản (Bước 1) theo design Mogu. */
export function BasicInfoForm({
  state,
  onChange,
  categories,
  mealTypes,
  regions,
  provinces,
}: BasicInfoFormProps) {
  const slotMealTypes = useMemo(() => mealTypesForBasicSlots(mealTypes), [mealTypes])

  useEffect(() => {
    if (!slotMealTypes.length) return
    const migrated = migrateMealTypeIds(state.mealTypeIds, mealTypes)
    if (migrated.join('|') !== state.mealTypeIds.join('|')) {
      onChange({ ...state, mealTypeIds: migrated })
    }
    // Chỉ migrate khi taxonomy load xong; không phụ thuộc state để tránh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealTypes, slotMealTypes.length])

  const toggleCategory = (id: string) => {
    const exists = state.categoryIds.includes(id)
    onChange({
      ...state,
      categoryIds: exists ? state.categoryIds.filter((x) => x !== id) : [...state.categoryIds, id],
    })
  }

  const toggleMeal = (id: string) => {
    const exists = state.mealTypeIds.includes(id)
    onChange({
      ...state,
      mealTypeIds: exists
        ? state.mealTypeIds.filter((x) => x !== id)
        : [...state.mealTypeIds, id],
    })
  }

  const filteredProvinces = provinces.filter(
    (p) => !state.regionId || p.regionId === state.regionId,
  )

  return (
    <Card className="shadow-xs">
      <CardContent className="p-8">
        {/* Tên món ăn + Tên khác */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-[15px] font-semibold text-foreground">
              Tên món ăn <span className="text-red-500">*</span>
            </Label>
            <Input
              value={state.name}
              onChange={(e) => onChange({ ...state, name: e.target.value })}
              className="mt-2 h-12 rounded-xl text-[15px]"
              placeholder="Nhập tên món ăn..."
            />
          </div>
          <div>
            <Label className="text-[15px] font-semibold text-foreground">Tên khác</Label>
            <Input
              value={state.altName}
              onChange={(e) => onChange({ ...state, altName: e.target.value })}
              className="mt-2 h-12 rounded-xl text-[15px]"
              placeholder="Nhập tên gọi khác..."
            />
          </div>
        </div>

        {/* Mô tả ngắn */}
        <div className="mt-7">
          <Label className="text-[15px] font-semibold text-foreground">
            Mô tả ngắn <span className="text-red-500">*</span>
          </Label>
          <div className="relative mt-2">
            <Textarea
              value={state.shortDescription}
              maxLength={180}
              onChange={(e) => onChange({ ...state, shortDescription: e.target.value })}
              placeholder="Mô tả ngắn về món ăn (hương vị, đặc điểm nổi bật, cách thưởng thức...)"
              className="h-[104px] resize-none rounded-xl p-4 text-[15px]"
            />
            <span className="pointer-events-none absolute bottom-3 right-4 text-sm text-muted-foreground">
              {state.shortDescription.length}/180
            </span>
          </div>
        </div>

      {/* Vùng miền + Tỉnh/thành */}
      <div className="mt-7 grid grid-cols-2 gap-6">
        <div>
          <Label className="text-[15px] font-semibold text-foreground">
            Vùng miền <span className="text-red-500">*</span>
          </Label>
          <div className="mt-2">
            <Select
              value={state.regionId ?? ''}
              onChange={(e) => onChange({ ...state, regionId: e.target.value || undefined, provinceId: undefined })}
              className="h-12 rounded-xl border border-input bg-background text-foreground px-4 text-[15px]"
            >
              <option value="">Chọn vùng miền...</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[15px] font-semibold text-foreground">Tỉnh/thành</Label>
          <div className="mt-2">
            <Select
              value={state.provinceId ?? ''}
              onChange={(e) => onChange({ ...state, provinceId: e.target.value || undefined })}
              className="h-12 rounded-xl border border-input bg-background text-foreground px-4 text-[15px]"
            >
              <option value="">Chọn tỉnh/thành...</option>
              {filteredProvinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Danh mục */}
      <div className="mt-7">
        <Label className="text-[15px] font-semibold text-foreground">
          Danh mục <span className="text-red-500">*</span>
        </Label>
        <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-input bg-background p-2">
          {state.categoryIds.map((id) => {
            const cat = categories.find((c) => c.id === id)
            if (!cat) return null
            return (
              <Badge
                key={id}
                variant="warning"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
              >
                {cat.name}
                <X
                  className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCategory(id)}
                />
              </Badge>
            )
          })}
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        {state.categoryIds.length === 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className="rounded-lg border border-dashed border-input px-3 py-1.5 text-sm text-muted-foreground hover:border-amber-400 hover:text-foreground transition-colors"
              >
                + {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bữa ăn phù hợp */}
      <div className="mt-7">
        <Label className="text-[15px] font-semibold text-foreground">Bữa ăn phù hợp</Label>
        <div className="mt-2 grid grid-cols-4 gap-4">
          {slotMealTypes.map((meal) => {
            const code = meal.code?.toUpperCase() ?? ''
            const Icon = MEAL_ICONS_BY_CODE[code] ?? Soup
            const selected = state.mealTypeIds.includes(meal.id)
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => toggleMeal(meal.id)}
                className={cn(
                  'flex h-12 items-center justify-center gap-2 rounded-xl border text-[15px] transition-colors',
                  selected
                    ? 'border-amber-400 bg-amber-50 font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-input bg-card text-foreground hover:border-amber-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {meal.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Trạng thái */}
      <div className="mt-7">
        <Label className="text-[15px] font-semibold text-foreground">Trạng thái</Label>
        <div className="mt-2">
          <Badge variant="purple" className="px-3 py-1.5 text-xs font-semibold gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Bản nháp
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
  )
}
