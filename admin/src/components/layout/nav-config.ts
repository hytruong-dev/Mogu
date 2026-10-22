import {
  Bell,
  BookOpen,
  CloudDownload,
  FileText,
  LayoutDashboard,
  Leaf,
  MapPin,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import type { AdminRole } from '../../providers/AuthProvider'

export type NavItem = {
  path: string
  label: string
  /** Short description used by the command palette */
  description: string
  icon: LucideIcon
  roles?: AdminRole[]
  /** Dynamic badge source resolved by the sidebar */
  counter?: 'review' | 'scan'
  /** Extra search keywords for the command palette */
  keywords?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

const CONTENT: AdminRole[] = ['SUPER_ADMIN', 'CONTENT_ADMIN']
const CONTENT_AND_REVIEW: AdminRole[] = ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER']
const SUPER: AdminRole[] = ['SUPER_ADMIN']

export const navGroups: NavGroup[] = [
  {
    title: 'Tổng quan',
    items: [
      { path: '/dashboard', label: 'Bảng điều khiển', description: 'Chỉ số chính, việc cần làm và hoạt động gần đây', icon: LayoutDashboard, keywords: 'dashboard home tong quan' },
      { path: '/reports', label: 'Báo cáo', description: 'Phân tích hiệu suất và mức độ tương tác', icon: TrendingUp, roles: SUPER, keywords: 'report analytics thong ke' },
    ],
  },
  {
    title: 'Nội dung món ăn',
    items: [
      { path: '/foods', label: 'Kho món ăn', description: 'Danh sách món, dinh dưỡng và trạng thái xuất bản', icon: Utensils, roles: CONTENT_AND_REVIEW, keywords: 'foods dishes mon an' },
      { path: '/food-data', label: 'Nguyên liệu & phân loại', description: 'Nguyên liệu, danh mục, chế độ ăn, dị ứng', icon: Leaf, roles: CONTENT, keywords: 'ingredients category diet allergen nguyen lieu' },
      { path: '/ingest', label: 'Nhập món bằng AI', description: 'Thu thập và chuẩn hóa món tự động', icon: CloudDownload, roles: CONTENT, keywords: 'ingest import ai crawl' },
      { path: '/food-scan-reports', label: 'Món quét chưa có', description: 'Ảnh người dùng quét mà kho chưa có món', icon: ScanSearch, roles: CONTENT, counter: 'scan', keywords: 'scan quet anh' },
    ],
  },
  {
    title: 'Kiểm duyệt',
    items: [
      { path: '/review', label: 'Duyệt món', description: 'Hàng đợi món mới hoặc chỉnh sửa chờ duyệt', icon: ShieldCheck, roles: CONTENT_AND_REVIEW, counter: 'review', keywords: 'review queue duyet' },
      { path: '/community', label: 'Cộng đồng', description: 'Bài đăng, bình luận và báo cáo vi phạm', icon: MessagesSquare, roles: CONTENT, keywords: 'community moderation cong dong' },
    ],
  },
  {
    title: 'Khám phá',
    items: [
      { path: '/topics', label: 'Chủ đề', description: 'Chuyên mục khám phá ẩm thực', icon: BookOpen, roles: CONTENT, keywords: 'topics chu de' },
      { path: '/articles', label: 'Bài viết', description: 'Soạn thảo và xuất bản bài viết', icon: FileText, roles: CONTENT, keywords: 'articles bai viet blog' },
      { path: '/places', label: 'Quán ăn', description: 'Địa điểm quán ăn gợi ý theo món', icon: MapPin, roles: CONTENT, keywords: 'places quan an dia diem map' },
      { path: '/notifications', label: 'Thông báo', description: 'Gửi thông báo đẩy tới người dùng', icon: Bell, roles: CONTENT, keywords: 'notifications push thong bao broadcast' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { path: '/users', label: 'Người dùng app', description: 'Tài khoản người dùng và thói quen sử dụng', icon: Users, roles: SUPER, keywords: 'users nguoi dung habit thoi quen' },
      { path: '/admin-users', label: 'Quản trị viên', description: 'Tài khoản nhân sự và phân quyền', icon: UserCog, roles: SUPER, keywords: 'admin staff role phan quyen' },
    ],
  },
]

export function isNavItemActive(currentPath: string, itemPath: string) {
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

/** Resolve the nav item + group for a pathname (used by breadcrumbs). */
export function resolveNav(pathname: string) {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (isNavItemActive(pathname, item.path)) return { group, item }
    }
  }
  return null
}
