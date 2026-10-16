import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { MediaLightbox, useMediaLightbox } from '../components/ui/media-lightbox'
import { articlesAdminApi, topicsAdminApi, type Article, type Topic } from '../api/explore'
import { TableSkeleton } from '../components/ui/page-skeleton'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Image } from '../components/ui/image'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { MarkdownEditor } from '../components/articles/MarkdownEditor'
import { PageContainer } from '../components/layout'
import { ImageUpload } from '../components/ui/image-upload'

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive'; dotColor: string }
> = {
  DRAFT: { label: 'Bản nháp', variant: 'secondary', dotColor: 'bg-slate-400' },
  PUBLISHED: { label: 'Đã xuất bản', variant: 'success', dotColor: 'bg-emerald-500' },
  ARCHIVED: { label: 'Lưu trữ', variant: 'warning', dotColor: 'bg-amber-500' },
  SCHEDULED: { label: 'Đã lên lịch', variant: 'warning', dotColor: 'bg-sky-500' },
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/** Lightweight Markdown → HTML for admin preview (no extra dependency). */
function markdownToHtml(raw: string): string {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono font-medium">$1</code>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" class="text-amber-600 dark:text-amber-400 underline font-medium hover:text-amber-700" target="_blank" rel="noreferrer">$1</a>',
      )

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeLists()
      continue
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      closeLists()
      html.push('<hr class="my-4 border-border" />')
      continue
    }
    const h2 = trimmed.match(/^##\s+(.*)$/)
    if (h2) {
      closeLists()
      html.push(`<h2 class="text-base font-bold mt-4 mb-2 text-foreground tracking-tight border-b border-border/40 pb-1">${inline(h2[1])}</h2>`)
      continue
    }
    const h3 = trimmed.match(/^###\s+(.*)$/)
    if (h3) {
      closeLists()
      html.push(`<h3 class="text-sm font-semibold mt-3 mb-1 text-foreground">${inline(h3[1])}</h3>`)
      continue
    }
    const quote = trimmed.match(/^>\s+(.*)$/)
    if (quote) {
      closeLists()
      html.push(`<blockquote class="border-l-4 border-amber-500 pl-3 py-1 my-2 bg-amber-50/50 dark:bg-amber-950/20 text-muted-foreground italic rounded-r text-xs">${inline(quote[1])}</blockquote>`)
      continue
    }
    const ul = trimmed.match(/^[-*]\s+(.*)$/)
    if (ul) {
      if (inOl) {
        html.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        html.push('<ul class="list-disc pl-5 my-2 space-y-1 text-xs text-foreground">')
        inUl = true
      }
      html.push(`<li>${inline(ul[1])}</li>`)
      continue
    }
    const ol = trimmed.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      if (inUl) {
        html.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        html.push('<ol class="list-decimal pl-5 my-2 space-y-1 text-xs text-foreground">')
        inOl = true
      }
      html.push(`<li>${inline(ol[1])}</li>`)
      continue
    }
    closeLists()
    html.push(`<p class="mb-2 leading-relaxed text-xs text-foreground">${inline(trimmed)}</p>`)
  }
  closeLists()
  return html.join('')
}

export default function ArticlesPage() {
  const { lightboxProps } = useMediaLightbox()
  const [articles, setArticles] = useState<Article[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [filterTopicId, setFilterTopicId] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [deleteConfirm, setDeleteConfirm] = useState<Article | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createActiveTab, setCreateActiveTab] = useState<'content' | 'settings'>('content')
  const [editActiveTab, setEditActiveTab] = useState<'content' | 'settings'>('content')

  const [form, setForm] = useState({
    slug: '',
    title: '',
    summary: '',
    content: '',
    coverImageUrl: '',
    readMinutes: 3,
    topicId: '',
    tags: '',
    publishAt: '',
  })
  const [saving, setSaving] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<Article | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')

  // Pagination state
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const currentCursor = cursorStack[cursorStack.length - 1]

  // Edit modal state
  const [editTarget, setEditTarget] = useState<Article | null>(null)
  const [editForm, setEditForm] = useState({
    slug: '',
    title: '',
    summary: '',
    content: '',
    coverImageUrl: '',
    readMinutes: 3,
    topicId: '',
    tags: '',
  })
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const previewHtml = useMemo(() => markdownToHtml(form.content), [form.content])
  const editPreviewHtml = useMemo(() => markdownToHtml(editForm.content), [editForm.content])

  const load = async (q?: string, topicId?: string, cursor?: string | null) => {
    setLoading(true)
    setError('')
    try {
      const result = await articlesAdminApi.list({
        q: q || undefined,
        topicId: topicId || undefined,
        cursor: cursor || undefined,
        limit: 15,
      })
      setArticles(result.data ?? [])
      setNextCursor(result.nextCursor ?? null)
      setHasMore(!!result.hasMore)
    } catch (e: any) {
      setError(e.message ?? 'Không tải được danh sách bài viết')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    topicsAdminApi.list().then(setTopics).catch(() => {})
  }, [])

  useEffect(() => {
    setCursorStack([null])
  }, [searchQ, filterTopicId])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(searchQ, filterTopicId, currentCursor)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQ, filterTopicId, currentCursor])

  const openEditModal = async (article: Article) => {
    setEditTarget(article)
    setEditActiveTab('content')
    setLoadingEdit(true)
    setEditForm({
      slug: article.slug,
      title: article.title,
      summary: article.summary ?? '',
      content: '',
      coverImageUrl: article.coverImageUrl ?? '',
      readMinutes: article.readMinutes ?? 3,
      topicId: article.topic?.id ?? '',
      tags: (article.tags ?? []).join(', '),
    })
    try {
      const full = await articlesAdminApi.get(article.id)
      setEditForm((prev) => ({
        ...prev,
        content: full.content ?? '',
      }))
    } catch {
      // fallback
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    if (!editForm.title.trim() || !editForm.slug.trim() || !editForm.content.trim()) {
      alert('Vui lòng nhập đầy đủ Tiêu đề, Slug và Nội dung')
      return
    }
    setSavingEdit(true)
    try {
      await articlesAdminApi.update(editTarget.id, {
        slug: editForm.slug.trim(),
        title: editForm.title.trim(),
        summary: editForm.summary.trim() || undefined,
        content: editForm.content,
        coverImageUrl: editForm.coverImageUrl.trim() || undefined,
        readMinutes: editForm.readMinutes,
        topicId: editForm.topicId || undefined,
        tags: editForm.tags
          ? editForm.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      })
      setEditTarget(null)
      await load(searchQ, filterTopicId, currentCursor)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Không thể cập nhật bài viết')
    } finally {
      setSavingEdit(false)
    }
  }

  const filteredArticles = useMemo(() => {
    if (statusFilter === 'ALL') return articles
    return articles.filter((a) => a.status === statusFilter)
  }, [articles, statusFilter])

  // Stats calculation
  const stats = useMemo(() => {
    const total = articles.length
    const published = articles.filter((a) => a.status === 'PUBLISHED').length
    const scheduled = articles.filter((a) => a.status === 'SCHEDULED').length
    const drafts = articles.filter((a) => a.status === 'DRAFT').length
    const totalViews = articles.reduce((sum, a) => sum + (a.viewCount || 0), 0)
    return { total, published, scheduled, drafts, totalViews }
  }, [articles])

  const handleTogglePublish = async (article: Article) => {
    try {
      await articlesAdminApi.publish(article.id)
      await load(searchQ, filterTopicId, currentCursor)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi cập nhật trạng thái bài viết')
    }
  }

  const handleTogglePin = async (article: Article) => {
    try {
      await articlesAdminApi.togglePin(article.id, !article.isPinned)
      await load(searchQ, filterTopicId, currentCursor)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi ghim bài viết')
    }
  }

  const handleConfirmSchedule = async () => {
    if (!scheduleTarget || !scheduleDate) return
    try {
      await articlesAdminApi.publish(scheduleTarget.id, {
        publishAt: new Date(scheduleDate).toISOString(),
        schedule: true,
      })
      setScheduleTarget(null)
      setScheduleDate('')
      await load(searchQ, filterTopicId, currentCursor)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi lên lịch bài viết')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await articlesAdminApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await load(searchQ, filterTopicId, currentCursor)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Không thể xóa bài viết')
    } finally {
      setDeleting(false)
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      alert('Vui lòng nhập đầy đủ Tiêu đề, Slug và Nội dung')
      return
    }
    setSaving(true)
    try {
      const created = await articlesAdminApi.create({
        slug: form.slug.trim(),
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content,
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        readMinutes: form.readMinutes,
        topicId: form.topicId || undefined,
        tags: form.tags
          ? form.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      })

      if (form.publishAt) {
        await articlesAdminApi.publish(created.id, {
          publishAt: new Date(form.publishAt).toISOString(),
          schedule: true,
        })
      }

      setShowCreateModal(false)
      setForm({
        slug: '',
        title: '',
        summary: '',
        content: '',
        coverImageUrl: '',
        readMinutes: 3,
        topicId: '',
        tags: '',
        publishAt: '',
      })
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi tạo bài viết')
    } finally {
      setSaving(false)
    }
  }

  const applySchedulePreset = (hoursFromNow: number) => {
    const target = new Date()
    target.setHours(target.getHours() + hoursFromNow)
    target.setMinutes(0, 0, 0)
    setScheduleDate(target.toISOString().slice(0, 16))
  }

  const hasActiveFilters = Boolean(searchQ || filterTopicId || statusFilter !== 'ALL')

  return (
    <PageContainer className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <FileText size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Quản lý bài viết (Articles)
                <Badge variant="secondary" className="font-mono text-xs font-semibold">
                  {articles.length} bài
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Biên soạn, kiểm duyệt nội dung chuyên sâu và lên lịch xuất bản bài viết ẩm thực trên ứng dụng Mogu.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            setCreateActiveTab('content')
            setShowCreateModal(true)
          }}
          className="font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-1.5 h-9 px-4 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Viết bài mới</span>
        </Button>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Tổng bài viết
              </span>
              <div className="text-2xl font-bold text-foreground font-mono">{stats.total}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-emerald-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Đã xuất bản
              </span>
              <div className="text-2xl font-bold text-emerald-600 font-mono">{stats.published}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-sky-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Đang hẹn giờ
              </span>
              <div className="text-2xl font-bold text-sky-600 font-mono">{stats.scheduled}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-violet-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Lượt xem tích lũy
              </span>
              <div className="text-2xl font-bold text-violet-600 font-mono">
                {stats.totalViews.toLocaleString('vi-VN')}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
              <Eye size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Studio Toolbar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search and Topic selector */}
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Tìm kiếm bài viết theo tiêu đề, slug..."
                  className="pl-9 pr-8 h-9 text-xs bg-muted/30 focus-visible:bg-card"
                />
                {searchQ && (
                  <button
                    onClick={() => setSearchQ('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Xóa tìm kiếm"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="w-48 shrink-0">
                <Select
                  value={filterTopicId}
                  onChange={(e) => setFilterTopicId(e.target.value)}
                  className="h-9 text-xs bg-muted/30"
                  aria-label="Lọc theo chủ đề"
                >
                  <option value="">Tất cả chủ đề</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchQ('')
                    setFilterTopicId('')
                    setStatusFilter('ALL')
                  }}
                  className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={12} />
                  Đặt lại
                </Button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="shrink-0">
              <TabsList className="bg-muted/60 p-1 h-9">
                <TabsTrigger value="ALL" className="text-xs px-2.5">
                  Tất cả
                </TabsTrigger>
                <TabsTrigger value="PUBLISHED" className="text-xs px-2.5">
                  Đã đăng
                </TabsTrigger>
                <TabsTrigger value="SCHEDULED" className="text-xs px-2.5">
                  Lên lịch
                </TabsTrigger>
                <TabsTrigger value="DRAFT" className="text-xs px-2.5">
                  Bản nháp
                </TabsTrigger>
                <TabsTrigger value="ARCHIVED" className="text-xs px-2.5">
                  Lưu trữ
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Main Articles Table Card */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={7} cols={7} />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[280px]">Ảnh / Tiêu đề bài viết</TableHead>
                <TableHead className="w-40">Chủ đề</TableHead>
                <TableHead className="w-28 text-center">Thời gian đọc</TableHead>
                <TableHead className="w-24 text-center">Lượt xem</TableHead>
                <TableHead className="w-32 text-center">Tương tác</TableHead>
                <TableHead className="w-36 text-center">Trạng thái</TableHead>
                <TableHead className="w-36 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText size={36} className="text-muted-foreground/30" />
                      <span className="text-sm font-medium">Không tìm thấy bài viết nào phù hợp.</span>
                      <p className="text-xs text-muted-foreground/70">
                        Thử thay đổi bộ lọc tìm kiếm hoặc tạo một bài viết mới.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredArticles.map((article) => {
                  const statusConf = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.DRAFT
                  return (
                    <TableRow key={article.id} className="hover:bg-muted/30 transition-colors">
                      {/* Title & Cover */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          {article.coverImageUrl ? (
                            <Image
                              src={article.coverImageUrl}
                              alt={article.title}
                              aspectRatio="video"
                              zoomable
                              title={article.title}
                              subtitle="Ảnh bìa bài viết"
                              className="w-16 h-11 rounded-lg object-cover border border-border/80 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-11 rounded-lg bg-muted flex items-center justify-center border border-border/80 shrink-0 text-muted-foreground/60">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground line-clamp-1 text-xs sm:text-sm">
                                {article.title}
                              </span>
                              {article.isPinned && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5 font-semibold">
                                  <Pin size={9} className="fill-amber-600 text-amber-600" /> Đã ghim
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                              <span className="font-medium text-foreground/80">
                                {article.author?.displayName ?? 'Mogu Editorial'}
                              </span>
                              <span>•</span>
                              <span>{new Date(article.createdAt).toLocaleDateString('vi-VN')}</span>
                              {article.tags && article.tags.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 truncate max-w-[120px] text-muted-foreground/70">
                                    <Tag size={10} />
                                    {article.tags.slice(0, 2).join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Topic */}
                      <TableCell>
                        {article.topic ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] font-medium bg-muted/40 border-border/80 max-w-[140px] truncate"
                          >
                            {article.topic.title}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">— Chưa gắn</span>
                        )}
                      </TableCell>

                      {/* Read Minutes */}
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/40">
                          <Clock size={11} className="text-amber-500" />
                          {article.readMinutes}p
                        </span>
                      </TableCell>

                      {/* Views */}
                      <TableCell className="text-center">
                        <span className="text-xs font-semibold font-mono text-foreground">
                          {article.viewCount.toLocaleString('vi-VN')}
                        </span>
                      </TableCell>

                      {/* Engagement */}
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-2.5 bg-muted/20 px-2 py-0.5 rounded-md text-xs font-mono text-muted-foreground">
                          <span className="flex items-center gap-1 text-rose-600" title="Lượt thích">
                            <Heart size={11} className="fill-rose-500/20" />
                            {article.likeCount ?? 0}
                          </span>
                          <span className="h-3 w-px bg-border" />
                          <span className="flex items-center gap-1 text-blue-600" title="Bình luận">
                            <MessageSquare size={11} className="fill-blue-500/20" />
                            {article.commentCount ?? 0}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(article)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:scale-105"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dotColor}`} />
                            <Badge variant={statusConf.variant} className="border-0 p-0 text-[11px] font-semibold">
                              {statusConf.label}
                            </Badge>
                          </button>
                          {article.status === 'SCHEDULED' && article.publishAt && (
                            <span className="text-[10px] text-sky-600 font-mono font-medium flex items-center gap-0.5">
                              <Calendar size={10} />
                              {new Date(article.publishAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              {new Date(article.publishAt).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Row Actions */}
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 rounded-md transition-colors ${
                              article.isPinned
                                ? 'text-amber-600 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => handleTogglePin(article)}
                            title={article.isPinned ? 'Bỏ ghim bài viết' : 'Ghim bài lên đầu feed'}
                          >
                            <Pin size={13} className={article.isPinned ? 'fill-amber-600 text-amber-600' : ''} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                            onClick={() => {
                              setScheduleTarget(article)
                              setScheduleDate(
                                article.publishAt ? new Date(article.publishAt).toISOString().slice(0, 16) : '',
                              )
                            }}
                            title="Lên lịch xuất bản"
                          >
                            <Calendar size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            onClick={() => void openEditModal(article)}
                            title="Chỉnh sửa bài viết"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={() => setDeleteConfirm(article)}
                            title="Xóa bài viết"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Trang <span className="font-semibold text-foreground font-mono">{cursorStack.length}</span>{' '}
            {hasMore ? '(còn bài viết tiếp theo)' : '(hết danh sách)'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={cursorStack.length <= 1 || loading}
              onClick={() => {
                setCursorStack((prev) => prev.slice(0, prev.length - 1))
              }}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeft size={14} />
              Trang trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasMore || !nextCursor || loading}
              onClick={() => {
                if (nextCursor) {
                  setCursorStack((prev) => [...prev, nextCursor])
                }
              }}
              className="h-8 text-xs gap-1"
            >
              Trang sau
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── MODAL SOẠN THẢO BÀI VIẾT MỚI (Redesigned) ── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                  <Sparkles size={18} />
                </span>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                    Soạn thảo bài viết mới
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Viết bài cẩm nang, mẹo dinh dưỡng và công thức ẩm thực định dạng Markdown chuẩn feed Mogu.
                  </DialogDescription>
                </div>
              </div>

              {/* Sub-tabs switch */}
              <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setCreateActiveTab('content')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    createActiveTab === 'content'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Nội dung bài viết
                </button>
                <button
                  type="button"
                  onClick={() => setCreateActiveTab('settings')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    createActiveTab === 'settings'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cài đặt & Xuất bản
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {createActiveTab === 'content' ? (
              <div className="space-y-4">
                {/* Title & Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-title" className="text-xs font-semibold text-foreground">
                      Tiêu đề bài viết <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="create-title"
                      value={form.title}
                      onChange={(e) => {
                        const newTitle = e.target.value
                        setForm((prev) => ({
                          ...prev,
                          title: newTitle,
                          slug: !prev.slug || prev.slug === slugify(prev.title) ? slugify(newTitle) : prev.slug,
                        }))
                      }}
                      placeholder="VD: 5 bí quyết nấu nước dùng phở bò trong veo"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="create-slug" className="text-xs font-semibold text-foreground">
                        Slug URL <span className="text-rose-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, slug: slugify(prev.title) }))}
                        className="text-[11px] text-amber-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Wand2 size={11} /> Tự động tạo slug
                      </button>
                    </div>
                    <Input
                      id="create-slug"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="5-bi-quyet-nau-nuoc-dung-pho-bo"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1.5">
                  <Label htmlFor="create-summary" className="text-xs font-semibold text-foreground">
                    Tóm tắt ngắn gọn (Hiển thị xem trước trên Feed)
                  </Label>
                  <Textarea
                    id="create-summary"
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="Đoạn văn ngắn 1-2 câu tóm tắt nội dung hấp dẫn để người đọc muốn bấm vào xem..."
                    rows={2}
                    className="text-xs leading-relaxed"
                  />
                </div>

                {/* Markdown Editor */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      Nội dung chi tiết (Markdown) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Hỗ trợ định dạng đầy đủ tiêu đề, danh sách, trích dẫn, code và ảnh
                    </span>
                  </Label>

                  <MarkdownEditor
                    value={form.content}
                    onChange={(val: string) => setForm({ ...form, content: val })}
                    previewHtml={previewHtml}
                    placeholder="## 1. Nguyên liệu chuẩn bị&#10;&#10;Nội dung chi tiết công thức hoặc cẩm nang...&#10;&#10;## 2. Các bước thực hiện&#10;&#10;- Bước 1:..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Category & Read Time & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-topic" className="text-xs font-semibold text-foreground">
                      Chủ đề trực thuộc
                    </Label>
                    <Select
                      id="create-topic"
                      value={form.topicId}
                      onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                      className="w-full h-9 text-xs"
                    >
                      <option value="">— Chưa gắn chủ đề —</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-time" className="text-xs font-semibold text-foreground">
                      Thời gian đọc ước tính (phút)
                    </Label>
                    <Input
                      id="create-time"
                      type="number"
                      value={form.readMinutes}
                      onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })}
                      min={1}
                      max={120}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-tags" className="text-xs font-semibold text-foreground">
                      Thẻ phân loại (Tags)
                    </Label>
                    <Input
                      id="create-tags"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      placeholder="nấu ăn, sức khỏe, mẹo hay"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Cover Image Upload */}
                <ImageUpload
                  value={form.coverImageUrl}
                  onChange={(url) => setForm({ ...form, coverImageUrl: url })}
                  folder="articles"
                  label="Ảnh bìa đại diện bài viết"
                  aspectRatio="video"
                />

                {/* Schedule Publish */}
                <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-sky-600" />
                    <span className="text-xs font-bold text-foreground">Lên lịch xuất bản tự động (Tùy chọn)</span>
                  </div>
                  <Input
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                    className="h-9 text-xs bg-card"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Nếu đặt lịch trong tương lai, bài viết sẽ ở trạng thái "Đã lên lịch" và tự động phát hành đúng giờ.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {form.publishAt ? (
                <span className="text-sky-600 font-medium flex items-center gap-1">
                  <Calendar size={13} /> Sẽ lên lịch đăng
                </span>
              ) : (
                <span className="text-slate-500 font-medium">Trạng thái tạo: Bản nháp (DRAFT)</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="h-9 px-4 text-xs">
                Hủy bỏ
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="h-9 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
              >
                {saving ? 'Đang lưu bài...' : form.publishAt ? 'Lên lịch ngay' : 'Tạo bài viết'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL CHỈNH SỬA BÀI VIẾT (Redesigned) ── */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20">
                  <Pencil size={18} />
                </span>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                    Chỉnh sửa bài viết
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Cập nhật tiêu đề, nội dung Markdown, hình ảnh và phân loại bài viết.
                  </DialogDescription>
                </div>
              </div>

              {/* Sub-tabs switch */}
              <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setEditActiveTab('content')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    editActiveTab === 'content'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Nội dung bài viết
                </button>
                <button
                  type="button"
                  onClick={() => setEditActiveTab('settings')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    editActiveTab === 'settings'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cài đặt & Xuất bản
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {loadingEdit ? (
              <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                <p>Đang tải nội dung chi tiết bài viết...</p>
              </div>
            ) : editActiveTab === 'content' ? (
              <div className="space-y-4">
                {/* Title & Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-title" className="text-xs font-semibold text-foreground">
                      Tiêu đề bài viết <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="edit-title"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-slug" className="text-xs font-semibold text-foreground">
                      Slug URL <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="edit-slug"
                      value={editForm.slug}
                      onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1.5">
                  <Label htmlFor="edit-summary" className="text-xs font-semibold text-foreground">
                    Tóm tắt ngắn gọn
                  </Label>
                  <Textarea
                    id="edit-summary"
                    value={editForm.summary}
                    onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                    rows={2}
                    className="text-xs leading-relaxed"
                  />
                </div>

                {/* Markdown Editor */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      Nội dung chi tiết (Markdown) <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Cập nhật trực quan và kiểm tra kết quả ngay trong trình soạn thảo
                    </span>
                  </Label>

                  <MarkdownEditor
                    value={editForm.content}
                    onChange={(val: string) => setEditForm({ ...editForm, content: val })}
                    previewHtml={editPreviewHtml}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Category & Read Time & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-topic" className="text-xs font-semibold text-foreground">
                      Chủ đề trực thuộc
                    </Label>
                    <Select
                      id="edit-topic"
                      value={editForm.topicId}
                      onChange={(e) => setEditForm({ ...editForm, topicId: e.target.value })}
                      className="w-full h-9 text-xs"
                    >
                      <option value="">— Chưa gắn chủ đề —</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-time" className="text-xs font-semibold text-foreground">
                      Thời gian đọc ước tính (phút)
                    </Label>
                    <Input
                      id="edit-time"
                      type="number"
                      value={editForm.readMinutes}
                      onChange={(e) => setEditForm({ ...editForm, readMinutes: Number(e.target.value) })}
                      min={1}
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-tags" className="text-xs font-semibold text-foreground">
                      Tags (phân cách bằng dấu phẩy)
                    </Label>
                    <Input
                      id="edit-tags"
                      value={editForm.tags}
                      onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Cover Image Upload */}
                <ImageUpload
                  value={editForm.coverImageUrl}
                  onChange={(url) => setEditForm({ ...editForm, coverImageUrl: url })}
                  folder="articles"
                  label="Ảnh bìa đại diện bài viết"
                  aspectRatio="video"
                />
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="h-9 px-4 text-xs">
              Hủy bỏ
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={savingEdit || loadingEdit}
              className="h-9 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
            >
              {savingEdit ? 'Đang lưu thay đổi...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG HẸN GIỜ ĐĂNG BÀI VIẾT (Redesigned) ── */}
      <Dialog open={Boolean(scheduleTarget)} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent className="sm:max-w-lg p-0 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20">
                <Calendar size={18} />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Hẹn giờ xuất bản bài viết</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Bài viết sẽ tự động chuyển sang trạng thái "Đã xuất bản" vào đúng thời điểm đã chọn.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Target Article Summary */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 flex items-center gap-3">
              {scheduleTarget?.coverImageUrl ? (
                <Image
                  src={scheduleTarget.coverImageUrl}
                  alt={scheduleTarget.title}
                  aspectRatio="video"
                  className="w-16 h-11 rounded-lg object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-16 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                  <FileText size={16} className="text-muted-foreground/60" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-foreground line-clamp-1">{scheduleTarget?.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  Slug: {scheduleTarget?.slug}
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Gợi ý mốc thời gian nhanh</Label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySchedulePreset(2)}
                  className="h-7 text-[11px] px-2.5 bg-card hover:bg-muted"
                >
                  +2 giờ sau
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySchedulePreset(6)}
                  className="h-7 text-[11px] px-2.5 bg-card hover:bg-muted"
                >
                  +6 giờ sau
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySchedulePreset(24)}
                  className="h-7 text-[11px] px-2.5 bg-card hover:bg-muted"
                >
                  Ngày mai (24h)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applySchedulePreset(72)}
                  className="h-7 text-[11px] px-2.5 bg-card hover:bg-muted"
                >
                  3 ngày tới (72h)
                </Button>
              </div>
            </div>

            {/* Datetime Input */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="schedule-time" className="text-xs font-semibold text-foreground">
                Thời điểm xuất bản chính xác
              </Label>
              <Input
                id="schedule-time"
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setScheduleTarget(null)} className="h-9 px-4 text-xs">
              Hủy
            </Button>
            <Button
              disabled={!scheduleDate}
              onClick={handleConfirmSchedule}
              className="h-9 px-4 text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white"
            >
              Xác nhận lên lịch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG XÁC NHẬN XÓA (AlertDialog) ── */}
      <AlertDialog open={Boolean(deleteConfirm)} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-2">
              <Trash2 size={20} />
            </div>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Xác nhận xóa bài viết?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa bài viết{' '}
              <strong className="text-foreground">"{deleteConfirm?.title}"</strong>? Thao tác này sẽ xóa vĩnh viễn bài
              viết khỏi hệ thống và không thể khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel disabled={deleting} className="text-xs h-9">
              Hủy bỏ
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDelete}
              className="text-xs h-9 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaLightbox {...lightboxProps} />
    </PageContainer>
  )
}
