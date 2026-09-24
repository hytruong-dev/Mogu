import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Edit2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { topicsAdminApi, type Topic, type CreateTopicDto, type UpdateTopicDto } from '../api/explore'
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
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Topic | null>(null)
  const [saving, setSaving] = useState(false)

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
    if (!searchQuery.trim()) return topics
    const q = searchQuery.toLowerCase()
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)),
    )
  }, [topics, searchQuery])

  const openCreate = () => {
    setEditing(null)
    setForm({
      slug: '',
      title: '',
      description: '',
      coverImageUrl: '',
      displayOrder: topics.length,
      isActive: true,
    })
    setShowModal(true)
  }

  const openEdit = (topic: Topic) => {
    setEditing(topic)
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
      alert('Vui lòng nhập đầy đủ tiêu đề và slug')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await topicsAdminApi.update(editing.id, form as UpdateTopicDto)
      } else {
        await topicsAdminApi.create(form)
      }
      setShowModal(false)
      await load()
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi lưu chủ đề')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await topicsAdminApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await load()
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Không thể xóa chủ đề này')
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

  return (
    <div className="space-y-6">
      {/* Heading & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <BookOpen size={28} className="text-amber-500" />
            Chủ đề khám phá (Topics)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý các danh mục chuyên đề hiển thị trên thanh cuộn ngang và khám phá của app Mogu.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus size={16} />
          <span>Thêm chủ đề mới</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên chủ đề, slug..."
              className="pl-9 h-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Hiển thị <strong className="text-foreground">{filteredTopics.length}</strong> / {topics.length} chủ đề
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold">Danh sách chủ đề</CardTitle>
          <CardDescription className="text-xs">
            Thứ tự hiển thị số nhỏ hơn sẽ được ưu tiên hiển thị trước trên app.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="m-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-5">
              <TableSkeleton rows={5} cols={6} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-20">Ảnh bìa</TableHead>
                  <TableHead className="min-w-[180px]">Tên chủ đề</TableHead>
                  <TableHead>Slug nhận diện</TableHead>
                  <TableHead className="text-center w-24">Thứ tự</TableHead>
                  <TableHead className="text-center w-28">Số bài viết</TableHead>
                  <TableHead className="text-center w-28">Trạng thái</TableHead>
                  <TableHead className="text-right w-32">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTopics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Không tìm thấy chủ đề nào phù hợp.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTopics.map((topic) => (
                    <TableRow key={topic.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        {topic.coverImageUrl ? (
                          <img
                            src={topic.coverImageUrl}
                            alt={topic.title}
                            className="w-14 h-9 object-cover rounded-md border border-border"
                          />
                        ) : (
                          <div className="w-14 h-9 rounded-md bg-muted flex items-center justify-center border border-border">
                            <ImageIcon size={14} className="text-muted-foreground/60" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground text-sm">{topic.title}</div>
                        {topic.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs mt-0.5">
                            {topic.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                          {topic.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold">
                        {topic.displayOrder}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {topic._count?.articles ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(topic)}
                          className="h-7 px-2 hover:bg-transparent"
                        >
                          {topic.isActive ? (
                            <Badge variant="success" className="cursor-pointer flex items-center gap-1">
                              <Eye size={11} /> Hiển thị
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="cursor-pointer flex items-center gap-1">
                              <EyeOff size={11} /> Đang ẩn
                            </Badge>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(topic)}
                            title="Chỉnh sửa chủ đề"
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={() => setDeleteConfirm(topic)}
                            title="Xóa chủ đề"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Tạo/Sửa Chủ Đề (Shadcn Dialog) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Chỉnh sửa chủ đề' : 'Thêm chủ đề mới'}</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin nhận diện và ảnh bìa cho chủ đề khám phá.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic-title" className="text-xs font-semibold">
                Tiêu đề chủ đề <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="topic-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="VD: Món ngon mùa mưa"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic-slug" className="text-xs font-semibold">
                Slug URL <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="topic-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="VD: mon-ngon-mua-mua"
                className="h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic-desc" className="text-xs font-semibold">
                Mô tả ngắn
              </Label>
              <Textarea
                id="topic-desc"
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả tóm tắt nội dung chủ đề..."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="topic-img" className="text-xs font-semibold">
                URL ảnh bìa
              </Label>
              <Input
                id="topic-img"
                value={form.coverImageUrl ?? ''}
                onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                placeholder="https://..."
                className="h-9"
              />
              {form.coverImageUrl && (
                <div className="pt-2">
                  <img
                    src={form.coverImageUrl}
                    alt="Xem trước ảnh bìa"
                    className="h-24 w-full object-cover rounded-lg border border-border"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="topic-order" className="text-xs font-semibold">
                  Thứ tự hiển thị
                </Label>
                <Input
                  id="topic-order"
                  type="number"
                  value={form.displayOrder ?? 0}
                  onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                  min={0}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                  <Label className="text-xs cursor-pointer">Kích hoạt hiển thị</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo chủ đề'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác Nhận Xóa */}
      <Dialog open={Boolean(deleteConfirm)} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Xóa chủ đề này?</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa chủ đề <strong>{deleteConfirm?.title}</strong>? Hành động này không thể hoàn tác.
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
    </div>
  )
}
