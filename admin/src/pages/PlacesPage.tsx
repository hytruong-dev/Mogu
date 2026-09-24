import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  adminPlacesApi,
  type AdminPlaceItem,
  type AdminUpdatePlaceDto,
} from '../api/places'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { TableSkeleton } from '../components/ui/page-skeleton'
import { Spinner } from '../components/ui/spinner'
import { Switch } from '../components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

export default function PlacesPage() {
  const [places, setPlaces] = useState<AdminPlaceItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const limit = 15

  // Edit modal state
  const [editTarget, setEditTarget] = useState<AdminPlaceItem | null>(null)
  const [editForm, setEditForm] = useState<AdminUpdatePlaceDto>({
    name: '',
    addressShort: '',
    lat: undefined,
    lng: undefined,
    thumbnailUrl: '',
    isVerified: false,
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminPlaceItem | null>(null)
  const [forceDelete, setForceDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchQ.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchQ])

  const loadPlaces = useCallback(async (p = 1, q = debouncedQ) => {
    setLoading(true)
    try {
      const res = await adminPlacesApi.list({
        q: q || undefined,
        limit,
        offset: (p - 1) * limit,
      })
      setPlaces(res.items ?? [])
      setTotal(res.total ?? 0)
      setPage(p)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [debouncedQ])

  useEffect(() => {
    void loadPlaces(page, debouncedQ)
  }, [loadPlaces, page, debouncedQ])

  const openEdit = (place: AdminPlaceItem) => {
    setEditTarget(place)
    setActionError(null)
    setEditForm({
      name: place.name,
      addressShort: place.addressShort ?? '',
      lat: place.lat ?? undefined,
      lng: place.lng ?? undefined,
      thumbnailUrl: place.thumbnailUrl ?? '',
      isVerified: place.isVerified,
    })
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    if (!editForm.name?.trim()) {
      setActionError('Tên địa điểm không được để trống.')
      return
    }
    setSavingEdit(true)
    setActionError(null)
    try {
      const updated = await adminPlacesApi.update(editTarget.id, {
        name: editForm.name.trim(),
        addressShort: editForm.addressShort?.trim() || undefined,
        lat: editForm.lat,
        lng: editForm.lng,
        thumbnailUrl: editForm.thumbnailUrl?.trim() || undefined,
        isVerified: editForm.isVerified,
      })
      setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setEditTarget(null)
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? e.message ?? 'Lỗi khi cập nhật địa điểm.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setActionError(null)
    try {
      await adminPlacesApi.delete(deleteTarget.id, forceDelete)
      setPlaces((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setTotal((t) => Math.max(0, t - 1))
      setDeleteTarget(null)
      setForceDelete(false)
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? e.message ?? 'Lỗi khi xóa địa điểm.')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MapPin className="text-primary" size={24} />
            Quản lý địa điểm quán ăn (Places)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý danh mục địa điểm, quán ăn được người dùng hoặc hệ thống gắn kèm bài đăng cộng đồng.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold">Danh mục địa điểm</CardTitle>
              <CardDescription className="text-xs">
                Tổng cộng {total} địa điểm trên hệ thống
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên hoặc địa chỉ quán..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs"
                />
                {searchQ && (
                  <button
                    onClick={() => setSearchQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {searchQ && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchQ('')}
                  className="h-8 text-xs gap-1"
                >
                  <RotateCcw size={12} />
                  Đặt lại
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : places.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              Không tìm thấy địa điểm nào phù hợp với bộ lọc tìm kiếm.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-[200px]">Tên địa điểm</TableHead>
                  <TableHead>Địa chỉ ngắn gọn</TableHead>
                  <TableHead className="w-28 text-center">Nguồn tạo</TableHead>
                  <TableHead className="w-28 text-center">Tọa độ GPS</TableHead>
                  <TableHead className="w-24 text-center">Bài đăng</TableHead>
                  <TableHead className="w-24 text-center">Xác thực</TableHead>
                  <TableHead className="w-24 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {places.map((place) => (
                  <TableRow key={place.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {place.thumbnailUrl ? (
                          <img
                            src={place.thumbnailUrl}
                            alt=""
                            className="w-9 h-9 rounded-md object-cover border border-border shrink-0"
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border/60">
                            <MapPin size={16} />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            {place.name}
                            {place.isVerified && (
                              <CheckCircle2 size={13} className="text-emerald-500 fill-emerald-50 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {place.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground max-w-xs line-clamp-2">
                        {place.addressShort || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {place.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {place.lat != null && place.lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-mono"
                          title="Mở trên Google Maps"
                        >
                          {Number(place.lat).toFixed(4)}, {Number(place.lng).toFixed(4)}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-semibold text-foreground flex items-center justify-center gap-1">
                        <FileText size={12} className="text-muted-foreground" />
                        {place.postCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {place.isVerified ? (
                        <Badge variant="success" className="text-[10px]">
                          Đã xác minh
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Chưa duyệt
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => openEdit(place)}
                          title="Sửa địa điểm"
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setDeleteTarget(place)
                            setForceDelete(false)
                            setActionError(null)
                          }}
                          title="Xóa địa điểm"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Trang {page} / {totalPages}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 text-xs gap-1"
                >
                  <ChevronLeft size={13} />
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs gap-1"
                >
                  Sau
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Place Modal */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={16} className="text-blue-500" />
              Chỉnh sửa thông tin địa điểm
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cập nhật tên quán, địa chỉ và tọa độ GPS
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="place-name" className="text-xs font-semibold">
                Tên quán / địa điểm <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="place-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="place-addr" className="text-xs font-semibold">
                Địa chỉ ngắn gọn
              </Label>
              <Input
                id="place-addr"
                value={editForm.addressShort}
                onChange={(e) => setEditForm({ ...editForm, addressShort: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="place-lat" className="text-xs font-semibold">
                  Vĩ độ (Latitude)
                </Label>
                <Input
                  id="place-lat"
                  type="number"
                  step="any"
                  value={editForm.lat ?? ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lat: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place-lng" className="text-xs font-semibold">
                  Kinh độ (Longitude)
                </Label>
                <Input
                  id="place-lng"
                  type="number"
                  step="any"
                  value={editForm.lng ?? ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, lng: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="place-thumb" className="text-xs font-semibold">
                URL ảnh đại diện
              </Label>
              <Input
                id="place-thumb"
                value={editForm.thumbnailUrl}
                onChange={(e) => setEditForm({ ...editForm, thumbnailUrl: e.target.value })}
                className="h-9 text-xs"
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="place-verified" className="text-xs font-semibold cursor-pointer">
                Đánh dấu đã xác thực (Verified)
              </Label>
              <Switch
                checked={!!editForm.isVerified}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isVerified: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Hủy bỏ
            </Button>
            <Button onClick={handleUpdate} disabled={savingEdit} className="text-xs font-semibold">
              {savingEdit ? <Spinner size="sm" className="mr-1.5" /> : null}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle size={18} />
              Xóa địa điểm quán ăn
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bạn có chắc chắn muốn xóa địa điểm <strong>{deleteTarget?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && deleteTarget.postCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2 text-amber-900">
              <p className="font-semibold">
                ⚠️ Địa điểm này hiện đang được gắn kèm với {deleteTarget.postCount} bài đăng cộng đồng.
              </p>
              <label className="flex items-center gap-2 font-medium cursor-pointer text-amber-800">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                Buộc xóa và tự động gỡ địa điểm khỏi tất cả bài đăng
              </label>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || (deleteTarget != null && deleteTarget.postCount > 0 && !forceDelete)}
              className="text-xs font-semibold"
            >
              {deleting ? <Spinner size="sm" className="mr-1.5" /> : null}
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
