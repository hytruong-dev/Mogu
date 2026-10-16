import { Check, Clock, Hash, ArrowDownLeft, Terminal, Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import type { ImportJob } from '../../types'
import { useJobProgress } from '../../hooks/useImportJobs'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { Badge } from '../ui/badge'
import { STEP_DEFS } from './types'

export interface StepTrackerProps {
  job: ImportJob
  dark?: boolean
}

export function StepTracker({ job }: StepTrackerProps) {
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
    <div className="py-2 space-y-4">
      <div className="relative flex flex-col">
        {STEP_DEFS.map((step, i) => {
          const stepNum = i + 1
          const isLast = i === STEP_DEFS.length - 1
          const isActive = !isFinished && currentStepIndex === stepNum
          const isDoneStep = isDone || currentStepIndex > stepNum
          const isFailedStep = isFailed && currentStepIndex === stepNum
          const isPending = !isDoneStep && !isActive && !isFailedStep

          return (
            <div key={step.key} className={`flex gap-3.5 items-start ${isLast ? 'min-h-auto' : 'min-h-[52px]'}`}>
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                    isDoneStep
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-amber-500 text-white ring-4 ring-amber-500/20'
                        : isFailedStep
                          ? 'bg-destructive text-destructive-foreground ring-4 ring-destructive/20'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isDoneStep ? (
                    <Check size={14} strokeWidth={3} />
                  ) : isFailedStep ? (
                    <span>✕</span>
                  ) : isActive ? (
                    <Loader2 size={13} className="animate-spin text-white" />
                  ) : (
                    <span>{stepNum}</span>
                  )}
                </div>

                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[22px] my-1 ${
                      isDoneStep ? 'bg-emerald-500' : 'bg-border'
                    }`}
                  />
                )}
              </div>

              <div className="pt-0.5 pb-3">
                <div
                  className={`text-xs font-bold leading-tight transition-colors ${
                    isDoneStep
                      ? 'text-muted-foreground'
                      : isActive
                        ? 'text-foreground font-extrabold'
                        : isPending
                          ? 'text-muted-foreground/80'
                          : 'text-foreground'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 max-w-xs leading-normal">
                  {step.desc}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isFinished && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Tiến trình tổng quan</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {isDone && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
          <Check size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Thu thập dữ liệu thành công! Bản nháp đã sẵn sàng.</span>
        </div>
      )}

      {isFailed && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-semibold flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{currentMessage ?? 'Pipeline thu thập thất bại'}</span>
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
  const message = ws?.message ?? job.currentStepMessage ?? 'AI đang phân tích và chuẩn hóa dữ liệu món ăn...'

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AI đang tạo món: <span className="text-amber-600 dark:text-amber-400">{job.query}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          Bạn có thể rời trang bất kỳ lúc nào; tiến trình AI vẫn chạy ngầm và lưu kết quả vào kho bản nháp.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <Card className="md:col-span-8 shadow-xs border-border">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="relative w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-500 flex items-center justify-center shrink-0">
                <span className="text-xl font-extrabold text-foreground">{progress}%</span>
              </div>
              <div className="space-y-1 text-center sm:text-left">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase">
                  Tiến trình đang chạy
                </Badge>
                <div className="text-sm font-bold text-foreground">{message}</div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Các mốc bước thực thi
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  '1. Phân tích ngữ cảnh',
                  '2. Thu thập dữ liệu',
                  '3. Chuẩn hóa nguyên liệu',
                  '4. Tính toán dinh dưỡng',
                  '5. Định hình công thức',
                  '6. Tạo bản nháp',
                ].map((label, index) => {
                  const step = index + 1
                  const isPast = step < currentStep
                  const isCurrent = step === currentStep
                  return (
                    <div
                      key={label}
                      className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                        isPast
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-semibold'
                          : isCurrent
                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold ring-2 ring-amber-500/20'
                            : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      {isPast ? (
                        <Check size={13} className="text-emerald-600 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 size={13} className="animate-spin text-amber-600 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-muted text-[10px] flex items-center justify-center shrink-0">
                          {step}
                        </span>
                      )}
                      <span className="truncate">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock size={13} className="text-amber-500" /> Đã chạy: ~{Math.max(1, Math.round(progress / 3))}s
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <Hash size={13} /> {job.id.slice(0, 10).toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="gap-2 text-xs font-semibold"
              >
                <ArrowDownLeft size={14} /> Chuyển sang chạy ngầm
              </Button>
              <Button
                variant="ghost"
                onClick={onCancel}
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Hủy tác vụ
              </Button>
            </div>

            <details className="text-xs text-muted-foreground border-t border-border pt-3">
              <summary className="cursor-pointer font-medium hover:text-foreground flex items-center gap-1.5">
                <Terminal size={13} /> Chi tiết nhật ký pipeline
              </summary>
              <p className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed">
                {message}
              </p>
            </details>
          </CardContent>
        </Card>

        <Card className="md:col-span-4 border-border shadow-xs bg-card">
          <CardContent className="p-5 space-y-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <span className="text-sm font-bold text-foreground block">Sau khi AI hoàn tất</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Món ăn sẽ tự động được lưu trữ dưới trạng thái <strong className="font-semibold text-foreground">BẢN NHÁP</strong>. Đội ngũ kiểm duyệt có thể đối chiếu, tinh chỉnh hình ảnh, công thức và thành phần trước khi phát hành chính thức.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
