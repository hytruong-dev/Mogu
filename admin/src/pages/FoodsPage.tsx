import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { useAdminDish, useAdminDishes, useCreateDish, useDeleteDish, useDishLifecycle, useUpdateDish } from '../hooks/useDishes'
import { useCategories, useGoals, useMealTypes, useRegions } from '../hooks/useTaxonomy'
import { useAuth } from '../providers/AuthProvider'
import { TagSelect } from '../components/ui/tag-select'
import IngredientPicker from '../components/ui/ingredient-picker'
import type { AdminDishQuery, RecipeStepPayload } from '../api/dishes'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { dishesApi } from '../api/dishes'
import type { Dish, DishStatus } from '../types'
import { mediaApi } from '../api/media'
import { ImportFromFileModal } from '../components/molecules/import-from-file'

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
  // Đóng khi nhấn Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,0.12)',
          border: 'none', borderRadius: '50%',
          width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
      >
        <X size={20} />
      </button>

      {/* Image */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: '90vw', maxHeight: '90vh' }}
      >
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: '85vw', maxHeight: '80vh',
            borderRadius: 12,
            objectFit: 'contain',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            display: 'block',
          }}
        />
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, margin: 0, textAlign: 'center' }}>{name}</p>
      </div>
    </div>
  )
}

// ─── Variants Section ─────────────────────────────────────────────────────────

function VariantsSection({ dishId }: { dishId: string }) {
  const [variants, setVariants] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    dishesApi.getVariants(dishId)
      .then((data) => setVariants(data ?? []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false))
  }, [dishId])

  if (loading) return (
    <div style={{ fontSize: 13, color: '#888', padding: '6px 0' }}>Đang tải biến thể...</div>
  )
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
                <img src={img} alt={v.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
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
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 800, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
      >
        {/* Hero image */}
        <div style={{ position: 'relative', height: imgUrl ? 240 : 80, flexShrink: 0, background: '#f5f0e8', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imgUrl ? (
            <>
              <img src={imgUrl} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: 14, left: 18 }}>
                <Badge className={d.status === 'PUBLISHED' ? 'published' : d.status === 'PENDING_REVIEW' ? 'pending' : 'draft'}>
                  &nbsp;{STATUS_LABEL[d.status as DishStatus]}
                </Badge>
              </div>
            </>
          ) : (
            <Badge className={d.status === 'PUBLISHED' ? 'published' : d.status === 'PENDING_REVIEW' ? 'pending' : 'draft'} style={{ fontSize: 13 }}>
              &nbsp;{STATUS_LABEL[d.status as DishStatus]}
            </Badge>
          )}
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 28px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Loading overlay */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888', fontSize: 13, padding: '4px 0' }}>
              <div style={{ width: 16, height: 16, border: '2px solid #f0a500', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Đang tải chi tiết...
            </div>
          )}

          {/* Header: title + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#161616', lineHeight: 1.3 }}>{d.name}</h2>
              {d.region && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>📍 {d.region.name}</p>}
            </div>
            <button
              onClick={() => { onClose(); onEdit(detail ?? dish) }}
              style={{ flexShrink: 0, background: '#f0a500', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ✏️ Chỉnh sửa
            </button>
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
                        <img src={imgSrc} alt={name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
          <VariantsSection dishId={d.id} />

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
      </div>
    </div>
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
            <button
              type="button"
              onClick={() => removeStep(idx)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, flexShrink: 0,
                borderRadius: 4, marginTop: 2,
              }}
              title="Xóa bước"
              onMouseEnter={e => (e.currentTarget.style.color = '#cf1322')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addStep}
        style={{
          marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px dashed #f0a500', borderRadius: 8,
          color: '#f0a500', padding: '7px 14px', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, width: '100%', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#fffbea')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <Plus size={14} /> Thêm bước
      </button>
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

interface IngredientRow { _id: number; name: string; ingredientId?: string; quantity: string; unit: string }
const emptyIngredient = (): IngredientRow => ({ _id: Date.now() + Math.random(), name: '', ingredientId: undefined, quantity: '', unit: 'g' })



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
        ingredientId: ing.ingredientId ?? undefined,
        quantity: String(ing.quantity ?? ''),
        unit: ing.unit ?? 'g',
      })))
    }
    setIngredientsInit(true)
  }, [dishDetail, ingredientsInit])

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

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Xóa ảnh này?')) return
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
        .map((i, idx) => ({ rawText: i.name.trim(), quantity: i.quantity ? Number(i.quantity) : undefined, unit: i.unit || undefined, sortOrder: idx + 1 }))

      // Build recipeSteps
      const stepsPayload = recipeSteps
        .filter(s => s.instruction.trim())
        .map((s, idx) => ({ stepOrder: idx + 1, instruction: s.instruction.trim(), durationMin: s.durationMin }))

      await updateDish.mutateAsync({
        id: dish.id,
        dto: {
          name: form.name,
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
        <div onClick={() => setPreviewUrl(null)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={previewUrl} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setPreviewUrl(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 14 }}>✕ Đóng</button>
        </div>
      )}

      <div className="modal-overlay" onClick={onClose}>
        <Card className="modal-card" onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 720, width: '100%', minHeight: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>✏️ Chỉnh sửa món ăn</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{dish.name}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: -2 }}><X size={22} /></button>
          </header>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginTop: 16, paddingLeft: 24, flexShrink: 0, overflowX: 'auto' }}>
            {CREATE_TABS.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px',
                  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  color: activeTab === tab.id ? '#f0a500' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.id ? '2px solid #f0a500' : '2px solid transparent',
                  marginBottom: -2,
                }}>
                {tab.label}
              </button>
            ))}
            {/* Tab ảnh riêng */}
            <button type="button" onClick={() => setActiveTab('media' as CreateTab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                color: activeTab === ('media' as CreateTab) ? '#f0a500' : 'var(--text-muted)',
                borderBottom: activeTab === ('media' as CreateTab) ? '2px solid #f0a500' : '2px solid transparent',
                marginBottom: -2,
              }}>
              🖼️ Hình ảnh {mediaList.length > 0 ? `(${mediaList.length})` : ''}
            </button>
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
                  <button type="button" onClick={addIngredient}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0a500', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <Plus size={14} /> Thêm
                  </button>
                </div>
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
                        onChange={(name, ingredient) => updateIngredient(ing._id, { name, ingredientId: ingredient?.id })}
                        placeholder="Tìm nguyên liệu..."
                      />
                      <Input placeholder="Số lượng" value={ing.quantity} onChange={(e) => updateIngredient(ing._id, { quantity: e.target.value })} style={{ flex: 1 }} />
                      <Select value={ing.unit} onChange={(e) => updateIngredient(ing._id, { unit: e.target.value })} style={{ flex: 1, padding: '0 8px', height: 38 }}>
                        {['g', 'kg', 'ml', 'lít', 'thìa', 'muỗng', 'chén', 'cái', 'bó', 'lá', 'quả', 'miếng'].map(u => <option key={u} value={u}>{u}</option>)}
                      </Select>
                      <button type="button" onClick={() => removeIngredient(ing._id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#cf1322')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                        <X size={16} />
                      </button>
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
                      <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} onClick={() => setPreviewUrl(m.url)} />
                      {m.isPrimary && (
                        <div style={{ position: 'absolute', top: 5, left: 5, background: '#f0a500', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>CHÍNH</div>
                      )}
                      {m.moderationStatus === 'PENDING' && (
                        <div style={{ position: 'absolute', bottom: 5, left: 5, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>Chờ duyệt</div>
                      )}
                      <div className="dish-thumb-overlay" style={{ borderRadius: 0 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setPreviewUrl(m.url)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 5, cursor: 'pointer', display: 'flex' }} title="Xem ảnh lớn">
                            <ZoomIn size={14} color="#fff" />
                          </button>
                          <button onClick={() => handleDeleteMedia(m.id)} disabled={deletingId === m.id}
                            style={{ background: 'rgba(220,50,50,0.8)', border: 'none', borderRadius: 6, padding: 5, cursor: 'pointer', display: 'flex' }} title="Xóa ảnh">
                            {deletingId === m.id ? <span style={{ color: '#fff', fontSize: 10 }}>...</span> : <Trash2 size={14} color="#fff" />}
                          </button>
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
        </Card>
      </div>
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
  const [open, setOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const lifecycle = useDishLifecycle()
  const deleteDish = useDeleteDish()
  const createDish = useCreateDish()
  const { isContentAdmin, isSuperAdmin } = useAuth()
  const canEdit = isContentAdmin || isSuperAdmin

  const close = () => setOpen(false)

  const handleDuplicate = async () => {
    close()
    if (!confirm(`Nhân bản món "${dish.name}"?`)) return
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
    close()
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

  actions.push({ label: '👁 Xem', fn: () => { close(); window.dispatchEvent(new CustomEvent('mogu:view-dish', { detail: dish })) } })
  if (canEdit) {
    actions.push({ label: '✏️ Chỉnh sửa', fn: () => { close(); navigate(`/foods/${dish.id}`) } })
    actions.push({ label: '📋 Nhân bản', fn: handleDuplicate })
  }
  actions.push({ label: '─────────', fn: () => { }, divider: true })

  if (canEdit && (dish.status === 'DRAFT' || dish.status === 'CHANGES_REQUESTED')) {
    actions.push({ label: '📤 Gửi duyệt', fn: () => { lifecycle.submitForReview.mutate({ id: dish.id }); close() } })
  }
  if (isSuperAdmin && dish.status === 'PENDING_REVIEW') {
    actions.push({ label: '⚡ Xuất bản ngay', fn: () => { lifecycle.publishDirect.mutate(dish.id); close() }, highlight: true })
  }
  if (dish.status === 'PUBLISHED') {
    actions.push({ label: '⏸ Hủy xuất bản', fn: () => { lifecycle.unpublish.mutate(dish.id); close() } })
  }
  if (dish.status === 'UNPUBLISHED') {
    actions.push({ label: '▶️ Xuất bản lại', fn: () => { lifecycle.republish.mutate(dish.id); close() } })
  }
  if (canEdit && !['ARCHIVED'].includes(dish.status)) {
    actions.push({ label: '🗃 Lưu trữ', fn: () => { lifecycle.archive.mutate(dish.id); close() } })
  }
  if (isSuperAdmin && dish.status === 'ARCHIVED') {
    actions.push({ label: '🔄 Khôi phục', fn: () => { lifecycle.restore.mutate(dish.id); close() } })
  }

  if (isSuperAdmin) {
    actions.push({ label: '─────────', fn: () => { }, divider: true })
    actions.push({ label: '🗑 Xóa vĩnh viễn', fn: handleDelete, danger: true })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => {
          if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            setMenuPos({
              top: rect.bottom + window.scrollY + 4,
              right: window.innerWidth - rect.right,
            })
          }
          setOpen(o => !o)
        }}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <MoreVertical size={20} />
      </button>
      {open && createPortal(
        <>
          {/* Backdrop vô hình để đóng menu khi click ngoài */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={close} />
          <div
            className="action-menu"
            style={{
              position: 'absolute',
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 9999,
            }}
          >
            {actions.map((a, i) =>
              a.divider ? (
                <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              ) : (
                <button
                  key={a.label}
                  className={
                    a.danger ? 'action-menu-item danger'
                      : a.highlight ? 'action-menu-item highlight'
                        : 'action-menu-item'
                  }
                  onClick={a.fn}
                >
                  {a.label}
                </button>
              )
            )}
          </div>
        </>,
        document.body,
      )}

      {/* Edit Modal render tại đây để có đúng context dish */}
      {showEdit && <EditDishModal dish={dish} onClose={() => setShowEdit(false)} categories={categories ?? []} mealTypes={mealTypes ?? []} regions={regions ?? []} />}

      {/* Inline Delete Confirm Dialog */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🗑</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#1a1a1a', textAlign: 'center' }}>Xóa vĩnh viễn?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 1.5 }}>
              Món <b>"{dish.name}"</b> sẽ bị xóa vĩnh viễn.<br />Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#444' }}
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteDish.isPending}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', opacity: deleteDish.isPending ? 0.7 : 1 }}
              >
                {deleteDish.isPending ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 48px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <p>Đang tải dữ liệu món ăn...</p>
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
          <Button size="sm" onClick={() => { selected.forEach((id) => lifecycle.submitForReview.mutate({ id })); setSelected([]) }}>Gửi duyệt</Button>
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
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={dishes.length > 0 && dishes.every((d) => selected.includes(d.id))}
                    onChange={(e) => setSelected(e.target.checked ? dishes.map((d) => d.id) : [])}
                  />
                </th>
                <th style={{ width: 72 }}>Ảnh</th>
                <th>Món ăn</th>
                <th>Danh mục</th>
                <th>Dinh dưỡng</th>
                <th>Rating</th>
                <th>Trạng thái</th>
                <th>Cập nhật ↓</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {dishes.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    Chưa có món ăn nào
                  </td>
                </tr>
              )}
              {dishes.map((dish) => {
                const primaryMedia = dish.media?.find((m: any) => m.isPrimary) ?? dish.media?.[0]
                const imgUrl = getMediaUrl(primaryMedia)
                const nutrition = (dish as any).nutrition
                const category = dish.categories?.[0]
                return (
                  <tr
                    key={dish.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      // Không mở detail nếu click vào checkbox, button, input, action menu
                      if ((e.target as HTMLElement).closest('button, input, [data-no-detail]')) return
                      setDetailDish(dish)
                    }}
                  >
                    <td data-no-detail onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(dish.id)} onChange={() => toggleSelect(dish.id)} />
                    </td>

                    {/* ── Cột ảnh thumbnail ── */}
                    <td style={{ padding: '8px 10px' }} data-no-detail onClick={e => e.stopPropagation()}>
                      <div style={{ position: 'relative', width: 56, height: 56 }} className="dish-thumb-wrap">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={dish.name}
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, display: 'block', border: '1px solid var(--border)', cursor: 'zoom-in' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div style={{ width: 56, height: 56, background: 'var(--bg-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)' }}>
                            <Utensils size={18} color="var(--text-muted)" />
                          </div>
                        )}
                        {/* Overlay: click ảnh → preview, không có ảnh → upload */}
                        <div className="dish-thumb-overlay">
                          {imgUrl ? (
                            <button
                              onClick={() => setPreviewImg({ url: imgUrl, name: dish.name })}
                              style={{ background: 'none', border: 'none', cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
                            >
                              <ZoomIn size={18} color="#fff" />
                            </button>
                          ) : (
                            <UploadMediaButton dishId={dish.id} iconOnly />
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="food-cell">
                      <span>
                        <b>{dish.name}</b>
                        <small>#{dish.id.slice(0, 8)}</small>
                      </span>
                    </td>
                    <td>
                      {category ? <Badge>{category.name}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
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
                    </td>
                    <td style={{ textAlign: 'center' }}>
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
                    </td>
                    <td>
                      <Badge className={STATUS_CLASS[dish.status]}>• &nbsp;{STATUS_LABEL[dish.status]}</Badge>
                    </td>
                    <td>
                      {new Date(dish.updatedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td data-no-detail onClick={e => e.stopPropagation()}>
                      <DishActionMenu dish={dish} categories={categories ?? []} mealTypes={mealTypes ?? []} regions={regions ?? []} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="pagination">
          <span>
            Hiển thị{' '}
            <select
              value={query.limit ?? 20}
              onChange={(e) => {
                setQuery(q => ({ ...q, limit: Number(e.target.value) }))
                setCursor(undefined)
              }}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                fontSize: 13, background: '#fff', cursor: 'pointer',
              }}
            >
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>{' '}
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
    </>
  )
}
