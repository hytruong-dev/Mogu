import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Spinner } from '../components/ui/spinner'
import { TableSkeleton } from '../components/ui/page-skeleton'
import {
  moderationAdminApi,
  type AdminCommentItem,
  type AdminPostItem,
  type ModerationReportItem,
  type ResolveAction,
} from '../api/moderation'

function StatCard({
  icon: Icon,
  value,
  label,
  tone = 'yellow',
  note,
}: {
  icon: typeof FileText
  value: string
  label: string
  tone?: 'yellow' | 'green' | 'red' | 'blue'
  note?: string
}) {
  return (
    <Card className="stat-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={26} />
      </div>
      <div>
        <b>{value}</b>
        <p>{label}</p>
        {note ? <small className="note">{note}</small> : null}
      </div>
    </Card>
  )
}

const TARGET_FILTERS = [
  { value: '', label: 'Tất cả đối tượng' },
  { value: 'COMMUNITY_POST', label: 'Bài đăng cộng đồng' },
  { value: 'COMMENT', label: 'Bình luận' },
  { value: 'USER', label: 'Tài khoản người dùng' },
]

const REASON_FILTERS = [
  { value: '', label: 'Tất cả lý do' },
  { value: 'SPAM', label: 'Spam hoặc quảng cáo' },
  { value: 'HARASSMENT', label: 'Quấy rối / Công kích' },
  { value: 'HATE', label: 'Nội dung thù ghét' },
  { value: 'VIOLENCE', label: 'Bạo lực' },
  { value: 'NUDITY', label: 'Nội dung nhạy cảm' },
  { value: 'MISINFORMATION', label: 'Thông tin sai lệch' },
  { value: 'OTHER', label: 'Khác' },
]

interface ActionConfig {
  action: ResolveAction
  label: string
  desc: string
  icon: typeof CheckCircle2
  tone: 'safe' | 'warn' | 'danger'
  danger?: boolean
}

const MOD_ACTIONS: ActionConfig[] = [
  {
    action: 'DISMISS',
    label: 'Bỏ qua báo cáo',
    desc: 'Nội dung hợp lệ, không vi phạm chính sách cộng đồng',
    icon: CheckCircle2,
    tone: 'safe',
  },
  {
    action: 'HIDE_CONTENT',
    label: 'Ẩn nội dung',
    desc: 'Tạm ẩn khỏi bảng tin công khai, có thể khôi phục sau',
    icon: EyeOff,
    tone: 'warn',
  },
  {
    action: 'WARN_USER',
    label: 'Cảnh cáo tác giả',
    desc: 'Gửi cảnh báo và ghi nhận vi phạm vào lịch sử tài khoản',
    icon: AlertTriangle,
    tone: 'warn',
  },
  {
    action: 'DELETE_CONTENT',
    label: 'Xóa vĩnh viễn',
    desc: 'Đánh dấu DELETED, gỡ bỏ hoàn toàn khỏi hệ thống',
    icon: Trash2,
    tone: 'danger',
    danger: true,
  },
  {
    action: 'RESTRICT_USER',
    label: 'Đình chỉ tài khoản',
    desc: 'Tạm khóa tài khoản do vi phạm nghiêm trọng (POLICY_SUSPENSION)',
    icon: Ban,
    tone: 'danger',
    danger: true,
  },
]

function relativeTime(iso: string) {
  if (!iso) return 'Vừa xong'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function CommunityPage() {
  const [tab, setTab] = useState<'reports' | 'posts' | 'comments'>('reports')
  const [stats, setStats] = useState<{
    open: number
    pending: number
    highPriority: number
    handledRatePercent: number
    newToday: number
  } | null>(null)

  const [reports, setReports] = useState<ModerationReportItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<(ModerationReportItem & { relatedReports?: any[] }) | null>(null)
  const [targetType, setTargetType] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [searchFilter, setSearchFilter] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  // Action confirmation modal state
  const [confirmAction, setConfirmAction] = useState<ActionConfig | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Posts tab state
  const [posts, setPosts] = useState<AdminPostItem[]>([])
  const [postQ, setPostQ] = useState('')
  const [postStatus, setPostStatus] = useState('')
  const [postsLoading, setPostsLoading] = useState(false)
  const [postToDelete, setPostToDelete] = useState<string | null>(null)

  // Comments tab state
  const [comments, setComments] = useState<AdminCommentItem[]>([])
  const [commentType, setCommentType] = useState<'all' | 'article' | 'post'>('all')
  const [commentSearch, setCommentSearch] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentActingId, setCommentActingId] = useState<string | null>(null)
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const s = await moderationAdminApi.stats()
      setStats(s)
    } catch {
      /* ignore */
    }
  }, [])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await moderationAdminApi.listReports({
        status: statusFilter || undefined,
        targetType: targetType || undefined,
        reasonCode: reasonCode || undefined,
        limit: 50,
      })
      const items = res.data ?? []
      setReports(items)
      if (items.length) {
        const keep = selectedId && items.some((r) => r.id === selectedId) ? selectedId : items[0].id
        setSelectedId(keep)
      } else {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Không tải được danh sách báo cáo')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, targetType, reasonCode, selectedId])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await moderationAdminApi.getReport(id)
      setDetail(d as any)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Không tải được chi tiết báo cáo')
    }
  }, [])

  const loadPosts = useCallback(async () => {
    setPostsLoading(true)
    try {
      const res = await moderationAdminApi.listPosts({
        q: postQ || undefined,
        status: postStatus || undefined,
        limit: 50,
      })
      setPosts(res.data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Không tải được bài đăng')
    } finally {
      setPostsLoading(false)
    }
  }, [postQ, postStatus])

  const loadComments = useCallback(async () => {
    setCommentsLoading(true)
    try {
      const res = await moderationAdminApi.listComments({
        type: commentType,
        search: commentSearch || undefined,
        limit: 50,
      })
      setComments(res.items ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Không tải được danh sách bình luận')
    } finally {
      setCommentsLoading(false)
    }
  }, [commentType, commentSearch])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    if (tab === 'reports') void loadReports()
  }, [tab, statusFilter, targetType, reasonCode])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  useEffect(() => {
    if (tab === 'posts') void loadPosts()
  }, [tab, loadPosts])

  useEffect(() => {
    if (tab === 'comments') void loadComments()
  }, [tab, loadComments])

  const handleToggleHideComment = async (id: string) => {
    setCommentActingId(id)
    try {
      const updated = await moderationAdminApi.hideComment(id)
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isHidden: updated.isHidden, content: updated.content } : c)),
      )
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e.message ?? 'Không thao tác được bình luận')
    } finally {
      setCommentActingId(null)
    }
  }

  const handleDeleteComment = async () => {
    if (!commentToDelete) return
    setCommentActingId(commentToDelete)
    try {
      await moderationAdminApi.deleteComment(commentToDelete)
      setComments((prev) => prev.filter((c) => c.id !== commentToDelete))
      setCommentToDelete(null)
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e.message ?? 'Không thể xóa bình luận')
    } finally {
      setCommentActingId(null)
    }
  }

  const onResolve = async (action: ResolveAction) => {
    if (!selectedId) return
    setActing(true)
    try {
      await moderationAdminApi.resolveReport(selectedId, { action, note: note || undefined })
      setNote('')
      setConfirmAction(null)
      await Promise.all([loadStats(), loadReports()])
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e.message ?? 'Không xử lý được báo cáo')
    } finally {
      setActing(false)
    }
  }

  const handleActionClick = (cfg: ActionConfig) => {
    if (cfg.danger) {
      setConfirmAction(cfg)
    } else {
      void onResolve(cfg.action)
    }
  }

  // Filter reports locally by search keyword
  const filteredReports = useMemo(() => {
    if (!searchFilter.trim()) return reports
    const q = searchFilter.toLowerCase()
    return reports.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.preview?.content?.toLowerCase().includes(q) ||
        r.preview?.author?.displayName?.toLowerCase().includes(q) ||
        r.reporter?.displayName?.toLowerCase().includes(q) ||
        r.reasonLabel.toLowerCase().includes(q),
    )
  }, [reports, searchFilter])

  const renderTargetBadge = (type: string) => {
    switch (type) {
      case 'COMMUNITY_POST':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <FileText size={12} />
            Bài đăng
          </span>
        )
      case 'COMMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <MessageSquare size={12} />
            Bình luận
          </span>
        )
      case 'USER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <UserIcon size={12} />
            Người dùng
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-700">
            {type}
          </span>
        )
    }
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="warning">Chờ xử lý</Badge>
      case 'REVIEWING':
        return <Badge variant="info">Đang xem xét</Badge>
      case 'RESOLVED':
        return <Badge variant="success">Đã giải quyết</Badge>
      case 'REJECTED':
        return <Badge variant="secondary">Bác bỏ</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderPostStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Hoạt động</Badge>
      case 'HIDDEN':
        return <Badge variant="warning">Đã ẩn</Badge>
      case 'DELETED':
        return <Badge variant="destructive">Đã xóa</Badge>
      case 'DRAFT':
        return <Badge variant="secondary">Bản nháp</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="mod-page-container">
      {/* ── Page Heading & Top Switcher ── */}
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-3">
            Kiểm duyệt cộng đồng
            {stats && stats.pending > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                <ShieldAlert size={13} />
                {stats.pending} chờ xử lý
              </span>
            ) : null}
          </h1>
          <p>Bảo đảm không gian thảo luận Mogu luôn an toàn, hữu ích và tuân thủ tiêu chuẩn cộng đồng</p>
        </div>

        <div className="mod-tab-switch">
          <button
            className={`mod-tab-btn ${tab === 'reports' ? 'active' : ''}`}
            onClick={() => setTab('reports')}
          >
            <Flag size={15} />
            Báo cáo vi phạm
            {stats && stats.pending > 0 ? (
              <span className="mod-tab-badge bg-rose-500 text-white">{stats.pending}</span>
            ) : null}
          </button>
          <button
            className={`mod-tab-btn ${tab === 'posts' ? 'active' : ''}`}
            onClick={() => setTab('posts')}
          >
            <FileText size={15} />
            Quản lý bài đăng
          </button>
          <button
            className={`mod-tab-btn ${tab === 'comments' ? 'active' : ''}`}
            onClick={() => setTab('comments')}
          >
            <MessageSquare size={15} />
            Kiểm duyệt bình luận
          </button>
        </div>
      </div>

      {/* ── Overview Statistics Cards ── */}
      <div className="stats-grid">
        <StatCard
          icon={FileText}
          value={String(stats?.newToday ?? '0')}
          label="báo cáo mới hôm nay"
          tone="yellow"
        />
        <StatCard
          icon={Clock3}
          value={String(stats?.pending ?? '0')}
          label="đang chờ xử lý"
          tone={stats && stats.pending > 0 ? 'yellow' : 'blue'}
        />
        <StatCard
          icon={Flag}
          value={String(stats?.highPriority ?? '0')}
          label="báo cáo ưu tiên cao"
          tone={stats && stats.highPriority > 0 ? 'red' : 'yellow'}
        />
        <StatCard
          icon={CheckCircle2}
          value={stats ? `${stats.handledRatePercent}%` : '100%'}
          label="tỷ lệ xử lý trong ngày"
          tone="green"
        />
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      ) : null}

      {/* ── Main Tab 1: Moderation Queue & Resolution Workspace ── */}
      {tab === 'reports' ? (
        <>
          {/* Top Horizontal Filter Toolbar */}
          <div className="mod-toolbar">
            <div className="mod-toolbar-left">
              {/* Status Segmented Control */}
              <div className="mod-status-pills">
                {[
                  { key: 'OPEN', label: 'Chờ xử lý' },
                  { key: 'REVIEWING', label: 'Đang xem' },
                  { key: 'RESOLVED', label: 'Đã giải quyết' },
                  { key: 'REJECTED', label: 'Bác bỏ' },
                  { key: '', label: 'Tất cả' },
                ].map((s) => (
                  <button
                    key={s.key || 'all'}
                    className={`mod-status-pill ${statusFilter === s.key ? 'active' : ''}`}
                    onClick={() => setStatusFilter(s.key)}
                  >
                    {s.label}
                    {s.key === 'OPEN' && stats && stats.pending > 0 ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Target Type Filter */}
              <select
                className="mod-filter-select"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              >
                {TARGET_FILTERS.map((f) => (
                  <option key={f.value || 'all-target'} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Violation Reason Filter */}
              <select
                className="mod-filter-select"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
              >
                {REASON_FILTERS.map((r) => (
                  <option key={r.value || 'all-reason'} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              {(targetType || reasonCode || statusFilter !== 'OPEN') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTargetType('')
                    setReasonCode('')
                    setStatusFilter('OPEN')
                    setSearchFilter('')
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground h-9"
                >
                  <RotateCcw size={13} className="mr-1" />
                  Xóa bộ lọc
                </Button>
              )}
            </div>

            <div className="mod-toolbar-right">
              {/* Search within queue */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm theo nội dung, người dùng..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-9 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-48 transition-all focus:w-64"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadReports()}
                disabled={loading}
                className="h-9 gap-1.5"
              >
                <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
                Làm mới
              </Button>
            </div>
          </div>

          {/* Master-Detail Grid */}
          <div className="mod-workspace">
            {/* ── Left Queue (List of reports) ── */}
            <div className="mod-queue-panel">
              <div className="mod-queue-header">
                <h3>
                  <Flag size={16} className="text-amber-600" />
                  Hàng đợi báo cáo
                </h3>
                <Badge variant="secondary" className="font-mono text-xs">
                  {filteredReports.length} mục
                </Badge>
              </div>

              <div className="mod-queue-list">
                {loading ? (
                  <TableSkeleton rows={5} />
                ) : filteredReports.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck size={28} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-800">Không có báo cáo nào</p>
                      <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
                        Tất cả nội dung trong mục này đều an toàn hoặc đã được xử lý xong.
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredReports.map((r) => {
                    const isSelected = r.id === selectedId
                    const authorName =
                      r.preview?.author?.displayName || r.reporter.displayName || 'Người dùng'
                    const authorAvatar =
                      r.preview?.author?.avatarUrl || r.reporter.avatarUrl || '/assets/avatar.jpg'

                    return (
                      <div
                        key={r.id}
                        className={`mod-queue-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <div className="mod-queue-card-meta">
                          <div className="flex items-center gap-1.5">
                            {renderTargetBadge(r.targetType)}
                            {r.priority === 'HIGH' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">
                                ⚑ Cao
                              </span>
                            )}
                          </div>
                          <span>{relativeTime(r.createdAt)}</span>
                        </div>

                        <div className="mod-queue-card-user">
                          <img src={authorAvatar} alt="" />
                          <span>{authorName}</span>
                        </div>

                        <p className="mod-queue-card-snippet">
                          {r.preview?.content || r.note || r.reasonLabel || '(Không có nội dung văn bản)'}
                        </p>

                        <div className="mod-queue-card-footer">
                          <span className="text-xs font-medium text-zinc-600">
                            ⚠ {r.reasonLabel || r.reasonCode}
                          </span>
                          <span className="text-xs font-semibold text-rose-600">
                            {r.openReportCount > 1
                              ? `${r.openReportCount} lượt báo cáo`
                              : '1 báo cáo'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Right Workspace (Investigation & Action Center) ── */}
            <div className="mod-workspace-panel">
              {detail ? (
                <>
                  {/* Ticket Header Banner */}
                  <div className="mod-ticket-banner">
                    <div className="mod-ticket-info">
                      <span className="mod-ticket-id">#{detail.id.slice(0, 8).toUpperCase()}</span>
                      {renderStatusBadge(detail.status)}
                      {renderTargetBadge(detail.targetType)}
                      {detail.priority === 'HIGH' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Flag size={12} />
                          Ưu tiên xử lý cao
                        </span>
                      )}
                    </div>

                    <div className="mod-ticket-reporter">
                      <span>Báo cáo bởi:</span>
                      <img src={detail.reporter.avatarUrl || '/assets/avatar.jpg'} alt="" />
                      <strong className="text-zinc-800">
                        {detail.reporter.displayName || 'Người dùng'}
                      </strong>
                      <span>• {detail.createdAt ? relativeTime(detail.createdAt) : ''}</span>
                    </div>
                  </div>

                  {/* Card 1: Reported Content Preview */}
                  <Card className="mod-card">
                    <h4 className="mod-card-title">
                      <FileText size={17} className="text-amber-600" />
                      Nội dung được báo cáo
                    </h4>

                    {/* Author Mini Profile */}
                    <div className="mod-author-row">
                      <div className="mod-author-profile">
                        <img
                          src={detail.preview?.author?.avatarUrl || '/assets/avatar.jpg'}
                          alt=""
                        />
                        <div>
                          <p className="mod-author-name">
                            {detail.preview?.author?.displayName || 'Tác giả không xác định'}
                          </p>
                          <p className="mod-author-sub">
                            ID: {detail.preview?.author?.userId || detail.targetId}
                          </p>
                        </div>
                      </div>
                      {detail.preview?.status && (
                        <Badge variant="outline">{detail.preview.status}</Badge>
                      )}
                    </div>

                    {/* Content Text Bubble */}
                    <div className="mod-content-box">
                      <p className="mod-content-text">
                        {detail.preview?.content || (
                          <span className="italic text-zinc-400">
                            (Nội dung này không chứa văn bản hoặc đã bị gỡ bỏ trước đó)
                          </span>
                        )}
                      </p>

                      {/* Image Preview if available */}
                      {detail.preview?.imageUrls && detail.preview.imageUrls.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-zinc-500 mb-2 flex items-center gap-1.5">
                            <ImageIcon size={14} />
                            Hình ảnh đính kèm ({detail.preview.imageUrls.length})
                          </p>
                          <div className="flex gap-3 flex-wrap">
                            {detail.preview.imageUrls.map((url, idx) => (
                              <div
                                key={idx}
                                className="mod-content-image"
                                onClick={() => setPreviewImage(url)}
                                title="Bấm để xem ảnh lớn"
                              >
                                <img src={url} alt={`Ảnh ${idx + 1}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                      <span>Mã đối tượng: {detail.targetId}</span>
                      <span>Loại đối tượng: {detail.targetType}</span>
                    </div>
                  </Card>

                  {/* Card 2: Violation & Evidence */}
                  <Card className="mod-card">
                    <h4 className="mod-card-title">
                      <ShieldAlert size={17} className="text-rose-600" />
                      Lý do vi phạm & Phản ánh của cộng đồng
                    </h4>

                    <div className="mod-violation-box">
                      <div className="mod-violation-row">
                        <AlertCircle size={17} />
                        <span>
                          Lý do: {detail.reasonLabel} ({detail.reasonCode})
                        </span>
                      </div>

                      {detail.note ? (
                        <div>
                          <span className="text-xs font-bold text-zinc-600 mb-1 block">
                            Ghi chú từ người báo cáo:
                          </span>
                          <p className="mod-violation-note">"{detail.note}"</p>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between text-xs text-zinc-600 pt-1">
                        <span>
                          Số lượt báo cáo liên quan:{' '}
                          <strong>{detail.relatedReports?.length ?? detail.openReportCount ?? 1}</strong>
                        </span>
                        <span>
                          Trạng thái ticket:{' '}
                          <strong className="text-zinc-800">{detail.status}</strong>
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Card 3: Moderation Resolution & Action Center */}
                  <Card className="mod-card">
                    <h4 className="mod-card-title">
                      <Sparkles size={17} className="text-amber-600" />
                      Quyết định xử lý của Quản trị viên
                    </h4>

                    <div className="mod-action-section">
                      {/* Internal Moderation Note Field */}
                      <div className="mod-note-field">
                        <label htmlFor="mod-note">
                          Ghi chú kiểm duyệt nội bộ <span className="font-normal text-zinc-400">(Lưu vào nhật ký hệ thống & audit log)</span>:
                        </label>
                        <textarea
                          id="mod-note"
                          placeholder="Ví dụ: Đã kiểm tra hình ảnh và văn bản, xác định vi phạm quy tắc spam ẩm thực..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>

                      {/* Safe & Regular Actions */}
                      <div>
                        <p className="mod-action-group-title">1. Biện pháp điều hòa & Giữ an toàn</p>
                        <div className="mod-action-grid">
                          {MOD_ACTIONS.filter((a) => !a.danger).map((a) => {
                            const Icon = a.icon
                            return (
                              <button
                                key={a.action}
                                type="button"
                                className={`mod-action-btn ${a.tone}`}
                                disabled={acting}
                                onClick={() => handleActionClick(a)}
                              >
                                <div className="mod-action-btn-top">
                                  <Icon size={16} className={a.tone === 'safe' ? 'text-emerald-600' : 'text-amber-600'} />
                                  <span>{a.label}</span>
                                </div>
                                <p className="mod-action-btn-desc">{a.desc}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Destructive Actions */}
                      <div>
                        <p className="mod-action-group-title danger">2. Biện pháp cưỡng chế nghiêm khắc</p>
                        <div className="mod-action-grid">
                          {MOD_ACTIONS.filter((a) => a.danger).map((a) => {
                            const Icon = a.icon
                            return (
                              <button
                                key={a.action}
                                type="button"
                                className="mod-action-btn danger"
                                disabled={acting}
                                onClick={() => handleActionClick(a)}
                              >
                                <div className="mod-action-btn-top">
                                  <Icon size={16} className="text-rose-600" />
                                  <span>{a.label}</span>
                                </div>
                                <p className="mod-action-btn-desc">{a.desc}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {acting ? (
                        <div className="flex items-center justify-center gap-2 p-3 text-sm text-amber-700 bg-amber-50 rounded-lg">
                          <Spinner size="sm" />
                          <span>Đang thực hiện hành động kiểm duyệt...</span>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </>
              ) : (
                /* Empty Workspace State */
                <div className="mod-empty-workspace">
                  <div className="mod-empty-icon">
                    <ShieldAlert size={36} />
                  </div>
                  <h3>Chưa chọn báo cáo nào</h3>
                  <p>
                    Vui lòng bấm chọn một mục từ hàng đợi báo cáo bên trái để kiểm tra chi tiết nội dung, bằng chứng vi phạm và thực hiện các biện pháp xử lý an toàn.
                  </p>

                  <div className="mod-empty-guidelines">
                    <div className="mod-guideline-item">
                      <strong>1. Kiểm tra khách quan</strong>
                      Đọc kỹ toàn bộ văn bản và xem ảnh đính kèm trước khi đưa ra kết luận.
                    </div>
                    <div className="mod-guideline-item">
                      <strong>2. Xem xét bối cảnh</strong>
                      Phân biệt giữa thảo luận ẩm thực sôi nổi và hành vi công kích cá nhân.
                    </div>
                    <div className="mod-guideline-item">
                      <strong>3. Áp dụng kỷ luật tăng dần</strong>
                      Ưu tiên ẩn nội dung hoặc cảnh cáo trước khi áp dụng xóa vĩnh viễn hoặc khóa tài khoản.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── Main Tab 2: Community Posts Management ── */
        <Card className="mod-posts-card">
          <div className="mod-posts-toolbar">
            <div className="mod-posts-search">
              <Search size={15} />
              <input
                placeholder="Tìm bài đăng theo nội dung, từ khóa..."
                value={postQ}
                onChange={(e) => setPostQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadPosts()
                }}
              />
            </div>

            <select
              className="mod-filter-select"
              value={postStatus}
              onChange={(e) => setPostStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">ACTIVE - Hoạt động</option>
              <option value="HIDDEN">HIDDEN - Đã ẩn</option>
              <option value="DELETED">DELETED - Đã xóa</option>
              <option value="DRAFT">DRAFT - Bản nháp</option>
            </select>

            <Button onClick={() => void loadPosts()} disabled={postsLoading} className="h-9 gap-1.5">
              <Search size={14} />
              Tìm kiếm
            </Button>

            {(postQ || postStatus) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPostQ('')
                  setPostStatus('')
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-9"
              >
                <RotateCcw size={13} className="mr-1" />
                Đặt lại
              </Button>
            )}

            <div className="ml-auto text-xs text-zinc-500 font-medium">
              Tìm thấy {posts.length} bài đăng
            </div>
          </div>

          {postsLoading ? (
            <div className="p-6">
              <TableSkeleton rows={6} />
            </div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center">
                <FileText size={24} />
              </div>
              <p className="text-sm font-bold text-zinc-700">Không tìm thấy bài đăng nào</p>
              <p className="text-xs text-zinc-500">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mod-posts-table">
                <thead>
                  <tr>
                    <th>Tác giả</th>
                    <th>Nội dung bài viết</th>
                    <th>Trạng thái</th>
                    <th>Tương tác</th>
                    <th>Báo cáo</th>
                    <th>Thời gian</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="mod-post-author">
                          <img
                            src={p.author?.avatarUrl || '/assets/avatar.jpg'}
                            alt=""
                          />
                          <div>
                            <div className="mod-post-author-name">
                              {p.author?.displayName || 'Người dùng'}
                            </div>
                            <div className="mod-post-author-sub">
                              {p.author?.userId ? `@${p.author.userId.slice(0, 8)}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="mod-post-content" title={p.content}>
                          {p.content || <span className="italic text-zinc-400">(Không có văn bản)</span>}
                        </div>
                        {p.imageUrls && p.imageUrls.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                            <ImageIcon size={12} className="text-amber-600" />
                            <span>{p.imageUrls.length} ảnh đính kèm</span>
                          </div>
                        ) : null}
                      </td>
                      <td>{renderPostStatusBadge(p.status)}</td>
                      <td>
                        <div className="mod-post-metrics">
                          <span title="Lượt thích">
                            <Heart size={13} className="text-rose-500" />
                            {p.likeCount ?? 0}
                          </span>
                          <span title="Bình luận">
                            <MessageSquare size={13} className="text-sky-500" />
                            {p.commentCount ?? 0}
                          </span>
                        </div>
                      </td>
                      <td>
                        {p.reportCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Flag size={11} />
                            {p.reportCount}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">0</span>
                        )}
                      </td>
                      <td className="text-xs text-zinc-500 whitespace-nowrap">
                        {p.createdAt ? relativeTime(p.createdAt) : '—'}
                      </td>
                      <td>
                        <div className="mod-post-actions justify-end">
                          {p.status !== 'HIDDEN' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={async () => {
                                await moderationAdminApi.hidePost(p.id)
                                void loadPosts()
                              }}
                            >
                              <EyeOff size={13} />
                              Ẩn
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={async () => {
                                await moderationAdminApi.restorePost(p.id)
                                void loadPosts()
                              }}
                            >
                              <Eye size={13} />
                              Hiện
                            </Button>
                          )}
                          {p.status !== 'DELETED' ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 text-xs gap-1"
                              onClick={() => setPostToDelete(p.id)}
                            >
                              <Trash2 size={13} />
                              Xóa
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Main Tab 3: Comments Moderation ── */}
      {tab === 'comments' && (
        <Card className="mod-posts-card">
          <div className="mod-posts-filter-bar flex-wrap">
            <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  commentType === 'all'
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
                onClick={() => setCommentType('all')}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  commentType === 'article'
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
                onClick={() => setCommentType('article')}
              >
                Bài viết
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  commentType === 'post'
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
                onClick={() => setCommentType('post')}
              >
                Bài đăng cộng đồng
              </button>
            </div>

            <div className="mod-search-box max-w-xs">
              <Search size={15} />
              <input
                type="text"
                placeholder="Tìm nội dung bình luận..."
                value={commentSearch}
                onChange={(e) => setCommentSearch(e.target.value)}
              />
              {commentSearch && (
                <button type="button" onClick={() => setCommentSearch('')}>
                  <X size={13} />
                </button>
              )}
            </div>

            <Button size="sm" variant="outline" onClick={() => void loadComments()} className="h-9 text-xs">
              Làm mới
            </Button>

            <div className="ml-auto text-xs text-zinc-500 font-medium">
              Hiển thị {comments.length} bình luận
            </div>
          </div>

          {commentsLoading ? (
            <div className="p-6">
              <TableSkeleton rows={6} />
            </div>
          ) : comments.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center">
                <MessageSquare size={24} />
              </div>
              <p className="text-sm font-bold text-zinc-700">Không tìm thấy bình luận nào</p>
              <p className="text-xs text-zinc-500">Thử thay đổi từ khóa hoặc bộ lọc</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mod-posts-table">
                <thead>
                  <tr>
                    <th>Tác giả</th>
                    <th>Nội dung bình luận</th>
                    <th>Thuộc về</th>
                    <th>Lượt thích</th>
                    <th>Thời gian</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="mod-post-author">
                          <img
                            src={c.author?.avatarUrl || '/assets/avatar.jpg'}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).src = '/assets/avatar.jpg'
                            }}
                          />
                          <div>
                            <div className="font-semibold text-xs text-zinc-900">
                              {c.author?.displayName || 'Ẩn danh'}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {c.author?.userId.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-md">
                        <div className="space-y-1">
                          <p className={`text-xs ${c.isHidden ? 'text-zinc-400 italic line-through' : 'text-zinc-800 font-normal'}`}>
                            {c.content}
                          </p>
                          {c.isHidden ? (
                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-medium">
                              Đã bị ẩn bởi admin
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="text-xs font-medium text-zinc-700 max-w-[220px] truncate" title={c.targetTitle}>
                          <span className="text-[10px] font-bold uppercase text-zinc-400 mr-1.5 inline-block">
                            [{c.type === 'article' ? 'Bài viết' : 'Bài đăng'}]
                          </span>
                          {c.targetTitle}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-zinc-600 font-semibold">{c.likesCount}</span>
                      </td>
                      <td>
                        <span className="text-xs text-zinc-500">
                          {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1"
                            disabled={commentActingId === c.id}
                            onClick={() => void handleToggleHideComment(c.id)}
                          >
                            {c.isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                            {c.isHidden ? 'Bỏ ẩn' : 'Ẩn'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs gap-1"
                            disabled={commentActingId === c.id}
                            onClick={() => setCommentToDelete(c.id)}
                          >
                            <Trash2 size={13} />
                            Xóa
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Confirm Moderation Action Dialog ── */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <DialogTitle>Xác nhận {confirmAction?.label.toLowerCase()}</DialogTitle>
                <DialogDescription className="mt-1">
                  Hành động này mang tính cưỡng chế và ảnh hưởng trực tiếp đến người dùng.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-3 text-sm text-zinc-700 bg-rose-50/50 p-4 rounded-lg border border-rose-200/80 my-2">
            <p className="font-semibold text-rose-900 mb-1">{confirmAction?.desc}</p>
            {note ? (
              <p className="text-xs text-zinc-600 mt-2">
                <strong>Ghi chú kiểm duyệt:</strong> "{note}"
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={acting}>
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              disabled={acting}
              onClick={() => confirmAction && void onResolve(confirmAction.action)}
            >
              {acting ? <Spinner size="sm" className="mr-2" /> : null}
              Xác nhận thực hiện
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Post Delete Dialog ── */}
      <Dialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa bài đăng này?</DialogTitle>
            <DialogDescription>
              Bài đăng sẽ được đánh dấu DELETED và không còn xuất hiện trên bảng tin Mogu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostToDelete(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!postToDelete) return
                await moderationAdminApi.deletePost(postToDelete)
                setPostToDelete(null)
                void loadPosts()
              }}
            >
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Comment Delete Dialog ── */}
      <Dialog open={!!commentToDelete} onOpenChange={(open) => !open && setCommentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa vĩnh viễn bình luận?</DialogTitle>
            <DialogDescription>
              Bình luận sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu và không thể khôi phục lại.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentToDelete(null)} disabled={!!commentActingId}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={!!commentActingId}
              onClick={() => void handleDeleteComment()}
            >
              {commentActingId ? <Spinner size="sm" className="mr-2" /> : null}
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Lightbox Modal ── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-zinc-800">
          <div className="relative flex items-center justify-center p-2">
            {previewImage && (
              <img
                src={previewImage}
                alt="Preview"
                className="max-h-[80vh] max-w-full rounded-md object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
