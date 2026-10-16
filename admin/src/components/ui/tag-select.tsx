import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Check } from 'lucide-react'
import { Badge } from './badge'

export interface TagOption {
  id: string
  name: string
  code?: string
}

interface TagSelectProps {
  label?: string
  options: TagOption[]
  selected: string[] // mảng id đã chọn
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
  loading = false,
}: TagSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

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

  const filtered = query.trim()
    ? options.filter(
        (o) => !selected.includes(o.id) && o.name.toLowerCase().includes(query.toLowerCase()),
      )
    : options.filter((o) => !selected.includes(o.id))

  const selectedItems = options.filter((o) => selected.includes(o.id))

  const toggle = useCallback(
    (id: string) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id))
      } else {
        onChange([...selected, id])
        setQuery('')
        setActiveIndex(-1)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    },
    [selected, onChange],
  )

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id))
    inputRef.current?.focus()
  }

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
        setActiveIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0))
        break

      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1))
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
        if (query === '' && selectedItems.length > 0) {
          remove(selectedItems[selectedItems.length - 1].id)
        }
        break
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Input box + tags */}
      <div
        className={`min-h-[40px] border rounded-lg px-2.5 py-1.5 flex flex-wrap gap-1.5 items-center bg-background cursor-text transition-all ${
          open
            ? 'border-amber-500 ring-2 ring-amber-500/20'
            : 'border-input hover:border-slate-300 dark:hover:border-slate-700'
        }`}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selectedItems.map((item) => (
          <Badge
            key={item.id}
            variant="secondary"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 gap-1 px-2 py-0.5 text-xs font-semibold"
          >
            {item.name}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                remove(item.id)
              }}
              className="text-amber-600 dark:text-amber-400 hover:text-amber-800 rounded-full p-0.5 hover:bg-amber-500/20 transition-colors"
              title={`Xóa ${item.name}`}
            >
              <X size={12} />
            </button>
          </Badge>
        ))}

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedItems.length === 0 ? placeholder : ''}
          className="border-none outline-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground min-w-[100px] flex-1 h-6"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto p-1"
        >
          {loading && (
            <div className="p-3 text-xs text-muted-foreground text-center">Đang tải dữ liệu...</div>
          )}

          {!loading && options.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground text-center">Chưa có dữ liệu lựa chọn</div>
          )}

          {!loading && options.length > 0 && filtered.length === 0 && query && (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Không tìm thấy &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && options.length > 0 && filtered.length === 0 && !query && (
            <div className="p-3 text-xs text-muted-foreground text-center">
              Đã chọn toàn bộ mục
            </div>
          )}

          {!loading &&
            filtered.map((opt, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={opt.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el
                  }}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(opt.id)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span>{opt.name}</span>
                  {selected.includes(opt.id) && <Check size={14} className="text-amber-500" />}
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
