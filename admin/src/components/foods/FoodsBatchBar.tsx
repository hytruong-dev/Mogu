import { CheckSquare, Trash2, Globe, Archive, X } from 'lucide-react'
import { Button } from '../ui/button'

interface FoodsBatchBarProps {
  selectedCount: number
  onClear: () => void
  onBatchPublish: () => void
  onBatchArchive: () => void
  onBatchDelete: () => void
  isSuperAdmin: boolean
}

export function FoodsBatchBar({
  selectedCount,
  onClear,
  onBatchPublish,
  onBatchArchive,
  onBatchDelete,
  isSuperAdmin,
}: FoodsBatchBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700 text-xs font-semibold">
        <CheckSquare size={16} className="text-amber-400" />
        <span>Đã chọn <b className="text-amber-400">{selectedCount}</b> món</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onBatchPublish}
          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
        >
          <Globe size={13} />
          Xuất bản
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={onBatchArchive}
          className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
        >
          <Archive size={13} />
          Lưu trữ
        </Button>

        {isSuperAdmin && (
          <Button
            type="button"
            size="sm"
            onClick={onBatchDelete}
            className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
          >
            <Trash2 size={13} />
            Xóa vĩnh viễn
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 px-2.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 gap-1"
        >
          <X size={13} />
          Bỏ chọn
        </Button>
      </div>
    </div>
  )
}
