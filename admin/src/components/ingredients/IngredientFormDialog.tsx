import { useState, useEffect } from 'react'
import { CloudUpload, Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Switch } from '../ui/switch'
import { Image } from '../ui/image'
import type { CreateIngredientDto, Ingredient } from '../../api/ingredients'

interface IngredientFormDialogProps {
  open: boolean
  ingredient?: Ingredient | null
  allergenOptions: Array<{ value: string; label: string }>
  onOpenChange: (open: boolean) => void
  onSave: (dto: CreateIngredientDto, imageFile: File | null) => Promise<void>
  saving: boolean
}

export function IngredientFormDialog({
  open,
  ingredient,
  allergenOptions,
  onOpenChange,
  onSave,
  saving,
}: IngredientFormDialogProps) {
  const isEdit = !!ingredient
  const [form, setForm] = useState<CreateIngredientDto>({
    code: '',
    name: '',
    synonyms: [],
    unit: '',
    allergenCode: '',
    isActive: true,
  })
  const [synonymInput, setSynonymInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [localSaving, setLocalSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      code: ingredient?.code ?? '',
      name: ingredient?.name ?? '',
      synonyms: ingredient?.synonyms ?? [],
      unit: ingredient?.unit ?? '',
      allergenCode: ingredient?.allergenCode ?? '',
      isActive: ingredient?.isActive ?? true,
    })
    setSynonymInput('')
    setImageFile(null)
    setImagePreview(ingredient?.imageUrl ?? '')
    setError('')
  }, [open, ingredient])

  const pickFile = (file?: File | null) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh tối đa 5MB')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  const addSynonym = () => {
    const value = synonymInput.trim()
    if (!value) return
    if (!(form.synonyms ?? []).includes(value)) {
      setForm((prev) => ({ ...prev, synonyms: [...(prev.synonyms ?? []), value] }))
    }
    setSynonymInput('')
  }

  const busy = saving || localSaving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-base font-bold text-slate-900">
            {isEdit ? '✏️ Sửa nguyên liệu' : '➕ Thêm nguyên liệu mới'}
          </DialogTitle>
        </DialogHeader>

        <form
          className="p-5 space-y-4 text-xs"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!isEdit && !form.code.trim()) return setError('Mã nguyên liệu không được trống')
            if (!form.name.trim()) return setError('Tên nguyên liệu không được trống')
            setLocalSaving(true)
            setError('')
            try {
              await onSave(
                {
                  ...form,
                  unit: form.unit || undefined,
                  allergenCode: form.allergenCode || undefined,
                  synonyms: form.synonyms ?? [],
                },
                imageFile
              )
              onOpenChange(false)
            } catch (err: any) {
              setError(
                err?.response?.data?.error?.message ??
                  err?.response?.data?.message ??
                  err?.message ??
                  'Lỗi không xác định'
              )
            } finally {
              setLocalSaving(false)
            }
          }}
        >
          {/* Image upload area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ảnh nguyên liệu</label>
            <label
              className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
                dragOver
                  ? 'border-amber-400 bg-amber-50/50'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                pickFile(e.dataTransfer.files?.[0])
              }}
            >
              {imagePreview ? (
                <div className="relative w-28 h-28 rounded-lg overflow-hidden group">
                  <Image
                    src={imagePreview}
                    alt=""
                    aspectRatio="square"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                    <CloudUpload size={18} />
                    <span>Đổi ảnh</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-1 text-slate-500 py-2">
                  <CloudUpload size={28} className="mx-auto text-slate-400" />
                  <p className="text-xs font-medium">Kéo thả hoặc nhấn để chọn ảnh</p>
                  <p className="text-[10px] text-slate-400">JPG, PNG, WEBP (Tối đa 5MB)</p>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!isEdit && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã nguyên liệu <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="VD: thit-bo, hanh-tay..."
                  required
                  className="h-9 text-xs font-mono"
                />
              </div>
            )}

            <div className={isEdit ? 'col-span-2' : ''}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên nguyên liệu <span className="text-rose-500">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="VD: Thịt bò tái, Hành tây..."
                required
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Đơn vị chuẩn</label>
              <Input
                value={form.unit ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="VD: g, ml, cái, bó..."
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nhóm dị ứng</label>
              <Select
                value={form.allergenCode ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, allergenCode: e.target.value }))}
                className="h-9 text-xs"
              >
                <option value="">Không có / Chưa rõ</option>
                {allergenOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Synonyms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên đồng nghĩa / từ đồng âm</label>
            <div className="flex gap-2">
              <Input
                value={synonymInput}
                onChange={(e) => setSynonymInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addSynonym()
                  }
                }}
                placeholder="Nhập tên phụ rồi nhấn Enter..."
                className="h-8 text-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={addSynonym} className="h-8 px-3 text-xs">
                <Plus size={14} /> Thêm
              </Button>
            </div>
            {(form.synonyms ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(form.synonyms ?? []).map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          synonyms: (f.synonyms ?? []).filter((x) => x !== s),
                        }))
                      }
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Active switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="block font-semibold text-slate-800">Trạng thái kích hoạt</span>
              <span className="text-[11px] text-slate-400">Cho phép các món ăn liên kết và tìm kiếm nguyên liệu này</span>
            </div>
            <Switch
              checked={!!form.isActive}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy} className="text-xs">
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={busy}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
            >
              {busy ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo nguyên liệu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
