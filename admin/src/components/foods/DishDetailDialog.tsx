import { useState } from 'react'
import {
  Clock3,
  Flame,
  ChefHat,
  Users,
  Star,
  Pencil,
  Tag,
  Utensils,
  Image as ImageIcon,
} from 'lucide-react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Image } from '../ui/image'
import { Skeleton } from '../ui/skeleton'
import { MediaLightbox } from '../ui/media-lightbox'
import { useAdminDish } from '../../hooks/useDishes'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS, getMediaUrl } from './types'
import type { Dish } from '../../types'

interface DishDetailDialogProps {
  dish: Dish
  onClose: () => void
  onEdit: (d: Dish) => void
}

export function DishDetailDialog({ dish, onClose, onEdit }: DishDetailDialogProps) {
  const { data: detail, isLoading: isDetailLoading } = useAdminDish(dish.id)
  const d = (detail ?? dish) as any

  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; name: string } | null>(null)

  const primaryMedia = d.media?.find((m: any) => m.isPrimary) ?? d.media?.[0]
  const imgUrl = getMediaUrl(primaryMedia)

  const nutrition = d.nutrition
  const ingredients: Array<{
    rawText?: string
    ingredientName?: string
    quantity?: number
    unit?: string
    ingredient?: { name: string; imageUrl?: string }
  }> = d.dishIngredients ?? []
  const steps: Array<{ stepOrder: number; instruction: string; durationMin?: number }> =
    d.recipeSteps ?? []
  const categories: Array<{ id: string; name: string }> = (d.categories ?? [])
    .map((c: any) => ({
      id: c.category?.id ?? c.id ?? c.categoryId,
      name: c.category?.name ?? c.name ?? '',
    }))
    .filter((c: any) => c.name)

  const mealTypes: Array<{ id: string; name: string }> = (d.mealTypes ?? [])
    .map((m: any) => ({
      id: m.mealTypeTag?.id ?? m.id ?? m.mealTypeTagId,
      name: m.mealTypeTag?.name ?? m.name ?? '',
    }))
    .filter((m: any) => m.name)

  const DIFF_LABEL: Record<string, string> = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' }
  const totalMin = (d.prepMinutes ?? 0) + (d.cookMinutes ?? 0)

  const statusVariant = STATUS_BADGE_VARIANTS[d.status as keyof typeof STATUS_BADGE_VARIANTS] || {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl border border-border flex flex-col max-h-[90vh]">
          {/* Hero Banner */}
          <div className="relative h-56 bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
            {imgUrl ? (
              <div
                onClick={() => setLightboxMedia({ url: imgUrl, name: d.name })}
                className="w-full h-full relative cursor-zoom-in group"
                title="Bấm để xem ảnh lớn"
              >
                <Image src={imgUrl} alt={d.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge className={`text-[11px] font-semibold ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}>
                      {STATUS_LABELS[d.status as keyof typeof STATUS_LABELS] ?? d.status}
                    </Badge>
                    {d.region?.name && (
                      <Badge variant="outline" className="text-[11px] text-white/90 border-white/30">
                        {d.region.name}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">{d.name}</h2>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                <ImageIcon size={36} />
                <span className="text-xs">Chưa có hình ảnh món</span>
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-4 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <Flame size={14} className="text-amber-500" />
                  <span>Calo</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  {nutrition?.calories ? `${nutrition.calories} kcal` : '—'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <Clock3 size={14} className="text-blue-500" />
                  <span>Thời gian</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  {totalMin > 0 ? `${totalMin}p` : '—'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <ChefHat size={14} className="text-emerald-500" />
                  <span>Độ khó</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  {DIFF_LABEL[d.difficulty] ?? '—'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <Users size={14} className="text-purple-500" />
                  <span>Khẩu phần</span>
                </div>
                <div className="text-sm font-bold text-foreground">
                  {d.servings ? `${d.servings} người` : '—'}
                </div>
              </div>
            </div>

            {/* Description */}
            {d.shortDescription && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Mô tả</h4>
                <p className="text-sm text-foreground/90 leading-relaxed bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
                  {d.shortDescription}
                </p>
              </div>
            )}

            {/* Categories & Meal types */}
            {(categories.length > 0 || mealTypes.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Badge key={c.id} variant="secondary" className="text-xs font-semibold bg-slate-100 text-slate-700 gap-1">
                    <Tag size={12} className="text-slate-500" />
                    <span>{c.name}</span>
                  </Badge>
                ))}
                {mealTypes.map((m) => (
                  <Badge key={m.id} variant="outline" className="text-xs font-semibold text-amber-800 border-amber-200 bg-amber-50/50 gap-1">
                    <Utensils size={12} className="text-amber-600" />
                    <span>{m.name}</span>
                  </Badge>
                ))}
              </div>
            )}

            {/* Nutrition details */}
            {nutrition && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Dinh dưỡng / Khẩu phần {nutrition.servingName && `(${nutrition.servingName})`}
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: 'Calo', value: nutrition.calories, unit: 'kcal', color: 'text-amber-600' },
                    { label: 'Protein', value: nutrition.proteinG ?? nutrition.protein, unit: 'g', color: 'text-emerald-600' },
                    { label: 'Carbs', value: nutrition.carbsG ?? nutrition.carbs, unit: 'g', color: 'text-blue-500' },
                    { label: 'Chất béo', value: nutrition.fatG ?? nutrition.fat, unit: 'g', color: 'text-orange-500' },
                    { label: 'Chất xơ', value: nutrition.fiberG ?? nutrition.fiber, unit: 'g', color: 'text-teal-500' },
                    { label: 'Natri', value: nutrition.sodiumMg, unit: 'mg', color: 'text-purple-500' },
                  ]
                    .filter((n) => n.value != null && n.value !== 0)
                    .map((n) => (
                      <div key={n.label} className="bg-muted/40 border border-border rounded-lg p-2.5 text-center">
                        <div className={`text-sm font-bold ${n.color}`}>{n.value}</div>
                        <div className="text-[10px] text-muted-foreground">{n.unit}</div>
                        <div className="text-[11px] font-medium text-muted-foreground mt-0.5">{n.label}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Ingredients list */}
            {isDetailLoading && ingredients.length === 0 ? (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Đang tải nguyên liệu...
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              </div>
            ) : ingredients.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Nguyên liệu ({ingredients.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ingredients.map((ing, i) => {
                    const name = ing.ingredient?.name ?? ing.rawText ?? ing.ingredientName ?? ''
                    const qty = (ing.quantity ?? 0) > 0 ? `${ing.quantity} ${ing.unit ?? ''}` : ''
                    return (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
                        <span className="font-semibold text-foreground">{name}</span>
                        {qty && <span className="text-muted-foreground font-medium">{qty}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {/* Recipe steps */}
            {isDetailLoading && steps.length === 0 ? (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Đang tải công thức...
                </h4>
                <div className="space-y-2.5">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              </div>
            ) : steps.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Cách nấu ({steps.length} bước)
                </h4>
                <div className="space-y-2.5">
                  {steps.map((step) => (
                    <div key={step.stepOrder} className="rounded-xl border border-border overflow-hidden bg-muted/20">
                      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/50 border-b border-border text-xs font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                            {step.stepOrder}
                          </span>
                          <span>Bước {step.stepOrder}</span>
                        </div>
                        {step.durationMin && step.durationMin > 0 && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            {step.durationMin} phút
                          </span>
                        )}
                      </div>
                      <div className="p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {step.instruction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Community Rating */}
            {(d.ratingAvg > 0 || d.ratingCount > 0) && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <Star size={18} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                <div className="text-muted-foreground">
                  Đánh giá trung bình: <b className="text-foreground">{Number(d.ratingAvg).toFixed(1)}/5</b> ({d.ratingCount ?? 0} lượt)
                </div>
              </div>
            )}
          </div>

          {/* Dialog Footer Actions */}
          <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Đóng
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onClose()
                onEdit(d)
              }}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5"
            >
              <Pencil size={13} />
              Chỉnh sửa món này
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox preview */}
      {lightboxMedia && (
        <MediaLightbox
          open={!!lightboxMedia}
          onClose={() => setLightboxMedia(null)}
          media={{
            type: 'image',
            title: lightboxMedia.name,
            url: lightboxMedia.url,
          }}
        />
      )}
    </>
  )
}
