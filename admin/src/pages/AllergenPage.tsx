import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Eye, EyeOff, X, ShieldAlert } from 'lucide-react'
import {
  taxonomyAdminApi,
  type Allergen,
  type CreateAllergenDto,
  type UpdateAllergenDto,
} from '../api/taxonomy'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'

// ─── Icon / màu cho từng allergen ────────────────────────────────────────────
const ALLERGEN_META: Record<string, { icon: string; color: string; bg: string }> = {
  PEANUT:    { icon: '🥜', color: '#92400e', bg: '#fef3c7' },
  TREE_NUT:  { icon: '🌰', color: '#78350f', bg: '#fde68a' },
  MILK:      { icon: '🥛', color: '#1e40af', bg: '#dbeafe' },
  EGG:       { icon: '🥚', color: '#92400e', bg: '#fef9c3' },
  FISH:      { icon: '🐟', color: '#0e7490', bg: '#cffafe' },
  SHELLFISH: { icon: '🦐', color: '#9d174d', bg: '#fce7f3' },
  MOLLUSK:   { icon: '🦑', color: '#5b21b6', bg: '#ede9fe' },
  SOY:       { icon: '🌿', color: '#166534', bg: '#dcfce7' },
  WHEAT:     { icon: '🌾', color: '#854d0e', bg: '#fef9c3' },
  GLUTEN:    { icon: '🍞', color: '#92400e', bg: '#fef3c7' },
  SESAME:    { icon: '🫙', color: '#713f12', bg: '#fef3c7' },
  CELERY:    { icon: '🥬', color: '#166534', bg: '#d1fae5' },
  MUSTARD:   { icon: '🟡', color: '#854d0e', bg: '#fef9c3' },
  SULFITE:   { icon: '🍷', color: '#6b21a8', bg: '#f3e8ff' },
  LUPIN:     { icon: '🌼', color: '#0f766e', bg: '#ccfbf1' },
  OTHER:     { icon: '❓', color: '#374151', bg: '#f3f4f6' },
}

function getMeta(code: string) {
  return ALLERGEN_META[code] ?? { icon: '⚠️', color: '#374151', bg: '#f9fafb' }
}

// ─── Card allergen ────────────────────────────────────────────────────────────
function AllergenCard({
  item,
  onEdit,
  onToggle,
}: {
  item: Allergen
  onEdit: () => void
  onToggle: () => void
}) {
  const meta = getMeta(item.code)

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        background: item.active ? '#fff' : '#f9fafb',
        border: `1.5px solid ${item.active ? '#e5e7eb' : '#e5e7eb'}`,
        borderRadius: 14, padding: '14px 16px',
        opacity: item.active ? 1 : 0.6,
        gap: 8,
        position: 'relative',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: meta.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111', lineHeight: 1.3 }}>{item.name}</div>
          <code style={{
            fontSize: 11, background: meta.bg, color: meta.color,
            padding: '1px 7px', borderRadius: 5, fontWeight: 600,
          }}>{item.code}</code>
        </div>
        {/* Status badge */}
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
          background: item.active ? '#dcfce7' : '#f3f4f6',
          color: item.active ? '#166534' : '#9ca3af',
          flexShrink: 0,
        }}>
          {item.active ? 'Hiện' : 'Ẩn'}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: '#374151' }}>VD: </span>{item.description}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#374151',
          }}
        >
          <Pencil size={12} /> Sửa
        </button>
        <button
          onClick={onToggle}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 8,
            border: '1px solid #e5e7eb', background: '#fff',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            color: item.active ? '#dc2626' : '#16a34a',
          }}
        >
          {item.active ? <><EyeOff size={12} /> Ẩn</> : <><Eye size={12} /> Hiện</>}
        </button>
      </div>
    </div>
  )
}

// ─── Modal thêm/sửa ───────────────────────────────────────────────────────────
function AllergenModal({
  item,
  onClose,
  onSave,
  saving,
}: {
  item: Partial<Allergen> | null
  onClose: () => void
  onSave: (dto: CreateAllergenDto | UpdateAllergenDto) => void
  saving: boolean
}) {
  const isEdit = !!item?.id
  const [code, setCode] = useState(item?.code ?? '')
  const [name, setName] = useState(item?.name ?? '')
  const [desc, setDesc] = useState(item?.description ?? '')
  const [order, setOrder] = useState(item?.displayOrder ?? 0)
  const meta = getMeta(code)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) {
      onSave({ name, description: desc || undefined, displayOrder: order })
    } else {
      onSave({ code: code.toUpperCase(), name, description: desc || undefined, displayOrder: order })
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={20} color="#ef4444" />
            {isEdit ? 'Sửa dị ứng' : 'Thêm dị ứng mới'}
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
                placeholder="VD: PEANUT"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                required
                style={{ fontFamily: 'monospace' }}
              />
              <small style={{ color: '#9ca3af' }}>Chỉ chữ HOA, số và dấu _</small>
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Tên hiển thị <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <Input
              placeholder="VD: Đậu phộng"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Ví dụ nguyên liệu cần tránh
            </label>
            <Textarea
              placeholder="VD: Đậu phộng, dầu đậu phộng, bơ đậu phộng..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>
              Thứ tự hiển thị
            </label>
            <Input
              type="number"
              value={order}
              onChange={e => setOrder(Number(e.target.value))}
              min={0}
              style={{ width: 100 }}
            />
          </div>

          {/* Preview */}
          {(code || name) && (
            <div style={{ padding: '10px 14px', background: '#f8f9fa', borderRadius: 8, border: '1px dashed #dee2e6' }}>
              <small style={{ color: '#9ca3af', display: 'block', marginBottom: 6 }}>Xem trước</small>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, background: meta.bg, border: `1px solid ${meta.color}30` }}>
                <span style={{ fontSize: 16 }}>{meta.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: meta.color }}>{name || '...'}</span>
                <code style={{ fontSize: 10, color: meta.color, opacity: 0.7 }}>{code || '...'}</code>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 14 }}>
              Hủy
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AllergenPage() {
  const qc = useQueryClient()
  const [modalItem, setModalItem] = useState<Partial<Allergen> | null | false>(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-allergens'],
    queryFn: () => taxonomyAdminApi.listAllergens(),
  })

  const createMut = useMutation({
    mutationFn: (dto: CreateAllergenDto) => taxonomyAdminApi.createAllergen(dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-allergens'] }); setModalItem(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAllergenDto }) =>
      taxonomyAdminApi.updateAllergen(id, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-allergens'] }); setModalItem(false) },
  })

  const toggleMut = useMutation({
    mutationFn: (id: string) => taxonomyAdminApi.toggleAllergen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-allergens'] }),
  })

  const filtered = items.filter(i =>
    filter === 'all' ? true : filter === 'active' ? i.active : !i.active
  )

  const activeCount = items.filter(i => i.active).length
  const inactiveCount = items.filter(i => !i.active).length

  const handleSave = (dto: CreateAllergenDto | UpdateAllergenDto) => {
    if (modalItem && 'id' in modalItem && modalItem.id) {
      updateMut.mutate({ id: modalItem.id, dto: dto as UpdateAllergenDto })
    } else {
      createMut.mutate(dto as CreateAllergenDto)
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={24} color="#ef4444" />
            Dị ứng & Hạn chế thực phẩm
          </h1>
          <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
            Quản lý 16 nhóm dị ứng chuẩn — hiển thị trong onboarding và lọc món ăn an toàn
          </p>
        </div>
        <button
          onClick={() => setModalItem({})}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Stats + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {([
          { key: 'active', label: `Đang hiển thị (${activeCount})` },
          { key: 'inactive', label: `Đã ẩn (${inactiveCount})` },
          { key: 'all', label: `Tất cả (${items.length})` },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              fontWeight: filter === f.key ? 700 : 400,
              border: `1.5px solid ${filter === f.key ? '#ef4444' : '#e5e7eb'}`,
              background: filter === f.key ? '#fef2f2' : '#fff',
              color: filter === f.key ? '#991b1b' : '#6b7280',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>⏳ Đang tải...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 32 }}>
          {filtered.map(item => (
            <AllergenCard
              key={item.id}
              item={item}
              onEdit={() => setModalItem(item)}
              onToggle={() => toggleMut.mutate(item.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
              Không có dị ứng nào
            </div>
          )}
        </div>
      )}

      {/* Summary table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>
            📋 Danh sách đầy đủ ({items.length} nhóm)
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280', width: 40 }}>#</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Mã</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Tên</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Ví dụ nguyên liệu</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Trạng thái</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const meta = getMeta(item.code)
              return (
                <tr key={item.id} style={{ borderTop: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 12 }}>{item.displayOrder}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: meta.bg, color: meta.color, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                      {meta.icon} {item.code}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12, maxWidth: 260 }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.description ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: item.active ? '#dcfce7' : '#f3f4f6', color: item.active ? '#166534' : '#9ca3af' }}>
                      {item.active ? 'Hiển thị' : 'Đã ẩn'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        onClick={() => setModalItem(item)}
                        style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Pencil size={12} /> Sửa
                      </button>
                      <button
                        onClick={() => toggleMut.mutate(item.id)}
                        style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: item.active ? '#dc2626' : '#16a34a' }}
                      >
                        {item.active ? <><EyeOff size={12} /> Ẩn</> : <><Eye size={12} /> Hiện</>}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalItem !== false && (
        <AllergenModal
          item={modalItem}
          onClose={() => setModalItem(false)}
          onSave={handleSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  )
}
