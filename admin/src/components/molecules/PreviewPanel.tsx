import { useRef, useState } from 'react'
import { Circle, CircleCheck, UploadCloud } from 'lucide-react'
import { Image } from '../ui/image'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
import type { BasicInfoState } from './BasicInfoForm'

interface PreviewPanelProps {
  state: BasicInfoState
  categories: { id: string; name: string }[]
  regions: { id: string; name: string }[]
  provinces: { id: string; name: string }[]
  coverUrl?: string
  onPickImage?: (file: File) => void
  uploading?: boolean
}

const CHECKLIST = [
  { key: 'name', label: 'Tên món ăn' },
  { key: 'region', label: 'Vùng miền' },
  { key: 'category', label: 'Danh mục' },
  { key: 'desc', label: 'Mô tả ngắn' },
  { key: 'ingredients', label: 'Thành phần' },
  { key: 'nutrition', label: 'Dinh dưỡng' },
  { key: 'recipe', label: 'Công thức' },
  { key: 'image', label: 'Hình ảnh' },
] as const

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg'

/** Panel bên phải bước 1: Xem trước trên ứng dụng + Checklist hoàn thành. */
export function PreviewPanel({
  state,
  categories,
  regions,
  provinces,
  coverUrl,
  onPickImage,
  uploading,
}: PreviewPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [localPreview, setLocalPreview] = useState('')
  const shownUrl = coverUrl || localPreview

  const catNames = categories.filter((c) => state.categoryIds.includes(c.id)).map((c) => c.name)
  const regionName = regions.find((r) => r.id === state.regionId)?.name
  const provinceName = provinces.find((p) => p.id === state.provinceId)?.name

  const doneMap: Record<string, boolean> = {
    name: !!state.name.trim(),
    region: !!state.regionId,
    category: state.categoryIds.length > 0,
    desc: !!state.shortDescription.trim(),
    ingredients: false,
    nutrition: false,
    recipe: false,
    image: !!(coverUrl || localPreview),
  }
  const doneCount = Object.values(doneMap).filter(Boolean).length

  const takeFile = (file?: File) => {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Chỉ chấp nhận file ảnh (JPG, PNG, WebP).')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Ảnh vượt quá 5MB. Hãy chọn ảnh nhỏ hơn.')
      return
    }
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(URL.createObjectURL(file))
    onPickImage?.(file)
  }

  const openPicker = () => fileRef.current?.click()
  const { lightboxProps } = useMediaLightbox()

  return (
    <div className="space-y-5">
      <Card className="shadow-xs">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-foreground">Xem trước trên ứng dụng</h3>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              takeFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          <button
            type="button"
            onClick={openPicker}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              takeFile(e.dataTransfer.files?.[0])
            }}
            className={`group mt-4 flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed py-10 transition ${
              dragOver ? 'border-amber-400 bg-amber-50/50' : 'border-border hover:border-amber-400'
            }`}
          >
            {shownUrl ? (
              <div className="max-h-40 w-full overflow-hidden px-4">
                <Image src={shownUrl} alt="Ảnh món ăn" className="max-h-40 w-full object-cover rounded-lg" />
              </div>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground group-hover:text-amber-500" />
                <span className="text-[15px] font-semibold text-foreground">Thêm ảnh món ăn</span>
                <span className="text-sm text-muted-foreground">JPG, PNG tối đa 5MB</span>
              </>
            )}
          </button>
          {shownUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openPicker}
              className="mt-2 w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Đổi ảnh
            </Button>
          )}
          {uploading && <p className="mt-2 text-sm text-amber-700">Đang tải ảnh lên máy chủ...</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          <div className="mt-4 rounded-xl border border-border p-4 bg-muted/20">
            <div className="flex gap-4">
              <div className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={shownUrl}
                  alt={state.name || 'Ảnh món ăn'}
                  aspectRatio="square"
                  zoomable
                  title={state.name || 'Ảnh món ăn'}
                  subtitle={regionName}
                  fallbackIcon="image"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h4 className="text-lg font-bold leading-tight text-foreground">{state.name || 'Tên món ăn'}</h4>
                <div className="mt-2 flex gap-2">
                  {regionName && (
                    <Badge variant="neutral" className="text-xs font-normal">
                      {regionName}
                    </Badge>
                  )}
                  {provinceName && (
                    <Badge variant="neutral" className="text-xs font-normal">
                      {provinceName}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {catNames.length > 0 && catNames.join(' • ')}
                </p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {state.shortDescription || 'Mô tả ngắn về món ăn sẽ hiển thị tại đây...'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-6">
          <h3 className="font-bold text-foreground">
            Đã hoàn thành <span className="text-emerald-600 font-semibold">{doneCount}/8</span> mục
          </h3>
          <ul className="mt-4 space-y-3">
            {CHECKLIST.map(({ key, label }) => {
              const done = doneMap[key]
              return (
                <li key={key} className="flex items-center gap-2.5 text-[15px]">
                  {done ? (
                    <CircleCheck className="h-5 w-5 fill-emerald-50 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className={done ? 'text-foreground font-medium' : 'text-muted-foreground'}>{label}</span>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
