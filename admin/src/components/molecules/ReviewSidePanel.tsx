import { CheckCircle2, Clock, Flame, Wallet, ZoomIn } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
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
      <Card className="overflow-hidden shadow-xs">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base font-semibold">Xem trước trên ứng dụng</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="group relative h-40 bg-muted">
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
                <h4 className="text-base font-bold text-foreground">{basic.name || 'Tên món'}</h4>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> {nutrition.calories || '—'} kcal</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalMin || '—'} phút</span>
                <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> —</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{basic.shortDescription || 'Mô tả món ăn...'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['Món nước', 'Việt Nam', 'Dễ làm'].map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {sodiumWarn && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4">
          <h4 className="text-sm font-bold text-amber-900">Cảnh báo cần xác nhận</h4>
          <p className="mt-1 text-xs text-amber-800">Natri {sodium} mg — cao hơn mức khuyến nghị cho một khẩu phần.</p>
          <label className="mt-3 flex items-start gap-2.5 text-xs text-amber-900 cursor-pointer">
            <Checkbox
              checked={sodiumAck}
              onCheckedChange={(checked) => onSodiumAck(Boolean(checked))}
              className="mt-0.5"
            />
            <span>Tôi đã kiểm tra cảnh báo natri và đồng ý gửi duyệt.</span>
          </label>
        </div>
      )}

      <Card className="shadow-xs">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-semibold">Thông tin gửi duyệt</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <Label className="mt-2 block text-xs font-semibold text-foreground">Gửi đến nhóm kiểm duyệt</Label>
          <div className="mt-1.5">
            <Select
              value={reviewTeam}
              onChange={(e) => onReviewTeam(e.target.value)}
              className="h-10 rounded-xl text-sm"
            >
              <option value="Kiểm duyệt nội dung">Kiểm duyệt nội dung</option>
              <option value="Kiểm duyệt dinh dưỡng">Kiểm duyệt dinh dưỡng</option>
              <option value="Biên tập viên">Biên tập viên</option>
            </Select>
          </div>
          <Label className="mt-4 block text-xs font-semibold text-foreground">Ghi chú gửi duyệt (tuỳ chọn)</Label>
          <Textarea rows={4} value={reviewNote} onChange={(e) => onReviewNote(e.target.value.slice(0, 300))}
            className="mt-1.5 rounded-xl" placeholder="Ghi chú cho reviewer..." />
          <div className="mt-1 text-right text-xs text-muted-foreground">{reviewNote.length}/300</div>
        </CardContent>
      </Card>

      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
