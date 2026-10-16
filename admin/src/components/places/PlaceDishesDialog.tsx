import { useCallback, useEffect, useState } from 'react'
import { Check, CheckCircle2, Link2, Plus, Search, Trash2, Utensils, X } from 'lucide-react'
import {
  adminPlacesApi,
  type AdminPlaceDishItem,
  type AdminPlaceItem,
  type PlaceDishMatchStatus,
} from '../../api/places'
import { dishesApi } from '../../api/dishes'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Spinner } from '../ui/spinner'
import { Skeleton } from '../ui/skeleton'
import { EmptyState } from '../ui/empty-state'

const STATUS_OPTIONS: { value: PlaceDishMatchStatus; label: string }[] = [
  { value: 'CONFIRMED', label: 'Xác nhận' },
  { value: 'LIKELY', label: 'Có thể' },
  { value: 'REJECTED', label: 'Loại bỏ' },
]

const STATUS_CONFIG: Record<PlaceDishMatchStatus, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  CONFIRMED: { label: 'Đã xác nhận', variant: 'success' },
  LIKELY: { label: 'Có thể đúng', variant: 'warning' },
  REJECTED: { label: 'Bị loại bỏ', variant: 'destructive' },
}

function formatVnd(v: number | null) {
  if (v == null) return '—'
  return `${v.toLocaleString('vi-VN')}đ`
}

interface Props {
  place: AdminPlaceItem | null
  onClose: () => void
  /** Called with the new number of non-removed links after changes. */
  onCountChange?: (placeId: string, count: number) => void
}

export function PlaceDishesDialog({ place, onClose, onCountChange }: Props) {
  const [items, setItems] = useState<AdminPlaceDishItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyDishId, setBusyDishId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [dishQ, setDishQ] = useState('')
  const [dishResults, setDishResults] = useState<{ id: string; name: string }[]>([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    if (!place) return
    setLoading(true)
    setError(null)
    try {
      const res = await adminPlacesApi.listDishes(place.id)
      setItems(res.items ?? [])
      onCountChange?.(place.id, res.items?.length ?? 0)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Không tải được danh sách món.')
    } finally {
      setLoading(false)
    }
  }, [place, onCountChange])

  useEffect(() => {
    setItems([])
    setDishQ('')
    setDishResults([])
    if (place) void load()
  }, [place?.id])

  // Debounced dish search for adding a link manually
  useEffect(() => {
    const q = dishQ.trim()
    if (!place || q.length < 2) {
      setDishResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await dishesApi.list({ q, status: 'PUBLISHED', limit: 8 })
        setDishResults((res.data ?? []).map((d) => ({ id: d.id, name: d.name })))
      } catch {
        setDishResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [dishQ, place])

  const mutate = async (dishId: string, body: { matchStatus?: PlaceDishMatchStatus; remove?: boolean }) => {
    if (!place) return
    setBusyDishId(dishId)
    setError(null)
    try {
      await adminPlacesApi.updateDish(place.id, { dishId, ...body })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Cập nhật liên kết thất bại.')
    } finally {
      setBusyDishId(null)
    }
  }

  const linkedIds = new Set(items.map((i) => i.dishId))
  const confirmedCount = items.filter((i) => i.matchStatus === 'CONFIRMED').length

  return (
    <Dialog open={!!place} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Utensils size={18} />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>Món bán tại quán</span>
                  <Badge variant="secondary" className="font-mono text-xs font-semibold">
                    {items.length} món
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {place?.name} — {place?.addressShort || 'Quản lý thực đơn và độ khớp AI'}
                </DialogDescription>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Đã duyệt: {confirmedCount}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Quick Search & Attach Section */}
          <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
            <div className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link2 size={14} className="text-primary" />
                Gắn thêm món ăn vào quán
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Gõ từ khóa để tìm trong kho món đã xuất bản
              </span>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={dishQ}
                onChange={(e) => setDishQ(e.target.value)}
                placeholder="Tìm món đã xuất bản (VD: bún bò, cơm tấm, phở tái)..."
                className="h-9 pl-9 pr-8 text-xs bg-card"
              />
              {dishQ && (
                <button
                  onClick={() => setDishQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Live Search Results */}
            {(searching || dishResults.length > 0) && (
              <div className="border border-border/80 rounded-xl divide-y divide-border bg-card shadow-xs overflow-hidden max-h-44 overflow-y-auto">
                {searching && (
                  <div className="p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Spinner size="sm" />
                    <span>Đang tìm kiếm món ăn...</span>
                  </div>
                )}
                {!searching && dishResults.length === 0 && (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Không tìm thấy món ăn phù hợp với từ khóa "{dishQ}"
                  </div>
                )}
                {dishResults.map((d) => {
                  const isLinked = linkedIds.has(d.id)
                  const isBusy = busyDishId === d.id
                  return (
                    <div key={d.id} className="flex items-center justify-between px-3.5 py-2 text-xs hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Utensils size={13} className="text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground truncate">{d.name}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={isLinked ? 'outline' : 'default'}
                        className={`h-7 px-2.5 text-xs gap-1 ${
                          isLinked
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                            : 'bg-primary text-primary-foreground'
                        }`}
                        disabled={isLinked || isBusy}
                        onClick={() => mutate(d.id, { matchStatus: 'CONFIRMED' })}
                      >
                        {isBusy ? (
                          <Spinner size="sm" />
                        ) : isLinked ? (
                          <>
                            <Check size={12} /> Đã liên kết
                          </>
                        ) : (
                          <>
                            <Plus size={12} /> Gắn món
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Linked Dishes List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground px-1">
              <span>Danh sách món đang liên kết ({items.length})</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Chỉ trạng thái "Xác nhận" và "Có thể" mới hiển thị cho người dùng
              </span>
            </div>

            <div className="border border-border/80 rounded-xl divide-y divide-border bg-card shadow-xs overflow-hidden">
              {loading && items.length === 0 ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center gap-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="h-3 w-1/2 rounded" />
                      </div>
                      <Skeleton className="h-8 w-28 rounded-md shrink-0" />
                      <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={Utensils}
                  title="Chưa có món nào được liên kết với quán này"
                  description="Dùng ô tìm kiếm bên trên để tìm và gắn món ăn từ kho món Mogu."
                  className="py-8 border-0"
                />
              ) : (
                items.map((it) => {
                  const statusConf = STATUS_CONFIG[it.matchStatus] ?? STATUS_CONFIG.LIKELY
                  const isBusy = busyDishId === it.dishId
                  return (
                    <div key={it.id} className="flex items-center gap-3 p-3.5 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <Utensils size={15} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground flex items-center gap-2">
                          <span className="truncate">{it.dishName}</span>
                          <Badge variant={statusConf.variant} className="text-[10px] px-1.5 py-0 shrink-0 font-medium">
                            {statusConf.label}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {it.sourceItemName ? `Menu: "${it.sourceItemName}"` : 'Liên kết thủ công / pg_trgm'}
                          {' • '}
                          <span className="font-semibold text-foreground/80 font-mono">{formatVnd(it.priceVnd)}</span>
                          {it.matchScore != null && (
                            <span className="font-mono text-muted-foreground/70"> • khớp {(it.matchScore * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </div>

                      {/* Status select */}
                      <div className="w-32 shrink-0">
                        <Select
                          value={it.matchStatus}
                          disabled={isBusy}
                          onChange={(e) => mutate(it.dishId, { matchStatus: e.target.value as PlaceDishMatchStatus })}
                          className="h-8 text-xs bg-muted/40"
                          aria-label={`Trạng thái match của ${it.dishName}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {/* Remove button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg shrink-0"
                        disabled={isBusy}
                        onClick={() => mutate(it.dishId, { remove: true })}
                        title="Xóa liên kết món này"
                        aria-label="Xóa liên kết món"
                      >
                        {isBusy ? <Spinner size="sm" /> : <Trash2 size={13} />}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Tổng cộng: <strong className="text-foreground font-mono">{items.length}</strong> món liên kết
          </div>
          <Button variant="outline" onClick={onClose} className="h-9 px-4 text-xs font-semibold">
            Đóng cửa sổ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
