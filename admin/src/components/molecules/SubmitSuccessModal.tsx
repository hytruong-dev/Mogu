import { ArrowLeft, Check, Info, Plus } from 'lucide-react'

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
  open, dishName, dishId, sentAt, team, onCloseToFoods, onViewStatus, onCreateAnother,
}: SubmitSuccessModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ok-green-bg shadow-[0_0_0_12px_rgba(34,197,94,0.15)]">
            <Check className="h-8 w-8 text-ok-green" strokeWidth={3} />
          </div>
        </div>
        <h2 className="mt-5 text-center text-2xl font-extrabold">Đã gửi món ăn để kiểm duyệt</h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          {dishName || 'Món ăn'} đã được chuyển đến hàng đợi kiểm duyệt. Bạn vẫn có thể theo dõi trạng thái và xem phản hồi.
        </p>
        <div className="mt-6 divide-y divide-black/5 rounded-xl border border-black/10 px-4">
          <div className="flex justify-between py-3 text-sm"><span className="text-gray-500">Mã món</span><span className="font-semibold">{dishId}</span></div>
          <div className="flex justify-between py-3 text-sm">
            <span className="text-gray-500">Trạng thái</span>
            <span className="rounded-full bg-mogu-yellow-light px-2.5 py-0.5 text-xs font-semibold text-mogu-yellow-dark">Chờ duyệt</span>
          </div>
          <div className="flex justify-between py-3 text-sm"><span className="text-gray-500">Gửi lúc</span><span className="font-medium">{sentAt}</span></div>
          <div className="flex justify-between py-3 text-sm"><span className="text-gray-500">Nhóm</span><span className="font-medium">{team}</span></div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-ok-green-bg px-3 py-2.5 text-sm text-ok-green">
          <Info className="h-4 w-4" /> Bạn sẽ nhận thông báo khi món được duyệt hoặc cần chỉnh sửa.
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCloseToFoods} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 font-semibold">
            <ArrowLeft className="h-4 w-4" /> Về Kho món ăn
          </button>
          <button type="button" onClick={onViewStatus} className="h-12 flex-1 rounded-xl bg-mogu-yellow text-sm font-bold">
            Xem trạng thái kiểm duyệt
          </button>
        </div>
        <button type="button" onClick={onCreateAnother} className="mt-4 flex w-full items-center justify-center gap-1 text-sm font-semibold text-blue-600">
          <Plus className="h-4 w-4" /> Tạo thêm món mới
        </button>
      </div>
    </div>
  )
}
