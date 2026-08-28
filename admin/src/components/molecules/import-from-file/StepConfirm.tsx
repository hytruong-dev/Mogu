import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  Image,
  Leaf,
  Link2,
  RotateCcw,
  Utensils,
  XCircle,
} from 'lucide-react'
import type { ErrorPolicy, ImportOptions, NewIngredientPolicy, PostStatus } from './types'
import { YellowCheck, YellowRadio, YellowSwitch } from './widgets'

interface Props {
  options: ImportOptions
  onChange: (patch: Partial<ImportOptions>) => void
  fileName: string
}

const STATS = [
  { value: 243, label: 'Món đủ điều kiện sẽ được nhập', icon: CheckCircle2, color: 'text-[#16A34A]', bg: 'bg-[#ECFDF3]' },
  { value: 231, label: 'Hợp lệ sẽ được nhập', icon: CheckCircle2, color: 'text-[#16A34A]', bg: 'bg-[#ECFDF3]' },
  { value: 12, label: 'Cảnh báo vẫn sẽ được nhập', icon: AlertTriangle, color: 'text-[#EA580C]', bg: 'bg-[#FFF7ED]' },
  { value: 7, label: 'Bị loại trừ không được nhập', icon: XCircle, color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]' },
  { value: 5, label: 'Trùng dữ liệu bỏ qua', icon: Link2, color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]' },
]

export function StepConfirm({ options, onChange, fileName }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2.5">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl border border-black/10 px-3 py-3">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-xl font-extrabold leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-[#6B7280]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.3fr_0.9fr] gap-4">
        <div className="space-y-3 rounded-xl border border-black/10 p-4">
          <p className="text-sm font-semibold">Tùy chọn nhập</p>

          <OptionRow icon={FileSpreadsheet} title="Trạng thái sau khi nhập">
            <YellowRadio
              checked={options.postStatus === 'draft'}
              onChange={() => onChange({ postStatus: 'draft' as PostStatus })}
              title="Tạo bản nháp"
              hint="Dữ liệu sẽ được lưu ở trạng thái nháp để bạn kiểm tra trước."
            />
            <YellowRadio
              checked={options.postStatus === 'review'}
              onChange={() => onChange({ postStatus: 'review' as PostStatus })}
              title="Gửi kiểm duyệt tự động"
              hint="Chuyển thẳng vào hàng đợi kiểm duyệt."
            />
          </OptionRow>

          <OptionRow icon={Image} title="Hình ảnh từ URL">
            <YellowSwitch
              checked={options.downloadImages}
              onChange={(v) => onChange({ downloadImages: v })}
              label="Tải về Supabase Storage"
            />
            <p className="mb-2 text-xs text-[#6B7280]">Tải ảnh về và lưu vào Supabase Storage.</p>
            <YellowCheck
              checked={options.keepUrlOnFail}
              onChange={(v) => onChange({ keepUrlOnFail: v })}
              label="Giữ URL gốc nếu tải thất bại"
            />
          </OptionRow>

          <OptionRow icon={Database} title="Nguồn tham khảo">
            <YellowCheck
              checked={options.createDishSource}
              onChange={(v) => onChange({ createDishSource: v })}
              label="Tạo bản ghi DishSource"
            />
          </OptionRow>

          <OptionRow icon={Leaf} title="Nguyên liệu mới">
            <YellowRadio
              checked={options.newIngredientPolicy === 'create'}
              onChange={() => onChange({ newIngredientPolicy: 'create' as NewIngredientPolicy })}
              title="Tạo mới ở trạng thái chờ chuẩn hóa"
            />
            <YellowRadio
              checked={options.newIngredientPolicy === 'skip'}
              onChange={() => onChange({ newIngredientPolicy: 'skip' as NewIngredientPolicy })}
              title="Bỏ qua nguyên liệu chưa có"
            />
          </OptionRow>

          <OptionRow icon={RotateCcw} title="Xử lý lỗi hệ thống">
            <YellowRadio
              checked={options.errorPolicy === 'rollback'}
              onChange={() => onChange({ errorPolicy: 'rollback' as ErrorPolicy })}
              title="Rollback toàn bộ batch"
              hint="Nếu lỗi, hoàn tác toàn bộ lô nhập."
            />
            <YellowRadio
              checked={options.errorPolicy === 'keep'}
              onChange={() => onChange({ errorPolicy: 'keep' as ErrorPolicy })}
              title="Giữ các dòng đã thành công"
            />
          </OptionRow>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-black/10 p-4">
            <p className="mb-3 text-sm font-semibold">Ước tính khi nhập</p>
            <ul className="space-y-2.5 text-sm">
              <Est icon={Utensils} color="text-[#2563EB]" label="Món ăn (bản nháp)" value="~243" />
              <Est icon={Leaf} color="text-[#16A34A]" label="Mối quan hệ nguyên liệu" value="~1,420" />
              <Est icon={FileSpreadsheet} color="text-[#16A34A]" label="Hồ sơ dinh dưỡng" value="~243" />
              <Est icon={Image} color="text-[#EA580C]" label="Hình ảnh" value="~730" />
            </ul>
            <p className="mt-3 flex items-start gap-2 text-[11px] text-[#6B7280]">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Thời gian ước tính: Tùy thuộc vào kích thước file và tốc độ mạng.
            </p>
          </div>

          <div className="rounded-xl border border-black/10 p-4 text-sm">
            <p className="mb-3 font-semibold">Thông tin lô nhập</p>
            <dl className="space-y-2 text-[13px]">
              <Row k="Batch ID" v="#BATCH-2026-0812" />
              <Row k="File" v={fileName} />
              <Row k="Kích thước" v="2.45 MB" />
              <Row k="Người tạo" v="Admin Mogu" />
              <Row k="Thời gian" v="12/08/2026 10:24" />
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

function OptionRow({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileSpreadsheet
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-black/5 pt-3 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#6B7280]" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="space-y-2 pl-6">{children}</div>
    </div>
  )
}

function Est({ icon: Icon, color, label, value }: { icon: typeof Utensils; color: string; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[#4B5563]">
        <Icon className={`h-4 w-4 ${color}`} />
        {label}
      </span>
      <b>{value}</b>
    </li>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#6B7280]">{k}</dt>
      <dd className="max-w-[160px] truncate text-right font-medium">{v}</dd>
    </div>
  )
}
