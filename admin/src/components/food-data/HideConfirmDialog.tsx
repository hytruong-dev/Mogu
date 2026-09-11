import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

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
  confirmLabel = 'Ẩn',
  loading,
  onConfirm,
}: HideConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fd-hide-dialog max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="fd-hide-icon">
            <AlertTriangle size={22} />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>

        <div className="fd-hide-item">
          {itemImageUrl ? (
            <img src={itemImageUrl} alt="" />
          ) : (
            <div className="fd-hide-item-placeholder">🌿</div>
          )}
          <strong>{itemName}</strong>
        </div>

        <p className="fd-hide-desc">{description}</p>

        {typeof usageCount === 'number' && usageCount > 0 && (
          <div className="fd-hide-usage">
            Đang được dùng trong <span>{usageCount.toLocaleString('vi-VN')} {usageLabel}</span>
          </div>
        )}

        <DialogFooter className="fd-hide-footer">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Quay lại
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang ẩn...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
