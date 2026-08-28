import { useState } from 'react'
import {
  ChevronDown,
  Clock,
  Copy,
  FileText,
  GripVertical,
  ImageIcon,
  Plus,
  Trash2,
} from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { cn } from '@/lib/utils'

export interface RecipeStepItem {
  id: number
  title: string
  body: string
  durationMin: string
  imageUrl?: string
  open: boolean
}

export interface RecipeState {
  name: string
  servings: string
  prepMin: string
  cookMin: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  videoUrl: string
  notes: string
  steps: RecipeStepItem[]
}

export const emptyRecipeStep = (): RecipeStepItem => ({
  id: Date.now() + Math.random(),
  title: '',
  body: '',
  durationMin: '',
  open: true,
})

export const defaultRecipe = (): RecipeState => ({
  name: '',
  servings: '4',
  prepMin: '',
  cookMin: '',
  difficulty: 'MEDIUM',
  videoUrl: '',
  notes: '',
  steps: [emptyRecipeStep()],
})

function youtubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return m?.[1]
}

interface RecipeFormProps {
  state: RecipeState
  onChange: (next: RecipeState) => void
}

export function RecipeForm({ state, onChange }: RecipeFormProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const patch = (p: Partial<RecipeState>) => onChange({ ...state, ...p })
  const patchStep = (id: number, p: Partial<RecipeStepItem>) =>
    patch({ steps: state.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) })

  const onDrop = (to: number) => {
    if (dragIdx == null || dragIdx === to) return
    const next = [...state.steps]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(to, 0, moved)
    patch({ steps: next })
    setDragIdx(null)
  }

  const vid = youtubeId(state.videoUrl)

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8">
      <div className="flex gap-3">
        <button type="button" className="h-10 rounded-xl border-2 border-mogu-yellow bg-mogu-yellow-light px-4 text-sm font-semibold">
          Công thức chuẩn
        </button>
        <button type="button" className="h-10 rounded-xl border border-black/10 px-4 text-sm font-medium text-gray-600 hover:border-mogu-yellow">
          + Thêm công thức khác
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="text-[13px] font-semibold">Tên công thức <span className="text-red-500">*</span></label>
          <Input value={state.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Phở gà truyền thống"
            className="mt-1.5 h-11 rounded-xl" />
        </div>
        <div>
          <label className="text-[13px] font-semibold">Khẩu phần</label>
          <div className="relative mt-1.5">
            <Input value={state.servings} onChange={(e) => patch({ servings: e.target.value })} className="h-11 rounded-xl pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">phần</span>
          </div>
        </div>
        <div>
          <label className="text-[13px] font-semibold">Thời gian chuẩn bị</label>
          <div className="relative mt-1.5">
            <Input value={state.prepMin} onChange={(e) => patch({ prepMin: e.target.value })} className="h-11 rounded-xl pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">phút</span>
          </div>
        </div>
        <div>
          <label className="text-[13px] font-semibold">Thời gian nấu</label>
          <div className="relative mt-1.5">
            <Input value={state.cookMin} onChange={(e) => patch({ cookMin: e.target.value })} className="h-11 rounded-xl pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">phút</span>
          </div>
        </div>
      </div>
      <div className="mt-4 max-w-[220px]">
        <label className="text-[13px] font-semibold">Độ khó</label>
        <select value={state.difficulty} onChange={(e) => patch({ difficulty: e.target.value as RecipeState['difficulty'] })}
          className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none">
          <option value="EASY">Dễ</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HARD">Khó</option>
        </select>
      </div>

      <div className="mt-8">
        <h3 className="text-[15px] font-bold">Các bước thực hiện</h3>
        <p className="mt-0.5 text-sm text-gray-400">Kéo thả để sắp xếp thứ tự các bước</p>

        <div className="mt-4 space-y-3">
          {state.steps.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="rounded-xl border border-black/10 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <GripVertical className="mt-1 h-5 w-5 cursor-grab text-gray-300" />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mogu-yellow text-sm font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input value={s.title} placeholder={`Bước ${i + 1}: tiêu đề`} className="h-10 font-semibold"
                    onChange={(e) => patchStep(s.id, { title: e.target.value })} />
                  {s.open && (
                    <Textarea rows={2} value={s.body} placeholder="Mô tả chi tiết bước này..."
                      onChange={(e) => patchStep(s.id, { body: e.target.value })} className="rounded-xl" />
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <Input value={s.durationMin} placeholder="0" className="h-8 w-16"
                      onChange={(e) => patchStep(s.id, { durationMin: e.target.value })} />
                    <span>phút</span>
                    <span className="ml-auto flex gap-2">
                      <button type="button" className="rounded-md p-1 hover:bg-gray-100"><ImageIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => patchStep(s.id, { open: !s.open })} className="rounded-md p-1 hover:bg-gray-100">
                        <ChevronDown className={cn('h-4 w-4 transition', !s.open && '-rotate-90')} />
                      </button>
                      <button type="button" onClick={() => patch({ steps: [...state.steps, { ...s, id: Date.now() + Math.random() }] })} className="rounded-md p-1 hover:bg-gray-100">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => patch({ steps: state.steps.filter((x) => x.id !== s.id) })} className="rounded-md p-1 text-red-500 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => patch({ steps: [...state.steps, emptyRecipeStep()] })}
            className="flex h-10 items-center gap-2 rounded-xl border-2 border-mogu-yellow px-4 text-sm font-semibold hover:bg-mogu-yellow-light">
            <Plus className="h-4 w-4" /> Thêm bước
          </button>
          <button type="button" className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <FileText className="h-4 w-4" /> Tạo bước từ văn bản
          </button>
        </div>
      </div>

      <div className="mt-8">
        <label className="text-[13px] font-semibold">Video hướng dẫn (nếu có)</label>
        <div className="mt-2 flex gap-4">
          <Input value={state.videoUrl} onChange={(e) => patch({ videoUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=..." className="h-11 flex-1 rounded-xl" />
          {vid && (
            <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black">
              <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="video" className="h-full w-full object-cover" />
              <button type="button" onClick={() => patch({ videoUrl: '' })} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
