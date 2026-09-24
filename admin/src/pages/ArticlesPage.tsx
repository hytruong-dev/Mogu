import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { articlesAdminApi, topicsAdminApi, type Article, type Topic } from '../api/explore'
import { TableSkeleton } from '../components/ui/page-skeleton'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
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
import { Label } from '../components/ui/label'

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' }> = {
  DRAFT: { label: 'Bản nháp', variant: 'secondary' },
  PUBLISHED: { label: 'Đã xuất bản', variant: 'success' },
  ARCHIVED: { label: 'Lưu trữ', variant: 'warning' },
  SCHEDULED: { label: 'Đã lên lịch', variant: 'warning' },
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
      .replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded text-[12px] font-mono">$1</code>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noreferrer">$1</a>',
      )

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeLists()
      continue
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      closeLists()
      html.push('<hr class="my-3 border-border" />')
      continue
    }
    const h2 = trimmed.match(/^##\s+(.*)$/)
    if (h2) {
      closeLists()
      html.push(`<h2 class="text-base font-bold mt-3 mb-1 text-foreground">${inline(h2[1])}</h2>`)
      continue
    }
    const h3 = trimmed.match(/^###\s+(.*)$/)
    if (h3) {
      closeLists()
      html.push(`<h3 class="text-sm font-bold mt-2 mb-1 text-foreground">${inline(h3[1])}</h3>`)
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
  const [articles, setArticles] = useState<Article[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [filterTopicId, setFilterTopicId] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [deleteConfirm, setDeleteConfirm] = useState<Article | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
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
  const showEngagement = articles.some(
    (a) => typeof a.likeCount === 'number' || typeof a.commentCount === 'number',
  )

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
      // fallback if get fails
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
          ? editForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
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

  const handleTogglePublish = async (article: Article) => {
    try {
      await articlesAdminApi.publish(article.id)
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi cập nhật trạng thái bài viết')
    }
  }

  const handleTogglePin = async (article: Article) => {
    try {
      await articlesAdminApi.togglePin(article.id, !article.isPinned)
      await load(searchQ, filterTopicId)
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
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi lên lịch bài viết')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await articlesAdminApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Không thể xóa bài viết')
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
        slug: form.slug,
        title: form.title,
        summary: form.summary || undefined,
        content: form.content,
        coverImageUrl: form.coverImageUrl || undefined,
        readMinutes: form.readMinutes,
        topicId: form.topicId || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
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

  const colSpan = showEngagement ? 8 : 6

  return (
    <div className="space-y-6">
      {/* Heading & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <FileText size={28} className="text-amber-500" />
            Quản lý bài viết (Articles)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Biên soạn và kiểm duyệt các bài viết chuyên sâu về ẩm thực, dinh dưỡng trên feed Khám phá.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus size={16} />
          <span>Viết bài mới</span>
        </Button>
      </div>

      {/* Filter & Search Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Tìm bài viết theo tiêu đề, slug..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={filterTopicId}
              onChange={(e) => setFilterTopicId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary min-w-[170px]"
            >
              <option value="">Tất cả chủ đề</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/60">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'PUBLISHED', label: 'Đã đăng' },
              { id: 'DRAFT', label: 'Nháp' },
              { id: 'ARCHIVED', label: 'Lưu trữ' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Danh sách bài viết</CardTitle>
              <CardDescription className="text-xs">
                Hiển thị {filteredArticles.length} / {articles.length} bài viết trong kho lưu trữ
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="m-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={6} cols={showEngagement ? 7 : 5} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-[240px]">Ảnh / Tiêu đề bài viết</TableHead>
                  <TableHead className="w-36">Chủ đề</TableHead>
                  <TableHead className="text-center w-24">Thời gian đọc</TableHead>
                  <TableHead className="text-center w-24">Lượt xem</TableHead>
                  {showEngagement && (
                    <>
                      <TableHead className="text-center w-20">Thích</TableHead>
                      <TableHead className="text-center w-20">Bình luận</TableHead>
                    </>
                  )}
                  <TableHead className="text-center w-32">Trạng thái</TableHead>
                  <TableHead className="text-right w-28">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
                      Không tìm thấy bài viết nào phù hợp.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArticles.map((article) => {
                    const statusConf = STATUS_CONFIG[article.status] ?? STATUS_CONFIG.DRAFT
                    return (
                      <TableRow key={article.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {article.coverImageUrl ? (
                              <img
                                src={article.coverImageUrl}
                                alt=""
                                className="w-14 h-10 rounded-lg object-cover flex-shrink-0 border border-border"
                              />
                            ) : (
                              <div className="w-14 h-10 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center border border-border">
                                <ImageIcon size={14} className="text-muted-foreground/60" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-foreground line-clamp-1 block text-sm">
                                  {article.title}
                                </span>
                                {article.isPinned && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 h-4">
                                    Được ghim
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                                {article.author?.displayName ?? 'Mogu Editorial'} • {new Date(article.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {article.topic ? (
                            <Badge variant="outline" className="text-[11px] font-medium max-w-[130px] truncate">
                              {article.topic.title}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {article.readMinutes} phút
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold text-foreground">
                          {article.viewCount.toLocaleString()}
                        </TableCell>
                        {showEngagement && (
                          <>
                            <TableCell className="text-center text-xs font-medium text-muted-foreground">
                              <div className="flex items-center justify-center gap-1">
                                <Heart size={12} className="text-rose-500" />
                                <span>{article.likeCount ?? 0}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs font-medium text-muted-foreground">
                              <div className="flex items-center justify-center gap-1">
                                <MessageSquare size={12} className="text-blue-500" />
                                <span>{article.commentCount ?? 0}</span>
                              </div>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTogglePublish(article)}
                            className="h-7 px-2 hover:bg-transparent flex-col gap-0.5"
                          >
                            <Badge variant={statusConf.variant} className="cursor-pointer">
                              {statusConf.label}
                            </Badge>
                            {article.status === 'SCHEDULED' && article.publishAt && (
                              <span className="text-[10px] text-amber-700 font-mono">
                                {new Date(article.publishAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(article.publishAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                              </span>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className={`h-8 w-8 ${article.isPinned ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-300' : 'text-muted-foreground hover:text-foreground'}`}
                              onClick={() => handleTogglePin(article)}
                              title={article.isPinned ? 'Bỏ ghim bài viết' : 'Ghim bài lên đầu feed'}
                            >
                              <Pin size={14} className={article.isPinned ? 'fill-amber-600 text-amber-600' : ''} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setScheduleTarget(article)
                                setScheduleDate(article.publishAt ? new Date(article.publishAt).toISOString().slice(0, 16) : '')
                              }}
                              title="Hẹn giờ đăng"
                            >
                              <Calendar size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              onClick={() => void openEditModal(article)}
                              title="Chỉnh sửa bài viết"
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              onClick={() => setDeleteConfirm(article)}
                              title="Xóa bài viết"
                            >
                              <Trash2 size={14} />
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

          {/* Pagination bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Trang {cursorStack.length} {hasMore ? '(còn bài viết tiếp theo)' : '(hết danh sách)'}
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
        </CardContent>
      </Card>

      {/* Modal Tạo Bài Viết Mới (Shadcn Dialog) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              Soạn thảo bài viết mới
            </DialogTitle>
            <DialogDescription>
              Viết bài hướng dẫn, công thức ẩm thực hoặc mẹo dinh dưỡng bằng Markdown.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="art-title" className="text-xs font-semibold">
                  Tiêu đề bài viết <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="art-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="VD: 5 bí quyết nấu nước dùng phở trong veo"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="art-slug" className="text-xs font-semibold">
                  Slug URL <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="art-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="5-bi-quyet-nau-nuoc-dung-pho"
                  className="h-9 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-summary" className="text-xs font-semibold">
                Tóm tắt ngắn gọn
              </Label>
              <Textarea
                id="art-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="Đoạn trích giới thiệu ngắn xuất hiện trên thẻ bài viết..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-content" className="text-xs font-semibold">
                Nội dung chi tiết (Hỗ trợ Markdown) <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Textarea
                  id="art-content"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={'## Tiêu đề phần 1\n\nNội dung đoạn văn...'}
                  rows={12}
                  className="font-mono text-xs leading-relaxed"
                />
                <div className="border border-border rounded-lg bg-muted/20 p-3 max-h-[280px] overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Xem trước trực quan
                  </div>
                  {form.content.trim() ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-10">
                      Nội dung Markdown sẽ được hiển thị xem trước ở đây.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="art-topic" className="text-xs font-semibold">
                  Chủ đề trực thuộc
                </Label>
                <select
                  id="art-topic"
                  value={form.topicId}
                  onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">— Chưa gắn chủ đề —</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="art-time" className="text-xs font-semibold">
                  Thời gian đọc (phút)
                </Label>
                <Input
                  id="art-time"
                  type="number"
                  value={form.readMinutes}
                  onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })}
                  min={1}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="art-tags" className="text-xs font-semibold">
                  Tags (cách nhau bằng phẩy)
                </Label>
                <Input
                  id="art-tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="nấu ăn, sức khỏe, mẹo hay"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-cover" className="text-xs font-semibold">
                URL ảnh bìa đại diện
              </Label>
              <Input
                id="art-cover"
                value={form.coverImageUrl}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                placeholder="https://..."
                className="h-9"
              />
              {form.coverImageUrl && (
                <div className="pt-2">
                  <img
                    src={form.coverImageUrl}
                    alt="Preview cover"
                    className="h-28 w-full object-cover rounded-lg border border-border"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="art-schedule" className="text-xs font-semibold">
                Hẹn giờ đăng (tùy chọn)
              </Label>
              <Input
                id="art-schedule"
                type="datetime-local"
                value={form.publishAt}
                onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                className="h-9"
              />
              <span className="text-[11px] text-muted-foreground block">
                Nếu chọn ngày giờ trong tương lai, bài viết sẽ ở trạng thái "Đã lên lịch" và tự động xuất bản khi đến giờ.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Hủy bỏ
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {saving ? 'Đang lưu...' : form.publishAt ? 'Lên lịch bài viết' : 'Tạo bài viết (Lưu nháp)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác Nhận Xóa */}
      <Dialog open={Boolean(deleteConfirm)} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Xóa bài viết?</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa bài viết <strong>{deleteConfirm?.title}</strong>? Thao tác này sẽ xóa vĩnh viễn bài viết khỏi hệ thống.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Hẹn giờ đăng bài viết */}
      <Dialog open={Boolean(scheduleTarget)} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar size={18} className="text-amber-500" />
              Hẹn giờ đăng bài viết
            </DialogTitle>
            <DialogDescription>
              Bài viết sẽ được tự động xuất bản lên feed đúng thời điểm đã chọn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Bài viết:</p>
              <p className="text-sm font-bold text-foreground">{scheduleTarget?.title}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-time" className="text-xs font-semibold">Thời điểm xuất bản</Label>
              <Input
                id="schedule-time"
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>
              Hủy
            </Button>
            <Button
              disabled={!scheduleDate}
              onClick={handleConfirmSchedule}
              className="bg-primary text-primary-foreground font-bold hover:bg-primary/90"
            >
              Lên lịch ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Chỉnh Sửa Bài Viết (Shadcn Dialog) */}
      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={18} className="text-blue-500" />
              Chỉnh sửa bài viết
            </DialogTitle>
            <DialogDescription>
              Cập nhật nội dung, tiêu đề hoặc hình ảnh đại diện của bài viết.
            </DialogDescription>
          </DialogHeader>

          {loadingEdit ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Đang tải nội dung bài viết...
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title" className="text-xs font-semibold">
                    Tiêu đề bài viết <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-slug" className="text-xs font-semibold">
                    Slug URL <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="edit-slug"
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="h-9 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-summary" className="text-xs font-semibold">
                  Tóm tắt ngắn gọn
                </Label>
                <Textarea
                  id="edit-summary"
                  value={editForm.summary}
                  onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-content" className="text-xs font-semibold">
                  Nội dung chi tiết (Hỗ trợ Markdown) <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Textarea
                    id="edit-content"
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                  />
                  <div className="border border-border rounded-lg bg-muted/20 p-3 max-h-[280px] overflow-y-auto">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Xem trước trực quan
                    </div>
                    {editForm.content.trim() ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: editPreviewHtml }}
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-10">
                        Nội dung Markdown sẽ được hiển thị xem trước ở đây.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-topic" className="text-xs font-semibold">
                    Chủ đề trực thuộc
                  </Label>
                  <select
                    id="edit-topic"
                    value={editForm.topicId}
                    onChange={(e) => setEditForm({ ...editForm, topicId: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">— Chưa gắn chủ đề —</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-time" className="text-xs font-semibold">
                    Thời gian đọc (phút)
                  </Label>
                  <Input
                    id="edit-time"
                    type="number"
                    value={editForm.readMinutes}
                    onChange={(e) => setEditForm({ ...editForm, readMinutes: Number(e.target.value) })}
                    min={1}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-tags" className="text-xs font-semibold">
                    Tags (cách nhau bằng phẩy)
                  </Label>
                  <Input
                    id="edit-tags"
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-cover" className="text-xs font-semibold">
                  URL ảnh bìa đại diện
                </Label>
                <Input
                  id="edit-cover"
                  value={editForm.coverImageUrl}
                  onChange={(e) => setEditForm({ ...editForm, coverImageUrl: e.target.value })}
                  placeholder="https://..."
                  className="h-9"
                />
                {editForm.coverImageUrl && (
                  <div className="pt-2">
                    <img
                      src={editForm.coverImageUrl}
                      alt="Preview cover"
                      className="h-28 w-full object-cover rounded-lg border border-border"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Hủy bỏ
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={savingEdit || loadingEdit}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
