import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taxonomyAdminApi, type Category, type MealType, type CreateCategoryDto } from '../api/taxonomy'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'

// ─── Badge tương tác (click để chọn) ──────────────────────────────────────────
function CategoryBadge({
  item,
  selected,
  onSelect,
  onEdit,
  onToggle,
  tone = 'default',
}: {
  item: Category | MealType
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onToggle: () => void
  tone?: 'default' | 'meal'
}) {
  const [hover, setHover] = useState(false)

  const activeColor = tone === 'meal' ? '#3b82f6' : '#f0a500'
  const activeLight = tone === 'meal' ? '#eff6ff' : '#fffbeb'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 999,
        border: `1.5px solid ${item.isActive ? (selected ? activeColor : '#d1c9b8') : '#e5e5e5'}`,
        background: item.isActive
          ? selected
            ? activeLight
            : hover
            ? '#fafaf8'
            : '#fff'
          : '#f5f5f5',
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: item.isActive ? 1 : 0.55,
        position: 'relative',
        userSelect: 'none',
      }}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        color: item.isActive ? (selected ? activeColor : '#2c1810') : '#aaa',
      }}>
        {item.name}
      </span>
      {selected && (
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              border: 'none', background: activeColor,
              color: '#fff', cursor: 'pointer', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
            title="Sửa"
          >Edit</button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              border: 'none',
              background: item.isActive ? '#ef4444' : '#22c55e',
              color: '#fff', cursor: 'pointer', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
            title={item.isActive ? 'Ẩn' : 'Hiện'}
          >{item.isActive ? 'Ẩn' : 'Hiện'}</button>
        </div>
      )}
    </div>
  )
}

// ─── Modal thêm/sửa ────────────────────────────────────────────────────────────
function CategoryModal({
  item,
  type,
  onClose,
  onSave,
}: {
  item?: Category | MealType | null
  type: 'category' | 'meal-type'
  onClose: () => void
  onSave: (dto: CreateCategoryDto) => Promise<void>
}) {
  const isEdit = !!item
  const typeLabel = type === 'category' ? 'danh mục' : 'loại bữa ăn'

  const [form, setForm] = useState<CreateCategoryDto>({
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: (item as Category)?.description ?? '',
    displayOrder: item?.displayOrder ?? 0,
    isActive: item?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Tên không được trống')

    setSaving(true)
    setError('')
    try {
      // Auto-generate code từ name nếu chưa có (chỉ khi tạo mới)
      const finalDto = {
        ...form,
        code: form.code || form.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, ''),
      }
      await onSave(finalDto)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          padding: '28px 32px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#2c1810' }}>
          {isEdit ? `Sửa ${typeLabel}` : `Thêm ${typeLabel} mới`}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
              Tên hiển thị *
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="vd: Cơm, Phở & Bún, Hải sản..."
              style={{ width: '100%', boxSizing: 'border-box' }}
              required
            />
          </div>

          {type === 'category' && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                Mô tả
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả ngắn về danh mục..."
                rows={2}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="cat-active"
              checked={form.isActive}
              onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="cat-active" style={{ fontSize: 14, fontWeight: 500, color: '#333', cursor: 'pointer' }}>
              Kích hoạt
            </label>
          </div>

          {error && (
            <div style={{
              background: '#fff0f0', color: '#c0392b', borderRadius: 10,
              padding: '10px 14px', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px', borderRadius: 10, border: '1px solid #ddd',
                background: '#fff', color: '#555', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 24px', borderRadius: 10, border: 'none',
                background: '#f0a500', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}
            >
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────────
function TaxonomySection({
  title,
  subtitle,
  emoji,
  items,
  tone,
  onAdd,
  onEdit,
  onToggle,
  loading,
}: {
  title: string
  subtitle: string
  emoji: string
  items: (Category | MealType)[]
  tone: 'default' | 'meal'
  onAdd: () => void
  onEdit: (item: Category | MealType) => void
  onToggle: (item: Category | MealType) => void
  loading: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const active = items.filter(i => i.isActive)
  const inactive = items.filter(i => !i.isActive)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      padding: '24px 28px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid #f0ebe2',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>{emoji}</span>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#2c1810' }}>{title}</h2>
            <span style={{
              background: '#f5f0e8', color: '#8b6f47',
              borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600,
            }}>
              {active.length} mục
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>{subtitle}</p>
        </div>
        <button
          onClick={onAdd}
          style={{
            padding: '8px 18px', borderRadius: 999, border: 'none',
            background: tone === 'meal' ? '#3b82f6' : '#f0a500',
            color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span>
          Thêm mới
        </button>
      </div>

      {/* Nhãn hướng dẫn */}
      {items.length > 0 && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#bbb' }}>
          💡 Click vào badge để chọn và hiện nút sửa / ẩn
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '20px 0', color: '#aaa', textAlign: 'center', fontSize: 14 }}>
          Đang tải...
        </div>
      )}

      {/* Active badges */}
      {!loading && active.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: inactive.length ? 16 : 0 }}>
          {active.map(item => (
            <CategoryBadge
              key={item.id}
              item={item}
              selected={selected === item.id}
              onSelect={() => setSelected(selected === item.id ? null : item.id)}
              onEdit={() => onEdit(item)}
              onToggle={() => onToggle(item)}
              tone={tone}
            />
          ))}
        </div>
      )}

      {/* Divider + inactive */}
      {!loading && inactive.length > 0 && (
        <>
          <div style={{ borderTop: '1px dashed #eee', paddingTop: 14, marginTop: 4 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#ccc', fontWeight: 600 }}>
              ĐÃ ẨN ({inactive.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {inactive.map(item => (
                <CategoryBadge
                  key={item.id}
                  item={item}
                  selected={selected === item.id}
                  onSelect={() => setSelected(selected === item.id ? null : item.id)}
                  onEdit={() => onEdit(item)}
                  onToggle={() => onToggle(item)}
                  tone={tone}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && items.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#bbb', fontSize: 14 }}>
          Chưa có dữ liệu. Nhấn <b>+ Thêm mới</b> để bắt đầu.
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const qc = useQueryClient()

  // Modal state
  const [modal, setModal] = useState<{
    open: boolean
    type: 'category' | 'meal-type'
    item: Category | MealType | null
  }>({ open: false, type: 'category', item: null })

  // Queries
  const { data: categories = [], isLoading: loadingCat } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: taxonomyAdminApi.listCategories,
  })

  const { data: mealTypes = [], isLoading: loadingMeal } = useQuery({
    queryKey: ['admin-meal-types'],
    queryFn: taxonomyAdminApi.listMealTypes,
  })

  // Mutations
  const createCatMut = useMutation({
    mutationFn: taxonomyAdminApi.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  })
  const updateCatMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => taxonomyAdminApi.updateCategory(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  })
  const toggleCatMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      taxonomyAdminApi.updateCategory(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
  })

  const createMealMut = useMutation({
    mutationFn: taxonomyAdminApi.createMealType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-meal-types'] }),
  })
  const updateMealMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => taxonomyAdminApi.updateMealType(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-meal-types'] }),
  })
  const toggleMealMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      taxonomyAdminApi.updateMealType(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-meal-types'] }),
  })

  // Handlers
  const handleSave = async (dto: CreateCategoryDto) => {
    if (modal.type === 'category') {
      if (modal.item) {
        await updateCatMut.mutateAsync({ id: modal.item.id, dto })
      } else {
        await createCatMut.mutateAsync(dto)
      }
    } else {
      if (modal.item) {
        await updateMealMut.mutateAsync({ id: modal.item.id, dto })
      } else {
        await createMealMut.mutateAsync(dto)
      }
    }
    setModal({ open: false, type: 'category', item: null })
  }

  const handleToggle = (type: 'category' | 'meal-type', item: Category | MealType) => {
    if (type === 'category') {
      toggleCatMut.mutate({ id: item.id, isActive: !item.isActive })
    } else {
      toggleMealMut.mutate({ id: item.id, isActive: !item.isActive })
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#2c1810' }}>
          🏷️ Quản lý danh mục
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: '#8b6f47' }}>
          Quản lý danh mục món ăn và loại bữa ăn hiển thị trên ứng dụng
        </p>
      </div>

      {/* Preview badge strip (giống app mobile) */}
      <div style={{
        background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)',
        border: '1px solid #f0ebe2',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 28,
      }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#8b6f47', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📱 Preview — Danh mục hiển thị trên app
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.filter(c => c.isActive).map(c => (
            <span
              key={c.id}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                border: '1px solid #e5e0d8',
                background: '#fff',
                fontSize: 14,
                fontWeight: 500,
                color: '#2c1810',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {c.name}
            </span>
          ))}
          {categories.filter(c => c.isActive).length === 0 && (
            <span style={{ color: '#bbb', fontSize: 14 }}>Chưa có danh mục nào được kích hoạt</span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <TaxonomySection
          title="Danh mục món ăn"
          subtitle="Các loại món ăn: Cơm, Phở & Bún, Bánh, Lẩu..."
          emoji="🍽️"
          items={categories}
          tone="default"
          loading={loadingCat}
          onAdd={() => setModal({ open: true, type: 'category', item: null })}
          onEdit={(item) => setModal({ open: true, type: 'category', item })}
          onToggle={(item) => handleToggle('category', item)}
        />

        <TaxonomySection
          title="Loại bữa ăn"
          subtitle="Buổi ăn phù hợp: Sáng, Trưa, Tối, Ăn vặt..."
          emoji="🕐"
          items={mealTypes}
          tone="meal"
          loading={loadingMeal}
          onAdd={() => setModal({ open: true, type: 'meal-type', item: null })}
          onEdit={(item) => setModal({ open: true, type: 'meal-type', item })}
          onToggle={(item) => handleToggle('meal-type', item)}
        />
      </div>

      {/* Stats */}
      <div style={{
        marginTop: 28,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
      }}>
        {[
          { label: 'Danh mục hoạt động', value: categories.filter(c => c.isActive).length, emoji: '✅' },
          { label: 'Danh mục ẩn', value: categories.filter(c => !c.isActive).length, emoji: '🙈' },
          { label: 'Loại bữa hoạt động', value: mealTypes.filter(m => m.isActive).length, emoji: '✅' },
          { label: 'Loại bữa ẩn', value: mealTypes.filter(m => !m.isActive).length, emoji: '🙈' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: '16px 20px',
              border: '1px solid #f0ebe2',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 24 }}>{stat.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#2c1810', marginTop: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal.open && (
        <CategoryModal
          item={modal.item}
          type={modal.type}
          onClose={() => setModal({ open: false, type: 'category', item: null })}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
