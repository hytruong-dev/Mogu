/**
 * IngredientPicker — search catalog, link existing, or explicitly create PENDING.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { ingredientsApi, type Ingredient } from '../../api/ingredients'
import { getAllergenDisplayName } from '../ingredients/types'
import { Image } from './image'
import { Input } from './input'
import { Button } from './button'
import { Badge } from './badge'
import { Loader2, Plus } from 'lucide-react'

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
    ingredientStatus === 'REJECTED'
      ? 'Đã từ chối'
      : resolutionStatus === 'PENDING_REVIEW' || ingredientStatus === 'PENDING_REVIEW'
        ? 'Tự động tìm - cần duyệt'
        : resolutionStatus === 'LINKED' || _ingredientId
          ? 'Đã liên kết'
          : resolutionStatus === 'PROVISIONING'
            ? 'Đang tạo...'
            : null

  return (
    <div className="ing-picker-wrap relative flex-2" style={style}>
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0 border border-border flex items-center justify-center text-xs text-muted-foreground"
          aria-hidden
        >
          {ingredientImageUrl ? (
            <Image
              src={ingredientImageUrl}
              alt=""
              aspectRatio="square"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="relative flex-1">
          <Input
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
            className="h-9 w-full bg-background text-xs font-medium pr-8"
          />
          {(loading || provisioning) && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin text-amber-500" />
            </div>
          )}
        </div>
      </div>

      {statusLabel && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            className={
              statusLabel === 'Đã từ chối'
                ? 'text-destructive'
                : statusLabel === 'Tự động tìm - cần duyệt'
                  ? 'text-amber-600 dark:text-amber-400'
                  : statusLabel === 'Đã liên kết'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
            }
          >
            {statusLabel}
          </span>
          {!ingredientImageUrl && _ingredientId && (
            <span className="text-muted-foreground font-normal">· Chưa có ảnh</span>
          )}
        </div>
      )}

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-popover border border-amber-500/40 rounded-xl shadow-lg max-h-64 overflow-y-auto p-1 list-none"
        >
          {results.map((ing, i) => (
            <li
              key={ing.id}
              onMouseDown={() => select(ing)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                highlighted === i ? 'bg-amber-500/10 text-amber-950 dark:text-amber-100' : 'hover:bg-muted'
              }`}
            >
              <div className="w-8 h-8 rounded-md overflow-hidden bg-muted shrink-0 border border-border flex items-center justify-center text-xs text-muted-foreground">
                {ing.imageUrl ? (
                  <Image
                    src={ing.imageUrl}
                    alt={ing.name}
                    aspectRatio="square"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-foreground truncate">
                  {ing.name}
                </div>
                {ing.status === 'PENDING_REVIEW' && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Tự động tìm - cần duyệt</div>
                )}
                {ing.status === 'REJECTED' && (
                  <div className="text-[10px] text-destructive font-medium">Đã từ chối</div>
                )}
              </div>
              {ing.allergenCode && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                  {getAllergenDisplayName(ing.allergenCode)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim() && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg p-3 text-xs text-muted-foreground">
          <div className="mb-2">Không tìm thấy &ldquo;{query}&rdquo; trong kho</div>
          {allowCreate && (
            <Button
              type="button"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault()
                void createPending()
              }}
              disabled={provisioning}
              aria-label={`Tạo ${query} thành nguyên liệu mới`}
              className="w-full h-8 text-xs font-semibold bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/30 gap-1.5"
            >
              <Plus size={13} />
              {provisioning ? 'Đang tạo nguyên liệu...' : `Tạo “${query}” và tìm ảnh AI`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
