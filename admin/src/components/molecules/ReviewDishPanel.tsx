import { AlertTriangle, CheckCircle2, ChevronDown, Pencil } from 'lucide-react'
import type { BasicInfoState } from './BasicInfoForm'
import type { ClassificationState } from './ClassificationPanel'
import type { DishIngredientRow } from './IngredientsTable'
import type { NutritionState } from './NutritionForm'
import type { RecipeState } from './RecipeForm'
import type { MediaState } from './MediaForm'
import type { DishValidationResult } from '../../api/dishes'
type WizardStep = 'basic' | 'classify' | 'ingredients' | 'nutrition' | 'recipe' | 'media'

interface ReviewDishPanelProps {
  basic: BasicInfoState
  classification: ClassificationState
  ingredients: DishIngredientRow[]
  nutrition: NutritionState
  recipe: RecipeState
  media: MediaState
  regions: { id: string; name: string }[]
  provinces: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  onEdit: (step: WizardStep) => void
  validation?: DishValidationResult | null
}

export function ReviewDishPanel({
  basic, classification, ingredients, nutrition, recipe, media,
  regions, provinces, categories, onEdit, validation,
}: ReviewDishPanelProps) {
  const region = regions.find((r) => r.id === basic.regionId)?.name
  const province = provinces.find((p) => p.id === basic.provinceId)?.name
  const catNames = categories.filter((c) => basic.categoryIds.includes(c.id)).map((c) => c.name)
  const gluten = ingredients.some((r) => /phở|bột mì|gluten|bánh mì|mì/i.test(r.name))
  const sodium = Number(nutrition.sodiumMg) || 0
  const sodiumWarn = sodium >= 800
  const totalMin = (Number(recipe.prepMin) || 0) + (Number(recipe.cookMin) || 0)

  const rows = [
    {
      n: 1, id: 'basic' as const, title: 'Thông tin cơ bản', ok: !!basic.name,
      summary: [basic.name || 'Chưa đặt tên', region, province].filter(Boolean).join(' • '),
    },
    {
      n: 2, id: 'classify' as const, title: 'Phân loại', ok: true,
      summary: [
        ...catNames,
        classification.dishType === 'monNuoc' ? 'Món nước' : classification.dishType === 'monKho' ? 'Món khô' : 'Bất kỳ',
        classification.priceFrom && classification.priceTo ? `${classification.priceFrom}–${classification.priceTo}` : '',
      ].filter(Boolean).join(' • '),
    },
    {
      n: 3, id: 'ingredients' as const, title: 'Thành phần & dị ứng', ok: !gluten,
      summary: `${ingredients.length} nguyên liệu • Gluten: ${gluten ? 'Có thể chứa' : 'Không'}`,
    },
    {
      n: 4, id: 'nutrition' as const, title: 'Dinh dưỡng', ok: !sodiumWarn,
      summary: `${nutrition.calories || 0} kcal • Carb ${nutrition.carbG || 0}g • Protein ${nutrition.proteinG || 0}g • Fat ${nutrition.fatG || 0}g`,
      badge: sodiumWarn ? `Natri ${sodium} mg cao` : undefined,
    },
    {
      n: 5, id: 'recipe' as const, title: 'Công thức', ok: recipe.steps.length > 0,
      summary: `${recipe.steps.length} bước • ${totalMin} phút`,
    },
    {
      n: 6, id: 'media' as const, title: 'Hình ảnh & nguồn', ok: !!media.coverUrl || media.gallery.length > 0,
      summary: `${media.gallery.length} ảnh • ${media.sources.length} nguồn tham khảo`,
    },
  ]

  const warnings = rows.filter((r) => !r.ok).length
  const valids = rows.filter((r) => r.ok).length
  const blocking = validation?.blockingErrors ?? []
  const apiWarnings = validation?.warnings ?? []
  const localPct = Math.round((valids / rows.length) * 100)
  const pct = validation?.sections?.length ? validation.completionPercent : localPct

  return (
    <div className="space-y-4">
      {blocking.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Chưa đủ điều kiện gửi duyệt</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blocking.map((e, i) => (
              <li key={`${e.code}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}
      {apiWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Cảnh báo từ hệ thống</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {apiWarnings.map((e, i) => (
              <li key={`${e.code}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-6 rounded-2xl border border-black/10 bg-white p-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5E7EB" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#22C55E" strokeWidth="3"
              strokeDasharray={`${pct} 100`} strokeLinecap="round" />
          </svg>
          <span className="absolute text-lg font-extrabold text-ok-green">{pct}%</span>
        </div>
        <div>
          <h3 className="text-lg font-bold">Hồ sơ gần hoàn tất</h3>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1 text-ok-green"><CheckCircle2 className="h-4 w-4" /> {valids} mục hợp lệ</span>
            <span className="flex items-center gap-1 text-warn-orange"><AlertTriangle className="h-4 w-4" /> {warnings} cảnh báo</span>
            <span className="flex items-center gap-1 text-gray-500">{blocking.length} lỗi bắt buộc</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-4 border-b border-black/5 px-5 py-4 last:border-0">
            {r.ok ? <CheckCircle2 className="h-6 w-6 shrink-0 text-ok-green" /> : <AlertTriangle className="h-6 w-6 shrink-0 text-warn-orange" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{r.n}. {r.title}</span>
                {r.badge && <span className="rounded-full bg-warn-orange-bg px-2 py-0.5 text-xs font-semibold text-warn-orange">{r.badge}</span>}
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500">{r.summary}</p>
            </div>
            <button type="button" onClick={() => onEdit(r.id)} className="flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-black">
              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
