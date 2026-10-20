import { useState } from 'react'
import {
  ChevronDown,
  Clock,
  Copy,
  FileText,
  GripVertical,
  ImageIcon,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Select } from '../ui/select'
import { Label } from '../ui/label'
import { Image } from '../ui/image'
import { Card, CardContent } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
import { ImageUpload } from '../ui/image-upload'
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
  servings: '1',
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
  const { openVideo, lightboxProps: videoLightboxProps } = useMediaLightbox()

  const patch = (p: Partial<RecipeState>) => onChange({ ...state, ...p })
  const patchStep = (id: number, p: Partial<RecipeStepItem>) =>
    patch({ steps: state.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) })

  const openImageModal = (stepId: number, currentUrl?: string) => {
    setImgModalStepId(stepId)
    setImgModalUrl(currentUrl || '')
  }

  const handleApplyImage = () => {
    if (imgModalStepId != null) {
      patchStep(imgModalStepId, { imageUrl: imgModalUrl.trim() || undefined })
    }
    setImgModalStepId(null)
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
    <Card className="shadow-xs">
      <CardContent className="p-8">
        <div className="flex gap-3">
          <Button type="button" variant="default" size="sm" className="h-10 rounded-xl font-semibold">
            Công thức chuẩn
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl font-medium">
            + Thêm công thức khác
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label className="text-[13px] font-semibold text-foreground">Tên công thức <span className="text-red-500">*</span></Label>
            <Input value={state.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Phở gà truyền thống"
              className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-foreground">Khẩu phần</Label>
            <div className="relative mt-1.5">
              <Input value={state.servings} onChange={(e) => patch({ servings: e.target.value })} className="h-11 rounded-xl pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">phần</span>
            </div>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-foreground">Thời gian chuẩn bị</Label>
            <div className="relative mt-1.5">
              <Input value={state.prepMin} onChange={(e) => patch({ prepMin: e.target.value })} className="h-11 rounded-xl pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">phút</span>
            </div>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-foreground">Thời gian nấu</Label>
            <div className="relative mt-1.5">
              <Input value={state.cookMin} onChange={(e) => patch({ cookMin: e.target.value })} className="h-11 rounded-xl pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">phút</span>
            </div>
          </div>
        </div>
        <div className="mt-4 max-w-[220px]">
          <Label className="text-[13px] font-semibold text-foreground">Độ khó</Label>
          <div className="mt-1.5">
            <Select
              value={state.difficulty}
              onChange={(e) => patch({ difficulty: e.target.value as RecipeState['difficulty'] })}
              className="h-11 rounded-xl text-sm"
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
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <GripVertical className="mt-1 h-5 w-5 cursor-grab text-muted-foreground" />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-sm font-bold">
                  {i + 1}
                </span>

                {s.imageUrl ? (
                  <div className="group relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
                    <Image
                      src={s.imageUrl}
                      alt={`Bước ${i + 1}`}
                      className="h-full w-full object-cover transition duration-150 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openImageModal(s.id, s.imageUrl)}
                        className="rounded-full bg-white/90 p-1.5 text-slate-800 shadow hover:bg-white"
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
                    className="group flex h-20 w-28 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition hover:border-amber-400 hover:text-amber-500"
                    title="Thêm ảnh minh họa cho bước này"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-amber-500/20 group-hover:text-amber-500">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ steps: [...state.steps, emptyRecipeStep()] })}
            className="border-primary/40 font-semibold"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Thêm bước
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="font-medium text-muted-foreground"
          >
            <FileText className="mr-1.5 h-4 w-4" /> Tạo bước từ văn bản
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <Label className="text-[13px] font-semibold text-foreground">Video hướng dẫn (nếu có)</Label>
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
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="text-base font-bold text-foreground">
              Ảnh minh họa bước nấu
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            <ImageUpload
              value={imgModalUrl}
              onChange={(url) => setImgModalUrl(url)}
              folder="recipes"
              label="Ảnh minh họa bước nấu"
              aspectRatio="video"
            />
          </div>

          {/* Footer Buttons */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
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
      </CardContent>
    </Card>
  )
}
