import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import type { ImportJob, ImportJobStatus } from '../../types'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
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
    <div className="ai-import-history-page space-y-4">
      <div className="ai-history-heading flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lịch sử nhập món bằng AI</h1>
          <p className="text-xs text-muted-foreground">Theo dõi các lần tạo bản nháp gần đây.</p>
        </div>
        <Button onClick={onBackToNew}>⊕ Nhập món mới</Button>
      </div>

      <Card className="ai-history-filter p-3">
        <div className="flex gap-3 flex-wrap">
          <div className="ai-history-search flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-muted-foreground" />
            <Input
              className="border-none focus:border-none h-8 text-xs"
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

      <Card className="ai-history-table-wrap overflow-hidden">
        <Table className="ai-history-table">
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
                <TableCell colSpan={5} className="ai-history-empty text-center py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
                    <Loader2 size={18} className="animate-spin" /> Đang tải lịch sử...
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filteredHistoryJobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="ai-history-empty text-center py-8 text-muted-foreground text-xs">
                  Chưa tìm thấy lần nhập món phù hợp.
                </TableCell>
              </TableRow>
            )}
            {filteredHistoryJobs.map((job) => {
              const active = ACTIVE_STATUSES.includes(job.status)
              const successful = job.status === 'DONE'
              return (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="ai-history-dish flex items-center gap-2 font-semibold text-xs">
                      <span>🍜</span>
                      <span>{job.query}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`ai-history-status ${job.status.toLowerCase()} text-xs`}>
                      ● {statusLabel(job.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {successful || active ? (
                      <div className="ai-history-progress flex items-center gap-2 text-xs">
                        <b>{successful ? 100 : job.progress}%</b>
                        <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${successful ? 100 : job.progress}%` }}
                          />
                        </div>
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
                      <Button variant="outline" size="sm" onClick={() => setPreviewJobId(job.id)}>
                        ▣ Mở bản nháp
                      </Button>
                    ) : active ? (
                      <Button variant="outline" size="sm" onClick={onBackToNew}>
                        ◷ Xem tiến trình
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onRetry(job)
                          onBackToNew()
                        }}
                      >
                        ⟳ Tạo lại job
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
