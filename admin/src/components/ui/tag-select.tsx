import { useState, useRef, useEffect, useCallback } from 'react'

export interface TagOption {
  id: string
  name: string
  code?: string
}

interface TagSelectProps {
  label?: string
  options: TagOption[]
  selected: string[]           // mảng id đã chọn
  onChange: (ids: string[]) => void
  placeholder?: string
  accentColor?: string
  loading?: boolean
}

export function TagSelect({
  options,
  selected,
  onChange,
  placeholder = 'Tìm và chọn...',
  accentColor = '#f0a500',
  loading = false,
}: TagSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Chỉ hiển thị items CHƯA được chọn trong dropdown
  const filtered = query.trim()
    ? options.filter(
      o => !selected.includes(o.id) && o.name.toLowerCase().includes(query.toLowerCase()),
    )
    : options.filter(o => !selected.includes(o.id))

  const selectedItems = options.filter(o => selected.includes(o.id))

  const toggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter(s => s !== id))
      } else {
        onChange([...selected, id])
        setQuery('')
        setActiveIndex(-1)
        // Giữ focus vào input để tiếp tục tìm kiếm
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    },
    [selected, onChange],
  )

  const remove = (id: string) => {
    onChange(selected.filter(s => s !== id))
    inputRef.current?.focus()
  }

  // Scroll item được highlight vào view
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        setActiveIndex(filtered.length > 0 ? 0 : -1)
        return
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev + 1 < filtered.length ? prev + 1 : 0))
        break

      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1))
        break

      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && filtered[activeIndex]) {
          toggle(filtered[activeIndex].id)
        }
        break

      case 'Escape':
        setOpen(false)
        setQuery('')
        setActiveIndex(-1)
        break

      case 'Backspace':
        // Xóa tag cuối nếu input rỗng
        if (query === '' && selectedItems.length > 0) {
          remove(selectedItems[selectedItems.length - 1].id)
        }
        break
    }
  }

  const accentLight = accentColor + '22'

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input box + tags */}
      <div
        style={{
          minHeight: 42,
          border: `1.5px solid ${open ? accentColor : '#dedbd4'}`,
          borderRadius: 8,
          padding: '5px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          alignItems: 'center',
          background: '#fff',
          cursor: 'text',
          boxShadow: open ? `0 0 0 2px ${accentColor}33` : 'none',
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {/* Tags đã chọn */}
        {selectedItems.map(item => (
          <span
            key={item.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: accentColor,
              color: '#fff',
              borderRadius: 999,
              padding: '2px 6px 2px 12px',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: '20px',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                remove(item.id)
              }}
              title={`Xóa ${item.name}`}
              style={{
                border: 'none',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                cursor: 'pointer',
                padding: 0,
                width: 18,
                height: 18,
                borderRadius: '50%',
                fontSize: 13,
                lineHeight: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.2)')}
            >
              ×
            </button>
          </span>
        ))}

        {/* Input tìm kiếm */}
        <input
          ref={inputRef}
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedItems.length === 0 ? placeholder : ''}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            color: '#222',
            minWidth: 80,
            flex: '1 1 80px',
            height: 28,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#fff',
            border: '1px solid #dedbd4',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {loading && (
            <div style={{ padding: '12px 14px', color: '#aaa', fontSize: 13 }}>Đang tải...</div>
          )}

          {!loading && options.length === 0 && (
            <div style={{ padding: '12px 14px', color: '#aaa', fontSize: 13 }}>Chưa có dữ liệu</div>
          )}

          {!loading && options.length > 0 && filtered.length === 0 && query && (
            <div style={{ padding: '12px 14px', color: '#aaa', fontSize: 13 }}>
              Không tìm thấy "{query}"
            </div>
          )}

          {!loading && options.length > 0 && filtered.length === 0 && !query && (
            <div style={{ padding: '12px 14px', color: '#888', fontSize: 13 }}>
              Đã chọn tất cả
            </div>
          )}

          {/* Chỉ hiển thị items CHƯA chọn */}
          {!loading &&
            filtered.map((opt, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={opt.id}
                  ref={el => {
                    itemRefs.current[idx] = el
                  }}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggle(opt.id)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 14px',
                    border: 'none',
                    background: isActive ? accentLight : 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: isActive ? accentColor : '#2c1810',
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'inherit',
                    borderBottom: '1px solid #f5f0e8',
                    transition: 'background .1s, color .1s',
                  }}
                >
                  {opt.name}
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
