import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RotateCw,
  Search,
  Sparkles,
  Utensils,
  XCircle,
} from 'lucide-react'
import type { ImportJob } from '../../types'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'
import { EmptyState } from '../ui/empty-state'
import { ACTIVE_STATUSES, STEP_DEFS, parseJobSummary } from './types'

export interface MultiJobQueueTrackerProps {
  jobs: ImportJob[]
  isLoading: boolean
  onCancelJob: (jobId: string) => void
  onRetryJob: (job: ImportJob) => void
  onPreviewJob: (job: ImportJob) => void
}

export function MultiJobQueueTracker({
  jobs,
  isLoading,
  onCancelJob,
  onRetryJob,
  onPreviewJob,
}: MultiJobQueueTrackerProps) {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DONE' | 'FAILED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Compute counts
  const metrics = useMemo(() => {
    const active = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length
    const done = jobs.filter((j) => j.status === 'DONE').length
    const failed = jobs.filter((j) => j.status === 'FAILED' || j.status === 'CANCELLED').length
    const total = jobs.length
    return { active, done, failed, total }
  }, [jobs])

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchQuery =
        !searchQuery ||
        job.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.id.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchQuery) return false

      if (filterStatus === 'ACTIVE') return ACTIVE_STATUSES.includes(job.status)
      if (filterStatus === 'DONE') return job.status === 'DONE'
      if (filterStatus === 'FAILED') return job.status === 'FAILED' || job.status === 'CANCELLED'
      return true
    })
  }, [jobs, filterStatus, searchQuery])

  const formatRelativeTime = (timeStr?: string) => {
    if (!timeStr) return 'Vừa xong'
    const diffMs = Date.now() - new Date(timeStr).getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 10) return 'Vừa tạo'
    if (diffSec < 60) return `${diffSec} giây trước`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} phút trước`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} giờ trước`
    return new Date(timeStr).toLocaleDateString('vi-VN')
  }

  return (
    <div className="space-y-4">
      {/* ── Top Summary Metric Pills ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => setFilterStatus('ALL')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filterStatus === 'ALL'
              ? 'border-foreground/30 bg-muted/60 shadow-2xs ring-1 ring-foreground/10'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-semibold">
            <span>Tổng số món</span>
            <Utensils size={13} />
          </div>
          <div className="text-xl font-extrabold text-foreground mt-1">{metrics.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('ACTIVE')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filterStatus === 'ACTIVE'
              ? 'border-amber-500/50 bg-amber-500/10 shadow-2xs ring-1 ring-amber-500/30'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
            <span>Đang thu thập</span>
            {metrics.active > 0 ? (
              <Loader2 size={13} className="animate-spin text-amber-500" />
            ) : (
              <Clock size={13} />
            )}
          </div>
          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {metrics.active}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('DONE')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filterStatus === 'DONE'
              ? 'border-emerald-500/50 bg-emerald-500/10 shadow-2xs ring-1 ring-emerald-500/30'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
            <span>Đã tạo bản nháp</span>
            <CheckCircle2 size={13} />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {metrics.done}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('FAILED')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filterStatus === 'FAILED'
              ? 'border-destructive/50 bg-destructive/10 shadow-2xs ring-1 ring-destructive/30'
              : 'border-border bg-card hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between text-destructive text-[11px] font-semibold">
            <span>Thất bại / Hủy</span>
            <AlertCircle size={13} />
          </div>
          <div className="text-xl font-extrabold text-destructive mt-1">{metrics.failed}</div>
        </button>
      </div>

      {/* ── Search & Filter Bar ── */}
      <Card className="p-2.5 border-border shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-muted/40 rounded-lg px-2.5 py-1 border border-border/60">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc món trong hàng đợi..."
              className="border-none shadow-none focus-visible:ring-0 h-7 text-xs p-0 bg-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Xóa
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={filterStatus === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('ALL')}
              className="h-7 px-2.5 text-xs font-semibold"
            >
              Tất cả ({metrics.total})
            </Button>
            <Button
              variant={filterStatus === 'ACTIVE' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('ACTIVE')}
              className="h-7 px-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
            >
              Đang chạy ({metrics.active})
            </Button>
            <Button
              variant={filterStatus === 'DONE' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('DONE')}
              className="h-7 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              Đã xong ({metrics.done})
            </Button>
            {metrics.failed > 0 && (
              <Button
                variant={filterStatus === 'FAILED' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('FAILED')}
                className="h-7 px-2.5 text-xs font-semibold text-destructive"
              >
                Lỗi ({metrics.failed})
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Live Multi-Job Queue Items ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 border-border">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card className="p-8 border-border">
          <EmptyState
            icon={Sparkles}
            title={
              filterStatus === 'ACTIVE'
                ? 'Không có món nào đang chạy'
                : filterStatus === 'DONE'
                  ? 'Chưa có món nào hoàn tất'
                  : 'Hàng đợi đang trống'
            }
            description={
              filterStatus === 'ACTIVE'
                ? 'Nhập tên món ăn ở bảng bên trái để kích hoạt luồng AI thu thập tự động.'
                : 'Các món ăn bạn bắt đầu sẽ xuất hiện tại đây kèm tiến trình % và trạng thái từng bước.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job, index) => {
            const isActive = ACTIVE_STATUSES.includes(job.status)
            const isDone = job.status === 'DONE'
            const isFailed = job.status === 'FAILED' || job.status === 'CANCELLED'
            const currentStep = job.currentStep || 1
            const progress = isDone ? 100 : job.progress || 0
            const summary = parseJobSummary(job)

            return (
              <Card
                key={job.id}
                className={`overflow-hidden border transition-all ${
                  isActive
                    ? 'border-amber-500/50 bg-amber-500/[0.02] shadow-xs border-l-4 border-l-amber-500'
                    : isDone
                      ? 'border-emerald-500/40 bg-emerald-500/[0.01] border-l-4 border-l-emerald-500'
                      : isFailed
                        ? 'border-destructive/40 bg-destructive/[0.01] border-l-4 border-l-destructive'
                        : 'border-border bg-card'
                }`}
              >
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  {/* Row 1: Header (Sequence, Title, Status, Actions) */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Sequence number */}
                        <Badge
                          variant="secondary"
                          className="font-mono text-[11px] font-bold px-1.5 py-0 h-5 bg-muted text-muted-foreground"
                        >
                          #{index + 1}
                        </Badge>

                        <h3 className="text-base font-bold text-foreground tracking-tight truncate max-w-xs sm:max-w-md">
                          {job.query}
                        </h3>

                        {job.regionHint && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-medium">
                            {job.regionHint}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-muted-foreground" />
                          {formatRelativeTime(job.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">
                          ID: {job.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Right status badge & primary actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && (
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1.5 font-bold text-xs py-0.5 px-2">
                            <Loader2 size={11} className="animate-spin text-amber-500" />
                            Đang chạy ({progress}%)
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCancelJob(job.id)}
                            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                            title="Hủy tác vụ này"
                          >
                            <XCircle size={13} className="mr-0.5" /> Hủy
                          </Button>
                        </div>
                      )}

                      {isDone && (
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1 font-bold text-xs py-0.5 px-2">
                            <Check size={12} strokeWidth={2.5} className="text-emerald-500" />
                            Hoàn tất (100%)
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPreviewJob(job)}
                            className="h-6 px-2 text-xs font-semibold gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                            title="Xem chi tiết dữ liệu trích xuất"
                          >
                            <Eye size={12} /> Xem
                          </Button>
                          {job.resultDishId && (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/foods/${job.resultDishId}`)}
                              className="h-6 px-2 text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Chuyển tới trang chỉnh sửa món ăn"
                            >
                              Sửa món <ArrowUpRight size={11} />
                            </Button>
                          )}
                        </div>
                      )}

                      {isFailed && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="destructive" className="gap-1 font-bold text-xs py-0.5 px-2">
                            <AlertCircle size={11} /> Thất bại
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRetryJob(job)}
                            className="h-6 px-2 text-xs font-semibold gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                            title="Khởi động lại tiến trình này (Tái sử dụng)"
                          >
                            <RotateCw size={11} /> Thử lại
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Percentage Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                        {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        {job.currentStepMessage || (isDone ? 'Bản nháp đã tạo sẵn sàng để kiểm duyệt' : 'Đang xử lý...')}
                      </span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          isDone
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isActive
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {progress}%
                      </span>
                    </div>

                    <Progress
                      value={progress}
                      className={`h-1.5 transition-all rounded-full ${
                        isDone ? '[&>div]:bg-emerald-500' : isActive ? '[&>div]:bg-amber-500' : ''
                      }`}
                    />
                  </div>

                  {/* Row 3: Modern Slim Horizontal Stepper (compact, no giant boxes) */}
                  {isActive && (
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        Bước {currentStep}/6: {STEP_DEFS[currentStep - 1]?.label || 'Đang xử lý'}
                      </span>
                      <div className="flex items-center gap-1">
                        {STEP_DEFS.map((s, idx) => {
                          const isDoneStep = isDone || currentStep > idx + 1
                          const isCurrentStep = currentStep === idx + 1
                          return (
                            <span
                              key={s.key}
                              title={`${idx + 1}. ${s.label}`}
                              className={`h-1.5 rounded-full transition-all ${
                                isDoneStep
                                  ? 'bg-emerald-500 w-4'
                                  : isCurrentStep
                                    ? 'bg-amber-500 w-6'
                                    : 'bg-muted w-3'
                              }`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Row 4: Summary Badges when completed */}
                  {isDone && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {summary.ingredients && (
                          <span className="font-medium text-foreground">
                            {summary.ingredients} nguyên liệu
                          </span>
                        )}
                        {summary.steps && <span>• {summary.steps} bước</span>}
                        {summary.calories && <span>• {summary.calories} kcal</span>}
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px] shrink-0">
                        <CheckCircle2 size={12} /> Sẵn sàng trong kho Bản nháp
                      </span>
                    </div>
                  )}

                  {/* Failure reason */}
                  {isFailed && job.errorMessage && (
                    <div className="p-2 px-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle size={13} className="shrink-0" />
                      <span className="truncate">{job.errorMessage}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
