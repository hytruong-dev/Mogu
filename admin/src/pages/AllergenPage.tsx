import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Search, Trash2 } from 'lucide-react'
import {
  taxonomyAdminApi,
  type Allergen,
  type CreateAllergenDto,
  type UpdateAllergenDto,
} from '../api/taxonomy'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

function AllergenFormDialog({
  open,
  item,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean
  item?: Allergen | null
  onOpenChange: (open: boolean) => void
  onSave: (dto: CreateAllergenDto | UpdateAllergenDto) => Promise<void>
  saving: boolean
}) {
  const isEdit = !!item
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState(1)
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')
  const [localSaving, setLocalSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(item?.code ?? '')
    setName(item?.name ?? '')
    setDescription(item?.description ?? '')
    setDisplayOrder(item?.displayOrder ?? 1)
    setActive(item?.active ?? true)
    setError('')
  }, [open, item])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa nhóm dị ứng' : 'Thêm nhóm dị ứng'}</DialogTitle>
        </DialogHeader>

        <form
          className="fd-modal-body"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!isEdit && !code.trim()) return setError('Mã không được trống')
            if (!name.trim()) return setError('Tên nhóm không được trống')
            setLocalSaving(true)
            setError('')
            try {
              if (isEdit) {
                await onSave({
                  name: name.trim(),
                  description: description.trim() || undefined,
                  displayOrder: Number(displayOrder) || 0,
                  active,
                })
              } else {
                await onSave({
                  code: code.toUpperCase(),
                  name: name.trim(),
                  description: description.trim() || undefined,
                  displayOrder: Number(displayOrder) || 0,
                  active,
                })
              }
              onOpenChange(false)
            } catch (err: any) {
              setError(
                err?.response?.data?.message ??
                  err?.response?.data?.error?.message ??
                  err?.message ??
                  'Lỗi không xác định',
              )
            } finally {
              setLocalSaving(false)
            }
          }}
        >
          <div className="fd-form-grid">
            {!isEdit && (
              <div className="fd-field">
                <label>
                  Mã <span className="req">*</span>
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  placeholder="PEANUT"
                  required
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
                <p className="fd-field-hint">Mã viết hoa, không dấu và không khoảng trắng</p>
              </div>
            )}

            <div className="fd-field">
              <label>
                Tên nhóm <span className="req">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên nhóm dị ứng"
                required
              />
              <p className="fd-field-hint">Tên đầy đủ, dễ hiểu cho nhóm dị ứng.</p>
            </div>

            <div className="fd-field">
              <label>Ví dụ nguyên liệu</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập ví dụ nguyên liệu"
              />
              <p className="fd-field-hint">Các nguyên liệu thường thuộc nhóm này, cách nhau bởi dấu phẩy.</p>
            </div>

            <div className="fd-field">
              <label>Thứ tự hiển thị</label>
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
              />
              <p className="fd-field-hint">Số nhỏ hiển thị trước.</p>
            </div>

            <div className="fd-switch-row">
              <Switch checked={active} onCheckedChange={setActive} aria-label="Hiển thị nhóm dị ứng" />
              <div>
                <strong>Hiển thị</strong>
                <span>Ẩn nhóm nếu tắt.</span>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="fd-modal-footer">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || localSaving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving || localSaving}>
              {saving || localSaving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo nhóm dị ứng'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AllergenPage({
  embedded = false,
  isActive = true,
}: {
  embedded?: boolean
  isActive?: boolean
}) {
  const qc = useQueryClient()
  const { registerCreateHandler } = useFoodDataActions()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Allergen | null>(null)
  const [hideItem, setHideItem] = useState<Allergen | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-allergens'],
    queryFn: taxonomyAdminApi.listAllergens,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-allergens'] })
    qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'allergens'] })
  }

  const createMut = useMutation({ mutationFn: taxonomyAdminApi.createAllergen, onSuccess: invalidate })
  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAllergenDto }) => taxonomyAdminApi.updateAllergen(id, dto),
    onSuccess: invalidate,
  })
  const toggleMut = useMutation({
    mutationFn: taxonomyAdminApi.toggleAllergen,
    onSuccess: invalidate,
  })

  useEffect(() => {
    if (!embedded || !isActive) return
    registerCreateHandler(() => {
      setEditItem(null)
      setModalOpen(true)
    })
    return () => registerCreateHandler(null)
  }, [embedded, isActive, registerCreateHandler])

  useEffect(() => {
    if (isActive) return
    setModalOpen(false)
    setEditItem(null)
    setHideItem(null)
  }, [isActive])

  const filtered = useMemo(() => {
    return items
      .filter((item) => {
        if (status === 'active' && !item.active) return false
        if (status === 'inactive' && item.active) return false
        if (!q.trim()) return true
        const needle = q.trim().toLowerCase()
        return (
          item.name.toLowerCase().includes(needle) ||
          item.code.toLowerCase().includes(needle) ||
          (item.description ?? '').toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code))
  }, [items, q, status])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageSafe = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageSafe - 1) * limit, pageSafe * limit)

  return (
    <div className={embedded ? 'food-data-embedded allergens-panel' : undefined} style={{ padding: embedded ? 0 : '28px 32px' }}>
      {!embedded && (
        <div className="fd-panel-heading" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Dị ứng</h1>
        </div>
      )}

      <h2 className="fd-section-title">Danh sách nhóm dị ứng</h2>

      <div className="fd-toolbar">
        <div className="fd-search" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="Tìm theo tên nhóm..."
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="fd-toolbar-filters">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hiển thị</option>
            <option value="inactive">Đã ẩn</option>
          </Select>
        </div>
      </div>

      <div className="fd-table-wrap">
        <Table className="fd-table">
          <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead>Tên nhóm</TableHead><TableHead>Hiển thị</TableHead><TableHead style={{ width: 120 }}>Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="fd-empty p-0"><TableSkeleton rows={5} cols={4} /></TableCell></TableRow>}
            {!isLoading && pageItems.length === 0 && <TableRow><TableCell colSpan={4} className="fd-empty">Không có dị ứng nào</TableCell></TableRow>}
            {pageItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell><code className="fd-code">{item.code}</code></TableCell>
                <TableCell><div className="fd-name-cell"><strong>{item.name}</strong>{item.description && <span>{item.description}</span>}</div></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}><Switch checked={item.active} onCheckedChange={() => toggleMut.mutate(item.id)} aria-label={`Hiển thị ${item.name}`} /></TableCell>
                <TableCell><div className="fd-row-actions">
                  <Button variant="outline" size="icon" title="Sửa" onClick={() => { setEditItem(item); setModalOpen(true) }}><Pencil size={14} /></Button>
                  <Button variant="destructive" size="icon" title="Ẩn" disabled={!item.active} onClick={() => setHideItem(item)}><Trash2 size={14} /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FoodDataPagination
        page={pageSafe}
        limit={limit}
        total={total}
        totalPages={totalPages}
        itemLabel="nhóm dị ứng"
        onPageChange={setPage}
        onLimitChange={(next) => { setLimit(next); setPage(1) }}
      />

      <AllergenFormDialog
        open={modalOpen}
        item={editItem}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setEditItem(null)
        }}
        onSave={async (dto) => {
          if (editItem) await updateMut.mutateAsync({ id: editItem.id, dto: dto as UpdateAllergenDto })
          else await createMut.mutateAsync(dto as CreateAllergenDto)
        }}
        saving={createMut.isPending || updateMut.isPending}
      />

      <HideConfirmDialog
        open={!!hideItem}
        onOpenChange={(open) => { if (!open) setHideItem(null) }}
        title="Ẩn nhóm dị ứng này?"
        description="Dữ liệu sẽ không bị xóa vĩnh viễn. Hồ sơ người dùng và món đã liên kết vẫn giữ lịch sử, nhưng nhóm không còn hiển thị trong onboarding."
        itemName={hideItem ? `${hideItem.code} — ${hideItem.name}` : ''}
        confirmLabel="Ẩn nhóm dị ứng"
        loading={toggleMut.isPending}
        onConfirm={() => {
          if (!hideItem) return
          toggleMut.mutate(hideItem.id, {
            onSuccess: () => setHideItem(null),
          })
        }}
      />
    </div>
  )
}
