import { useRef, useState } from 'react'
import { Circle, CircleCheck, Image as ImageIcon, UploadCloud } from 'lucide-react'
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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="text-lg font-bold">Xem trước trên ứng dụng</h3>

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
            dragOver ? 'border-mogu-yellow bg-mogu-yellow/10' : 'border-black/15 hover:border-mogu-yellow'
          }`}
        >
          {shownUrl ? (
            <img src={shownUrl} alt="Ảnh món ăn" className="max-h-40 w-full object-cover px-4" />
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-gray-800 group-hover:text-mogu-yellow-dark" />
              <span className="text-[15px] font-semibold">Thêm ảnh món ăn</span>
              <span className="text-sm text-gray-400">JPG, PNG tối đa 5MB</span>
            </>
          )}
        </button>
        {shownUrl && (
          <button
            type="button"
            onClick={openPicker}
            className="mt-2 w-full text-center text-sm font-semibold text-gray-600 hover:text-mogu-yellow-dark"
          >
            Đổi ảnh
          </button>
        )}
        {uploading && <p className="mt-2 text-sm text-amber-700">Đang tải ảnh lên máy chủ...</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 rounded-xl border border-black/10 p-4">
          <div className="flex gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/5 bg-gray-100">
              {shownUrl ? (
                <img src={shownUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-7 w-7 text-gray-400" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-lg font-bold leading-tight">{state.name || 'Tên món ăn'}</h4>
              <div className="mt-2 flex gap-2">
                {regionName && (
                  <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{regionName}</span>
                )}
                {provinceName && (
                  <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{provinceName}</span>
                )}
              </div>
              <p className="mt-2 text-sm">
                {catNames.length > 0 && <span className="text-gray-900">{catNames.join(' • ')}</span>}
              </p>
              <p className="mt-0.5 truncate text-sm text-gray-400">
                {state.shortDescription || 'Mô tả ngắn về món ăn sẽ hiển thị tại đây...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <h3 className="font-bold">
          Đã hoàn thành <span className="text-green-600">{doneCount}/8</span> mục
        </h3>
        <ul className="mt-4 space-y-3">
          {CHECKLIST.map(({ key, label }) => {
            const done = doneMap[key]
            return (
              <li key={key} className="flex items-center gap-2.5 text-[15px]">
                {done ? (
                  <CircleCheck className="h-5 w-5 fill-green-50 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-300" />
                )}
                <span className={done ? 'text-gray-900' : 'text-gray-700'}>{label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
