import { useState, useEffect } from 'react'
import { Eye, EyeOff, MessageCircle, Star, Trash2 } from 'lucide-react'
import { reviewsAdminApi, type CommunityReview } from '../../api/reviews'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { TableSkeleton } from '../ui/page-skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

export function CommunityReviewsTab() {
  const [reviews, setReviews] = useState<CommunityReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommunityReview | null>(null)
  const limit = 20

  const loadReviews = async (pg = 1) => {
    setLoading(true)
    try {
      const isVisible = filter === 'all' ? undefined : filter === 'visible' ? true : false
      const res = await reviewsAdminApi.list({ page: pg, limit, isVisible })
      setReviews(res.data)
      setTotal(res.total)
      setPage(pg)
    } catch {
      // handle error silently
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews(1)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleHide = async (review: CommunityReview, isVisible: boolean) => {
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.hide(review.id, isVisible)
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, isVisible } : r))
      )
    } catch {
      alert(isVisible ? 'Không thể hiện lại review' : 'Không thể ẩn review')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const review = deleteTarget
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.delete(review.id)
      setReviews((prev) => prev.filter((r) => r.id !== review.id))
      setTotal((t) => t - 1)
      setDeleteTarget(null)
    } catch {
      alert('Không thể xóa review')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={(val) => setFilter(val as typeof filter)}>
          <TabsList className="bg-muted/60 p-1 h-9">
            {(['all', 'visible', 'hidden'] as const).map((f) => (
              <TabsTrigger
                key={f}
                value={f}
                className="px-3 py-1 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                {f === 'all' ? 'Tất cả đánh giá' : f === 'visible' ? 'Hiển thị' : 'Đã ẩn'}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Đang tải...' : `Tổng cộng ${total} đánh giá`}
        </span>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <MessageCircle size={36} className="mx-auto opacity-30 mb-2" />
            <p className="text-xs">Không có đánh giá cộng đồng nào</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="min-w-[140px]">Món ăn</TableHead>
                <TableHead className="min-w-[120px]">Người dùng</TableHead>
                <TableHead className="text-center w-28">Đánh giá sao</TableHead>
                <TableHead className="min-w-[200px]">Nội dung nhận xét</TableHead>
                <TableHead className="text-center w-28">Trạng thái</TableHead>
                <TableHead className="text-center w-28">Ngày gửi</TableHead>
                <TableHead className="text-right w-24">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((review) => (
                <TableRow
                  key={review.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    !review.isVisible ? 'opacity-60' : ''
                  }`}
                >
                  <TableCell>
                    <div className="font-semibold text-xs text-foreground">
                      {review.dish?.name ?? <span className="text-muted-foreground">—</span>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">
                      #{review.dishId.slice(0, 8)}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {review.profile?.displayName ?? (
                        <span className="text-muted-foreground">Ẩn danh</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          size={11}
                          fill={i <= review.rating ? '#f59e0b' : 'none'}
                          color={i <= review.rating ? '#f59e0b' : '#d4d4d8'}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1.5">
                        {review.rating}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {review.comment ? (
                      <span className="text-xs text-foreground line-clamp-2" title={review.comment}>
                        {review.comment}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {review.isVisible ? (
                      <Badge variant="success" className="text-[10px] flex items-center gap-1 w-fit mx-auto">
                        <Eye size={10} /> Hiển thị
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] flex items-center gap-1 w-fit mx-auto">
                        <EyeOff size={10} /> Đã ẩn
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {review.isVisible ? (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleHide(review, false)}
                          disabled={actionLoading === review.id}
                          title="Ẩn đánh giá"
                        >
                          <EyeOff size={12} />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => handleToggleHide(review, true)}
                          disabled={actionLoading === review.id}
                          title="Hiện lại đánh giá"
                        >
                          <Eye size={12} />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={() => setDeleteTarget(review)}
                        disabled={actionLoading === review.id}
                        title="Xóa đánh giá"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadReviews(page - 1)}
            disabled={page === 1}
          >
            ← Trước
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadReviews(page + 1)}
            disabled={page >= totalPages}
          >
            Tiếp →
          </Button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đánh giá này?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.comment?.slice(0, 160) || 'Đánh giá sẽ bị xóa vĩnh viễn.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!actionLoading}>
              {actionLoading ? 'Đang xóa…' : 'Xóa đánh giá'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
