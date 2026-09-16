/**
 * IngredientPicker — search catalog, link existing, or explicitly create PENDING.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { ingredientsApi, type Ingredient } from '../../api/ingredients'

interface Props {
  value: string
  ingredientId?: string
  ingredientImageUrl?: string
  ingredientStatus?: Ingredient['status']
  resolutionStatus?:
    | 'EMPTY'
    | 'SEARCHING'
    | 'LINKED'
    | 'NOT_FOUND'
    | 'PROVISIONING'
    | 'PENDING_REVIEW'
    | 'AMBIGUOUS'
    | 'ERROR'
  onChange: (
    name: string,
    ingredient?: Ingredient,
    meta?: { resolutionStatus?: Props['resolutionStatus'] },
  ) => void
  placeholder?: string
  style?: React.CSSProperties
  allowCreate?: boolean
}

export default function IngredientPicker({
  value,
  ingredientId: _ingredientId,
  ingredientImageUrl,
  ingredientStatus,
  resolutionStatus,
  onChange,
  placeholder = 'Tìm nguyên liệu...',
  style,
  allowCreate = true,
}: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Ingredient[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const data = await ingredientsApi.search(q)
      setResults(Array.isArray(data) ? data : [])
      setOpen(true)
      setHighlighted(-1)
    } catch {
      setResults([])
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    onChange(q, undefined, { resolutionStatus: q.trim() ? 'SEARCHING' : 'EMPTY' })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 300)
  }

  const select = (ing: Ingredient) => {
    setQuery(ing.name)
    onChange(ing.name, ing, {
      resolutionStatus:
        ing.status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'LINKED',
    })
    setOpen(false)
    setResults([])
    inputRef.current?.blur()
  }

  const createPending = async () => {
    const name = query.trim()
    if (!name || provisioning) return
    setProvisioning(true)
    onChange(name, undefined, { resolutionStatus: 'PROVISIONING' })
    try {
      const res = await ingredientsApi.resolveBatch(
        [{ clientRef: 'picker-1', rawName: name }],
        true,
      )
      const hit = res.items[0]
      if (hit?.ingredientId) {
        const linked: Ingredient = {
          id: hit.ingredientId,
          code: hit.inputKey,
          name: hit.canonicalName || name,
          synonyms: [],
          isActive: false,
          status: hit.outcome === 'CREATED_PENDING' ? 'PENDING_REVIEW' : 'ACTIVE',
          imageStatus: hit.outcome === 'CREATED_PENDING' ? 'QUEUED' : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        onChange(linked.name, linked, {
          resolutionStatus:
            hit.outcome === 'CREATED_PENDING' ? 'PENDING_REVIEW' : 'LINKED',
        })
        setOpen(false)
      } else {
        onChange(name, undefined, { resolutionStatus: 'ERROR' })
      }
    } catch {
      onChange(name, undefined, { resolutionStatus: 'ERROR' })
    } finally {
      setProvisioning(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      select(results[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.closest('.ing-picker-wrap')?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const statusLabel =
    resolutionStatus === 'PENDING_REVIEW' || ingredientStatus === 'PENDING_REVIEW'
      ? 'Cần duyệt'
      : resolutionStatus === 'LINKED' || _ingredientId
        ? 'Đã liên kết'
        : resolutionStatus === 'PROVISIONING'
          ? 'Đang tạo...'
          : null

  return (
    <div className="ing-picker-wrap" style={{ position: 'relative', flex: 2, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            overflow: 'hidden',
            background: '#f5f5f5',
            flexShrink: 0,
            border: '1px solid #eee',
          }}
          aria-hidden
        >
          {ingredientImageUrl ? (
            <img
              src={ingredientImageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#999',
              }}
            >
              —
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || query.trim()) setOpen(true)
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-busy={loading || provisioning}
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
        />
      </div>

      {statusLabel && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            fontWeight: 600,
            color:
              statusLabel === 'Cần duyệt'
                ? '#b45309'
                : statusLabel === 'Đã liên kết'
                  ? '#15803d'
                  : '#666',
          }}
        >
          {statusLabel}
          {!ingredientImageUrl && _ingredientId ? ' · Chưa có ảnh' : ''}
        </div>
      )}

      {(loading || provisioning) && (
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            fontSize: 12,
            color: '#aaa',
          }}
        >
          ⟳
        </div>
      )}

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
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#f5f5f5',
                  flexShrink: 0,
                  border: '1px solid #eee',
                }}
              >
                {ing.imageUrl ? (
                  <img
                    src={ing.imageUrl}
                    alt={ing.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#999',
                    }}
                  >
                    —
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#222',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ing.name}
                </div>
                {ing.status === 'PENDING_REVIEW' && (
                  <div style={{ fontSize: 11, color: '#b45309' }}>Cần duyệt</div>
                )}
              </div>
              {ing.allergenCode && (
                <span
                  style={{
                    fontSize: 10,
                    background: '#fff3e0',
                    color: '#e65100',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  {ing.allergenCode}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div
          style={{
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
            color: '#555',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ marginBottom: 8 }}>Không tìm thấy “{query}”</div>
          {allowCreate && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                void createPending()
              }}
              disabled={provisioning}
              aria-label={`Tạo ${query} thành nguyên liệu mới`}
              style={{
                width: '100%',
                height: 36,
                borderRadius: 8,
                border: '1.5px solid #f0a500',
                background: '#fff8ed',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {provisioning ? 'Đang tạo nguyên liệu...' : `Tạo “${query}” và tìm ảnh`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
