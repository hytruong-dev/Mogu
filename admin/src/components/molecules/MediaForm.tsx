import { useRef } from 'react'
import { GripVertical, Pencil, Play, Plus, Star, Trash2, ZoomIn } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Image } from '../ui/image'
import { Select } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
import { cn } from '@/lib/utils'

export interface GalleryItem {
  id: number
  url: string
  caption: string
  isCover: boolean
}

export interface SourceRow {
  id: number
  name: string
  url: string
  trust: string
  type: string
}

export interface MediaState {
  coverUrl: string
  gallery: GalleryItem[]
  videoUrl: string
  sources: SourceRow[]
  rightsOk: boolean
  sourcesChecked: boolean
}

export const defaultMedia = (): MediaState => ({
  coverUrl: '',
  gallery: [],
  videoUrl: '',
  sources: [],
  rightsOk: false,
  sourcesChecked: false,
})

function youtubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return m?.[1]
}

interface MediaFormProps {
  state: MediaState
  onChange: (next: MediaState) => void
  onSelectFiles?: (files: File[]) => void
  uploading?: boolean
}

export function MediaForm({ state, onChange, onSelectFiles, uploading }: MediaFormProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<MediaState>) => onChange({ ...state, ...p })
  const vid = youtubeId(state.videoUrl)
  const { openImage, openGallery, openVideo, lightboxProps } = useMediaLightbox()

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    if (onSelectFiles) {
      onSelectFiles(Array.from(files))
      return
    }
    const items: GalleryItem[] = Array.from(files).map((f, i) => ({
      id: Date.now() + i,
      url: URL.createObjectURL(f),
      caption: i === 0 && state.gallery.length === 0 ? 'Thành phẩm' : `Ảnh ${state.gallery.length + i + 1}`,
      isCover: state.gallery.length === 0 && i === 0,
    }))
    const next = [...state.gallery, ...items]
    patch({ gallery: next, coverUrl: state.coverUrl || items[0]?.url })
  }

  const setCover = (id: number) => {
    const next = state.gallery.map((g) => ({ ...g, isCover: g.id === id }))
    patch({ gallery: next, coverUrl: next.find((g) => g.id === id)?.url || '' })
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8">
      <h2 className="text-lg font-bold">Ảnh đại diện</h2>
      {uploading && <p className="mt-2 text-sm text-amber-700">Đang tải ảnh lên máy chủ...</p>}
      <div className="mt-4 flex gap-4">
        <div className="group relative h-52 flex-1 overflow-hidden rounded-xl bg-gray-100">
          {state.coverUrl ? (
            <>
              <Image src={state.coverUrl} alt="cover" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => openImage(state.coverUrl, 'Ảnh bìa món ăn')}
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100"
                title="Xem ảnh phóng to"
              >
                <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white shadow backdrop-blur-xs">
                  <ZoomIn className="h-3.5 w-3.5" /> Xem ảnh lớn
                </div>
              </button>
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              Chưa có ảnh — bấm để tải lên
            </button>
          )}
        </div>
        <div className="flex w-32 flex-col gap-2">
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-10 rounded-xl text-sm font-medium">
            <Pencil className="mr-1 inline h-3.5 w-3.5" /> Chỉnh sửa
          </Button>
          <Button type="button" variant="outline" onClick={() => patch({ coverUrl: '', gallery: state.gallery.map((g) => ({ ...g, isCover: false })) })}
            className="h-10 rounded-xl text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Xóa ảnh
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-10 rounded-xl text-sm font-medium">
            Thay ảnh
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">Tối thiểu 1200×800 · JPG/PNG/WebP · tối đa 5 MB</p>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      <h3 className="mt-8 text-[15px] font-bold">Thư viện ảnh</h3>
      <p className="text-sm text-gray-400">Kéo để sắp xếp thứ tự — nhấn ☆ để đặt làm ảnh đại diện</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {state.gallery.map((g, i) => (
          <div key={g.id} className="w-28">
            <div className="group relative h-24 overflow-hidden rounded-xl border border-black/10">
              <Image src={g.url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              <button
                type="button"
                onClick={() =>
                  openGallery(
                    state.gallery.map((item, idx) => ({
                      url: item.url,
                      title: item.caption || `Ảnh ${idx + 1}`,
                      subtitle: item.isCover ? 'Ảnh bìa chính' : undefined,
                    })),
                    i,
                    'Thư viện ảnh món ăn',
                  )
                }
                className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100"
                title="Bấm để xem ảnh lớn"
              >
                <ZoomIn className="h-4 w-4 text-white drop-shadow" />
              </button>
              <GripVertical className="absolute left-1 top-1 h-4 w-4 text-white drop-shadow pointer-events-none" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCover(g.id)
                }}
                className="absolute right-1 top-1 z-10 rounded-full bg-black/40 p-1"
                title={g.isCover ? 'Ảnh bìa chính' : 'Đặt làm ảnh bìa'}
              >
                <Star className={cn('h-3.5 w-3.5', g.isCover ? 'fill-mogu-yellow text-mogu-yellow' : 'text-white')} />
              </button>
            </div>
            <p className="mt-1 truncate text-center text-xs text-gray-500">{i + 1}. {g.caption}</p>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex h-24 w-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/15 text-sm text-gray-500 hover:border-mogu-yellow">
          <Plus className="h-5 w-5" /> Thêm ảnh
        </button>
      </div>

      <div className="mt-8">
        <label className="text-[13px] font-semibold">Video</label>
        <div className="mt-2 flex gap-4">
          <Input value={state.videoUrl} onChange={(e) => patch({ videoUrl: e.target.value })}
            placeholder="https://youtube.com/..." className="h-11 flex-1 rounded-xl" />
          {vid && (
            <button
              type="button"
              onClick={() => openVideo(state.videoUrl, 'Video hướng dẫn nấu')}
              className="group relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-black text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-mogu-yellow"
              title="Nhấn để phát video"
            >
              <Image src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} className="h-full w-full object-cover opacity-90 transition group-hover:scale-105 group-hover:opacity-100" alt="" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-110">
                  <Play className="ml-0.5 h-4 w-4 fill-white" />
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-[15px] font-bold">Nguồn tham khảo</h3>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold text-muted-foreground">Nguồn</TableHead>
              <TableHead className="font-semibold text-muted-foreground">URL</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Độ tin cậy</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Loại dữ liệu</TableHead>
              <TableHead className="font-semibold text-muted-foreground">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.sources.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="py-2"><Input value={s.name} className="h-9" onChange={(e) => patch({ sources: state.sources.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x) })} /></TableCell>
                <TableCell className="py-2"><Input value={s.url} className="h-9" onChange={(e) => patch({ sources: state.sources.map((x) => x.id === s.id ? { ...x, url: e.target.value } : x) })} /></TableCell>
                <TableCell className="py-2"><span className="rounded-full bg-ok-green-bg px-2 py-0.5 text-xs font-semibold text-ok-green">{s.trust}%</span></TableCell>
                <TableCell className="py-2">
                  <Select value={s.type} className="h-9 rounded-lg" onChange={(e) => patch({ sources: state.sources.map((x) => x.id === s.id ? { ...x, type: e.target.value } : x) })}>
                    <option value="JSON-LD">JSON-LD</option>
                    <option value="Nutrition">Nutrition</option>
                    <option value="Video">Video</option>
                    <option value="Article">Article</option>
                  </Select>
                </TableCell>
                <TableCell className="py-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => patch({ sources: state.sources.filter((x) => x.id !== s.id) })} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => patch({ sources: [...state.sources, { id: Date.now(), name: '', url: '', trust: '90', type: 'Article' }] })}
          className="mt-3 text-sm font-semibold"
        >
          + Thêm nguồn
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <Checkbox checked={state.rightsOk} onCheckedChange={(checked) => patch({ rightsOk: Boolean(checked) })} />
          <span>Tôi xác nhận có quyền sử dụng hình ảnh</span>
        </label>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <Checkbox checked={state.sourcesChecked} onCheckedChange={(checked) => patch({ sourcesChecked: Boolean(checked) })} />
          <span>Nguồn đã được kiểm tra</span>
        </label>
      </div>

      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
