import {
  Archive,
  Bell,
  BookOpen,
  CloudDownload,
  FileText,
  Heart,
  LayoutDashboard,
  Leaf,
  MapPin,
  ScanSearch,
  ShieldCheck,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import type { AdminRole } from '../../providers/AuthProvider'

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  badge?: string
  roles?: AdminRole[]
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      { path: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    ],
  },
  {
    title: 'KHO MÓN & DINH DƯỠNG',
    items: [
      { path: '/foods', label: 'Kho món ăn', icon: Utensils, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] },
      { path: '/food-data', label: 'Dữ liệu món ăn', icon: Leaf, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/ingest', label: 'Nhập món tự động', icon: CloudDownload, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/food-scan-reports', label: 'Món chưa có (Scan)', icon: ScanSearch, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
    ],
  },
  {
    title: 'KHÁM PHÁ & BÀI VIẾT',
    items: [
      { path: '/topics', label: 'Chủ đề', icon: BookOpen, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/articles', label: 'Bài viết', icon: FileText, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/places', label: 'Địa điểm quán ăn', icon: MapPin, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
    ],
  },
  {
    title: 'VẬN HÀNH & KIỂM DUYỆT',
    items: [
      { path: '/review', label: 'Hàng đợi duyệt', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] },
      { path: '/community', label: 'Cộng đồng', icon: Heart, badge: 'Mới', roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/notifications', label: 'Phát thông báo', icon: Bell, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/reports', label: 'Báo cáo vi phạm', icon: Archive, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    title: 'HỆ THỐNG',
    items: [
      { path: '/users', label: 'Người dùng', icon: Users, roles: ['SUPER_ADMIN'] },
    ],
  },
]
