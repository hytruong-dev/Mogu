import { AlertTriangle, Leaf } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Image } from '../ui/image'

interface HideConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  itemName: string
  itemImageUrl?: string | null
  usageCount?: number
  usageLabel?: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
}

export function HideConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  itemImageUrl,
  usageCount,
  usageLabel = 'món',
  confirmLabel = 'Ẩn mục này',
  loading,
  onConfirm,
}: HideConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle size={24} />
          </div>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 my-2">
          {itemImageUrl ? (
            <Image src={itemImageUrl} alt={itemName} aspectRatio="square" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Leaf size={18} className="text-emerald-500" />
            </div>
          )}
          <span className="font-semibold text-sm text-foreground truncate">{itemName}</span>
        </div>

        {typeof usageCount === 'number' && usageCount > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            Đang được liên kết trong <strong className="font-bold">{usageCount.toLocaleString('vi-VN')} {usageLabel}</strong>. Thao tác này sẽ làm ẩn mục khỏi ứng dụng khách.
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="flex-1">
            Quay lại
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading} className="flex-1">
            {loading ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
