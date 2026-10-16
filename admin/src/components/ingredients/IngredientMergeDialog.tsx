import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitMerge, Search, Utensils } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Image } from '../ui/image'
import { ingredientsApi, type Ingredient } from '../../api/ingredients'

interface IngredientMergeDialogProps {
  sourceItem: Ingredient | null
  onClose: () => void
  onMerge: (targetId: string) => Promise<void>
}

export function IngredientMergeDialog({
  sourceItem,
  onClose,
  onMerge,
}: IngredientMergeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [targetItem, setTargetItem] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const q = searchQuery.trim()
  const { data, isFetching } = useQuery({
    queryKey: ['ingredient-merge-targets', q],
    queryFn: () => ingredientsApi.adminList({ q, status: 'ACTIVE', limit: 8, page: 1 }),
    enabled: q.length >= 1 && !targetItem,
  })

  const searchResults = (data?.data ?? []).filter((x) => x.id !== sourceItem?.id)

  const handleConfirmMerge = async () => {
    if (!targetItem) return
    setBusy(true)
    setError('')
    try {
      await onMerge(targetItem.id)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Gộp nguyên liệu thất bại')
    } finally {
      setBusy(false)
    }
  }

  if (!sourceItem) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-white shadow-2xl border border-slate-200">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <GitMerge size={17} />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Gộp nguyên liệu trùng lặp
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Nguyên liệu nguồn <b>"{sourceItem.name}"</b> sẽ được gộp vào nguyên liệu đích.
            Tất cả các món ăn đang sử dụng nguyên liệu này sẽ tự động chuyển sang nguyên liệu đích.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tìm nguyên liệu đích (ACTIVE)
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setTargetItem(null)
                }}
                placeholder="Nhập tên nguyên liệu đích cần gộp vào..."
                className="pl-8 h-9 text-xs"
              />
            </div>

            {targetItem && (
              <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                <span>Đã chọn đích: <b>{targetItem.name}</b></span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTargetItem(null)}
                  className="h-6 text-xs text-emerald-700 hover:text-emerald-900 p-0"
                >
                  Thay đổi
                </Button>
              </div>
            )}

            {!targetItem && q.length >= 1 && (
              <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                {isFetching && <div className="p-3 text-center text-slate-400">Đang tìm kiếm...</div>}
                {!isFetching && searchResults.length === 0 && (
                  <div className="p-3 text-center text-slate-400">Không tìm thấy nguyên liệu phù hợp</div>
                )}
                {searchResults.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setTargetItem({ id: x.id, name: x.name })
                      setSearchQuery(x.name)
                    }}
                    className="w-full p-2 flex items-center gap-2.5 text-left hover:bg-amber-50/60 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    {x.imageUrl ? (
                      <Image
                        src={x.imageUrl}
                        alt={x.name}
                        aspectRatio="square"
                        className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <Utensils size={13} className="text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{x.name}</div>
                      {x.code && <div className="text-[10px] text-slate-400 font-mono">{x.code}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy} className="text-xs">
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!targetItem || busy}
            onClick={handleConfirmMerge}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5"
          >
            {busy ? 'Đang gộp...' : 'Xác nhận gộp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
