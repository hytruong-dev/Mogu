import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Plus, Search, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { cn } from '../../lib/utils'
import { navGroups } from './nav-config'
import { useShell } from './shell-context'

type Entry = {
  path: string
  label: string
  description: string
  group: string
  icon: LucideIcon
  keywords: string
}

/** Strip Vietnamese diacritics so "mon an" matches "Món ăn". */
function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function CommandPaletteModal() {
  const { commandOpen: open, setCommandOpen: setOpen } = useShell()
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = []
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.roles && !hasRole(...item.roles)) continue
        list.push({
          path: item.path,
          label: item.label,
          description: item.description,
          group: group.title,
          icon: item.icon,
          keywords: item.keywords ?? '',
        })
      }
    }
    if (hasRole('SUPER_ADMIN', 'CONTENT_ADMIN')) {
      list.splice(1, 0, {
        path: '/foods/new',
        label: 'Thêm món mới',
        description: 'Tạo món ăn với công thức, nguyên liệu và dinh dưỡng',
        group: 'Thao tác nhanh',
        icon: Plus,
        keywords: 'create new dish them mon tao',
      })
    }
    return list
  }, [hasRole])

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return entries
    return entries.filter((e) =>
      normalize(`${e.label} ${e.description} ${e.group} ${e.keywords} ${e.path}`).includes(q)
    )
  }, [entries, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  const go = (entry?: Entry) => {
    if (!entry) return
    setOpen(false)
    navigate(entry.path)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[index])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in-0" onClick={() => setOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm nhanh"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-pop animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trang hoặc chức năng…"
            className="h-14 w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả cho “{query}”
            </div>
          ) : (
            results.map((entry, i) => {
              const Icon = entry.icon
              const active = i === index
              return (
                <button
                  key={entry.path}
                  type="button"
                  data-index={i}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => go(entry)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    active ? 'bg-accent' : 'hover:bg-accent/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                      active
                        ? 'border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{entry.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{entry.description}</span>
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{entry.group}</span>
                  {active && <CornerDownLeft size={14} className="shrink-0 text-muted-foreground" />}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-sans font-semibold">↑ ↓</kbd> di chuyển</span>
          <span><kbd className="font-sans font-semibold">Enter</kbd> mở</span>
          <span><kbd className="font-sans font-semibold">Esc</kbd> đóng</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
