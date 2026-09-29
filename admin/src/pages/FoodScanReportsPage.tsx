import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  CheckCircle2,
  Clock,
  ImageOff,
  Link2,
  Loader2,
  Plus,
  ScanSearch,
  Search,
  Users,
  XCircle,
} from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  FOOD_SCAN_CATEGORY_LABEL,
  type FoodScanReport,
  type FoodScanReportStatus,
} from '../api/food-scan-reports'
import { dishesApi } from '../api/dishes'
import type { Dish } from '../types'
import {
  useFoodScanReportSummary,
  useFoodScanReports,
  useUpdateFoodScanReport,
} from '../hooks/useFoodScanReports'

const TABS: { value: FoodScanReportStatus; label: string; key: 'new' | 'inProgress' | 'added' | 'dismissed' }[] = [
  { value: 'NEW', label: 'Mới', key: 'new' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý', key: 'inProgress' },
  { value: 'ADDED', label: 'Đã thêm', key: 'added' },
  { value: 'DISMISSED', label: 'Bỏ qua', key: 'dismissed' },
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

// ─── Link-existing dialog ─────────────────────────────────────────────────────

function LinkDishDialog({
  report,
  onClose,
}: {
  report: FoodScanReport | null
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Dish[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [addAlias, setAddAlias] = useState(true)
  const update = useUpdateFoodScanReport()

  useEffect(() => {
    if (!report) return
    setQ(report.recognizedName ?? '')
    setSelected(report.suggestedDishes[0] ?? null)
    setAddAlias(true)
  }, [report])

  useEffect(() => {
    if (!report) return
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      dishesApi
        .list({ q: term, limit: 8, sort: 'relevance' })
        .then((page) => !cancelled && setResults(page.data ?? []))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false))
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, report])

  const options = [
    ...(report?.suggestedDishes ?? []),
    ...results.filter((d) => !report?.suggestedDishes.some((s) => s.id === d.id)),
  ]

  const submit = () => {
    if (!report || !selected) return
    update.mutate(
      {
        id: report.id,
        dto: { status: 'ADDED', linkedDishId: selected.id, addAlias },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Liên kết với món có sẵn</DialogTitle>
          <DialogDescription>
            Chọn món trong kho trùng với ảnh người dùng chụp
            {report?.recognizedName ? ` ("${report.recognizedName}")` : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm món theo tên..."
              className="pl-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {searching && options.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Đang tìm...
              </div>
            ) : options.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Không tìm thấy món phù hợp.</div>
            ) : (
              options.map((d) => {
                const isSuggested = report?.suggestedDishes.some((s) => s.id === d.id)
                const active = selected?.id === d.id
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelected({ id: d.id, name: d.name })}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors ${
                      active ? 'bg-amber-50 text-amber-900' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium truncate">{d.name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {isSuggested && <Badge variant="outline" className="text-[10px]">AI gợi ý</Badge>}
                      {active && <CheckCircle2 size={16} className="text-amber-600" />}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          {report?.recognizedName && (
            <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addAlias}
                onChange={(e) => setAddAlias(e.target.checked)}
                className="mt-0.5 accent-amber-600"
              />
              <span>
                Thêm <b>"{report.recognizedName}"</b> làm tên gọi khác của món, để lần sau quét ra đúng món.
              </span>
            </label>
          )}
          {update.isError && (
            <p className="text-xs text-destructive">Không thể liên kết. Vui lòng thử lại.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Huỷ</Button>
          <Button onClick={submit} disabled={!selected || update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" />}
            Liên kết{selected ? ` "${selected.name}"` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onLink,
}: {
  report: FoodScanReport
  onLink: (r: FoodScanReport) => void
}) {
  const navigate = useNavigate()
  const update = useUpdateFoodScanReport()
  const open = report.status === 'NEW' || report.status === 'IN_PROGRESS'
  const nameEn = report.guesses.find((g) => g.nameEn)?.nameEn
  const otherGuesses = report.guesses
    .map((g) => g.nameVi)
    .filter((n) => n && n !== report.recognizedName)
    .slice(0, 3)

  return (
    <Card className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] bg-muted">
        {report.imageUrl ? (
          <img
            src={report.imageUrl}
            alt={report.recognizedName ?? 'Ảnh người dùng chụp'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-1">
            <ImageOff size={28} />
            <span className="text-xs">Không có ảnh</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge variant={report.source === 'USER' ? 'info' : 'secondary'} className="text-[10px] shadow-sm">
            {report.source === 'USER' ? 'Người dùng báo' : 'Tự động'}
          </Badge>
        </div>
        {report.reportCount > 1 && (
          <Badge variant="warning" className="absolute top-2 right-2 text-[10px] shadow-sm gap-1">
            <Users size={11} /> {report.reportCount} lần
          </Badge>
        )}
      </div>
      <CardContent className="p-4 flex-1 flex flex-col gap-2.5">
        <div>
          <div className="font-bold text-base leading-tight">
            {report.recognizedName ?? 'AI không đọc được tên'}
          </div>
          {nameEn && <div className="text-xs text-muted-foreground italic">{nameEn}</div>}
          {otherGuesses.length > 0 && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Có thể là: {otherGuesses.join(', ')}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {report.category && (
            <Badge variant="outline" className="text-[10px]">
              {FOOD_SCAN_CATEGORY_LABEL[report.category] ?? report.category}
            </Badge>
          )}
          {report.cuisine && <Badge variant="outline" className="text-[10px]">{report.cuisine}</Badge>}
        </div>
        {report.visibleIngredients.length > 0 && (
          <p className="text-xs text-slate-600 line-clamp-2">
            <span className="font-semibold">Nguyên liệu thấy được: </span>
            {report.visibleIngredients.join(', ')}
          </p>
        )}
        {report.suggestedDishes.length > 0 && (
          <p className="text-xs text-slate-500 line-clamp-1">
            <span className="font-semibold">Gần nhất trong kho: </span>
            {report.suggestedDishes.map((d) => d.name).join(', ')}
          </p>
        )}
        {report.linkedDish && (
          <button
            type="button"
            onClick={() => navigate(`/foods/${report.linkedDish!.id}`)}
            className="text-xs text-emerald-700 font-semibold flex items-center gap-1 hover:underline text-left"
          >
            <CheckCircle2 size={13} /> Đã liên kết: {report.linkedDish.name}
          </button>
        )}
        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-auto pt-1">
          <Clock size={11} /> {timeAgo(report.updatedAt)}
        </div>
        {open ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              className="col-span-2"
              onClick={() => navigate(`/foods/new?scanReport=${report.id}`)}
            >
              <Plus /> Tạo món từ ảnh này
            </Button>
            <Button size="sm" variant="outline" onClick={() => onLink(report)}>
              <Link2 /> Liên kết món
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: report.id, dto: { status: 'DISMISSED' } })}
            >
              <XCircle /> Bỏ qua
            </Button>
          </div>
        ) : (
          report.status === 'DISMISSED' && (
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: report.id, dto: { status: 'NEW' } })}
            >
              Mở lại
            </Button>
          )
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FoodScanReportsPage() {
  const [status, setStatus] = useState<FoodScanReportStatus>('NEW')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [linkTarget, setLinkTarget] = useState<FoodScanReport | null>(null)
  const { data: summary } = useFoodScanReportSummary()
  const { data, isLoading, isError } = useFoodScanReports({
    status,
    q: debouncedQ || undefined,
    limit: 48,
  })

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const items = data?.items ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <ScanSearch className="text-amber-500" size={24} /> Món chưa có (Scan)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ảnh người dùng quét mà Mogu chưa có món tương ứng. Bổ sung món mới hoặc liên kết món có sẵn để lần sau quét ra đúng.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên AI đoán..."
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as FoodScanReportStatus)}>
        <TabsList>
          {TABS.map((t) => {
            const count = summary?.[t.key]
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.label}
                {count !== undefined && (
                  <span
                    className={`text-[10px] font-bold rounded-full px-1.5 py-px ${
                      t.value === 'NEW' && count > 0 ? 'bg-rose-500 text-white' : 'bg-muted-foreground/15'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-destructive">
            Không tải được danh sách. Kiểm tra migration <code>food_scan_missing_dish_reports</code> đã chạy chưa.
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Camera className="mx-auto text-muted-foreground" size={32} />
            <div className="font-semibold">Không có mục nào</div>
            <p className="text-sm text-muted-foreground">
              {status === 'NEW'
                ? 'Chưa có món nào người dùng quét mà thiếu trong kho.'
                : 'Chưa có mục nào ở trạng thái này.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((r) => (
            <ReportCard key={r.id} report={r} onLink={setLinkTarget} />
          ))}
        </div>
      )}

      <LinkDishDialog report={linkTarget} onClose={() => setLinkTarget(null)} />
    </div>
  )
}
