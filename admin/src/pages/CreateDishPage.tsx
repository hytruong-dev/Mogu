import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { StepTabs } from '../components/molecules/StepTabs'
import { ClassificationPanel, type ClassificationState } from '../components/molecules/ClassificationPanel'
import { SummaryPanel } from '../components/molecules/SummaryPanel'
import { BasicInfoForm, type BasicInfoState } from '../components/molecules/BasicInfoForm'
import { PreviewPanel } from '../components/molecules/PreviewPanel'
import { IngredientsTable, type DishIngredientRow } from '../components/molecules/IngredientsTable'
import { IngredientSummaryPanel } from '../components/molecules/IngredientSummaryPanel'
import { NutritionForm, defaultNutrition, type NutritionState } from '../components/molecules/NutritionForm'
import { NutritionPreviewPanel } from '../components/molecules/NutritionPreviewPanel'
import { RecipeForm, defaultRecipe, type RecipeState } from '../components/molecules/RecipeForm'
import { RecipePreviewPanel } from '../components/molecules/RecipePreviewPanel'
import { MediaForm, defaultMedia, type MediaState } from '../components/molecules/MediaForm'
import { MediaPreviewPanel } from '../components/molecules/MediaPreviewPanel'
import { ReviewDishPanel } from '../components/molecules/ReviewDishPanel'
import { ReviewSidePanel } from '../components/molecules/ReviewSidePanel'
import { SubmitSuccessModal } from '../components/molecules/SubmitSuccessModal'
import { PageSkeleton } from '../components/ui/page-skeleton'
import { useAdminDish, useCreateDish, useDishLifecycle, useUpdateDish } from '../hooks/useDishes'
import { useCategories, useDietTypes, useGoals, useMealTypes, useProvinces, useRegions } from '../hooks/useTaxonomy'
import { dishesApi, type CreateDishDto, type NutritionPayload, type DishValidationResult } from '../api/dishes'
import { mediaApi } from '../api/media'
import { migrateMealTypeIds, type MealTypeOption } from '../lib/meal-types'
import { formatApiError } from '../lib/api-error'

const STEPS = [
  { id: 'basic', label: 'Thông tin cơ bản' },
  { id: 'classify', label: 'Phân loại' },
  { id: 'ingredients', label: 'Thành phần' },
  { id: 'nutrition', label: 'Dinh dưỡng' },
  { id: 'recipe', label: 'Công thức' },
  { id: 'media', label: 'Hình ảnh' },
] as const

type StepId = (typeof STEPS)[number]['id']


/**
 * Trang full-screen tạo món ăn mới (route /foods/new).
 * Không phải modal — chiếm toàn bộ vùng nội dung, có 6 bước theo design.
 */
function buildDishPayload(args: {
  basic: BasicInfoState
  classification: ClassificationState
  ingredients: DishIngredientRow[]
  servings: number
  nutrition: NutritionState
  recipe: RecipeState
  media: MediaState
  mealTypes?: MealTypeOption[]
}): CreateDishDto {
  const { basic, classification, ingredients, servings, nutrition, recipe, media, mealTypes } = args
  const nutritionPayload: NutritionPayload = {}
  if (nutrition.calories) nutritionPayload.calories = Number(nutrition.calories)
  if (nutrition.proteinG) nutritionPayload.proteinG = Number(nutrition.proteinG)
  if (nutrition.carbG) nutritionPayload.carbsG = Number(nutrition.carbG)
  if (nutrition.fatG) nutritionPayload.fatG = Number(nutrition.fatG)
  if (nutrition.fiberG) nutritionPayload.fiberG = Number(nutrition.fiberG)
  if (nutrition.sodiumMg) nutritionPayload.sodiumMg = Number(nutrition.sodiumMg)
  if (nutrition.servingLabel) nutritionPayload.servingName = nutrition.servingLabel
  if (nutrition.servingG) nutritionPayload.servingG = Number(nutrition.servingG)
  return {
    name: basic.name || undefined,
    alternateNames: basic.altName ? [basic.altName] : undefined,
    shortDescription: basic.shortDescription?.trim() || undefined,
    regionId: basic.regionId,
    provinceId: basic.provinceId,
    categoryIds: [...new Set(classification.categoryIds.length ? classification.categoryIds : basic.categoryIds)],
    mealTypeIds: mealTypes?.length
      ? migrateMealTypeIds(
          classification.mealTypeIds.length ? classification.mealTypeIds : basic.mealTypeIds,
          mealTypes,
        )
      : [...new Set(classification.mealTypeIds.length ? classification.mealTypeIds : basic.mealTypeIds)],
    dietTypeIds: classification.dietTypeIds.length ? [...new Set(classification.dietTypeIds)] : undefined,
    goalIds: [...new Set(classification.goalIds)],
    difficulty: recipe.difficulty,
    prepMinutes: recipe.prepMin ? Number(recipe.prepMin) : undefined,
    cookMinutes: recipe.cookMin ? Number(recipe.cookMin) : undefined,
    servings: Number(recipe.servings) || servings,
    priceMin: classification.priceFrom ? Number(classification.priceFrom.replace(/\D/g, '')) : undefined,
    priceMax: classification.priceTo ? Number(classification.priceTo.replace(/\D/g, '')) : undefined,
    nutrition: Object.keys(nutritionPayload).length ? nutritionPayload : undefined,
    createMissingIngredients: true,
    ingredients: ingredients.filter((i) => i.name.trim()).map((i, idx) => ({
      clientRef: i.clientRef,
      rawText: i.name.trim(),
      canonicalNameCandidate: i.name.trim(),
      quantity: i.qty ? Number(i.qty) : undefined,
      unit: i.unit || undefined,
      preparation: i.prep || undefined,
      isOptional: !i.required,
      ingredientId: i.ingredientId,
      sortOrder: idx + 1,
    })),
    recipeSteps: recipe.steps.filter((s) => s.title.trim() || s.body.trim()).map((s, idx) => ({
      stepOrder: idx + 1,
      instruction: [s.title, s.body].filter(Boolean).join('\n'),
      durationMin: s.durationMin ? Number(s.durationMin) : undefined,
      imageUrl: s.imageUrl,
    })),
    sources: media.sources
      .filter((s) => s.url.trim())
      .map((s) => ({
        url: s.url.trim(),
        title: s.name.trim() || undefined,
        reliability: s.trust ? Number(s.trust) : undefined,
        sourceType: 'UNSTRUCTURED',
      })),
  }
}

export default function CreateDishPage() {
  const navigate = useNavigate()
  const { id: routeId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const createDish = useCreateDish()
  const updateDish = useUpdateDish()
  const lifecycle = useDishLifecycle()

  const categories = useCategories()
  const mealTypes = useMealTypes()
  const regions = useRegions()
  const provinces = useProvinces()
  const goals = useGoals()
  const dietTypes = useDietTypes()

  const [dishId, setDishId] = useState<string | undefined>(routeId && routeId !== 'new' ? routeId : undefined)
  const [version, setVersion] = useState(1)
  const versionRef = useRef(1)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const hydrated = useRef(false)
  const skipAutosave = useRef(true)
  const saveQueueRef = useRef(Promise.resolve())
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dishIdRef = useRef(dishId)
  dishIdRef.current = dishId
  versionRef.current = version

  const isEditMode = Boolean(routeId && routeId !== 'new')
  const queryDishId = isEditMode ? routeId! : (dishId ?? '')
  const existing = useAdminDish(queryDishId)

  const initialStep = (searchParams.get('step') as StepId) || 'basic'
  const [activeTab, setActiveTab] = useState<StepId>(
    STEPS.some((s) => s.id === initialStep) ? initialStep : 'basic',
  )
  const [basic, setBasic] = useState<BasicInfoState>({
    name: '',
    altName: '',
    shortDescription: '',
    regionId: undefined,
    provinceId: undefined,
    categoryIds: [],
    mealTypeIds: [],
  })
  const [classification, setClassification] = useState<ClassificationState>({
    categoryIds: [],
    mealTypeIds: [],
    goalIds: [],
    dietTypeIds: [],
    flavors: [],
    dishType: 'batKy',
    priceFrom: '',
    priceTo: '',
  })
  const [ingredients, setIngredients] = useState<DishIngredientRow[]>([])
  const [servings, setServings] = useState(4)
  const [nutrition, setNutrition] = useState<NutritionState>(defaultNutrition())
  const [recipe, setRecipe] = useState<RecipeState>(defaultRecipe())
  const [media, setMedia] = useState<MediaState>(defaultMedia())
  const [phase, setPhase] = useState<'wizard' | 'review'>('wizard')
  const [sodiumAck, setSodiumAck] = useState(false)
  const [reviewTeam, setReviewTeam] = useState('Kiểm duyệt nội dung')
  const [reviewNote, setReviewNote] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successOpen, setSuccessOpen] = useState(false)
  const [createdId, setCreatedId] = useState('#MOGU-1052')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [validation, setValidation] = useState<DishValidationResult | null>(null)
  const [dishStatus, setDishStatus] = useState<string>('DRAFT')
  const [submitting, setSubmitting] = useState(false)
  const draftPromiseRef = useRef<Promise<string> | null>(null)

  const close = () => navigate('/foods')

  const ensureDraft = async (): Promise<string> => {
    if (dishIdRef.current) return dishIdRef.current

    if (!draftPromiseRef.current) {
      draftPromiseRef.current = createDish
        .mutateAsync({ name: '' })
        .then((d: any) => {
          const id = d?.id as string | undefined
          if (!id) throw new Error('Không tạo được bản nháp')
          setDishId(id)
          setVersion(d.version ?? 1)
          versionRef.current = d.version ?? 1
          setCreatedId(`#${id.slice(0, 8).toUpperCase()}`)
          hydrated.current = true
          skipAutosave.current = true
          const step = searchParams.get('step') || activeTab
          navigate(`/foods/${id}?step=${step}`, { replace: true })
          return id
        })
        .finally(() => {
          draftPromiseRef.current = null
        })
    }

    return draftPromiseRef.current
  }

  const changeStep = (step: StepId) => {
    setActiveTab(step)
    setSearchParams({ step }, { replace: true })
  }

  const cancelAutosave = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }

  const syncVersionFromServer = async (id: string) => {
    const fresh = await dishesApi.detail(id)
    const v = Number((fresh as { version?: number })?.version)
    if (!Number.isNaN(v) && v > 0) {
      versionRef.current = v
      setVersion(v)
    }
  }

  const performSave = async (retryOnConflict = false, syncVersionFirst = false): Promise<void> => {
    let id: string
    try {
      id = await ensureDraft()
    } catch (err: unknown) {
      setSaveState('error')
      setSubmitError(formatApiError(err))
      throw err
    }

    if (syncVersionFirst) {
      await syncVersionFromServer(id)
    }

    setSaveState('saving')
    try {
      const payload = buildDishPayload({
        basic,
        classification,
        ingredients,
        servings,
        nutrition,
        recipe,
        media,
        mealTypes: mealTypes.data ?? [],
      })
      const saved = await updateDish.mutateAsync({
        id,
        dto: { ...payload, version: versionRef.current },
      })
      const sources = media.sources.filter((s) => s.url.trim())
      if (sources.length) {
        await dishesApi.saveSources(
          id,
          sources.map((s) => ({
            url: s.url.trim(),
            title: s.name.trim() || undefined,
            reliability: s.trust ? Number(s.trust) : undefined,
            sourceType: 'UNSTRUCTURED',
          })),
        )
      }
      const nextVersion = Number((saved as { version?: number })?.version)
      if (!Number.isNaN(nextVersion) && nextVersion > 0) {
        versionRef.current = nextVersion
        setVersion(nextVersion)
      } else {
        versionRef.current += 1
        setVersion(versionRef.current)
      }
      setSaveState('saved')
      setSubmitError('')
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 409 && !retryOnConflict) {
        await syncVersionFromServer(id)
        return performSave(true, false)
      }
      setSaveState('error')
      setSubmitError(formatApiError(err))
      throw err
    }
  }

  const saveDraft = (opts?: { syncVersionFirst?: boolean }): Promise<void> => {
    cancelAutosave()
    const task = saveQueueRef.current.then(() =>
      performSave(false, opts?.syncVersionFirst ?? false),
    )
    saveQueueRef.current = task.catch(() => {})
    return task
  }

  useEffect(() => {
    if (!routeId || routeId === 'new') return
    setDishId(routeId)
    hydrated.current = false
    skipAutosave.current = true
    setPhase('wizard')
    setValidation(null)
    setSubmitError('')
  }, [routeId])

  useEffect(() => {
    if (routeId && routeId !== 'new') return
    void ensureDraft().catch((err: any) => {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Không tạo được bản nháp')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  useEffect(() => {
    const dish = existing.data as Record<string, any> | undefined
    if (!isEditMode || !dish?.id || dish.id !== routeId) return
    if (hydrated.current) return

    hydrated.current = true
    const dishVersion = dish.version ?? 1
    setVersion(dishVersion)
    versionRef.current = dishVersion
    setDishStatus(dish.status ?? 'DRAFT')
    setCreatedId(`#${String(dish.id).slice(0, 8).toUpperCase()}`)
    setBasic({
      name: dish.name === 'Bản nháp chưa đặt tên' ? '' : (dish.name ?? ''),
      altName: (dish.alternateNames ?? [])[0] ?? '',
      shortDescription: dish.shortDescription ?? '',
      regionId: dish.regionId,
      provinceId: dish.provinceId,
      categoryIds: (dish.categories ?? []).map((c: any) => c.categoryId ?? c.category?.id).filter(Boolean),
      mealTypeIds: (dish.mealTypes ?? []).map((m: any) => m.mealTypeTagId ?? m.mealTypeTag?.id).filter(Boolean),
    })
    setClassification((c) => ({
      ...c,
      categoryIds: (dish.categories ?? []).map((x: any) => x.categoryId ?? x.category?.id).filter(Boolean),
      mealTypeIds: (dish.mealTypes ?? []).map((x: any) => x.mealTypeTagId ?? x.mealTypeTag?.id).filter(Boolean),
      dietTypeIds: (dish.dietTypes ?? []).map((x: any) => x.dietTypeId ?? x.dietType?.id).filter(Boolean),
      goalIds: (dish.dishGoals ?? []).map((x: any) => x.goalId).filter(Boolean),
      priceFrom: dish.priceMin != null ? String(dish.priceMin) : '',
      priceTo: dish.priceMax != null ? String(dish.priceMax) : '',
      flavors: (dish.flavorTags ?? []).map((code: string) => ({
        THANH_NHE: 'Thanh nhẹ',
        DAM_DA: 'Đậm đà',
        CAY: 'Cay',
        KHONG_CAY: 'Không cay',
        CHUA: 'Chua',
        NGOT: 'Ngọt',
        BEO: 'Béo',
        MAN: 'Mặn',
      } as Record<string, string>)[code] ?? code),
    }))
    if (dish.dishIngredients?.length) {
      setIngredients(dish.dishIngredients.map((i: any) => ({
        id: Date.now() + Math.random(),
        clientRef: `edit-${i.id ?? Date.now()}`,
        name: i.parsedName ?? i.ingredient?.name ?? i.rawText ?? '',
        ingredientId: i.ingredient?.id ?? i.ingredientId,
        ingredientImageUrl: i.ingredient?.imageUrl ?? undefined,
        ingredientStatus: i.ingredient?.status,
        resolutionStatus: (i.ingredient?.id ?? i.ingredientId)
          ? (i.ingredient?.status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'LINKED')
          : 'NOT_FOUND',
        qty: i.quantity != null ? String(i.quantity) : '',
        unit: ({
          G: 'g',
          KG: 'kg',
          MG: 'mg',
          L: 'lít',
          ML: 'ml',
          TSP: 'muỗng cà phê',
          TBSP: 'muỗng canh',
          CUP: 'chén',
          'CÁI': 'cái',
          'QUẢ': 'quả',
          'CỦ': 'củ',
          'TÉP': 'tép',
          'CÂY': 'cây',
          'NHÁNH': 'nhánh',
          'LÁ': 'lá',
          'MIẾNG': 'miếng',
          'GÓI': 'gói',
          'TÔ': 'tô',
          'CHÉN': 'chén',
          'BÁT': 'bát',
          'ĐĨA': 'đĩa',
          'PHẦN': 'khẩu phần',
          'VỪA_ĐỦ': 'vừa đủ',
          'MỘT_ÍT': 'một ít',
        } as Record<string, string>)[i.unit] ?? i.unit ?? '',
        prep: [i.preparation, i.specification]
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join('; '),
        required: !i.isOptional,
      })))
    } else {
      setIngredients([])
    }
    if (dish.nutrition) {
      setNutrition((n) => ({
        ...n,
        calories: dish.nutrition.calories != null ? String(dish.nutrition.calories) : '',
        proteinG: dish.nutrition.proteinG != null ? String(dish.nutrition.proteinG) : '',
        carbG: dish.nutrition.carbsG != null ? String(dish.nutrition.carbsG) : '',
        fatG: dish.nutrition.fatG != null ? String(dish.nutrition.fatG) : '',
        fiberG: dish.nutrition.fiberG != null ? String(dish.nutrition.fiberG) : '',
        sodiumMg: dish.nutrition.sodiumMg != null ? String(dish.nutrition.sodiumMg) : '',
        servingLabel: dish.nutrition.servingName ?? n.servingLabel,
        servingG: dish.nutrition.servingG != null ? String(dish.nutrition.servingG) : n.servingG,
      }))
    }
    if (dish.recipeSteps?.length) {
      setRecipe((r) => ({
        ...r,
        name: dish.recipeTitle ?? `Cách làm ${dish.name}`,
        servings: dish.servings != null ? String(dish.servings) : r.servings,
        prepMin: dish.prepMinutes != null ? String(dish.prepMinutes) : r.prepMin,
        cookMin: dish.cookMinutes != null ? String(dish.cookMinutes) : r.cookMin,
        difficulty: dish.difficulty ?? r.difficulty,
        steps: dish.recipeSteps.map((s: any) => ({
          id: Date.now() + Math.random(),
          title: ((s.instruction ?? '').split('\n')[0] ?? '')
            .replace(/^\*\*(.*?)\*\*$/, '$1')
            .trim(),
          body: (s.instruction ?? '').split('\n').slice(1).join('\n'),
          durationMin: s.durationMin != null ? String(s.durationMin) : '',
          open: true,
        })),
      }))
    }
    if (dish.media?.length) {
      const items = dish.media.map((m: any, i: number) => ({
        id: i + 1,
        url: m.publicUrl ?? '',
        caption: m.altText ?? `Ảnh ${i + 1}`,
        isCover: !!m.isPrimary,
      })).filter((g: { url: string }) => g.url)
      const cover = items.find((g: { isCover: boolean }) => g.isCover) ?? items[0]
      setMedia((m) => ({ ...m, coverUrl: cover?.url ?? '', gallery: items }))
    }
    if (dish.sources?.length) {
      setMedia((m) => ({
        ...m,
        sources: dish.sources.map((s: any, i: number) => ({
          id: i + 1,
          name: s.title ?? '',
          url: s.url ?? '',
          trust: String(s.reliability ?? 50),
          type: 'Article',
        })),
      }))
    }
    skipAutosave.current = true
  }, [existing.data, isEditMode, routeId])

  useEffect(() => {
    const v = Number((existing.data as { version?: number } | undefined)?.version)
    if (!Number.isNaN(v) && v > versionRef.current) {
      versionRef.current = v
      setVersion(v)
    }
  }, [existing.data])

  useEffect(() => {
    if (!dishId || !hydrated.current || phase === 'review') return
    if (skipAutosave.current) {
      skipAutosave.current = false
      return
    }
    cancelAutosave()
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveDraft().catch(() => {})
    }, 1000)
    return () => cancelAutosave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basic, classification, ingredients, servings, nutrition, recipe, media, phase])

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (saveState === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [saveState])

  const uploadImages = async (files: File[], asCover = false) => {
    if (!files.length) return
    const blobs = files.map((f) => URL.createObjectURL(f))
    if (asCover && blobs[0]) {
      setMedia((m) => {
        const item = { id: Date.now(), url: blobs[0], caption: 'Thành phẩm', isCover: true }
        const rest = m.gallery.filter((g) => !g.isCover).map((g) => ({ ...g, isCover: false }))
        return { ...m, coverUrl: blobs[0], gallery: [item, ...rest] }
      })
    }

    let id: string
    try {
      id = await ensureDraft()
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Chưa tạo được bản nháp nên ảnh mới xem trước, chưa lưu lên server.')
      return
    }

    setUploadingMedia(true)
    setSubmitError('')
    let hasCover = asCover || !!media.coverUrl
    try {
      for (let i = 0; i < files.length; i++) {
        const isPrimary = asCover || (!hasCover && i === 0)
        const saved: any = await mediaApi.uploadFull(id, files[i], { isPrimary })
        const url = blobs[i] ?? saved.publicUrl ?? saved.publicUrl
        hasCover = hasCover || isPrimary
        setMedia((m) => {
          const item = {
            id: Date.now() + i,
            url,
            caption: isPrimary ? 'Thành phẩm' : `Ảnh ${m.gallery.length + 1}`,
            isCover: isPrimary,
          }
          const rest = isPrimary
            ? m.gallery.filter((g) => !g.isCover).map((g) => ({ ...g, isCover: false }))
            : m.gallery
          return { ...m, coverUrl: isPrimary ? url : m.coverUrl || url, gallery: isPrimary ? [item, ...rest] : [...rest, item] }
        })
      }
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Ảnh đã hiện preview, nhưng lưu lên server thất bại.')
    } finally {
      setUploadingMedia(false)
    }
  }

  const goReview = async () => {
    cancelAutosave()
    setSubmitError('')
    try {
      const id = await ensureDraft()
      await saveDraft({ syncVersionFirst: true })
      const [v, dish] = await Promise.all([
        dishesApi.validate(id),
        dishesApi.detail(id),
      ])
      setValidation(v)
      setDishStatus((dish as { status?: string })?.status ?? 'DRAFT')
      skipAutosave.current = true
      setPhase('review')
    } catch (err: unknown) {
      setSubmitError(formatApiError(err))
    }
  }

  const handleSubmit = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const id = await ensureDraft()
      await saveDraft({ syncVersionFirst: true })
      const v = await dishesApi.validate(id)
      setValidation(v)
      if (v && !v.canSubmitReview) {
        setSubmitError(v.blockingErrors.map((e) => e.message).join(' '))
        return
      }
      if (!v) {
        setSubmitError('Không kiểm tra được hồ sơ. Thử tải lại trang hoặc chạy migration backend.')
        return
      }
      await lifecycle.submitForReview.mutateAsync({ id, note: reviewNote, reviewTeam })
      setDishStatus('PENDING_REVIEW')
      setCreatedId(`#${id.slice(0, 8).toUpperCase()}`)
      setSuccessOpen(true)
    } catch (err: unknown) {
      setSubmitError(formatApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const totalMin = (Number(recipe.prepMin) || 0) + (Number(recipe.cookMin) || 0)
  const isLoadingEdit = isEditMode && existing.isLoading && !hydrated.current
  const loadEditFailed =
    isEditMode &&
    !existing.isLoading &&
    !existing.isFetching &&
    (existing.isError || (!existing.data && existing.isFetched))
  const errData = (existing.error as any)?.response?.data?.error
  const isDeleted = errData?.code === 'DISH_DELETED'
  const isNotFound = errData?.code === 'DISH_NOT_FOUND'
  const editErrMsg = errData?.message || 'Không tải được món ăn.'

  return (
    <div className="flex min-h-full flex-col bg-mogu-cream">
      {/* Header */}
      <header className="flex shrink-0 items-start justify-between px-8 pt-6">
        <div>
          {phase === 'review' ? (
            <>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPhase('wizard')} className="rounded-full p-1 hover:bg-black/5">
                  <ChevronLeft size={22} />
                </button>
                <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Kiểm tra món ăn</h1>
                <span className="rounded-md bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">
                  {dishStatus === 'PENDING_REVIEW' ? 'CHỜ DUYỆT' : 'BẢN NHÁP'}
                </span>
                <span className="text-sm text-gray-400">{createdId}</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="m-0 text-[28px] font-extrabold tracking-tight">
                {isEditMode ? 'Chỉnh sửa món ăn' : 'Thêm món mới'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {isEditMode
                  ? `Cập nhật hồ sơ món ăn ${createdId !== '#MOGU-1052' ? createdId : ''}`.trim()
                  : 'Tạo hồ sơ món ăn và gửi kiểm duyệt'}
                {saveState === 'saving' && ' · Đang lưu...'}
                {saveState === 'saved' && ' · Đã lưu nháp'}
                {saveState === 'error' && ' · Lưu thất bại'}
              </p>
            </>
          )}
        </div>
        <button onClick={close} className="mt-1 rounded-full p-1 hover:bg-black/5">
          <X size={24} />
        </button>
      </header>

      {/* Step tabs */}
      {phase === 'wizard' && <div className="mt-5 px-8">
        <StepTabs
          steps={STEPS.map((t, i) => {
            const currentIdx = STEPS.findIndex((s) => s.id === activeTab)
            return {
              n: i + 1,
              label: t.label,
              active: activeTab === t.id,
              done: i < currentIdx,
              onClick: () => changeStep(t.id),
            }
          })}
        />
      </div>}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoadingEdit && <PageSkeleton rows={6} withAvatar />}
        {loadEditFailed && (
          <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="mb-2 text-base font-semibold">
              {isDeleted ? 'Món ăn đã bị xóa' : isNotFound ? 'Không tìm thấy món ăn' : 'Không tải được món ăn'}
            </p>
            <p className="mb-4 text-sm text-red-600">{editErrMsg}</p>
            <div className="flex items-center justify-center gap-3">
              {isDeleted && (
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                  disabled={lifecycle.restore.isPending}
                  onClick={async () => {
                    if (queryDishId) {
                      await lifecycle.restore.mutateAsync(queryDishId)
                      void existing.refetch()
                    }
                  }}
                >
                  {lifecycle.restore.isPending ? 'Đang khôi phục...' : 'Khôi phục món ăn'}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                onClick={() => navigate('/foods')}
              >
                Về danh sách món
              </button>
              {!isDeleted && !isNotFound && (
                <button
                  type="button"
                  className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                  onClick={() => void existing.refetch()}
                >
                  Thử lại
                </button>
              )}
            </div>
          </div>
        )}
        {!isLoadingEdit && !loadEditFailed && phase === 'review' && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
            <ReviewDishPanel
              basic={basic}
              classification={classification}
              ingredients={ingredients}
              nutrition={nutrition}
              recipe={recipe}
              media={media}
              regions={regions.data ?? []}
              provinces={provinces.data ?? []}
              categories={categories.data ?? []}
              onEdit={(step) => { changeStep(step as StepId); setPhase('wizard') }}
              validation={validation}
            />
            <ReviewSidePanel
              basic={basic}
              nutrition={nutrition}
              recipe={recipe}
              media={media}
              sodiumAck={sodiumAck}
              onSodiumAck={setSodiumAck}
              reviewTeam={reviewTeam}
              onReviewTeam={setReviewTeam}
              reviewNote={reviewNote}
              onReviewNote={setReviewNote}
              totalMin={totalMin}
            />
          </div>
        )}

        {!isLoadingEdit && !loadEditFailed && phase === 'wizard' && activeTab === 'basic' && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_430px]">
            <BasicInfoForm
              state={basic}
              onChange={setBasic}
              categories={categories.data ?? []}
              mealTypes={mealTypes.data ?? []}
              regions={regions.data ?? []}
              provinces={provinces.data ?? []}
            />
            <PreviewPanel
              state={basic}
              categories={categories.data ?? []}
              regions={regions.data ?? []}
              provinces={provinces.data ?? []}
              coverUrl={media.coverUrl}
              uploading={uploadingMedia}
              onPickImage={(file) => { void uploadImages([file], true) }}
            />
          </div>
        )}

        {phase === 'wizard' && activeTab === 'classify' && !isLoadingEdit && !loadEditFailed && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_380px]">
            <ClassificationPanel
              state={classification}
              onChange={(next) => {
                setClassification(next)
                setBasic((b) => ({ ...b, categoryIds: next.categoryIds, mealTypeIds: next.mealTypeIds }))
              }}
              categories={categories.data ?? []}
              mealTypes={mealTypes.data ?? []}
              goals={goals.data ?? []}
              dietTypes={dietTypes.data ?? []}
            />
            <SummaryPanel
              state={classification}
              categories={categories.data ?? []}
              mealTypes={mealTypes.data ?? []}
              goals={goals.data ?? []}
              dietTypes={dietTypes.data ?? []}
            />
          </div>
        )}

        {phase === 'wizard' && activeTab === 'ingredients' && !isLoadingEdit && !loadEditFailed && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_430px]">
            <IngredientsTable
              rows={ingredients}
              onChange={setIngredients}
              servings={servings}
              onServingsChange={setServings}
            />
            <IngredientSummaryPanel rows={ingredients} servings={servings} />
          </div>
        )}

        {phase === 'wizard' && activeTab === 'nutrition' && !isLoadingEdit && !loadEditFailed && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
            <NutritionForm state={nutrition} onChange={setNutrition} />
            <NutritionPreviewPanel state={nutrition} />
          </div>
        )}

        {phase === 'wizard' && activeTab === 'recipe' && !isLoadingEdit && !loadEditFailed && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
            <RecipeForm state={recipe} onChange={setRecipe} />
            <RecipePreviewPanel state={recipe} onChange={setRecipe} />
          </div>
        )}

        {phase === 'wizard' && activeTab === 'media' && !isLoadingEdit && !loadEditFailed && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_380px]">
            <MediaForm
              state={media}
              onChange={setMedia}
              uploading={uploadingMedia}
              onSelectFiles={(files) => { void uploadImages(files, !media.coverUrl) }}
            />
            <MediaPreviewPanel
              media={media}
              basic={basic}
              nutrition={nutrition}
              recipe={recipe}
              totalMin={(Number(recipe.prepMin) || 0) + (Number(recipe.cookMin) || 0)}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-end gap-4 border-t border-black/5 bg-mogu-cream px-8 py-5">
        {submitError && <span className="mr-auto text-sm text-red-600">⚠️ {submitError}</span>}
        {phase === 'review' ? (
          <>
            <Button type="button" variant="outline" onClick={() => setPhase('wizard')}>
              <ChevronLeft size={16} /> Quay lại chỉnh sửa
            </Button>
            <Button type="button" variant="outline" onClick={async () => { await saveDraft({ syncVersionFirst: true }); close() }}>Lưu bản nháp</Button>
            <Button type="button" onClick={() => { void handleSubmit() }} disabled={submitting || lifecycle.submitForReview.isPending || ((Number(nutrition.sodiumMg) || 0) >= 800 && !sodiumAck)}>
              {submitting || lifecycle.submitForReview.isPending ? 'Đang gửi...' : 'Gửi kiểm duyệt'}
              <ChevronRight size={16} />
            </Button>
          </>
        ) : (
          <>
            {activeTab !== 'basic' && (
              <Button type="button" variant="outline" onClick={() => {
                const idx = STEPS.findIndex((t) => t.id === activeTab)
                if (idx > 0) changeStep(STEPS[idx - 1].id)
              }}>
                <ChevronLeft size={16} /> Quay lại
              </Button>
            )}
            <Button type="button" variant="outline" onClick={async () => { await saveDraft({ syncVersionFirst: true }); close() }}>Lưu bản nháp</Button>
            {activeTab !== 'media' ? (
              <Button type="button" onClick={() => {
                const idx = STEPS.findIndex((t) => t.id === activeTab)
                const next = STEPS[idx + 1]
                if (next) changeStep(next.id)
              }}>
                Tiếp tục: {STEPS[STEPS.findIndex((t) => t.id === activeTab) + 1]?.label}
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button type="button" onClick={() => { void goReview() }}>
                Kiểm tra hồ sơ
                <ChevronRight size={16} />
              </Button>
            )}
          </>
        )}
      </footer>

      <SubmitSuccessModal
        open={successOpen}
        dishName={basic.name}
        dishId={createdId}
        sentAt={new Date().toLocaleString('vi-VN')}
        team={reviewTeam}
        onCloseToFoods={close}
        onViewStatus={() => navigate('/review')}
        onCreateAnother={() => {
          setSuccessOpen(false)
          setPhase('wizard')
          navigate('/foods/new')
        }}
      />
    </div>
  )
}
