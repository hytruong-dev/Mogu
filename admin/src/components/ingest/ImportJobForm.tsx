import { useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  Clock3,
  Database,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  Info,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { SOURCE_OPTIONS } from './types'

export interface ImportJobFormProps {
  dishName: string
  onDishNameChange: (val: string) => void
  keywords: string
  onKeywordsChange: (val: string) => void
  regionCode: string
  onRegionCodeChange: (val: string) => void
  regions: Array<{ code: string; name: string }>
  selectedSources: string[]
  onToggleSource: (src: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  error?: string | null
}

export function ImportJobForm({
  dishName,
  onDishNameChange,
  keywords,
  onKeywordsChange,
  regionCode,
  onRegionCodeChange,
  regions,
  selectedSources,
  onToggleSource,
  onSubmit,
  isSubmitting,
  error,
}: ImportJobFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Form Card ── */}
      <Card className="lg:col-span-8 shadow-xs border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold text-foreground">Thiết lập thông tin thu thập</CardTitle>
          <CardDescription className="text-xs">Nhập tên món ăn tiếng Việt để kích hoạt luồng AI tự động tìm kiếm và chuẩn hóa dữ liệu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Tên món ăn <span className="text-destructive">*</span>
            </Label>
            <Input
              value={dishName}
              onChange={(e) => onDishNameChange(e.target.value)}
              placeholder="VD: Phở bò tái lăn, Bún chả Hà Nội..."
              className="h-10 text-sm font-medium"
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            />
          </div>

          <button
            type="button"
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left border border-border"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Tùy chọn nâng cao</span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">(Từ khóa bổ trợ và vùng miền)</span>
            </span>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Từ khóa liên quan
                </Label>
                <Input
                  value={keywords}
                  onChange={(e) => onKeywordsChange(e.target.value)}
                  placeholder="phở tái, Vietnamese beef pho, phở bò Hà Nội"
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">Giúp AI hiểu ngữ cảnh chính xác hơn (ngăn cách bởi dấu phẩy).</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Vùng miền ẩm thực</Label>
                <div className="flex flex-wrap gap-2">
                  {(regions.length > 0
                    ? regions
                    : [
                        { code: 'north', name: 'Miền Bắc' },
                        { code: 'central', name: 'Miền Trung' },
                        { code: 'south', name: 'Miền Nam' },
                      ]
                  ).map((r) => (
                    <Button
                      key={r.code}
                      type="button"
                      size="sm"
                      variant={regionCode === r.code ? 'default' : 'outline'}
                      className={`h-8 px-3 text-xs font-semibold ${regionCode === r.code ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                      onClick={() => onRegionCodeChange(regionCode === r.code ? '' : r.code)}
                    >
                      {r.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
            <Info size={15} className="text-sky-500 shrink-0" />
            <span>Mỗi lần chỉ tạo 1 món. Món hoàn thành sẽ ở trạng thái <strong className="font-semibold text-foreground">BẢN NHÁP</strong> để kiểm duyệt trước khi phát hành.</span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20" role="alert">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-foreground">Nguồn dữ liệu tham chiếu</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOURCE_OPTIONS.map((src) => {
                const isChecked = selectedSources.includes(src.value)
                return (
                  <div
                    key={src.value}
                    onClick={() => onToggleSource(src.value)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                      isChecked
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => onToggleSource(src.value)}
                      aria-label={src.label}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col text-left min-w-0">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Database size={13} className="text-amber-500 shrink-0" />
                        {src.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{src.description}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Button
            className="w-full h-10 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs gap-2 mt-2"
            onClick={onSubmit}
            disabled={isSubmitting || !dishName.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Đang tạo tiến trình AI...
              </>
            ) : (
              <>
                <ArrowDownToLine size={16} /> Bắt đầu tạo món tự động bằng AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Right Panel: AI Support Features ── */}
      <Card className="lg:col-span-4 border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            AI sẽ tự động tạo
          </CardTitle>
          <CardDescription className="text-xs">Các trường dữ liệu được chuẩn hóa đa tầng</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-xs">
            {[
              'Thông tin món & Tóm tắt mô tả',
              'Định lượng danh sách nguyên liệu',
              'Các bước công thức chế biến chuẩn',
              'Bảng phân tích dinh dưỡng ước tính',
            ].map((text, idx) => (
              <li key={idx} className="flex items-center gap-2 text-foreground font-medium">
                <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="h-px bg-border" />

          <div className="space-y-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Các bước xử lý
            </span>
            <div className="space-y-2">
              {[
                { step: '1', title: 'Tiếp nhận tên món', desc: 'Phân tích thực thể ẩm thực' },
                { step: '2', title: 'Thu thập đa nguồn', desc: 'Tìm công thức & dinh dưỡng' },
                { step: '3', title: 'Tạo bản nháp studio', desc: 'Sẵn sàng để rà soát duyệt' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30 border border-border">
                  <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {step}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">{title}</span>
                    <span className="text-[11px] text-muted-foreground">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border text-xs text-muted-foreground">
            <Clock3 size={14} className="text-amber-500 shrink-0" />
            <span>Thời gian ước tính: <strong className="font-semibold text-foreground">15–30 giây</strong></span>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
            Dữ liệu do AI tạo cần được biên tập viên kiểm tra trong Hàng đợi duyệt trước khi đưa lên ứng dụng.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
