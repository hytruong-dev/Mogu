import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Cloud, Play, Save, X } from 'lucide-react'
import { dishImportsApi, type ImportValidationSummary } from '../../../api/dish-imports'
import { parseCsvPreview } from '../../../lib/spreadsheet'
import { autoMapField } from './demo-data'
import { StepComplete } from './StepComplete'
import { StepConfirm } from './StepConfirm'
import { StepMapping } from './StepMapping'
import { StepProgress } from './StepProgress'
import { StepUpload } from './StepUpload'
import { StepValidate } from './StepValidate'
import type {
  CompleteTab,
  ImportOptions,
  IssueRow,
  MappingRow,
  Phase,
  ProgressLog,
  ProgressStep,
  UploadedFileInfo,
  ValidateTab,
} from './types'
import { GhostBtn, ImportStepper, PrimaryBtn } from './widgets'

const DEFAULT_OPTIONS: ImportOptions = {
  firstRowIsHeader: true,
  autoMap: true,
  sheet: 'Dishes',
  duplicatePolicy: 'skip',
  updateEmptyOnly: false,
  postStatus: 'draft',
  downloadImages: true,
  keepUrlOnFail: true,
  createDishSource: true,
  newIngredientPolicy: 'create',
  errorPolicy: 'rollback',
  confirmed: false,
  autoOpenResult: true,
}

function statusForField(field: string): MappingRow['status'] {
  if (!field) return 'skip'
  if (field === 'imageUrl') return 'check'
  return 'mapped'
}

interface Props {
  open: boolean
  onClose: () => void
  onViewDrafts?: (sessionId?: string) => void
}

export function ImportFromFileModal({ open, onClose, onViewDrafts }: Props) {
  const [phase, setPhase] = useState<Phase>('upload')
  const [file, setFile] = useState<UploadedFileInfo | null>(null)
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS)
  const [mapping, setMapping] = useState<MappingRow[]>([])
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [validateSummary, setValidateSummary] = useState<ImportValidationSummary | null>(null)
  const [jobStats, setJobStats] = useState({ total: 0, skipped: 0, failed: 0, warnings: 0 })
  const [validateTab, setValidateTab] = useState<ValidateTab>('error')
  const [completeTab, setCompleteTab] = useState<CompleteTab>('overview')
  const [percent, setPercent] = useState(0)
  const [created, setCreated] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [eligible, setEligible] = useState(0)
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (!open) return
    const saved = sessionStorage.getItem('mogu-import-job')
    if (saved && phase === 'upload') {
      setJobId(saved)
      setPhase('progress')
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'progress') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('overflow-hidden')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('overflow-hidden')
    }
  }, [open, onClose, phase])

  useEffect(() => {
    if (phase !== 'progress' || !jobId) return
    const tick = async () => {
      try {
        const job = await dishImportsApi.getJob(jobId)
        setPercent(job.progressPercent ?? 0)
        setCreated(job.createdCount ?? 0)
        setJobStats({
          total: job.totalRows ?? 0,
          skipped: job.skippedCount ?? 0,
          failed: job.failedCount ?? 0,
          warnings: job.warningCount ?? 0,
        })
        if (['DONE', 'CANCELLED', 'FAILED', 'CANCEL_REQUESTED'].includes(job.status)) {
          sessionStorage.removeItem('mogu-import-job')
          setPhase('complete')
        }
      } catch { /* keep polling */ }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 2000)
    sessionStorage.setItem('mogu-import-job', jobId)
    return () => window.clearInterval(id)
  }, [phase, jobId])

  const progressSteps: ProgressStep[] = useMemo(() => {
    const p = percent
    const total = jobStats.total || eligible || 1
    return [
      { n: 1, label: 'Đọc & chuẩn hóa file', sub: p >= 12 ? 'Hoàn tất' : 'Đang xử lý', state: p >= 12 ? 'done' : 'running' },
      { n: 2, label: 'Tạo món ăn', sub: p >= 40 ? 'Hoàn tất' : p >= 12 ? `${created} / ${total}` : 'Chờ xử lý', state: p >= 40 ? 'done' : p >= 12 ? 'running' : 'pending' },
      { n: 3, label: 'Liên kết nguyên liệu', sub: p >= 62 ? 'Hoàn tất' : 'Đang xử lý', state: p >= 62 ? 'done' : p >= 40 ? 'running' : 'pending' },
      { n: 4, label: 'Tải hình ảnh', sub: p >= 80 ? 'Hoàn tất' : 'Đang xử lý', state: p >= 80 ? 'done' : p >= 55 ? 'running' : 'pending' },
      { n: 5, label: 'Tạo dinh dưỡng', sub: p >= 90 ? 'Hoàn tất' : 'Chờ xử lý', state: p >= 90 ? 'done' : p >= 80 ? 'running' : 'pending' },
      { n: 6, label: 'Hoàn tất & kiểm tra', sub: p >= 100 ? 'Hoàn tất' : 'Chờ xử lý', state: p >= 100 ? 'done' : p >= 90 ? 'running' : 'pending' },
    ]
  }, [percent, created, eligible, jobStats.total])

  const progressLogs: ProgressLog[] = useMemo(() => [
    { time: '10:24:01', title: 'Đọc & chuẩn hóa file', detail: file ? `${file.name} · ${file.sizeLabel}` : 'mogu-dishes-august.xlsx · 2.4 MB', status: percent >= 12 ? 'done' : 'running' },
    { time: '10:24:04', title: 'Tạo món ăn', detail: `${Math.min(created, 156)} / 243`, status: percent >= 40 ? 'done' : percent >= 12 ? 'running' : 'pending' },
    { time: '10:24:18', title: 'Liên kết nguyên liệu', detail: percent >= 62 ? '1,420 / 1,420' : '820 / 1,420', status: percent >= 62 ? 'done' : percent >= 40 ? 'running' : 'pending' },
    { time: '10:24:22', title: 'Tải hình ảnh', detail: percent >= 80 ? '705 / 730' : '418 / 730', status: percent >= 80 ? 'done' : percent >= 55 ? 'running' : 'pending' },
    { time: '10:24:40', title: 'Tạo hồ sơ dinh dưỡng', status: percent >= 90 ? 'done' : percent >= 80 ? 'running' : 'pending' },
    { time: '10:24:52', title: 'Hoàn tất & kiểm tra', status: percent >= 100 ? 'done' : 'pending' },
  ], [percent, created, file])

  const reset = () => {
    setPhase('upload')
    setFile(null)
    setOptions(DEFAULT_OPTIONS)
    setMapping([])
    setIssues([])
    setValidateSummary(null)
    setJobStats({ total: 0, skipped: 0, failed: 0, warnings: 0 })
    setValidateTab('error')
    setCompleteTab('overview')
    setPercent(0)
    setCreated(0)
  }

  const patchOptions = (patch: Partial<ImportOptions>) => setOptions((o) => ({ ...o, ...patch }))

  const changeField = (id: string, field: string) => {
    setMapping((rows) =>
      rows.map((r) => (r.id === id ? { ...r, moguField: field, status: statusForField(field) } : r)),
    )
  }

  const onAutoMapChange = (v: boolean) => {
    patchOptions({ autoMap: v })
    if (v) {
      setMapping((rows) =>
        rows.map((r) => {
          const field = autoMapField(r.fileCol)
          return { ...r, moguField: field, status: statusForField(field) }
        }),
      )
    }
  }

  const applySimilar = () => {
    const calorieFix = issues.find((i) => i.field === 'calories' && i.fixType === 'input')?.fixValue
    if (!calorieFix) return
    setIssues((rows) =>
      rows.map((r) => (r.field === 'calories' && r.fixType === 'input' ? { ...r, fixValue: calorieFix } : r)),
    )
  }

  if (!open) return null

  const stepperCurrent = (phase === 'upload' ? 1 : phase === 'mapping' ? 2 : phase === 'validate' ? 3 : 4) as 1 | 2 | 3 | 4
  const showStepper = phase === 'upload' || phase === 'mapping' || phase === 'validate' || phase === 'confirm'
  const fileName = file?.name ?? 'mogu-dishes-august.xlsx'

  const previewData = useMemo(() => {
    if (!file?.csvText) return undefined
    return parseCsvPreview(file.csvText, 3)
  }, [file?.csvText])

  const title =
    phase === 'confirm' ? 'Xác nhận nhập dữ liệu'
      : phase === 'progress' ? 'Đang nhập dữ liệu'
        : phase === 'complete' ? 'Nhập dữ liệu hoàn tất'
          : 'Nhập món ăn từ file'

  return createPortal(
    <div className="fixed inset-0 z-[420] flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="shrink-0 border-b border-black/[0.08] px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-black">{title}</h2>
                {apiError && <p className="mt-1 text-xs text-red-600">{apiError}</p>}
                {phase === 'progress' && (
                  <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#1D4ED8]">
                    Đang xử lý
                  </span>
                )}
                {phase === 'complete' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-bold text-[#166534]">
                    ✓ Thành công
                  </span>
                )}
              </div>
              {(phase === 'progress' || phase === 'complete') && (
                <p className="mt-0.5 text-xs text-[#6B7280]">Batch #BATCH-2026-0812</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[#6B7280] hover:bg-black/5 hover:text-black"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {showStepper && (
            <div className="mt-4">
              <ImportStepper current={stepperCurrent} />
            </div>
          )}
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {phase === 'upload' && (
            <StepUpload
              file={file}
              headerRow={options.firstRowIsHeader}
              onHeaderChange={(v) => patchOptions({ firstRowIsHeader: v })}
              onFile={setFile}
              onClear={() => setFile(null)}
            />
          )}
          {phase === 'mapping' && (
            <StepMapping
              fileName={fileName}
              sheet={options.sheet}
              onSheetChange={(v) => patchOptions({ sheet: v })}
              autoMap={options.autoMap}
              onAutoMapChange={onAutoMapChange}
              rows={mapping}
              onChangeField={changeField}
              previewData={previewData}
            />
          )}
          {phase === 'validate' && (
            <StepValidate
              issues={issues}
              tab={validateTab}
              onTab={setValidateTab}
              onFix={(id, value) => setIssues((rows) => rows.map((r) => (r.id === id ? { ...r, fixValue: value } : r)))}
              duplicatePolicy={options.duplicatePolicy}
              onDuplicatePolicy={(v) => patchOptions({ duplicatePolicy: v })}
              updateEmptyOnly={options.updateEmptyOnly}
              onUpdateEmptyOnly={(v) => patchOptions({ updateEmptyOnly: v })}
              onApplySimilar={applySimilar}
            />
          )}
          {phase === 'confirm' && (
            <StepConfirm options={options} onChange={patchOptions} fileName={fileName} />
          )}
          {phase === 'progress' && (
            <StepProgress
              percent={percent}
              created={created}
              total={243}
              eta={percent >= 90 ? 'vài giây' : '1 phút 18 giây'}
              steps={progressSteps}
              logs={progressLogs}
              autoOpen={options.autoOpenResult}
              onAutoOpen={(v) => patchOptions({ autoOpenResult: v })}
            />
          )}
          {phase === 'complete' && (
            <StepComplete
              tab={completeTab}
              onTab={setCompleteTab}
              created={created}
              skipped={jobStats.skipped}
              failed={jobStats.failed}
              warnings={jobStats.warnings}
              total={validateSummary?.total ?? jobStats.total}
              onDownloadReport={jobId ? () => { void dishImportsApi.downloadReport(jobId).then((blob) => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `import-${jobId}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }) } : undefined}
            />
          )}
        </div>

        <footer className="shrink-0 border-t border-black/[0.08] px-6 py-4">
          {phase === 'upload' && (
            <div className="flex items-center justify-between">
              <GhostBtn onClick={onClose}>Hủy</GhostBtn>
              <PrimaryBtn
                disabled={!file || busy}
                onClick={async () => {
                  if (!file?.csvText) return
                  setBusy(true)
                  setApiError('')
                  try {
                    const created: any = await dishImportsApi.createSession(file.csvText, file.name)
                    setSessionId(created.sessionId)
                    setMapping(
                      (created.mapping ?? []).map((m: any, i: number) => ({
                        id: String(i),
                        fileCol: m.source,
                        sample: created.sample?.[0]?.[m.source] ?? '',
                        moguField: m.target,
                        status: (m.target ? 'mapped' : 'skip') as MappingRow['status'],
                      })),
                    )
                    setPhase('mapping')
                  } catch (err: any) {
                    setApiError(err?.response?.data?.message ?? err?.message ?? 'Upload thất bại')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? 'Đang đọc file...' : 'Tiếp tục: Ánh xạ cột'}
              </PrimaryBtn>
            </div>
          )}
          {phase === 'mapping' && (
            <div className="flex items-center justify-between">
              <GhostBtn onClick={() => setPhase('upload')}>Quay lại</GhostBtn>
              <div className="flex items-center gap-2">
                <GhostBtn><Save className="h-4 w-4" /> Lưu cấu hình ánh xạ</GhostBtn>
                <PrimaryBtn
                  disabled={!sessionId || busy}
                  onClick={async () => {
                    if (!sessionId) return
                    setBusy(true)
                    try {
                      await dishImportsApi.saveMapping(
                        sessionId,
                        mapping.map((r) => ({ source: r.fileCol, target: r.moguField })),
                      )
                      const result: any = await dishImportsApi.validate(sessionId)
                      setEligible(result.eligibleRows ?? result.summary?.eligibleRows ?? 0)
                      setValidateSummary(result.summary ?? null)
                      const rows: IssueRow[] = (result.issues ?? []).map((i: any, idx: number) => ({
                        id: String(idx),
                        row: i.rowNumber,
                        dishName: i.dishName ?? i.mapped?.name,
                        field: i.issues?.[0]?.field ?? '',
                        currentValue: i.issues?.[0]?.rawValue ?? '',
                        problem: i.issues?.[0]?.message ?? i.status,
                        kind: i.status === 'ERROR' ? 'error' : i.status === 'DUPLICATE' ? 'duplicate' : i.status === 'WARNING' ? 'warning' : 'valid',
                        fixType: 'input',
                        fixValue: '',
                      }))
                      setIssues(rows)
                      setPhase('validate')
                    } catch (err: any) {
                      setApiError(err?.response?.data?.message ?? 'Validate thất bại')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Tiếp tục: Kiểm tra dữ liệu
                </PrimaryBtn>
              </div>
            </div>
          )}
          {phase === 'validate' && (
            <div className="flex items-center justify-between">
              <GhostBtn onClick={() => setPhase('mapping')}>Quay lại</GhostBtn>
              <div className="flex items-center gap-2">
                <GhostBtn>Lưu lỗi và sửa sau</GhostBtn>
                <PrimaryBtn onClick={() => setPhase('confirm')}>Tiếp tục với {eligible || issues.filter((i) => i.kind !== 'error').length} dòng đủ điều kiện</PrimaryBtn>
              </div>
            </div>
          )}
          {phase === 'confirm' && (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={options.confirmed}
                  onChange={(e) => patchOptions({ confirmed: e.target.checked })}
                  className="mt-0.5 h-[18px] w-[18px] accent-[#FACC15]"
                />
                <span>
                  <span className="text-sm font-medium">Tôi đã kiểm tra dữ liệu và đồng ý bắt đầu nhập</span>
                  <span className="mt-0.5 block text-xs text-[#6B7280]">
                    Quá trình nhập có thể mất vài phút. Vui lòng không đóng trang cho đến khi hoàn tất.
                  </span>
                </span>
              </label>
              <div className="flex items-center justify-between">
                <GhostBtn onClick={() => setPhase('validate')}>Quay lại kiểm tra</GhostBtn>
                <div className="flex items-center gap-2">
                  <GhostBtn><Save className="h-4 w-4" /> Lưu cấu hình</GhostBtn>
                  <PrimaryBtn
                    disabled={!options.confirmed || !sessionId || busy}
                    onClick={async () => {
                      if (!sessionId) return
                      setBusy(true)
                      try {
                        await dishImportsApi.saveOptions(sessionId, {
                          duplicateMode:
                            options.duplicatePolicy === 'update'
                              ? 'UPDATE_DRAFT_ONLY'
                              : options.duplicatePolicy === 'draft'
                                ? 'CREATE_NEW'
                                : 'SKIP',
                          imageImportMode: options.downloadImages ? 'DOWNLOAD_TO_R2' : 'URL_ONLY',
                          unknownIngredientMode: options.newIngredientPolicy === 'create' ? 'CREATE_SUGGESTION' : 'SKIP',
                          failureMode: options.errorPolicy === 'rollback' ? 'ROLLBACK_ALL' : 'PARTIAL_SUCCESS',
                          outputStatus: 'DRAFT',
                        })
                        const started: any = await dishImportsApi.start(sessionId)
                        setJobId(started.jobId)
                        setPhase('progress')
                      } catch (err: any) {
                        setApiError(err?.response?.data?.message ?? 'Không start được job')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    <Play className="h-4 w-4" /> Bắt đầu nhập {eligible || ''} món
                  </PrimaryBtn>
                </div>
              </div>
            </div>
          )}
          {phase === 'progress' && (
            <div className="flex items-center justify-between">
              <GhostBtn className="border-red-200 text-[#DC2626] hover:bg-red-50" onClick={() => { if (jobId) void dishImportsApi.cancel(jobId); onClose() }}>
                <X className="h-4 w-4" /> Hủy tiến trình
              </GhostBtn>
              <div className="flex items-center gap-2">
                <GhostBtn onClick={onClose}><Cloud className="h-4 w-4" /> Chạy nền</GhostBtn>
                <PrimaryBtn disabled={percent < 100} onClick={() => setPhase('complete')}>Xem kết quả</PrimaryBtn>
              </div>
            </div>
          )}
          {phase === 'complete' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GhostBtn onClick={() => { reset(); onClose() }}>Đóng</GhostBtn>
                <GhostBtn onClick={reset}>Nhập file khác</GhostBtn>
              </div>
              <PrimaryBtn onClick={() => { onViewDrafts?.(sessionId ?? undefined); onClose() }}>
                Xem {created || eligible} bản nháp →
              </PrimaryBtn>
            </div>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
