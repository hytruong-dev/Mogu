import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, Clock, CloudUpload, GitMerge, Loader2, Pencil, Search, Trash2, X } from 'lucide-react'
import { MediaLightbox, useMediaLightbox } from '../components/ui/media-lightbox'
import {
  ingredientsApi,
  type ApproveIngredientDto,
  type CreateIngredientDto,
  type Ingredient,
  type UpdateIngredientDto,
} from '../api/ingredients'
import { taxonomyAdminApi } from '../api/taxonomy'
import { useFoodDataActions } from '../components/food-data/food-data-context'
import { FoodDataPagination } from '../components/food-data/FoodDataPagination'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Image } from '../components/ui/image'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

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

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Tự động tìm - cần duyệt',
  ACTIVE: 'Hoạt động',
  REJECTED: 'Đã từ chối',
  MERGED: 'Đã gộp',
  INACTIVE: 'Đã ẩn',
}

const CREATED_VIA_LABELS: Record<string, string> = {
  MANUAL: 'Nhập tay',
  AI_IMPORT: 'AI nhập món (tự động)',
  ADMIN_PICKER: 'Tạo từ màn món ăn',
  FILE_IMPORT: 'Nhập từ file',
}

const IMAGE_STATUS_LABELS: Record<string, string> = {
  NOT_REQUESTED: 'Chưa tìm',
  QUEUED: 'Đang chờ tìm',
  SEARCHING: 'Đang tìm',
  PENDING_REVIEW: 'Ảnh tự động - cần xác nhận',
  APPROVED: 'Đã duyệt',
  NOT_FOUND: 'Không tìm thấy',
  FAILED: 'Lỗi tìm ảnh',
}

/** Danh sách nguyên liệu ACTIVE để chọn làm đích khi gộp. */
function MergeTargetResults({
  query,
  excludeId,
  selectedId,
  onSelect,
}: {
  query: string
  excludeId: string
  selectedId?: string
  onSelect: (t: { id: string; name: string }) => void
}) {
  const q = query.trim()
  const { data, isFetching } = useQuery({
    queryKey: ['ingredient-merge-targets', q],
    queryFn: () => ingredientsApi.adminList({ q, status: 'ACTIVE', limit: 8, page: 1 }),
    enabled: q.length >= 1 && !selectedId,
  })
  if (!q || selectedId) return null
  const items = (data?.data ?? []).filter((x) => x.id !== excludeId)
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, marginTop: 6, maxHeight: 220, overflowY: 'auto' }}>
      {isFetching && <div style={{ padding: 8, fontSize: 12, color: '#888' }}>Đang tìm...</div>}
      {!isFetching && items.length === 0 && (
        <div style={{ padding: 8, fontSize: 12, color: '#888' }}>Không có nguyên liệu ACTIVE phù hợp.</div>
      )}
      {items.map((x) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onSelect({ id: x.id, name: x.name })}
          style={{
            display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '6px 8px',
            border: 0, borderBottom: '1px solid #f3f3f3', background: '#fff', cursor: 'pointer', textAlign: 'left',
          }}
        >
          {x.imageUrl ? (
            <Image src={x.imageUrl} alt={x.name} aspectRatio="square" className="w-7 h-7 rounded-md object-cover" />
          ) : (
            <span style={{ width: 28, height: 28, borderRadius: 6, background: '#f5f5f5' }} />
          )}
          <span style={{ fontSize: 13 }}>
            {x.name}
            {x.synonyms?.length ? <span style={{ color: '#999', fontSize: 11 }}> · {x.synonyms.slice(0, 2).join(', ')}</span> : null}
          </span>
        </button>
      ))}
    </div>
  )
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
                    <Image
                      src={imagePreview}
                      alt=""
                      fallbackIcon="image"
                      containerClassName="absolute inset-0 h-full w-full rounded-none"
                      className="h-full w-full object-cover"
                    />
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
  onDelete,
  onApprove,
  onReject,
  onMerge,
  imageCandidates,
  imageBusy,
  onSearchImages,
  onApproveCandidate,
}: {
  item: Ingredient
  allergenLabel?: string
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onApprove: (patch: ApproveIngredientDto) => Promise<void> | void
  onReject: () => void
  onMerge: (targetId: string) => Promise<void> | void
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
  const isPending = item.status === 'PENDING_REVIEW'
  const isProvisionalImage = !!item.imageUrl && item.imageStatus === 'PENDING_REVIEW'
  const suggestedSynonyms = (item.enrichment as any)?.suggestedSynonyms as string[] | undefined

  // Form duyệt (patch) — reset khi đổi nguyên liệu
  const [nameEn, setNameEn] = useState(item.nameEn ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [groupLabel, setGroupLabel] = useState(item.groupLabel ?? '')
  const [synonymsText, setSynonymsText] = useState(synonyms.join(', '))
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<{ id: string; name: string } | null>(null)
  const [mergeQuery, setMergeQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setNameEn(item.nameEn ?? '')
    setDescription(item.description ?? '')
    setGroupLabel(item.groupLabel ?? '')
    setSynonymsText((item.synonyms ?? []).join(', '))
    setMergeOpen(false)
    setMergeTarget(null)
    setMergeQuery('')
    setErr(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Thao tác thất bại')
    } finally {
      setBusy(false)
    }
  }

  const buildPatch = (): ApproveIngredientDto => ({
    nameEn: nameEn.trim() || undefined,
    description: description.trim() || undefined,
    groupLabel: groupLabel.trim() || undefined,
    synonyms: synonymsText.split(',').map((s) => s.trim()).filter(Boolean),
    allergenCode: item.allergenCode ?? undefined,
  })

  return (
    <aside className="fd-drawer">
      <div className="fd-drawer-header">
        <h3>Chi tiết nguyên liệu</h3>
        <button type="button" className="fd-icon-btn" onClick={onClose} aria-label="Đóng" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ position: 'relative' }} className="group">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            aspectRatio="video"
            fallbackIcon="utensils"
            zoomable
            title={item.name}
            subtitle={item.groupLabel}
            className="fd-drawer-image object-cover rounded-xl"
          />
        ) : (
          <div className="fd-drawer-image" style={{ display: 'grid', placeItems: 'center', fontSize: 48 }}>
            —
          </div>
        )}
        {isProvisionalImage && (
          <span
            style={{
              position: 'absolute', left: 10, bottom: 10, background: 'rgba(217,119,6,.92)', color: '#fff',
              fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
            }}
          >
            Ảnh tự động - cần xác nhận
          </span>
        )}
      </div>

      <div className="fd-drawer-title-row">
        <h2>{item.name}</h2>
        <span className={`fd-status ${item.status === 'PENDING_REVIEW' || item.status === 'REJECTED' || item.status === 'MERGED' ? 'is-off' : item.isActive ? 'is-on' : 'is-off'}`}>
          {STATUS_LABELS[item.status ?? ''] ?? (item.isActive ? 'Hoạt động' : 'Đã ẩn')}
        </span>
      </div>
      {item.nameEn && !isPending && (
        <p style={{ margin: '-4px 0 8px', color: '#666', fontSize: 13 }}>
          EN: <i>{item.nameEn}</i>
          {item.groupLabel ? ` · ${item.groupLabel}` : ''}
        </p>
      )}
      {item.description && !isPending && (
        <p style={{ margin: '0 0 10px', color: '#444', fontSize: 13, lineHeight: 1.5 }}>{item.description}</p>
      )}

      {item.enrichment?.entity && (
        <div style={{ margin: '0 0 12px', fontSize: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#666' }}>Thực thể:</span>
          {item.enrichment.entity.viTitle && (
            <a
              href={`https://vi.wikipedia.org/wiki/${encodeURIComponent(item.enrichment.entity.viTitle)}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              Wikipedia ↗
            </a>
          )}
          {item.enrichment.entity.wikidataId && (
            <a
              href={`https://www.wikidata.org/wiki/${item.enrichment.entity.wikidataId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              Wikidata ({item.enrichment.entity.wikidataId}) ↗
            </a>
          )}
          {item.enrichment.entity.offTag && (
            <a
              href={`https://world.openfoodfacts.org/ingredient/${item.enrichment.entity.offTag.replace(/^en:/, '')}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              Open Food Facts ↗
            </a>
          )}
        </div>
      )}

      <div className="fd-drawer-meta">
        <div className="fd-drawer-meta-row">
          <span>Nguồn tạo</span>
          <strong>{CREATED_VIA_LABELS[item.createdVia ?? 'MANUAL'] ?? item.createdVia}</strong>
        </div>
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
          <strong>{IMAGE_STATUS_LABELS[item.imageStatus ?? ''] ?? item.imageStatus ?? '—'}</strong>
        </div>
      </div>

      {isPending && (
        <div className="fd-drawer-section">
          <h4>
            Thông tin tự động tìm{' '}
            <span style={{ fontSize: 11, fontWeight: 500, color: '#b45309' }}>(AI gợi ý - kiểm tra trước khi duyệt)</span>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <span>Tên tiếng Anh</span>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="vd: beef" />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <span>Nhóm</span>
              <Input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="vd: Thịt, Rau củ, Gia vị" />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <span>Mô tả ngắn</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={300}
                className="text-xs"
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              <span>Tên gọi khác (phân tách bằng dấu phẩy)</span>
              <Input value={synonymsText} onChange={(e) => setSynonymsText(e.target.value)} />
            </label>
            {suggestedSynonyms && suggestedSynonyms.length > 0 && (
              <div style={{ fontSize: 12, color: '#666' }}>
                Gợi ý:{' '}
                {suggestedSynonyms.map((s) => {
                  const current = synonymsText.split(',').map((x) => x.trim()).filter(Boolean)
                  const has = current.includes(s)
                  return (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={has}
                      onClick={() => setSynonymsText([...current, s].join(', '))}
                      className="h-6 rounded-full px-2 text-[11px] mr-1 my-0.5 border-amber-300 font-normal"
                    >
                      {has ? '✓ ' : '+ '}{s}
                    </Button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!isPending && synonyms.length > 0 && (
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
          {imageCandidates.map((c) => {
            const providerName =
              c.provider === 'wikipedia_lead'
                ? 'Wikipedia Lead'
                : c.provider === 'wikidata_p18'
                  ? 'Wikidata P18'
                  : c.provider === 'pixabay'
                    ? 'Pixabay'
                    : c.provider === 'commons_category'
                      ? 'Commons Cat'
                      : c.provider === 'wikimedia_commons'
                        ? 'Commons'
                        : c.provider
            const isAiVerified = (c as any).scoreBreakdown?.vision?.matchesName === true
            return (
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
                <div className="relative group shrink-0" style={{ width: 56, height: 56 }}>
                  <Image
                    src={c.publicUrl || c.previewUrl || c.originalUrl}
                    alt={item.name}
                    aspectRatio="square"
                    zoomable
                    title={`Ảnh ứng viên: ${item.name}`}
                    subtitle={`${providerName} · Điểm: ${c.score}`}
                    className="w-14 h-14 object-cover rounded-lg"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong>{providerName}</strong> · score {c.score}
                    {isAiVerified && (
                      <span style={{ fontSize: 10, color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: 4 }}>
                        ✓ AI xác minh
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#666' }}>{c.licenseCode}{c.author ? ` · ${c.author}` : ''}</div>
                  <a href={c.sourcePageUrl} target="_blank" rel="noreferrer">Nguồn</a>
                </div>
                <Button type="button" onClick={() => onApproveCandidate(c.id)} disabled={imageBusy}>
                  Chọn
                </Button>
              </div>
            )
          })}
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

      {mergeOpen && (
        <div className="fd-drawer-section">
          <h4>Gộp vào nguyên liệu có sẵn</h4>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px' }}>
            Các món đang dùng “{item.name}” sẽ chuyển sang nguyên liệu đích; “{item.name}” được thêm vào tên gọi khác của nguyên liệu đích.
          </p>
          <Input value={mergeQuery} onChange={(e) => { setMergeQuery(e.target.value); setMergeTarget(null) }} placeholder="Tìm nguyên liệu đích..." />
          <MergeTargetResults
            query={mergeQuery}
            excludeId={item.id}
            selectedId={mergeTarget?.id}
            onSelect={(t) => { setMergeTarget(t); setMergeQuery(t.name) }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button
              type="button"
              disabled={!mergeTarget || busy}
              onClick={() => mergeTarget && run(async () => { await onMerge(mergeTarget.id); setMergeOpen(false) })}
            >
              Xác nhận gộp
            </Button>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)}>Hủy</Button>
          </div>
        </div>
      )}

      {err && <p style={{ color: '#cf1322', fontSize: 12, margin: '0 16px 8px' }}>{err}</p>}

      <div className="fd-drawer-footer">
        {isPending && (
          <>
            <Button type="button" disabled={busy} onClick={() => run(() => onApprove(buildPatch()))}>
              Duyệt ACTIVE
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setMergeOpen((v) => !v)}>
              <GitMerge size={14} /> Gộp vào...
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={busy}
              onClick={() => run(onReject)}
            >
              Từ chối
            </Button>
          </>
        )}
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil size={14} /> Sửa nguyên liệu
        </Button>
        <Button type="button" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onDelete}>
          <Trash2 size={14} /> Xóa nguyên liệu
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
  const { lightboxProps } = useMediaLightbox()
  const [q, setQ] = useState('')
  const [filterAllergen, setFilterAllergen] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'true' | 'false'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDING_REVIEW' | 'ACTIVE'>(() => {
    // Deep link: /food-data?tab=ingredients&status=PENDING_REVIEW (từ popup chặn gửi duyệt)
    const s = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') : null
    return s === 'PENDING_REVIEW' || s === 'ACTIVE' ? s : 'all'
  })
  const [activationTab, setActivationTab] = useState<'all' | 'unactivated' | 'activated'>(() => {
    const s = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('status') : null
    if (s === 'PENDING_REVIEW') return 'unactivated'
    if (s === 'ACTIVE') return 'activated'
    const act = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('activation') : null
    if (act === 'unactivated' || act === 'activated') return act
    return 'all'
  })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null)
  const [detailItem, setDetailItem] = useState<Ingredient | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
    queryKey: ['admin-ingredients', q, filterAllergen, filterActive, filterStatus, activationTab, page, limit],
    queryFn: () =>
      ingredientsApi.adminList({
        q: q || undefined,
        allergenCode: filterAllergen || undefined,
        isActive: activationTab === 'all' && filterActive !== 'all' ? filterActive === 'true' : undefined,
        status: activationTab === 'all' && filterStatus !== 'all' ? filterStatus : undefined,
        activationStatus: activationTab,
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
    onMutate: (id: string) => {
      setDeletingId(id)
    },
    onSettled: () => {
      setDeletingId(null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
      setDetailItem(null)
    },
  })

  const handleDelete = (item: Ingredient) => {
    deleteMut.mutate(item.id)
  }

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

  const tabCounts = useMemo(() => {
    return {
      all: data?.counts?.all ?? pagination?.total ?? 0,
      unactivated: data?.counts?.unactivated ?? 0,
      activated: data?.counts?.activated ?? 0,
    }
  }, [data?.counts, pagination?.total])

  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [batchActivating, setBatchActivating] = useState(false)

  const pendingCountOnPage = useMemo(
    () => items.filter((i) => i.status === 'PENDING_REVIEW' || !i.isActive).length,
    [items],
  )

  const handleActivate = async (item: Ingredient) => {
    setActivatingId(item.id)
    try {
      let updated: Ingredient
      if (item.status === 'PENDING_REVIEW') {
        updated = await ingredientsApi.approve(item.id)
      } else {
        updated = await ingredientsApi.update(item.id, { isActive: true })
      }
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
      setDetailItem((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
    } catch (err) {
      console.error('Failed to activate ingredient:', err)
    } finally {
      setActivatingId(null)
    }
  }

  const handleActivateAllOnPage = async () => {
    const pendingItems = items.filter((i) => i.status === 'PENDING_REVIEW' || !i.isActive)
    if (!pendingItems.length) return
    setBatchActivating(true)
    try {
      for (const item of pendingItems) {
        if (item.status === 'PENDING_REVIEW') {
          await ingredientsApi.approve(item.id)
        } else {
          await ingredientsApi.update(item.id, { isActive: true })
        }
      }
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
    } catch (err) {
      console.error('Batch activate failed:', err)
    } finally {
      setBatchActivating(false)
    }
  }

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
          <div className="fd-subtabs-bar">
            <Tabs
              value={activationTab}
              onValueChange={(val) => {
                setActivationTab(val as typeof activationTab)
                setPage(1)
              }}
            >
              <TabsList className="h-9 p-1 bg-muted/60">
                <TabsTrigger value="all" className="gap-2 text-xs font-semibold px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <span>Tất cả</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {tabCounts.all}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="unactivated" className="gap-2 text-xs font-semibold px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Clock size={13} className="text-amber-600" />
                  <span>Chưa kích hoạt</span>
                  <Badge variant="warning" className="text-[10px] px-1 py-0 h-4">
                    {tabCounts.unactivated}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="activated" className="gap-2 text-xs font-semibold px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Đã kích hoạt</span>
                  <Badge variant="success" className="text-[10px] px-1 py-0 h-4">
                    {tabCounts.activated}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {pendingCountOnPage > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                onClick={handleActivateAllOnPage}
                disabled={batchActivating}
              >
                {batchActivating ? (
                  <Loader2 size={13} className="animate-spin mr-1.5" />
                ) : (
                  <Check size={13} className="mr-1.5" />
                )}
                {batchActivating ? 'Đang kích hoạt...' : `Kích hoạt tất cả trang này (${pendingCountOnPage})`}
              </Button>
            )}
          </div>

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
              {activationTab === 'all' && (
                <>
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
                </>
              )}
            </div>
          </div>

          <div className="fd-table-wrap">
            <Table className="fd-table">
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 64 }}>Ảnh</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Dị ứng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead style={{ width: 250, minWidth: 240 }}>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="fd-empty p-0">
                      <TableSkeleton rows={5} cols={5} />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="fd-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                      {activationTab === 'unactivated'
                        ? 'Không có nguyên liệu nào đang chờ kích hoạt 🎉'
                        : activationTab === 'activated'
                          ? 'Chưa có nguyên liệu nào được kích hoạt'
                          : 'Chưa có nguyên liệu nào'}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => {
                  const allergenLabel = resolveAllergenLabel(item.allergenCode)
                  const isPendingOrInactive = item.status === 'PENDING_REVIEW' || !item.isActive
                  const isActivating = activatingId === item.id
                  return (
                    <TableRow
                      key={item.id}
                      className={detailItem?.id === item.id ? 'is-selected cursor-pointer' : 'cursor-pointer'}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, [data-no-detail]')) return
                        setDetailItem(item)
                      }}
                    >
                      <TableCell>
                        {item.imageUrl ? (
                          <div className="relative group inline-block" data-no-detail="true" onClick={(e) => e.stopPropagation()}>
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              aspectRatio="square"
                              zoomable
                              title={item.name}
                              subtitle={item.groupLabel}
                              className="fd-thumb"
                            />
                          </div>
                        ) : (
                          <div className="fd-thumb-fallback">🥦</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="fd-name-cell">
                          <strong>{item.name}</strong>
                          {item.synonyms?.[0] && <span>{item.synonyms[0]}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="fd-code">{item.code}</code>
                      </TableCell>
                      <TableCell>{item.unit || '—'}</TableCell>
                      <TableCell>
                        {allergenLabel ? <span className="fd-allergen-tag">{allergenLabel}</span> : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`fd-status ${item.status === 'PENDING_REVIEW' ? 'is-off' : item.isActive ? 'is-on' : 'is-off'}`}>
                          {item.status && item.status !== 'ACTIVE'
                            ? STATUS_LABELS[item.status] ?? item.status
                            : item.isActive
                              ? 'Hoạt động'
                              : 'Đã ẩn'}
                        </span>
                      </TableCell>
                      <TableCell data-no-detail onClick={(e) => e.stopPropagation()} style={{ minWidth: 240 }}>
                        <div className="fd-row-actions">
                          {isPendingOrInactive ? (
                            <button
                              type="button"
                              className="is-success"
                              disabled={isActivating || batchActivating}
                              onClick={() => handleActivate(item)}
                              title="Duyệt và kích hoạt nguyên liệu vào hệ thống"
                            >
                              {isActivating ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              {isActivating ? 'Đang duyệt...' : 'Kích hoạt'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="is-success"
                              disabled
                              title="Nguyên liệu đang hoạt động"
                            >
                              <Check size={13} /> Đã kích hoạt
                            </button>
                          )}
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
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item)}
                            title="Xóa vĩnh viễn nguyên liệu này"
                          >
                            {deletingId === item.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            {deletingId === item.id ? 'Đang xóa...' : 'Xóa'}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
            onDelete={() => handleDelete(detailItem)}
            imageCandidates={imageCandidates}
            imageBusy={imageBusy}
            onApprove={async (patch) => {
              const updated = await ingredientsApi.approve(detailItem.id, patch)
              setDetailItem({ ...detailItem, ...updated })
              qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
            }}
            onMerge={async (targetId) => {
              const res = await ingredientsApi.merge(detailItem.id, targetId)
              setDetailItem({ ...detailItem, ...res.source })
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

      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
