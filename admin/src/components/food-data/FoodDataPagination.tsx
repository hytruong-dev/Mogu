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
    <div className="fd-pagination">
      <p className="fd-pagination-meta">
        Hiển thị {from}–{to} trong tổng số {total.toLocaleString('vi-VN')} {itemLabel}
      </p>
      <div className="fd-pagination-controls">
        <Select
          value={String(limit)}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          aria-label="Số dòng mỗi trang"
          className="fd-page-size"
        >
          {[10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n} / trang
            </option>
          ))}
        </Select>
        <div className="fd-page-buttons">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Trang trước"
          >
            <ChevronLeft size={16} />
          </Button>
          {pages.map((p, idx) =>
            p === '…' ? (
              <span key={`ellipsis-${idx}`} className="fd-page-ellipsis">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`fd-page-num${p === page ? ' is-active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages || totalPages === 0}
            onClick={() => onPageChange(page + 1)}
            aria-label="Trang sau"
          >
            <ChevronRight size={16} />
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
