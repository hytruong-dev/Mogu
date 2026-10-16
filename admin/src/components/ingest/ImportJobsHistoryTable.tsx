import { useState } from 'react'
import { FileText, Loader2, Plus, RotateCw, Search, Timer, Utensils } from 'lucide-react'
import type { ImportJob, ImportJobStatus } from '../../types'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { ImportJobPreviewModal } from '../ui/import-job-preview-modal'
import { ACTIVE_STATUSES } from './types'

export interface ImportJobsHistoryTableProps {
  jobs: ImportJob[]
  isLoading: boolean
  onRetry: (job: ImportJob) => void
  onBackToNew: () => void
}

export function ImportJobsHistoryTable({
  jobs,
  isLoading,
  onRetry,
  onBackToNew,
}: ImportJobsHistoryTableProps) {
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState<ImportJobStatus | 'ALL' | 'ACTIVE'>('ALL')
  const [previewJobId, setPreviewJobId] = useState<string | null>(null)

  const relativeTime = (value: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
    if (minutes < 1) return 'Vừa xong'
    if (minutes < 60) return `${minutes} phút trước`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`
    return `${Math.floor(minutes / 1440)} ngày trước`
  }

  const statusLabel = (status: ImportJobStatus) =>
    status === 'DONE'
      ? 'Đã tạo bản nháp'
      : status === 'FAILED'
        ? 'Thất bại'
        : status === 'CANCELLED'
          ? 'Đã hủy'
          : 'Đang xử lý'

  const filteredHistoryJobs = jobs.filter(
    (job) =>
      job.query.toLocaleLowerCase('vi-VN').includes(historyQuery.toLocaleLowerCase('vi-VN')) &&
      (historyStatus === 'ALL' ||
        (historyStatus === 'ACTIVE' && ACTIVE_STATUSES.includes(job.status)) ||
        job.status === historyStatus)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Lịch sử nhập món bằng AI</h1>
          <p className="text-xs text-muted-foreground">Theo dõi các lần tạo bản nháp gần đây.</p>
        </div>
        <Button onClick={onBackToNew} className="gap-1.5">
          <Plus size={14} />
          <span>Nhập món mới</span>
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <Input
              className="border-none shadow-none focus-visible:ring-0 h-8 text-xs"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Tìm theo tên món..."
            />
          </div>
          <Select
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value as typeof historyStatus)}
            className="w-48 h-8 text-xs"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DONE">Đã tạo bản nháp</option>
            <option value="ACTIVE">Đang xử lý</option>
            <option value="FAILED">Thất bại</option>
            <option value="CANCELLED">Đã hủy</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Món ăn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tiến trình</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                    <Loader2 size={18} className="animate-spin" /> Đang tải lịch sử...
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filteredHistoryJobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                  Chưa tìm thấy lần nhập món phù hợp.
                </TableCell>
              </TableRow>
            )}
            {filteredHistoryJobs.map((job) => {
              const active = ACTIVE_STATUSES.includes(job.status)
              const successful = job.status === 'DONE'
              const badgeVariant =
                job.status === 'DONE'
                  ? 'success'
                  : job.status === 'FAILED'
                  ? 'destructive'
                  : job.status === 'CANCELLED'
                  ? 'neutral'
                  : 'warning'

              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-xs text-foreground">
                      <Utensils size={14} className="text-amber-500 shrink-0" />
                      <span>{job.query}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant} className="text-[11px] font-medium">
                      {statusLabel(job.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {successful || active ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold w-9">{successful ? 100 : job.progress}%</span>
                        <Progress
                          value={successful ? 100 : job.progress}
                          className="w-24 h-1.5"
                          indicatorClassName={successful ? 'bg-emerald-500' : 'bg-amber-500'}
                        />
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {relativeTime(job.completedAt ?? job.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {successful && job.resultDishId ? (
                      <Button variant="outline" size="sm" onClick={() => setPreviewJobId(job.id)} className="gap-1.5 text-xs">
                        <FileText size={13} />
                        Mở bản nháp
                      </Button>
                    ) : active ? (
                      <Button variant="outline" size="sm" onClick={onBackToNew} className="gap-1.5 text-xs">
                        <Timer size={13} />
                        Xem tiến trình
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onRetry(job)
                          onBackToNew()
                        }}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCw size={13} />
                        Tạo lại job
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
      {previewJobId && (
        <ImportJobPreviewModal jobId={previewJobId} onClose={() => setPreviewJobId(null)} />
      )}
    </div>
  )
}
