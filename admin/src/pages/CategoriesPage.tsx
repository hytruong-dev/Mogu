import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Pencil, Search, Tag, Trash2, Utensils } from 'lucide-react'
import {
  taxonomyAdminApi,
  type Category,
  type CreateCategoryDto,
  type MealType,
  type UpdateCategoryDto,
} from '../api/taxonomy'
import { useFoodDataActions } from '../components/food-data/food-data-context'
import { FoodDataPagination } from '../components/food-data/FoodDataPagination'
import { HideConfirmDialog } from '../components/food-data/HideConfirmDialog'
import { Button } from '../components/ui/button'
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

type ListKind = 'category' | 'meal-type'

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

function TaxonomyFormDialog({
  open,
  kind,
  item,
  onKindChange,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean
  kind: ListKind
  item?: Category | MealType | null
  onKindChange: (kind: ListKind) => void
  onOpenChange: (open: boolean) => void
  onSave: (kind: ListKind, dto: CreateCategoryDto) => Promise<void>
  saving: boolean
}) {
  const isEdit = !!item
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [localSaving, setLocalSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setDescription((item as Category | undefined)?.description ?? '')
    setDisplayOrder(item?.displayOrder ?? 0)
    setIsActive(item?.isActive ?? true)
    setError('')
  }, [open, item])

  const autoCode = isEdit ? item?.code ?? '' : slugify(name)

  const title =
    kind === 'category'
      ? isEdit
        ? 'Sửa danh mục món ăn'
        : 'Thêm danh mục món ăn'
      : isEdit
        ? 'Sửa loại bữa ăn'
        : 'Thêm loại bữa ăn'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!isEdit && (
          <div className="fd-segment" style={{ margin: '0 24px 8px' }}>
            <button type="button" className={kind === 'category' ? 'is-active' : ''} onClick={() => onKindChange('category')}>
              <Tag size={14} /> Danh mục món ăn
            </button>
            <button type="button" className={kind === 'meal-type' ? 'is-active' : ''} onClick={() => onKindChange('meal-type')}>
              <Utensils size={14} /> Loại bữa ăn
            </button>
          </div>
        )}

        <form
          className="fd-modal-body"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return setError('Tên không được trống')
            const code = isEdit ? item!.code : slugify(name)
            if (!code) return setError('Không tạo được mã từ tên')
            setLocalSaving(true)
            setError('')
            try {
              await onSave(kind, {
                code,
                name: name.trim(),
                description: kind === 'category' ? description.slice(0, 255) || undefined : undefined,
                displayOrder: Number(displayOrder) || 0,
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
            <div className="fd-field">
              <label>
                {kind === 'category' ? 'Tên danh mục' : 'Tên loại bữa'} <span className="req">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'category' ? 'Nhập tên danh mục món ăn...' : 'Nhập tên loại bữa ăn...'}
                required
              />
            </div>

            <div className="fd-field">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {kind === 'category' ? 'Mã danh mục' : 'Mã loại bữa'}
                <Info size={13} color="#9ca3af" />
              </label>
              <Input value={autoCode} readOnly className="fd-code-readonly" />
              <p className="fd-field-hint">
                {isEdit
                  ? 'Mã không thể chỉnh sửa sau khi tạo.'
                  : 'Mã tự động tạo từ tên danh mục (không thể chỉnh sửa)'}
              </p>
            </div>

            {kind === 'category' && (
              <div className="fd-field">
                <label>Mô tả</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 255))}
                  placeholder="Nhập mô tả danh mục món ăn..."
                  rows={3}
                />
                <div className="fd-char-count">{description.length}/255</div>
              </div>
            )}

            <div className="fd-field">
              <label>
                Thứ tự hiển thị <span className="req">*</span>
              </label>
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                placeholder="Nhập thứ tự..."
                required
              />
            </div>

            <div className="fd-switch-row">
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Kích hoạt" />
              <div>
                <strong>Kích hoạt</strong>
                <span>Bật để hiển thị {kind === 'category' ? 'danh mục' : 'loại bữa'}.</span>
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
              {saving || localSaving
                ? 'Đang lưu...'
                : isEdit
                  ? 'Lưu thay đổi'
                  : kind === 'category'
                    ? 'Tạo danh mục'
                    : 'Tạo loại bữa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPage({
  embedded = false,
  isActive = true,
}: {
  embedded?: boolean
  isActive?: boolean
}) {
  const qc = useQueryClient()
  const { registerCreateHandler } = useFoodDataActions()
  const [listKind, setListKind] = useState<ListKind>('category')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalKind, setModalKind] = useState<ListKind>('category')
  const [editItem, setEditItem] = useState<Category | MealType | null>(null)
  const [hideItem, setHideItem] = useState<Category | MealType | null>(null)

  const { data: categories = [], isLoading: loadingCat } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: taxonomyAdminApi.listCategories,
  })
  const { data: mealTypes = [], isLoading: loadingMeal } = useQuery({
    queryKey: ['admin-meal-types'],
    queryFn: taxonomyAdminApi.listMealTypes,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-categories'] })
    qc.invalidateQueries({ queryKey: ['admin-meal-types'] })
    qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'categories'] })
  }

  const createCat = useMutation({ mutationFn: taxonomyAdminApi.createCategory, onSuccess: invalidate })
  const updateCat = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) => taxonomyAdminApi.updateCategory(id, dto),
    onSuccess: invalidate,
  })
  const createMeal = useMutation({ mutationFn: taxonomyAdminApi.createMealType, onSuccess: invalidate })
  const updateMeal = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) => taxonomyAdminApi.updateMealType(id, dto),
    onSuccess: invalidate,
  })

  useEffect(() => {
    if (!embedded || !isActive) return
    registerCreateHandler(() => {
      setEditItem(null)
      setModalKind(listKind)
      setModalOpen(true)
    })
    return () => registerCreateHandler(null)
  }, [embedded, isActive, listKind, registerCreateHandler])

  useEffect(() => {
    if (isActive) return
    setModalOpen(false)
    setEditItem(null)
    setHideItem(null)
  }, [isActive])

  const source = listKind === 'category' ? categories : mealTypes
  const filtered = useMemo(() => {
    return source
      .filter((item) => {
        if (status === 'active' && !item.isActive) return false
        if (status === 'inactive' && item.isActive) return false
        if (!q.trim()) return true
        const needle = q.trim().toLowerCase()
        return item.name.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle)
      })
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'vi'))
  }, [source, q, status])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageSafe = Math.min(page, totalPages)
  const pageItems = filtered.slice((pageSafe - 1) * limit, pageSafe * limit)
  const loading = listKind === 'category' ? loadingCat : loadingMeal

  const handleSave = async (kind: ListKind, dto: CreateCategoryDto) => {
    if (editItem) {
      const payload: UpdateCategoryDto = {
        name: dto.name,
        description: dto.description,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
      }
      if (kind === 'category') await updateCat.mutateAsync({ id: editItem.id, dto: payload })
      else await updateMeal.mutateAsync({ id: editItem.id, dto: payload })
    } else if (kind === 'category') {
      await createCat.mutateAsync(dto)
    } else {
      await createMeal.mutateAsync(dto)
    }
  }

  return (
    <div className={embedded ? 'food-data-embedded categories-panel' : undefined} style={{ padding: embedded ? 0 : '28px 32px' }}>
      {!embedded && (
        <div className="fd-panel-heading" style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Danh mục</h1>
        </div>
      )}

      <div className="fd-segment">
        <button type="button" className={listKind === 'category' ? 'is-active' : ''} onClick={() => { setListKind('category'); setPage(1) }}>
          <Tag size={14} /> Danh mục món ăn
        </button>
        <button type="button" className={listKind === 'meal-type' ? 'is-active' : ''} onClick={() => { setListKind('meal-type'); setPage(1) }}>
          <Utensils size={14} /> Loại bữa ăn
        </button>
      </div>

      <h2 className="fd-section-title">
        {listKind === 'category' ? 'Danh sách danh mục' : 'Danh sách loại bữa ăn'}
      </h2>

      <div className="fd-toolbar">
        <div className="fd-search" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder={listKind === 'category' ? 'Tìm theo tên danh mục...' : 'Tìm theo tên loại bữa...'}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="fd-toolbar-filters">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bật</option>
            <option value="inactive">Đã ẩn</option>
          </Select>
        </div>
      </div>

      <div className="fd-table-wrap">
        <table className="fd-table">
          <thead>
            <tr>
              <th>Tên {listKind === 'category' ? 'danh mục' : 'loại bữa'}</th>
              <th>Thứ tự hiển thị</th>
              <th>Kích hoạt</th>
              <th style={{ width: 150 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="fd-empty">Đang tải...</td></tr>
            )}
            {!loading && pageItems.length === 0 && (
              <tr><td colSpan={4} className="fd-empty">Chưa có dữ liệu</td></tr>
            )}
            {pageItems.map((item) => (
              <tr key={item.id} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="fd-cat-icon">
                      {listKind === 'category' ? <Tag size={14} /> : <Utensils size={14} />}
                    </div>
                    <div className="fd-name-cell">
                      <strong>{item.name}</strong>
                      <span>
                        {(item as Category).description || item.code}
                      </span>
                    </div>
                  </div>
                </td>
                <td>{item.displayOrder}</td>
                <td>
                  <span className={`fd-status ${item.isActive ? 'is-on' : 'is-off'}`}>
                    {item.isActive ? 'Bật' : 'Ẩn'}
                  </span>
                </td>
                <td>
                  <div className="fd-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditItem(item)
                        setModalKind(listKind)
                        setModalOpen(true)
                      }}
                    >
                      <Pencil size={13} /> Sửa
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => setHideItem(item)}
                      disabled={!item.isActive}
                    >
                      <Trash2 size={13} /> Xóa
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
        itemLabel={listKind === 'category' ? 'danh mục' : 'loại bữa'}
        onPageChange={setPage}
        onLimitChange={(next) => { setLimit(next); setPage(1) }}
      />

      <TaxonomyFormDialog
        open={modalOpen}
        kind={modalKind}
        item={editItem}
        onKindChange={setModalKind}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setEditItem(null)
        }}
        onSave={handleSave}
        saving={createCat.isPending || updateCat.isPending || createMeal.isPending || updateMeal.isPending}
      />

      <HideConfirmDialog
        open={!!hideItem}
        onOpenChange={(open) => { if (!open) setHideItem(null) }}
        title={listKind === 'category' ? 'Ẩn danh mục này?' : 'Ẩn loại bữa này?'}
        description="Dữ liệu sẽ không bị xóa vĩnh viễn. Các món đã liên kết vẫn giữ lịch sử, nhưng mục này không còn hiển thị công khai."
        itemName={hideItem?.name ?? ''}
        confirmLabel={listKind === 'category' ? 'Ẩn danh mục' : 'Ẩn loại bữa'}
        loading={updateCat.isPending || updateMeal.isPending}
        onConfirm={async () => {
          if (!hideItem) return
          if (listKind === 'category') await updateCat.mutateAsync({ id: hideItem.id, dto: { isActive: false } })
          else await updateMeal.mutateAsync({ id: hideItem.id, dto: { isActive: false } })
          setHideItem(null)
        }}
      />
    </div>
  )
}
