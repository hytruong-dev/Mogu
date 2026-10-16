import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Select } from '../ui/select'

interface FoodDataPaginationProps {
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  itemLabel: string
}

export function FoodDataPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
  itemLabel,
}: FoodDataPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const pages = buildPageList(page, totalPages)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border text-xs text-muted-foreground">
      <p className="font-medium">
        Hiển thị <span className="font-semibold text-foreground">{from}–{to}</span> trong tổng số{' '}
        <span className="font-semibold text-foreground">{total.toLocaleString('vi-VN')}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-3">
        <Select
          value={String(limit)}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          aria-label="Số dòng mỗi trang"
          className="h-8 w-28 text-xs font-medium"
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} / trang
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Trang trước"
          >
            <ChevronLeft size={14} />
          </Button>
          {pages.map((p, idx) =>
            p === '…' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                className={`h-8 min-w-8 px-2.5 text-xs font-semibold ${
                  p === page
                    ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                    : 'text-foreground hover:bg-muted'
                }`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages || totalPages === 0}
            onClick={() => onPageChange(page + 1)}
            aria-label="Trang sau"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

function buildPageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | '…'> = [1]
  if (current > 3) pages.push('…')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p)
  }
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
}
