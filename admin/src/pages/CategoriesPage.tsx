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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'

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
          <div style={{ margin: '0 24px 8px' }}>
            <Tabs value={kind} onValueChange={(val) => onKindChange(val as ListKind)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="category" className="gap-2 text-xs">
                  <Tag size={14} /> Danh mục món ăn
                </TabsTrigger>
                <TabsTrigger value="meal-type" className="gap-2 text-xs">
                  <Utensils size={14} /> Loại bữa ăn
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        <form
          className="space-y-4 pt-2"
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
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {kind === 'category' ? 'Tên danh mục' : 'Tên loại bữa'} <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'category' ? 'Nhập tên danh mục món ăn...' : 'Nhập tên loại bữa ăn...'}
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                {kind === 'category' ? 'Mã danh mục' : 'Mã loại bữa'}
                <Info size={13} className="text-slate-400" />
              </label>
              <Input value={autoCode} readOnly className="h-9 text-xs bg-slate-50 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-400" />
              <p className="text-[11px] text-slate-500">
                {isEdit
                  ? 'Mã không thể chỉnh sửa sau khi tạo.'
                  : 'Mã tự động tạo từ tên danh mục (không thể chỉnh sửa)'}
              </p>
            </div>

            {kind === 'category' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mô tả</label>
                  <span className="text-[11px] text-slate-400">{description.length}/255</span>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 255))}
                  placeholder="Nhập mô tả danh mục món ăn..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Thứ tự hiển thị <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                placeholder="Nhập thứ tự..."
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="space-y-0.5">
                <strong className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Kích hoạt</strong>
                <span className="text-[11px] text-slate-500">Bật để hiển thị {kind === 'category' ? 'danh mục' : 'loại bữa'}.</span>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Kích hoạt" />
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 rounded-lg p-2.5 text-xs border border-rose-200">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving || localSaving} className="text-xs h-9">
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={saving || localSaving} className="text-xs h-9 font-semibold bg-amber-500 hover:bg-amber-600 text-white">
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
    <div className={embedded ? 'p-0' : 'p-6 sm:p-8'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Danh mục</h1>
        </div>
      )}

      <div className="mb-4">
        <Tabs value={listKind} onValueChange={(val) => { setListKind(val as ListKind); setPage(1) }}>
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="category" className="gap-2 text-xs">
              <Tag size={14} /> Danh mục món ăn
            </TabsTrigger>
            <TabsTrigger value="meal-type" className="gap-2 text-xs">
              <Utensils size={14} /> Loại bữa ăn
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2 mb-3">
        {listKind === 'category' ? 'Danh sách danh mục' : 'Danh sách loại bữa ăn'}
      </h2>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder={listKind === 'category' ? 'Tìm theo tên danh mục...' : 'Tìm theo tên loại bữa...'}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }} className="h-9 text-xs w-40">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bật</option>
            <option value="inactive">Đã ẩn</option>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50/70">
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Tên {listKind === 'category' ? 'danh mục' : 'loại bữa'}</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Thứ tự hiển thị</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Kích hoạt</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-right pr-6" style={{ width: 160 }}>Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="p-0"><TableSkeleton rows={5} cols={4} /></TableCell></TableRow>}
            {!loading && pageItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">Chưa có dữ liệu</TableCell></TableRow>}
            {pageItems.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-800/60">
                      {listKind === 'category' ? <Tag size={15} /> : <Utensils size={15} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">{item.name}</strong>
                      <span className="text-[11px] text-slate-500 truncate max-w-sm">{(item as Category).description || item.code}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">{item.displayOrder}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    item.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {item.isActive ? 'Đang bật' : 'Đã ẩn'}
                  </span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => { setEditItem(item); setModalKind(listKind); setModalOpen(true) }} className="h-8 px-2.5 text-xs font-medium gap-1">
                      <Pencil size={12} /> Sửa
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setHideItem(item)} disabled={!item.isActive} className="h-8 px-2.5 text-xs font-medium gap-1">
                      <Trash2 size={12} /> Xóa
                    </Button>
                  </div>
                </TableCell>
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
