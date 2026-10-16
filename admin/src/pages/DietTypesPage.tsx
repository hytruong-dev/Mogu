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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

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
          className="space-y-4 pt-2"
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
          <div className="space-y-3.5">
            {!isEdit && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mã <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  placeholder="HIGH_PROTEIN"
                  required
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[11px] text-slate-500">Mã không thể thay đổi sau khi tạo</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tên hiển thị <span className="text-rose-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên hiển thị"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mô tả</label>
                <span className="text-[11px] text-slate-400">{description.length}/255</span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 255))}
                placeholder="Nhập mô tả chế độ ăn (tùy chọn)"
                rows={3}
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="space-y-0.5">
                <strong className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Kích hoạt</strong>
                <span className="text-[11px] text-slate-500">Chế độ ăn sẽ hiển thị và có thể được sử dụng khi được kích hoạt.</span>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Kích hoạt chế độ ăn" />
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
    <div className={embedded ? 'p-0' : 'p-6 sm:p-8'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Chế độ ăn</h1>
        </div>
      )}

      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2 mb-3">Danh sách chế độ ăn</h2>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="Tìm theo tên, mã..."
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }} className="h-9 text-xs w-40">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Kích hoạt</option>
            <option value="inactive">Đã ẩn</option>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50/70">
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Mã</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Tên hiển thị</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Trạng thái</TableHead>
              <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-right pr-6" style={{ width: 160 }}>Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="p-0"><TableSkeleton rows={5} cols={4} /></TableCell></TableRow>}
            {!isLoading && pageItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-xs text-slate-500">Không có chế độ ăn nào</TableCell></TableRow>}
            {pageItems.map((item) => (
              <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <TableCell><code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200">{item.code}</code></TableCell>
                <TableCell>
                  <div className="flex flex-col min-w-0">
                    <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">{item.name}</strong>
                    {item.description && <span className="text-[11px] text-slate-500 truncate max-w-sm">{item.description}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    item.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {item.isActive ? 'Kích hoạt' : 'Đã ẩn'}
                  </span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => { setEditItem(item); setModalOpen(true) }} className="h-8 px-2.5 text-xs font-medium gap-1">
                      <Pencil size={12} /> Sửa
                    </Button>
                    <Button variant="destructive" size="sm" disabled={!item.isActive} onClick={() => setHideItem(item)} className="h-8 px-2.5 text-xs font-medium gap-1">
                      <EyeOff size={12} /> Ẩn
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
