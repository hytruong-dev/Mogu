import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { ingredientsApi, type Ingredient, type CreateIngredientDto } from '../api/ingredients'
import { X, ZoomIn } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''

const ALLERGEN_OPTIONS = [
  { value: '', label: 'Không có' },
  { value: 'nut', label: '🥜 Hạt' },
  { value: 'seafood', label: '🦐 Hải sản' },
  { value: 'dairy', label: '🥛 Sữa' },
  { value: 'egg', label: '🥚 Trứng' },
  { value: 'gluten', label: '🌾 Gluten' },
  { value: 'soy', label: '🫘 Đậu nành' },
  { value: 'fish', label: '🐟 Cá' },
  { value: 'sesame', label: '🌿 Vừng' },
]

// ─── Image Upload Zone (tái sử dụng pattern từ FoodsPage) ────────────────────
function ImageUploadZone({
  preview,
  onChange,
  size = 100,
}: {
  preview: string
  onChange: (file: File, previewUrl: string) => void
  size?: number
}) {
  const [hover, setHover] = useState(false)

  return (
    <div style={{ textAlign: 'center' }}>
      <label
        style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Ảnh / placeholder */}
        <div style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', margin: '0 auto', border: '2px dashed #e5e0d8', background: '#faf7f0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {preview ? (
            <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <span style={{ fontSize: 36 }}>🥦</span>
          )}
          {/* Overlay khi hover */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            borderRadius: 10, opacity: hover ? 1 : 0, transition: 'opacity 0.18s',
          }}>
            <ZoomIn size={20} color="#fff" />
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{preview ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
          </div>
        </div>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            onChange(file, URL.createObjectURL(file))
          }}
        />
      </label>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#aaa' }}>Click để {preview ? 'đổi' : 'chọn'} ảnh</p>
    </div>
  )
}

// ─── Ingredient Modal ─────────────────────────────────────────────────────────
function IngredientModal({
  ingredient,
  onClose,
  onSave,
}: {
  ingredient?: Ingredient | null
  onClose: () => void
  onSave: (data: CreateIngredientDto, imageFile: File | null) => Promise<void>
}) {
  const isEdit = !!ingredient
  const [form, setForm] = useState<CreateIngredientDto>({
    code: ingredient?.code ?? '',
    name: ingredient?.name ?? '',
    synonyms: ingredient?.synonyms ?? [],
    unit: ingredient?.unit ?? '',
    allergenCode: ingredient?.allergenCode ?? '',
    imageUrl: ingredient?.imageUrl ?? '',
    isActive: ingredient?.isActive ?? true,
  })
  const [synonymInput, setSynonymInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>(ingredient?.imageUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Đóng khi Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  const addSynonym = () => {
    const s = synonymInput.trim()
    if (s && !form.synonyms!.includes(s)) {
      setForm(f => ({ ...f, synonyms: [...(f.synonyms ?? []), s] }))
    }
    setSynonymInput('')
  }

  const removeSynonym = (s: string) => {
    setForm(f => ({ ...f, synonyms: (f.synonyms ?? []).filter(x => x !== s) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Tên nguyên liệu không được trống')
    if (!isEdit && !form.code.trim()) return setError('Mã nguyên liệu không được trống')
    setSaving(true)
    setError('')
    try {
      await onSave(form, imageFile)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0', borderBottom: '1px solid #f0e8d0', paddingBottom: 16, position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0', zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#2c1810' }}>
            {isEdit ? '✏️ Sửa nguyên liệu' : '🥬 Thêm nguyên liệu'}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: '#f5f0e8', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Upload ảnh — tái sử dụng ImageUploadZone */}
          <ImageUploadZone
            preview={imagePreview}
            onChange={(file, previewUrl) => {
              setImageFile(file)
              setImagePreview(previewUrl)
            }}
          />

          {/* Code */}
          {!isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Mã nguyên liệu *</label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="VD: ga, thit_heo, muoi..."
                style={{ width: '100%', boxSizing: 'border-box' }}
                required
              />
            </div>
          )}

          {/* Tên */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Tên nguyên liệu *</label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Thịt gà, Hành tây..."
              style={{ width: '100%', boxSizing: 'border-box' }}
              required
            />
          </div>

          {/* Đơn vị */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Đơn vị</label>
            <Input
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              placeholder="VD: g, kg, ml, cái..."
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Nhóm dị ứng */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Nhóm dị ứng</label>
            <Select
              value={form.allergenCode}
              onChange={e => setForm(f => ({ ...f, allergenCode: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              {ALLERGEN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          {/* Tên đồng nghĩa */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Tên đồng nghĩa</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={synonymInput}
                onChange={e => setSynonymInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSynonym())}
                placeholder="Nhập tên và nhấn Enter"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={addSynonym}
                style={{ background: '#f0a500', color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 42, cursor: 'pointer', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >+</button>
            </div>
            {(form.synonyms ?? []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {(form.synonyms ?? []).map(s => (
                  <span key={s} style={{ background: '#f5f0e8', borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {s}
                    <button type="button" onClick={() => removeSynonym(s)} style={{ border: 'none', background: 'rgba(0,0,0,0.1)', borderRadius: '50%', cursor: 'pointer', color: '#666', padding: 0, width: 16, height: 16, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Kích hoạt */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: '#f0a500' }}
            />
            <span style={{ fontSize: 14, color: '#333' }}>Kích hoạt</span>
          </label>

          {error && (
            <div style={{ background: '#fff0f0', color: '#c0392b', borderRadius: 8, padding: '10px 14px', fontSize: 13, border: '1px solid #ffcccc' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f5f0e8' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: '#f5f0e8', color: '#555', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >Hủy</button>
            <button
              type="submit"
              disabled={saving}
              style={{ background: saving ? '#ccc' : '#f0a500', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 22px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}
            >
              {saving ? '⏳ Đang lưu...' : isEdit ? '💾 Lưu thay đổi' : '+ Thêm nguyên liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Ingredient Detail Dialog ─────────────────────────────────────────────────
function IngredientDetailDialog({
  ingredient,
  onClose,
  onEdit,
}: {
  ingredient: Ingredient
  onClose: () => void
  onEdit: (item: Ingredient) => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  const allergenLabel = ALLERGEN_OPTIONS.find(o => o.value === ingredient.allergenCode)?.label

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 24px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}
      >
        {/* Hero */}
        <div style={{ position: 'relative', height: ingredient.imageUrl ? 180 : 0, background: '#f5f0e8', overflow: 'hidden' }}>
          {ingredient.imageUrl && (
            <img src={ingredient.imageUrl} alt={ingredient.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <X size={16} />
          </button>
          {ingredient.imageUrl && (
            <div style={{ position: 'absolute', bottom: 14, left: 18 }}>
              <span style={{ background: ingredient.isActive ? '#d4edda' : '#f8d7da', color: ingredient.isActive ? '#155724' : '#721c24', borderRadius: 12, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                {ingredient.isActive ? '✓ Hoạt động' : '✗ Tắt'}
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* No image placeholder */}
          {!ingredient.imageUrl && (
            <div style={{ textAlign: 'center', fontSize: 52, lineHeight: 1 }}>🥦</div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2c1810' }}>{ingredient.name}</h2>
              <code style={{ fontSize: 12, background: '#f5f0e8', padding: '2px 8px', borderRadius: 4, color: '#8b6f47', marginTop: 4, display: 'inline-block' }}>{ingredient.code}</code>
              {!ingredient.imageUrl && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ background: ingredient.isActive ? '#d4edda' : '#f8d7da', color: ingredient.isActive ? '#155724' : '#721c24', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    {ingredient.isActive ? '✓ Hoạt động' : '✗ Tắt'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => { onClose(); onEdit(ingredient) }}
              style={{ flexShrink: 0, background: '#f0a500', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              ✏️ Sửa
            </button>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#faf7f0', borderRadius: 10, padding: '10px 14px', border: '1px solid #f0e8d0' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>Đơn vị</div>
              <div style={{ fontWeight: 600, color: '#2c1810' }}>{ingredient.unit ?? '—'}</div>
            </div>
            <div style={{ background: '#faf7f0', borderRadius: 10, padding: '10px 14px', border: '1px solid #f0e8d0' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>Nhóm dị ứng</div>
              <div style={{ fontWeight: 600, color: '#2c1810' }}>{allergenLabel || '—'}</div>
            </div>
          </div>

          {/* Synonyms */}
          {ingredient.synonyms?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>Tên đồng nghĩa</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ingredient.synonyms.map(s => (
                  <span key={s} style={{ background: '#f5f0e8', borderRadius: 20, padding: '3px 12px', fontSize: 13, color: '#6b5230' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f0e8d0', paddingTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#ccc' }}>ID: {ingredient.id}</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>Cập nhật: {new Date(ingredient.updatedAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IngredientsPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filterAllergen, setFilterAllergen] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null)
  const [detailItem, setDetailItem] = useState<Ingredient | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ingredients', q, filterAllergen, page],
    queryFn: () => ingredientsApi.adminList({ q: q || undefined, allergenCode: filterAllergen || undefined, page, limit: 20 }),
  })

  const createMut = useMutation({
    mutationFn: ingredientsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      setShowModal(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => ingredientsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      setEditTarget(null)
      setShowModal(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: ingredientsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      setDeleteConfirm(null)
    },
  })

  // Lưu rồi upload ảnh nếu có
  const handleSave = async (dto: CreateIngredientDto, imageFile: File | null) => {
    let savedItem: Ingredient
    if (editTarget) {
      // Strip `code` khi update vì backend UpdateIngredientDto không cho phép field này
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { code: _code, ...updateDto } = dto
      savedItem = await updateMut.mutateAsync({ id: editTarget.id, dto: updateDto })
    } else {
      savedItem = await createMut.mutateAsync(dto)
    }

    // Upload ảnh sau khi có ID
    if (imageFile && savedItem?.id) {
      try {
        await ingredientsApi.uploadImage(savedItem.id, imageFile, SUPABASE_URL)
        qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      } catch {
        // ảnh lỗi vẫn không crash flow
      }
    }
  }

  const openEdit = (item: Ingredient) => {
    setEditTarget(item)
    setShowModal(true)
  }

  const items = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2c1810', margin: 0 }}>🥬 Nguyên liệu</h1>
          <p style={{ color: '#8b6f47', fontSize: 14, margin: '4px 0 0' }}>
            Quản lý từ điển nguyên liệu
            {pagination && <span style={{ marginLeft: 8, background: '#f5f0e8', borderRadius: 12, padding: '2px 10px', fontSize: 13 }}>{pagination.total} mục</span>}
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true) }}
          style={{ background: '#f0a500', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          + Thêm nguyên liệu
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Input
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder="🔍 Tìm theo tên, mã..."
          style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
        />
        <Select
          value={filterAllergen}
          onChange={e => { setFilterAllergen(e.target.value); setPage(1) }}
          style={{ minWidth: 180 }}
        >
          <option value="">Tất cả dị ứng</option>
          {ALLERGEN_OPTIONS.filter(o => o.value).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="table-card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 64, padding: '10px 14px' }}>Ảnh</th>
              <th style={{ padding: '10px 14px' }}>Tên</th>
              <th style={{ padding: '10px 14px' }}>Mã</th>
              <th style={{ padding: '10px 14px' }}>Đơn vị</th>
              <th style={{ padding: '10px 14px' }}>Dị ứng</th>
              <th style={{ padding: '10px 14px' }}>Trạng thái</th>
              <th style={{ width: 120, padding: '10px 14px' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Đang tải...</td></tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Chưa có nguyên liệu nào</td></tr>
            )}
            {items.map(item => (
              <tr
                key={item.id}
                style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                onClick={e => {
                  if ((e.target as HTMLElement).closest('button, input, [data-no-detail]')) return
                  setDetailItem(item)
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#faf7f0')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Ảnh */}
                <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid #eee' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f5f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto' }}>🥦</div>
                  )}
                </td>
                {/* Tên */}
                <td style={{ padding: '8px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#2c1810' }}>{item.name}</div>
                  {item.synonyms?.length > 0 && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{item.synonyms.slice(0, 3).join(', ')}</div>
                  )}
                </td>
                {/* Mã */}
                <td style={{ padding: '8px 14px' }}>
                  <code style={{ fontSize: 12, background: '#f5f0e8', padding: '2px 6px', borderRadius: 4, color: '#8b6f47' }}>{item.code}</code>
                </td>
                {/* Đơn vị */}
                <td style={{ padding: '8px 14px', color: '#666' }}>{item.unit ?? '—'}</td>
                {/* Dị ứng */}
                <td style={{ padding: '8px 14px' }}>
                  {item.allergenCode ? (
                    <span style={{ background: '#fff3cd', color: '#856404', borderRadius: 12, padding: '2px 8px', fontSize: 12 }}>
                      {ALLERGEN_OPTIONS.find(o => o.value === item.allergenCode)?.label ?? item.allergenCode}
                    </span>
                  ) : '—'}
                </td>
                {/* Trạng thái */}
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ background: item.isActive ? '#d4edda' : '#f8d7da', color: item.isActive ? '#155724' : '#721c24', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                    {item.isActive ? 'Hoạt động' : 'Tắt'}
                  </span>
                </td>
                {/* Hành động */}
                <td style={{ padding: '8px 14px' }} data-no-detail onClick={e => e.stopPropagation()}>
                  {deleteConfirm === item.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }} onClick={() => deleteMut.mutate(item.id)}>Xác nhận</button>
                      <button style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }} onClick={() => setDeleteConfirm(null)}>Hủy</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ background: '#f5f0e8', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => openEdit(item)}>Sửa</button>
                      <button style={{ background: '#fff0f0', color: '#c0392b', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => setDeleteConfirm(item.id)}>Xóa</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ background: '#f5f0e8', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>← Trước</button>
          <span style={{ padding: '6px 16px', color: '#555', fontSize: 14 }}>Trang {page} / {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} style={{ background: '#f5f0e8', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>Tiếp →</button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <IngredientModal
          ingredient={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSave={handleSave}
        />
      )}

      {/* Detail Dialog */}
      {detailItem && (
        <IngredientDetailDialog
          ingredient={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={item => { setDetailItem(null); openEdit(item) }}
        />
      )}
    </div>
  )
}
