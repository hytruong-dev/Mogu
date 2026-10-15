import { type CSSProperties } from 'react'
import type { ImportJob } from '../../types'
import { useJobProgress } from '../../hooks/useImportJobs'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { STEP_DEFS } from './types'

export interface StepTrackerProps {
  job: ImportJob
  dark?: boolean
}

export function StepTracker({ job, dark = false }: StepTrackerProps) {
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
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {STEP_DEFS.map((step, i) => {
          const stepNum = i + 1
          const isLast = i === STEP_DEFS.length - 1
          const isActive = !isFinished && currentStepIndex === stepNum
          const isDoneStep = isDone || currentStepIndex > stepNum
          const isFailedStep = isFailed && currentStepIndex === stepNum
          const isPending = !isDoneStep && !isActive && !isFailedStep

          const bubbleBg = isDoneStep
            ? '#22c55e'
            : isActive
              ? '#f0a500'
              : isFailedStep
                ? '#ef4444'
                : '#d1d5db'

          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                minHeight: isLast ? 'auto' : 52,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: bubbleBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    boxShadow: isActive ? `0 0 0 4px ${bubbleBg}33` : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        border: '2px solid #f0a500',
                        opacity: 0.5,
                        animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                      }}
                    />
                  )}
                  {isDoneStep ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isFailedStep ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : isActive ? (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        border: '2px solid white',
                        borderTopColor: 'transparent',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isPending ? '#9ca3af' : 'white',
                      }}
                    >
                      {stepNum}
                    </span>
                  )}
                </div>

                {!isLast && (
                  <div
                    style={{
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
                    }}
                  />
                )}
              </div>

              <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 12 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isDoneStep
                      ? dark
                        ? 'rgba(245,240,232,0.35)'
                        : '#9ca3af'
                      : isActive
                        ? dark
                          ? '#f5f0e8'
                          : '#1f2937'
                        : dark
                          ? 'rgba(245,240,232,0.45)'
                          : '#6b7280',
                    lineHeight: 1.3,
                    transition: 'color 0.3s',
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: dark ? 'rgba(245,240,232,0.4)' : isActive ? '#6b7280' : '#d1d5db',
                    marginTop: 2,
                    lineHeight: 1.4,
                    maxWidth: 260,
                  }}
                >
                  {step.desc}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isFinished && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div
            style={{
              flex: 1,
              height: 5,
              background: dark ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #f0a500, #f59e0b)',
                borderRadius: 99,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#f0a500',
              minWidth: 34,
              textAlign: 'right',
            }}
          >
            {progress}%
          </span>
        </div>
      )}

      {isDone && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            background: '#f0fdf4',
            borderRadius: 8,
            border: '1px solid #bbf7d0',
            fontSize: 12,
            color: '#16a34a',
            fontWeight: 600,
          }}
        >
          ✅ Hoàn tất — bản nháp đã được tạo thành công!
        </div>
      )}
      {isFailed && (
        <div
          style={{
            marginTop: 10,
            padding: '6px 10px',
            background: '#fef2f2',
            borderRadius: 8,
            border: '1px solid #fecaca',
            fontSize: 12,
            color: '#dc2626',
            fontWeight: 600,
          }}
        >
          ❌ {currentMessage ?? 'Pipeline thất bại'}
        </div>
      )}
    </div>
  )
}

export interface ImportProgressViewProps {
  job: ImportJob
  onCancel: () => void
}

export function ImportProgressView({ job, onCancel }: ImportProgressViewProps) {
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
              return (
                <div
                  className={step < currentStep ? 'complete' : step === currentStep ? 'current' : ''}
                  key={label}
                >
                  <span>{step < currentStep ? '✓' : step}</span>
                  <b>{label}</b>
                  {step === currentStep && <i className="ai-step-pulse" />}
                </div>
              )
            })}
          </div>
          <div className="ai-progress-meta">
            <span>◷ Đã chạy {Math.max(1, Math.round(progress / 3))} giây</span>
            <i />
            <span>⌘ Mã job {job.id.slice(0, 12).toUpperCase()}</span>
          </div>
          <div className="ai-progress-actions">
            <Button variant="outline" onClick={() => window.history.back()}>
              ↻ Chạy nền
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Hủy
            </Button>
          </div>
          <details className="ai-technical-details">
            <summary>☷ Chi tiết kỹ thuật</summary>
            <p>{message}</p>
          </details>
        </Card>
        <aside className="ai-after-complete">
          <span>✦</span>
          <b>Sau khi hoàn tất</b>
          <p>
            Món ăn sẽ được lưu dưới dạng <strong>BẢN NHÁP</strong>. Bạn có thể mở để kiểm tra và chỉnh
            sửa trước khi gửi duyệt.
          </p>
        </aside>
      </div>
    </div>
  )
}
