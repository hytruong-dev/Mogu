import { AlertTriangle, CheckCircle2, Clock, Flame, Wallet } from 'lucide-react'
import type { MediaState } from './MediaForm'
import type { BasicInfoState } from './BasicInfoForm'
import type { NutritionState } from './NutritionForm'
import type { RecipeState } from './RecipeForm'

interface MediaPreviewPanelProps {
  media: MediaState
  basic: BasicInfoState
  nutrition: NutritionState
  recipe: RecipeState
  totalMin: number
}

export function MediaPreviewPanel({ media, basic, nutrition, recipe, totalMin }: MediaPreviewPanelProps) {
  const checks = [
    { ok: !!media.coverUrl, label: 'Ảnh đại diện: hợp lệ' },
    { ok: media.gallery.length >= 1, label: `Thư viện ảnh: ${media.gallery.length} ảnh` },
    { ok: media.rightsOk, label: 'Xác nhận quyền sử dụng' },
    { ok: media.sourcesChecked || media.sources.length > 0, label: `Nguồn tham khảo: ${media.sources.length}` },
  ]
  const done = checks.filter((c) => c.ok).length
  const pct = Math.round((done / checks.length) * 100)
  const sodium = Number(nutrition.sodiumMg) || 0

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Kiểm tra media</h3>
        <div className="mt-4 space-y-3 text-[15px]">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <CheckCircle2 className={c.ok ? 'h-5 w-5 text-ok-green' : 'h-5 w-5 text-gray-300'} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        <h3 className="px-6 pt-5 text-lg font-bold">Xem trước thẻ món</h3>
        <div className="p-4">
          <div className="overflow-hidden rounded-xl border border-black/10">
            <div className="h-36 bg-gray-100">
              {media.coverUrl && <img src={media.coverUrl} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold">{basic.name || 'Tên món'}</h4>
                <CheckCircle2 className="h-4 w-4 text-ok-green" />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> {nutrition.calories || '—'} kcal</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalMin || recipe.cookMin || '—'} phút</span>
                <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> —</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-500">{basic.shortDescription || 'Mô tả món ăn...'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['Món nước', 'Việt Nam', 'Dễ làm'].map((t) => (
                  <span key={t} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Hoàn thiện hồ sơ</h3>
        <div className="mt-2 text-3xl font-extrabold text-ok-green">{pct}%</div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gradient-to-r from-ok-green to-green-400" style={{ width: `${pct}%` }} />
        </div>
        {sodium >= 800 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warn-orange-border bg-warn-orange-bg p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-warn-orange" />
            <div>
              Còn 1 cảnh báo: Natri cao
              <div className="mt-1 font-semibold text-warn-orange">Xem chi tiết</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
