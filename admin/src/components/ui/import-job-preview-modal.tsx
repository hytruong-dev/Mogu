import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, ChefHat, Clock3, Edit3,
  Flame, ImageOff, Leaf, Utensils, X,
} from 'lucide-react'
import { Button } from './button'
import { useImportJob } from '../../hooks/useImportJobs'
import { useAdminDish } from '../../hooks/useDishes'

interface Props {
  jobId: string
  onClose: () => void
}

const DIFF_LABEL: Record<string, string> = {
  EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó',
}

export function ImportJobPreviewModal({ jobId, onClose }: Props) {
  const navigate = useNavigate()
  const { data: job } = useImportJob(jobId)
  const { data: dish } = useAdminDish(job?.resultDishId ?? '')
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  if (!job) return null

  const suggestedImg = (job as any).suggestedImageUrl as string | undefined
  const displayImg = !imgError && suggestedImg ? suggestedImg : null
  const nutrition = (dish as any)?.nutrition
  const ingredients: any[] = (dish as any)?.dishIngredients ?? []
  const steps: any[] = (dish as any)?.recipeSteps ?? []

  const handleOpenEdit = () => {
    onClose()
    if (job.resultDishId) navigate(`/foods/${job.resultDishId}`)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#faf7f2',
          borderRadius: 20,
          width: '100%', maxWidth: 740,
          maxHeight: '92vh', overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── Hero image ── */}
        <div style={{
          position: 'relative',
          height: displayImg ? 240 : 90,
          flexShrink: 0,
          background: displayImg ? '#f5f0e8' : 'linear-gradient(135deg,#181919,#2a2a28)',
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {displayImg ? (
            <>
              <img src={displayImg} alt={job.query} onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)' }} />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#888' }}>
              <ImageOff size={28} />
              <span style={{ fontSize: 12 }}>Chưa có ảnh</span>
            </div>
          )}

          {/* Close */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <X size={18} />
          </button>

          {/* Badge */}
          <div style={{
            position: 'absolute', top: 14, left: 18,
            background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
            color: '#ffd43b', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600,
          }}>
            ✦ AI Generated · DRAFT
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '22px 26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Title + Edit btn */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: '#1a1008' }}>
                {dish?.name ?? job.query}
              </h2>
              {job.regionHint && (
                <span style={{ fontSize: 13, color: '#888', marginTop: 2, display: 'block' }}>
                  {job.regionHint === 'north' ? '📍 Miền Bắc' : job.regionHint === 'south' ? '📍 Miền Nam' : job.regionHint === 'central' ? '📍 Miền Trung' : `📍 ${job.regionHint}`}
                </span>
              )}
            </div>
            <Button onClick={handleOpenEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Edit3 size={14} /> Chỉnh sửa
            </Button>
          </div>

          {/* Short description */}
          {(dish as any)?.shortDescription && (
            <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.7, background: '#fff', padding: '14px 18px', borderRadius: 12, border: '1px solid #ede8df' }}>
              {(dish as any).shortDescription}
            </p>
          )}

          {/* Quick stats — giống hình 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 10 }}>
            {[
              { icon: <Clock3 size={16} />,   label: 'Chuẩn bị', value: dish?.prepMinutes ? `${dish.prepMinutes} phút` : '—' },
              { icon: <Flame size={16} />,    label: 'Nấu',      value: dish?.cookMinutes ? `${dish.cookMinutes} phút` : '—' },
              { icon: <Utensils size={16} />, label: 'Khẩu phần', value: dish?.servings   ? `${dish.servings} người`  : '—' },
              { icon: <ChefHat size={16} />,  label: 'Độ khó',   value: dish?.difficulty  ? DIFF_LABEL[dish.difficulty] ?? dish.difficulty : '—' },
              { icon: <span style={{ fontSize: 15 }}>💰</span>, label: 'Giá từ', value: dish?.priceMin ? `${Number(dish.priceMin).toLocaleString('vi-VN')}₫` : '—' },
              { icon: <span style={{ fontSize: 15 }}>💰</span>, label: 'Giá đến', value: dish?.priceMax ? `${Number(dish.priceMax).toLocaleString('vi-VN')}₫` : '—' },
            ].map((item) => (
              <div key={item.label} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #ede8df', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ color: '#f0a500' }}>{item.icon}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1008' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Nutrition — giống hình 1 */}
          {nutrition && (
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#1a1008' }}>
                <Leaf size={15} style={{ color: '#4caf50' }} />
                Dinh dưỡng / khẩu phần
                {nutrition.servingName && <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>({nutrition.servingName})</span>}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: 8 }}>
                {[
                  { label: 'Calories',  value: nutrition.calories,  unit: 'kcal', color: '#ff6b35' },
                  { label: 'Protein',   value: nutrition.proteinG,  unit: 'g',    color: '#4caf50' },
                  { label: 'Tinh bột',  value: nutrition.carbsG,    unit: 'g',    color: '#2196f3' },
                  { label: 'Chất béo',  value: nutrition.fatG,      unit: 'g',    color: '#ff9800' },
                  { label: 'Chất xơ',   value: nutrition.fiberG,    unit: 'g',    color: '#8bc34a' },
                  { label: 'Natri',     value: nutrition.sodiumMg,  unit: 'mg',   color: '#9c27b0' },
                ].filter(n => n.value != null).map(n => (
                  <div key={n.label} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: `2px solid ${n.color}22`, textAlign: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: n.color, lineHeight: 1 }}>{n.value}</div>
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>{n.unit}</div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>{n.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients — giống hình 1: grid 3 cột có ảnh */}
          {ingredients.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1a1008', display: 'flex', alignItems: 'center', gap: 6 }}>
                🥬 Nguyên liệu <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>({ingredients.length} loại)</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {ingredients.map((ing: any, idx: number) => {
                  const imgUrl = ing.ingredient?.imageUrl
                  const name = ing.ingredient?.name ?? ing.rawText?.replace(/^\d[\d.]*\s+\S+\s+/, '').replace(/\s*\(.*\)/, '') ?? '?'
                  const qty = ing.rawText?.match(/^([\d.]+)\s+(\S+)/)?.[0] ?? (ing.quantity ? `${ing.quantity} ${ing.unit ?? ''}` : '')
                  return (
                    <div key={idx} style={{
                      background: '#fff', borderRadius: 12, padding: '10px 12px',
                      border: '1px solid #ede8df',
                      display: 'flex', alignItems: 'center', gap: 10,
                      minWidth: 0,
                    }}>
                      {/* Ảnh ingredient */}
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: '#f5f0e8',
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {imgUrl
                          ? <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 20 }}>🥄</span>
                        }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1008', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {name}
                        </div>
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{qty}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recipe steps — giống hình 2 */}
          {steps.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1a1008', display: 'flex', alignItems: 'center', gap: 6 }}>
                👨‍🍳 Cách nấu <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>({steps.length} bước)</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {steps.map((step: any) => {
                  const lines = (step.instruction ?? '').split('\n')
                  const hasTitle = lines[0]?.startsWith('**')
                  const titleLine = hasTitle ? lines[0].replace(/\*\*/g, '') : `Bước ${step.stepOrder}`
                  const bodyLines = (hasTitle ? lines.slice(1) : lines).filter((l: string) => l && !l.startsWith('💡'))
                  const tipLine = lines.find((l: string) => l.startsWith('💡'))
                  return (
                    <div key={step.stepOrder} style={{ background: '#fff', borderRadius: 14, border: '1px solid #ede8df', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fffbf2', borderBottom: '1px solid #f0e8d0' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#f0a500', color: '#fff', fontWeight: 800, fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {step.stepOrder}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1008', flex: 1 }}>{titleLine}</span>
                        {step.durationMin != null && step.durationMin > 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: '#f0a500', fontWeight: 700,
                            background: '#fff8e1', padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                          }}>
                            <Clock3 size={12} /> {step.durationMin} phút
                          </span>
                        )}
                      </div>
                      {/* Body */}
                      <div style={{ padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontSize: 13.5, color: '#444', lineHeight: 1.75 }}>
                          {bodyLines.join('\n') || (hasTitle ? '' : step.instruction)}
                        </p>
                        {tipLine && (
                          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#666', background: '#fffbf0', padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid #f0a500' }}>
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

          {/* AI pipeline logs */}
          {job.logs && job.logs.length > 0 && (
            <div style={{ borderTop: '1px solid #ede8df', paddingTop: 16 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#999', display: 'flex', alignItems: 'center', gap: 6 }}>
                📋 Log pipeline AI
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {job.logs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#666', alignItems: 'flex-start' }}>
                    <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <span style={{ fontWeight: 600, color: '#f0a500' }}>[{log.step}]</span>{' '}
                      <span style={{ color: '#444' }}>{log.message}</span>
                      {log.detail && <span style={{ color: '#aaa', marginLeft: 4 }}>— {log.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: ID + timestamp + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid #ede8df', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>
              ID: {job.resultDishId ?? jobId}
              {job.completedAt && ` · Cập nhật: ${new Date(job.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(job.completedAt).toLocaleDateString('vi-VN')}`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={onClose}>Đóng</Button>
              <Button onClick={handleOpenEdit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit3 size={14} /> Mở form chỉnh sửa →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
