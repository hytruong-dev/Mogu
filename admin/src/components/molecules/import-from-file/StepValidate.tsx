import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Link2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { Button } from '../../ui/button'
import { Card, CardContent } from '../../ui/card'
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
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
  { key: 'all', label: 'Tổng dòng', value: 250, icon: FileText, iconBg: 'bg-muted', iconColor: 'text-foreground/70' },
  { key: 'valid', label: 'Hợp lệ', value: 231, icon: CheckCircle2, iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-700 dark:text-emerald-400' },
  { key: 'warning', label: 'Cảnh báo', value: 12, icon: AlertTriangle, iconBg: 'bg-brand-50 dark:bg-brand-500/10', iconColor: 'text-brand-700 dark:text-brand-400' },
  { key: 'error', label: 'Lỗi', value: 7, icon: XCircle, iconBg: 'bg-rose-50 dark:bg-rose-500/10', iconColor: 'text-rose-600 dark:text-rose-400' },
  { key: 'duplicate', label: 'Trùng dữ liệu', value: 5, icon: Link2, iconBg: 'bg-violet-50 dark:bg-violet-500/10', iconColor: 'text-violet-600 dark:text-violet-400' },
] as const

const TABS: { id: ValidateTab; label: string; count: number; active: string }[] = [
  { id: 'all', label: 'Tất cả', count: 250, active: 'border-foreground text-foreground' },
  { id: 'error', label: 'Lỗi', count: 7, active: 'border-rose-500 text-rose-600 dark:text-rose-400' },
  { id: 'warning', label: 'Cảnh báo', count: 12, active: 'border-brand-600 text-brand-700 dark:text-brand-400' },
  { id: 'duplicate', label: 'Trùng', count: 5, active: 'border-violet-500 text-violet-600 dark:text-violet-400' },
  { id: 'valid', label: 'Hợp lệ', count: 231, active: 'border-emerald-600 text-emerald-700 dark:text-emerald-400' },
]

function valueTone(kind: IssueRow['kind']) {
  if (kind === 'error') return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
  if (kind === 'duplicate') return 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
  if (kind === 'warning') return 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'
  return 'bg-muted text-foreground/80'
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
          <Card key={s.key} className="shadow-xs">
            <CardContent className="p-3">
              <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', s.iconBg)}>
                <s.icon className={cn('h-4 w-4', s.iconColor)} />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_250px] gap-4">
        <div>
          <Tabs value={tab} onValueChange={(val) => onTab(val as ValidateTab)}>
            <TabsList className="w-full justify-start h-9 p-1">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
                  <span>{t.label}</span>
                  <span className="text-[11px] opacity-70">({t.count})</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Card className="mt-3 overflow-hidden">
            <Table className="w-full text-[13px]">
              <TableHeader>
                <TableRow className="text-left text-xs font-semibold text-muted-foreground">
                  <TableHead className="px-3 py-2">Dòng</TableHead>
                  <TableHead className="px-3 py-2">Tên món</TableHead>
                  <TableHead className="px-3 py-2">Trường lỗi</TableHead>
                  <TableHead className="px-3 py-2">Giá trị hiện tại</TableHead>
                  <TableHead className="px-3 py-2">Vấn đề</TableHead>
                  <TableHead className="px-3 py-2">Cách xử lý</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Không có dòng trong bộ lọc này.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => (
                  <TableRow key={row.id} className="border-t border-border/60">
                    <TableCell className="px-3 py-2 font-medium">{row.row}</TableCell>
                    <TableCell className="px-3 py-2 font-medium">{row.dishName}</TableCell>
                    <TableCell className="px-3 py-2 font-mono text-xs">{row.field}</TableCell>
                    <TableCell className="px-3 py-2">
                      <span className={cn('inline-block max-w-[160px] truncate rounded px-1.5 py-0.5 text-xs', valueTone(row.kind))}>
                        {row.currentValue || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-foreground/70">{row.problem}</TableCell>
                    <TableCell className="px-3 py-2">
                      {row.fixType === 'input' ? (
                        <Input
                          value={row.fixValue}
                          onChange={(e) => onFix(row.id, e.target.value)}
                          placeholder="Nhập giá trị"
                          className="h-8 w-[120px] text-xs"
                        />
                      ) : (
                        <Select
                          value={row.fixValue}
                          onChange={(e) => onFix(row.id, e.target.value)}
                          className="h-8 w-[150px] text-xs"
                        >
                          {row.fixOptions?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onApplySimilar}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Áp dụng cách xử lý cho lỗi cùng loại
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadErrors}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> Tải file lỗi .xlsx
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="shadow-xs">
            <CardContent className="p-3.5">
              <p className="mb-3 text-sm font-semibold text-foreground">Quy tắc khi gặp dữ liệu trùng</p>
              <div className="space-y-2.5">
                <YellowRadio checked={duplicatePolicy === 'skip'} onChange={() => onDuplicatePolicy('skip')} title="Bỏ qua" hint="Không nhập dòng trùng." />
                <YellowRadio checked={duplicatePolicy === 'update'} onChange={() => onDuplicatePolicy('update')} title="Cập nhật món hiện có" hint="Ghi đè dữ liệu món đã có." />
                <YellowRadio checked={duplicatePolicy === 'draft'} onChange={() => onDuplicatePolicy('draft')} title="Tạo bản nháp mới" hint="Giữ món cũ, tạo bản nháp riêng." />
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <YellowCheck
                  checked={updateEmptyOnly}
                  onChange={onUpdateEmptyOnly}
                  label="Chỉ cập nhật trường trống"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-3.5">
              <p className="mb-3 text-sm font-semibold text-foreground">Điều kiện nhập</p>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  <div>
                    <p className="font-medium text-foreground">Dòng lỗi (7 dòng)</p>
                    <p className="text-xs text-muted-foreground">Không được nhập</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <div>
                    <p className="font-medium text-foreground">Dòng cảnh báo (12 dòng)</p>
                    <p className="text-xs text-muted-foreground">Vẫn được nhập</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
