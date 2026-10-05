import { useEffect, useMemo, useState } from 'react'
import { Select } from '../components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Textarea } from '../components/ui/textarea'
import { Input } from '../components/ui/input'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  Coins,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe2,
  HeartHandshake,
  Layers,
  LayoutGrid,
  Leaf,
  Lightbulb,
  List,
  MapPin,
  MessageCircle,
  MoreVertical,
  PlayCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
  Utensils,
  XCircle,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { TableSkeleton } from '../components/ui/page-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Image } from '../components/ui/image'
import { Label } from '../components/ui/label'
import { useReviewActions, useReviewQueue } from '../hooks/useReviewQueue'
import { useAdminDish } from '../hooks/useDishes'
import type { ReviewQueueItem, ReviewReasonCode } from '../types'
import { reviewsAdminApi, type CommunityReview } from '../api/reviews'

// ─── Helpers & Options ────────────────────────────────────────────────────────

const REASON_OPTIONS: { value: ReviewReasonCode; label: string }[] = [
  { value: 'INSUFFICIENT_SOURCE', label: 'Thiếu nguồn tham khảo' },
  { value: 'CONFLICTING_DATA', label: 'Dữ liệu mâu thuẫn' },
  { value: 'WRONG_DISH', label: 'Sai món ăn' },
  { value: 'NUTRITION_RISK', label: 'Rủi ro dinh dưỡng' },
  { value: 'ALLERGEN_RISK', label: 'Rủi ro dị ứng' },
  { value: 'COPYRIGHT_RISK', label: 'Vấn đề bản quyền' },
  { value: 'DUPLICATE', label: 'Món trùng lặp' },
  { value: 'CONTENT_QUALITY', label: 'Chất lượng nội dung kém' },
]

function getConfidenceMeta(score?: number) {
  if (score === undefined || score === null) {
    return {
      label: 'Chờ đánh giá',
      variant: 'secondary' as const,
      colorClass: 'text-muted-foreground bg-muted border-border',
      barColor: 'bg-muted-foreground/30',
      icon: Clock,
      pct: 0,
    }
  }
  if (score >= 80) {
    return {
      label: `${score}% Tin cậy`,
      variant: 'success' as const,
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      barColor: 'bg-emerald-500',
      icon: CheckCircle2,
      pct: score,
    }
  }
  if (score >= 60) {
    return {
      label: `${score}% Khá tốt`,
      variant: 'warning' as const,
      colorClass: 'text-amber-800 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      barColor: 'bg-amber-500',
      icon: Sparkles,
      pct: score,
    }
  }
  return {
    label: `${score}% Cần lưu ý`,
    variant: 'destructive' as const,
    colorClass: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    barColor: 'bg-rose-500',
    icon: AlertTriangle,
    pct: score,
  }
}

// ─── Action Dialog ────────────────────────────────────────────────────────────

function ActionDialog({
  title,
  onConfirm,
  onClose,
  isPending,
}: {
  title: string
  onConfirm: (reasonCode: ReviewReasonCode, note: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const [reasonCode, setReasonCode] = useState<ReviewReasonCode>('CONTENT_QUALITY')
  const [note, setNote] = useState('')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Chọn lý do và nhập ghi chú hướng dẫn để đội ngũ biên tập điều chỉnh dữ liệu món ăn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Lý do kiểm duyệt *</Label>
            <Select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReviewReasonCode)}
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ghi chú bổ sung (tùy chọn)</Label>
            <Textarea
              placeholder="Nhập ghi chú chi tiết phản hồi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reasonCode, note)}
            disabled={isPending}
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatVnd(val?: number | null) {
  if (val === undefined || val === null || val === 0) return null
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val)
}

function getDifficultyMeta(diff?: string | null) {
  switch (diff) {
    case 'EASY':
      return { label: 'Dễ làm', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' }
    case 'MEDIUM':
      return { label: 'Trung bình', colorClass: 'text-amber-800 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' }
    case 'HARD':
      return { label: 'Cầu kỳ / Khó', colorClass: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' }
    default:
      return { label: 'Tiêu chuẩn', colorClass: 'text-muted-foreground bg-muted border-border' }
  }
}

const FLAVOR_TAG_LABELS: Record<string, string> = {
  DAM_DA: 'Đậm đà',
  CHUA: 'Chua thanh',
  BEO: 'Béo ngậy',
  NGUYEN_BAN: 'Nguyên bản',
  CAY: 'Cay nồng',
  NGOT: 'Ngọt thanh',
  MAN: 'Mặn mà',
  THANH_DAM: 'Thanh đạm',
  THOM: 'Thơm nồng',
  GION: 'Giòn sần sật',
  CHUA_CAY: 'Chua cay',
  CHUA_NGOT: 'Chua ngọt',
  NGU_VI: 'Ngũ vị',
  DANG: 'Đắng nhẹ',
  THANH_MAT: 'Thanh mát',
}

function formatFlavorTag(tag: string): string {
  const upper = tag.toUpperCase().trim()
  return FLAVOR_TAG_LABELS[upper] ?? tag.replace(/_/g, ' ')
}

const MEAL_SLOT_LABELS: Record<string, string> = {
  BREAKFAST: 'Bữa sáng',
  LUNCH: 'Bữa trưa',
  DINNER: 'Bữa tối',
  SNACK: 'Ăn vặt / Ăn nhẹ',
  LATE_NIGHT: 'Ăn khuya',
  ANYTIME: 'Mọi thời điểm',
}

const DISH_TYPE_LABELS: Record<string, string> = {
  SOUP: 'Món nước / Canh / Súp',
  NOODLE: 'Bún / Phở / Mì / Miến',
  RICE: 'Cơm / Xôi',
  DRY: 'Món khô / Món mặn',
  SALAD: 'Nộm / Gỏi / Salad',
  DESSERT: 'Tráng miệng / Chè',
  DRINK: 'Thức uống',
  SNACK: 'Khai vị / Ăn vặt',
}

const NUTRITION_BASIS_LABELS: Record<string, string> = {
  PER_SERVING: '1 khẩu phần chuẩn',
  PER_100G: '100g thực phẩm',
  WHOLE_RECIPE: 'Toàn bộ công thức',
}

const NUTRITION_METHOD_LABELS: Record<string, string> = {
  AI_ESTIMATED: 'AI phân tích & ước lượng',
  INGREDIENT_CALCULATED: 'Tính từ định lượng nguyên liệu',
  SOURCE_VERIFIED: 'Đối chiếu viện / tài liệu kiểm chứng',
}

function parseStepInstruction(instruction?: string, fallbackTitle?: string) {
  if (!instruction) return { title: fallbackTitle || '', body: '' }
  const lines = instruction.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { title: fallbackTitle || '', body: '' }
  if (lines.length === 1) {
    return { title: fallbackTitle || '', body: lines[0] }
  }
  return {
    title: lines[0],
    body: lines.slice(1).join('\n'),
  }
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ReviewDetail({
  dish,
  onBack,
}: {
  dish: ReviewQueueItem
  onBack: () => void
}) {
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

  // Allergen items detection (combine official dishAllergens and ingredient allergen codes)
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
          name: ing.ingredient?.name ?? ing.ingredientName ?? 'Chất gây dị ứng',
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
                {fullDish?.alternateNames && fullDish.alternateNames.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tên gọi khác / Tên quốc tế:{' '}
                    <span className="font-semibold text-foreground/90">
                      {fullDish.alternateNames.join(', ')}
                    </span>
                  </p>
                )}
              </div>

              {/* Meta Attribute Pills Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {/* Region & Province */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">Vùng miền</span>
                    <span className="text-xs font-bold text-foreground truncate block">
                      {currentDish.region?.name ?? 'Món Việt'}
                      {fullDish?.province?.name && ` • ${fullDish.province.name}`}
                    </span>
                  </div>
                </div>

                {/* Cook & Prep Time */}
                <div className="p-2.5 rounded-xl border border-border bg-muted/20 flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block">Thời gian nấu</span>
                    <span className="text-xs font-bold text-foreground truncate block">
                      {fullDish?.cookMinutes || fullDish?.prepMinutes
                        ? `${(fullDish.prepMinutes ?? 0) + (fullDish.cookMinutes ?? 0)} phút`
                        : 'Tiêu chuẩn'}
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
                      {fullDish?.servings ? `${Number(fullDish.servings)} người ăn` : '4 người ăn'}
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

                {/* Flavor Tags translated nicely */}
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
                    Định lượng chuẩn cho {Number(fullDish?.servings ?? 4)} phần ăn
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
                            {/* Index */}
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>

                            {/* Name & Thumbnail */}
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

                            {/* Amount & Unit */}
                            <TableCell className="font-semibold text-xs text-foreground">
                              {item.amount ?? item.quantity ? `${item.amount ?? item.quantity} ${item.unit ?? ing?.unit ?? ''}` : 'Vừa đủ'}
                            </TableCell>

                            {/* Group label */}
                            <TableCell className="text-xs text-muted-foreground">
                              <span className="bg-muted/60 px-2 py-0.5 rounded text-[11px] font-medium text-foreground/80">
                                {ing?.groupLabel ?? 'Thành phần chung'}
                              </span>
                            </TableCell>

                            {/* Allergen */}
                            <TableCell>
                              {ing?.allergenCode ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                                  {ing.allergenCode}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>

                            {/* Notes */}
                            <TableCell className="text-xs text-muted-foreground">
                              {item.notes ? (
                                <span className="italic">{item.notes}</span>
                              ) : (
                                <span className="text-muted-foreground/60">—</span>
                              )}
                            </TableCell>

                            {/* Optional / Required */}
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
                          {/* Step number badge */}
                          <div className="shrink-0 flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                              {step.stepOrder || idx + 1}
                            </div>
                            {idx < steps.length - 1 && (
                              <div className="w-0.5 h-full bg-border my-2 min-h-[30px]" />
                            )}
                          </div>

                          {/* Step content */}
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

                            {/* Tip / Chef note callout */}
                            {step.tip && (
                              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-foreground/80 flex items-start gap-2">
                                <Lightbulb size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="leading-snug">
                                  <span className="font-bold text-amber-700 dark:text-amber-400 mr-1">Mẹo đầu bếp:</span>
                                  {step.tip}
                                </div>
                              </div>
                            )}

                            {/* Step image */}
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
                    <span>Hồ sơ định lượng dinh dưỡng (Nutrition Facts)</span>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    Theo chuẩn phân tích dinh dưỡng món ăn Việt Nam
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-6">
                {!nutrition ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Flame size={36} className="mx-auto opacity-30 mb-2" />
                    <p className="text-xs">Chưa có thông số dinh dưỡng được lập cho món này.</p>
                  </div>
                ) : (
                  <>
                    {/* Big Calories Banner */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider block">
                          Tổng năng lượng mỗi khẩu phần
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-extrabold text-foreground">
                            {calories > 0 ? calories.toLocaleString() : '—'}
                          </span>
                          <span className="text-sm font-bold text-muted-foreground">kcal / phần</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                          {nutrition.servingName && (
                            <span className="font-semibold text-foreground">
                              Đơn vị: {nutrition.servingName}
                            </span>
                          )}
                          {nutrition.servingG && (
                            <span>• Trọng lượng: {nutrition.servingG}g</span>
                          )}
                          {nutrition.basis && (
                            <span>• Quy chuẩn: {NUTRITION_BASIS_LABELS[nutrition.basis] ?? nutrition.basis}</span>
                          )}
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

                    {/* 5 Macro & Micronutrient Cards */}
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

                    {/* Macronutrient Distribution Bar */}
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

                    {/* Source reference URL if any */}
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
            {/* Field Evidences */}
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

            {/* External Sources */}
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

      {/* ── Sticky Bottom Actions Bar (Inside container, no screen overflow) ── */}
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
              Món “<span className="font-bold text-foreground">{currentDish.name}</span>” sẽ được cập nhật trạng thái hoạt động chính thức và hiển thị công khai cho toàn bộ người dùng ứng dụng di động Mogu.
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
        <ActionDialog
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
        <ActionDialog
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

// ─── Community Reviews Tab ────────────────────────────────────────────────────

function CommunityReviewsTab() {
  const [reviews, setReviews] = useState<CommunityReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommunityReview | null>(null)
  const limit = 20

  const loadReviews = async (pg = 1) => {
    setLoading(true)
    try {
      const isVisible = filter === 'all' ? undefined : filter === 'visible' ? true : false
      const res = await reviewsAdminApi.list({ page: pg, limit, isVisible })
      setReviews(res.data)
      setTotal(res.total)
      setPage(pg)
    } catch {
      // handle error silently
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReviews(1) }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleHide = async (review: CommunityReview, isVisible: boolean) => {
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.hide(review.id, isVisible)
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, isVisible } : r))
    } catch {
      alert(isVisible ? 'Không thể hiện lại review' : 'Không thể ẩn review')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const review = deleteTarget
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.delete(review.id)
      setReviews(prev => prev.filter(r => r.id !== review.id))
      setTotal(t => t - 1)
      setDeleteTarget(null)
    } catch {
      alert('Không thể xóa review')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={(val) => setFilter(val as typeof filter)}>
          <TabsList className="bg-muted/60 p-1 h-9">
            {(['all', 'visible', 'hidden'] as const).map((f) => (
              <TabsTrigger
                key={f}
                value={f}
                className="px-3 py-1 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                {f === 'all' ? 'Tất cả đánh giá' : f === 'visible' ? 'Hiển thị' : 'Đã ẩn'}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Đang tải...' : `Tổng cộng ${total} đánh giá`}
        </span>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <MessageCircle size={36} className="mx-auto opacity-30 mb-2" />
            <p className="text-xs">Không có đánh giá cộng đồng nào</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="min-w-[140px]">Món ăn</TableHead>
                <TableHead className="min-w-[120px]">Người dùng</TableHead>
                <TableHead className="text-center w-28">Đánh giá sao</TableHead>
                <TableHead className="min-w-[200px]">Nội dung nhận xét</TableHead>
                <TableHead className="text-center w-28">Trạng thái</TableHead>
                <TableHead className="text-center w-28">Ngày gửi</TableHead>
                <TableHead className="text-right w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map(review => (
                <TableRow key={review.id} className={`hover:bg-muted/30 transition-colors ${!review.isVisible ? 'opacity-60' : ''}`}>
                  <TableCell>
                    <div className="font-semibold text-xs text-foreground">
                      {review.dish?.name ?? <span className="text-muted-foreground">—</span>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">#{review.dishId.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {review.profile?.displayName ?? <span className="text-muted-foreground">Ẩn danh</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star
                          key={i}
                          size={11}
                          fill={i <= review.rating ? '#f59e0b' : 'none'}
                          color={i <= review.rating ? '#f59e0b' : '#d4d4d8'}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1.5">{review.rating}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {review.comment ? (
                      <span className="text-xs text-foreground line-clamp-2" title={review.comment}>
                        {review.comment}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {review.isVisible ? (
                      <Badge variant="success" className="text-[10px] flex items-center gap-1 w-fit mx-auto">
                        <Eye size={10} /> Hiển thị
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] flex items-center gap-1 w-fit mx-auto">
                        <EyeOff size={10} /> Đã ẩn
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {review.isVisible ? (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleHide(review, false)}
                          disabled={actionLoading === review.id}
                          title="Ẩn đánh giá"
                        >
                          <EyeOff size={12} />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => handleToggleHide(review, true)}
                          disabled={actionLoading === review.id}
                          title="Hiện lại đánh giá"
                        >
                          <Eye size={12} />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => setDeleteTarget(review)}
                        disabled={actionLoading === review.id}
                        title="Xóa đánh giá"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => loadReviews(page - 1)} disabled={page === 1}>
            ← Trước
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Trang {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => loadReviews(page + 1)} disabled={page >= totalPages}>
            Tiếp →
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đánh giá này?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.comment?.slice(0, 160) || 'Đánh giá sẽ bị xóa vĩnh viễn.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!actionLoading}>
              {actionLoading ? 'Đang xóa…' : 'Xóa đánh giá'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Main ReviewPage ──────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { data, isLoading } = useReviewQueue({ limit: 50 })
  const actions = useReviewActions()

  const [selected, setSelected] = useState<ReviewQueueItem | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'community'>('content')

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [qualityFilter, setQualityFilter] = useState<'ALL' | 'READY' | 'NEEDS_WORK'>('ALL')
  const [sortBy, setSortBy] = useState<'NEWEST' | 'SCORE_DESC' | 'SCORE_ASC' | 'NAME'>('NEWEST')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Quick Action State
  const [quickApproveItem, setQuickApproveItem] = useState<ReviewQueueItem | null>(null)
  const [quickRejectItem, setQuickRejectItem] = useState<ReviewQueueItem | null>(null)
  const [quickRequestChangesItem, setQuickRequestChangesItem] = useState<ReviewQueueItem | null>(null)

  const items = data?.data ?? []
  const total = data?.total ?? items.length

  // Calculate metrics
  const metrics = useMemo(() => {
    let readyCount = 0
    let needsWorkCount = 0
    let totalScore = 0

    items.forEach((item) => {
      const score = item.confidenceScore ?? 0
      totalScore += score
      if (score >= 80) readyCount++
      else needsWorkCount++
    })

    const avgScore = items.length > 0 ? Math.round(totalScore / items.length) : 0

    return {
      readyCount,
      needsWorkCount,
      avgScore,
    }
  }, [items])

  // Extract regions for filter
  const availableRegions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      if (item.region?.id && item.region?.name) {
        map.set(item.region.id, item.region.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...items]

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.region?.name?.toLowerCase().includes(q)
      )
    }

    // Region filter
    if (regionFilter !== 'ALL') {
      result = result.filter((item) => item.region?.id === regionFilter)
    }

    // Quality filter
    if (qualityFilter === 'READY') {
      result = result.filter((item) => (item.confidenceScore ?? 0) >= 80)
    } else if (qualityFilter === 'NEEDS_WORK') {
      result = result.filter((item) => (item.confidenceScore ?? 0) < 80)
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'SCORE_DESC') {
        return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0)
      }
      if (sortBy === 'SCORE_ASC') {
        return (a.confidenceScore ?? 0) - (b.confidenceScore ?? 0)
      }
      if (sortBy === 'NAME') {
        return a.name.localeCompare(b.name, 'vi')
      }
      // Default NEWEST
      return 0
    })

    return result
  }, [items, searchTerm, regionFilter, qualityFilter, sortBy])

  // Handlers
  const handleConfirmQuickApprove = async () => {
    if (!quickApproveItem) return
    await actions.approve.mutateAsync(quickApproveItem.id)
    setQuickApproveItem(null)
  }

  if (selected) {
    return <ReviewDetail dish={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <ShieldCheck size={16} />
            <span>Vận hành & Kiểm duyệt nội dung</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl mt-1">
            Hàng đợi kiểm duyệt
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rà soát đối chiếu hình ảnh, định lượng nguyên liệu, dinh dưỡng và phê duyệt món ăn xuất bản.
          </p>
        </div>

        {/* Global actions or status indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-xs gap-1.5 font-medium border-amber-300 dark:border-amber-700 bg-amber-500/10 text-amber-800 dark:text-amber-300">
            <Clock size={13} className="text-amber-500" />
            Tự động cập nhật mỗi 30s
          </Badge>
        </div>
      </div>

      {/* ── KPI Metrics Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Total Waiting */}
        <Card className="p-4 bg-card hover:border-amber-400/50 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Chờ duyệt trong hàng đợi</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">
            {isLoading ? '...' : total}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Món ăn đang chờ rà soát
          </p>
        </Card>

        {/* Card 2: Ready to Approve */}
        <Card className="p-4 bg-card hover:border-emerald-400/50 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Đủ điều kiện xuất bản</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {isLoading ? '...' : metrics.readyCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Điểm tin cậy cao (≥80%)
          </p>
        </Card>

        {/* Card 3: Needs Work */}
        <Card className="p-4 bg-card hover:border-rose-400/50 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Cần hoàn thiện / Lưu ý</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {isLoading ? '...' : metrics.needsWorkCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Thiếu ảnh hoặc calo (&lt;80%)
          </p>
        </Card>

        {/* Card 4: Average Quality */}
        <Card className="p-4 bg-card hover:border-blue-400/50 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Chất lượng trung bình</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-foreground">
              {isLoading ? '...' : `${metrics.avgScore}%`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics.avgScore}%` }}
            />
          </div>
        </Card>
      </div>

      {/* ── Main Tab Switcher ───────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <span>Kiểm duyệt nội dung món</span>
            {total > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                {total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="community" className="flex items-center gap-2">
            <MessageCircle size={14} />
            <span>Đánh giá & Phản hồi cộng đồng</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Tab Content: Content Review ─────────────────────────── */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          {/* Toolbar: Search, Filters & View Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2.5 flex-1 flex-wrap">
              {/* Search input */}
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên món, mã #id, vùng miền..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Region filter */}
              <Select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="h-9 text-xs w-36"
              >
                <option value="ALL">Tất cả vùng miền</option>
                {availableRegions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>

              {/* Quality filter */}
              <Select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value as any)}
                className="h-9 text-xs w-44"
              >
                <option value="ALL">Tất cả độ hoàn thiện</option>
                <option value="READY">Đủ chuẩn duyệt (≥80%)</option>
                <option value="NEEDS_WORK">Cần bổ sung (&lt;80%)</option>
              </Select>

              {/* Sort by */}
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 text-xs w-36"
              >
                <option value="NEWEST">Mới nhất</option>
                <option value="SCORE_DESC">Điểm cao nhất</option>
                <option value="SCORE_ASC">Cần lưu ý trước</option>
                <option value="NAME">Tên A-Z</option>
              </Select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border-l border-border pl-3 self-end sm:self-auto">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
                title="Dạng thẻ trực quan"
              >
                <LayoutGrid size={15} />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('table')}
                title="Dạng bảng đối chiếu"
              >
                <List size={15} />
              </Button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <Card>
              <CardContent className="p-4">
                <TableSkeleton rows={5} cols={4} />
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isLoading && filteredItems.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500 opacity-60 mb-3" />
                <div className="font-bold text-foreground text-base">
                  {searchTerm || regionFilter !== 'ALL' || qualityFilter !== 'ALL'
                    ? 'Không tìm thấy món ăn phù hợp với bộ lọc'
                    : 'Hàng đợi kiểm duyệt trống'}
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchTerm || regionFilter !== 'ALL' || qualityFilter !== 'ALL'
                    ? 'Hãy thử thay đổi từ khóa hoặc điều chỉnh lại các điều kiện lọc phía trên.'
                    : 'Tất cả món ăn đã được kiểm duyệt và xuất bản hoàn tất! Các món mới do người dùng hoặc AI tạo sẽ hiển thị tại đây.'}
                </p>
                {(searchTerm || regionFilter !== 'ALL' || qualityFilter !== 'ALL') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-xs"
                    onClick={() => {
                      setSearchTerm('')
                      setRegionFilter('ALL')
                      setQualityFilter('ALL')
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Mode 1: Grid Cards View ─────────────────────────────── */}
          {!isLoading && filteredItems.length > 0 && viewMode === 'grid' && (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const primaryMedia = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]
                const nutrition = item.nutritionProfiles?.[0]
                const meta = getConfidenceMeta(item.confidenceScore)
                const MetaIcon = meta.icon
                const unresolvedCount = item.fieldEvidences?.filter((e) => !e.isResolved).length ?? 0

                return (
                  <Card
                    key={item.id}
                    className="group border border-border hover:border-amber-400/80 hover:shadow-md transition-all duration-200 bg-card overflow-hidden"
                  >
                    <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Thumbnail & Core info */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Thumbnail */}
                        <div
                          className="relative shrink-0 rounded-xl overflow-hidden border border-border shadow-xs bg-muted/30 w-18 h-18 sm:w-20 sm:h-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {primaryMedia?.publicUrl ? (
                            <Image
                              src={primaryMedia.publicUrl}
                              alt={item.name}
                              aspectRatio="square"
                              zoomable
                              title={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
                              <Utensils size={22} className="opacity-40" />
                              <span className="text-[9px] mt-1 font-medium">Chưa có ảnh</span>
                            </div>
                          )}
                          {item.media && item.media.length > 1 && (
                            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                              +{item.media.length - 1}
                            </span>
                          )}
                        </div>

                        {/* Title, Badges & Meta */}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          {/* Top row: Name & Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-bold text-base text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer truncate"
                              onClick={() => setSelected(item)}
                            >
                              {item.name}
                            </span>

                            {/* Status badge */}
                            <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                              Chờ duyệt
                            </Badge>

                            {/* Readiness / Confidence score badge */}
                            <Badge
                              variant={meta.variant}
                              className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${meta.colorClass}`}
                            >
                              <MetaIcon size={11} />
                              {meta.label}
                            </Badge>

                            {/* Warnings count badge if any */}
                            {unresolvedCount > 0 && (
                              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 flex items-center gap-1">
                                <AlertTriangle size={11} />
                                {unresolvedCount} cảnh báo
                              </Badge>
                            )}
                          </div>

                          {/* Middle row: Metadata tags */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {/* Code ID */}
                            <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded text-foreground/80">
                              #{item.id.slice(0, 8)}
                            </span>

                            {/* Region */}
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-amber-600" />
                              {item.region?.name ?? 'Món Việt'}
                            </span>

                            {/* Calories */}
                            <span className="flex items-center gap-1">
                              <Flame size={12} className="text-orange-500" />
                              {nutrition?.calories ? `${Number(nutrition.calories).toLocaleString()} kcal` : 'Chưa có calo'}
                            </span>

                            {/* Ingredients count */}
                            <span className="flex items-center gap-1">
                              <Utensils size={12} className="text-emerald-600" />
                              {item._count?.ingredients ?? 0} nguyên liệu
                            </span>

                            {/* Steps count */}
                            <span className="flex items-center gap-1">
                              <Layers size={12} className="text-blue-500" />
                              {item._count?.steps ?? 0} bước nấu
                            </span>
                          </div>

                          {/* Mini Progress Indicator */}
                          <div className="flex items-center gap-2 max-w-xs pt-0.5">
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${meta.barColor}`}
                                style={{ width: `${meta.pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {meta.pct}% hoàn chỉnh
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border justify-end">
                        {/* Quick Approve button */}
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 h-9 text-xs px-3 shadow-xs"
                          onClick={() => setQuickApproveItem(item)}
                          disabled={actions.approve.isPending}
                        >
                          <Check size={14} />
                          Duyệt nhanh
                        </Button>

                        {/* Review Detail button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs gap-1.5 px-3 border-border hover:bg-accent hover:border-amber-400"
                          onClick={() => setSelected(item)}
                        >
                          <Eye size={14} />
                          Chi tiết
                        </Button>

                        {/* More dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setQuickRequestChangesItem(item)}>
                              <AlertTriangle size={13} className="mr-2 text-amber-500" />
                              Yêu cầu sửa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={() => setQuickRejectItem(item)}
                            >
                              <XCircle size={13} className="mr-2" />
                              Từ chối món
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ── Mode 2: Table View ──────────────────────────────────── */}
          {!isLoading && filteredItems.length > 0 && viewMode === 'table' && (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-16">Ảnh</TableHead>
                    <TableHead className="min-w-[180px]">Món ăn & Mã</TableHead>
                    <TableHead className="w-36">Vùng miền</TableHead>
                    <TableHead className="w-40">Cấu trúc</TableHead>
                    <TableHead className="w-28">Năng lượng</TableHead>
                    <TableHead className="w-36 text-center">Độ hoàn thiện</TableHead>
                    <TableHead className="w-48 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const primaryMedia = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]
                    const nutrition = item.nutritionProfiles?.[0]
                    const meta = getConfidenceMeta(item.confidenceScore)
                    const MetaIcon = meta.icon

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                        {/* Image */}
                        <TableCell>
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-muted/40 shrink-0">
                            {primaryMedia?.publicUrl ? (
                              <Image
                                src={primaryMedia.publicUrl}
                                alt={item.name}
                                aspectRatio="square"
                                zoomable
                                title={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Utensils size={14} className="opacity-40" />
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Name & ID */}
                        <TableCell>
                          <div
                            className="font-bold text-xs text-foreground hover:text-amber-600 cursor-pointer truncate max-w-[200px]"
                            onClick={() => setSelected(item)}
                          >
                            {item.name}
                          </div>
                          <code className="text-[10px] text-muted-foreground font-mono">
                            #{item.id.slice(0, 8)}
                          </code>
                        </TableCell>

                        {/* Region */}
                        <TableCell className="text-xs text-foreground">
                          {item.region?.name ?? 'Món Việt'}
                        </TableCell>

                        {/* Ingredients / Steps */}
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{item._count?.ingredients ?? 0} nguyên liệu</div>
                          <div className="text-[11px]">{item._count?.steps ?? 0} bước nấu</div>
                        </TableCell>

                        {/* Calories */}
                        <TableCell className="text-xs font-medium text-foreground">
                          {nutrition?.calories ? `${Number(nutrition.calories).toLocaleString()} kcal` : '—'}
                        </TableCell>

                        {/* Score badge */}
                        <TableCell className="text-center">
                          <Badge
                            variant={meta.variant}
                            className={`text-[10px] px-2 py-0.5 inline-flex items-center gap-1 ${meta.colorClass}`}
                          >
                            <MetaIcon size={10} />
                            {meta.label}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                              onClick={() => setQuickApproveItem(item)}
                              disabled={actions.approve.isPending}
                            >
                              <Check size={12} className="mr-1" /> Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5"
                              onClick={() => setSelected(item)}
                            >
                              <Eye size={12} className="mr-1" /> Chi tiết
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab Content: Community Reviews ───────────────────────── */}
      {activeTab === 'community' && <CommunityReviewsTab />}

      {/* ── Dialogs: Quick Approve ───────────────────────────────── */}
      <AlertDialog open={!!quickApproveItem} onOpenChange={(open) => !open && setQuickApproveItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              Duyệt nhanh món ăn?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn duyệt và xuất bản món “
              <span className="font-bold text-foreground">{quickApproveItem?.name}</span>” ngay lập tức?
              Món ăn sẽ hiển thị công khai trên ứng dụng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.approve.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmQuickApprove}
              disabled={actions.approve.isPending}
            >
              {actions.approve.isPending ? 'Đang duyệt…' : 'Xác nhận duyệt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialogs: Quick Request Changes ──────────────────────── */}
      {quickRequestChangesItem && (
        <ActionDialog
          title={`Yêu cầu sửa: ${quickRequestChangesItem.name}`}
          isPending={actions.requestChanges.isPending}
          onClose={() => setQuickRequestChangesItem(null)}
          onConfirm={(reasonCode, note) => {
            actions.requestChanges.mutate({ dishId: quickRequestChangesItem.id, reasonCode, note })
            setQuickRequestChangesItem(null)
          }}
        />
      )}

      {/* ── Dialogs: Quick Reject ───────────────────────────────── */}
      {quickRejectItem && (
        <ActionDialog
          title={`Từ chối món: ${quickRejectItem.name}`}
          isPending={actions.reject.isPending}
          onClose={() => setQuickRejectItem(null)}
          onConfirm={(reasonCode, note) => {
            actions.reject.mutate({ dishId: quickRejectItem.id, reasonCode, note })
            setQuickRejectItem(null)
          }}
        />
      )}
    </div>
  )
}
