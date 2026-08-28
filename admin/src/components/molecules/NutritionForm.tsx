import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Input } from '../ui/input'
import { cn } from '@/lib/utils'

export type CalcMethod = 'from-ingredients' | 'manual' | 'from-source'

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
})

const SERVING_OPTIONS = ['1 tô (450 g)', '1 đĩa (300 g)', '1 phần (250 g)', '100 g']
const SOURCE_OPTIONS = [
  'USDA FoodData Central + tính từ nguyên liệu',
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
          <label className="text-[15px] font-semibold">Cơ sở khẩu phần</label>
          <select
            value={state.servingLabel}
            onChange={(e) => patch({ servingLabel: e.target.value })}
            className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-[15px] outline-none focus:border-mogu-yellow"
          >
            {SERVING_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <button type="button" className="mb-2 shrink-0 text-sm font-semibold text-gray-700 underline underline-offset-4 hover:text-mogu-yellow-dark">
          Quản lý khẩu phần
        </button>
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
          <label className="text-sm font-medium text-gray-600">Nguồn dữ liệu</label>
          <select
            value={state.source}
            onChange={(e) => patch({ source: e.target.value })}
            className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-[15px] outline-none focus:border-mogu-yellow"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
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
