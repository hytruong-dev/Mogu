import { useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  Clock3,
  Database,
  Loader2,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
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
    <div className="ingest-grid">
      {/* ── Form Card ── */}
      <Card className="form-card">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Tên món ăn <span className="text-destructive">*</span>
          </Label>
          <Input
            value={dishName}
            onChange={(e) => onDishNameChange(e.target.value)}
            placeholder="Phở bò"
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
        </div>

        <button
          type="button"
          className="ingest-advanced-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <span>
            <span className="ingest-tune-icon">☷</span>
            <b>Tùy chọn nâng cao</b>
            <small>Từ khóa liên quan và vùng miền</small>
          </span>
          <span className={showAdvanced ? 'ingest-chevron open' : 'ingest-chevron'}>⌄</span>
        </button>

        {showAdvanced && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Từ khóa liên quan
              </Label>
              <Input
                value={keywords}
                onChange={(e) => onKeywordsChange(e.target.value)}
                placeholder="phở tái, Vietnamese beef pho"
              />
              <p className="text-[11px] text-muted-foreground">Giúp AI hiểu ngữ cảnh chính xác hơn (cách nhau bởi dấu phẩy).</p>
            </div>

            <h3>Vùng miền</h3>
            <div className="choice-row">
              {regions.length > 0
                ? regions.map((r) => (
                    <Button
                      key={r.code}
                      variant={regionCode === r.code ? 'default' : 'outline'}
                      onClick={() => onRegionCodeChange(regionCode === r.code ? '' : r.code)}
                    >
                      {r.name}
                    </Button>
                  ))
                : [
                    { code: 'north', name: 'Miền Bắc' },
                    { code: 'central', name: 'Miền Trung' },
                    { code: 'south', name: 'Miền Nam' },
                  ].map((r) => (
                    <Button
                      key={r.code}
                      variant={regionCode === r.code ? 'default' : 'outline'}
                      onClick={() => onRegionCodeChange(regionCode === r.code ? '' : r.code)}
                    >
                      {r.name}
                    </Button>
                  ))}
            </div>
          </>
        )}

        <div className="ingest-info-note">
          ⓘ Mỗi lần chỉ tạo 1 món. Kết quả luôn ở trạng thái <b>BẢN NHÁP</b>.
        </div>
        {error && (
          <div className="ingest-error" role="alert">
            ⚠ {error}
          </div>
        )}

        <details className="ingest-source-details">
          <summary>Nguồn dữ liệu</summary>
          <div className="ingest-source-list">
            {SOURCE_OPTIONS.map((src) => {
              const isChecked = selectedSources.includes(src.value)
              return (
                <div
                  key={src.value}
                  onClick={() => onToggleSource(src.value)}
                  className="source-option flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => onToggleSource(src.value)}
                    aria-label={src.label}
                  />
                  <Database size={18} className="text-muted-foreground shrink-0" />
                  <span className="flex flex-col text-left">
                    <b className="text-xs font-semibold text-foreground">{src.label}</b>
                    <small className="text-[11px] text-muted-foreground">{src.description}</small>
                  </span>
                </div>
              )
            })}
          </div>
        </details>

        <Button
          className="full"
          onClick={onSubmit}
          disabled={isSubmitting}
          style={{ marginTop: 8 }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Đang tạo job...
            </>
          ) : (
            <>
              <ArrowDownToLine size={16} /> Tạo bản nháp bằng AI
            </>
          )}
        </Button>
      </Card>

      {/* ── Right Panel: AI Support Features ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card className="ai-support-card">
          <h3>AI sẽ hỗ trợ tạo</h3>
          <ul className="ai-support-list">
            <li>
              <Check size={14} /> Thông tin món
            </li>
            <li>
              <Check size={14} /> Nguyên liệu
            </li>
            <li>
              <Check size={14} /> Công thức chế biến
            </li>
            <li>
              <Check size={14} /> Dinh dưỡng ước tính
            </li>
          </ul>
          <div className="ai-support-divider" />
          <div className="ai-support-steps">
            {[
              ['1', 'Nhập tên'],
              ['2', 'AI xử lý'],
              ['3', 'Kiểm tra bản nháp'],
            ].map(([number, label], index) => (
              <div className="ai-support-step" key={number}>
                <div className="ai-step-line">
                  <span>{number}</span>
                  {index < 2 && <i />}
                </div>
                <b>{label}</b>
              </div>
            ))}
          </div>
          <div className="ai-support-time">
            <Clock3 size={15} /> Thời gian dự kiến: 15–30 giây
          </div>
          <div className="ai-support-warning">
            △ Dữ liệu do AI tạo cần được kiểm tra trước khi gửi duyệt.
          </div>
        </Card>
      </div>
    </div>
  )
}
