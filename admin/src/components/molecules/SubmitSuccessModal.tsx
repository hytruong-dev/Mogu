import { ArrowLeft, Check, Info, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'

interface SubmitSuccessModalProps {
  open: boolean
  dishName: string
  dishId: string
  sentAt: string
  team: string
  onCloseToFoods: () => void
  onViewStatus: () => void
  onCreateAnother: () => void
}

export function SubmitSuccessModal({
  open,
  dishName,
  dishId,
  sentAt,
  team,
  onCloseToFoods,
  onViewStatus,
  onCreateAnother,
}: SubmitSuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCloseToFoods() }}>
      <DialogContent className="max-w-lg rounded-3xl p-8 shadow-2xl">
        <DialogHeader className="items-center text-center sm:text-center p-0">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ok-green-bg shadow-[0_0_0_12px_rgba(34,197,94,0.15)]">
              <Check className="h-8 w-8 text-ok-green" strokeWidth={3} />
            </div>
          </div>
          <DialogTitle className="mt-5 text-2xl font-extrabold text-foreground">
            Đã gửi món ăn để kiểm duyệt
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            {dishName || 'Món ăn'} đã được chuyển đến hàng đợi kiểm duyệt. Bạn vẫn có thể theo dõi trạng thái và xem phản hồi.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 divide-y divide-border rounded-xl border border-border px-4">
          <div className="flex justify-between py-3 text-sm">
            <span className="text-muted-foreground">Mã món</span>
            <span className="font-semibold text-foreground">{dishId}</span>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <span className="text-muted-foreground">Trạng thái</span>
            <Badge variant="warning">Chờ duyệt</Badge>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <span className="text-muted-foreground">Gửi lúc</span>
            <span className="font-medium text-foreground">{sentAt}</span>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <span className="text-muted-foreground">Nhóm</span>
            <span className="font-medium text-foreground">{team}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-ok-green-bg px-3.5 py-2.5 text-sm text-ok-green">
          <Info className="h-4 w-4 shrink-0" />
          <span>Bạn sẽ nhận thông báo khi món được duyệt hoặc cần chỉnh sửa.</span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCloseToFoods}
            className="flex-1 h-12 rounded-xl font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Về Kho món ăn
          </Button>
          <Button
            type="button"
            onClick={onViewStatus}
            className="flex-1 h-12 rounded-xl text-sm font-bold"
          >
            Xem trạng thái kiểm duyệt
          </Button>
        </div>

        <Button
          type="button"
          variant="link"
          onClick={onCreateAnother}
          className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Tạo thêm món mới
        </Button>
      </DialogContent>
    </Dialog>
  )
}
