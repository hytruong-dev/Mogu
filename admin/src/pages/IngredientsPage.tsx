import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudUpload, EyeOff, Pencil, Search, X } from 'lucide-react'
import {
  ingredientsApi,
  type CreateIngredientDto,
  type Ingredient,
  type UpdateIngredientDto,
} from '../api/ingredients'
import { taxonomyAdminApi } from '../api/taxonomy'
import { useFoodDataActions } from '../components/food-data/food-data-context'
import { FoodDataPagination } from '../components/food-data/FoodDataPagination'
import { HideConfirmDialog } from '../components/food-data/HideConfirmDialog'
import { Button } from '../components/ui/button'
import { TableSkeleton } from '../components/ui/page-skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''

const LEGACY_ALLERGEN_LABELS: Record<string, string> = {
  nut: 'Hạt',
  seafood: 'Hải sản',
  dairy: 'Sữa',
  egg: 'Trứng',
  gluten: 'Gluten',
  soy: 'Đậu nành',
  fish: 'Cá',
  sesame: 'Vừng',
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function IngredientFormDialog({
  open,
  ingredient,
  allergenOptions,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean
  ingredient?: Ingredient | null
  allergenOptions: Array<{ value: string; label: string }>
  onOpenChange: (open: boolean) => void
  onSave: (dto: CreateIngredientDto, imageFile: File | null) => Promise<void>
  saving: boolean
}) {
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

  const [localSaving, setLocalSaving] = useState(false)
  const busy = saving || localSaving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fd-modal-wide">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}</DialogTitle>
        </DialogHeader>

        <form
          className="fd-modal-body"
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
                imageFile,
              )
              onOpenChange(false)
            } catch (err: any) {
              setError(
                err?.response?.data?.error?.message ??
                  err?.response?.data?.message ??
                  err?.message ??
                  'Lỗi không xác định',
              )
            } finally {
              setLocalSaving(false)
            }
          }}
        >
          <div className="fd-ingredient-form">
            <div>
              <div className="fd-field">
                <label>Ảnh nguyên liệu</label>
              </div>
              <label
                className={`fd-upload-zone${dragOver ? ' is-dragover' : ''}`}
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
                  <>
                    <img src={imagePreview} alt="" />
                    <div className="fd-upload-overlay">
                      <CloudUpload size={22} />
                      <span>Đổi ảnh</span>
                    </div>
                  </>
                ) : (
                  <>
                    <CloudUpload size={28} color="#9ca3af" />
                    <strong style={{ fontSize: 13 }}>Kéo & thả ảnh vào đây</strong>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>hoặc Chọn ảnh</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
              <p className="fd-upload-hint">
                JPG, PNG, WEBP. Tối đa 5MB. Ảnh sẽ được tải lên sau khi tạo nguyên liệu.
              </p>
            </div>

            <div className="fd-form-grid">
              {!isEdit && (
                <div className="fd-field">
                  <label>
                    Mã nguyên liệu <span className="req">*</span>
                  </label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Nhập mã nguyên liệu"
                    required
                  />
                </div>
              )}

              <div className="fd-field">
                <label>
                  Tên nguyên liệu <span className="req">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nhập tên nguyên liệu"
                  required
                />
              </div>

              <div className="fd-field">
                <label>Đơn vị</label>
                <Input
                  value={form.unit ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="Nhập đơn vị (ví dụ: g, ml, cái...)"
                />
              </div>

              <div className="fd-field">
                <label>Nhóm dị ứng</label>
                <Select
                  value={form.allergenCode ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, allergenCode: e.target.value }))}
                >
                  <option value="">Chọn nhóm dị ứng</option>
                  {allergenOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="fd-field">
                <label>Tên đồng nghĩa</label>
                <div className="fd-synonym-input-row">
                  <Input
                    value={synonymInput}
                    onChange={(e) => setSynonymInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addSynonym()
                      }
                    }}
                    placeholder="Nhập tên đồng nghĩa và nhấn Enter"
                  />
                  <Button type="button" variant="outline" onClick={addSynonym}>
                    +
                  </Button>
                </div>
                <p className="fd-field-hint">Thêm các tên khác mà nguyên liệu này có thể được gọi.</p>
                {(form.synonyms ?? []).length > 0 && (
                  <div className="fd-synonym-list" style={{ marginTop: 8 }}>
                    {(form.synonyms ?? []).map((s) => (
                      <span key={s}>
                        {s}
                        <button
                          type="button"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            marginLeft: 4,
                            color: '#9ca3af',
                          }}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              synonyms: (f.synonyms ?? []).filter((x) => x !== s),
                            }))
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="fd-switch-row">
                <Switch
                  checked={!!form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  aria-label="Kích hoạt nguyên liệu"
                />
                <div>
                  <strong>Kích hoạt</strong>
                  <span>Nguyên liệu sẽ hiển thị và sử dụng trong hệ thống.</span>
                </div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="fd-modal-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo nguyên liệu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IngredientDetailDrawer({
  item,
  allergenLabel,
  onClose,
  onEdit,
  onHide,
  onApprove,
  onReject,
  imageCandidates,
  imageBusy,
  onSearchImages,
  onApproveCandidate,
}: {
  item: Ingredient
  allergenLabel?: string
  onClose: () => void
  onEdit: () => void
  onHide: () => void
  onApprove: () => void
  onReject: () => void
  imageCandidates: Array<{
    id: string
    provider: string
    sourcePageUrl: string
    author?: string | null
    licenseCode: string
    score: number
    publicUrl?: string | null
    previewUrl?: string | null
    originalUrl: string
  }>
  imageBusy: boolean
  onSearchImages: () => void
  onApproveCandidate: (candidateId: string) => void
}) {
  const synonyms = item.synonyms ?? []
  const visibleSynonyms = synonyms.slice(0, 4)
  const extra = Math.max(0, synonyms.length - visibleSynonyms.length)

  return (
    <aside className="fd-drawer">
      <div className="fd-drawer-header">
        <h3>Chi tiết nguyên liệu</h3>
        <button type="button" className="fd-icon-btn" onClick={onClose} aria-label="Đóng" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {item.imageUrl ? (
        <img className="fd-drawer-image" src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="fd-drawer-image" style={{ display: 'grid', placeItems: 'center', fontSize: 48 }}>
          —
        </div>
      )}

      <div className="fd-drawer-title-row">
        <h2>{item.name}</h2>
        <span className={`fd-status ${item.status === 'PENDING_REVIEW' ? 'is-off' : item.isActive ? 'is-on' : 'is-off'}`}>
          {item.status === 'PENDING_REVIEW' ? 'Cần duyệt' : item.isActive ? 'Hoạt động' : 'Đã ẩn'}
        </span>
      </div>

      <div className="fd-drawer-meta">
        <div className="fd-drawer-meta-row">
          <span>Mã nguyên liệu</span>
          <strong>{item.code}</strong>
        </div>
        <div className="fd-drawer-meta-row">
          <span>Đơn vị tính</span>
          <strong>{item.unit || '—'}</strong>
        </div>
        <div className="fd-drawer-meta-row">
          <span>Dị ứng</span>
          <strong>
            {allergenLabel ? <span className="fd-allergen-tag">{allergenLabel}</span> : 'Chưa xác minh'}
          </strong>
        </div>
        <div className="fd-drawer-meta-row">
          <span>Ảnh</span>
          <strong>{item.imageStatus || '—'}</strong>
        </div>
      </div>

      {synonyms.length > 0 && (
        <div className="fd-drawer-section">
          <h4>Tên gọi khác</h4>
          <div className="fd-synonym-list">
            {visibleSynonyms.map((s) => (
              <span key={s}>{s}</span>
            ))}
            {extra > 0 && <span>+{extra}</span>}
          </div>
        </div>
      )}

      <div className="fd-drawer-section">
        <h4>Ảnh ứng viên</h4>
        <Button type="button" variant="outline" disabled={imageBusy} onClick={onSearchImages}>
          {imageBusy ? 'Đang tìm...' : 'Tìm lại ảnh'}
        </Button>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {imageCandidates.length === 0 && (
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Chưa có candidate.</p>
          )}
          {imageCandidates.map((c) => (
            <div
              key={c.id}
              style={{
                border: '1px solid #eee',
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <img
                src={c.publicUrl || c.previewUrl || c.originalUrl}
                alt=""
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
              />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                <div><strong>{c.provider}</strong> · score {c.score}</div>
                <div style={{ color: '#666' }}>{c.licenseCode}{c.author ? ` · ${c.author}` : ''}</div>
                <a href={c.sourcePageUrl} target="_blank" rel="noreferrer">Nguồn</a>
              </div>
              <Button type="button" onClick={() => onApproveCandidate(c.id)} disabled={imageBusy}>
                Chọn
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="fd-drawer-section">
        <h4>Thông tin hệ thống</h4>
        <div className="fd-drawer-meta">
          <div className="fd-drawer-meta-row">
            <span>Ngày tạo</span>
            <strong>{formatDateTime(item.createdAt)}</strong>
          </div>
          <div className="fd-drawer-meta-row">
            <span>Cập nhật lần cuối</span>
            <strong>{formatDateTime(item.updatedAt)}</strong>
          </div>
          <div className="fd-drawer-meta-row">
            <span>Số món ăn đang sử dụng</span>
            <strong>{(item.dishCount ?? 0).toLocaleString('vi-VN')} món</strong>
          </div>
        </div>
      </div>

      <div className="fd-drawer-footer">
        {item.status === 'PENDING_REVIEW' && (
          <>
            <Button type="button" onClick={onApprove}>
              Duyệt ACTIVE
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={onReject}
            >
              Từ chối
            </Button>
          </>
        )}
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil size={14} /> Sửa nguyên liệu
        </Button>
        <Button type="button" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onHide}>
          <EyeOff size={14} /> Ẩn nguyên liệu
        </Button>
      </div>
    </aside>
  )
}

export default function IngredientsPage({
  embedded = false,
  isActive = true,
}: {
  embedded?: boolean
  isActive?: boolean
}) {
  const qc = useQueryClient()
  const { registerCreateHandler } = useFoodDataActions()
  const [q, setQ] = useState('')
  const [filterAllergen, setFilterAllergen] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'true' | 'false'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDING_REVIEW' | 'ACTIVE'>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null)
  const [detailItem, setDetailItem] = useState<Ingredient | null>(null)
  const [hideTarget, setHideTarget] = useState<Ingredient | null>(null)
  const [imageCandidates, setImageCandidates] = useState<
    Array<{
      id: string
      provider: string
      sourcePageUrl: string
      author?: string | null
      licenseCode: string
      score: number
      publicUrl?: string | null
      previewUrl?: string | null
      originalUrl: string
    }>
  >([])
  const [imageBusy, setImageBusy] = useState(false)

  const { data: allergens = [] } = useQuery({
    queryKey: ['admin-allergens'],
    queryFn: taxonomyAdminApi.listAllergens,
    staleTime: 60_000,
  })

  const allergenOptions = useMemo(() => {
    const fromCatalog = allergens
      .filter((a) => a.active)
      .map((a) => ({ value: a.code, label: a.name }))
    if (fromCatalog.length > 0) return fromCatalog
    return Object.entries(LEGACY_ALLERGEN_LABELS).map(([value, label]) => ({ value, label }))
  }, [allergens])

  const allergenLabelMap = useMemo(() => {
    const map: Record<string, string> = { ...LEGACY_ALLERGEN_LABELS }
    allergens.forEach((a) => {
      map[a.code] = a.name
      map[a.code.toLowerCase()] = a.name
    })
    return map
  }, [allergens])

  const resolveAllergenLabel = (code?: string | null) => {
    if (!code) return undefined
    return allergenLabelMap[code] ?? allergenLabelMap[code.toLowerCase()] ?? code
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ingredients', q, filterAllergen, filterActive, filterStatus, page, limit],
    queryFn: () =>
      ingredientsApi.adminList({
        q: q || undefined,
        allergenCode: filterAllergen || undefined,
        isActive: filterActive === 'all' ? undefined : filterActive === 'true',
        status: filterStatus === 'all' ? undefined : filterStatus,
        page,
        limit,
      }),
  })

  useEffect(() => {
    if (!detailItem?.id) {
      setImageCandidates([])
      return
    }
    let cancelled = false
    void ingredientsApi
      .listImageCandidates(detailItem.id)
      .then((res) => {
        if (!cancelled) setImageCandidates(res.candidates)
      })
      .catch(() => {
        if (!cancelled) setImageCandidates([])
      })
    return () => {
      cancelled = true
    }
  }, [detailItem?.id])

  const createMut = useMutation({
    mutationFn: ingredientsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateIngredientDto }) => ingredientsApi.update(id, dto),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
      setDetailItem((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
    },
  })

  const deleteMut = useMutation({
    mutationFn: ingredientsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
      setHideTarget(null)
      setDetailItem(null)
    },
  })

  useEffect(() => {
    if (!embedded || !isActive) return
    registerCreateHandler(() => {
      setEditTarget(null)
      setModalOpen(true)
    })
    return () => registerCreateHandler(null)
  }, [embedded, isActive, registerCreateHandler])

  useEffect(() => {
    if (isActive) return
    setModalOpen(false)
    setEditTarget(null)
    setDetailItem(null)
    setHideTarget(null)
  }, [isActive])

  const handleSave = async (dto: CreateIngredientDto, imageFile: File | null) => {
    let saved: Ingredient
    if (editTarget) {
      const { code: _code, ...updateDto } = dto
      void _code
      saved = await updateMut.mutateAsync({ id: editTarget.id, dto: updateDto })
    } else {
      saved = await createMut.mutateAsync(dto)
    }

    if (imageFile && saved?.id) {
      try {
        await ingredientsApi.uploadImage(saved.id, imageFile, SUPABASE_URL)
        qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      } catch {
        // keep record even if image fails
      }
    }
  }

  const items = data?.data ?? []
  const pagination = data?.pagination

  return (
    <div className={embedded ? 'food-data-embedded ingredients-panel' : undefined} style={{ padding: embedded ? 0 : '28px 32px' }}>
      {!embedded && (
        <div className="fd-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Nguyên liệu</h1>
            <p style={{ margin: '4px 0 0', color: '#8a8a8a', fontSize: 14 }}>Quản lý từ điển nguyên liệu</p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEditTarget(null)
              setModalOpen(true)
            }}
          >
            + Thêm nguyên liệu
          </Button>
        </div>
      )}

      <div className={`fd-split${detailItem ? ' is-open' : ''}`}>
        <div>
          <h2 className="fd-section-title">Danh sách nguyên liệu</h2>

          <div className="fd-toolbar">
            <div className="fd-search" style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setPage(1)
                }}
                placeholder="Tìm theo tên, mã..."
                style={{ paddingLeft: 34 }}
              />
            </div>
            <div className="fd-toolbar-filters">
              <Select
                className="fd-filter-select"
                value={filterAllergen}
                onChange={(e) => {
                  setFilterAllergen(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Tất cả dị ứng</option>
                {allergenOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Select
                className="fd-filter-select"
                value={filterActive}
                onChange={(e) => {
                  setFilterActive(e.target.value as 'all' | 'true' | 'false')
                  setPage(1)
                }}
              >
                <option value="all">Tất cả (active)</option>
                <option value="true">Hoạt động</option>
                <option value="false">Đã ẩn</option>
              </Select>
              <Select
                className="fd-filter-select"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as 'all' | 'PENDING_REVIEW' | 'ACTIVE')
                  setPage(1)
                }}
              >
                <option value="all">Mọi status</option>
                <option value="PENDING_REVIEW">Nguyên liệu cần duyệt</option>
                <option value="ACTIVE">ACTIVE</option>
              </Select>
            </div>
          </div>

          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Ảnh</th>
                  <th>Tên</th>
                  <th>Mã</th>
                  <th>Đơn vị</th>
                  <th>Dị ứng</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 150 }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="fd-empty p-0">
                      <TableSkeleton rows={5} cols={5} />
                    </td>
                  </tr>
                )}
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="fd-empty">
                      Chưa có nguyên liệu nào
                    </td>
                  </tr>
                )}
                {items.map((item) => {
                  const allergenLabel = resolveAllergenLabel(item.allergenCode)
                  return (
                    <tr
                      key={item.id}
                      className={detailItem?.id === item.id ? 'is-selected' : ''}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, [data-no-detail]')) return
                        setDetailItem(item)
                      }}
                    >
                      <td>
                        {item.imageUrl ? (
                          <img className="fd-thumb" src={item.imageUrl} alt="" />
                        ) : (
                          <div className="fd-thumb-fallback">🥦</div>
                        )}
                      </td>
                      <td>
                        <div className="fd-name-cell">
                          <strong>{item.name}</strong>
                          {item.synonyms?.[0] && <span>{item.synonyms[0]}</span>}
                        </div>
                      </td>
                      <td>
                        <code className="fd-code">{item.code}</code>
                      </td>
                      <td>{item.unit || '—'}</td>
                      <td>
                        {allergenLabel ? <span className="fd-allergen-tag">{allergenLabel}</span> : '—'}
                      </td>
                      <td>
                        <span className={`fd-status ${item.status === 'PENDING_REVIEW' ? 'is-off' : item.isActive ? 'is-on' : 'is-off'}`}>
                          {item.status === 'PENDING_REVIEW'
                            ? 'Cần duyệt'
                            : item.isActive
                              ? 'Hoạt động'
                              : item.status || 'Đã ẩn'}
                        </span>
                      </td>
                      <td data-no-detail onClick={(e) => e.stopPropagation()}>
                        <div className="fd-row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(item)
                              setModalOpen(true)
                            }}
                          >
                            <Pencil size={13} /> Sửa
                          </button>
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => setHideTarget(item)}
                            disabled={!item.isActive}
                          >
                            <EyeOff size={13} /> Ẩn
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pagination && (
            <FoodDataPagination
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              itemLabel="nguyên liệu"
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next)
                setPage(1)
              }}
            />
          )}
        </div>

        {detailItem && (
          <IngredientDetailDrawer
            item={detailItem}
            allergenLabel={resolveAllergenLabel(detailItem.allergenCode)}
            onClose={() => setDetailItem(null)}
            onEdit={() => {
              setEditTarget(detailItem)
              setModalOpen(true)
            }}
            onHide={() => setHideTarget(detailItem)}
            imageCandidates={imageCandidates}
            imageBusy={imageBusy}
            onApprove={async () => {
              const updated = await ingredientsApi.approve(detailItem.id, {
                allergenCode: detailItem.allergenCode,
                synonyms: detailItem.synonyms,
              })
              setDetailItem({ ...detailItem, ...updated })
              qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
            }}
            onReject={async () => {
              const updated = await ingredientsApi.reject(detailItem.id)
              setDetailItem({ ...detailItem, ...updated })
              qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
            }}
            onSearchImages={async () => {
              setImageBusy(true)
              try {
                await ingredientsApi.enqueueImageSearch(detailItem.id)
                const res = await ingredientsApi.listImageCandidates(detailItem.id)
                setImageCandidates(res.candidates)
                setDetailItem({ ...detailItem, ...res.ingredient })
              } finally {
                setImageBusy(false)
              }
            }}
            onApproveCandidate={async (candidateId) => {
              setImageBusy(true)
              try {
                const updated = await ingredientsApi.setImage(detailItem.id, { candidateId })
                setDetailItem({ ...detailItem, ...updated })
                qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
              } finally {
                setImageBusy(false)
              }
            }}
          />
        )}
      </div>

      <IngredientFormDialog
        open={modalOpen}
        ingredient={editTarget}
        allergenOptions={allergenOptions}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setEditTarget(null)
        }}
        onSave={handleSave}
        saving={createMut.isPending || updateMut.isPending}
      />

      <HideConfirmDialog
        open={!!hideTarget}
        onOpenChange={(open) => {
          if (!open) setHideTarget(null)
        }}
        title="Ẩn nguyên liệu này?"
        description="Dữ liệu sẽ không bị xóa vĩnh viễn. Các món đã liên kết vẫn giữ lịch sử, nhưng nguyên liệu không còn xuất hiện trong picker công khai."
        itemName={hideTarget?.name ?? ''}
        itemImageUrl={hideTarget?.imageUrl}
        usageCount={hideTarget?.dishCount}
        confirmLabel="Ẩn nguyên liệu"
        loading={deleteMut.isPending}
        onConfirm={() => {
          if (hideTarget) deleteMut.mutate(hideTarget.id)
        }}
      />
    </div>
  )
}
