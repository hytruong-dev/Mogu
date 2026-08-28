/**
 * IngredientPicker — input tìm kiếm nguyên liệu từ DB
 * Hiển thị dropdown gợi ý với ảnh + tên, click để chọn
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { ingredientsApi, type Ingredient } from '../../api/ingredients'

interface Props {
  value: string                       // tên nguyên liệu đang hiển thị
  ingredientId?: string               // id nguyên liệu đã chọn (nếu có)
  onChange: (name: string, ingredient?: Ingredient) => void
  placeholder?: string
  style?: React.CSSProperties
}

export default function IngredientPicker({ value, ingredientId: _ingredientId, onChange, placeholder = 'Tìm nguyên liệu...', style }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Ingredient[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync prop → local query khi value thay đổi từ bên ngoài
  useEffect(() => { setQuery(value) }, [value])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const data = await ingredientsApi.search(q)
      setResults(Array.isArray(data) ? data : [])
      setOpen(true)
      setHighlighted(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    onChange(q, undefined) // cập nhật tên text, xoá ingredientId
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  const select = (ing: Ingredient) => {
    setQuery(ing.name)
    onChange(ing.name, ing)
    setOpen(false)
    setResults([])
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      select(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Auto-scroll highlighted item vào view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.closest('.ing-picker-wrap')?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="ing-picker-wrap" style={{ position: 'relative', flex: 2, ...style }}>
      <input
        ref={inputRef}
        value={query}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '0 12px',
          height: 38,
          border: '1.5px solid var(--border, #e8e8e8)',
          borderRadius: 8,
          fontSize: 14,
          outline: 'none',
          background: '#fff',
          boxSizing: 'border-box',
        }}
        onFocusCapture={e => (e.target as HTMLInputElement).style.borderColor = '#f0a500'}
        onBlurCapture={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border, #e8e8e8)'}
      />

      {/* Loading spinner */}
      {loading && (
        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#aaa' }}>
          ⟳
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: '#fff',
            border: '1.5px solid #f0a500',
            borderRadius: 10,
            marginTop: 4,
            padding: 4,
            maxHeight: 260,
            overflowY: 'auto',
            listStyle: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {results.map((ing, i) => (
            <li
              key={ing.id}
              onMouseDown={() => select(ing)}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                background: highlighted === i ? '#fff8ed' : 'transparent',
                transition: 'background 0.12s',
              }}
            >
              {/* Ảnh nguyên liệu */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#f5f5f5',
                flexShrink: 0,
                border: '1px solid #eee',
              }}>
                {ing.imageUrl
                  ? <img src={ing.imageUrl} alt={ing.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🥬</div>
                }
              </div>

              {/* Tên + allergen */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#222', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ing.name}
                </div>
                {ing.synonyms?.length > 0 && (
                  <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{ing.synonyms[0]}</div>
                )}
              </div>

              {/* Badge allergen */}
              {ing.allergenCode && (
                <span style={{
                  fontSize: 10,
                  background: '#fff3e0',
                  color: '#e65100',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {ing.allergenCode}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Không tìm thấy */}
      {open && !loading && results.length === 0 && query.trim() && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#fff',
          border: '1.5px solid #eee',
          borderRadius: 10,
          marginTop: 4,
          padding: '12px 16px',
          fontSize: 13,
          color: '#aaa',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          Không tìm thấy &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
