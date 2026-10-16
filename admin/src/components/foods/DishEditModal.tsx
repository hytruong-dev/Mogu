import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  ImagePlus,
  Plus,
  Trash2,
  X,
  ZoomIn,
  Pencil,
  MapPin,
  BarChart3,
  Tag,
  SunMedium,
  Flame,
  Users,
  Save,
  Check,
} from 'lucide-react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { TagSelect } from '../ui/tag-select'
import IngredientPicker from '../ui/ingredient-picker'
import { Image } from '../ui/image'
import { MediaLightbox } from '../ui/media-lightbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { useAdminDish, useUpdateDish } from '../../hooks/useDishes'
import { dishesApi, type RecipeStepPayload } from '../../api/dishes'
import { mediaApi } from '../../api/media'
import { PendingIngredientsPanel } from '../molecules/PendingIngredientsPanel'
import { getMediaUrl } from './types'
import type { Dish } from '../../types'

const CREATE_TABS = [
  { id: 'basic', label: 'Thông tin cơ bản' },
  { id: 'classify', label: 'Phân loại' },
  { id: 'ingredients', label: 'Thành phần' },
  { id: 'nutrition', label: 'Dinh dưỡng' },
  { id: 'recipe', label: 'Công thức' },
  { id: 'media', label: 'Hình ảnh' },
] as const

type CreateTab = typeof CREATE_TABS[number]['id']

interface IngredientRow {
  _id: number
  name: string
  ingredientId?: string
  ingredientImageUrl?: string
  ingredientStatus?: string
  quantity: string
  unit: string
}

const emptyStep = (): RecipeStepPayload & { _id: number } => ({
  _id: Date.now() + Math.random(),
  stepOrder: 1,
  instruction: '',
  durationMin: undefined,
})

const emptyIngredient = (): IngredientRow => ({
  _id: Date.now() + Math.random(),
  name: '',
  ingredientId: undefined,
  quantity: '',
  unit: 'g',
})

interface DishEditModalProps {
  dish: Dish
  onClose: () => void
  categories?: any[]
  mealTypes?: any[]
  regions?: any[]
}

export function DishEditModal({
  dish,
  onClose,
  categories = [],
  mealTypes = [],
  regions = [],
}: DishEditModalProps) {
  const updateDish = useUpdateDish()
  const { data: dishDetail } = useAdminDish(dish.id)

  const [activeTab, setActiveTab] = useState<CreateTab>('basic')

  // Form state
  const [form, setForm] = useState<{
    name: string
    shortDescription: string
    difficulty: string
    prepMinutes: number | string
    cookMinutes: number | string
    priceMin: number | string
    priceMax: number | string
    servings: number | string
    regionId: string
    categoryIds: string[]
    mealTypeIds: string[]
    parentDishId: string
  }>({
    name: dish.name ?? '',
    shortDescription: (dish as any).shortDescription ?? '',
    difficulty: dish.difficulty ?? 'EASY',
    prepMinutes: dish.prepMinutes ?? '',
    cookMinutes: (dish as any).cookMinutes ?? '',
    priceMin: dish.priceMin ?? '',
    priceMax: dish.priceMax ?? '',
    servings: (dish as any).servings ?? '',
    regionId: (dish as any).regionId ?? (dish as any).region?.id ?? '',
    categoryIds: ((dish as any).categories ?? []).map((c: any) => c.id ?? c.category?.id ?? c),
    mealTypeIds: ((dish as any).mealTypes ?? []).map((m: any) => m.id ?? m.mealTypeTag?.id ?? m),
    parentDishId: (dish as any).parentDishId ?? '',
  })

  // Nutrition state
  const [nutrition, setNutrition] = useState<Record<string, string | number>>(() => {
    const np = (dish as any).nutrition ?? {}
    return {
      calories: np.calories ?? (dish as any).calories ?? '',
      proteinG: np.proteinG ?? (dish as any).proteinG ?? '',
      carbG: np.carbG ?? (dish as any).carbG ?? '',
      fatG: np.fatG ?? (dish as any).fatG ?? '',
      fiberG: np.fiberG ?? (dish as any).fiberG ?? '',
      sodiumMg: np.sodiumMg ?? (dish as any).sodiumMg ?? '',
    }
  })

  // Ingredients state
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [ingredientsInit, setIngredientsInit] = useState(false)

  useEffect(() => {
    if (!dishDetail || ingredientsInit) return
    const raw: any[] = (dishDetail as any).dishIngredients ?? []
    if (raw.length > 0) {
      setIngredients(
        raw.map((ing) => ({
          _id: Date.now() + Math.random(),
          name: ing.rawText ?? ing.ingredient?.name ?? '',
          ingredientId: ing.ingredient?.id ?? ing.ingredientId ?? undefined,
          ingredientImageUrl: ing.ingredient?.imageUrl ?? undefined,
          ingredientStatus: ing.ingredient?.status,
          quantity: String(ing.quantity ?? ''),
          unit: ing.unit ?? 'g',
        }))
      )
    }
    setIngredientsInit(true)
  }, [dishDetail, ingredientsInit])

  const syncIngredientsFromDetail = useCallback((detail: any) => {
    const raw: any[] = detail?.dishIngredients ?? []
    if (!raw.length) return
    setIngredients((rows) =>
      rows.map((row) => {
        const match = raw.find(
          (di) =>
            (di.rawText ?? di.ingredient?.name ?? '').trim().toLowerCase() ===
            row.name.trim().toLowerCase()
        )
        if (!match?.ingredient) return row
        return {
          ...row,
          ingredientId: match.ingredient.id,
          ingredientImageUrl: match.ingredient.imageUrl ?? undefined,
          ingredientStatus: match.ingredient.status,
        }
      })
    )
  }, [])

  useEffect(() => {
    if (dishDetail && ingredientsInit) syncIngredientsFromDetail(dishDetail)
  }, [dishDetail, ingredientsInit, syncIngredientsFromDetail])

  // Recipe steps state
  const [recipeSteps, setRecipeSteps] = useState<Array<RecipeStepPayload & { _id: number }>>([])
  const [stepsInit, setStepsInit] = useState(false)

  useEffect(() => {
    if (!dishDetail || stepsInit) return
    const raw: any[] = (dishDetail as any).recipeSteps ?? []
    if (raw.length > 0) {
      setRecipeSteps(
        raw.map((s) => ({
          _id: Date.now() + Math.random(),
          stepOrder: s.stepOrder,
          instruction: s.instruction,
          durationMin: s.durationMin ?? undefined,
        }))
      )
    }
    setStepsInit(true)
  }, [dishDetail, stepsInit])

  const [savingRecipe, setSavingRecipe] = useState(false)
  const [recipeSaved, setRecipeSaved] = useState(false)

  // Media state
  const [mediaList, setMediaList] = useState<
    Array<{ id: string; url: string; isPrimary: boolean; moderationStatus: string }>
  >([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mediaToDelete, setMediaToDelete] = useState<string | null>(null)

  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    const allMedia = ((dishDetail ?? dish).media ?? []) as any[]
    setMediaList(
      allMedia.map((m: any) => ({
        id: m.id,
        url: getMediaUrl(m) || '',
        isPrimary: m.isPrimary ?? false,
        moderationStatus: m.moderationStatus ?? 'APPROVED',
      }))
    )
  }, [dish, dishDetail])

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()])
  const removeIngredient = (_id: number) =>
    setIngredients((prev) => prev.filter((i) => i._id !== _id))
  const updateIngredient = (_id: number, patch: Partial<IngredientRow>) =>
    setIngredients((prev) => prev.map((i) => (i._id === _id ? { ...i, ...patch } : i)))

  const addStep = () => {
    setRecipeSteps((prev) => [...prev, { ...emptyStep(), stepOrder: prev.length + 1 }])
  }
  const removeStep = (idx: number) => {
    setRecipeSteps((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i + 1 }))
    )
  }
  const updateStep = (
    idx: number,
    field: keyof RecipeStepPayload,
    value: string | number | undefined
  ) => {
    setRecipeSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
  }

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMedia(true)
    try {
      const isPrimary = mediaList.length === 0
      const uploaded: any = await dishesApi.uploadFull(dish.id, file, { isPrimary })
      setMediaList((prev) => [
        ...prev,
        {
          id: uploaded.id,
          url: getMediaUrl(uploaded) || '',
          isPrimary: uploaded.isPrimary,
          moderationStatus: uploaded.moderationStatus,
        },
      ])
    } catch (err: any) {
      alert(`Upload ảnh thất bại: ${err?.message ?? 'Đã có lỗi'}`)
    } finally {
      setUploadingMedia(false)
      e.target.value = ''
    }
  }

  const handleDeleteMedia = (mediaId: string) => setMediaToDelete(mediaId)

  const confirmDeleteMedia = async () => {
    if (!mediaToDelete) return
    const id = mediaToDelete
    setMediaToDelete(null)
    setDeletingId(id)
    try {
      await mediaApi.remove(dish.id, id)
      setMediaList((prev) => prev.filter((m) => m.id !== id))
    } catch (err: any) {
      alert(`Xóa ảnh thất bại: ${err?.message ?? 'Đã có lỗi'}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveRecipe = async () => {
    setSavingRecipe(true)
    try {
      const payload: RecipeStepPayload[] = recipeSteps.map((s, idx) => ({
        stepOrder: idx + 1,
        instruction: s.instruction,
        durationMin: s.durationMin ? Number(s.durationMin) : undefined,
      }))
      await dishesApi.update(dish.id, { recipeSteps: payload })
      setRecipeSaved(true)
      setTimeout(() => setRecipeSaved(false), 3000)
    } catch (err: any) {
      alert(`Lỗi lưu cách nấu: ${err?.message ?? 'Đã có lỗi'}`)
    } finally {
      setSavingRecipe(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError('')
    setSaveSuccess(false)

    try {
      const nutritionPayload: Record<string, number> = {}
      for (const [k, v] of Object.entries(nutrition)) {
        if (v !== '' && v != null) nutritionPayload[k] = Number(v)
      }

      const ingredientPayload = ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          ingredientId: i.ingredientId || undefined,
          rawText: i.name.trim(),
          quantity: i.quantity ? Number(i.quantity) : undefined,
          unit: i.unit || undefined,
        }))

      const stepsPayload: RecipeStepPayload[] = recipeSteps
        .filter((s) => s.instruction.trim())
        .map((s, idx) => ({
          stepOrder: idx + 1,
          instruction: s.instruction.trim(),
          durationMin: s.durationMin ? Number(s.durationMin) : undefined,
        }))

      await updateDish.mutateAsync({
        id: dish.id,
        dto: {
          name: form.name,
          createMissingIngredients: true,
          shortDescription: form.shortDescription || undefined,
          difficulty: form.difficulty as any,
          prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : undefined,
          cookMinutes: form.cookMinutes ? Number(form.cookMinutes) : undefined,
          servings: form.servings ? Number(form.servings) : undefined,
          priceMin: form.priceMin ? Number(form.priceMin) : undefined,
          priceMax: form.priceMax ? Number(form.priceMax) : undefined,
          version: dish.version,
          regionId: form.regionId || undefined,
          categoryIds: form.categoryIds.length ? form.categoryIds : undefined,
          mealTypeIds: form.mealTypeIds.length ? form.mealTypeIds : undefined,
          parentDishId: form.parentDishId || undefined,
          nutrition: Object.keys(nutritionPayload).length ? nutritionPayload : undefined,
          ingredients: ingredientPayload.length ? ingredientPayload : undefined,
          recipeSteps: stepsPayload.length ? stepsPayload : undefined,
        },
      })
      setSaveSuccess(true)
      setTimeout(() => onClose(), 800)
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? err?.message ?? 'Cập nhật thất bại')
    }
  }

  const hasUnapprovedSaved = ((dishDetail as any)?.dishIngredients ?? []).some(
    (di: any) => !di.ingredient || di.ingredient.status !== 'ACTIVE'
  )

  return (
    <>
      {previewUrl && (
        <MediaLightbox
          open={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
          media={{
            type: 'gallery',
            title: dish.name,
            items: mediaList.map((m) => ({ url: m.url, title: dish.name })),
            initialIndex: Math.max(0, mediaList.findIndex((m) => m.url === previewUrl)),
          }}
        />
      )}

      <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col min-h-[580px] max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200">
          {/* Header */}
          <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil size={16} className="text-amber-500" />
                Chỉnh sửa món ăn
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{dish.name}</p>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="px-6 pt-2 pb-1 border-b border-slate-100 bg-slate-50/50">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as CreateTab)}>
              <TabsList className="bg-slate-200/60 p-1 flex-wrap h-auto gap-1">
                {CREATE_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs font-semibold px-3 py-1.5">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Form tabs */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {/* TAB: CƠ BẢN */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tên món ăn *</label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả ngắn</label>
                  <Textarea
                    rows={3}
                    value={form.shortDescription}
                    onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
                    className="text-xs"
                  />
                </div>
              </div>
            )}

            {/* TAB: PHÂN LOẠI */}
            {activeTab === 'classify' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <MapPin size={13} className="text-amber-500" />
                      Vùng miền
                    </label>
                    <Select
                      value={form.regionId}
                      onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
                      className="h-9 text-xs"
                    >
                      <option value="">Tất cả vùng</option>
                      {regions.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <BarChart3 size={13} className="text-blue-500" />
                      Độ khó
                    </label>
                    <Select
                      value={form.difficulty}
                      onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                      className="h-9 text-xs"
                    >
                      <option value="EASY">Dễ</option>
                      <option value="MEDIUM">Trung bình</option>
                      <option value="HARD">Khó</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Tag size={13} className="text-emerald-500" />
                      Danh mục
                    </label>
                    <TagSelect
                      options={categories.map((c: any) => ({ id: c.id, name: c.name }))}
                      selected={form.categoryIds}
                      onChange={(ids) => setForm((f) => ({ ...f, categoryIds: ids }))}
                      placeholder="Chọn danh mục..."
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <SunMedium size={13} className="text-amber-500" />
                      Bữa ăn
                    </label>
                    <TagSelect
                      options={mealTypes.map((m: any) => ({ id: m.id, name: m.name }))}
                      selected={form.mealTypeIds}
                      onChange={(ids) => setForm((f) => ({ ...f, mealTypeIds: ids }))}
                      placeholder="Chọn bữa ăn..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                      Chuẩn bị (phút)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={form.prepMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, prepMinutes: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                      <Flame size={13} className="text-rose-500" />
                      Nấu (phút)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={form.cookMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, cookMinutes: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                      <Users size={13} className="text-purple-500" />
                      Khẩu phần
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={form.servings}
                      onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: NGUYÊN LIỆU */}
            {activeTab === 'ingredients' && (
              <div className="space-y-3">
                {hasUnapprovedSaved && (
                  <div className="mb-2">
                    <PendingIngredientsPanel
                      dishId={dish.id}
                      onChanged={() => {}}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div key={ing._id} className="flex gap-2 items-center p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-xs font-bold text-amber-600 w-5">{idx + 1}.</span>
                      <div className="flex-1">
                        <IngredientPicker
                          value={ing.name}
                          ingredientId={ing.ingredientId}
                          ingredientImageUrl={ing.ingredientImageUrl}
                          ingredientStatus={ing.ingredientStatus as any}
                          resolutionStatus={ing.ingredientId ? 'LINKED' : ing.name.trim() ? 'NOT_FOUND' : 'EMPTY'}
                          onChange={(name: string, ingredient?: any) =>
                            updateIngredient(ing._id, {
                              name,
                              ingredientId: ingredient?.id,
                              ingredientImageUrl: ingredient?.imageUrl,
                              ingredientStatus: ingredient?.status,
                            })
                          }
                          placeholder="Tìm nguyên liệu..."
                        />
                      </div>
                      <Input
                        placeholder="Số lượng"
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(ing._id, { quantity: e.target.value })}
                        className="w-24 h-8 text-xs"
                      />
                      <Select
                        value={ing.unit}
                        onChange={(e) => updateIngredient(ing._id, { unit: e.target.value })}
                        className="w-20 h-8 text-xs"
                      >
                        {['g', 'kg', 'ml', 'lít', 'thìa', 'muỗng', 'chén', 'cái', 'bó', 'lá', 'quả', 'miếng'].map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(ing._id)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  className="w-full border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 h-8 text-xs gap-1.5"
                >
                  <Plus size={13} /> Thêm nguyên liệu
                </Button>
              </div>
            )}

            {/* TAB: DINH DƯỠNG */}
            {activeTab === 'nutrition' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Calories (kcal)</label>
                    <Input
                      type="number"
                      min={0}
                      value={nutrition.calories}
                      onChange={(e) => setNutrition((n) => ({ ...n, calories: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Protein (g)</label>
                    <Input
                      type="number"
                      min={0}
                      value={nutrition.proteinG}
                      onChange={(e) => setNutrition((n) => ({ ...n, proteinG: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Carbs (g)</label>
                    <Input
                      type="number"
                      min={0}
                      value={nutrition.carbG}
                      onChange={(e) => setNutrition((n) => ({ ...n, carbG: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Chất béo (g)</label>
                    <Input
                      type="number"
                      min={0}
                      value={nutrition.fatG}
                      onChange={(e) => setNutrition((n) => ({ ...n, fatG: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Chất xơ (g)</label>
                    <Input
                      type="number"
                      min={0}
                      value={nutrition.fiberG}
                      onChange={(e) => setNutrition((n) => ({ ...n, fiberG: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Natri (mg)</label>
                    <Input
                      type="number"
                      min={0}
                      value={nutrition.sodiumMg}
                      onChange={(e) => setNutrition((n) => ({ ...n, sodiumMg: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CÔNG THỨC */}
            {activeTab === 'recipe' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {recipeSteps.map((step, idx) => (
                    <div key={step._id} className="flex gap-2 items-start p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold mt-1">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-1.5">
                        <Textarea
                          rows={2}
                          value={step.instruction}
                          onChange={(e) => updateStep(idx, 'instruction', e.target.value)}
                          placeholder={`Nội dung bước ${idx + 1}...`}
                          className="text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">Thời gian (phút):</span>
                          <Input
                            type="number"
                            min={0}
                            value={step.durationMin ?? ''}
                            onChange={(e) => updateStep(idx, 'durationMin', e.target.value)}
                            className="w-20 h-7 text-xs"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(idx)}
                        className="h-7 w-7 text-slate-400 hover:text-rose-600"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStep}
                    className="border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 h-8 text-xs gap-1"
                  >
                    <Plus size={13} /> Thêm bước
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveRecipe}
                    disabled={savingRecipe}
                    className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs gap-1.5"
                  >
                    <Save size={13} />
                    {savingRecipe ? 'Đang lưu...' : 'Lưu cách nấu'}
                  </Button>
                </div>
                {recipeSaved && (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                    <Check size={13} /> Đã cập nhật các bước nấu!
                  </p>
                )}
              </div>
            )}

            {/* TAB: HÌNH ẢNH */}
            {activeTab === 'media' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Hình ảnh ({mediaList.length})</span>
                  <label className="cursor-pointer bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadMedia}
                      disabled={uploadingMedia}
                    />
                    <ImagePlus size={14} />
                    {uploadingMedia ? 'Đang tải...' : 'Thêm ảnh'}
                  </label>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {mediaList.map((m) => (
                    <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                      <Image src={m.url} alt="" aspectRatio="square" className="h-full w-full object-cover" />
                      {m.isPrimary && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          CHÍNH
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewUrl(m.url)}
                          className="h-7 w-7 text-white hover:bg-white/20"
                        >
                          <ZoomIn size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMedia(m.id)}
                          disabled={deletingId === m.id}
                          className="h-7 w-7 text-rose-300 hover:bg-rose-500/30"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error or Success notification */}
            {saveError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Cập nhật món ăn thành công!
              </div>
            )}

            {/* Footer buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateDish.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
              >
                {updateDish.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete media dialog */}
      <AlertDialog open={!!mediaToDelete} onOpenChange={(open) => !open && setMediaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa hình ảnh này?</AlertDialogTitle>
            <AlertDialogDescription>Hình ảnh sẽ bị xóa khỏi món ăn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMedia} className="bg-rose-600 text-white">
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
