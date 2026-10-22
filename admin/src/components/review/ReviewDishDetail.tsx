import { useState, useMemo } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChefHat,
  Clock,
  Coins,
  Flame,
  Globe2,
  Layers,
  Leaf,
  Lightbulb,
  PlayCircle,
  ExternalLink,
  Users,
  Utensils,
  BookOpen,
  HeartHandshake,
  Activity,
  AlertTriangle,
  Check,
} from 'lucide-react'
import type { ReviewQueueItem } from '../../types'
import { useReviewActions } from '../../hooks/useReviewQueue'
import { useAdminDish } from '../../hooks/useDishes'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Image } from '../ui/image'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
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
import {
  formatVnd,
  getDifficultyMeta,
  getConfidenceMeta,
  formatFlavorTag,
  MEAL_SLOT_LABELS,
  DISH_TYPE_LABELS,
  NUTRITION_BASIS_LABELS,
  NUTRITION_METHOD_LABELS,
  parseStepInstruction,
  formatAllergen,
} from './types'
import { ReviewActionDialog } from './ReviewActionDialog'

export interface ReviewDishDetailProps {
  dish: ReviewQueueItem
  onBack: () => void
}

export function ReviewDishDetail({ dish, onBack }: ReviewDishDetailProps) {
  const actions = useReviewActions()
  const { data: fullDish } = useAdminDish(dish.id)

  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showApprove, setShowApprove] = useState(false)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'nutrition' | 'evidence'>('ingredients')

  // Resolve merged dish data
  const currentDish = fullDish ?? dish
  const mediaList = fullDish?.media ?? dish.media ?? []
  const activeMedia = mediaList[activeMediaIndex] ?? mediaList[0]
  const ingredients = fullDish?.dishIngredients ?? []
  const steps = fullDish?.recipeSteps ?? []
  const nutrition = fullDish?.nutrition ?? dish.nutritionProfiles?.[0]
  const sources = fullDish?.sources ?? []
  const evidences = dish.fieldEvidences ?? []
  const unresolvedEvidences = evidences.filter((e) => !e.isResolved)

  const confidenceScore = fullDish?.confidenceScore ?? dish.confidenceScore
  const confidenceMeta = getConfidenceMeta(confidenceScore)
  const difficultyMeta = getDifficultyMeta(fullDish?.difficulty)

  // Allergen items detection
  const allergenList = useMemo(() => {
    const list: Array<{ name: string; code?: string; level?: string; note?: string }> = []

    if (fullDish?.dishAllergens && fullDish.dishAllergens.length > 0) {
      fullDish.dishAllergens.forEach((da) => {
        list.push({
          name: da.allergen.name,
          code: da.allergen.code,
          level: da.level === 'HIGH' ? 'Rủi ro cao' : da.level === 'MEDIUM' ? 'Rủi ro vừa' : 'Rủi ro thấp',
          note: da.resolutionNote || undefined,
        })
      })
    }

    ingredients.forEach((ing) => {
      const code = ing.ingredient?.allergenCode
      if (code && !list.some((a) => a.code === code)) {
        list.push({
          name: formatAllergen(code) || (ing.ingredient?.name ?? ing.ingredientName ?? 'Chất gây dị ứng'),
          code,
          level: 'Từ thành phần nguyên liệu',
        })
      }
    })

    return list
  }, [fullDish?.dishAllergens, ingredients])

  // Macro calculation
  const calories = nutrition?.calories ? Number(nutrition.calories) : 0
  const protein = (nutrition?.proteinG ?? nutrition?.protein) ? Number(nutrition.proteinG ?? nutrition.protein) : 0
  const carbs = (nutrition?.carbsG ?? nutrition?.carbs) ? Number(nutrition.carbsG ?? nutrition.carbs) : 0
  const fat = (nutrition?.fatG ?? nutrition?.fat) ? Number(nutrition.fatG ?? nutrition.fat) : 0
  const fiber = (nutrition?.fiberG ?? nutrition?.fiber) ? Number(nutrition.fiberG ?? nutrition.fiber) : 0
  const sodium = nutrition?.sodiumMg ? Number(nutrition.sodiumMg) : 0

  const totalMacroCal = (protein * 4) + (carbs * 4) + (fat * 9)
  const proteinPct = totalMacroCal > 0 ? Math.round(((protein * 4) / totalMacroCal) * 100) : 0
  const carbsPct = totalMacroCal > 0 ? Math.round(((carbs * 4) / totalMacroCal) * 100) : 0
  const fatPct = totalMacroCal > 0 ? Math.round(((fat * 9) / totalMacroCal) * 100) : 0

  // Categories & taxonomy lists
  const categoriesList = useMemo(() => {
    if (!fullDish?.categories) return []
    return fullDish.categories.map((c: any) => c.name ?? c.category?.name).filter(Boolean)
  }, [fullDish?.categories])

  const mealTypesList = useMemo(() => {
    if (!fullDish?.mealTypes) return []
    return fullDish.mealTypes.map((m: any) => m.name ?? m.mealTypeTag?.name).filter(Boolean)
  }, [fullDish?.mealTypes])

  const dietTypesList = useMemo(() => {
    if (!fullDish?.dietTypes) return []
    return fullDish.dietTypes.map((d: any) => d.name ?? d.dietType?.name).filter(Boolean)
  }, [fullDish?.dietTypes])

  const dishGoalsList = useMemo(() => {
    if (!fullDish?.dishGoals) return []
    return fullDish.dishGoals.map((g: any) => g.name ?? g.goal?.name).filter(Boolean)
  }, [fullDish?.dishGoals])

  const handleApprove = async () => {
    await actions.approve.mutateAsync(dish.id)
    setShowApprove(false)
    onBack()
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Navigation & Actions Bar ─────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-1.5 h-9 text-xs font-medium border-border hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Hàng đợi kiểm duyệt</span>
          </Button>

          <div className="h-5 w-[1px] bg-border hidden sm:block" />

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {currentDish.name}
              </h1>
              <Badge variant="warning" className="text-xs px-2 py-0.5">
                Chờ kiểm duyệt
              </Badge>
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                #{dish.id.slice(0, 8)}
              </code>
              {fullDish?.version && (
                <span className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                  v{fullDish.version}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vùng miền: <span className="font-semibold text-foreground">{currentDish.region?.name ?? 'Món Việt'}</span>
              {fullDish?.province?.name && ` (${fullDish.province.name})`}
              {' • '}Rà soát toàn diện công thức, nguyên liệu, quy trình nấu và chỉ số dinh dưỡng.
            </p>
          </div>
        </div>

        {/* Action button cluster */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={() => setShowRequestChanges(true)}
          >
            Yêu cầu sửa
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-9 text-xs"
            onClick={() => setShowReject(true)}
          >
            Từ chối
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 h-9 text-xs px-4 shadow-sm"
            onClick={() => setShowApprove(true)}
            disabled={actions.approve.isPending}
          >
            <CheckCircle2 size={16} />
            Duyệt & xuất bản
          </Button>
        </div>
      </div>

      {/* ── Hero Overview Card ───────────────────────────────── */}
      <Card className="overflow-hidden border border-border bg-card shadow-xs">
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Media Presentation */}
            <div className="lg:col-span-4 space-y-3">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-muted/40 aspect-[4/3] shadow-xs group">
                {activeMedia?.publicUrl ? (
                  <Image
                    src={activeMedia.publicUrl}
                    alt={currentDish.name}
                    aspectRatio="square"
                    zoomable
                    title={currentDish.name}
                    subtitle={activeMedia.isPrimary ? 'Ảnh đại diện chính' : undefined}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Utensils size={36} className="opacity-30 mb-2" />
                    <span className="text-xs font-medium">Chưa có ảnh tư liệu</span>
                  </div>
                )}

                {activeMedia?.isPrimary && (
                  <span className="absolute top-3 left-3 bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm z-10">
                    Ảnh chính
                  </span>
                )}
              </div>

              {/* Video URL Link */}
              {fullDish?.videoUrl && (
                <a
                  href={fullDish.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 hover:underline"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <PlayCircle size={16} />
                    <span>Xem video hướng dẫn nấu món</span>
                  </div>
                  <ExternalLink size={12} />
                </a>
              )}

              {/* Media Thumbnails Strip */}
              {mediaList.length > 1 && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>Bộ sưu tập hình ảnh ({mediaList.length})</span>
                    <span className="text-[10px] text-muted-foreground/70">Bấm để chuyển ảnh</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {mediaList.map((m, idx) => (
                      <button
                        key={m.id || idx}
                        type="button"
                        onClick={() => setActiveMediaIndex(idx)}
                        className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === activeMediaIndex
                            ? 'border-amber-500 ring-2 ring-amber-500/20'
                            : 'border-border opacity-70 hover:opacity-100 hover:border-amber-300'
                        }`}
                      >
                        <img src={m.publicUrl} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Dish Info & Attributes */}
            <div className="lg:col-span-8 space-y-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                    {currentDish.name}
                  </h2>
                  <Badge variant={confidenceMeta.variant} className={`text-xs px-2.5 py-0.5 ${confidenceMeta.colorClass}`}>
                    <confidenceMeta.icon size={13} className="mr-1" />
                    {confidenceMeta.label}
                  </Badge>
                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 ${difficultyMeta.colorClass}`}>
                    <ChefHat size={13} className="mr-1" />
                    {difficultyMeta.label}
                  </Badge>
                  {fullDish?.dishType && (
                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                      {DISH_TYPE_LABELS[fullDish.dishType] ?? fullDish.dishType}
                    </Badge>
                  )}
                </div>

                {/* Subtitle / Alternate names */}
                {((fullDish as any)?.alternateNames?.length || (fullDish as any)?.nameEn) ? (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    {(fullDish as any)?.nameEn && <span className="font-medium text-foreground">{(fullDish as any).nameEn}</span>}
                    {fullDish?.alternateNames && fullDish.alternateNames.length > 0 && (
                      <span>• Tên gọi khác: {fullDish.alternateNames.join(', ')}</span>
                    )}
                  </p>
                ) : null}
              </div>

              {/* Attributes Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Cooking Time */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">Thời gian nấu</span>
                    <span className="text-xs font-bold text-foreground truncate block">
                      {(fullDish as any)?.cookTimeMin ?? fullDish?.cookMinutes ? `${(fullDish as any)?.cookTimeMin ?? fullDish?.cookMinutes} phút` : '15-30 phút'}
                    </span>
                  </div>
                </div>

                {/* Prep Time */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">Thời gian sơ chế</span>
                    <span className="text-xs font-bold text-foreground truncate block">
                      {(fullDish as any)?.prepTimeMin ?? fullDish?.prepMinutes ? `${(fullDish as any)?.prepTimeMin ?? fullDish?.prepMinutes} phút` : '10-15 phút'}
                    </span>
                  </div>
                </div>

                {/* Servings */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">Khẩu phần</span>
                    <span className="text-xs font-bold text-foreground truncate block">
                      {fullDish?.servings ? `${Number(fullDish.servings)} người ăn` : '1 người ăn'}
                    </span>
                  </div>
                </div>

                {/* Calories */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0">
                    <Flame size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">Năng lượng</span>
                    <span className="text-xs font-bold text-foreground truncate block">
                      {calories > 0 ? `${calories.toLocaleString()} kcal` : 'Chưa có calo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price & Cost Estimate */}
              {(fullDish?.priceMin || fullDish?.dineOutPriceMin) && (
                <div className="flex items-center gap-4 text-xs bg-muted/30 p-2.5 rounded-xl border border-border flex-wrap">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Coins size={14} className="text-amber-500" />
                    <span>Chi phí tự nấu:</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      {formatVnd(fullDish?.priceMin)} - {formatVnd(fullDish?.priceMax)}
                    </span>
                  </div>
                  {fullDish?.dineOutPriceMin && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span>• Ăn ngoài quán:</span>
                      <span className="font-semibold text-foreground">
                        {formatVnd(fullDish.dineOutPriceMin)} - {formatVnd(fullDish.dineOutPriceMax)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Primary Meal Slot, Categories, Diet & Goal Tags */}
              <div className="space-y-2 pt-1">
                {/* Meal slot & Categories */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-muted-foreground mr-1">Bữa ăn & Phân loại:</span>
                  {fullDish?.primaryMealSlot && (
                    <Badge variant="outline" className="text-[11px] font-medium bg-amber-500/10 border-amber-300 text-amber-800 dark:text-amber-300">
                      {MEAL_SLOT_LABELS[fullDish.primaryMealSlot] ?? fullDish.primaryMealSlot}
                    </Badge>
                  )}
                  {mealTypesList.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[11px]">
                      {m}
                    </Badge>
                  ))}
                  {categoriesList.map((c) => (
                    <Badge key={c} variant="outline" className="text-[11px]">
                      {c}
                    </Badge>
                  ))}
                </div>

                {/* Diet Types & Health Goals */}
                {(dietTypesList.length > 0 || dishGoalsList.length > 0) && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-muted-foreground mr-1">Chế độ & Mục tiêu:</span>
                    {dietTypesList.map((d) => (
                      <Badge key={d} variant="outline" className="text-[11px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <HeartHandshake size={11} className="mr-1" /> {d}
                      </Badge>
                    ))}
                    {dishGoalsList.map((g) => (
                      <Badge key={g} variant="outline" className="text-[11px] border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300">
                        <Activity size={11} className="mr-1" /> {g}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Flavor Tags */}
                {fullDish?.flavorTags && fullDish.flavorTags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-muted-foreground mr-1">Hương vị đặc trưng:</span>
                    {fullDish.flavorTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
                        {formatFlavorTag(tag)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Origin Story / Cultural History */}
              {fullDish?.originText && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-foreground/90 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-xs">
                    <BookOpen size={14} />
                    <span>Nguồn gốc & Lịch sử món ăn</span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    {fullDish.originText}
                  </p>
                </div>
              )}

              {/* Description */}
              {(fullDish?.shortDescription || fullDish?.fullDescription || fullDish?.description) && !fullDish?.originText && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {fullDish?.shortDescription ?? fullDish?.fullDescription ?? fullDish?.description}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Quality Readiness Checklist Bar ─────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Media */}
        <Card className="p-3.5 bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Hình ảnh tư liệu</span>
            {mediaList.length > 0 ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={16} className="text-rose-500" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">{mediaList.length}</span>
            <span className="text-xs text-muted-foreground">ảnh</span>
          </div>
          <span className={`text-[10px] font-semibold mt-0.5 block ${mediaList.length > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {mediaList.length > 0 ? 'Đã có ảnh đại diện' : 'Cần bổ sung ảnh'}
          </span>
        </Card>

        {/* Metric 2: Ingredients */}
        <Card className="p-3.5 bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Nguyên liệu cấu thành</span>
            {ingredients.length > 0 ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={16} className="text-rose-500" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">{ingredients.length}</span>
            <span className="text-xs text-muted-foreground">thành phần</span>
          </div>
          <span className={`text-[10px] font-semibold mt-0.5 block ${ingredients.length >= 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {ingredients.length >= 3 ? 'Định lượng đầy đủ' : 'Cần kiểm tra định lượng'}
          </span>
        </Card>

        {/* Metric 3: Recipe Steps */}
        <Card className="p-3.5 bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Quy trình thực hiện</span>
            {steps.length > 0 ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={16} className="text-rose-500" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">{steps.length}</span>
            <span className="text-xs text-muted-foreground">bước nấu</span>
          </div>
          <span className={`text-[10px] font-semibold mt-0.5 block ${steps.length >= 2 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {steps.length >= 2 ? 'Các bước rõ ràng' : 'Thiếu quy trình chế biến'}
          </span>
        </Card>

        {/* Metric 4: Nutrition Profile */}
        <Card className="p-3.5 bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Chỉ số calo & Macro</span>
            {calories > 0 ? (
              <CheckCircle2 size={16} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={16} className="text-rose-500" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground">
              {calories > 0 ? calories.toLocaleString() : '—'}
            </span>
            <span className="text-xs text-muted-foreground">kcal</span>
          </div>
          <span className={`text-[10px] font-semibold mt-0.5 block ${calories > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {calories > 0 ? 'Đã tính toán dinh dưỡng' : 'Chưa có thông số calo'}
          </span>
        </Card>
      </div>

      {/* ── Detailed Review Tabs ──────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="bg-muted/60 p-1 w-full justify-start h-10 overflow-x-auto">
          <TabsTrigger value="ingredients" className="gap-2 text-xs font-semibold">
            <Utensils size={14} className="text-emerald-500" />
            <span>Nguyên liệu & Dị ứng</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {ingredients.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="steps" className="gap-2 text-xs font-semibold">
            <Layers size={14} className="text-blue-500" />
            <span>Quy trình các bước nấu</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {steps.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="nutrition" className="gap-2 text-xs font-semibold">
            <Flame size={14} className="text-orange-500" />
            <span>Giá trị dinh dưỡng</span>
            {calories > 0 && (
              <Badge variant="success" className="text-[10px] h-5 px-1.5">
                {calories.toLocaleString()} kcal
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="evidence" className="gap-2 text-xs font-semibold">
            <Leaf size={14} className="text-amber-500" />
            <span>Bằng chứng & Nguồn</span>
            {unresolvedEvidences.length > 0 ? (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {unresolvedEvidences.length} cảnh báo
              </Badge>
            ) : (evidences.length > 0 || sources.length > 0) ? (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {evidences.length + sources.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Ingredients & Allergens ──────────────────── */}
        {activeTab === 'ingredients' && (
          <div className="space-y-4 pt-2">
            {/* Allergen Alert Box */}
            {allergenList.length > 0 && (
              <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-800 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
                  <AlertTriangle size={16} />
                  <span>Cảnh báo chất gây dị ứng tiềm ẩn ({allergenList.length} thành phần)</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {allergenList.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-1.5"
                    >
                      <span className="font-bold">{item.name}</span>
                      {item.code && <span className="font-mono text-[10px] opacity-75">({item.code})</span>}
                      {item.level && (
                        <span className="text-[10px] bg-rose-200 dark:bg-rose-800 px-1 rounded text-rose-950 dark:text-rose-100">
                          {item.level}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredients Table */}
            <Card className="overflow-hidden border border-border">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils size={17} className="text-emerald-500" />
                    <span>Danh sách nguyên liệu ({ingredients.length})</span>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    Định lượng chuẩn cho {Number(fullDish?.servings ?? 1)} phần ăn
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ingredients.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Utensils size={36} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs">Chưa có thông tin nguyên liệu nào cho món ăn này.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead className="min-w-[180px]">Tên nguyên liệu</TableHead>
                        <TableHead className="w-36">Định lượng</TableHead>
                        <TableHead className="w-36">Phân nhóm</TableHead>
                        <TableHead className="w-32">Dị ứng</TableHead>
                        <TableHead className="min-w-[160px]">Ghi chú sơ chế</TableHead>
                        <TableHead className="w-28 text-center">Thuộc tính</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ingredients.map((item, idx) => {
                        const ing = item.ingredient
                        return (
                          <TableRow key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                {ing?.imageUrl ? (
                                  <img
                                    src={ing.imageUrl}
                                    alt={ing.name}
                                    className="w-8 h-8 rounded-md object-cover border border-border shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                                    <Utensils size={12} className="opacity-40" />
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-xs text-foreground block">
                                    {ing?.name ?? item.ingredientName}
                                  </span>
                                  {ing?.nameEn && (
                                    <span className="text-[10px] text-muted-foreground block">
                                      {ing.nameEn}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="font-semibold text-xs text-foreground">
                              {item.amount ?? item.quantity ? `${item.amount ?? item.quantity} ${item.unit ?? ing?.unit ?? ''}` : 'Vừa đủ'}
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              <span className="bg-muted/60 px-2 py-0.5 rounded text-[11px] font-medium text-foreground/80">
                                {ing?.groupLabel ?? 'Thành phần chung'}
                              </span>
                            </TableCell>

                            <TableCell>
                              {ing?.allergenCode ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                                  {formatAllergen(ing.allergenCode)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-xs text-muted-foreground">
                              {item.notes ? (
                                <span className="italic">{item.notes}</span>
                              ) : (
                                <span className="text-muted-foreground/80">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {item.isOptional ? (
                                <Badge variant="secondary" className="text-[10px]">Tùy chọn</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300">
                                  Bắt buộc
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab 2: Recipe Steps ─────────────────────────────── */}
        {activeTab === 'steps' && (
          <div className="space-y-4 pt-2">
            <Card className="border border-border">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={17} className="text-blue-500" />
                    <span>Hướng dẫn các bước nấu ({steps.length} bước)</span>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    Theo thứ tự sơ chế và nấu chuẩn
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {steps.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Layers size={36} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs">Chưa có hướng dẫn các bước nấu cho món này.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {steps.map((step, idx) => {
                      const duration = step.durationMin ?? step.durationMinutes
                      const img = step.imageUrl ?? step.mediaUrl
                      const rawInstruction = step.instruction ?? step.description
                      const { title, body } = parseStepInstruction(rawInstruction, step.title || `Bước ${step.stepOrder || idx + 1}`)

                      return (
                        <div
                          key={step.id || idx}
                          className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-amber-400/60 transition-colors shadow-2xs"
                        >
                          <div className="shrink-0 flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                              {step.stepOrder || idx + 1}
                            </div>
                            {idx < steps.length - 1 && (
                              <div className="w-0.5 h-full bg-border my-2 min-h-[30px]" />
                            )}
                          </div>

                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-foreground">
                                {title}
                              </h4>
                              {duration != null && duration > 0 && (
                                <Badge variant="outline" className="text-[11px] gap-1 text-muted-foreground font-normal">
                                  <Clock size={11} /> {duration} phút
                                </Badge>
                              )}
                            </div>

                            {body && (
                              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                                {body}
                              </p>
                            )}

                            {step.tip && (
                              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-foreground/80 flex items-start gap-2">
                                <Lightbulb size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="leading-snug">
                                  <span className="font-bold text-amber-700 dark:text-amber-400 mr-1">Mẹo đầu bếp:</span>
                                  {step.tip}
                                </div>
                              </div>
                            )}

                            {img && (
                              <div className="mt-2 w-40 h-24 rounded-lg overflow-hidden border border-border">
                                <img src={img} alt={title} className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab 3: Nutrition Profile ────────────────────────── */}
        {activeTab === 'nutrition' && (
          <div className="space-y-4 pt-2">
            <Card className="border border-border">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame size={17} className="text-orange-500" />
                    <span>Hồ sơ giá trị dinh dưỡng chi tiết</span>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    Cơ sở: {NUTRITION_BASIS_LABELS[nutrition?.basis || 'PER_SERVING'] ?? nutrition?.basis ?? '1 khẩu phần chuẩn'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-6">
                {!nutrition ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Flame size={36} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs">Chưa có thông số dinh dưỡng được phân tích cho món ăn này.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Tổng mức năng lượng calo</span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">
                            {calories > 0 ? calories.toLocaleString() : 'Chưa có'}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">kcal / khẩu phần</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-1.5">
                        <Badge variant="outline" className="px-3 py-1 text-xs bg-card border-border">
                          Phương pháp: <span className="font-bold ml-1">{NUTRITION_METHOD_LABELS[nutrition.method || ''] ?? nutrition.method ?? 'AI Estimator'}</span>
                        </Badge>
                        {nutrition.confidence && (
                          <span className="text-[11px] text-muted-foreground">
                            Độ tin cậy tính toán: <b className="text-foreground">{nutrition.confidence}%</b>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { label: 'Chất đạm (Protein)', val: protein, unit: 'g', color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20', note: 'Xây dựng tế bào & cơ bắp' },
                        { label: 'Chất bột đường (Carb)', val: carbs, unit: 'g', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20', note: 'Nguồn năng lượng chính' },
                        { label: 'Chất béo (Lipid / Fat)', val: fat, unit: 'g', color: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/20', note: 'Hấp thu vitamin A, D, E' },
                        { label: 'Chất xơ (Dietary Fiber)', val: fiber, unit: 'g', color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', note: 'Tốt cho hệ vi sinh tiêu hóa' },
                        { label: 'Muối / Natri (Sodium)', val: sodium, unit: 'mg', color: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20', note: 'Cân bằng điện giải' },
                      ].map((macro) => (
                        <div key={macro.label} className={`p-4 rounded-xl border ${macro.border} ${macro.bg} text-center space-y-1`}>
                          <span className="text-xs text-muted-foreground block font-medium">{macro.label}</span>
                          <div className={`text-2xl font-extrabold ${macro.color}`}>
                            {macro.val !== null && macro.val !== undefined && macro.val > 0 ? macro.val : '?'}
                            <span className="text-xs font-normal text-muted-foreground ml-0.5">{macro.unit}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/80 block">{macro.note}</span>
                        </div>
                      ))}
                    </div>

                    {totalMacroCal > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                          <span>Tỷ lệ phân bổ năng lượng Macro (% Calo)</span>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500" /> Đạm ({proteinPct}%)
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500" /> Đường bột ({carbsPct}%)
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-rose-500" /> Béo ({fatPct}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted">
                          <div
                            className="bg-blue-500 h-full transition-all"
                            style={{ width: `${proteinPct}%` }}
                          />
                          <div
                            className="bg-amber-500 h-full transition-all"
                            style={{ width: `${carbsPct}%` }}
                          />
                          <div
                            className="bg-rose-500 h-full transition-all"
                            style={{ width: `${fatPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {nutrition.sourceUrl && (
                      <div className="pt-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Globe2 size={13} className="text-amber-500" />
                        <span>Nguồn dữ liệu kiểm chứng dinh dưỡng:</span>
                        <a
                          href={nutrition.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          {nutrition.sourceUrl} <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tab 4: Evidences & Sources ──────────────────────── */}
        {activeTab === 'evidence' && (
          <div className="space-y-4 pt-2">
            <Card className="border border-border overflow-hidden">
              <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Leaf size={17} className="text-emerald-500" />
                    <span>Bằng chứng trích xuất & Đối chiếu dữ liệu ({evidences.length})</span>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    Các trường thông tin được trích xuất tự động qua AI / crawler
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {evidences.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <Leaf size={32} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs">Không có bằng chứng hoặc xung đột dữ liệu cần giải quyết.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-36">Trường</TableHead>
                        <TableHead>Giá trị trích xuất</TableHead>
                        <TableHead className="w-36">Nguồn</TableHead>
                        <TableHead className="w-28 text-center">Độ tin cậy</TableHead>
                        <TableHead className="w-36 text-right">Hành động</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evidences.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {ev.field}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground">
                            {ev.value}
                          </TableCell>
                          <TableCell className="text-xs">
                            {ev.sourceUrl ? (
                              <a
                                href={ev.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-600 hover:underline flex items-center gap-1"
                              >
                                <Globe2 size={12} /> Xem nguồn
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={ev.confidence >= 80 ? 'success' : 'warning'}
                              className="text-[10px]"
                            >
                              {ev.confidence}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!ev.isResolved ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => actions.resolveEvidence.mutate({ dishId: dish.id, evidenceId: ev.id, accepted: true })}
                                  disabled={actions.resolveEvidence.isPending}
                                >
                                  <Check size={12} className="mr-1" /> Duyệt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => actions.resolveEvidence.mutate({ dishId: dish.id, evidenceId: ev.id, accepted: false })}
                                  disabled={actions.resolveEvidence.isPending}
                                >
                                  Bỏ qua
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                Đã giải quyết
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {sources.length > 0 && (
              <Card className="border border-border">
                <CardHeader className="pb-3 bg-muted/20">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Globe2 size={16} className="text-blue-500" />
                    <span>Nguồn tài liệu tham khảo ({sources.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {sources.map((s, idx) => (
                    <div key={s.id || idx} className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between text-xs gap-3">
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground truncate block">
                          {s.title || s.domain || 'Nguồn công thức'}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {s.author && <span>Tác giả: {s.author} •</span>}
                          {s.sourceType && <span>Loại: {s.sourceType} •</span>}
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-amber-600 hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink size={10} /> {s.url}
                          </a>
                        </div>
                      </div>
                      {s.reliability != null && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {s.reliability}% tin cậy
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </Tabs>

      {/* ── Sticky Bottom Actions Bar ── */}
      <div className="sticky bottom-4 z-20 bg-card/95 backdrop-blur-md border border-border rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-border bg-muted shrink-0 hidden sm:block">
            {activeMedia?.publicUrl ? (
              <img src={activeMedia.publicUrl} alt={currentDish.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Utensils size={14} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-foreground block truncate">
              {currentDish.name}
            </span>
            <span className="text-[11px] text-muted-foreground block truncate">
              {ingredients.length} nguyên liệu • {steps.length} bước nấu • {calories > 0 ? `${calories.toLocaleString()} kcal` : 'Chưa có calo'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          <Button variant="outline" size="sm" onClick={() => setShowRequestChanges(true)}>
            Yêu cầu sửa
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setShowReject(true)}>
            Từ chối
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm px-4"
            onClick={() => setShowApprove(true)}
            disabled={actions.approve.isPending}
          >
            <CheckCircle2 size={16} />
            {actions.approve.isPending ? 'Đang duyệt...' : 'Duyệt & Xuất bản món'}
          </Button>
        </div>
      </div>

      {/* ── Dialogs: Approve Confirmation ────────────────────── */}
      <AlertDialog open={showApprove} onOpenChange={setShowApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              Duyệt và xuất bản món ăn?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Món “<span className="font-bold text-foreground">{currentDish.name}</span>” sẽ được cập nhật trạng thái hoạt động chính thức và hiển thị công khai cho toàn bộ người dùng ứng dụng di động NOAN.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.approve.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApprove}
              disabled={actions.approve.isPending}
            >
              {actions.approve.isPending ? 'Đang duyệt…' : 'Xác nhận duyệt & xuất bản'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialogs: Request Changes ─────────────────────────── */}
      {showRequestChanges && (
        <ReviewActionDialog
          title="Yêu cầu chỉnh sửa món ăn"
          isPending={actions.requestChanges.isPending}
          onClose={() => setShowRequestChanges(false)}
          onConfirm={(reasonCode, note) => {
            actions.requestChanges.mutate({ dishId: dish.id, reasonCode, note })
            setShowRequestChanges(false)
            onBack()
          }}
        />
      )}

      {/* ── Dialogs: Reject ──────────────────────────────────── */}
      {showReject && (
        <ReviewActionDialog
          title="Từ chối duyệt món ăn"
          isPending={actions.reject.isPending}
          onClose={() => setShowReject(false)}
          onConfirm={(reasonCode, note) => {
            actions.reject.mutate({ dishId: dish.id, reasonCode, note })
            setShowReject(false)
            onBack()
          }}
        />
      )}
    </div>
  )
}
