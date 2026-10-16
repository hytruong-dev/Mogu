import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { MediaLightbox, useMediaLightbox } from '../components/ui/media-lightbox'
import { topicsAdminApi, type Topic, type CreateTopicDto, type UpdateTopicDto } from '../api/explore'
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
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { Image } from '../components/ui/image'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { PageContainer } from '../components/layout'
import { ImageUpload } from '../components/ui/image-upload'

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

export default function TopicsPage() {
  const { lightboxProps } = useMediaLightbox()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Topic | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState<CreateTopicDto>({
    slug: '',
    title: '',
    description: '',
    coverImageUrl: '',
    displayOrder: 0,
    isActive: true,
  })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await topicsAdminApi.list()
      setTopics(data)
    } catch (e: any) {
      setError(e.message ?? 'Không tải được danh sách chủ đề')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchesSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && t.isActive) ||
        (statusFilter === 'INACTIVE' && !t.isActive)

      return matchesSearch && matchesStatus
    })
  }, [topics, searchQuery, statusFilter])

  // Stats calculation
  const stats = useMemo(() => {
    const total = topics.length
    const active = topics.filter((t) => t.isActive).length
    const inactive = total - active
    const totalArticles = topics.reduce((sum, t) => sum + (t._count?.articles ?? 0), 0)
    return { total, active, inactive, totalArticles }
  }, [topics])

  const openCreate = () => {
    setEditing(null)
    setFormError('')
    setForm({
      slug: '',
      title: '',
      description: '',
      coverImageUrl: '',
      displayOrder: topics.length + 1,
      isActive: true,
    })
    setShowModal(true)
  }

  const openEdit = (topic: Topic) => {
    setEditing(topic)
    setFormError('')
    setForm({
      slug: topic.slug,
      title: topic.title,
      description: topic.description ?? '',
      coverImageUrl: topic.coverImageUrl ?? '',
      displayOrder: topic.displayOrder,
      isActive: topic.isActive,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) {
      setFormError('Vui lòng nhập đầy đủ tiêu đề và slug URL')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await topicsAdminApi.update(editing.id, form as UpdateTopicDto)
      } else {
        await topicsAdminApi.create(form)
      }
      setShowModal(false)
      await load()
    } catch (e: any) {
      setFormError(e.response?.data?.message ?? e.message ?? 'Lỗi khi lưu chủ đề')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await topicsAdminApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await load()
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Không thể xóa chủ đề này')
    } finally {
      setDeleting(false)
    }
  }

  const toggleActive = async (topic: Topic) => {
    try {
      await topicsAdminApi.update(topic.id, { isActive: !topic.isActive })
      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'ALL')

  return (
    <PageContainer className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <BookOpen size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Chủ đề khám phá (Topics)
                <Badge variant="secondary" className="font-mono text-xs font-semibold">
                  {topics.length} chủ đề
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quản lý các nhóm danh mục ẩm thực hiển thị trên thanh cuộn ngang feed Khám phá của ứng dụng Mogu.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={openCreate}
          className="font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm flex items-center gap-1.5 h-9 px-4 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Thêm chủ đề mới</span>
        </Button>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Tổng số chủ đề
              </span>
              <div className="text-2xl font-bold text-foreground font-mono">{stats.total}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <BookOpen size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-emerald-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Đang hiển thị
              </span>
              <div className="text-2xl font-bold text-emerald-600 font-mono">{stats.active}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-slate-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Đang tạm ẩn
              </span>
              <div className="text-2xl font-bold text-muted-foreground font-mono">{stats.inactive}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center shrink-0">
              <EyeOff size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs hover:border-blue-500/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Bài viết liên kết
              </span>
              <div className="text-2xl font-bold text-blue-600 font-mono">{stats.totalArticles}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm chủ đề theo tên, slug, mô tả..."
                className="pl-9 pr-8 h-9 text-xs bg-muted/30 focus-visible:bg-card"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('ALL')
                }}
                className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw size={12} />
                Đặt lại
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Tabs
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="shrink-0"
            >
              <TabsList className="bg-muted/60 p-1 h-9">
                <TabsTrigger value="ALL" className="text-xs px-2.5">
                  Tất cả ({topics.length})
                </TabsTrigger>
                <TabsTrigger value="ACTIVE" className="text-xs px-2.5">
                  Đang hiện ({stats.active})
                </TabsTrigger>
                <TabsTrigger value="INACTIVE" className="text-xs px-2.5">
                  Đang ẩn ({stats.inactive})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <span className="text-xs text-muted-foreground hidden lg:inline">
              Hiển thị <strong className="text-foreground font-mono">{filteredTopics.length}</strong> / {topics.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[280px]">Ảnh bìa & Chủ đề</TableHead>
                <TableHead className="w-48">Slug nhận diện</TableHead>
                <TableHead className="w-24 text-center">Thứ tự</TableHead>
                <TableHead className="w-28 text-center">Số bài viết</TableHead>
                <TableHead className="w-36 text-center">Trạng thái</TableHead>
                <TableHead className="w-28 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTopics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <BookOpen size={36} className="text-muted-foreground/30" />
                      <span className="text-sm font-medium">Không tìm thấy chủ đề nào phù hợp.</span>
                      <p className="text-xs text-muted-foreground/70">
                        Thử thay đổi bộ lọc tìm kiếm hoặc bấm Thêm chủ đề mới.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTopics.map((topic) => (
                  <TableRow key={topic.id} className="hover:bg-muted/30 transition-colors">
                    {/* Cover & Title */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        {topic.coverImageUrl ? (
                          <Image
                            src={topic.coverImageUrl}
                            alt={topic.title}
                            aspectRatio="video"
                            zoomable
                            title={topic.title}
                            subtitle="Ảnh bìa chủ đề"
                            className="w-16 h-11 object-cover rounded-lg border border-border/80 shadow-xs shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-11 rounded-lg bg-muted flex items-center justify-center border border-border/80 shrink-0 text-muted-foreground/60">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground text-xs sm:text-sm">
                            {topic.title}
                          </div>
                          {topic.description ? (
                            <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-sm mt-0.5">
                              {topic.description}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground/60 italic mt-0.5">
                              Chưa có mô tả chi tiết
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Slug */}
                    <TableCell>
                      <code className="text-[11px] bg-muted/60 px-2 py-1 rounded-md font-mono text-muted-foreground border border-border/40">
                        {topic.slug}
                      </code>
                    </TableCell>

                    {/* Display Order */}
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted/50 font-mono text-xs font-semibold text-foreground border border-border/40">
                        {topic.displayOrder}
                      </span>
                    </TableCell>

                    {/* Articles count */}
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60"
                      >
                        {topic._count?.articles ?? 0} bài
                      </Badge>
                    </TableCell>

                    {/* Active toggle */}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(topic)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:scale-105 ${
                          topic.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400'
                        }`}
                        title="Bấm để bật / tắt hiển thị trên ứng dụng"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${topic.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {topic.isActive ? 'Đang hiển thị' : 'Đang tạm ẩn'}
                      </button>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          onClick={() => openEdit(topic)}
                          title="Chỉnh sửa chủ đề"
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => setDeleteConfirm(topic)}
                          title="Xóa chủ đề"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── MODAL THÊM / CHỈNH SỬA CHỦ ĐỀ (Redesigned) ── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                {editing ? <Pencil size={18} /> : <Sparkles size={18} />}
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {editing ? 'Chỉnh sửa chủ đề' : 'Thêm chủ đề khám phá mới'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Cập nhật thông tin nhận diện, slug URL và ảnh bìa đại diện cho nhóm chủ đề.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Title & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="topic-title" className="text-xs font-semibold text-foreground">
                  Tiêu đề chủ đề <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="topic-title"
                  value={form.title}
                  onChange={(e) => {
                    const newTitle = e.target.value
                    setForm((prev) => ({
                      ...prev,
                      title: newTitle,
                      slug: !prev.slug || prev.slug === slugify(prev.title) ? slugify(newTitle) : prev.slug,
                    }))
                  }}
                  placeholder="VD: Món ngon mùa mưa"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="topic-slug" className="text-xs font-semibold text-foreground">
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
                  id="topic-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="mon-ngon-mua-mua"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="topic-desc" className="text-xs font-semibold text-foreground">
                Mô tả tóm tắt
              </Label>
              <Textarea
                id="topic-desc"
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả nội dung thu hút xuất hiện bên dưới tiêu đề chủ đề..."
                rows={2}
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Cover Image Upload */}
            <ImageUpload
              value={form.coverImageUrl ?? ''}
              onChange={(url) => setForm({ ...form, coverImageUrl: url })}
              folder="topics"
              label="Ảnh bìa đại diện chủ đề"
              aspectRatio="video"
            />

            {/* Display Order & Active Switch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-1.5">
                <Label htmlFor="topic-order" className="text-xs font-semibold text-foreground">
                  Thứ tự hiển thị (Priority)
                </Label>
                <Input
                  id="topic-order"
                  type="number"
                  value={form.displayOrder ?? 0}
                  onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                  min={0}
                  className="h-9 text-xs font-mono"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Số thứ tự nhỏ hơn sẽ được ưu tiên xuất hiện trước trên thanh cuộn.
                </span>
              </div>

              <div className="space-y-1.5 flex flex-col justify-between">
                <Label className="text-xs font-semibold text-foreground">Trạng thái phát hành</Label>
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border/60">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      {form.isActive ? 'Kích hoạt hiển thị' : 'Tạm ẩn chủ đề'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {form.isActive ? 'Sẽ xuất hiện trên App người dùng' : 'Ẩn khỏi thanh cuộn feed'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="h-9 px-4 text-xs">
              Hủy bỏ
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo chủ đề'}
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
              Xác nhận xóa chủ đề?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa chủ đề{' '}
              <strong className="text-foreground">"{deleteConfirm?.title}"</strong>? Các bài viết thuộc chủ đề này
              sẽ được chuyển về trạng thái Chưa gắn chủ đề.
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
