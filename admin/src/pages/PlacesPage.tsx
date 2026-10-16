import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import { MediaLightbox, useMediaLightbox } from '../components/ui/media-lightbox'
import {
  adminPlacesApi,
  type AdminPlaceItem,
  type AdminPlacesQuery,
  type AdminUpdatePlaceDto,
} from '../api/places'
import { PlaceDishesDialog } from '../components/places/PlaceDishesDialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Card, CardContent } from '../components/ui/card'
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
import { Select } from '../components/ui/select'
import { TableSkeleton } from '../components/ui/page-skeleton'
import { Spinner } from '../components/ui/spinner'
import { Image } from '../components/ui/image'
import { PageContainer } from '../components/layout'
import { ImageUpload } from '../components/ui/image-upload'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Switch } from '../components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const PROVIDER_STYLE: Record<string, string> = {
  SHOPEEFOOD: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200/60',
  OSM: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200/60',
  GOOGLE: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60',
  LOCAL: 'bg-muted text-muted-foreground border-border',
}

const OPEN_STATUS_LABEL: Record<string, { text: string; className: string }> = {
  OPEN: { text: 'Đang mở cửa', className: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
  CLOSED: { text: 'Tạm đóng cửa', className: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200' },
  UNKNOWN: { text: 'Chưa rõ giờ', className: 'text-muted-foreground bg-muted/40 border-border/40' },
}

export default function PlacesPage() {
  const { lightboxProps } = useMediaLightbox()
  const [places, setPlaces] = useState<AdminPlaceItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const limit = 15
  const [providerFilter, setProviderFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState<'' | 'true' | 'false'>('')
  const [dishFilter, setDishFilter] = useState<'' | 'true' | 'false'>('')
  const [dishesTarget, setDishesTarget] = useState<AdminPlaceItem | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  // Edit modal state
  const [editTarget, setEditTarget] = useState<AdminPlaceItem | null>(null)
  const [editForm, setEditForm] = useState<AdminUpdatePlaceDto>({
    name: '',
    addressShort: '',
    lat: undefined,
    lng: undefined,
    thumbnailUrl: '',
    isVerified: false,
    isActive: true,
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
      const params: AdminPlacesQuery = {
        q: q || undefined,
        provider: providerFilter || undefined,
        isVerified: verifiedFilter || undefined,
        hasDishes: dishFilter || undefined,
        limit,
        offset: (p - 1) * limit,
      }
      const res = await adminPlacesApi.list(params)
      setPlaces(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch {
      setPlaces([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, providerFilter, verifiedFilter, dishFilter, limit])

  useEffect(() => {
    void loadPlaces(page, debouncedQ)
  }, [loadPlaces, page, debouncedQ])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const handleQuickVerify = async (place: AdminPlaceItem) => {
    setVerifyingId(place.id)
    try {
      const nextVerified = !place.isVerified
      await adminPlacesApi.update(place.id, { isVerified: nextVerified })
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, isVerified: nextVerified } : p)),
      )
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? e.message ?? 'Cập nhật xác minh thất bại.')
    } finally {
      setVerifyingId(null)
    }
  }

  const openEdit = (place: AdminPlaceItem) => {
    setEditTarget(place)
    setEditForm({
      name: place.name,
      addressShort: place.addressShort ?? '',
      lat: place.lat != null ? Number(place.lat) : undefined,
      lng: place.lng != null ? Number(place.lng) : undefined,
      thumbnailUrl: place.thumbnailUrl ?? '',
      isVerified: !!place.isVerified,
      isActive: place.isActive !== false,
    })
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    setSavingEdit(true)
    try {
      const updated = await adminPlacesApi.update(editTarget.id, editForm)
      setPlaces((prev) => prev.map((p) => (p.id === editTarget.id ? { ...p, ...updated } : p)))
      setEditTarget(null)
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? e.message ?? 'Lưu thay đổi thất bại.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminPlacesApi.delete(deleteTarget.id, forceDelete)
      setPlaces((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setTotal((prev) => Math.max(0, prev - 1))
      setDeleteTarget(null)
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? e.message ?? 'Xóa địa điểm thất bại.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDishCountChange = (placeId: string, count: number) => {
    setPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, dishCount: count } : p)))
  }

  const hasFilters = Boolean(searchQ || providerFilter || verifiedFilter || dishFilter)

  const resetFilters = () => {
    setSearchQ('')
    setDebouncedQ('')
    setProviderFilter('')
    setVerifiedFilter('')
    setDishFilter('')
    setPage(1)
  }

  // Stats calculation
  const stats = useMemo(() => {
    const verifiedCount = places.filter((p) => p.isVerified).length
    const unverifiedCount = places.filter((p) => !p.isVerified).length
    const hasDishesCount = places.filter((p) => p.dishCount > 0).length
    return { verifiedCount, unverifiedCount, hasDishesCount }
  }, [places])

  return (
    <PageContainer className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <MapPin size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Quản lý địa điểm quán ăn (Places)
                <Badge variant="secondary" className="font-mono text-xs font-semibold">
                  {total.toLocaleString('vi-VN')} quán
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quản lý thông tin tọa độ GPS, liên kết thực đơn món ăn và kiểm duyệt nguồn dữ liệu (ShopeeFood, OSM, Google).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Tổng số địa điểm
              </span>
              <div className="text-2xl font-bold text-foreground font-mono">{total.toLocaleString('vi-VN')}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <MapPin size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-emerald-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Đã xác minh (Trang này)
              </span>
              <div className="text-2xl font-bold text-emerald-600 font-mono">{stats.verifiedCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Chờ duyệt (Trang này)
              </span>
              <div className="text-2xl font-bold text-amber-600 font-mono">{stats.unverifiedCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-blue-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Có món liên kết
              </span>
              <div className="text-2xl font-bold text-blue-600 font-mono">{stats.hasDishesCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Utensils size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm tên hoặc địa chỉ quán ăn..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-muted/30 focus-visible:bg-card"
              />
              {searchQ && (
                <button
                  onClick={() => setSearchQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="w-36">
              <Select
                value={providerFilter}
                onChange={(e) => {
                  setProviderFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 text-xs bg-muted/30"
                aria-label="Lọc nguồn"
              >
                <option value="">Mọi nguồn</option>
                <option value="SHOPEEFOOD">ShopeeFood</option>
                <option value="OSM">OpenStreetMap</option>
                <option value="GOOGLE">Google</option>
                <option value="LOCAL">Cộng đồng / Local</option>
              </Select>
            </div>

            <div className="w-36">
              <Select
                value={verifiedFilter}
                onChange={(e) => {
                  setVerifiedFilter(e.target.value as '' | 'true' | 'false')
                  setPage(1)
                }}
                className="h-9 text-xs bg-muted/30"
                aria-label="Lọc xác thực"
              >
                <option value="">Mọi trạng thái</option>
                <option value="false">Chưa duyệt</option>
                <option value="true">Đã xác minh</option>
              </Select>
            </div>

            <div className="w-36">
              <Select
                value={dishFilter}
                onChange={(e) => {
                  setDishFilter(e.target.value as '' | 'true' | 'false')
                  setPage(1)
                }}
                className="h-9 text-xs bg-muted/30"
                aria-label="Lọc món liên kết"
              >
                <option value="">Món: tất cả</option>
                <option value="true">Có món liên kết</option>
                <option value="false">Chưa có món</option>
              </Select>
            </div>

            {hasFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetFilters}
                className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw size={12} />
                Đặt lại
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground font-mono shrink-0">
            Trang {page} / {totalPages}
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={7} cols={8} />
          </div>
        ) : places.length === 0 ? (
          <div className="p-16 text-center text-xs text-muted-foreground space-y-2">
            <MapPin size={36} className="mx-auto text-muted-foreground/30" />
            <p className="font-semibold text-sm">Không tìm thấy địa điểm quán ăn nào phù hợp.</p>
            <p>Thử tìm với từ khóa khác hoặc thiết lập lại bộ lọc.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[240px]">Tên địa điểm & Nhận diện</TableHead>
                <TableHead className="min-w-[220px]">Địa chỉ quán</TableHead>
                <TableHead className="w-28 text-center">Nguồn dữ liệu</TableHead>
                <TableHead className="w-32 text-center">Rating & Giá</TableHead>
                <TableHead className="w-36 text-center">Tọa độ GPS</TableHead>
                <TableHead className="w-24 text-center">Thực đơn</TableHead>
                <TableHead className="w-20 text-center">Bài đăng</TableHead>
                <TableHead className="w-28 text-center">Kiểm duyệt</TableHead>
                <TableHead className="w-32 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {places.map((place) => (
                <TableRow key={place.id} className="hover:bg-muted/30 transition-colors">
                  {/* Name & ID */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2.5">
                      {place.thumbnailUrl ? (
                        <Image
                          src={place.thumbnailUrl}
                          alt={place.name}
                          aspectRatio="square"
                          zoomable
                          title={place.name}
                          subtitle={place.addressShort || 'Địa điểm'}
                          className="w-10 h-10 rounded-lg object-cover border border-border shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border/80">
                          <MapPin size={16} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5 line-clamp-1">
                          <span>{place.name}</span>
                          {place.isVerified && (
                            <CheckCircle2 size={13} className="text-emerald-500 fill-emerald-50 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          ID: {place.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Address */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {place.addressShort || '—'}
                    </span>
                  </TableCell>

                  {/* Provider */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 ${PROVIDER_STYLE[place.provider] ?? ''}`}
                      >
                        {place.provider}
                      </Badge>
                      {place.sourceUrl && (
                        <a
                          href={place.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                        >
                          Nguồn <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </TableCell>

                  {/* Rating & Price */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="text-xs font-semibold flex items-center justify-center gap-1">
                        {place.ratingAvg != null ? (
                          <>
                            <Star size={11} className="text-amber-500 fill-amber-400" />
                            <span>{place.ratingAvg.toFixed(1)}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              ({place.ratingCount ?? 0})
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground font-normal text-xs">—</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {place.priceRange ?? 'Chưa rõ giá'}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${OPEN_STATUS_LABEL[place.openStatus]?.className ?? ''}`}>
                        {OPEN_STATUS_LABEL[place.openStatus]?.text}
                      </span>
                    </div>
                  </TableCell>

                  {/* GPS Coordinates - WCAG Compliant */}
                  <TableCell className="text-center">
                    {place.lat != null && place.lng != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 border border-sky-200/60 px-2 py-1 rounded-md inline-flex items-center gap-1 font-mono transition-colors"
                        title="Mở trên Google Maps"
                      >
                        {Number(place.lat).toFixed(4)}, {Number(place.lng).toFixed(4)}
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </TableCell>

                  {/* Dishes count */}
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => setDishesTarget(place)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-all border border-amber-500/20"
                      title="Xem / sửa món liên kết"
                    >
                      <Utensils size={12} />
                      <span>{place.dishCount} món</span>
                    </button>
                  </TableCell>

                  {/* Posts count */}
                  <TableCell className="text-center">
                    <span className="text-xs font-semibold text-foreground flex items-center justify-center gap-1">
                      <FileText size={12} className="text-muted-foreground" />
                      {place.postCount}
                    </span>
                  </TableCell>

                  {/* Verified badge */}
                  <TableCell className="text-center">
                    {place.isVerified ? (
                      <Badge variant="success" className="text-[10px] font-semibold">
                        Đã xác minh
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        Chưa duyệt
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`h-7 w-7 rounded-md ${
                          place.isVerified
                            ? 'text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                            : 'text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/40'
                        }`}
                        onClick={() => handleQuickVerify(place)}
                        disabled={verifyingId === place.id}
                        title={place.isVerified ? 'Hủy xác minh quán' : 'Duyệt / xác minh quán'}
                      >
                        {verifyingId === place.id ? <Spinner size="sm" /> : <ShieldCheck size={13} />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/40"
                        onClick={() => setDishesTarget(place)}
                        title="Quản lý thực đơn món"
                      >
                        <Utensils size={13} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950/40"
                        onClick={() => openEdit(place)}
                        title="Sửa địa điểm"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/40"
                        onClick={() => {
                          setDeleteTarget(place)
                          setForceDelete(false)
                          setActionError(null)
                        }}
                        title="Xóa địa điểm"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Hiển thị <span className="font-semibold text-foreground font-mono">{places.length}</span> / {total} địa điểm
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft size={14} />
              Trang trước
            </Button>
            <div className="text-xs font-mono text-muted-foreground px-2">
              {page} / {totalPages}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 text-xs gap-1"
            >
              Trang sau
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── MODAL CHỈNH SỬA ĐỊA ĐIỂM (Redesigned) ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20">
                <Pencil size={18} />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Chỉnh sửa thông tin địa điểm
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Cập nhật tên quán ăn, địa chỉ ngắn gọn, tọa độ GPS và thiết lập hiển thị.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="place-name" className="text-xs font-semibold text-foreground">
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
              <Label htmlFor="place-addr" className="text-xs font-semibold text-foreground">
                Địa chỉ ngắn gọn
              </Label>
              <Input
                id="place-addr"
                value={editForm.addressShort}
                onChange={(e) => setEditForm({ ...editForm, addressShort: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-1.5">
                <Label htmlFor="place-lat" className="text-xs font-semibold text-foreground">
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
                  className="h-9 text-xs font-mono bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place-lng" className="text-xs font-semibold text-foreground">
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
                  className="h-9 text-xs font-mono bg-card"
                />
              </div>
            </div>

            {/* Thumbnail Image Upload */}
            <ImageUpload
              value={editForm.thumbnailUrl}
              onChange={(url) => setEditForm({ ...editForm, thumbnailUrl: url })}
              folder="places"
              label="Ảnh đại diện quán ăn"
              aspectRatio="video"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-muted/20">
                <Label className="text-xs font-semibold cursor-pointer">
                  Xác minh (Verified)
                </Label>
                <Switch
                  checked={!!editForm.isVerified}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isVerified: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-muted/20">
                <Label className="text-xs font-semibold cursor-pointer">
                  Đang hoạt động (Gợi ý)
                </Label>
                <Switch
                  checked={editForm.isActive !== false}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={savingEdit} className="h-9 px-4 text-xs">
              Hủy bỏ
            </Button>
            <Button onClick={handleUpdate} disabled={savingEdit} className="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground">
              {savingEdit ? <Spinner size="sm" className="mr-1.5" /> : null}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG XÁC NHẬN XÓA (AlertDialog) ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-2">
              <AlertTriangle size={20} />
            </div>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Xóa địa điểm quán ăn?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa địa điểm <strong className="text-foreground">"{deleteTarget?.name}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteTarget && deleteTarget.postCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-900">
              <p className="font-semibold">Địa điểm này đang được gắn với {deleteTarget.postCount} bài đăng cộng đồng.</p>
              <label className="flex items-center gap-2 font-medium cursor-pointer text-amber-800">
                <Checkbox checked={forceDelete} onCheckedChange={(checked) => setForceDelete(!!checked)} />
                <span>Buộc xóa và tự động gỡ địa điểm khỏi tất cả bài đăng</span>
              </label>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel disabled={deleting} className="text-xs h-9">
              Hủy bỏ
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || (deleteTarget != null && deleteTarget.postCount > 0 && !forceDelete)}
              className="text-xs h-9 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? 'Đang xóa…' : 'Xác nhận xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlaceDishesDialog
        place={dishesTarget}
        onClose={() => setDishesTarget(null)}
        onCountChange={handleDishCountChange}
      />

      <MediaLightbox {...lightboxProps} />
    </PageContainer>
  )
}
