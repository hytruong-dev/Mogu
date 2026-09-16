import { useEffect, useState } from 'react'
import { articlesAdminApi, topicsAdminApi, type Article, type Topic } from '../api/explore'
import { TableSkeleton } from '../components/ui/page-skeleton'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Nháp', cls: 'bg-gray-100 text-gray-600' },
  PUBLISHED: { label: 'Đã đăng', cls: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'Lưu trữ', cls: 'bg-yellow-100 text-yellow-700' },
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [filterTopicId, setFilterTopicId] = useState('')
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
  })
  const [saving, setSaving] = useState(false)

  const load = async (q?: string, topicId?: string) => {
    setLoading(true)
    setError('')
    try {
      const result = await articlesAdminApi.list({ q, topicId: topicId || undefined, limit: 50 })
      setArticles(result.data ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Không tải được bài viết')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    topicsAdminApi.list().then(setTopics).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(searchQ, filterTopicId), 400)
    return () => clearTimeout(timer)
  }, [searchQ, filterTopicId])

  const handleTogglePublish = async (article: Article) => {
    try {
      await articlesAdminApi.publish(article.id)
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi')
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await articlesAdminApi.delete(deleteConfirm.id)
      setDeleteConfirm(null)
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Không thể xóa')
    }
  }

  const handleCreate = async () => {
    if (!form.title || !form.slug || !form.content) {
      alert('Vui lòng nhập đầy đủ Slug, Tiêu đề và Nội dung')
      return
    }
    setSaving(true)
    try {
      await articlesAdminApi.create({
        slug: form.slug,
        title: form.title,
        summary: form.summary || undefined,
        content: form.content,
        coverImageUrl: form.coverImageUrl || undefined,
        readMinutes: form.readMinutes,
        topicId: form.topicId || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      })
      setShowCreateModal(false)
      await load(searchQ, filterTopicId)
    } catch (e: any) {
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi tạo bài viết')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bài viết</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Quản lý bài viết xuất hiện trên trang Khám phá
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition"
        >
          + Viết bài mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Tìm bài viết..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        <select
          value={filterTopicId}
          onChange={(e) => setFilterTopicId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 min-w-[160px]"
        >
          <option value="">Tất cả chủ đề</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ảnh / Tiêu đề
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Chủ đề
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Đọc
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Lượt xem
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Không có bài viết nào
                  </td>
                </tr>
              )}
              {articles.map((article) => {
                const statusInfo = STATUS_LABELS[article.status] ?? STATUS_LABELS.DRAFT
                return (
                  <tr key={article.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {article.coverImageUrl ? (
                          <img
                            src={article.coverImageUrl}
                            alt=""
                            className="w-14 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-10 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                            <span className="text-gray-400 text-[10px]">No img</span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 line-clamp-2 max-w-xs">
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {article.author?.displayName ?? '—'} ·{' '}
                            {new Date(article.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {article.topic ? (
                        <span className="text-sm text-gray-600">{article.topic.title}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {article.readMinutes} phút
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {article.viewCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleTogglePublish(article)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                            article.status === 'PUBLISHED'
                              ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                              : 'border-green-300 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {article.status === 'PUBLISHED' ? 'Ẩn' : 'Đăng'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(article)}
                          className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Viết bài mới</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="tieu-de-bai-viet"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tóm tắt</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nội dung (Markdown) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  rows={8}
                  placeholder="## Tiêu đề&#10;&#10;Nội dung bài viết..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
                  <select
                    value={form.topicId}
                    onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    <option value="">— Không có chủ đề —</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thời gian đọc (phút)
                  </label>
                  <input
                    type="number"
                    value={form.readMinutes}
                    onChange={(e) => setForm({ ...form, readMinutes: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh bìa</label>
                <input
                  type="url"
                  value={form.coverImageUrl}
                  onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="dinh dưỡng, sức khỏe, mẹo hay"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 font-semibold rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Tạo bài viết (Nháp)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-2">Xóa bài viết?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Bạn có chắc muốn xóa bài viết{' '}
              <strong className="text-gray-900">{deleteConfirm.title}</strong>? Hành động này
              không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
