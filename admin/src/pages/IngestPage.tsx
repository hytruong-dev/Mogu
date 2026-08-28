import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  Clock3,
  Database,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { ImportJobPreviewModal } from '../components/ui/import-job-preview-modal'
import {
  useCreateImportJob,
  useImportJobActions,
  useImportJobs,
  useJobProgress,
} from '../hooks/useImportJobs'
import { useAdminDish } from '../hooks/useDishes'
import { useRegions } from '../hooks/useTaxonomy'
import type { ImportJob, ImportJobStatus } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_DEFS = [
  { key: 'SEARCHING', label: 'Tìm nguồn', desc: 'Phân tích yêu cầu và xây dựng context.' },
  { key: 'EXTRACTING', label: 'Trích xuất AI', desc: 'Gọi AI để sinh công thức và nguyên liệu.' },
  { key: 'NORMALIZING', label: 'Chuẩn hóa', desc: 'Đổi đơn vị, chuẩn hóa tên nguyên liệu.' },
  { key: 'RECONCILING', label: 'Đối chiếu', desc: 'Kiểm tra trùng lặp với kho món ăn.' },
  { key: 'ENRICHING', label: 'Làm giàu dữ liệu', desc: 'Ước tính dinh dưỡng từ danh sách nguyên liệu.' },
  { key: 'DRAFTING', label: 'Tạo bản nháp', desc: 'Lưu món ăn DRAFT vào hệ thống.' },
]

const ACTIVE_STATUSES: ImportJobStatus[] = [
  'PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING', 'RECONCILING', 'ENRICHING', 'DRAFTING',
]

const SOURCE_OPTIONS = [
  { value: 'AI_GENERATED', label: 'AI tổng hợp', description: 'Dùng AI để sinh công thức từ tên món.' },
  { value: 'JSON_LD', label: 'Website công thức', description: 'Ưu tiên các trang có dữ liệu có cấu trúc.' },
  { value: 'VIDEO', label: 'Video YouTube', description: 'Trích xuất từ video hướng dẫn nấu ăn.' },
  { value: 'NUTRITION', label: 'Cơ sở dữ liệu dinh dưỡng', description: 'USDA FoodData Central và nguồn chuẩn.' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepTracker({ job, dark = false }: { job: ImportJob; dark?: boolean }) {
  const ws = useJobProgress(job.id)
  const currentStatus = ws?.status ?? job.status
  const currentStepIndex = ws?.stepIndex ?? job.currentStep
  const currentMessage = ws?.message ?? job.currentStepMessage
  const progress = ws?.progress ?? job.progress

  const isDone = currentStatus === 'DONE'
  const isFailed = currentStatus === 'FAILED'
  const isCancelled = currentStatus === 'CANCELLED'
  const isFinished = isDone || isFailed || isCancelled

  return (
    <div style={{ padding: '8px 0 4px' }}>
      {/* Pipeline steps — giống hình 2 */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {STEP_DEFS.map((step, i) => {
          const stepNum = i + 1
          const isLast = i === STEP_DEFS.length - 1
          const isActive = !isFinished && currentStepIndex === stepNum
          const isDoneStep = isDone || currentStepIndex > stepNum
          const isFailedStep = isFailed && currentStepIndex === stepNum
          const isPending = !isDoneStep && !isActive && !isFailedStep

          // Màu bubble
          const bubbleBg = isDoneStep
            ? '#22c55e'
            : isActive
              ? '#f0a500'
              : isFailedStep
                ? '#ef4444'
                : '#d1d5db'

          return (
            <div key={step.key} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minHeight: isLast ? 'auto' : 52 }}>
              {/* Cột trái: số tròn + đường nét đứt */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                {/* Số tròn */}
                <div style={{
                  width: 30, height: 30,
                  borderRadius: '50%',
                  background: bubbleBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  boxShadow: isActive ? `0 0 0 4px ${bubbleBg}33` : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {/* Ring animation khi active */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', inset: -4,
                      borderRadius: '50%',
                      border: '2px solid #f0a500',
                      opacity: 0.5,
                      animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                    }} />
                  )}
                  {isDoneStep ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isFailedStep ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : isActive ? (
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      border: '2px solid white', borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: isPending ? '#9ca3af' : 'white' }}>
                      {stepNum}
                    </span>
                  )}
                </div>

                {/* Đường nét đứt nối xuống bước tiếp theo */}
                {!isLast && (
                  <div style={{
                    width: 2,
                    flex: 1,
                    minHeight: 18,
                    marginTop: 3,
                    backgroundImage: isDoneStep
                      ? 'linear-gradient(to bottom, #22c55e 50%, transparent 50%)'
                      : dark
                        ? 'linear-gradient(to bottom, rgba(245,240,232,0.2) 50%, transparent 50%)'
                        : 'linear-gradient(to bottom, #d1d5db 50%, transparent 50%)',
                    backgroundSize: '2px 6px',
                    backgroundRepeat: 'repeat-y',
                  }} />
                )}
              </div>

              {/* Cột phải: label + desc / message */}
              <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 12 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isDoneStep
                    ? (dark ? 'rgba(245,240,232,0.35)' : '#9ca3af')
                    : isActive
                      ? (dark ? '#f5f0e8' : '#1f2937')
                      : (dark ? 'rgba(245,240,232,0.45)' : '#6b7280'),
                  lineHeight: 1.3,
                  transition: 'color 0.3s',
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: 12,
                  color: dark ? 'rgba(245,240,232,0.4)' : (isActive ? '#6b7280' : '#d1d5db'),
                  marginTop: 2,
                  lineHeight: 1.4,
                  maxWidth: 260,
                }}>
                  {step.desc}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress bar ở dưới */}
      {!isFinished && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{
            flex: 1, height: 5,
            background: dark ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
            borderRadius: 99,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #f0a500, #f59e0b)',
              borderRadius: 99,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#f0a500', minWidth: 34, textAlign: 'right' }}>
            {progress}%
          </span>
        </div>
      )}

      {/* Done / Failed banner */}
      {isDone && (
        <div style={{ marginTop: 10, padding: '6px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✅ Hoàn tất — bản nháp đã được tạo thành công!
        </div>
      )}
      {isFailed && (
        <div style={{ marginTop: 10, padding: '6px 10px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
          ❌ {currentMessage ?? 'Pipeline thất bại'}
        </div>
      )}
    </div>
  )
}

// Parse thông tin tóm tắt từ logs AI
function parseJobSummary(job: ImportJob) {
  const logs = job.logs ?? []
  const ingLog = logs.find(l => l.step === 'EXTRACTING' || l.step === 'NORMALIZING')
  const nutLog = logs.find(l => l.step === 'ENRICHING')
  const ingMatch = ingLog?.message?.match(/(\d+)\s*nguyên liệu/)
  const stepMatch = ingLog?.message?.match(/(\d+)\s*bước/)
  const calMatch = nutLog?.message?.match(/(\d+)\s*kcal/)
  const protMatch = nutLog?.message?.match(/([\d.]+)g\s*đạm/)
  return {
    ingredients: ingMatch ? ingMatch[1] : null,
    steps: stepMatch ? stepMatch[1] : null,
    calories: calMatch ? calMatch[1] : null,
    protein: protMatch ? protMatch[1] : null,
  }
}

function ImportProgressView({
  job,
  onCancel,
}: {
  job: ImportJob
  onCancel: () => void
}) {
  const ws = useJobProgress(job.id)
  const currentStep = ws?.stepIndex ?? job.currentStep
  const progress = ws?.progress ?? job.progress
  const message = ws?.message ?? job.currentStepMessage ?? 'AI đang xử lý dữ liệu món ăn...'

  return (
    <div className="ai-progress-page">
      <h1>AI đang tạo món {job.query}</h1>
      <p className="ai-progress-subtitle">Bạn có thể rời trang; tiến trình vẫn tiếp tục.</p>
      <div className="ai-progress-layout">
        <Card className="ai-progress-card">
          <div className="ai-progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}>
            <span>{progress}%</span>
          </div>
          <b className="ai-progress-message">{message}</b>
          <div
            className="ai-progress-steps"
            style={{ '--step-progress': `${Math.max(0, Math.min(1, (currentStep - 1) / 5))}` } as CSSProperties}
          >
            {[
              'Phân tích',
              'Tạo dữ liệu',
              'Chuẩn hóa',
              'Đối chiếu',
              'Bổ sung',
              'Tạo bản nháp',
            ].map((label, index) => {
              const step = index + 1
              return <div className={step < currentStep ? 'complete' : step === currentStep ? 'current' : ''} key={label}>
                <span>{step < currentStep ? '✓' : step}</span>
                <b>{label}</b>
                {step === currentStep && <i className="ai-step-pulse" />}
              </div>
            })}
          </div>
          <div className="ai-progress-meta"><span>◷ Đã chạy {Math.max(1, Math.round(progress / 3))} giây</span><i /> <span>⌘ Mã job {job.id.slice(0, 12).toUpperCase()}</span></div>
          <div className="ai-progress-actions">
            <Button variant="outline" onClick={() => window.history.back()}>↻ Chạy nền</Button>
            <button onClick={onCancel}>Hủy</button>
          </div>
          <details className="ai-technical-details">
            <summary>☷ Chi tiết kỹ thuật</summary>
            <p>{message}</p>
          </details>
        </Card>
        <aside className="ai-after-complete">
          <span>✦</span>
          <b>Sau khi hoàn tất</b>
          <p>Món ăn sẽ được lưu dưới dạng <strong>BẢN NHÁP</strong>. Bạn có thể mở để kiểm tra và chỉnh sửa trước khi gửi duyệt.</p>
        </aside>
      </div>
    </div>
  )
}

function ImportSuccessView({ job, onNew }: { job: ImportJob; onNew: () => void }) {
  const navigate = useNavigate()
  const { data: dish } = useAdminDish(job.resultDishId ?? '')
  const summary = parseJobSummary(job)
  const image = (job as any).suggestedImageUrl as string | undefined
  const nutrition = (dish as any)?.nutrition
  const ingredients = (dish as any)?.dishIngredients ?? []
  const steps = (dish as any)?.recipeSteps ?? []
  const dishName = dish?.name ?? job.query

  return (
    <div className="ai-success-page">
      <div className="ai-success-check">✓</div>
      <h1>Đã tạo bản nháp</h1>
      <p>AI đã hoàn tất {dishName}. Hãy kiểm tra trước khi gửi duyệt.</p>
      <Card className="ai-success-card">
        <header><span>♨</span><div><b>{dishName}</b><small><em>BẢN NHÁP</em> · DISH-{(job.resultDishId ?? job.id).slice(0, 6).toUpperCase()}</small></div></header>
        <div className="ai-success-counts">
          <div><b>{ingredients.length || summary.ingredients || 0}</b><small>nguyên liệu</small></div>
          <div><b>{steps.length || summary.steps || 0}</b><small>bước chế biến</small></div>
          <div><b>{[nutrition?.calories, nutrition?.proteinG, nutrition?.carbsG, nutrition?.fatG, nutrition?.fiberG].filter(Boolean).length || 0}</b><small>chỉ số dinh dưỡng</small></div>
          <div><b>{image ? 1 : 0}</b><small>ảnh minh họa</small></div>
        </div>
        <div className="ai-success-warning">△ Dữ liệu do AI tạo có thể chưa chính xác. Cần kiểm tra nguyên liệu, định lượng, khẩu phần và dinh dưỡng.</div>
        <div className="ai-success-summary">
          <div className="ai-success-image">{image ? <img src={image} alt={dishName} /> : '🍜'}</div>
          <div><small>◷ Thời gian chế biến</small><b>{dish?.cookMinutes ?? '—'} phút</b></div>
          <div><small>⚑ Khẩu phần</small><b>{dish?.servings ?? '—'} người</b></div>
          <div><small>♨ Năng lượng</small><b>{nutrition?.calories ?? summary.calories ?? '—'} kcal</b></div>
          <div><small>☆ Độ khó</small><b>{dish?.difficulty === 'EASY' ? 'Dễ' : dish?.difficulty === 'HARD' ? 'Khó' : 'Trung bình'}</b></div>
        </div>
        <Button className="ai-success-edit" onClick={() => job.resultDishId && navigate(`/foods/${job.resultDishId}`)}>✎ Mở để chỉnh sửa</Button>
        <footer><Button variant="outline" onClick={() => navigate('/foods')}>⌘ Về kho món</Button><Button variant="outline" onClick={onNew}>＋ Nhập món khác</Button></footer>
      </Card>
    </div>
  )
}

function LegacyJobCard({ job, onPreview, onRetry }: { job: ImportJob; onPreview: (id: string) => void; onRetry: (job: ImportJob) => void }) {
  const actions = useImportJobActions()
  const ws = useJobProgress(job.id)
  const currentStatus = ws?.status ?? job.status
  const [imgError, setImgError] = useState(false)

  const isDone = currentStatus === 'DONE'
  const isFailed = currentStatus === 'FAILED'
  const isCancelled = currentStatus === 'CANCELLED'
  const isActive = ACTIVE_STATUSES.includes(currentStatus)
  const resultDishId = ws?.resultDishId ?? job.resultDishId
  const suggestedImg = (ws as any)?.suggestedImageUrl ?? (job as any).suggestedImageUrl
  const showImg = suggestedImg && !imgError

  const summary = isDone ? parseJobSummary(job) : null

  const regionLabel =
    job.regionHint === 'north' ? 'Miền Bắc' :
      job.regionHint === 'south' ? 'Miền Nam' :
        job.regionHint === 'central' ? 'Miền Trung' : null

  // Card đẹp — active dùng dark bg giống pipeline preview, done dùng light
  return (
    <div
      onClick={() => isDone && resultDishId && onPreview(job.id)}
      style={{
        border: isActive ? '1px solid rgba(240,165,0,0.3)' : '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        background: isActive ? '#1c1c1a' : 'var(--bg-card)',
        cursor: isDone && resultDishId ? 'pointer' : 'default',
        transition: 'box-shadow 0.18s, transform 0.18s',
        boxShadow: isActive ? '0 4px 20px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        if (isDone && resultDishId) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.13)'
            ; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
          ; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      {/* ── Thumbnail / Hero ── */}
      <div style={{
        height: showImg ? 140 : isActive ? 0 : 72,
        background: showImg ? '#f5f0e8' : 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'height 0.3s',
      }}>
        {showImg ? (
          <img
            src={suggestedImg}
            alt={job.query}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : !isActive && (
          <span style={{ fontSize: 32 }}>🍽️</span>
        )}
        {/* gradient overlay cho ảnh */}
        {showImg && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)' }} />
        )}
        {/* AI badge */}
        {isDone && (
          <div style={{
            position: 'absolute', bottom: 8, left: 10,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            color: '#ffd43b', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
          }}>
            ✦ AI · DRAFT
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: isActive ? '#f5f0e8' : '#161616', textTransform: 'capitalize' }}>{job.query}</span>
              <Badge className={isDone ? 'published' : isFailed ? 'pending' : isCancelled ? 'draft' : 'draft'} style={{ fontSize: 11 }}>
                {isDone ? '✓ Hoàn tất' : isFailed ? '✗ Thất bại' : isCancelled ? 'Đã hủy' : '● Đang chạy'}
              </Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: isActive ? 'rgba(245,240,232,0.5)' : 'var(--text-muted)' }}>
                {new Date(job.createdAt).toLocaleString('vi-VN')}
              </span>
              {job.completedAt && (
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>
                  · Xong {new Date(job.completedAt).toLocaleTimeString('vi-VN')}
                </span>
              )}
              {regionLabel && (
                <span style={{ fontSize: 11, color: '#f0a500', background: '#fff8e6', borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>
                  📍 {regionLabel}
                </span>
              )}
            </div>
          </div>

          {/* Cancel button — chỉ khi active */}
          {isActive && (
            <button
              onClick={e => { e.stopPropagation(); actions.cancel.mutate(job.id) }}
              disabled={actions.cancel.isPending}
              style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: 'rgba(245,240,232,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={12} /> Hủy
            </button>
          )}
        </div>

        {/* Active: StepTracker */}
        {isActive && <StepTracker job={job} dark />}

        {/* Done: stats chips */}
        {isDone && summary && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {summary.ingredients && (
              <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #bbf7d0' }}>
                🥬 {summary.ingredients} nguyên liệu
              </span>
            )}
            {summary.steps && (
              <span style={{ background: '#faf5ff', color: '#7c3aed', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #ddd6fe' }}>
                👨‍🍳 {summary.steps} bước nấu
              </span>
            )}
            {summary.calories && (
              <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #fed7aa' }}>
                🔥 {summary.calories} kcal
              </span>
            )}
            {summary.protein && (
              <span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #bae6fd' }}>
                💪 {summary.protein}g đạm
              </span>
            )}
          </div>
        )}

        {/* Failed: error */}
        {isFailed && job.errorMessage && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#dc2626', border: '1px solid #fecaca' }}>
            ⚠️ {job.errorMessage}
          </div>
        )}

        {(isFailed || isCancelled) && (
          <Button
            variant="outline"
            onClick={e => { e.stopPropagation(); onRetry(job) }}
            style={{ alignSelf: 'flex-start', fontSize: 12, height: 32 }}
          >
            ↻ Tạo lại job
          </Button>
        )}

        {/* Done footer — hint to click */}
        {isDone && resultDishId && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)', marginTop: 2 }}>
            <span style={{ fontSize: 11, color: isActive ? 'rgba(245,240,232,0.5)' : 'var(--text-muted)' }}>Nhấp để xem chi tiết</span>
            <span style={{ fontSize: 12, color: '#f0a500', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Xem bản nháp <ArrowRight size={13} />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

void LegacyJobCard

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IngestPage() {
  const { data: regions } = useRegions()
  const { data: jobsData, isLoading } = useImportJobs({ limit: 20 })
  const createJob = useCreateImportJob()
  const importJobActions = useImportJobActions()

  const [dishName, setDishName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(['AI_GENERATED'])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState<'ALL' | 'ACTIVE' | 'DONE' | 'FAILED' | 'CANCELLED'>('ALL')
  const [dismissedSuccessJobId, setDismissedSuccessJobId] = useState<string | null>(null)

  const toggleSource = (val: string) =>
    setSelectedSources((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val],
    )

  const handleSubmit = async () => {
    if (!dishName.trim()) {
      setSubmitError('Vui lòng nhập tên món ăn')
      return
    }
    setSubmitError('')
    try {
      await createJob.mutateAsync({
        query: dishName.trim(),
        relatedKeywords: keywords.trim()
          ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
          : undefined,
        regionHint: regionCode || undefined,
        sourceTypes: selectedSources,
      })
      setDishName('')
      setKeywords('')
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message ?? e?.message ?? 'Lỗi không xác định'
      if (status === 401) {
        // Token hết hạn — redirect login (interceptor đã thử refresh, không được)
        window.location.href = '/login'
      } else {
        setSubmitError('Tạo job thất bại: ' + msg)
      }
    }
  }

  const handleRetry = (job: ImportJob) => {
    setDishName(job.query)
    setKeywords(job.relatedKeywords?.join(', ') ?? '')
    setRegionCode(job.regionHint ?? '')
    setSelectedSources(job.sourceTypes?.length ? job.sourceTypes : ['AI_GENERATED'])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const jobs = jobsData?.data ?? []
  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status))
  const latestCompletedJob = jobs.find((job) => job.status === 'DONE' && job.resultDishId)
  const filteredHistoryJobs = jobs.filter((job) =>
    job.query.toLocaleLowerCase('vi-VN').includes(historyQuery.toLocaleLowerCase('vi-VN')) &&
    (historyStatus === 'ALL' ||
      (historyStatus === 'ACTIVE' && ACTIVE_STATUSES.includes(job.status)) ||
      job.status === historyStatus),
  )

  if (showHistory) {
    const relativeTime = (value: string) => {
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
      if (minutes < 1) return 'Vừa xong'
      if (minutes < 60) return `${minutes} phút trước`
      if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`
      return `${Math.floor(minutes / 1440)} ngày trước`
    }
    const statusLabel = (status: ImportJobStatus) =>
      status === 'DONE' ? 'Đã tạo bản nháp' : status === 'FAILED' ? 'Thất bại' : status === 'CANCELLED' ? 'Đã hủy' : 'Đang xử lý'

    return (
      <div className="ai-import-history-page">
        <div className="ai-history-heading">
          <div>
            <h1>Lịch sử nhập món bằng AI</h1>
            <p>Theo dõi các lần tạo bản nháp gần đây.</p>
          </div>
          <Button onClick={() => setShowHistory(false)}>⊕ Nhập món mới</Button>
        </div>

        <Card className="ai-history-filter">
          <div className="ai-history-search">
            <Search size={16} />
            <Input className='border-none focus:border-none' value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Tìm theo tên món..." />
          </div>
          <select
            value={historyStatus}
            onChange={(event) => setHistoryStatus(event.target.value as typeof historyStatus)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DONE">Đã tạo bản nháp</option>
            <option value="ACTIVE">Đang xử lý</option>
            <option value="FAILED">Thất bại</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </Card>

        <Card className="ai-history-table-wrap">
          <table className="ai-history-table">
            <thead><tr><th>Món ăn</th><th>Trạng thái</th><th>Tiến trình</th><th>Thời gian</th><th>Thao tác</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="ai-history-empty"><Loader2 size={18} /> Đang tải lịch sử...</td></tr>}
              {!isLoading && filteredHistoryJobs.length === 0 && <tr><td colSpan={5} className="ai-history-empty">Chưa tìm thấy lần nhập món phù hợp.</td></tr>}
              {filteredHistoryJobs.map((job) => {
                const active = ACTIVE_STATUSES.includes(job.status)
                const successful = job.status === 'DONE'
                return <tr key={job.id}>
                  <td><div className="ai-history-dish"><span>🍜</span><b>{job.query}</b></div></td>
                  <td><span className={`ai-history-status ${job.status.toLowerCase()}`}>● {statusLabel(job.status)}</span></td>
                  <td>{(successful || active) ? <div className="ai-history-progress"><b>{successful ? 100 : job.progress}%</b><i><em style={{ width: `${successful ? 100 : job.progress}%` }} /></i></div> : '—'}</td>
                  <td>{relativeTime(job.completedAt ?? job.createdAt)}</td>
                  <td>
                    {successful && job.resultDishId ? <Button variant="outline" size="sm" onClick={() => setPreviewJobId(job.id)}>▣ Mở bản nháp</Button>
                      : active ? <Button variant="outline" size="sm" onClick={() => { setShowHistory(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>◷ Xem tiến trình</Button>
                        : <Button variant="outline" size="sm" onClick={() => { handleRetry(job); setShowHistory(false) }}>⟳ Tạo lại job</Button>}
                  </td>
                </tr>
              })}
            </tbody>
          </table>
        </Card>
        {previewJobId && <ImportJobPreviewModal jobId={previewJobId} onClose={() => setPreviewJobId(null)} />}
      </div>
    )
  }

  if (activeJobs.length > 0) {
    const job = activeJobs[0]
    return <ImportProgressView job={job} onCancel={() => importJobActions.cancel.mutate(job.id)} />
  }

  if (latestCompletedJob && dismissedSuccessJobId !== latestCompletedJob.id) {
    return <ImportSuccessView job={latestCompletedJob} onNew={() => setDismissedSuccessJobId(latestCompletedJob.id)} />
  }

  return (
    <>
      <div className="page-heading ingest-heading">
        <div>
          <h1>Nhập món bằng AI</h1>
          <p>Nhập tên món, AI sẽ tạo một bản nháp để bạn kiểm tra và chỉnh sửa.</p>
        </div>
        <Button variant="outline" onClick={() => setShowHistory(true)}>◷ Lịch sử nhập</Button>
      </div>

      <div className="ingest-grid">
        {/* ── Form ── */}
        <Card className="form-card">
          <label>
            Tên món ăn *
            <Input
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="Phở bò"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </label>

          <button
            type="button"
            className="ingest-advanced-toggle"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
          >
            <span><span className="ingest-tune-icon">☷</span><b>Tùy chọn nâng cao</b><small>Từ khóa liên quan và vùng miền</small></span>
            <span className={showAdvanced ? 'ingest-chevron open' : 'ingest-chevron'}>⌄</span>
          </button>

          {showAdvanced && <>
            <label>
              Từ khóa liên quan
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="phở tái, Vietnamese beef pho" />
              <small>Giúp AI hiểu ngữ cảnh chính xác hơn (cách nhau bởi dấu phẩy).</small>
            </label>

            <h3>Vùng miền</h3>
            <div className="choice-row">
              {Array.isArray(regions) && regions.length > 0
                ? regions.map((r) => (
                  <Button
                    key={r.code}
                    variant={regionCode === r.code ? 'default' : 'outline'}
                    onClick={() => setRegionCode(regionCode === r.code ? '' : r.code)}
                  >
                    {r.name}
                  </Button>
                ))
                : (
                  <>
                    {[
                      { code: 'north', name: 'Miền Bắc' },
                      { code: 'central', name: 'Miền Trung' },
                      { code: 'south', name: 'Miền Nam' },
                    ].map((r) => (
                      <Button
                        key={r.code}
                        variant={regionCode === r.code ? 'default' : 'outline'}
                        onClick={() => setRegionCode(regionCode === r.code ? '' : r.code)}
                      >
                        {r.name}
                      </Button>
                    ))}
                  </>
                )}
            </div>
          </>}

          <div className="ingest-info-note">ⓘ Mỗi lần chỉ tạo 1 món. Kết quả luôn ở trạng thái <b>BẢN NHÁP</b>.</div>
          {submitError && <div className="ingest-error" role="alert">⚠ {submitError}</div>}
          <details className="ingest-source-details">
            <summary>Nguồn dữ liệu</summary>
            <div className="ingest-source-list">{SOURCE_OPTIONS.map((src) => (
              <button
                key={src.value}
                onClick={() => toggleSource(src.value)}
                className="source-option"
              >
                <span className={selectedSources.includes(src.value) ? 'checked-box' : 'check-box'}>
                  {selectedSources.includes(src.value) && <Check size={15} />}
                </span>
                <Database size={20} />
                <span>
                  <b>{src.label}</b>
                  <small>{src.description}</small>
                </span>
              </button>
            ))}</div>
          </details>

          <Button
            className="full"
            onClick={handleSubmit}
            disabled={createJob.isPending}
            style={{ marginTop: 8 }}
          >
            {createJob.isPending
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang tạo job...</>
              : <><ArrowDownToLine size={16} /> Tạo bản nháp bằng AI</>
            }
          </Button>
        </Card>

        {/* ── Right panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Pipeline preview (hiển thị khi chưa có job active) */}
          {activeJobs.length === 0 && (
            <Card className="ai-support-card">
              <h3>AI sẽ hỗ trợ tạo</h3>
              <ul className="ai-support-list">
                <li><Check size={14} /> Thông tin món</li>
                <li><Check size={14} /> Nguyên liệu</li>
                <li><Check size={14} /> Công thức chế biến</li>
                <li><Check size={14} /> Dinh dưỡng ước tính</li>
              </ul>
              <div className="ai-support-divider" />
              <div className="ai-support-steps">
                {[
                  ['1', 'Nhập tên'],
                  ['2', 'AI xử lý'],
                  ['3', 'Kiểm tra bản nháp'],
                ].map(([number, label], index) => (
                  <div className="ai-support-step" key={number}>
                    <div className="ai-step-line">
                      <span>{number}</span>
                      {index < 2 && <i />}
                    </div>
                    <b>{label}</b>
                  </div>
                ))}
              </div>
              <div className="ai-support-time"><Clock3 size={15} /> Thời gian dự kiến: 15–30 giây</div>
              <div className="ai-support-warning">△ Dữ liệu do AI tạo cần được kiểm tra trước khi gửi duyệt.</div>
            </Card>
          )}

          {/* Active jobs — real-time step tracker (không có header, dùng dark card) */}

          {/* Safety */}
          <Card className="safety">
            <ShieldCheck />
            <div>
              <b>Quy tắc an toàn dữ liệu</b>
              <p>Chỉ thu thập từ nguồn công khai, hợp lệ và đáng tin cậy.</p>
              <p>Không thu thập dữ liệu cá nhân hoặc thông tin nhạy cảm.</p>
              <p>Tôn trọng robots.txt và điều khoản sử dụng.</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {previewJobId && (
        <ImportJobPreviewModal
          jobId={previewJobId}
          onClose={() => setPreviewJobId(null)}
        />
      )}
    </>
  )
}
