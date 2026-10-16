import { AlertTriangle, CheckCircle2, Clock, Flame, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Image } from '../ui/image'
import { Progress } from '../ui/progress'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
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
  const { lightboxProps } = useMediaLightbox()
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
      <Card className="shadow-xs">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-semibold">Kiểm tra media</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-3 text-sm">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3">
              <CheckCircle2 className={c.ok ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-muted-foreground/40'} />
              <span className={c.ok ? 'text-foreground font-medium' : 'text-muted-foreground'}>{c.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-xs">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-semibold">Xem trước thẻ món</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="h-36 bg-muted">
              {media.coverUrl && (
                <Image
                  src={media.coverUrl}
                  alt={basic.name || 'Ảnh món ăn'}
                  zoomable
                  title={basic.name || 'Ảnh món ăn'}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-foreground">{basic.name || 'Tên món'}</h4>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> {nutrition.calories || '—'} kcal</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {totalMin || recipe.cookMin || '—'} phút</span>
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

      <Card className="shadow-xs">
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base font-semibold">Hoàn thiện hồ sơ</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="text-3xl font-extrabold text-emerald-600">{pct}%</div>
          <Progress
            value={pct}
            className="mt-3 h-2"
          />
          {sodium >= 800 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <div>
                Còn 1 cảnh báo: Natri cao
                <div className="mt-1 font-semibold text-amber-700">Xem chi tiết</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
