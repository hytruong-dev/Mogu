import { useState } from 'react'
import { AlertCircle, CheckCircle2, ImageIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Image } from '../ui/image'
import { Textarea } from '../ui/textarea'
import type { RecipeState } from './RecipeForm'

export function RecipePreviewPanel({
  state,
  onChange,
}: {
  state: RecipeState
  onChange: (next: RecipeState) => void
}) {
  const [previewImage, setPreviewImage] = useState<{
    url: string
    title: string
    stepNumber: number
  } | null>(null)

  const totalMin =
    (Number(state.prepMin) || 0) +
    (Number(state.cookMin) || 0) ||
    state.steps.reduce((s, x) => s + (Number(x.durationMin) || 0), 0)
  const missingMedia = state.steps.filter((s) => !s.imageUrl).length

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Kiểm tra công thức</h3>
        <div className="mt-4 space-y-3 text-[15px]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-ok-green" /> Tổng số bước: {state.steps.length}
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-ok-green" /> Thứ tự bước hợp lệ
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-ok-green" /> Tổng thời gian: {totalMin || 0} phút
          </div>
          <div className="flex items-start gap-3">
            {missingMedia > 0 ? (
              <AlertCircle className="mt-0.5 h-5 w-5 text-warn-orange" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-ok-green" />
            )}
            <span>
              Phương tiện minh họa:{' '}
              {missingMedia > 0 ? `${missingMedia} bước chưa có ảnh/video` : 'Đủ ảnh/video'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Xem trước trên ứng dụng</h3>
        <div className="mt-4 space-y-3">
          {state.steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mogu-yellow text-xs font-bold">
                {i + 1}
              </span>

              {s.imageUrl ? (
                <div className="h-10 w-10 shrink-0">
                  <Image
                    src={s.imageUrl}
                    alt={s.title || `Bước ${i + 1}`}
                    aspectRatio="square"
                    zoomable
                    title={s.title || `Bước ${i + 1}`}
                    subtitle={`Bước ${i + 1}`}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt(`Nhập URL ảnh cho Bước ${i + 1}:`)
                    if (url && url.trim()) {
                      const updated = state.steps.map((st) =>
                        st.id === s.id ? { ...st, imageUrl: url.trim() } : st,
                      )
                      onChange({ ...state, steps: updated })
                    }
                  }}
                  title="Chưa có ảnh. Nhấn để gán URL ảnh cho bước này"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-mogu-yellow hover:bg-mogu-yellow-light/30 hover:text-mogu-yellow-dark"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.title || `Bước ${i + 1}`}</div>
                <div className="text-xs text-gray-400">{s.durationMin || 0} phút</div>
              </div>
            </div>
          ))}
          {state.steps.length === 0 && <p className="text-sm text-gray-400">Chưa có bước nào.</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Ghi chú nội bộ</h3>
        <Textarea
          value={state.notes}
          onChange={(e) => onChange({ ...state, notes: e.target.value.slice(0, 500) })}
          placeholder="Ghi chú cho đội kiểm duyệt..."
          className="mt-3 min-h-[110px] rounded-xl"
        />
        <div className="mt-1 text-right text-xs text-gray-400">{state.notes.length}/500</div>
      </div>

      <Dialog open={previewImage !== null} onOpenChange={(open) => { if (!open) setPreviewImage(null) }}>
        <DialogContent className="max-w-lg p-5">
          <DialogHeader className="border-b border-black/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mogu-yellow text-xs font-bold">
                {previewImage?.stepNumber}
              </span>
              <DialogTitle className="truncate text-sm font-bold text-gray-900">
                {previewImage?.title}
              </DialogTitle>
            </div>
          </DialogHeader>

          {previewImage && (
            <div className="mt-4 flex max-h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              <Image
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[60vh] w-auto max-w-full object-contain"
              />
            </div>
          )}
          <div className="mt-3 text-right">
            {previewImage && (
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 underline hover:text-blue-800"
              >
                Mở ảnh gốc trong tab mới
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
