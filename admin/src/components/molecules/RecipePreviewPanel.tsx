import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { RecipeState } from './RecipeForm'

export function RecipePreviewPanel({
  state,
  onChange,
}: {
  state: RecipeState
  onChange: (next: RecipeState) => void
}) {
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
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mogu-yellow text-xs font-bold">{i + 1}</span>
              <div className="h-10 w-10 rounded-lg bg-gray-100" />
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
        <textarea
          value={state.notes}
          onChange={(e) => onChange({ ...state, notes: e.target.value.slice(0, 500) })}
          placeholder="Ghi chú cho đội kiểm duyệt..."
          className="mt-3 min-h-[110px] w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-mogu-yellow"
        />
        <div className="mt-1 text-right text-xs text-gray-400">{state.notes.length}/500</div>
      </div>
    </div>
  )
}
