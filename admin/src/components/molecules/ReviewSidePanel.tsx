import { CheckCircle2, Clock, Flame, Wallet, ZoomIn } from 'lucide-react'
import { Textarea } from '../ui/textarea'
import { Checkbox } from '../ui/checkbox'
import { Select } from '../ui/select'
import { Label } from '../ui/label'
import { Image } from '../ui/image'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
import type { BasicInfoState } from './BasicInfoForm'
import type { NutritionState } from './NutritionForm'
import type { MediaState } from './MediaForm'
import type { RecipeState } from './RecipeForm'

interface ReviewSidePanelProps {
  basic: BasicInfoState
  nutrition: NutritionState
  recipe: RecipeState
  media: MediaState
  sodiumAck: boolean
  onSodiumAck: (v: boolean) => void
  reviewTeam: string
  onReviewTeam: (v: string) => void
  reviewNote: string
  onReviewNote: (v: string) => void
  totalMin: number
}

export function ReviewSidePanel({
  basic, nutrition, recipe: _recipe, media, sodiumAck, onSodiumAck, reviewTeam, onReviewTeam, reviewNote, onReviewNote, totalMin,
}: ReviewSidePanelProps) {
  const sodium = Number(nutrition.sodiumMg) || 0
  const sodiumWarn = sodium >= 800
  const { openImage, lightboxProps } = useMediaLightbox()

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
        <h3 className="px-5 pt-5 text-lg font-bold">Xem trước trên ứng dụng</h3>
        <div className="p-4">
          <div className="overflow-hidden rounded-xl border border-black/10">
            <div className="group relative h-40 bg-gray-100">
              {media.coverUrl && (
                <>
                  <Image src={media.coverUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  <button
                    type="button"
                    onClick={() => openImage(media.coverUrl, basic.name || 'Ảnh món ăn')}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100"
                    title="Bấm để xem ảnh lớn"
                  >
                    <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                  </button>
                </>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold">{basic.name || 'Tên món'}</h4>
                <CheckCircle2 className="h-4 w-4 text-ok-green" />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> {nutrition.calories || '—'} kcal</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalMin || '—'} phút</span>
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

      {sodiumWarn && (
        <div className="rounded-2xl border border-warn-orange-border bg-warn-orange-bg p-4">
          <h4 className="font-bold text-warn-orange">Cảnh báo cần xác nhận</h4>
          <p className="mt-1 text-sm">Natri {sodium} mg — cao hơn mức khuyến nghị cho một khẩu phần.</p>
          <label className="mt-3 flex items-start gap-2.5 text-sm cursor-pointer">
            <Checkbox
              checked={sodiumAck}
              onCheckedChange={(checked) => onSodiumAck(Boolean(checked))}
              className="mt-0.5"
            />
            <span>Tôi đã kiểm tra cảnh báo natri và đồng ý gửi duyệt.</span>
          </label>
        </div>
      )}

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Thông tin gửi duyệt</h3>
        <Label className="mt-3 block text-sm font-semibold">Gửi đến nhóm kiểm duyệt</Label>
        <div className="mt-1.5">
          <Select
            value={reviewTeam}
            onChange={(e) => onReviewTeam(e.target.value)}
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="Kiểm duyệt nội dung">Kiểm duyệt nội dung</option>
            <option value="Kiểm duyệt dinh dưỡng">Kiểm duyệt dinh dưỡng</option>
            <option value="Biên tập viên">Biên tập viên</option>
          </Select>
        </div>
        <Label className="mt-4 block text-sm font-semibold">Ghi chú gửi duyệt (tuỳ chọn)</Label>
        <Textarea rows={4} value={reviewNote} onChange={(e) => onReviewNote(e.target.value.slice(0, 300))}
          className="mt-1.5 rounded-xl" placeholder="Ghi chú cho reviewer..." />
        <div className="mt-1 text-right text-xs text-gray-400">{reviewNote.length}/300</div>
      </div>

      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
