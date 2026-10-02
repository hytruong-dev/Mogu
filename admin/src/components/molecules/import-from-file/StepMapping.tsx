import { Info } from 'lucide-react'
import { Select } from '../../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { MOGU_FIELDS, PREVIEW_HEADERS, PREVIEW_ROWS } from './demo-data'
import type { MappingRow } from './types'
import { ExcelMark, MapStatusBadge, YellowSwitch } from './widgets'
import { cn } from '@/lib/utils'

interface Props {
  fileName: string
  sheet: string
  onSheetChange: (v: string) => void
  autoMap: boolean
  onAutoMapChange: (v: boolean) => void
  rows: MappingRow[]
  onChangeField: (id: string, field: string) => void
  previewData?: { headers: string[]; rows: string[][] }
}

export function StepMapping({
  fileName, sheet, onSheetChange, autoMap, onAutoMapChange, rows, onChangeField, previewData,
}: Props) {
  const mapped = rows.filter((r) => r.status === 'mapped').length
  const skipped = rows.filter((r) => r.status === 'skip').length
  const needCheck = rows.filter((r) => r.status === 'check').length

  const previewHeaders = previewData?.headers?.length ? previewData.headers : PREVIEW_HEADERS
  const previewRows = previewData?.rows?.length
    ? previewData.rows.map((cells, i) => ({ id: String(i), cells }))
    : PREVIEW_ROWS

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-[#FAFAF9] px-4 py-2.5">
        <ExcelMark size={32} />
        <span className="text-sm font-semibold text-black">{fileName}</span>
        <div className="w-40">
          <Select
            value={sheet}
            onChange={(e) => onSheetChange(e.target.value)}
            className="h-8 text-xs font-medium"
          >
            <option value="Dishes">Sheet: Dishes</option>
            <option value="Ingredients">Sheet: Ingredients</option>
          </Select>
        </div>
        <span className="text-xs text-[#6B7280]">250 dòng</span>
        <span className="text-xs text-[#6B7280]">18 cột</span>
      </div>

      <div className="flex items-center gap-2">
        <YellowSwitch checked={autoMap} onChange={onAutoMapChange} label="Tự động ánh xạ cột có tên tương tự" />
        <span className="text-[#9CA3AF]" title="Ghép cột file với trường Mogu khi tên gần giống nhau">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-4">
        <div className="overflow-hidden rounded-xl border border-black/10">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="bg-[#FAFAF9] text-left text-xs font-semibold text-[#6B7280]">
                <TableHead className="px-3 py-2.5">Cột trong file</TableHead>
                <TableHead className="px-3 py-2.5">Dữ liệu mẫu</TableHead>
                <TableHead className="px-3 py-2.5">Trường trong Mogu</TableHead>
                <TableHead className="px-3 py-2.5">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-t border-black/5">
                  <TableCell className="px-3 py-2 font-mono text-[13px] font-medium">{row.fileCol}</TableCell>
                  <TableCell className="max-w-[180px] truncate px-3 py-2 text-[13px] text-[#6B7280]">{row.sample}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Select
                      value={row.moguField}
                      onChange={(e) => onChangeField(row.id, e.target.value)}
                      className={cn(
                        'h-8 w-full rounded-md text-xs',
                        row.moguField ? 'border-black/15' : 'border-black/10 text-[#9CA3AF]',
                      )}
                    >
                      {MOGU_FIELDS.map((f) => (
                        <option key={f.id || 'skip'} value={f.id}>{f.label}</option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <MapStatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="h-fit rounded-xl border border-black/10 bg-white p-4">
          <p className="mb-3 text-sm font-semibold">Tóm tắt ánh xạ</p>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-[#6B7280]">Đã ánh xạ</span>
              <b className="text-[#16A34A]">{mapped}/{rows.length}</b>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6B7280]">Trường bắt buộc</span>
              <b className="text-[#16A34A]">6/6</b>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6B7280]">Bỏ qua</span>
              <b>{skipped}</b>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6B7280]">Cần kiểm tra</span>
              <b className="text-[#EA580C]">{needCheck}</b>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Xem trước dữ liệu (3 dòng đầu tiên)</p>
        <div className="overflow-x-auto rounded-xl border border-black/10">
          <Table className="w-full text-xs">
            <TableHeader>
              <TableRow className="bg-[#FAFAF9] text-left text-[#6B7280]">
                {previewHeaders.map((h) => (
                  <TableHead key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((r) => (
                <TableRow key={r.id} className="border-t border-black/5">
                  {r.cells.map((c, i) => (
                    <TableCell key={i} className="whitespace-nowrap px-3 py-2 text-[#374151]">{c}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
