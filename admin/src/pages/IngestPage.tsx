import { useState } from 'react'
import { Sparkles, Clock } from 'lucide-react'
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
  ACTIVE_STATUSES,
  ImportJobForm,
  ImportJobsHistoryTable,
  ImportProgressView,
  ImportSuccessView,
} from '../components/ingest'

export default function IngestPage() {
  const [dishName, setDishName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(['AI_GENERATED'])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [dismissedSuccessJobId, setDismissedSuccessJobId] = useState<string | null>(null)

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

  const handleSubmit = async () => {
    if (!dishName.trim()) {
      setSubmitError('Vui lòng nhập tên món ăn')
      return
    }
    setSubmitError(null)

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
    setShowHistory(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const jobs = jobsData?.data ?? []
  const activeJobs = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status))
  const latestCompletedJob = jobs.find((job) => job.status === 'DONE' && job.resultDishId)

  if (showHistory) {
    return (
      <PageContainer>
        <ImportJobsHistoryTable
          jobs={jobs}
          isLoading={isLoading}
          onRetry={handleRetry}
          onBackToNew={() => setShowHistory(false)}
        />
      </PageContainer>
    )
  }

  if (activeJobs.length > 0) {
    const job = activeJobs[0]
    return (
      <PageContainer>
        <ImportProgressView job={job} onCancel={() => importJobActions.cancel.mutate(job.id)} />
      </PageContainer>
    )
  }

  if (latestCompletedJob && dismissedSuccessJobId !== latestCompletedJob.id) {
    return (
      <PageContainer>
        <ImportSuccessView
          job={latestCompletedJob}
          onNew={() => setDismissedSuccessJobId(latestCompletedJob.id)}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Nhập món bằng AI"
        description="Nhập tên món, AI sẽ tạo một bản nháp tự động để bạn kiểm tra và chỉnh sửa trước khi xuất bản."
        badge={
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Sparkles size={16} />
            <span>AI Automated Ingest</span>
          </div>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="gap-1.5">
            <Clock size={14} />
            Lịch sử nhập món
          </Button>
        }
      />

      <ImportJobForm
        dishName={dishName}
        onDishNameChange={setDishName}
        keywords={keywords}
        onKeywordsChange={setKeywords}
        regionCode={regionCode}
        onRegionCodeChange={setRegionCode}
        regions={regions}
        selectedSources={selectedSources}
        onToggleSource={toggleSource}
        onSubmit={handleSubmit}
        isSubmitting={createJob.isPending}
        error={submitError}
      />
    </PageContainer>
  )
}
