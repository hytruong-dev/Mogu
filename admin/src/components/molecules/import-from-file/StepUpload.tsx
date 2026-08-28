import { useRef, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Columns3,
  FileType2,
  Info,
  List,
  Tags,
  Upload,
  X,
} from 'lucide-react'
import { FILE_RULES, SAMPLE_CSV, formatBytes } from './demo-data'
import type { UploadedFileInfo } from './types'
import { ExcelMark, YellowCheck } from './widgets'

const RULE_ICONS = [Columns3, FileType2, List, Tags]

interface Props {
  file: UploadedFileInfo | null
  headerRow: boolean
  onHeaderChange: (v: boolean) => void
  onFile: (file: UploadedFileInfo) => void
  onClear: () => void
}

export function StepUpload({ file, headerRow, onHeaderChange, onFile, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const acceptFile = (f: File) => {
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) return
    void (async () => {
      try {
        const { fileToCsvText } = await import('../../../lib/spreadsheet')
        const csvText = await fileToCsvText(f)
        onFile({ name: f.name, sizeLabel: formatBytes(f.size), sizeBytes: f.size, csvText })
      } catch (err: any) {
        alert(err?.message ?? 'Không đọc được file')
      }
    })()
  }

  const downloadTemplate = async () => {
    try {
      const { dishImportsApi } = await import('../../../api/dish-imports')
      const blob = await dishImportsApi.downloadTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mogu-dish-import-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mogu-mau-nhap-mon.csv'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B7280]">Nhập nhiều món ăn bằng CSV hoặc Excel.</p>

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) acceptFile(f)
          }}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition ${
            dragging ? 'border-mogu-yellow bg-mogu-yellow-light' : 'border-[#E5E7EB] bg-[#FAFAF9] hover:border-mogu-yellow/80'
          }`}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mogu-yellow-light">
            <Upload className="h-5 w-5 text-[#A16207]" />
          </div>
          <p className="text-sm font-semibold text-black">Kéo thả file vào đây, hoặc bấm để chọn</p>
          <p className="mt-1 text-xs text-[#6B7280]">CSV, XLSX · tối đa 10 MB</p>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
          <ExcelMark size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-black">{file.name}</p>
              <span className="shrink-0 text-xs text-[#6B7280]">{file.sizeLabel}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#BBF7D0]">
              <div className="h-full w-full rounded-full bg-[#22C55E]" />
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[11px] font-semibold text-[#166534]">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#22C55E] text-white">✓</span>
            Đã tải lên
          </span>
          <button type="button" onClick={onClear} className="shrink-0 rounded-md p-1 text-[#9CA3AF] hover:bg-black/5 hover:text-black">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) acceptFile(f)
          e.target.value = ''
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition hover:border-mogu-yellow/70 hover:bg-[#FFFDF5]"
        >
          <ExcelMark size={36} />
          <div>
            <p className="text-sm font-semibold text-black">Tải file mẫu Excel</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Tải về file mẫu với định dạng chuẩn</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition hover:border-mogu-yellow/70 hover:bg-[#FFFDF5]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3E8FF]">
            <BookOpen className="h-5 w-5 text-[#7C3AED]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-black">Xem hướng dẫn chuẩn bị dữ liệu</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Hướng dẫn chi tiết và ví dụ minh họa</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-black">Quy tắc tệp</p>
        <div className="overflow-hidden rounded-xl border border-black/10">
          {FILE_RULES.map((rule, i) => {
            const Icon = RULE_ICONS[i]
            return (
              <div
                key={rule.title}
                className={`grid grid-cols-[160px_1fr] items-start gap-4 px-4 py-3 ${i < FILE_RULES.length - 1 ? 'border-b border-black/5' : ''}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-black">
                  <Icon className="h-4 w-4 text-[#6B7280]" />
                  {rule.title}
                </div>
                <p className="text-sm text-[#4B5563]">{rule.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      <YellowCheck
        checked={headerRow}
        onChange={onHeaderChange}
        label="Dòng đầu tiên là tên cột"
        hint="Bỏ chọn nếu file không có hàng tiêu đề."
      />

      <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[13px] text-[#92400E]">
        <Info className="h-4 w-4 shrink-0" />
        Lần nhập gần nhất: 12/08/2026 • 250 món • hoàn tất
      </div>

      {guideOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold">Hướng dẫn chuẩn bị dữ liệu</h3>
              <button type="button" onClick={() => setGuideOpen(false)} className="rounded-md p-1 hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[#4B5563]">
              <li>• Cột bắt buộc: <b>dish_name</b>, <b>region</b>, <b>category</b>.</li>
              <li>• Calories, protein, carbs, fat phải là số (không viết chữ).</li>
              <li>• meal_types và ingredients phân tách bằng dấu <b>;</b></li>
              <li>• image_url nên dùng HTTPS, dung lượng ảnh &lt; 2 MB.</li>
              <li>• Một món một dòng. Không gộp nhiều món.</li>
            </ul>
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="mt-5 h-10 w-full rounded-lg bg-mogu-yellow text-sm font-bold"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
