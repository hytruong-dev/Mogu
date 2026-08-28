import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Eye, EyeOff, X } from 'lucide-react'
import { taxonomyAdminApi, type DietType, type CreateCategoryDto } from '../api/taxonomy'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'

// ─── Icon map cho từng chế độ ăn ──────────────────────────────────────────────
const DIET_ICONS: Record<string, string> = {
  NORMAL: '🍽️',
  VEGETARIAN: '🥚',
  VEGAN: '🌱',
  PESCATARIAN: '🐟',
  HALAL: '☪️',
  KETO: '🥑',
  LOW_CARB: '🥦',
  HIGH_PROTEIN: '💪',
  LOW_CALORIE: '⚖️',
  LOW_FAT: '🫙',
  LOW_SODIUM: '🧂',
  GLUTEN_FREE: '🌾',
}

const DIET_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  NORMAL:       { bg: '#f8f9fa', border: '#dee2e6', text: '#495057' },
  VEGETARIAN:   { bg: '#f0fff4', border: '#86efac', text: '#166534' },
  VEGAN:        { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
  PESCATARIAN:  { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  HALAL:        { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  KETO:         { bg: '#fdf4ff', border: '#d8b4fe', text: '#6b21a8' },
  LOW_CARB:     { bg: '#fefce8', border: '#fde047', text: '#713f12' },
  HIGH_PROTEIN: { bg: '#fff1f2', border: '#fca5a5', text: '#991b1b' },
  LOW_CALORIE:  { bg: '#f0f9ff', border: '#7dd3fc', text: '#075985' },
  LOW_FAT:      { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
  LOW_SODIUM:   { bg: '#fafaf9', border: '#d6d3d1', text: '#44403c' },
  GLUTEN_FREE:  { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
}

function getColor(code: string) {
  return DIET_COLORS[code] ?? { bg: '#f8f9fa', border: '#dee2e6', text: '#495057' }
}

// ─── Diet badge ───────────────────────────────────────────────────────────────
function DietBadge({
  item,
  selected,
  onSelect,
  onEdit,
  onToggle,
}: {
  item: DietType
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onToggle: () => void
}) {
  const [hover, setHover] = useState(false)
  const color = getColor(item.code)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 12,
        border: `1.5px solid ${item.isActive ? (selected ? color.border : '#d1c9b8') : '#e5e5e5'}`,
        background: item.isActive
          ? selected ? color.bg : hover ? '#fafaf8' : '#fff'
          : '#f5f5f5',
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: item.isActive ? 1 : 0.5,
        userSelect: 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
    >
      <span style={{ fontSize: 18 }}>{DIET_ICONS[item.code] ?? '🍴'}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: item.isActive ? color.text : '#999', lineHeight: 1.3 }}>
          {item.name}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{item.code}</div>
      </div>
      {/* action buttons */}
      <div
        style={{ display: 'flex', gap: 4, marginLeft: 4 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          title="Chỉnh sửa"
          onClick={onEdit}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', borderRadius: 4 }}
        >
          <Pencil size={13} />
        </button>
        <button
          title={item.isActive ? 'Ẩn' : 'Hiện'}
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', borderRadius: 4 }}
        >
          {item.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  )
}

// ─── Modal thêm/sửa ───────────────────────────────────────────────────────────
function DietTypeModal({
  item,
  onClose,
  onSave,
  saving,
}: {
  item: Partial<DietType> | null
  onClose: () => void
  onSave: (dto: CreateCategoryDto) => void
  saving: boolean
}) {
  const isEdit = !!item?.id
  const [code, setCode] = useState(item?.code ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [desc, setDesc] = useState(item?.description ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ code: code.toUpperCase(), name, description: desc || undefined })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {isEdit ? '✏️ Sửa chế độ ăn' : '➕ Thêm chế độ ăn'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
                Mã (code) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <Input
                placeholder="VD: HIGH_PROTEIN"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                required
                style={{ fontFamily: 'monospace' }}
              />
              <small style={{ color: '#9ca3af' }}>Chỉ chữ HOA, số và dấu _. Không thể thay đổi sau khi tạo.</small>
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Tên hiển thị <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Input
              placeholder="VD: Giàu đạm"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Mô tả ngắn
            </label>
            <Textarea
              placeholder="Mô tả về chế độ ăn này..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
            />
          </div>

          {/* Preview */}
          {(code || name) && (
            <div style={{ padding: '10px 14px', background: '#f8f9fa', borderRadius: 8, border: '1px dashed #dee2e6' }}>
              <small style={{ color: '#9ca3af', display: 'block', marginBottom: 6 }}>Xem trước</small>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 10, border: `1.5px solid ${getColor(code).border}`, background: getColor(code).bg }}>
                <span style={{ fontSize: 16 }}>{DIET_ICONS[code] ?? '🍴'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: getColor(code).text }}>{name || '...'}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{code || '...'}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
              Hủy
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#f0a500', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DietTypesPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [modalItem, setModalItem] = useState<Partial<DietType> | null | false>(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-diet-types'],
    queryFn: () => taxonomyAdminApi.listDietTypes(),
  })

  const createMut = useMutation({
    mutationFn: (dto: CreateCategoryDto) => taxonomyAdminApi.createDietType(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-diet-types'] }); setModalItem(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => taxonomyAdminApi.updateDietType(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-diet-types'] }),
  })

  const filtered = items.filter(i =>
    filter === 'all' ? true : filter === 'active' ? i.isActive : !i.isActive
  )

  const selectedItem = selected ? items.find(i => i.id === selected) : null

  const handleSave = (dto: CreateCategoryDto) => {
    if (modalItem && 'id' in modalItem && modalItem.id) {
      updateMut.mutate({ id: modalItem.id, dto: { name: dto.name, description: dto.description } }, {
        onSuccess: () => setModalItem(false),
      })
    } else {
      createMut.mutate(dto)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🥗 Chế độ ăn</h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
            Quản lý các chế độ dinh dưỡng — hiển thị trong onboarding và lọc món ăn
          </p>
        </div>
        <button
          onClick={() => setModalItem({})}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#f0a500', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: filter === f ? 700 : 400,
              border: `1.5px solid ${filter === f ? '#f0a500' : '#e5e7eb'}`,
              background: filter === f ? '#fffbeb' : '#fff',
              color: filter === f ? '#92400e' : '#6b7280',
            }}
          >
            {f === 'all' ? `Tất cả (${items.length})` : f === 'active' ? `Đang hiển thị (${items.filter(i => i.isActive).length})` : `Đã ẩn (${items.filter(i => !i.isActive).length})`}
          </button>
        ))}
      </div>

      {/* Badge grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>⏳ Đang tải...</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
          {filtered.map(item => (
            <DietBadge
              key={item.id}
              item={item}
              selected={selected === item.id}
              onSelect={() => setSelected(s => s === item.id ? null : item.id)}
              onEdit={() => setModalItem(item)}
              onToggle={() => updateMut.mutate({ id: item.id, dto: { isActive: !item.isActive } })}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 14, padding: 24 }}>Không có chế độ ăn nào</div>
          )}
        </div>
      )}

      {/* Detail panel (khi chọn) */}
      {selectedItem && (
        <div style={{ padding: 24, borderRadius: 14, border: '1px solid #e5e7eb', background: '#fafaf8', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 32 }}>{DIET_ICONS[selectedItem.code] ?? '🍴'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedItem.name}</div>
              <code style={{ fontSize: 12, background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{selectedItem.code}</code>
              <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 6, background: selectedItem.isActive ? '#dcfce7' : '#f3f4f6', color: selectedItem.isActive ? '#166534' : '#6b7280' }}>
                {selectedItem.isActive ? '✓ Đang hiển thị' : '✗ Đã ẩn'}
              </span>
            </div>
          </div>
          {selectedItem.description && (
            <p style={{ margin: '0 0 16px', color: '#4b5563', fontSize: 14, lineHeight: 1.6 }}>
              {selectedItem.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setModalItem(selectedItem)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Pencil size={13} /> Chỉnh sửa
            </button>
            <button
              onClick={() => updateMut.mutate({ id: selectedItem.id, dto: { isActive: !selectedItem.isActive } })}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: selectedItem.isActive ? '#dc2626' : '#16a34a' }}
            >
              {selectedItem.isActive ? <><EyeOff size={13} /> Ẩn đi</> : <><Eye size={13} /> Hiện lại</>}
            </button>
          </div>
        </div>
      )}

      {/* Summary table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Mã</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Tên</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Mô tả</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Trạng thái</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 16px' }}>
                  <code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 5 }}>{item.code}</code>
                </td>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                  {DIET_ICONS[item.code] ?? '🍴'} {item.name}
                </td>
                <td style={{ padding: '10px 16px', color: '#6b7280', maxWidth: 280 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description ?? '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#9ca3af' }}>
                    {item.isActive ? 'Hiển thị' : 'Đã ẩn'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button
                      onClick={() => setModalItem(item)}
                      title="Sửa"
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Pencil size={12} /> Sửa
                    </button>
                    <button
                      onClick={() => updateMut.mutate({ id: item.id, dto: { isActive: !item.isActive } })}
                      title={item.isActive ? 'Ẩn' : 'Hiện'}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: item.isActive ? '#dc2626' : '#16a34a' }}
                    >
                      {item.isActive ? <><EyeOff size={12} /> Ẩn</> : <><Eye size={12} /> Hiện</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalItem !== false && (
        <DietTypeModal
          item={modalItem}
          onClose={() => setModalItem(false)}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  )
}
