import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CloudDownload,
  FileText,
  Heart,
  LayoutDashboard,
  Leaf,
  MapPin,
  Plus,
  ScanSearch,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react'
import { Dialog, DialogContent } from '../ui/dialog'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'

export function CommandPaletteModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const quickNavItems = [
    { path: '/dashboard', label: 'Tổng quan điều hành', category: 'TỔNG QUAN', icon: LayoutDashboard, desc: 'Chỉ số thống kê, biểu đồ hoạt động và nhiệm vụ' },
    { path: '/foods', label: 'Kho món ăn', category: 'KHO MÓN & DINH DƯỠNG', icon: Utensils, desc: 'Quản lý toàn bộ danh sách món ăn, calo và dinh dưỡng' },
    { path: '/foods/new', label: 'Thêm món ăn mới', category: 'KHO MÓN & DINH DƯỠNG', icon: Plus, desc: 'Nhập công thức, nguyên liệu và macro món ăn' },
    { path: '/food-data', label: 'Dữ liệu món ăn', category: 'KHO MÓN & DINH DƯỠNG', icon: Leaf, desc: 'Quản lý nguyên liệu, danh mục và taxonomy ẩm thực' },
    { path: '/ingest', label: 'Nhập món tự động (AI)', category: 'KHO MÓN & DINH DƯỠNG', icon: CloudDownload, desc: 'Crawl dữ liệu, trích xuất AI và kiểm duyệt hàng loạt' },
    { path: '/topics', label: 'Quản lý chủ đề', category: 'KHÁM PHÁ & BÀI VIẾT', icon: BookOpen, desc: 'Các chuyên mục khám phá ẩm thực theo mùa và chủ đề' },
    { path: '/articles', label: 'Quản lý bài viết', category: 'KHÁM PHÁ & BÀI VIẾT', icon: FileText, desc: 'Soạn thảo, biên tập và xuất bản bài viết ẩm thực' },
    { path: '/food-scan-reports', label: 'Món chưa có (Scan)', category: 'KHO MÓN & DINH DƯỠNG', icon: ScanSearch, desc: 'Ảnh người dùng quét mà kho món chưa có, cần bổ sung' },
    { path: '/places', label: 'Địa điểm quán ăn', category: 'KHÁM PHÁ & BÀI VIẾT', icon: MapPin, desc: 'Bản đồ, địa điểm quán ăn gợi ý theo món' },
    { path: '/review', label: 'Hàng đợi duyệt món', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: ShieldCheck, desc: 'Duyệt các món ăn mới tạo hoặc chỉnh sửa' },
    { path: '/community', label: 'Quản lý cộng đồng', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: Heart, desc: 'Bài viết chia sẻ, thảo luận và tương tác thành viên' },
    { path: '/notifications', label: 'Phát thông báo', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: Bell, desc: 'Gửi broadcast push notification tới người dùng' },
    { path: '/reports', label: 'Báo cáo & Phân tích', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: TrendingUp, desc: 'Thống kê hiệu suất, mức độ gắn kết và phân tích dữ liệu' },
    { path: '/users', label: 'Quản lý người dùng', category: 'HỆ THỐNG', icon: Users, desc: 'Phân quyền, tài khoản và lịch sử thao tác hệ thống' },
  ]

  const filtered = quickNavItems.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    )
  })

  // Reset search when modal closes
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-xl border border-border shadow-2xl bg-card text-card-foreground">
        <div className="flex items-center px-4 border-b border-border/70 h-13">
          <Search size={17} className="text-muted-foreground mr-3 flex-shrink-0" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm trang, chức năng hoặc thao tác nhanh..."
            className="w-full bg-transparent border-none shadow-none outline-none focus-visible:ring-0 text-sm text-foreground placeholder:text-muted-foreground h-12"
          />
          <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border">
            ESC
          </Badge>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả phù hợp cho "{search}"
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    navigate(item.path)
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-amber-500/10 transition-colors group cursor-pointer border-none bg-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-amber-500/20 group-hover:text-amber-500 transition-colors flex-shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{item.desc}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 flex-shrink-0 ml-2">
                    {item.category.split(' ')[0]}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-t border-border text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>↑↓ để xem</span>
            <span>•</span>
            <span>↵ để mở trang</span>
          </div>
          <div className="flex items-center gap-1 font-medium text-muted-foreground">
            NOAN Cloud Studio
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
