import { useState, useMemo } from 'react'
import {
  ArrowDownToLine,
  ChevronDown,
  Database,
  Layers,
  Loader2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { SOURCE_OPTIONS } from './types'

export interface ImportJobFormProps {
  // Single mode props
  dishName: string
  onDishNameChange: (val: string) => void
  keywords: string
  onKeywordsChange: (val: string) => void
  onSingleSubmit: () => void

  // Batch mode props
  onBatchSubmit: (dishes: string[]) => void

  // Common props
  regionCode: string
  onRegionCodeChange: (val: string) => void
  regions: Array<{ code: string; name: string }>
  selectedSources: string[]
  onToggleSource: (src: string) => void
  isSubmitting: boolean
  error?: string | null
}

export function ImportJobForm({
  dishName,
  onDishNameChange,
  keywords,
  onKeywordsChange,
  onSingleSubmit,
  onBatchSubmit,
  regionCode,
  onRegionCodeChange,
  regions,
  selectedSources,
  onToggleSource,
  isSubmitting,
  error,
}: ImportJobFormProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [batchText, setBatchText] = useState('')

  // Parse list of dishes from textarea (newlines or commas)
  const parsedBatchDishes = useMemo(() => {
    return batchText
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }, [batchText])

  const handleRemoveBatchItem = (indexToRemove: number) => {
    const updated = parsedBatchDishes.filter((_, idx) => idx !== indexToRemove)
    setBatchText(updated.join('\n'))
  }

  const handleClearBatch = () => {
    setBatchText('')
  }

  const handleTriggerBatchSubmit = () => {
    if (parsedBatchDishes.length === 0 || isSubmitting) return
    onBatchSubmit(parsedBatchDishes)
    setBatchText('')
  }

  return (
    <Card className="shadow-xs border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              Thiết lập thu thập món AI
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Hỗ trợ nhập nhiều món liên tục hoặc chạy hàng loạt song song.
            </CardDescription>
          </div>
        </div>

        {/* Tab switch between Single continuous and Batch entry */}
        <div className="pt-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'batch')}>
            <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-muted/60">
              <TabsTrigger
                value="single"
                className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs gap-1.5"
              >
                <Zap size={13} className="text-amber-500" />
                Nhập từng món liên tục
              </TabsTrigger>
              <TabsTrigger
                value="batch"
                className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs gap-1.5"
              >
                <Layers size={13} className="text-amber-500" />
                Nhập danh sách hàng loạt
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Mode 1: Single Continuous Input ── */}
        {activeTab === 'single' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Tên món ăn <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">Nhấn Enter để gửi nhanh</span>
              </div>
              <Input
                value={dishName}
                onChange={(e) => onDishNameChange(e.target.value)}
                placeholder="VD: Phở bò tái lăn, Bún chả Hà Nội, Cơm tấm sườn..."
                className="h-10 text-sm font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSingleSubmit()
                  }
                }}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Từ khóa liên quan <span className="text-muted-foreground font-normal">(Tùy chọn)</span>
              </Label>
              <Input
                value={keywords}
                onChange={(e) => onKeywordsChange(e.target.value)}
                placeholder="VD: phở tái, phở bò Hà Nội, nước dùng thanh..."
                className="h-9 text-xs"
                disabled={isSubmitting}
              />
            </div>
          </div>
        ) : (
          /* ── Mode 2: Batch List Input ── */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Danh sách món ăn <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">Mỗi món 1 dòng hoặc cách nhau bởi dấu phẩy</span>
              </div>
              <Textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={'Phở bò tái lăn\nBún chả Hà Nội\nBánh xèo miền Tây\nCơm tấm sườn bì chả\nGỏi cuốn tôm thịt'}
                className="min-h-[110px] text-xs font-medium leading-relaxed resize-y"
                disabled={isSubmitting}
              />
            </div>

            {/* Parsed dishes preview chips */}
            {parsedBatchDishes.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Đã nhận diện <Badge variant="secondary" className="px-1.5 py-0 text-[11px] font-bold">{parsedBatchDishes.length} món</Badge>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearBatch}
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={11} className="mr-1" /> Xóa tất cả
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {parsedBatchDishes.map((dish, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="gap-1 pl-2 pr-1 py-1 text-xs font-medium bg-card border-border hover:border-border/80"
                    >
                      <span className="truncate max-w-[160px]">{dish}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBatchItem(idx)}
                        className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Advanced settings toggle (Region & Sources) ── */}
        <button
          type="button"
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-left border border-border"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Tùy chọn vùng miền & nguồn dữ liệu</span>
            {regionCode && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-600 bg-amber-500/10">
                {regionCode}
              </Badge>
            )}
          </span>
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
          />
        </button>

        {showAdvanced && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border space-y-3">
            {/* Vùng miền */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Vùng miền ẩm thực</Label>
                {regionCode && (
                  <button
                    type="button"
                    onClick={() => onRegionCodeChange('')}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Xóa chọn (Tự động)
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(regions.length > 0
                  ? regions
                  : [
                      { code: 'north', name: 'Miền Bắc' },
                      { code: 'central', name: 'Miền Trung' },
                      { code: 'south', name: 'Miền Nam' },
                    ]
                ).map((r) => {
                  const isSelected = regionCode === r.code
                  return (
                    <Button
                      key={r.code}
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      className={`h-7 px-2.5 text-xs font-semibold ${
                        isSelected ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''
                      }`}
                      onClick={() => onRegionCodeChange(isSelected ? '' : r.code)}
                    >
                      {r.name}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Nguồn dữ liệu */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-foreground">Nguồn dữ liệu tham chiếu</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SOURCE_OPTIONS.map((src) => {
                  const isChecked = selectedSources.includes(src.value)
                  return (
                    <div
                      key={src.value}
                      onClick={() => onToggleSource(src.value)}
                      className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
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
                        <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                          <Database size={11} className="text-amber-500 shrink-0" />
                          {src.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{src.description}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
            {error}
          </div>
        )}

        {/* Submit button */}
        {activeTab === 'single' ? (
          <Button
            className="w-full h-10 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs gap-2"
            onClick={onSingleSubmit}
            disabled={isSubmitting || !dishName.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Đang thêm vào hàng đợi...
              </>
            ) : (
              <>
                <Plus size={16} /> Bắt đầu tạo món này
              </>
            )}
          </Button>
        ) : (
          <Button
            className="w-full h-10 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs gap-2"
            onClick={handleTriggerBatchSubmit}
            disabled={isSubmitting || parsedBatchDishes.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Đang kích hoạt {parsedBatchDishes.length} tác vụ...
              </>
            ) : (
              <>
                <ArrowDownToLine size={16} /> Bắt đầu thu thập ({parsedBatchDishes.length} món)
              </>
            )}
          </Button>
        )}

        <div className="text-[11px] text-muted-foreground text-center pt-1 leading-normal">
          ⚡ Sau khi tạo, bạn có thể tiếp tục nhập thêm món khác ngay mà không cần chờ tiến trình hoàn tất.
        </div>
      </CardContent>
    </Card>
  )
}
