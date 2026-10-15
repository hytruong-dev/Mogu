import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Textarea } from '../ui/textarea'
import type { ReviewReasonCode } from '../../types'
import { REASON_OPTIONS } from './types'

export interface ReviewActionDialogProps {
  title: string
  onConfirm: (reasonCode: ReviewReasonCode, note: string) => void
  onClose: () => void
  isPending: boolean
}

export function ReviewActionDialog({
  title,
  onConfirm,
  onClose,
  isPending,
}: ReviewActionDialogProps) {
  const [reasonCode, setReasonCode] = useState<ReviewReasonCode>('CONTENT_QUALITY')
  const [note, setNote] = useState('')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Chọn lý do và nhập ghi chú hướng dẫn để đội ngũ biên tập điều chỉnh dữ liệu món ăn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Lý do kiểm duyệt *</Label>
            <Select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReviewReasonCode)}
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ghi chú bổ sung (tùy chọn)</Label>
            <Textarea
              placeholder="Nhập ghi chú chi tiết phản hồi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reasonCode, note)}
            disabled={isPending}
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
