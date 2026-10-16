import { useState } from 'react'
import { History, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'
import { PageContainer, PageHeader } from '../components/layout'
import {
  useCreateImportJob,
  useImportJobActions,
  useImportJobs,
} from '../hooks/useImportJobs'
import { useRegions } from '../hooks/useTaxonomy'
import type { ImportJob } from '../types'
import {
  ImportJobForm,
  ImportJobsHistoryTable,
} from '../components/ingest'
import { ImportJobPreviewModal } from '../components/ui/import-job-preview-modal'

export default function IngestPage() {
  const [dishName, setDishName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(['AI_GENERATED'])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [previewJob, setPreviewJob] = useState<ImportJob | null>(null)
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const createJob = useCreateImportJob()
  const importJobActions = useImportJobActions()
  const { data: jobsData, isLoading } = useImportJobs()
  const { data: regionsData } = useRegions()
  const regions = (regionsData as any) ?? []

  const toggleSource = (val: string) => {
    setSelectedSources((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    )
  }

  // Thông báo phản hồi ngắn biến mất sau 4 giây
  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedbackNotice({ type, message })
    setTimeout(() => {
      setFeedbackNotice((curr) => (curr?.message === message ? null : curr))
    }, 4500)
  }

  // ── Xử lý nhập đơn lẻ liên tục ──
  const handleSingleSubmit = async () => {
    if (!dishName.trim()) {
      setSubmitError('Vui lòng nhập tên món ăn')
      return
    }
    setSubmitError(null)
    const targetName = dishName.trim()

    try {
      await createJob.mutateAsync({
        query: targetName,
        relatedKeywords: keywords.trim()
          ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
          : undefined,
        regionHint: regionCode || undefined,
        sourceTypes: selectedSources,
      })
      // Reset input ngay lập tức để người dùng có thể nhập món thứ 2, thứ 3...
      setDishName('')
      setKeywords('')
      showNotice('success', `Đã thêm "${targetName}" vào hàng đợi AI thu thập!`)
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message ?? e?.message ?? 'Lỗi không xác định'
      if (status === 401) {
        window.location.href = '/login'
      } else {
        setSubmitError('Tạo job thất bại: ' + msg)
        showNotice('error', 'Lỗi khi tạo: ' + msg)
      }
    }
  }

  // ── Xử lý nhập danh sách hàng loạt nhiều món ──
  const handleBatchSubmit = async (dishes: string[]) => {
    if (dishes.length === 0) return
    setSubmitError(null)

    const promises = dishes.map((name) =>
      createJob.mutateAsync({
        query: name,
        regionHint: regionCode || undefined,
        sourceTypes: selectedSources,
      })
    )

    const results = await Promise.allSettled(promises)
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (succeeded > 0) {
      showNotice(
        'success',
        `Đã kích hoạt thành công ${succeeded} món vào hàng đợi thu thập song song!`
      )
    }
    if (failed > 0) {
      setSubmitError(`Có ${failed} món bị lỗi khi gửi yêu cầu.`)
    }
  }

  // Thử lại món thất bại (Tái sử dụng tiến trình hiện có)
  const handleRetry = async (job: ImportJob) => {
    try {
      await importJobActions.retry.mutateAsync(job.id)
      showNotice('success', `Đang khởi động lại tiến trình thu thập cho món "${job.query}"...`)
    } catch (e: any) {
      showNotice('error', 'Lỗi khi thử lại: ' + (e?.message || 'Không xác định'))
    }
  }

  const jobs = jobsData?.data ?? []

  return (
    <PageContainer>
      {/* ── Tiêu đề trang & Nút chuyển đổi Lịch sử ── */}
      <PageHeader
        title="Nhập món tự động bằng AI (Đa nhiệm)"
        description="Khởi tạo nhiều món ăn cùng lúc. AI sẽ tự động tìm kiếm, chuẩn hóa nguyên liệu và tính toán dinh dưỡng theo thời gian thực."
        actions={
          <Button
            variant={showHistory ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
            className="gap-1.5 text-xs font-semibold"
          >
            {showHistory ? (
              <>
                <Sparkles size={14} /> Trình tạo món mới
              </>
            ) : (
              <>
                <History size={14} /> Bảng lịch sử chi tiết
              </>
            )}
          </Button>
        }
      />

      {/* ── Floating Notification Bar ── */}
      {feedbackNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-current" />
            {feedbackNotice.message}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Giao diện Lịch sử mở rộng (Khi người dùng bấm xem bảng) ── */}
      {showHistory ? (
        <ImportJobsHistoryTable
          jobs={jobs}
          isLoading={isLoading}
          onRetry={handleRetry}
          onBackToNew={() => setShowHistory(false)}
        />
      ) : (
        /* ── Giao diện Nhập Món AI Gọn Gàng & Tập Trung ── */
        <div className="max-w-3xl mx-auto space-y-4">
          <ImportJobForm
            dishName={dishName}
            onDishNameChange={setDishName}
            keywords={keywords}
            onKeywordsChange={setKeywords}
            onSingleSubmit={handleSingleSubmit}
            onBatchSubmit={handleBatchSubmit}
            regionCode={regionCode}
            onRegionCodeChange={setRegionCode}
            regions={regions}
            selectedSources={selectedSources}
            onToggleSource={toggleSource}
            isSubmitting={createJob.isPending}
            error={submitError}
          />

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-amber-500 shrink-0" />
              <span>Tiến trình các món đang thu thập sẽ hiển thị trực tiếp ở <strong>hộp thoại nổi ở góc dưới màn hình</strong>.</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="text-xs font-semibold h-7 text-amber-700 dark:text-amber-400 hover:text-amber-800"
            >
              Xem lịch sử đầy đủ →
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal Xem Trước Bản Nháp (Khi bấm 'Xem bản nháp') ── */}
      {previewJob && (
        <ImportJobPreviewModal
          jobId={previewJob.id}
          initialJob={previewJob}
          onClose={() => setPreviewJob(null)}
        />
      )}
    </PageContainer>
  )
}
