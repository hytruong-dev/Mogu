import { useState } from 'react'
import { Check, CheckCircle2, ExternalLink, Plus, XCircle } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { cn } from '@/lib/utils'

export type CalcMethod = 'from-ingredients' | 'manual' | 'from-source'
export type ApiNutritionMethod = 'AI_ESTIMATED' | 'INGREDIENT_CALCULATED' | 'SOURCE_VERIFIED'

/** Provenance JSON do backend NutritionCalculatorService sinh ra */
export interface NutritionProvenance {
  method?: ApiNutritionMethod
  generatedBy?: 'CALCULATOR' | 'AI' | 'SOURCE'
  references?: Array<{ provider: string; title?: string; url?: string }>
  perIngredient?: Array<{
    name: string
    grams?: number | null
    provider?: string | null
    sourceFoodId?: string | null
    sourceFoodName?: string | null
    sourceUrl?: string | null
    matched?: boolean
  }>
  uncovered?: string[]
  coveragePct?: number
  totalGrams?: number
  calculatedAt?: string
  notes?: string[]
}

export const methodFromApi = (m?: string | null): CalcMethod =>
  m === 'INGREDIENT_CALCULATED' ? 'from-ingredients' : m === 'SOURCE_VERIFIED' ? 'from-source' : 'manual'
export const methodToApi = (m: CalcMethod): ApiNutritionMethod =>
  m === 'from-ingredients' ? 'INGREDIENT_CALCULATED' : m === 'from-source' ? 'SOURCE_VERIFIED' : 'AI_ESTIMATED'

export const PROVIDER_LABEL: Record<string, string> = {
  VIETNAM_FCT_2007: 'VFCT 2007 (Viện Dinh dưỡng)',
  USDA_FDC: 'USDA FoodData Central',
  AI_ESTIMATE: 'AI ước lượng',
  RECIPE_SOURCE: 'Nguồn công thức',
}

/** Suy ra nhãn nguồn hiển thị từ provenance */
export function sourceLabelFromProvenance(p?: NutritionProvenance | null, method?: string | null): string {
  const providers = new Set((p?.references ?? []).map((r) => r.provider))
  const hasVfct = providers.has('VIETNAM_FCT_2007')
  const hasUsda = providers.has('USDA_FDC')
  if (method === 'SOURCE_VERIFIED' || providers.has('RECIPE_SOURCE')) return 'Theo nguồn công thức (Schema.org nutrition)'
  if (hasVfct && hasUsda) return 'VFCT 2007 + USDA FDC + tính từ nguyên liệu'
  if (hasVfct) return 'VFCT 2007 + tính từ nguyên liệu'
  if (hasUsda) return 'USDA FoodData Central + tính từ nguyên liệu'
  if (method === 'AI_ESTIMATED') return 'AI ước lượng (tham khảo VFCT/USDA)'
  return 'Tính từ nguyên liệu'
}

export interface MicroNutrient {
  id: number
  name: string
  value: string
  unit: string
}

export interface NutritionState {
  calories: string
  proteinG: string
  carbG: string
  fatG: string
  fiberG: string
  sodiumMg: string
  servingLabel: string
  servingG: string
  method: CalcMethod
  source: string
  sourceUrl: string
  confidence: string
  referenceOnly: boolean
  micros: MicroNutrient[]
  /** Provenance từ backend (giữ nguyên khi lưu để không mất audit) */
  provenance?: NutritionProvenance | null
}

export const defaultNutrition = (): NutritionState => ({
  calories: '',
  proteinG: '',
  carbG: '',
  fatG: '',
  fiberG: '',
  sodiumMg: '',
  servingLabel: '1 tô (450 g)',
  servingG: '450',
  method: 'from-ingredients',
  source: 'USDA FoodData Central + tính từ nguyên liệu',
  sourceUrl: '',
  confidence: '92',
  referenceOnly: true,
  micros: [],
  provenance: null,
})

const SERVING_OPTIONS = ['1 tô (450 g)', '1 đĩa (300 g)', '1 phần (250 g)', '100 g']
const SOURCE_OPTIONS = [
  'VFCT 2007 + USDA FDC + tính từ nguyên liệu',
  'VFCT 2007 + tính từ nguyên liệu',
  'USDA FoodData Central + tính từ nguyên liệu',
  'Theo nguồn công thức (Schema.org nutrition)',
  'AI ước lượng (tham khảo VFCT/USDA)',
  'Tính từ nguyên liệu',
  'Nhập thủ công',
  'Nguồn nội bộ Mogu',
]

const METHODS: { id: CalcMethod; label: string }[] = [
  { id: 'from-ingredients', label: 'Tính từ nguyên liệu' },
  { id: 'manual', label: 'Nhập thủ công' },
  { id: 'from-source', label: 'Theo nguồn' },
]

const MACRO_FIELDS: { key: keyof NutritionState; label: string; unit: string }[] = [
  { key: 'calories', label: 'Năng lượng', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbG', label: 'Carb', unit: 'g' },
  { key: 'fatG', label: 'Chất béo', unit: 'g' },
  { key: 'fiberG', label: 'Chất xơ', unit: 'g' },
  { key: 'sodiumMg', label: 'Natri', unit: 'mg' },
]

export function energySplit(state: NutritionState) {
  const p = Number(state.proteinG) || 0
  const c = Number(state.carbG) || 0
  const f = Number(state.fatG) || 0
  const pk = p * 4
  const ck = c * 4
  const fk = f * 9
  const total = pk + ck + fk
  if (!total) return { protein: 0, carb: 0, fat: 0, total: 0 }
  return {
    protein: Math.round((pk / total) * 100),
    carb: Math.round((ck / total) * 100),
    fat: Math.round((fk / total) * 100),
    total,
  }
}

interface NutritionFormProps {
  state: NutritionState
  onChange: (next: NutritionState) => void
}

export function NutritionForm({ state, onChange }: NutritionFormProps) {
  const [showMicro, setShowMicro] = useState(state.micros.length > 0)
  const split = energySplit(state)

  const patch = (partial: Partial<NutritionState>) => onChange({ ...state, ...partial })

  const addMicro = () => {
    const next = [...state.micros, { id: Date.now(), name: '', value: '', unit: 'mg' }]
    patch({ micros: next })
    setShowMicro(true)
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8">
      <h2 className="text-lg font-bold">Dinh dưỡng tham khảo</h2>

      {/* Cơ sở khẩu phần */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="flex-1">
          <Label className="text-[15px] font-semibold text-foreground">Cơ sở khẩu phần</Label>
          <div className="mt-2">
            <Select
              value={state.servingLabel}
              onChange={(e) => patch({ servingLabel: e.target.value })}
              className="h-12 rounded-xl border border-black/10 bg-white px-4 text-[15px]"
            >
              {SERVING_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </div>
        </div>
        <Button
          type="button"
          variant="link"
          className="mb-2 shrink-0 text-sm font-semibold text-gray-700 underline underline-offset-4 hover:text-mogu-yellow-dark"
        >
          Quản lý khẩu phần
        </Button>
      </div>

      {/* Phương pháp tính */}
      <div className="mt-6">
        <label className="text-[15px] font-semibold">Phương pháp tính</label>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => patch({ method: m.id })}
              className={cn(
                'h-11 rounded-xl border text-[14px] font-medium transition',
                state.method === m.id
                  ? 'border-mogu-yellow bg-mogu-yellow-light font-semibold'
                  : 'border-black/10 bg-white hover:border-mogu-yellow/60',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Macro grid */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {MACRO_FIELDS.map(({ key, label, unit }) => (
          <div key={key}>
            <label className="text-[15px] font-semibold">{label}</label>
            <div className="relative mt-2">
              <Input
                type="number"
                min={0}
                value={String(state[key] ?? '')}
                onChange={(e) => patch({ [key]: e.target.value } as Partial<NutritionState>)}
                className="h-12 rounded-xl border-black/10 pr-14 text-[15px] shadow-none focus-visible:border-mogu-yellow focus-visible:ring-mogu-yellow/30"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMicro}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 text-sm font-medium text-gray-700 hover:border-mogu-yellow"
      >
        <Plus className="h-4 w-4" />
        Thêm vi chất
      </button>

      {showMicro && state.micros.length > 0 && (
        <div className="mt-3 space-y-2">
          {state.micros.map((m) => (
            <div key={m.id} className="grid grid-cols-[1fr_120px_80px] gap-2">
              <Input
                placeholder="Tên vi chất"
                value={m.name}
                onChange={(e) =>
                  patch({ micros: state.micros.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)) })
                }
                className="h-10 rounded-lg"
              />
              <Input
                placeholder="Giá trị"
                value={m.value}
                onChange={(e) =>
                  patch({ micros: state.micros.map((x) => (x.id === m.id ? { ...x, value: e.target.value } : x)) })
                }
                className="h-10 rounded-lg"
              />
              <Input
                placeholder="đơn vị"
                value={m.unit}
                onChange={(e) =>
                  patch({ micros: state.micros.map((x) => (x.id === m.id ? { ...x, unit: e.target.value } : x)) })
                }
                className="h-10 rounded-lg"
              />
            </div>
          ))}
        </div>
      )}

      {/* Phân bổ năng lượng */}
      <div className="mt-8">
        <h3 className="text-[15px] font-semibold">Phân bổ năng lượng</h3>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
          <div className="bg-ok-green" style={{ width: `${split.protein}%` }} />
          <div className="bg-mogu-yellow" style={{ width: `${split.carb}%` }} />
          <div className="bg-warn-orange" style={{ width: `${split.fat}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ok-green" /> Protein {split.protein}%
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-mogu-yellow" /> Carb {split.carb}%
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-warn-orange" /> Chất béo {split.fat}%
          </span>
        </div>
      </div>

      {/* Nguồn & phương pháp */}
      <div className="mt-8">
        <h3 className="text-[15px] font-semibold">Nguồn & phương pháp</h3>
        <div className="mt-3">
          <Label className="text-sm font-medium text-gray-600">Nguồn dữ liệu</Label>
          <div className="mt-1.5">
            <Select
              value={state.source}
              onChange={(e) => patch({ source: e.target.value })}
              className="h-12 rounded-xl border border-black/10 bg-white px-4 text-[15px]"
            >
              {(SOURCE_OPTIONS.includes(state.source) ? SOURCE_OPTIONS : [state.source, ...SOURCE_OPTIONS]).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_140px] gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Link nguồn (nếu có)</label>
            <Input
              value={state.sourceUrl}
              onChange={(e) => patch({ sourceUrl: e.target.value })}
              placeholder="https://..."
              className="mt-1.5 h-12 rounded-xl border-black/10"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Độ tin cậy</label>
            <div className="relative mt-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                value={state.confidence}
                onChange={(e) => patch({ confidence: e.target.value })}
                className="h-12 rounded-xl border-black/10 pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {state.provenance && <ProvenanceTable provenance={state.provenance} />}

      <label className="mt-6 flex cursor-pointer items-center gap-3 text-[15px]">
        <button
          type="button"
          onClick={() => patch({ referenceOnly: !state.referenceOnly })}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition',
            state.referenceOnly ? 'border-mogu-yellow bg-mogu-yellow' : 'border-black/20 bg-white',
          )}
        >
          {state.referenceOnly && <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />}
        </button>
        Giá trị chỉ mang tính tham khảo
      </label>
    </div>
  )
}

/**
 * Bảng "Nguồn tham khảo": link VFCT/USDA + danh sách nguyên liệu khớp/không khớp.
 * Chỉ hiển thị khi dish.nutrition.provenance tồn tại (do pipeline AI Import sinh ra).
 */
export function ProvenanceTable({ provenance }: { provenance: NutritionProvenance }) {
  const [expanded, setExpanded] = useState(false)
  const refs = provenance.references ?? []
  const rows = provenance.perIngredient ?? []
  const matched = rows.filter((r) => r.matched)
  const unmatched = rows.filter((r) => !r.matched)
  const visibleRows = expanded ? rows : rows.slice(0, 8)
  const coverage = provenance.coveragePct ?? 0

  return (
    <div className="mt-8 rounded-xl border border-black/10 bg-gray-50/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Nguồn tham khảo & độ phủ</h3>
        <span
          className={cn(
            'rounded-full px-3 py-0.5 text-xs font-semibold',
            coverage >= 70 ? 'bg-emerald-100 text-emerald-700' : coverage >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
          )}
        >
          Độ phủ theo khối lượng: {coverage}%
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {provenance.generatedBy === 'CALCULATOR'
          ? 'Tính từ từng nguyên liệu bằng cơ sở dữ liệu dinh dưỡng, chia theo khẩu phần.'
          : provenance.generatedBy === 'SOURCE'
            ? 'Lấy từ dữ liệu nutrition của trang nguồn công thức (Schema.org).'
            : 'AI ước lượng, có nêu tài liệu tham chiếu.'}
        {provenance.totalGrams ? ` Tổng khối lượng ước tính: ${Math.round(provenance.totalGrams)} g.` : ''}
        {provenance.calculatedAt ? ` Tính lúc ${new Date(provenance.calculatedAt).toLocaleString('vi-VN')}.` : ''}
      </p>

      {refs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {refs.map((r) => (
            <li key={`${r.provider}-${r.url ?? ''}`} className="flex items-center gap-2 text-sm">
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-black/10">
                {PROVIDER_LABEL[r.provider] ?? r.provider}
              </span>
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-gray-700 underline underline-offset-2 hover:text-mogu-yellow-dark"
                >
                  {r.title ?? r.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-gray-600">{r.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-black/10 bg-white">
          <Table className="w-full text-sm">
            <TableHeader className="bg-gray-50 text-xs uppercase text-gray-500">
              <TableRow>
                <TableHead className="px-3 py-2 text-left font-semibold">Nguyên liệu</TableHead>
                <TableHead className="px-3 py-2 text-right font-semibold">Gram</TableHead>
                <TableHead className="px-3 py-2 text-left font-semibold">Nguồn</TableHead>
                <TableHead className="px-3 py-2 text-left font-semibold">Khớp với</TableHead>
                <TableHead className="px-3 py-2 text-center font-semibold">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-black/5">
              {visibleRows.map((r, i) => (
                <TableRow key={`${r.name}-${i}`}>
                  <TableCell className="px-3 py-2 font-medium">{r.name}</TableCell>
                  <TableCell className="px-3 py-2 text-right text-gray-600">{r.grams != null ? Math.round(r.grams) : '—'}</TableCell>
                  <TableCell className="px-3 py-2 text-gray-600">{r.provider ? PROVIDER_LABEL[r.provider] ?? r.provider : '—'}</TableCell>
                  <TableCell className="px-3 py-2 text-gray-600">
                    {r.sourceUrl ? (
                      <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        {r.sourceFoodName ?? r.sourceFoodId}
                      </a>
                    ) : (
                      r.sourceFoodName ?? '—'
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    {r.matched ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 8 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full border-t border-black/5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {expanded ? 'Thu gọn' : `Xem thêm ${rows.length - 8} nguyên liệu`}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span>
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
          Khớp: {matched.length}
        </span>
        <span>
          <XCircle className="mr-1 inline h-3.5 w-3.5 text-red-500" />
          Không khớp: {unmatched.length}
          {unmatched.length > 0 && ` (${unmatched.map((u) => u.name).join(', ')})`}
        </span>
      </div>

      {provenance.notes && provenance.notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-gray-500">
          {provenance.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
