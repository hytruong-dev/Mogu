import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  Edit3,
  Flame,
  ImageOff,
  Leaf,
  MapPin,
  Play,
  Utensils,
  X,
  ZoomIn,
  Home,
  Soup,
  Video,
  ClipboardList,
  Sparkles,
} from 'lucide-react'
import { Button } from './button'
import { Image } from './image'
import { Dialog, DialogContent } from './dialog'
import { Badge } from './badge'
import { Card } from './card'
import { MediaLightbox, useMediaLightbox } from './media-lightbox'
import { useImportJob } from '../../hooks/useImportJobs'
import { useAdminDish } from '../../hooks/useDishes'

interface Props {
  jobId: string
  onClose: () => void
}

const DIFF_LABEL: Record<string, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
}

const NUTRITION_METHOD_LABEL: Record<string, string> = {
  INGREDIENT_CALCULATED: 'Tính từ nguyên liệu (VFCT/USDA)',
  SOURCE_VERIFIED: 'Theo nguồn công thức',
  AI_ESTIMATED: 'AI ước lượng',
}

const NUTRITION_PROVIDER_LABEL: Record<string, string> = {
  VIETNAM_FCT_2007: 'VFCT 2007 – Viện Dinh dưỡng',
  USDA_FDC: 'USDA FoodData Central',
  RECIPE_SOURCE: 'Trang nguồn công thức',
  AI_ESTIMATE: 'AI ước lượng',
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function youtubeThumb(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/)
  return m?.[1] ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null
}

export function ImportJobPreviewModal({ jobId, onClose }: Props) {
  const navigate = useNavigate()
  const { data: job } = useImportJob(jobId)
  const { data: dish } = useAdminDish(job?.resultDishId ?? '')
  const [imgError, setImgError] = useState(false)
  const { openImage, openVideo, lightboxProps } = useMediaLightbox()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  if (!job) return null

  const suggestedImg = (job as any).suggestedImageUrl as string | undefined
  const displayImg = !imgError && suggestedImg ? suggestedImg : null
  const nutrition = (dish as any)?.nutrition
  const ingredients: any[] = (dish as any)?.dishIngredients ?? []
  const steps: any[] = (dish as any)?.recipeSteps ?? []

  const handleOpenEdit = () => {
    onClose()
    if (job.resultDishId) navigate(`/foods/${job.resultDishId}`)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl p-0 overflow-y-auto bg-card border-border rounded-2xl max-h-[90vh] shadow-2xl">
        {/* ── Hero image ── */}
        <div className="relative h-60 w-full shrink-0 bg-slate-900 overflow-hidden flex items-center justify-center">
          {displayImg ? (
            <div
              onClick={() => openImage(displayImg, dish?.name || job.query, 'Ảnh món ăn')}
              className="w-full h-full relative cursor-zoom-in group"
              title="Bấm để xem ảnh lớn"
            >
              <Image
                src={displayImg}
                alt={job.query}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageOff size={32} />
              <span className="text-xs">Chưa có ảnh món ăn</span>
            </div>
          )}

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white h-9 w-9 backdrop-blur-xs"
          >
            <X size={16} />
          </Button>

          {/* Badge */}
          <div className="absolute top-4 left-4">
            <Badge className="bg-amber-500/90 text-white hover:bg-amber-500 gap-1.5 shadow-sm backdrop-blur-xs px-3 py-1 font-semibold text-xs border-none">
              <Sparkles size={13} className="text-amber-200 fill-amber-200" />
              AI Thu thập · BẢN NHÁP
            </Badge>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 sm:p-7 space-y-6">
          {/* Header Title + Actions */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {dish?.name ?? job.query}
              </h2>
              {job.regionHint && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <MapPin size={13} className="text-amber-500" />
                  {job.regionHint === 'north' ? 'Miền Bắc' : job.regionHint === 'south' ? 'Miền Nam' : job.regionHint === 'central' ? 'Miền Trung' : job.regionHint}
                </span>
              )}
            </div>
            <Button
              onClick={handleOpenEdit}
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-xs shrink-0"
            >
              <Edit3 size={15} /> Chỉnh sửa chi tiết
            </Button>
          </div>

          {/* Short description */}
          {(dish as any)?.shortDescription && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm text-foreground/90 leading-relaxed">
              {(dish as any).shortDescription}
            </div>
          )}

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Clock3 size={16} />, label: 'Chuẩn bị', value: dish?.prepMinutes ? `${dish.prepMinutes} phút` : '—' },
              { icon: <Flame size={16} />, label: 'Nấu', value: dish?.cookMinutes ? `${dish.cookMinutes} phút` : '—' },
              { icon: <Utensils size={16} />, label: 'Khẩu phần', value: dish?.servings ? `${dish.servings} người` : '—' },
              { icon: <ChefHat size={16} />, label: 'Độ khó', value: dish?.difficulty ? DIFF_LABEL[dish.difficulty] ?? dish.difficulty : '—' },
              {
                icon: <Home size={16} />,
                label: 'Nấu nhà',
                value: dish?.priceMin || dish?.priceMax
                  ? `${Number(dish.priceMin ?? 0).toLocaleString('vi-VN')}–${Number(dish.priceMax ?? dish.priceMin ?? 0).toLocaleString('vi-VN')}₫`
                  : '—',
              },
              {
                icon: <Utensils size={16} />,
                label: 'Ăn ngoài',
                value: (dish as any)?.dineOutPriceMin || (dish as any)?.dineOutPriceMax
                  ? `${Number((dish as any).dineOutPriceMin ?? 0).toLocaleString('vi-VN')}–${Number((dish as any).dineOutPriceMax ?? (dish as any).dineOutPriceMin ?? 0).toLocaleString('vi-VN')}₫`
                  : '—',
              },
              {
                icon: <Soup size={16} />,
                label: 'Loại món',
                value: (dish as any)?.dishType === 'WET' ? 'Món nước' : (dish as any)?.dishType === 'DRY' ? 'Món khô' : '—',
              },
              {
                icon: <MapPin size={16} />,
                label: 'Xuất xứ',
                value: (dish as any)?.originText
                  ?? [(dish as any)?.province?.name, (dish as any)?.region?.name].filter(Boolean).join(', ')
                  ?? '—',
              },
            ].map((item) => (
              <Card key={item.label} className="p-3 border-border shadow-2xs bg-card">
                <div className="text-amber-500 mb-1">{item.icon}</div>
                <div className="text-[11px] font-medium text-muted-foreground">{item.label}</div>
                <div className="text-sm font-bold text-foreground truncate mt-0.5">{item.value}</div>
              </Card>
            ))}
          </div>

          {/* Nutrition section */}
          {nutrition && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Leaf size={16} className="text-emerald-500" />
                Chỉ số dinh dưỡng / khẩu phần
                {nutrition.servingName && <span className="font-normal text-muted-foreground text-xs">({nutrition.servingName})</span>}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                {[
                  { label: 'Calories', value: nutrition.calories, unit: 'kcal', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
                  { label: 'Protein', value: nutrition.proteinG, unit: 'g', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
                  { label: 'Tinh bột', value: nutrition.carbsG, unit: 'g', color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
                  { label: 'Chất béo', value: nutrition.fatG, unit: 'g', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
                  { label: 'Chất xơ', value: nutrition.fiberG, unit: 'g', color: 'text-lime-500 bg-lime-500/10 border-lime-500/20' },
                  { label: 'Natri', value: nutrition.sodiumMg, unit: 'mg', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
                ].filter(n => n.value != null).map(n => (
                  <div key={n.label} className={`p-3 rounded-xl border text-center ${n.color}`}>
                    <div className="text-lg font-extrabold leading-none">{n.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{n.unit}</div>
                    <div className="text-xs font-semibold text-foreground mt-1">{n.label}</div>
                  </div>
                ))}
              </div>

              {/* Provenance info */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border text-xs text-muted-foreground space-y-1.5">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="font-bold text-foreground">Phương pháp:</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold text-[11px]">
                    {NUTRITION_METHOD_LABEL[nutrition.method as string] ?? nutrition.method ?? 'Không rõ'}
                  </Badge>
                  {nutrition.confidence != null && (
                    <span>Độ tin cậy: <strong className="text-foreground">{nutrition.confidence}%</strong></span>
                  )}
                  {nutrition.provenance?.coveragePct != null && (
                    <span>Độ phủ: <strong className="text-foreground">{nutrition.provenance.coveragePct}%</strong></span>
                  )}
                </div>
                {(nutrition.provenance?.references?.length > 0 || nutrition.sourceUrl) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="font-bold text-foreground">Nguồn đối chiếu:</span>
                    {(nutrition.provenance?.references ?? []).map((r: any) => (
                      <a key={`${r.provider}-${r.url}`} href={r.url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                        {NUTRITION_PROVIDER_LABEL[r.provider] ?? r.title ?? r.provider}
                      </a>
                    ))}
                    {nutrition.sourceUrl && !(nutrition.provenance?.references ?? []).some((r: any) => r.url === nutrition.sourceUrl) && (
                      <a href={nutrition.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                        {safeHost(nutrition.sourceUrl)}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video reference */}
          {(dish as any)?.videoUrl && (
            <Card className="p-3 border-border flex items-center gap-3">
              {youtubeThumb((dish as any).videoUrl) && (
                <button
                  type="button"
                  onClick={() => openVideo((dish as any).videoUrl, `Video: ${dish?.name || job.query}`)}
                  className="group relative overflow-hidden rounded-lg bg-black shrink-0 w-24 h-14 border-0 p-0"
                  title="Nhấn để phát video"
                >
                  <Image src={youtubeThumb((dish as any).videoUrl)!} alt="video" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow transition group-hover:scale-110">
                      <Play className="ml-0.5 h-3 w-3 fill-white" />
                    </div>
                  </div>
                </button>
              )}
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Video size={13} className="text-rose-500" /> Video hướng dẫn
                </div>
                <button
                  type="button"
                  onClick={() => openVideo((dish as any).videoUrl, `Video: ${dish?.name || job.query}`)}
                  className="text-xs text-sky-600 hover:underline truncate block max-w-md text-left font-medium mt-0.5"
                >
                  {(dish as any).videoUrl}
                </button>
              </div>
            </Card>
          )}

          {/* Ingredients list */}
          {ingredients.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Leaf size={16} className="text-emerald-500" />
                Nguyên liệu <span className="font-normal text-muted-foreground text-xs">({ingredients.length} thành phần)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {ingredients.map((ing: any, idx: number) => {
                  const imgUrl = ing.ingredient?.imageUrl
                  const name = ing.ingredient?.name ?? ing.rawText?.replace(/^\d[\d.]*\s+\S+\s+/, '').replace(/\s*\(.*\)/, '') ?? '?'
                  const qty = ing.rawText?.match(/^([\d.]+)\s+(\S+)/)?.[0] ?? (ing.quantity ? `${ing.quantity} ${ing.unit ?? ''}` : '')
                  return (
                    <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card">
                      <div
                        className="group relative w-11 h-11 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center cursor-zoom-in"
                        onClick={() => imgUrl && openImage(imgUrl, name, 'Nguyên liệu')}
                      >
                        {imgUrl ? (
                          <>
                            <Image src={imgUrl} alt={name} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <ZoomIn className="h-3.5 w-3.5 text-white drop-shadow" />
                            </div>
                          </>
                        ) : (
                          <Utensils size={16} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">{name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{qty}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recipe steps */}
          {steps.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <ChefHat size={16} className="text-amber-500" />
                Các bước nấu <span className="font-normal text-muted-foreground text-xs">({steps.length} bước)</span>
              </h4>
              <div className="space-y-3">
                {steps.map((step: any) => {
                  const lines = (step.instruction ?? '').split('\n')
                  const hasTitle = lines[0]?.startsWith('**')
                  const titleLine = hasTitle ? lines[0].replace(/\*\*/g, '') : `Bước ${step.stepOrder}`
                  const bodyLines = (hasTitle ? lines.slice(1) : lines).filter((l: string) => l && !l.startsWith('💡'))
                  const tipLine = lines.find((l: string) => l.startsWith('💡'))
                  return (
                    <Card key={step.stepOrder} className="overflow-hidden border-border shadow-2xs">
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/40 border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {step.stepOrder}
                          </span>
                          <span className="text-xs font-bold text-foreground">{titleLine}</span>
                        </div>
                        {step.durationMin != null && step.durationMin > 0 && (
                          <Badge variant="outline" className="gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20">
                            <Clock3 size={11} /> {step.durationMin} phút
                          </Badge>
                        )}
                      </div>
                      <div className="p-4 flex gap-4">
                        {step.imageUrl && (
                          <div
                            className="group relative shrink-0 cursor-zoom-in overflow-hidden rounded-lg w-28 h-20 bg-muted"
                            onClick={() => openImage(step.imageUrl, `${dish?.name || job.query} - ${titleLine}`)}
                            title="Bấm để xem ảnh lớn"
                          >
                            <Image src={step.imageUrl} alt={titleLine} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <ZoomIn className="h-4 w-4 text-white drop-shadow" />
                            </div>
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                            {bodyLines.join('\n') || (hasTitle ? '' : step.instruction)}
                          </p>
                          {tipLine && (
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border-l-2 border-amber-500 text-xs text-amber-900 dark:text-amber-200">
                              {tipLine}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* AI Pipeline Logs */}
          {job.logs && job.logs.length > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                <ClipboardList size={14} /> Nhật ký tiến trình AI
              </h4>
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border">
                {job.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">[{log.step}]</span>{' '}
                      <span className="text-foreground">{log.message}</span>
                      {log.detail && <span className="text-muted-foreground ml-1.5">— {log.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
            <span className="text-xs font-mono text-muted-foreground">
              ID: {job.resultDishId ?? jobId}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-semibold">
                Đóng
              </Button>
              <Button onClick={handleOpenEdit} className="h-9 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white gap-2">
                <Edit3 size={14} /> Mở chỉnh sửa đầy đủ
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      <MediaLightbox {...lightboxProps} />
    </Dialog>
  )
}
