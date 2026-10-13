import { useCallback, useEffect, useState } from 'react'
import { Link2, Plus, Search, Trash2, Utensils } from 'lucide-react'
import {
  adminPlacesApi,
  type AdminPlaceDishItem,
  type AdminPlaceItem,
  type PlaceDishMatchStatus,
} from '../../api/places'
import { dishesApi } from '../../api/dishes'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'

const STATUS_OPTIONS: { value: PlaceDishMatchStatus; label: string }[] = [
  { value: 'CONFIRMED', label: 'Xác nhận' },
  { value: 'LIKELY', label: 'Có thể' },
  { value: 'REJECTED', label: 'Loại bỏ' },
]

const STATUS_BADGE: Record<PlaceDishMatchStatus, 'success' | 'warning' | 'destructive'> = {
  CONFIRMED: 'success',
  LIKELY: 'warning',
  REJECTED: 'destructive',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <Dialog open={!!place} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils size={16} className="text-primary" />
            Món bán tại quán
          </DialogTitle>
          <DialogDescription className="text-xs">
            {place?.name} — duyệt kết quả match tự động (pg_trgm) hoặc gắn món thủ công. Chỉ liên kết
            khác "Loại bỏ" mới được dùng cho random theo vị trí.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <div className="max-h-[360px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {loading && items.length === 0 ? (
            <div className="p-6 flex justify-center">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Chưa có món nào được liên kết.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                    {it.dishName}
                    <Badge variant={STATUS_BADGE[it.matchStatus]} className="text-[10px] px-1.5 py-0">
                      {STATUS_OPTIONS.find((s) => s.value === it.matchStatus)?.label}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {it.sourceItemName ? `Menu: "${it.sourceItemName}"` : 'Match theo tên quán / thủ công'}
                    {' · '}
                    {formatVnd(it.priceVnd)}
                    {it.matchScore != null && ` · điểm ${it.matchScore.toFixed(2)}`}
                  </div>
                </div>
                <select
                  value={it.matchStatus}
                  disabled={busyDishId === it.dishId}
                  onChange={(e) => mutate(it.dishId, { matchStatus: e.target.value as PlaceDishMatchStatus })}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                  disabled={busyDishId === it.dishId}
                  onClick={() => mutate(it.dishId, { remove: true })}
                  title="Xóa liên kết"
                >
                  {busyDishId === it.dishId ? <Spinner size="sm" /> : <Trash2 size={12} />}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <Link2 size={13} /> Gắn thêm món
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={dishQ}
              onChange={(e) => setDishQ(e.target.value)}
              placeholder="Tìm món đã xuất bản (vd: bún bò huế)..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          {(searching || dishResults.length > 0) && (
            <div className="border border-border rounded-md divide-y divide-border max-h-44 overflow-y-auto">
              {searching && (
                <div className="p-2 flex justify-center">
                  <Spinner size="sm" />
                </div>
              )}
              {dishResults.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span>{d.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] gap-1"
                    disabled={linkedIds.has(d.id) || busyDishId === d.id}
                    onClick={() => mutate(d.id, { matchStatus: 'CONFIRMED' })}
                  >
                    <Plus size={11} />
                    {linkedIds.has(d.id) ? 'Đã gắn' : 'Gắn'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
