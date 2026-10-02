import { useState, useRef } from 'react'
import {
  ChevronDown,
  Clock,
  Copy,
  FileText,
  GripVertical,
  ImageIcon,
  Link2,
  Pencil,
  Play,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { Label } from '../ui/label'
import { Image } from '../ui/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
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
  const [imgModalStepId, setImgModalStepId] = useState<number | null>(null)
  const [imgModalUrl, setImgModalUrl] = useState('')
  const [imgModalTab, setImgModalTab] = useState<'url' | 'upload'>('url')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { openVideo, lightboxProps: videoLightboxProps } = useMediaLightbox()

  const patch = (p: Partial<RecipeState>) => onChange({ ...state, ...p })
  const patchStep = (id: number, p: Partial<RecipeStepItem>) =>
    patch({ steps: state.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) })

  const openImageModal = (stepId: number, currentUrl?: string) => {
    setImgModalStepId(stepId)
    setImgModalUrl(currentUrl || '')
    setImgModalTab('url')
  }

  const handleApplyImage = () => {
    if (imgModalStepId != null) {
      patchStep(imgModalStepId, { imageUrl: imgModalUrl.trim() || undefined })
    }
    setImgModalStepId(null)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImgModalUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

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
        <Label className="text-[13px] font-semibold text-foreground">Độ khó</Label>
        <div className="mt-1.5">
          <Select
            value={state.difficulty}
            onChange={(e) => patch({ difficulty: e.target.value as RecipeState['difficulty'] })}
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="EASY">Dễ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HARD">Khó</option>
          </Select>
        </div>
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
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mogu-yellow text-sm font-bold">
                  {i + 1}
                </span>

                {s.imageUrl ? (
                  <div className="group relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-gray-100 shadow-sm">
                    <Image
                      src={s.imageUrl}
                      alt={`Bước ${i + 1}`}
                      className="h-full w-full object-cover transition duration-150 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openImageModal(s.id, s.imageUrl)}
                        className="rounded-full bg-white/90 p-1.5 text-gray-800 shadow hover:bg-white"
                        title="Đổi ảnh"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => patchStep(s.id, { imageUrl: undefined })}
                        className="rounded-full bg-white/90 p-1.5 text-red-600 shadow hover:bg-white"
                        title="Gỡ ảnh"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openImageModal(s.id, '')}
                    className="group flex h-20 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 text-gray-400 transition hover:border-mogu-yellow hover:bg-mogu-yellow-light/20 hover:text-mogu-yellow-dark"
                    title="Thêm ảnh minh họa cho bước này"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition group-hover:bg-mogu-yellow/30 group-hover:text-mogu-yellow-dark">
                      <Plus className="h-4 w-4" />
                    </div>
                    <span className="mt-1 text-[11px] font-medium">Thêm ảnh</span>
                  </button>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={s.title}
                    placeholder={`Bước ${i + 1}: tiêu đề`}
                    className="h-10 font-semibold"
                    onChange={(e) => patchStep(s.id, { title: e.target.value })}
                  />
                  {s.open && (
                    <Textarea
                      rows={2}
                      value={s.body}
                      placeholder="Mô tả chi tiết bước này..."
                      onChange={(e) => patchStep(s.id, { body: e.target.value })}
                      className="rounded-xl"
                    />
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <Input
                      value={s.durationMin}
                      placeholder="0"
                      className="h-8 w-16"
                      onChange={(e) => patchStep(s.id, { durationMin: e.target.value })}
                    />
                    <span>phút</span>
                    <span className="ml-auto flex gap-2">
                      <button
                        type="button"
                        title="Chỉnh sửa ảnh bước này"
                        onClick={() => openImageModal(s.id, s.imageUrl)}
                        className={cn('rounded-md p-1 hover:bg-gray-100', s.imageUrl && 'text-mogu-yellow-dark')}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => patchStep(s.id, { open: !s.open })}
                        className="rounded-md p-1 hover:bg-gray-100"
                      >
                        <ChevronDown className={cn('h-4 w-4 transition', !s.open && '-rotate-90')} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patch({ steps: [...state.steps, { ...s, id: Date.now() + Math.random() }] })
                        }
                        className="rounded-md p-1 hover:bg-gray-100"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => patch({ steps: state.steps.filter((x) => x.id !== s.id) })}
                        className="rounded-md p-1 text-red-500 hover:bg-red-50"
                      >
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
            <div className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black shadow-sm">
              <Image src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="video" className="h-full w-full object-cover opacity-90 transition group-hover:scale-105 group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => openVideo(state.videoUrl, 'Video hướng dẫn nấu')}
                className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition"
                title="Bấm để phát video"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-110">
                  <Play className="ml-0.5 h-4 w-4 fill-white" />
                </div>
              </button>
              <button
                type="button"
                onClick={() => patch({ videoUrl: '' })}
                className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white hover:bg-red-600 transition"
                title="Xóa video"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={imgModalStepId != null}
        onOpenChange={(open) => {
          if (!open) setImgModalStepId(null)
        }}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader className="border-b border-black/10 pb-3">
            <DialogTitle className="text-base font-bold text-gray-900">
              Ảnh minh họa bước nấu
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="mt-4 flex gap-2 border-b border-black/10 pb-2">
            <Button
              type="button"
              variant={imgModalTab === 'url' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setImgModalTab('url')}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Link2 className="h-3.5 w-3.5" /> Dán link URL
            </Button>
            <Button
              type="button"
              variant={imgModalTab === 'upload' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setImgModalTab('upload')}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <UploadCloud className="h-3.5 w-3.5" /> Tải từ máy tính
            </Button>
          </div>

          {imgModalTab === 'url' ? (
            <div className="mt-4">
              <Label className="text-xs font-semibold text-gray-700">Đường dẫn ảnh (URL)</Label>
              <Input
                value={imgModalUrl}
                onChange={(e) => setImgModalUrl(e.target.value)}
                placeholder="https://example.com/anh-buoc.jpg"
                className="mt-1.5 h-10 rounded-xl text-sm"
                autoFocus
              />
            </div>
          ) : (
            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-gray-500 transition hover:border-mogu-yellow hover:bg-mogu-yellow-light/20"
              >
                <UploadCloud className="h-6 w-6 text-gray-400" />
                <span className="text-xs font-medium">Bấm để chọn file ảnh từ máy (JPG, PNG, WebP)</span>
              </button>
            </div>
          )}

          {/* Preview */}
          <div className="mt-4">
            <span className="text-xs font-semibold text-gray-500">Xem trước:</span>
            {imgModalUrl ? (
              <div className="mt-1.5 relative h-36 w-full overflow-hidden rounded-xl border border-black/10 bg-gray-50">
                <Image
                  src={imgModalUrl}
                  alt="Preview"
                  className="h-full w-full object-contain"
                  fallbackText="Không thể tải link ảnh này"
                />
              </div>
            ) : (
              <div className="mt-1.5 flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
                Chưa có ảnh
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-4">
            {imgModalUrl ? (
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setImgModalUrl('')
                  if (imgModalStepId != null) {
                    patchStep(imgModalStepId, { imageUrl: undefined })
                  }
                  setImgModalStepId(null)
                }}
                className="p-0 text-xs font-semibold text-red-500 hover:underline"
              >
                Gỡ ảnh bước này
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImgModalStepId(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyImage}
              >
                Áp dụng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MediaLightbox {...videoLightboxProps} />
    </div>
  )
}
