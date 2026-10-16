import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  Loader2,
  RotateCw,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import { useImportJobs, useImportJobActions } from '../../hooks/useImportJobs'
import type { ImportJob } from '../../types'
import { ACTIVE_STATUSES, formatRelativeTime } from './types'
import { ImportJobPreviewModal } from '../ui/import-job-preview-modal'
import { Progress } from '../ui/progress'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

export function GlobalJobProgressTray() {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ALL' | 'DONE' | 'FAILED'>('ACTIVE')
  const [previewJob, setPreviewJob] = useState<ImportJob | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  // Fetch recent import jobs with automatic WebSocket & polling
  const { data: jobsData } = useImportJobs({ limit: 25 })

  const actions = useImportJobActions()
  const jobs = jobsData?.data ?? []

  const metrics = useMemo(() => {
    const active = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status))
    const done = jobs.filter((j) => j.status === 'DONE')
    const failed = jobs.filter((j) => j.status === 'FAILED' || j.status === 'CANCELLED')
    return {
      activeCount: active.length,
      doneCount: done.length,
      failedCount: failed.length,
      totalCount: jobs.length,
      activeJobs: active,
      doneJobs: done,
      failedJobs: failed,
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    if (activeTab === 'ACTIVE') return metrics.activeJobs
    if (activeTab === 'DONE') return metrics.doneJobs
    if (activeTab === 'FAILED') return metrics.failedJobs
    return jobs
  }, [activeTab, metrics, jobs])

  // Automatically un-dismiss if new active jobs start
  useEffect(() => {
    if (isDismissed && metrics.activeCount > 0) {
      setIsDismissed(false)
    }
  }, [isDismissed, metrics.activeCount])

  // If no jobs at all or user closed tray
  if (jobs.length === 0 || isDismissed) {
    return null
  }

  const handleRetry = (job: ImportJob) => {
    actions.retry.mutate(job.id)
  }

  const handleCancel = (jobId: string) => {
    actions.cancel.mutate(jobId)
  }

  return (
    <>
      <aside
        aria-label="Tiến trình thu thập AI"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-auto"
      >
        {/* ── EXPANDED DIALOG PANEL ── */}
        {isExpanded ? (
          <div className="w-[calc(100vw-32px)] sm:w-[480px] md:w-[520px] max-h-[580px] flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 ring-1 ring-black/5">
            {/* Header */}
            <div className="p-3.5 sm:px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      Tiến trình thu thập AI
                    </span>
                    {metrics.activeCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 animate-pulse">
                        <Loader2 size={10} className="animate-spin" />
                        {metrics.activeCount} đang chạy
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {metrics.doneCount} hoàn thành
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                    {metrics.activeCount > 0
                      ? 'AI đang tổng hợp công thức & dinh dưỡng song song'
                      : 'Toàn bộ tiến trình thu thập gần đây'}
                  </p>
                </div>
              </div>

              {/* Action tools */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => navigate('/ingest')}
                  title="Mở toàn màn hình trang nhập món"
                >
                  <ExternalLink size={12} />
                  <span className="hidden sm:inline">Trang nhập món</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => setIsExpanded(false)}
                  title="Thu gọn hộp thoại"
                >
                  <ChevronDown size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setIsExpanded(false)
                    setIsDismissed(true)
                  }}
                  title="Ẩn hoàn toàn cho đến tác vụ mới"
                >
                  <X size={15} />
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-muted/20 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('ACTIVE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ACTIVE'
                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>Đang chạy</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20">
                  {metrics.activeCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ALL'
                    ? 'bg-card text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>Tất cả</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted">
                  {metrics.totalCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('DONE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'DONE'
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span>Đã xong</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20">
                  {metrics.doneCount}
                </span>
              </button>

              {metrics.failedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('FAILED')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                    activeTab === 'FAILED'
                      ? 'bg-destructive/15 text-destructive font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span>Lỗi</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-destructive/20">
                    {metrics.failedCount}
                  </span>
                </button>
              )}
            </div>

            {/* List of compact job rows */}
            <div className="flex-1 overflow-y-auto max-h-[360px] p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredJobs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                  <Sparkles size={20} className="mx-auto text-muted-foreground/40 mb-1" />
                  <p className="font-semibold">
                    {activeTab === 'ACTIVE'
                      ? 'Không có món nào đang chạy.'
                      : 'Danh sách trống.'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Bạn có thể tạo món mới tại trang Nhập món tự động.
                  </p>
                </div>
              ) : (
                filteredJobs.map((job) => {
                  const isActive = ACTIVE_STATUSES.includes(job.status)
                  const isDone = job.status === 'DONE'
                  const isFailed = job.status === 'FAILED' || job.status === 'CANCELLED'
                  const progress = isDone ? 100 : job.progress || 0
                  const isRetrying =
                    actions.retry.isPending && actions.retry.variables === job.id

                  return (
                    <div
                      key={job.id}
                      className={`pt-1.5 first:pt-0 p-2.5 rounded-xl border transition-all text-xs space-y-2 ${
                        isActive
                          ? 'border-amber-500/40 bg-amber-500/[0.03]'
                          : isDone
                            ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                            : isFailed
                              ? 'border-rose-500/30 bg-rose-500/[0.02]'
                              : 'border-border bg-card'
                      }`}
                    >
                      {/* Top line: Name + Badges + Quick Action */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-foreground truncate max-w-[200px] sm:max-w-[260px]">
                            {job.query}
                          </span>
                          {job.regionHint && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 font-mono uppercase shrink-0"
                            >
                              {job.regionHint}
                            </Badge>
                          )}
                        </div>

                        {/* Status label / Quick action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isActive && (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                                <Loader2 size={12} className="animate-spin" />
                                {progress}%
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancel(job.id)}
                                disabled={actions.cancel.isPending}
                                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                                title="Hủy tác vụ"
                              >
                                <XCircle size={13} />
                              </Button>
                            </div>
                          )}

                          {isDone && (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewJob(job)}
                                className="h-6 px-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100"
                              >
                                <Eye size={11} className="mr-1" />
                                Xem
                              </Button>
                              {job.resultDishId && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => navigate(`/foods/${job.resultDishId}`)}
                                  className="h-6 px-2 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  Sửa món
                                </Button>
                              )}
                            </div>
                          )}

                          {isFailed && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold text-destructive mr-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                Thất bại
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(job)}
                                disabled={isRetrying}
                                className="h-6 px-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 gap-1"
                                title="Thử lại (Tái sử dụng tiến trình này)"
                              >
                                <RotateCw
                                  size={11}
                                  className={isRetrying ? 'animate-spin' : ''}
                                />
                                {isRetrying ? 'Đang chạy lại...' : 'Thử lại'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <Progress
                          value={progress}
                          className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"
                        />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate max-w-[280px]">
                            {job.currentStepMessage ||
                              (isDone
                                ? 'Bản nháp đã sẵn sàng'
                                : isFailed
                                  ? job.errorMessage || 'Lỗi khi trích xuất'
                                  : 'Đang xử lý bước dữ liệu...')}
                          </span>
                          <span className="shrink-0">{formatRelativeTime(job.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 px-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Cập nhật tự động qua WebSocket
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="font-semibold text-foreground hover:underline"
              >
                Thu nhỏ
              </button>
            </div>
          </div>
        ) : (
          /* ── COLLAPSED FLOATING PILL ── */
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className={`group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full border shadow-xl backdrop-blur-xl transition-all hover:scale-105 active:scale-95 ${
              metrics.activeCount > 0
                ? 'bg-slate-900 text-white border-amber-500/40 ring-2 ring-amber-500/20'
                : 'bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800'
            }`}
          >
            {metrics.activeCount > 0 ? (
              <>
                <div className="relative flex items-center justify-center">
                  <span className="absolute -inset-1 rounded-full bg-amber-500/30 animate-ping" />
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                </div>
                <div className="text-left flex flex-col">
                  <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    Đang thu thập AI
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 font-mono text-[10px]">
                      {metrics.activeCount}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-300 leading-tight">
                    {metrics.doneCount} món đã xong • Nhấn để xem
                  </span>
                </div>
                <ChevronUp size={16} className="text-slate-400 group-hover:text-white transition-colors ml-1" />
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles size={13} />
                </div>
                <span className="text-xs font-semibold">
                  Tiến trình AI ({metrics.totalCount} món)
                </span>
                <ChevronUp size={15} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              </>
            )}
          </button>
        )}
      </aside>

      {/* Preview modal if opened from the tray */}
      {previewJob && (
        <ImportJobPreviewModal
          jobId={previewJob.id}
          initialJob={previewJob}
          onClose={() => setPreviewJob(null)}
        />
      )}
    </>
  )
}
