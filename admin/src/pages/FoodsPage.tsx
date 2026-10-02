import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  ImagePlus,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
  Utensils,
  X,
  ZoomIn,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Checkbox } from '../components/ui/checkbox'
import { Image } from '../components/ui/image'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
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
import { Dialog, DialogContent } from '../components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useAdminDish, useAdminDishes, useCreateDish, useDeleteDish, useDishLifecycle, useUpdateDish } from '../hooks/useDishes'
import { useCategories, useGoals, useMealTypes, useRegions } from '../hooks/useTaxonomy'
import { useAuth } from '../providers/AuthProvider'
import { TagSelect } from '../components/ui/tag-select'
import { PageSkeleton, TableSkeleton } from '../components/ui/page-skeleton'
import IngredientPicker from '../components/ui/ingredient-picker'
import type { AdminDishQuery, DishValidationResult, RecipeStepPayload } from '../api/dishes'
import { SubmitReviewBlockedDialog } from '../components/molecules/SubmitReviewBlockedDialog'
import { PendingIngredientsPanel } from '../components/molecules/PendingIngredientsPanel'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { dishesApi } from '../api/dishes'
import type { Dish, DishStatus } from '../types'
import { mediaApi } from '../api/media'
import { ImportFromFileModal } from '../components/molecules/import-from-file'
import { MediaLightbox } from '../components/ui/media-lightbox'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Supabase Storage URL helper ──────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
function getMediaUrl(media: { publicUrl?: string; storageKey?: string; bucket?: string } | undefined): string | null {
  if (!media) return null
  if (media.publicUrl) return media.publicUrl
  if (media.storageKey && media.bucket) {
    return `${SUPABASE_URL}/storage/v1/object/public/${media.bucket}/${media.storageKey}`
  }
  return null
}

// ─── Image Preview Modal ───────────────────────────────────────────────────────

function ImagePreviewModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <MediaLightbox
      open={!!url}
      onClose={onClose}
      media={{ type: 'image', url, title: name }}
    />
  )
}

// ─── Variants Section ─────────────────────────────────────────────────────────

function VariantsSection({
  dishId,
  onPreview,
}: {
  dishId: string
  onPreview?: (v: { url: string; name: string }) => void
}) {
  const [variants, setVariants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    dishesApi.getVariants(dishId)
      .then((data) => setVariants(data ?? []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false))
  }, [dishId])

  if (loading) return <TableSkeleton rows={2} cols={3} />
  if (variants.length === 0) return null

  return (
    <div style={{ background: '#f0f7ff', borderRadius: 12, padding: '14px 16px', border: '1px solid #c7dff7' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1565c0', display: 'flex', alignItems: 'center', gap: 6 }}>
        🔀 Biến thể ({variants.length})
      </h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {variants.map((v: any) => {
          const img = v.media?.[0]?.publicUrl
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10, padding: '6px 12px 6px 6px', border: '1px solid #c7dff7', maxWidth: 200 }}>
              {img ? (
                <div
                  onClick={() => onPreview?.({ url: img, name: v.name })}
                  className="h-9 w-9 shrink-0 cursor-zoom-in overflow-hidden rounded-lg"
                  title="Bấm để xem ảnh lớn"
                >
                  <Image
                    src={img}
                    alt={v.name}
                    aspectRatio="square"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e8f4fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  🍽️
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#161616', lineHeight: 1.3 }}>{v.name}</div>
                {v.ratingAvg > 0 && (
                  <div style={{ fontSize: 11, color: '#c07800' }}>⭐ {Number(v.ratingAvg).toFixed(1)}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Dish Detail Dialog ───────────────────────────────────────────────────────

function DishDetailDialog({ dish, onClose, onEdit }: { dish: Dish; onClose: () => void; onEdit: (d: Dish) => void }) {
  const { data: detail, isLoading } = useAdminDish(dish.id)
  // Dùng detail nếu đã load, fallback về dish prop
  const d = (detail ?? dish) as any
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  const primaryMedia = d.media?.find((m: any) => m.isPrimary) ?? d.media?.[0]
  const imgUrl = primaryMedia
    ? (primaryMedia.publicUrl ?? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${primaryMedia.bucket}/${primaryMedia.storageKey}`)
    : null
  const nutrition = d.nutrition
  const ingredients: Array<{ rawText?: string; ingredientName?: string; quantity?: number; unit?: string; ingredient?: { name: string; imageUrl?: string } }> =
    d.dishIngredients ?? []
  const steps: Array<{ stepOrder: number; instruction: string; durationMin?: number }> =
    d.recipeSteps ?? []
  const categories: Array<{ id: string; name: string }> = d.categories ?? []
  const mealTypes: Array<{ id: string; name: string }> = d.mealTypes ?? []

  const DIFF_LABEL: Record<string, string> = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' }
  const totalMin = (d.prepMinutes ?? 0) + (d.cookMinutes ?? 0)

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[800px] p-0 overflow-y-auto max-h-[92vh] border-none rounded-2xl bg-white shadow-2xl">
        {/* Hero image */}
        <div style={{ position: 'relative', height: imgUrl ? 240 : 80, flexShrink: 0, background: '#f5f0e8', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imgUrl ? (
            <div
              onClick={() => setLightboxMedia({ url: imgUrl, name: d.name })}
              style={{ width: '100%', height: '100%', position: 'relative', cursor: 'zoom-in' }}
              title="Bấm để xem ảnh lớn"
            >
              <Image src={imgUrl} alt={d.name} className="h-full w-full object-cover" />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: 14, left: 18 }}>
                <Badge className={d.status === 'PUBLISHED' ? 'published' : d.status === 'PENDING_REVIEW' ? 'pending' : 'draft'}>
                  &nbsp;{STATUS_LABEL[d.status as DishStatus]}
                </Badge>
              </div>
            </div>
          ) : (
            <Badge className={d.status === 'PUBLISHED' ? 'published' : d.status === 'PENDING_REVIEW' ? 'pending' : 'draft'} style={{ fontSize: 13 }}>
              &nbsp;{STATUS_LABEL[d.status as DishStatus]}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/45 text-white hover:bg-black/60 hover:text-white h-9 w-9 backdrop-blur-xs"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 28px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Loading overlay */}
          {isLoading && (
            <div style={{ padding: '8px 0' }}>
              <TableSkeleton rows={2} cols={3} />
            </div>
          )}

          {/* Header: title + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#161616', lineHeight: 1.3 }}>{d.name}</h2>
              {d.region && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>📍 {d.region.name}</p>}
            </div>
            <Button
              onClick={() => { onClose(); onEdit(detail ?? dish) }}
              className="bg-mogu-yellow hover:bg-mogu-yellow-dark text-slate-900 font-semibold text-xs h-9 px-4 gap-1.5"
            >
              ✏️ Chỉnh sửa
            </Button>
          </div>

          {/* Short description */}
          {(d.shortDescription || d.description) && (
            <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.65, background: '#faf7f0', padding: '12px 16px', borderRadius: 10, border: '1px solid #f0e8d0' }}>
              {d.shortDescription ?? d.description}
            </p>
          )}

          {/* Quick stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { icon: '⏱️', label: 'Tổng thời gian', value: totalMin ? `${totalMin} phút` : '-' },
              { icon: '🧑‍🍳', label: 'Chuẩn bị', value: d.prepMinutes ? `${d.prepMinutes} phút` : '-' },
              { icon: '🔥', label: 'Nấu', value: d.cookMinutes ? `${d.cookMinutes} phút` : '-' },
              { icon: '🍽️', label: 'Khẩu phần', value: d.servings ? `${d.servings} người` : '-' },
              { icon: '📊', label: 'Độ khó', value: d.difficulty ? DIFF_LABEL[d.difficulty] ?? d.difficulty : '-' },
              { icon: '💰', label: 'Giá', value: d.priceMin || d.priceMax ? `${(d.priceMin ?? 0).toLocaleString('vi-VN')}–${(d.priceMax ?? 0).toLocaleString('vi-VN')} ₫` : '-' },
            ].map(item => (
              <div key={item.label} style={{ background: '#faf7f0', borderRadius: 10, padding: '10px 14px', border: '1px solid #f0e8d0' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Danh mục & bữa ăn */}
          {(categories.length > 0 || mealTypes.length > 0) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {categories.map((c: any) => (
                <span key={c.id} style={{ background: '#fff3cd', color: '#856404', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #ffc10733' }}>
                  🏷️ {c.name}
                </span>
              ))}
              {mealTypes.map((m: any) => (
                <span key={m.id} style={{ background: '#e8f4fd', color: '#1565c0', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #90caf9' }}>
                  🕐 {m.name}
                </span>
              ))}
            </div>
          )}

          {/* Dinh dưỡng */}
          {nutrition && (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#2c1810', display: 'flex', alignItems: 'center', gap: 6 }}>
                📊 Dinh dưỡng / khẩu phần
                {nutrition.servingName && <span style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>({nutrition.servingName})</span>}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Calories', value: nutrition.calories, unit: 'kcal', color: '#ff6b35' },
                  { label: 'Protein', value: nutrition.proteinG ?? nutrition.protein, unit: 'g', color: '#4caf50' },
                  { label: 'Tinh bột', value: nutrition.carbsG ?? nutrition.carbs, unit: 'g', color: '#2196f3' },
                  { label: 'Chất béo', value: nutrition.fatG ?? nutrition.fat, unit: 'g', color: '#ff9800' },
                  { label: 'Chất xơ', value: nutrition.fiberG ?? nutrition.fiber, unit: 'g', color: '#8bc34a' },
                  { label: 'Natri', value: nutrition.sodiumMg, unit: 'mg', color: '#9c27b0' },
                ].filter(n => n.value != null && n.value !== 0).map(n => (
                  <div key={n.label} style={{ background: '#fafafa', borderRadius: 8, padding: '10px 12px', border: `2px solid ${n.color}22`, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: n.color }}>{n.value}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>{n.unit}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{n.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nguyên liệu */}
          {ingredients.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#2c1810' }}>
                🥬 Nguyên liệu <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>({ingredients.length} loại)</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {ingredients.map((ing: any, i: number) => {
                  const imgSrc = ing.ingredient?.imageUrl ?? null
                  const name = ing.ingredient?.name ?? ing.rawText ?? ing.ingredientName ?? ''
                  const qty = (ing.quantity ?? 0) > 0 ? `${ing.quantity} ${ing.unit ?? ''}` : ''
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#faf7f0', borderRadius: 10, padding: '8px 12px', border: '1px solid #f0e8d0' }}>
                      {imgSrc ? (
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg">
                          <Image src={imgSrc} alt={name} aspectRatio="square" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e8e0d0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🥄</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c1810', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        {qty && <div style={{ fontSize: 12, color: '#888' }}>{qty}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cách nấu */}
          {steps.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#2c1810' }}>
                👨‍🍳 Cách nấu <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>({steps.length} bước)</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {steps.map((step: any) => {
                  const lines = (step.instruction ?? '').split('\n')
                  const titleLine = lines[0]?.replace(/\*\*/g, '') ?? ''
                  const hasTitle = lines[0]?.startsWith('**')
                  const bodyLines = (hasTitle ? lines.slice(1) : lines).filter((l: string) => l && !l.startsWith('💡'))
                  const tipLine = lines.find((l: string) => l.startsWith('💡'))
                  return (
                    <div key={step.stepOrder} style={{ background: '#faf7f0', borderRadius: 12, border: '1px solid #f0e8d0', overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fff8ec', borderBottom: '1px solid #f0e8d0' }}>
                        <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#f0a500', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {step.stepOrder}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#2c1810', flex: 1 }}>
                          {hasTitle ? titleLine : `Bước ${step.stepOrder}`}
                        </span>
                        {step.durationMin != null && step.durationMin > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f0a500', fontWeight: 600, background: '#fff3cd', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            <Clock3 size={12} /> {step.durationMin} phút
                          </span>
                        )}
                      </div>
                      {/* Body */}
                      <div style={{ padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontSize: 14, color: '#444', lineHeight: 1.7 }}>
                          {bodyLines.join('\n') || (hasTitle ? '' : step.instruction)}
                        </p>
                        {tipLine && (
                          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#666', background: '#fffbf0', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #f0a500' }}>
                            {tipLine}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Variants section */}
          <VariantsSection dishId={d.id} onPreview={setLightboxMedia} />

          {/* Rating summary */}
          {(d.ratingAvg > 0 || d.ratingCount > 0) && (
            <div style={{ background: '#faf7f0', borderRadius: 12, padding: '14px 16px', border: '1px solid #f0e8d0' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#2c1810', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⭐ Đánh giá cộng đồng
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#c07800', lineHeight: 1 }}>{Number(d.ratingAvg ?? 0).toFixed(1)}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{d.ratingCount ?? 0} đánh giá</div>
                </div>
                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const pct = d.ratingCount > 0 ? Math.round((star === Math.round(d.ratingAvg ?? 0) ? 60 : 10) / d.ratingCount * 100) : 0
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, width: 16, textAlign: 'right', color: '#888' }}>{star}★</span>
                        <div style={{ flex: 1, height: 6, background: '#e8e0d4', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#f0a500', borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div style={{ borderTop: '1px solid #f0e8d0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>ID: {d.id}</span>
            <span style={{ fontSize: 11, color: '#bbb' }}>Cập nhật: {new Date(d.updatedAt).toLocaleString('vi-VN')}</span>
          </div>
        </div>
      </DialogContent>
      {lightboxMedia && (
        <ImagePreviewModal
          url={lightboxMedia.url}
          name={lightboxMedia.name}
          onClose={() => setLightboxMedia(null)}
        />
      )}
    </Dialog>
  )
}

const STATUS_LABEL: Record<DishStatus, string> = {
  DRAFT: 'Bản nháp',
  PROCESSING: 'Đang xử lý',
  PENDING_REVIEW: 'Chờ duyệt',
  CHANGES_REQUESTED: 'Cần sửa',
  PUBLISHED: 'Đã xuất bản',
  UNPUBLISHED: 'Đã hủy xuất bản',
  REJECTED: 'Từ chối',
  FAILED: 'Thất bại',
  ARCHIVED: 'Lưu trữ',
}

const STATUS_CLASS: Record<DishStatus, string> = {
  PUBLISHED: 'published',
  PENDING_REVIEW: 'pending',
  CHANGES_REQUESTED: 'pending',
  DRAFT: 'draft',
  PROCESSING: 'draft',
  UNPUBLISHED: 'draft',
  REJECTED: 'draft',
  FAILED: 'draft',
  ARCHIVED: 'draft',
}

function Stat({
  icon: Icon,
  value,
  label,
  tone = 'yellow',
  note,
  active,
  onClick,
}: {
  icon: typeof Utensils
  value: string | number
  label: string
  tone?: string
  note?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      className="stat-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        outline: active ? '2px solid var(--mogu-yellow, #FACC15)' : undefined,
      }}
    >
      <div className={`metric-icon ${tone}`}>
        <Icon size={27} />
      </div>
      <div>
        <b>{value}</b>
        <p>{label}</p>
        {note && <small className="note">{note}</small>}
      </div>
    </Card>
  )
}

function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  )
}


// ─── Create Dish Modal ────────────────────────────────────────────────────────

// ─── Recipe Section (dùng chung CreateDishModal + EditDishModal) ──────────────

const emptyStep = (): RecipeStepPayload & { _id: number } => ({
  _id: Date.now() + Math.random(),
  stepOrder: 1,
  instruction: '',
  durationMin: undefined,
})

interface RecipeSectionProps {
  steps: Array<RecipeStepPayload & { _id: number }>
  onChange: (steps: Array<RecipeStepPayload & { _id: number }>) => void
}

function RecipeSection({ steps, onChange }: RecipeSectionProps) {
  const addStep = () => {
    const next = [...steps, { ...emptyStep(), stepOrder: steps.length + 1 }]
    onChange(next)
  }

  const removeStep = (idx: number) => {
    const next = steps
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, stepOrder: i + 1 }))
    onChange(next)
  }

  const updateStep = (idx: number, field: keyof RecipeStepPayload, value: string | number | undefined) => {
    const next = steps.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s
    )
    onChange(next)
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: '#111',
    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
  }

  return (
    <div>
      <div style={sectionLabelStyle}>
        🍳 Cách nấu
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
          ({steps.length} bước)
        </span>
      </div>

      {steps.length === 0 && (
        <div style={{
          padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)',
          border: '1px dashed var(--border)', borderRadius: 8, marginBottom: 10, fontSize: 13,
        }}>
          Chưa có bước nào — nhấn <b>+ Thêm bước</b> để bắt đầu
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, idx) => (
          <div key={step._id} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'var(--bg-muted,#faf8f5)', borderRadius: 8,
            padding: '10px 12px', border: '1px solid var(--border)',
          }}>
            {/* Số bước */}
            <div style={{
              minWidth: 28, height: 28, borderRadius: '50%',
              background: '#f0a500', color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 2,
            }}>
              {idx + 1}
            </div>

            {/* Nội dung */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Textarea

                placeholder={`Mô tả bước ${idx + 1}... (VD: Rửa sạch thịt, thái thành miếng vừa ăn)`}
                rows={2}
                value={step.instruction}
                onChange={(e) => updateStep(idx, 'instruction', e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  <Clock3 size={12} />
                  <Input
                    type="number"
                    min={0}
                    placeholder="phút"
                    value={step.durationMin ?? ''}
                    onChange={(e) => updateStep(idx, 'durationMin', e.target.value ? Number(e.target.value) : undefined)}
                    style={{ width: 70, fontSize: 12, padding: '3px 8px', height: 30 }}
                  />
                  phút
                </label>
              </div>
            </div>

            {/* Xóa bước */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeStep(idx)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
              title="Xóa bước"
            >
              <X size={15} />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addStep}
        className="mt-2 w-full border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 h-9 font-medium text-xs gap-1.5"
      >
        <Plus size={14} /> Thêm bước
      </Button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

// ──── Tab labels ────────────────────────────────────────────────────────────
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
const emptyIngredient = (): IngredientRow => ({
  _id: Date.now() + Math.random(),
  name: '',
  ingredientId: undefined,
  quantity: '',
  unit: 'g',
})



// ─── Edit Dish Modal ──────────────────────────────────────────────────────────

function EditDishModal({
  dish,
  onClose,
  categories: categoriesProp = [],
  mealTypes: mealTypesProp = [],
  regions: regionsProp = [],
}: {
  dish: Dish
  onClose: () => void
  categories?: any[]
  mealTypes?: any[]
  regions?: any[]
}) {
  const regions = regionsProp
  const categories = categoriesProp
  const mealTypes = mealTypesProp
  const loadingCat = false
  const loadingMeal = false
  const updateDish = useUpdateDish()

  // ── Fetch dish detail để lấy dishIngredients + recipeSteps ───────────────
  const { data: dishDetail, isLoading: loadingDetail } = useAdminDish(dish.id)
  // Dùng detail nếu đã load, fallback về dish prop
  const d = (dishDetail ?? dish) as any

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  const [activeTab, setActiveTab] = useState<CreateTab>('basic')

  // ── Form state (khởi tạo từ dish hiện có) ────────────────────────────────
  const [form, setForm] = useState<{
    name: string; shortDescription: string; difficulty: string
    prepMinutes: number | string; cookMinutes: number | string
    priceMin: number | string; priceMax: number | string
    servings: number | string; regionId: string
    categoryIds: string[]; mealTypeIds: string[]
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
    categoryIds: ((dish as any).categories ?? []).map((c: any) => c.id ?? c),
    mealTypeIds: ((dish as any).mealTypes ?? []).map((m: any) => m.id ?? m),
    parentDishId: (dish as any).parentDishId ?? '',
  })

  // ── Nutrition state ──────────────────────────────────────────────────────
  const initNutrition = (() => {
    const np = (dish as any).nutrition ?? {}
    return {
      calories: np.calories ?? (dish as any).calories ?? '',
      proteinG: np.proteinG ?? (dish as any).proteinG ?? '',
      carbG: np.carbG ?? (dish as any).carbG ?? '',
      fatG: np.fatG ?? (dish as any).fatG ?? '',
      fiberG: np.fiberG ?? (dish as any).fiberG ?? '',
      sodiumMg: np.sodiumMg ?? (dish as any).sodiumMg ?? '',
    }
  })()
  const [nutrition, setNutrition] = useState<Record<string, string | number>>(initNutrition)

  // ── Ingredient state — populate từ dishDetail khi fetch xong ─────────────
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [ingredientsInit, setIngredientsInit] = useState(false)

  useEffect(() => {
    if (!dishDetail || ingredientsInit) return
    const raw: any[] = (dishDetail as any).dishIngredients ?? []
    if (raw.length > 0) {
      setIngredients(raw.map(ing => ({
        _id: Date.now() + Math.random(),
        name: ing.rawText ?? ing.ingredient?.name ?? '',
        ingredientId: ing.ingredient?.id ?? ing.ingredientId ?? undefined,
        ingredientImageUrl: ing.ingredient?.imageUrl ?? undefined,
        ingredientStatus: ing.ingredient?.status,
        quantity: String(ing.quantity ?? ''),
        unit: ing.unit ?? 'g',
      })))
    }
    setIngredientsInit(true)
  }, [dishDetail, ingredientsInit])

  // Sau khi duyệt/gộp nguyên liệu trong panel, dishDetail được refetch → đồng bộ
  // lại ingredientId/status/ảnh cho các dòng khớp rawText (gộp đổi ingredientId).
  const hasUnapprovedSaved = ((dishDetail as any)?.dishIngredients ?? []).some(
    (di: any) => !di.ingredient || di.ingredient.status !== 'ACTIVE',
  )
  const syncIngredientsFromDetail = useCallback((detail: any) => {
    const raw: any[] = detail?.dishIngredients ?? []
    if (!raw.length) return
    setIngredients((rows) =>
      rows.map((row) => {
        const match = raw.find(
          (di) => (di.rawText ?? di.ingredient?.name ?? '').trim().toLowerCase() === row.name.trim().toLowerCase(),
        )
        if (!match?.ingredient) return row
        return {
          ...row,
          ingredientId: match.ingredient.id,
          ingredientImageUrl: match.ingredient.imageUrl ?? undefined,
          ingredientStatus: match.ingredient.status,
        }
      }),
    )
  }, [])
  useEffect(() => {
    if (dishDetail && ingredientsInit) syncIngredientsFromDetail(dishDetail)
  }, [dishDetail, ingredientsInit, syncIngredientsFromDetail])

  // ── Recipe state — populate từ dishDetail khi fetch xong ─────────────────
  const [recipeSteps, setRecipeSteps] = useState<Array<RecipeStepPayload & { _id: number }>>([])
  const [stepsInit, setStepsInit] = useState(false)

  useEffect(() => {
    if (!dishDetail || stepsInit) return
    const raw: any[] = (dishDetail as any).recipeSteps ?? []
    if (raw.length > 0) {
      setRecipeSteps(raw.map(s => ({
        _id: Date.now() + Math.random(),
        stepOrder: s.stepOrder,
        instruction: s.instruction,
        durationMin: s.durationMin ?? undefined,
      })))
    }
    setStepsInit(true)
  }, [dishDetail, stepsInit])

  const [savingRecipe, setSavingRecipe] = useState(false)
  const [recipeSaved, setRecipeSaved] = useState(false)
  void d; void loadingDetail

  // ── Media state ──────────────────────────────────────────────────────────
  const [mediaList, setMediaList] = useState<Array<{ id: string; url: string; isPrimary: boolean; moderationStatus: string }>>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mediaToDelete, setMediaToDelete] = useState<string | null>(null)

  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Load recipe từ dish.recipeSteps ─────────────────────────────────────
  useEffect(() => {
    const steps = (dish as any).recipeSteps ?? []
    if (steps.length) {
      setRecipeSteps(steps.map((s: any) => ({
        _id: Date.now() + Math.random(),
        stepOrder: s.stepOrder,
        instruction: s.instruction ?? '',
        durationMin: s.durationMin ?? undefined,
      })))
    }
  }, [dish.id])

  // ── Load media từ dish prop ──────────────────────────────────────────────
  useEffect(() => {
    const allMedia = (dish.media ?? []) as any[]
    setMediaList(allMedia.map((m: any) => ({
      id: m.id,
      url: m.publicUrl ?? getMediaUrl(m) ?? '',
      isPrimary: m.isPrimary,
      moderationStatus: m.moderationStatus ?? 'PENDING',
    })).filter(m => m.url))
  }, [dish.media])

  // Escape để đóng preview ảnh
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && previewUrl) setPreviewUrl(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [previewUrl])

  // ── Ingredient helpers ───────────────────────────────────────────────────
  const addIngredient = () => setIngredients(prev => [...prev, emptyIngredient()])
  const removeIngredient = (id: number) => setIngredients(prev => prev.filter(i => i._id !== id))
  const updateIngredient = (id: number, patch: Partial<Omit<IngredientRow, '_id'>>) =>
    setIngredients(prev => prev.map(i => i._id === id ? { ...i, ...patch } : i))

  // ── Media helpers ────────────────────────────────────────────────────────
  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMedia(true)
    try {
      const result = await mediaApi.uploadFull(dish.id, file, { isPrimary: mediaList.length === 0 })
      const newUrl = (result as any).publicUrl ?? getMediaUrl(result as any) ?? ''
      setMediaList(prev => [...prev, { id: (result as any).id, url: newUrl, isPrimary: mediaList.length === 0, moderationStatus: (result as any).moderationStatus ?? 'PENDING' }])
    } catch (err: any) {
      alert('Upload thất bại: ' + (err?.response?.data?.message ?? err.message))
    } finally { setUploadingMedia(false); e.target.value = '' }
  }

  const handleDeleteMedia = (mediaId: string) => {
    setMediaToDelete(mediaId)
  }

  const confirmDeleteMedia = async () => {
    if (!mediaToDelete) return
    const mediaId = mediaToDelete
    setMediaToDelete(null)
    setDeletingId(mediaId)
    try {
      await mediaApi.remove(dish.id, mediaId)
      setMediaList(prev => prev.filter(m => m.id !== mediaId))
      if (previewUrl) setPreviewUrl(null)
    } catch (err: any) {
      alert('Xóa thất bại: ' + (err?.response?.data?.message ?? err.message))
    } finally { setDeletingId(null) }
  }

  // ── Recipe được lưu trong handleSubmit chung ─────────────────────────────
  const handleSaveRecipe = async () => {
    // Recipe steps được lưu trong main handleSubmit (PUT /admin/dishes/:id)
    // Không cần endpoint riêng nữa
    setSavingRecipe(true)
    try {
      const stepsPayload = recipeSteps
        .filter(s => s.instruction.trim())
        .map((s, idx) => ({ stepOrder: idx + 1, instruction: s.instruction.trim(), durationMin: s.durationMin }))
      await dishesApi.update(dish.id, {
        recipeSteps: stepsPayload,
        version: dish.version,
      })
      setRecipeSaved(true)
      setTimeout(() => setRecipeSaved(false), 3000)
    } catch (err: any) {
      alert('Lưu cách nấu thất bại: ' + (err?.response?.data?.message ?? err.message))
    } finally { setSavingRecipe(false) }
  }

  // ── Submit (lưu thông tin cơ bản) ────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(''); setSaveSuccess(false)
    try {
      // Build nutrition
      const nutritionPayload: Record<string, number> = {}
      Object.entries(nutrition).forEach(([k, v]) => {
        if (v !== '' && v !== undefined && v !== null) nutritionPayload[k] = Number(v)
      })

      // Build ingredients
      const ingredientPayload = ingredients
        .filter(i => i.name.trim())
        .map((i, idx) => ({
          clientRef: `foods-${i._id}`,
          rawText: i.name.trim(),
          canonicalNameCandidate: i.name.trim(),
          quantity: i.quantity ? Number(i.quantity) : undefined,
          unit: i.unit || undefined,
          ingredientId: i.ingredientId,
          sortOrder: idx + 1,
        }))

      // Build recipeSteps
      const stepsPayload = recipeSteps
        .filter(s => s.instruction.trim())
        .map((s, idx) => ({ stepOrder: idx + 1, instruction: s.instruction.trim(), durationMin: s.durationMin }))

      await updateDish.mutateAsync({
        id: dish.id,
        dto: {
          name: form.name,
          createMissingIngredients: true,
          shortDescription: form.shortDescription || undefined,
          fullDescription: (form as any).fullDescription || undefined,
          difficulty: form.difficulty,
          prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : undefined,
          cookMinutes: (form as any).cookMinutes ? Number((form as any).cookMinutes) : undefined,
          servings: (form as any).servings ? Number((form as any).servings) : undefined,
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

  // ── Styles ───────────────────────────────────────────────────────────────
  const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, color: '#111' }
  const unitBadge: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', padding: '0 10px',
    background: '#f5f5f5', border: '1px solid var(--border)', borderLeft: 'none',
    borderRadius: '0 8px 8px 0', fontSize: 12, color: 'var(--text-muted)', height: 38, flexShrink: 0,
  }

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
        <DialogContent className="max-w-[720px] p-0 overflow-hidden flex flex-col min-h-[580px] max-h-[92vh]">

          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>✏️ Chỉnh sửa món ăn</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{dish.name}</p>
            </div>
          </header>

          {/* Tab bar */}
          <div className="px-6 pt-3 pb-1 border-b border-border flex-shrink-0">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as CreateTab)}>
              <TabsList className="bg-muted/70 p-1 flex-wrap h-auto gap-1">
                {CREATE_TABS.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs font-semibold px-3 py-1.5">
                    {tab.label}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="media" className="text-xs font-semibold px-3 py-1.5">
                  🖼️ Hình ảnh {mediaList.length > 0 ? `(${mediaList.length})` : ''}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable form */}
          <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0 }}>

            {/* ── TAB: CƠ BẢN ── */}
            {activeTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <label>
                    <span style={fieldLabel}>Tên món ăn *</span>
                    <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </label>
                  <label>
                    <span style={fieldLabel}>Mô tả ngắn</span>
                    <Textarea rows={3} maxLength={300}
                      value={form.shortDescription}
                      onChange={(e) => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                      style={{ resize: 'vertical', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10, fontFamily: 'inherit', width: '100%' }} />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    <span style={fieldLabel}>🗺️ Vùng miền</span>
                    <Select value={form.regionId}
                      onChange={(e) => setForm(f => ({ ...f, regionId: e.target.value }))}>
                      <option value="">Tất cả vùng</option>
                      {regions?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  </label>
                  <label>
                    <span style={fieldLabel}>📊 Độ khó</span>
                    <Select value={form.difficulty}
                      onChange={(e) => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                      <option value="EASY">👶 Dễ</option>
                      <option value="MEDIUM">👨‍🍳 Trung bình</option>
                      <option value="HARD">🎖️ Khó</option>
                    </Select>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={fieldLabel}>🏷️ Danh mục</span>
                    <div style={{ marginTop: 6 }}>
                      <TagSelect
                        options={(categories ?? []).map((c: any) => ({ id: c.id, name: c.name }))}
                        selected={form.categoryIds}
                        onChange={(ids) => setForm(f => ({ ...f, categoryIds: ids }))}
                        placeholder="Tìm danh mục..."
                        accentColor="#f0a500"
                        loading={loadingCat}
                      />
                    </div>
                  </div>
                  <div>
                    <span style={fieldLabel}>🌅 Bữa ăn</span>
                    <div style={{ marginTop: 6 }}>
                      <TagSelect
                        options={(mealTypes ?? []).map((m: any) => ({ id: m.id, name: m.name }))}
                        selected={form.mealTypeIds}
                        onChange={(ids) => setForm(f => ({ ...f, mealTypeIds: ids }))}
                        placeholder="Tìm bữa ăn..."
                        accentColor="#3b82f6"
                        loading={loadingMeal}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <label>
                    <span style={fieldLabel}>⏱ Chuẩn bị (phút)</span>
                    <Input type="number" min={0} value={form.prepMinutes}
                      onChange={(e) => setForm(f => ({ ...f, prepMinutes: e.target.value }))} />
                  </label>
                  <label>
                    <span style={fieldLabel}>🔥 Nấu (phút)</span>
                    <Input type="number" min={0} value={form.cookMinutes}
                      onChange={(e) => setForm(f => ({ ...f, cookMinutes: e.target.value }))} />
                  </label>
                  <label>
                    <span style={fieldLabel}>🍽️ Khẩu phần</span>
                    <Input type="number" min={1} value={form.servings}
                      onChange={(e) => setForm(f => ({ ...f, servings: e.target.value }))} />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label>
                    <span style={fieldLabel}>💰 Giá từ (VND)</span>
                    <Input type="number" min={0} value={form.priceMin}
                      onChange={(e) => setForm(f => ({ ...f, priceMin: e.target.value }))} />
                  </label>
                  <label>
                    <span style={fieldLabel}>💰 Giá đến (VND)</span>
                    <Input type="number" min={0} value={form.priceMax}
                      onChange={(e) => setForm(f => ({ ...f, priceMax: e.target.value }))} />
                  </label>
                </div>
                <label>
                  <span style={fieldLabel}>🔀 Món cha (UUID — để trống nếu là món độc lập)</span>
                  <Input
                    type="text"
                    placeholder="UUID của món cha (biến thể)..."
                    value={form.parentDishId}
                    onChange={(e) => setForm(f => ({ ...f, parentDishId: e.target.value }))}
                  />
                  <small style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Ví dụ: "Phở bò tái" là biến thể của "Phở bò"
                  </small>
                </label>
              </div>
            )}

            {/* ── TAB: DINH DƯỠNG ── */}
            {activeTab === 'nutrition' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Thông tin dinh dưỡng tính trên <strong>mỗi khẩu phần</strong>.</p>
                <div style={{ background: '#fffbea', border: '1px solid #ffe58f', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 32 }}>🔥</span>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Calories (kcal)</label>
                    <Input type="number" placeholder="420" min={0} value={nutrition.calories}
                      onChange={(e) => setNutrition(n => ({ ...n, calories: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { key: 'proteinG', label: '🥩 Protein', unit: 'g' },
                    { key: 'carbG', label: '🌾 Tinh bột', unit: 'g' },
                    { key: 'fatG', label: '🫒 Chất béo', unit: 'g' },
                    { key: 'fiberG', label: '🌿 Chất xơ', unit: 'g' },
                    { key: 'sodiumMg', label: '🧂 Natri', unit: 'mg' },
                  ].map(({ key, label, unit }) => (
                    <label key={key}>
                      <span style={fieldLabel}>{label} ({unit})</span>
                      <div style={{ display: 'flex' }}>
                        <Input type="number" placeholder="0" min={0}
                          style={{ borderRadius: '8px 0 0 8px', flex: 1, borderRight: 'none' }}
                          value={nutrition[key]}
                          onChange={(e) => setNutrition(n => ({ ...n, [key]: e.target.value }))} />
                        <span style={unitBadge}>{unit}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: NGUYÊN LIỆU ── */}
            {activeTab === 'ingredients' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                    🥬 Danh sách nguyên liệu
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({ingredients.length})</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addIngredient}
                    className="bg-mogu-yellow hover:bg-mogu-yellow-dark text-slate-900 font-semibold h-7 text-xs px-2.5 gap-1"
                  >
                    <Plus size={14} /> Thêm
                  </Button>
                </div>
                {hasUnapprovedSaved && (
                  <div style={{ marginBottom: 14 }}>
                    <PendingIngredientsPanel dishId={dish.id} compact />
                  </div>
                )}
                {ingredients.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 0', border: '1.5px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13 }}>
                    Chưa có nguyên liệu — nhấn <b>+ Thêm</b> để bắt đầu
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ingredients.map((ing, idx) => (
                    <div key={ing._id} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#faf8f5', borderRadius: 10, padding: '8px 10px', border: '1px solid var(--border)' }}>
                      <span style={{ minWidth: 22, fontSize: 13, fontWeight: 700, color: '#f0a500' }}>{idx + 1}.</span>
                      <IngredientPicker
                        value={ing.name}
                        ingredientId={ing.ingredientId}
                        ingredientImageUrl={ing.ingredientImageUrl}
                        ingredientStatus={ing.ingredientStatus as any}
                        resolutionStatus={
                          ing.ingredientId
                            ? ing.ingredientStatus === 'PENDING_REVIEW'
                              ? 'PENDING_REVIEW'
                              : 'LINKED'
                            : ing.name.trim()
                              ? 'NOT_FOUND'
                              : 'EMPTY'
                        }
                        onChange={(name, ingredient) =>
                          updateIngredient(ing._id, {
                            name,
                            ingredientId: ingredient?.id,
                            ingredientImageUrl: ingredient?.imageUrl,
                            ingredientStatus: ingredient?.status,
                          })
                        }
                        placeholder="Tìm nguyên liệu..."
                      />
                      <Input placeholder="Số lượng" value={ing.quantity} onChange={(e) => updateIngredient(ing._id, { quantity: e.target.value })} style={{ flex: 1 }} />
                      <Select value={ing.unit} onChange={(e) => updateIngredient(ing._id, { unit: e.target.value })} style={{ flex: 1, padding: '0 8px', height: 38 }}>
                        {['g', 'kg', 'ml', 'lít', 'thìa', 'muỗng', 'chén', 'cái', 'bó', 'lá', 'quả', 'miếng'].map(u => <option key={u} value={u}>{u}</option>)}
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(ing._id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB: CÁCH NẤU ── */}
            {activeTab === 'recipe' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <RecipeSection steps={recipeSteps} onChange={setRecipeSteps} />
                {recipeSaved && (
                  <div style={{ padding: '10px 14px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, fontSize: 13, color: '#389e0d', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Đã lưu cách nấu!
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="button" onClick={handleSaveRecipe} disabled={savingRecipe}>
                    {savingRecipe ? 'Đang lưu...' : '💾 Lưu cách nấu'}
                  </Button>
                </div>
              </div>
            )}

            {/* ── TAB: HÌNH ẢNH ── */}
            {activeTab === ('media' as CreateTab) && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                    🖼️ Hình ảnh ({mediaList.length})
                  </span>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#f0a500', border: 'none', color: '#fff',
                    borderRadius: 8, padding: '7px 14px', cursor: uploadingMedia ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, opacity: uploadingMedia ? 0.6 : 1,
                  }}>
                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleUploadMedia} disabled={uploadingMedia} />
                    <ImagePlus size={15} /> {uploadingMedia ? 'Đang tải...' : 'Thêm ảnh'}
                  </label>
                </div>

                {mediaList.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', border: '1.5px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13 }}>
                    Chưa có hình ảnh — nhấn <b>Thêm ảnh</b> để upload
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                  {mediaList.map((m) => (
                    <div key={m.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: m.isPrimary ? '2.5px solid #f0a500' : '1px solid var(--border)' }} className="dish-thumb-wrap">
                      <Image src={m.url} alt="" aspectRatio="square" className="h-full w-full object-cover cursor-zoom-in block" onClick={() => setPreviewUrl(m.url)} />
                      {m.isPrimary && (
                        <div style={{ position: 'absolute', top: 5, left: 5, background: '#f0a500', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>CHÍNH</div>
                      )}
                      {m.moderationStatus === 'PENDING' && (
                        <div style={{ position: 'absolute', bottom: 5, left: 5, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>Chờ duyệt</div>
                      )}
                      <div className="dish-thumb-overlay" style={{ borderRadius: 0 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewUrl(m.url)}
                            className="h-7 w-7 bg-white/20 hover:bg-white/40 text-white"
                            title="Xem ảnh lớn"
                          >
                            <ZoomIn size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteMedia(m.id)}
                            disabled={deletingId === m.id}
                            className="h-7 w-7 bg-red-600/80 hover:bg-red-700 text-white"
                            title="Xóa ảnh"
                          >
                            {deletingId === m.id ? <span className="text-[10px]">...</span> : <Trash2 size={14} />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error / Success banners */}
            {saveError && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 8, fontSize: 13, color: '#cf1322' }}>
                ⚠️ {saveError}
              </div>
            )}
            {saveSuccess && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, fontSize: 13, color: '#389e0d', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> Cập nhật thành công!
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, marginTop: 8, borderTop: '1px solid var(--border)' }}>
              <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
              {activeTab !== 'recipe' && activeTab !== ('media' as CreateTab) && (
                <Button type="submit" disabled={updateDish.isPending}>
                  {updateDish.isPending ? 'Đang lưu...' : '💾 Lưu thay đổi'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={mediaToDelete !== null} onOpenChange={(open) => !open && setMediaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa ảnh này?</AlertDialogTitle>
            <AlertDialogDescription>
              Ảnh sẽ bị xóa vĩnh viễn khỏi món ăn này. Thao tác không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMedia}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId !== null ? 'Đang xóa...' : 'Xóa ảnh'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DishActionMenu({
  dish,
  categories = [],
  mealTypes = [],
  regions = [],
}: {
  dish: Dish
  categories?: any[]
  mealTypes?: any[]
  regions?: any[]
}) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const navigate = useNavigate()
  const lifecycle = useDishLifecycle()
  const deleteDish = useDeleteDish()
  const createDish = useCreateDish()
  const { isContentAdmin, isSuperAdmin } = useAuth()
  const canEdit = isContentAdmin || isSuperAdmin

  const handleDuplicate = () => {
    setShowDuplicateConfirm(true)
  }

  const confirmDuplicate = async () => {
    setShowDuplicateConfirm(false)
    try {
      await createDish.mutateAsync({
        name: dish.name + ' (bản sao)',
        shortDescription: (dish as any).shortDescription,
        difficulty: dish.difficulty,
        prepMinutes: dish.prepMinutes,
        priceMin: dish.priceMin,
        priceMax: dish.priceMax,
      })
    } catch (err: any) {
      alert('Nhân bản thất bại: ' + (err?.response?.data?.message ?? err.message))
    }
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    setShowDeleteConfirm(false)
    try {
      await deleteDish.mutateAsync(dish.id)
    } catch (err: any) {
      alert('Xóa thất bại: ' + (err?.response?.data?.message ?? err.message))
    }
  }

  const actions: { label: string; fn: () => void; danger?: boolean; highlight?: boolean; divider?: boolean }[] = []

  actions.push({ label: '👁 Xem', fn: () => { window.dispatchEvent(new CustomEvent('mogu:view-dish', { detail: dish })) } })
  if (canEdit) {
    actions.push({ label: '✏️ Chỉnh sửa', fn: () => { navigate(`/foods/${dish.id}`) } })
    actions.push({ label: '📋 Nhân bản', fn: handleDuplicate })
  }
  actions.push({ label: '─────────', fn: () => { }, divider: true })

  if (canEdit && (dish.status === 'DRAFT' || dish.status === 'CHANGES_REQUESTED')) {
    actions.push({ label: '📤 Gửi duyệt', fn: () => { window.dispatchEvent(new CustomEvent('mogu:submit-review', { detail: { id: dish.id, name: dish.name } })) } })
  }
  if (isSuperAdmin && dish.status === 'PENDING_REVIEW') {
    actions.push({ label: '⚡ Xuất bản ngay', fn: () => { lifecycle.publishDirect.mutate(dish.id) }, highlight: true })
  }
  if (dish.status === 'PUBLISHED') {
    actions.push({ label: '⏸ Hủy xuất bản', fn: () => { lifecycle.unpublish.mutate(dish.id) } })
  }
  if (dish.status === 'UNPUBLISHED') {
    actions.push({ label: '▶️ Xuất bản lại', fn: () => { lifecycle.republish.mutate(dish.id) } })
  }
  if (canEdit && !['ARCHIVED'].includes(dish.status)) {
    actions.push({ label: '🗃 Lưu trữ', fn: () => { lifecycle.archive.mutate(dish.id) } })
  }
  if (isSuperAdmin && dish.status === 'ARCHIVED') {
    actions.push({ label: '🔄 Khôi phục', fn: () => { lifecycle.restore.mutate(dish.id) } })
  }

  if (isSuperAdmin) {
    actions.push({ label: '─────────', fn: () => { }, divider: true })
    actions.push({ label: '🗑 Xóa vĩnh viễn', fn: handleDelete, danger: true })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 shadow-xl">
          {actions.map((a, i) =>
            a.divider ? (
              <DropdownMenuSeparator key={`sep-${i}`} />
            ) : (
              <DropdownMenuItem
                key={`${a.label}-${i}`}
                onClick={a.fn}
                className={
                  a.danger
                    ? 'text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive'
                    : a.highlight
                      ? 'font-semibold text-amber-600'
                      : ''
                }
              >
                {a.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Modal render tại đây để có đúng context dish */}
      {showEdit && (
        <EditDishModal
          dish={dish}
          onClose={() => setShowEdit(false)}
          categories={categories ?? []}
          mealTypes={mealTypes ?? []}
          regions={regions ?? []}
        />
      )}

      {/* Inline Delete Confirm Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">Xóa vĩnh viễn?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Món <b>"{dish.name}"</b> sẽ bị xóa vĩnh viễn.<br />Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDish.isPending ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline Duplicate Confirm Dialog */}
      <AlertDialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mb-2">
              <Utensils className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">Nhân bản món ăn?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Tạo bản sao mới cho món <b>"{dish.name}"</b> ở trạng thái bản nháp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDuplicate}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {createDish.isPending ? 'Đang nhân bản...' : 'Xác nhận nhân bản'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Upload Media Button ──────────────────────────────────────────────────────

function UploadMediaButton({ dishId, iconOnly = false }: { dishId: string; iconOnly?: boolean }) {
  const [uploading, setUploading] = useState(false)
  const qc = useCallback(() => {
    // Trigger refetch danh sách sau khi upload
    window.dispatchEvent(new Event('dish-media-uploaded'))
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !dishId) return
    setUploading(true)
    try {
      await mediaApi.uploadFull(dishId, file, { isPrimary: true })
      qc()
    } catch (err) {
      alert('Upload thất bại: ' + (err as Error).message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (iconOnly) {
    return (
      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
        {uploading
          ? <span style={{ fontSize: 10, color: '#fff' }}>...</span>
          : <Upload size={16} color="#fff" />
        }
      </label>
    )
  }

  return (
    <label style={{ cursor: 'pointer' }}>
      <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
      <Button variant="outline" size="sm" asChild>
        <span><Upload size={14} /> {uploading ? 'Đang upload...' : 'Ảnh/Video'}</span>
      </Button>
    </label>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── OpenEditById — load dish by id rồi mở EditDishModal ─────────────────────

function OpenEditById({
  dishId, onClose, categories, mealTypes, regions,
}: {
  dishId: string
  onClose: () => void
  categories: any[]
  mealTypes: any[]
  regions: any[]
}) {
  const { data: dish, isLoading } = useAdminDish(dishId)
  if (isLoading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(520px, 92vw)', overflow: 'hidden' }}>
        <PageSkeleton rows={5} withAvatar />
      </div>
    </div>
  )
  if (!dish) return null
  return <EditDishModal dish={dish} onClose={onClose} categories={categories} mealTypes={mealTypes} regions={regions} />
}
export default function FoodsPage() {
  const navigate = useNavigate()
  const { isContentAdmin, isSuperAdmin } = useAuth()
  const canEdit = isContentAdmin || isSuperAdmin
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState<AdminDishQuery>(() => ({
    limit: 20,
    q: searchParams.get('q') || undefined,
    status: searchParams.get('status') || undefined,
    regionId: searchParams.get('regionId') || undefined,
    categoryCode: searchParams.get('categoryCode') || undefined,
    mealTypeCode: searchParams.get('mealTypeCode') || undefined,
    goalId: searchParams.get('goalId') || undefined,
    createdFromImportSessionId: searchParams.get('createdFromImportSessionId') || undefined,
  }))
  const [cursor, setCursor] = useState<string | undefined>()
  const [previewImg, setPreviewImg] = useState<{ url: string; name: string } | null>(null)
  const [detailDish, setDetailDish] = useState<Dish | null>(null)
  const [editFromDetail, setEditFromDetail] = useState<Dish | null>(null)
  const [openEditId, setOpenEditId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const lifecycle = useDishLifecycle()

  useEffect(() => {
    const next = new URLSearchParams()
    if (query.q) next.set('q', query.q)
    if (query.status) next.set('status', query.status)
    if (query.regionId) next.set('regionId', query.regionId)
    if (query.categoryCode) next.set('categoryCode', query.categoryCode)
    if (query.mealTypeCode) next.set('mealTypeCode', query.mealTypeCode)
    if (query.goalId) next.set('goalId', query.goalId)
    if (query.createdFromImportSessionId) next.set('createdFromImportSessionId', query.createdFromImportSessionId)
    setSearchParams(next, { replace: true })
  }, [query, setSearchParams])

  useEffect(() => {
    const editId = searchParams.get('openEdit')
    if (editId) {
      setOpenEditId(editId)
    }
  }, [searchParams])

  useEffect(() => {
    const handler = (e: Event) => setDetailDish((e as CustomEvent).detail)
    window.addEventListener('mogu:view-dish', handler)
    return () => window.removeEventListener('mogu:view-dish', handler)
  }, [])

  // ── Gửi duyệt có kiểm tra điều kiện (chặn nếu còn nguyên liệu chưa duyệt) ──
  const [blocked, setBlocked] = useState<{ dishId: string; dishName?: string; validation: DishValidationResult } | null>(null)
  const [bulkNotice, setBulkNotice] = useState<string | null>(null)

  const trySubmitReview = useCallback(
    async (dishId: string, dishName?: string, opts?: { silent?: boolean }): Promise<boolean> => {
      try {
        const validation = await dishesApi.validate(dishId)
        if (validation && !validation.canSubmitReview) {
          if (!opts?.silent) setBlocked({ dishId, dishName, validation })
          return false
        }
        await lifecycle.submitForReview.mutateAsync({ id: dishId })
        return true
      } catch (err: any) {
        const body = err?.response?.data?.error ?? err?.response?.data
        if (body?.code === 'PUBLISH_REQUIREMENT_FAILED') {
          if (!opts?.silent) {
            setBlocked({
              dishId,
              dishName,
              validation: {
                completionPercent: 0,
                sections: [],
                blockingErrors: body.details ?? [],
                warnings: [],
                ingredientIssues: body.ingredientIssues ?? [],
                canSubmitReview: false,
              },
            })
          }
          return false
        }
        if (!opts?.silent) alert(body?.message ?? err?.message ?? 'Gửi duyệt thất bại')
        return false
      }
    },
    [lifecycle.submitForReview],
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; name?: string }
      void trySubmitReview(d.id, d.name)
    }
    window.addEventListener('mogu:submit-review', handler)
    return () => window.removeEventListener('mogu:submit-review', handler)
  }, [trySubmitReview])

  const bulkSubmitReview = async (ids: string[]) => {
    if (ids.length === 1) {
      const d = dishes.find((x) => x.id === ids[0])
      await trySubmitReview(ids[0], d?.name)
      return
    }
    const results = await Promise.all(ids.map((id) => trySubmitReview(id, undefined, { silent: true })))
    const failedIds = ids.filter((_, i) => !results[i])
    const okCount = results.filter(Boolean).length
    if (failedIds.length) {
      const names = failedIds
        .map((id) => dishes.find((x) => x.id === id)?.name ?? id)
        .slice(0, 5)
        .join(', ')
      setBulkNotice(
        `Đã gửi duyệt ${okCount}/${ids.length} món. ${failedIds.length} món chưa đủ điều kiện (thường do còn nguyên liệu tự động tìm chưa được duyệt): ${names}. Mở từng món → "Gửi duyệt" để xem chi tiết.`,
      )
    } else {
      setBulkNotice(`Đã gửi duyệt ${okCount} món.`)
    }
  }

  const { data, isLoading, isError } = useAdminDishes({ ...query, cursor })
  const { data: categories } = useCategories()
  const { data: regions } = useRegions()
  const { data: mealTypes } = useMealTypes()
  const { data: goals } = useGoals()

  const dishes = data?.data ?? []
  const summary = data?.summary
  const total = summary?.total ?? data?.total ?? 0
  const nextCursor = data?.nextCursor ?? data?.pageInfo?.nextCursor
  const hasNextPage = !!(data?.hasMore ?? data?.pageInfo?.hasNextPage ?? nextCursor)

  const published = summary?.published ?? 0
  const pending = summary?.pendingReview ?? 0
  const draft = summary?.draft ?? 0

  const setStatusFilter = (status?: string) => {
    setCursor(undefined)
    setQuery((q) => ({ ...q, status: q.status === status ? undefined : status }))
  }

  const toggleSelect = (id: string) => {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  return (
    <>
      <PageHeading
        title="Kho món ăn"
        subtitle="Quản lý toàn bộ dữ liệu món ăn trên Mogu"
        actions={
          canEdit ? (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload size={17} /> Nhập từ file
              </Button>
              <Button onClick={() => navigate('/foods/new')}>
                <Plus size={18} /> Thêm món mới
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="stats-grid">
        <Stat icon={Utensils} value={isLoading ? '...' : total} label="món" tone="yellow" note="Tổng số món ăn" active={!query.status} onClick={() => setStatusFilter(undefined)} />
        <Stat icon={CheckCircle2} value={isLoading ? '...' : published} label="đã xuất bản" tone="green" note="Đang hiển thị công khai" active={query.status === 'PUBLISHED'} onClick={() => setStatusFilter('PUBLISHED')} />
        <Stat icon={Clock3} value={isLoading ? '...' : pending} label="chờ duyệt" tone="orange" note="Chờ kiểm duyệt" active={query.status === 'PENDING_REVIEW'} onClick={() => setStatusFilter('PENDING_REVIEW')} />
        <Stat icon={FileText} value={isLoading ? '...' : draft} label="bản nháp" tone="purple" note="Chưa hoàn thiện" active={query.status === 'DRAFT'} onClick={() => setStatusFilter('DRAFT')} />
      </div>

      {selected.length > 0 && canEdit && (
        <Card style={{ marginBottom: 12, padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <b>{selected.length} món đã chọn</b>
          <Button size="sm" onClick={() => { const ids = [...selected]; setSelected([]); void bulkSubmitReview(ids) }}>Gửi duyệt</Button>
          <Button size="sm" variant="outline" onClick={() => { selected.forEach((id) => lifecycle.archive.mutate(id)); setSelected([]) }}>Lưu trữ</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Bỏ chọn</Button>
        </Card>
      )}

      {/* Filters */}
      <Card className="filters">
        <label>
          <Search size={18} />
          <Input
            value={query.q ?? ''}
            onChange={(e) => setQuery((q) => ({ ...q, q: e.target.value }))}
            placeholder="Tìm tên món, nguyên liệu..."
          />
        </label>
        <Select

          value={query.status ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value || undefined }))}
        >
          <option value="">Trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select

          value={query.regionId ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, regionId: e.target.value || undefined }))}
        >
          <option value="">Vùng miền</option>
          {regions?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Select

          value={query.categoryCode ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, categoryCode: e.target.value || undefined }))}
        >
          <option value="">Danh mục</option>
          {categories?.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
        </Select>
        <Select

          value={query.mealTypeCode ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, mealTypeCode: e.target.value || undefined }))}
        >
          <option value="">Bữa ăn</option>
          {mealTypes?.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
        </Select>
        <Select
          value={query.goalId ?? ''}
          onChange={(e) => setQuery((q) => ({ ...q, goalId: e.target.value || undefined }))}
        >
          <option value="">Mục tiêu</option>
          {goals?.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <Button variant="outline" onClick={() => setQuery({ limit: 20 })}>
          <Filter size={17} /> Xóa bộ lọc
        </Button>
      </Card>

      {/* Table */}
      <Card className="table-card">
        {isError && (
          <div style={{ padding: 20, color: 'var(--red)', textAlign: 'center' }}>
            Không thể tải dữ liệu. Kiểm tra kết nối backend.
          </div>
        )}
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="checkbox-col w-10">
                  <Checkbox
                    checked={dishes.length > 0 && dishes.every((d) => selected.includes(d.id))}
                    onCheckedChange={(checked) => setSelected(checked ? dishes.map((d) => d.id) : [])}
                  />
                </TableHead>
                <TableHead style={{ width: 72 }}>Ảnh</TableHead>
                <TableHead>Món ăn</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Dinh dưỡng</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Cập nhật ↓</TableHead>
                <TableHead className="text-right pr-6" style={{ width: 80 }}>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Chưa có món ăn nào
                  </TableCell>
                </TableRow>
              )}
              {dishes.map((dish) => {
                const primaryMedia = dish.media?.find((m: any) => m.isPrimary) ?? dish.media?.[0]
                const imgUrl = getMediaUrl(primaryMedia)
                const nutrition = (dish as any).nutrition
                const category = dish.categories?.[0]
                return (
                  <TableRow
                    key={dish.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, input, [role="checkbox"], [data-no-detail]')) return
                      setDetailDish(dish)
                    }}
                  >
                    <TableCell className="checkbox-col" data-no-detail onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(dish.id)}
                        onCheckedChange={() => toggleSelect(dish.id)}
                      />
                    </TableCell>

                    {/* ── Cột ảnh thumbnail ── */}
                    <TableCell style={{ padding: '8px 10px' }} data-no-detail onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative', width: 56, height: 56 }} className="dish-thumb-wrap">
                        {imgUrl ? (
                          <Image
                            src={imgUrl}
                            alt={dish.name}
                            aspectRatio="square"
                            zoomable
                            title={dish.name}
                            subtitle={`#${dish.id.slice(0, 8)}`}
                            className="h-14 w-14 rounded-lg object-cover"
                          />
                        ) : (
                          <div style={{ width: 56, height: 56, background: 'var(--bg-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)' }}>
                            <Utensils size={18} color="var(--text-muted)" />
                          </div>
                        )}
                        {!imgUrl && (
                          <div className="dish-thumb-overlay">
                            <UploadMediaButton dishId={dish.id} iconOnly />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="food-cell">
                      <span>
                        <b>{dish.name}</b>
                        <small>#{dish.id.slice(0, 8)}</small>
                      </span>
                    </TableCell>
                    <TableCell>
                      {category ? <Badge>{category.name}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </TableCell>
                    <TableCell>
                      {nutrition ? (
                        <>
                          <b>{nutrition.calories ?? '?'} kcal</b>
                          <small>
                            {nutrition.protein ?? '?'}g đạm · {nutrition.carbs ?? '?'}g carb · {nutrition.fat ?? '?'}g béo
                          </small>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Chưa có</span>
                      )}
                    </TableCell>
                    <TableCell style={{ textAlign: 'center' }}>
                      {(dish as any).ratingAvg > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13 }}>⭐</span>
                            <b style={{ fontSize: 13, color: '#c07800' }}>{Number((dish as any).ratingAvg).toFixed(1)}</b>
                          </div>
                          <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>({(dish as any).ratingCount ?? 0})</small>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CLASS[dish.status]}>• &nbsp;{STATUS_LABEL[dish.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(dish.updatedAt).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-right pr-4" data-no-detail onClick={e => e.stopPropagation()}>
                      <DishActionMenu dish={dish} categories={categories ?? []} mealTypes={mealTypes ?? []} regions={regions ?? []} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="pagination">
          <span className="flex items-center gap-2">
            Hiển thị
            <div className="w-20 inline-block">
              <Select
                value={String(query.limit ?? 20)}
                onChange={(e) => {
                  setQuery(q => ({ ...q, limit: Number(e.target.value) }))
                  setCursor(undefined)
                }}
                className="h-8 text-xs"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={String(n)}>{n}</option>)}
              </Select>
            </div>
            trên mỗi trang
            {total > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                — Tổng: <b>{total}</b> món
              </span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(undefined)}
              disabled={!cursor}
              title="Về trang đầu"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCursor(nextCursor)}
              disabled={!hasNextPage}
            >
              Tiếp <ChevronRight size={16} />
            </Button>
          </span>
        </div>
      </Card>

      {/* Image Preview Modal */}
      {previewImg && (
        <ImagePreviewModal
          url={previewImg.url}
          name={previewImg.name}
          onClose={() => setPreviewImg(null)}
        />
      )}

      {/* Dish Detail Dialog */}
      {detailDish && (
        <DishDetailDialog
          dish={detailDish}
          onClose={() => setDetailDish(null)}
          onEdit={(d) => setEditFromDetail(d)}
        />
      )}

      {/* Edit Modal mở từ Detail Dialog */}
      {openEditId && (
        <OpenEditById
          dishId={openEditId}
          onClose={() => setOpenEditId(null)}
          categories={categories ?? []}
          mealTypes={mealTypes ?? []}
          regions={regions ?? []}
        />
      )}

      {editFromDetail && (
        <EditDishModal
          dish={editFromDetail}
          onClose={() => setEditFromDetail(null)}
          categories={categories ?? []}
          mealTypes={mealTypes ?? []}
          regions={regions ?? []}
        />
      )}

      <ImportFromFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onViewDrafts={(sessionId) => {
          setQuery((q) => ({
            ...q,
            status: 'DRAFT',
            createdFromImportSessionId: sessionId,
          }))
        }}
      />

      <SubmitReviewBlockedDialog
        open={!!blocked}
        onOpenChange={(o) => { if (!o) setBlocked(null) }}
        dishId={blocked?.dishId}
        dishName={blocked?.dishName}
        validation={blocked?.validation ?? null}
        onIngredientsChanged={() => {
          if (!blocked) return
          const { dishId, dishName } = blocked
          void dishesApi.validate(dishId)
            .then((v) => { if (v) setBlocked((cur) => (cur && cur.dishId === dishId ? { dishId, dishName, validation: v } : cur)) })
            .catch(() => undefined)
        }}
        onResolved={() => {
          if (!blocked) return
          const { dishId, dishName } = blocked
          void dishesApi.validate(dishId).then((v) => {
            if (!v || v.canSubmitReview) {
              setBlocked(null)
              void trySubmitReview(dishId, dishName)
            } else {
              setBlocked({ dishId, dishName, validation: v })
            }
          }).catch(() => undefined)
        }}
      />

      {bulkNotice && (
        <div
          role="status"
          style={{
            position: 'fixed', right: 24, bottom: 24, zIndex: 60, maxWidth: 440,
            background: '#fff', border: '1px solid #f3d38b', borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,.15)', padding: '12px 14px', fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>{bulkNotice}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setBulkNotice(null)}
              aria-label="Đóng"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
