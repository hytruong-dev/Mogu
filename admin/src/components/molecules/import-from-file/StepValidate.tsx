import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Link2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import type { DuplicatePolicy, IssueRow, ValidateTab } from './types'
import { YellowCheck, YellowRadio } from './widgets'
import { cn } from '@/lib/utils'

interface Props {
  issues: IssueRow[]
  tab: ValidateTab
  onTab: (t: ValidateTab) => void
  onFix: (id: string, value: string) => void
  duplicatePolicy: DuplicatePolicy
  onDuplicatePolicy: (v: DuplicatePolicy) => void
  updateEmptyOnly: boolean
  onUpdateEmptyOnly: (v: boolean) => void
  onApplySimilar: () => void
}

const STATS = [
  { key: 'all', label: 'Tổng dòng', value: 250, icon: FileText, iconBg: 'bg-[#F3F4F6]', iconColor: 'text-[#4B5563]' },
  { key: 'valid', label: 'Hợp lệ', value: 231, icon: CheckCircle2, iconBg: 'bg-[#ECFDF3]', iconColor: 'text-[#16A34A]' },
  { key: 'warning', label: 'Cảnh báo', value: 12, icon: AlertTriangle, iconBg: 'bg-[#FFF7ED]', iconColor: 'text-[#EA580C]' },
  { key: 'error', label: 'Lỗi', value: 7, icon: XCircle, iconBg: 'bg-[#FEF2F2]', iconColor: 'text-[#DC2626]' },
  { key: 'duplicate', label: 'Trùng dữ liệu', value: 5, icon: Link2, iconBg: 'bg-[#F5F3FF]', iconColor: 'text-[#7C3AED]' },
] as const

const TABS: { id: ValidateTab; label: string; count: number; active: string }[] = [
  { id: 'all', label: 'Tất cả', count: 250, active: 'border-black text-black' },
  { id: 'error', label: 'Lỗi', count: 7, active: 'border-[#DC2626] text-[#DC2626]' },
  { id: 'warning', label: 'Cảnh báo', count: 12, active: 'border-[#EA580C] text-[#EA580C]' },
  { id: 'duplicate', label: 'Trùng', count: 5, active: 'border-[#7C3AED] text-[#7C3AED]' },
  { id: 'valid', label: 'Hợp lệ', count: 231, active: 'border-[#16A34A] text-[#16A34A]' },
]

function valueTone(kind: IssueRow['kind']) {
  if (kind === 'error') return 'bg-[#FEF2F2] text-[#B91C1C]'
  if (kind === 'duplicate') return 'bg-[#F5F3FF] text-[#6D28D9]'
  if (kind === 'warning') return 'bg-[#FFF7ED] text-[#C2410C]'
  return 'bg-[#F3F4F6] text-[#374151]'
}

export function StepValidate({
  issues, tab, onTab, onFix, duplicatePolicy, onDuplicatePolicy, updateEmptyOnly, onUpdateEmptyOnly, onApplySimilar,
}: Props) {
  const filtered = issues.filter((i) => {
    if (tab === 'all') return true
    if (tab === 'error') return i.kind === 'error'
    if (tab === 'warning') return i.kind === 'warning'
    if (tab === 'duplicate') return i.kind === 'duplicate'
    return i.kind === 'valid'
  })

  const downloadErrors = () => {
    const header = 'row,dish_name,field,value,problem\n'
    const body = issues
      .filter((i) => i.kind === 'error')
      .map((i) => `${i.row},"${i.dishName}",${i.field},"${i.currentValue}","${i.problem}"`)
      .join('\n')
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mogu-import-errors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2.5">
        {STATS.map((s) => (
          <div key={s.key} className="rounded-xl border border-black/10 bg-white px-3 py-3">
            <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', s.iconBg)}>
              <s.icon className={cn('h-4 w-4', s.iconColor)} />
            </div>
            <p className="text-xl font-extrabold leading-none">{s.value}</p>
            <p className="mt-1 text-xs text-[#6B7280]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_250px] gap-4">
        <div>
          <div className="flex items-center gap-1 border-b border-black/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold',
                  tab === t.id ? t.active : 'border-transparent text-[#6B7280] hover:text-black',
                )}
              >
                {t.label} {t.count}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-black/10">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#FAFAF9] text-left text-xs font-semibold text-[#6B7280]">
                  <th className="px-3 py-2">Dòng</th>
                  <th className="px-3 py-2">Tên món</th>
                  <th className="px-3 py-2">Trường lỗi</th>
                  <th className="px-3 py-2">Giá trị hiện tại</th>
                  <th className="px-3 py-2">Vấn đề</th>
                  <th className="px-3 py-2">Cách xử lý</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#9CA3AF]">
                      Không có dòng trong bộ lọc này.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-black/5">
                    <td className="px-3 py-2 font-medium">{row.row}</td>
                    <td className="px-3 py-2 font-medium">{row.dishName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.field}</td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-block max-w-[160px] truncate rounded px-1.5 py-0.5 text-xs', valueTone(row.kind))}>
                        {row.currentValue || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#4B5563]">{row.problem}</td>
                    <td className="px-3 py-2">
                      {row.fixType === 'input' ? (
                        <input
                          value={row.fixValue}
                          onChange={(e) => onFix(row.id, e.target.value)}
                          placeholder="Nhập giá trị"
                          className="h-8 w-[120px] rounded-md border border-black/15 px-2 text-xs"
                        />
                      ) : (
                        <select
                          value={row.fixValue}
                          onChange={(e) => onFix(row.id, e.target.value)}
                          className="h-8 w-[150px] rounded-md border border-black/15 bg-white px-2 text-xs"
                        >
                          {row.fixOptions?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onApplySimilar}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold hover:bg-black/[0.03]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Áp dụng cách xử lý cho lỗi cùng loại
            </button>
            <button
              type="button"
              onClick={downloadErrors}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold hover:bg-black/[0.03]"
            >
              <Download className="h-3.5 w-3.5" /> Tải file lỗi .xlsx
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-black/10 p-3.5">
            <p className="mb-3 text-sm font-semibold">Quy tắc khi gặp dữ liệu trùng</p>
            <div className="space-y-2.5">
              <YellowRadio checked={duplicatePolicy === 'skip'} onChange={() => onDuplicatePolicy('skip')} title="Bỏ qua" hint="Không nhập dòng trùng." />
              <YellowRadio checked={duplicatePolicy === 'update'} onChange={() => onDuplicatePolicy('update')} title="Cập nhật món hiện có" hint="Ghi đè dữ liệu món đã có." />
              <YellowRadio checked={duplicatePolicy === 'draft'} onChange={() => onDuplicatePolicy('draft')} title="Tạo bản nháp mới" hint="Giữ món cũ, tạo bản nháp riêng." />
            </div>
            <div className="mt-3 border-t border-black/5 pt-3">
              <YellowCheck
                checked={updateEmptyOnly}
                onChange={onUpdateEmptyOnly}
                label="Chỉ cập nhật trường trống"
              />
            </div>
          </div>

          <div className="rounded-xl border border-black/10 p-3.5">
            <p className="mb-3 text-sm font-semibold">Điều kiện nhập</p>
            <div className="space-y-2 text-[13px]">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#DC2626]" />
                <div>
                  <p className="font-medium">Dòng lỗi (7 dòng)</p>
                  <p className="text-xs text-[#6B7280]">Không được nhập</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#F59E0B]" />
                <div>
                  <p className="font-medium">Dòng cảnh báo (12 dòng)</p>
                  <p className="text-xs text-[#6B7280]">Vẫn được nhập</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
