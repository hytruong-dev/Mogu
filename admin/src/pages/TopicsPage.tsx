import { useEffect, useState } from 'react'
import { topicsAdminApi, type Topic, type CreateTopicDto, type UpdateTopicDto } from '../api/explore'
import { TableSkeleton } from '../components/ui/page-skeleton'

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
      setError(e.message ?? 'Không tải được danh sách')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ slug: '', title: '', description: '', coverImageUrl: '', displayOrder: 0, isActive: true })
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
      alert(e.response?.data?.message ?? e.message ?? 'Lỗi khi lưu')
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
      alert(e.response?.data?.message ?? e.message ?? 'Không thể xóa')
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
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chủ đề (Topics)</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Quản lý các chủ đề hiển thị trên trang Khám phá
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition"
        >
          + Thêm chủ đề
        </button>
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
                  Ảnh bìa
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tiêu đề
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Thứ tự
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Bài viết
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
              {topics.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Chưa có chủ đề nào. Thêm chủ đề đầu tiên!
                  </td>
                </tr>
              )}
              {topics.map((topic) => (
                <tr key={topic.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    {topic.coverImageUrl ? (
                      <img
                        src={topic.coverImageUrl}
                        alt={topic.title}
                        className="w-16 h-10 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-16 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No img</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{topic.title}</div>
                    {topic.description && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {topic.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                      {topic.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {topic.displayOrder}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {topic._count?.articles ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(topic)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                        topic.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {topic.isActive ? 'Hiển thị' : 'Ẩn'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(topic)}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(topic)}
                        className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editing ? 'Chỉnh sửa chủ đề' : 'Thêm chủ đề mới'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Món ngon mùa mưa"
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
                  placeholder="mon-ngon-mua-mua"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  rows={2}
                  placeholder="Mô tả ngắn về chủ đề..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL ảnh bìa
                </label>
                <input
                  type="url"
                  value={form.coverImageUrl ?? ''}
                  onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="https://..."
                />
                {form.coverImageUrl && (
                  <img
                    src={form.coverImageUrl}
                    alt="Preview"
                    className="mt-2 w-full h-28 object-cover rounded-lg"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    value={form.displayOrder ?? 0}
                    onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    min={0}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive ?? true}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 accent-yellow-400"
                    />
                    <span className="text-sm font-medium text-gray-700">Hiển thị</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.slug}
                className="px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 font-semibold rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo chủ đề'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-2">Xóa chủ đề?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Bạn có chắc muốn xóa chủ đề <strong>{deleteConfirm.title}</strong>? Hành động này
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
