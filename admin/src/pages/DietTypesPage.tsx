import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff, Pencil, Search } from 'lucide-react'
import {
  taxonomyAdminApi,
  type CreateCategoryDto,
  type DietType,
  type UpdateCategoryDto,
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
import { Textarea } from '../components/ui/textarea'

function DietTypeFormDialog({
  open,
  item,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean
  item?: DietType | null
  onOpenChange: (open: boolean) => void
  onSave: (dto: CreateCategoryDto) => Promise<void>
  saving: boolean
}) {
  const isEdit = !!item
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [localSaving, setLocalSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(item?.code ?? '')
    setName(item?.name ?? '')
    setDescription(item?.description ?? '')
    setIsActive(item?.isActive ?? true)
    setError('')
  }, [open, item])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa chế độ ăn' : 'Thêm chế độ ăn'}</DialogTitle>
        </DialogHeader>

        <form
          className="fd-modal-body"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!isEdit && !code.trim()) return setError('Mã không được trống')
            if (!name.trim()) return setError('Tên hiển thị không được trống')
            setLocalSaving(true)
            setError('')
            try {
              await onSave({
                code: code.toUpperCase(),
                name: name.trim(),
                description: description.slice(0, 255) || undefined,
                isActive,
              })
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
                  placeholder="HIGH_PROTEIN"
                  required
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
                <p className="fd-field-hint">Mã không thể thay đổi sau khi tạo</p>
              </div>
            )}

            <div className="fd-field">
              <label>
                Tên hiển thị <span className="req">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên hiển thị"
                required
              />
            </div>

            <div className="fd-field">
              <label>Mô tả</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 255))}
                placeholder="Nhập mô tả chế độ ăn (tùy chọn)"
                rows={4}
              />
              <div className="fd-char-count">{description.length}/255</div>
            </div>

            <div className="fd-switch-row">
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Kích hoạt chế độ ăn" />
              <div>
                <strong>Kích hoạt</strong>
                <span>Chế độ ăn sẽ hiển thị và có thể được sử dụng khi được kích hoạt.</span>
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
              {saving || localSaving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo chế độ ăn'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function DietTypesPage({
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
  const [editItem, setEditItem] = useState<DietType | null>(null)
  const [hideItem, setHideItem] = useState<DietType | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-diet-types'],
    queryFn: taxonomyAdminApi.listDietTypes,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-diet-types'] })
    qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'diet-types'] })
  }

  const createMut = useMutation({ mutationFn: taxonomyAdminApi.createDietType, onSuccess: invalidate })
  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) => taxonomyAdminApi.updateDietType(id, dto),
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
    return items.filter((item) => {
      if (status === 'active' && !item.isActive) return false
      if (status === 'inactive' && item.isActive) return false
      if (!q.trim()) return true
      const needle = q.trim().toLowerCase()
      return (
        item.name.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle) ||
        (item.description ?? '').toLowerCase().includes(needle)
      )
    })
  }, [items, q, status])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageSafe = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageSafe - 1) * limit, pageSafe * limit)

  return (
    <div className={embedded ? 'food-data-embedded diet-types-panel' : undefined} style={{ padding: embedded ? 0 : '28px 32px' }}>
      {!embedded && (
        <div className="fd-panel-heading" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Chế độ ăn</h1>
        </div>
      )}

      <h2 className="fd-section-title">Danh sách chế độ ăn</h2>

      <div className="fd-toolbar">
        <div className="fd-search" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="Tìm theo tên, mã..."
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="fd-toolbar-filters">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Kích hoạt</option>
            <option value="inactive">Đã ẩn</option>
          </Select>
        </div>
      </div>

      <div className="fd-table-wrap">
        <table className="fd-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Trạng thái</th>
              <th style={{ width: 150 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} className="fd-empty p-0"><TableSkeleton rows={5} cols={3} /></td></tr>}
            {!isLoading && pageItems.length === 0 && <tr><td colSpan={3} className="fd-empty">Không có chế độ ăn nào</td></tr>}
            {pageItems.map((item) => (
              <tr key={item.id} style={{ cursor: 'default' }}>
                <td>
                  <div className="fd-name-cell">
                    <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{item.code}</strong>
                    <span>{item.name}</span>
                  </div>
                </td>
                <td>
                  <span className={`fd-status ${item.isActive ? 'is-on' : 'is-off'}`}>
                    {item.isActive ? 'Kích hoạt' : 'Đã ẩn'}
                  </span>
                </td>
                <td>
                  <div className="fd-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditItem(item)
                        setModalOpen(true)
                      }}
                    >
                      <Pencil size={13} /> Sửa
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      disabled={!item.isActive}
                      onClick={() => setHideItem(item)}
                    >
                      <EyeOff size={13} /> Ẩn
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FoodDataPagination
        page={pageSafe}
        limit={limit}
        total={total}
        totalPages={totalPages}
        itemLabel="chế độ ăn"
        onPageChange={setPage}
        onLimitChange={(next) => { setLimit(next); setPage(1) }}
      />

      <DietTypeFormDialog
        open={modalOpen}
        item={editItem}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setEditItem(null)
        }}
        onSave={async (dto) => {
          if (editItem) {
            await updateMut.mutateAsync({
              id: editItem.id,
              dto: { name: dto.name, description: dto.description, isActive: dto.isActive },
            })
          } else {
            await createMut.mutateAsync(dto)
          }
        }}
        saving={createMut.isPending || updateMut.isPending}
      />

      <HideConfirmDialog
        open={!!hideItem}
        onOpenChange={(open) => { if (!open) setHideItem(null) }}
        title="Ẩn chế độ ăn này?"
        description="Dữ liệu sẽ không bị xóa vĩnh viễn. Các món và hồ sơ đã liên kết vẫn giữ lịch sử, nhưng chế độ ăn không còn hiển thị công khai."
        itemName={hideItem ? `${hideItem.code} — ${hideItem.name}` : ''}
        confirmLabel="Ẩn chế độ ăn"
        loading={updateMut.isPending}
        onConfirm={async () => {
          if (!hideItem) return
          await updateMut.mutateAsync({ id: hideItem.id, dto: { isActive: false } })
          setHideItem(null)
        }}
      />
    </div>
  )
}
