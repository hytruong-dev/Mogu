import { useRef } from 'react'
import { GripVertical, Pencil, Play, Plus, Star, Trash2 } from 'lucide-react'
import { Input } from '../ui/input'
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
        <div className="h-52 flex-1 overflow-hidden rounded-xl bg-gray-100">
          {state.coverUrl ? (
            <img src={state.coverUrl} alt="cover" className="h-full w-full object-cover" />
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              Chưa có ảnh — bấm để tải lên
            </button>
          )}
        </div>
        <div className="flex w-32 flex-col gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-xl border border-black/10 text-sm font-medium">
            <Pencil className="mr-1 inline h-3.5 w-3.5" /> Chỉnh sửa
          </button>
          <button type="button" onClick={() => patch({ coverUrl: '', gallery: state.gallery.map((g) => ({ ...g, isCover: false })) })}
            className="h-10 rounded-xl border border-black/10 text-sm font-medium text-red-600">
            <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Xóa ảnh
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-xl border border-black/10 text-sm font-medium">
            Thay ảnh
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">Tối thiểu 1200×800 · JPG/PNG/WebP · tối đa 5 MB</p>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      <h3 className="mt-8 text-[15px] font-bold">Thư viện ảnh</h3>
      <p className="text-sm text-gray-400">Kéo để sắp xếp thứ tự — nhấn ☆ để đặt làm ảnh đại diện</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {state.gallery.map((g, i) => (
          <div key={g.id} className="w-28">
            <div className="relative h-24 overflow-hidden rounded-xl border border-black/10">
              <img src={g.url} alt="" className="h-full w-full object-cover" />
              <GripVertical className="absolute left-1 top-1 h-4 w-4 text-white drop-shadow" />
              <button type="button" onClick={() => setCover(g.id)} className="absolute right-1 top-1">
                <Star className={cn('h-4 w-4', g.isCover ? 'fill-mogu-yellow text-mogu-yellow' : 'text-white')} />
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
            <div className="relative h-20 w-32 overflow-hidden rounded-lg bg-black">
              <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} className="h-full w-full object-cover" alt="" />
              <Play className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-[15px] font-bold">Nguồn tham khảo</h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-gray-600">
              <th className="pb-2 font-semibold">Nguồn</th>
              <th className="pb-2 font-semibold">URL</th>
              <th className="pb-2 font-semibold">Độ tin cậy</th>
              <th className="pb-2 font-semibold">Loại dữ liệu</th>
              <th className="pb-2 font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {state.sources.map((s) => (
              <tr key={s.id} className="border-b border-black/5">
                <td className="py-2"><Input value={s.name} className="h-9" onChange={(e) => patch({ sources: state.sources.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x) })} /></td>
                <td className="py-2"><Input value={s.url} className="h-9" onChange={(e) => patch({ sources: state.sources.map((x) => x.id === s.id ? { ...x, url: e.target.value } : x) })} /></td>
                <td className="py-2"><span className="rounded-full bg-ok-green-bg px-2 py-0.5 text-xs font-semibold text-ok-green">{s.trust}%</span></td>
                <td className="py-2">
                  <select value={s.type} className="h-9 rounded-lg border px-2" onChange={(e) => patch({ sources: state.sources.map((x) => x.id === s.id ? { ...x, type: e.target.value } : x) })}>
                    <option>JSON-LD</option>
                    <option>Nutrition</option>
                    <option>Video</option>
                    <option>Article</option>
                  </select>
                </td>
                <td className="py-2">
                  <button type="button" onClick={() => patch({ sources: state.sources.filter((x) => x.id !== s.id) })} className="text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => patch({ sources: [...state.sources, { id: Date.now(), name: '', url: '', trust: '90', type: 'Article' }] })}
          className="mt-3 text-sm font-semibold text-gray-700 hover:text-mogu-yellow-dark">
          + Thêm nguồn
        </button>
      </div>

      <div className="mt-6 space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.rightsOk} onChange={(e) => patch({ rightsOk: e.target.checked })} className="accent-mogu-yellow" />
          Tôi xác nhận có quyền sử dụng hình ảnh
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.sourcesChecked} onChange={(e) => patch({ sourcesChecked: e.target.checked })} className="accent-mogu-yellow" />
          Nguồn đã được kiểm tra
        </label>
      </div>
    </div>
  )
}
