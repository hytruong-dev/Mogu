import { useEffect, useState } from 'react'
import { Select } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Leaf,
  MessageCircle,
  ShieldCheck,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { TableSkeleton } from '../components/ui/page-skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { useReviewActions, useReviewQueue } from '../hooks/useReviewQueue'
import type { ReviewQueueItem, ReviewReasonCode } from '../types'
import { reviewsAdminApi, type CommunityReview } from '../api/reviews'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REASON_OPTIONS: { value: ReviewReasonCode; label: string }[] = [
  { value: 'INSUFFICIENT_SOURCE', label: 'Thiếu nguồn tham khảo' },
  { value: 'CONFLICTING_DATA', label: 'Dữ liệu mâu thuẫn' },
  { value: 'WRONG_DISH', label: 'Sai món ăn' },
  { value: 'NUTRITION_RISK', label: 'Rủi ro dinh dưỡng' },
  { value: 'ALLERGEN_RISK', label: 'Rủi ro dị ứng' },
  { value: 'COPYRIGHT_RISK', label: 'Vấn đề bản quyền' },
  { value: 'DUPLICATE', label: 'Món trùng lặp' },
  { value: 'CONTENT_QUALITY', label: 'Chất lượng nội dung kém' },
]

// ─── Action Dialog ────────────────────────────────────────────────────────────

function ActionDialog({
  title,
  onConfirm,
  onClose,
  isPending,
}: {
  title: string
  onConfirm: (reasonCode: ReviewReasonCode, note: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const [reasonCode, setReasonCode] = useState<ReviewReasonCode>('CONTENT_QUALITY')
  const [note, setNote] = useState('')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Chọn lý do và nhập ghi chú hướng dẫn để đội ngũ biên tập điều chỉnh dữ liệu món ăn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Lý do kiểm duyệt *</Label>
            <Select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReviewReasonCode)}
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ghi chú bổ sung (tùy chọn)</Label>
            <Textarea
              placeholder="Nhập ghi chú chi tiết phản hồi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Hủy
          </Button>
          <Button
            onClick={() => onConfirm(reasonCode, note)}
            disabled={isPending}
            className="bg-primary text-primary-foreground font-semibold"
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ReviewDetail({
  dish,
  onBack,
}: {
  dish: ReviewQueueItem
  onBack: () => void
}) {
  const actions = useReviewActions()
  const [showRequestChanges, setShowRequestChanges] = useState(false)
  const [showReject, setShowReject] = useState(false)

  const nutrition = dish.nutritionProfiles?.[0]

  const handleApprove = async () => {
    if (!confirm(`Duyệt và xuất bản "${dish.name}"?`)) return
    await actions.approve.mutateAsync(dish.id)
    onBack()
  }

  return (
    <>
      {/* Header */}
      <div className="review-title">
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft />
        </button>
        <h1>Kiểm duyệt: {dish.name}</h1>
        <Badge className="warning">CẦN DUYỆT</Badge>
        <Badge>#{dish.id.slice(0, 8).toUpperCase()}</Badge>
      </div>

      {/* Metrics */}
      <Card className="review-metrics">
        <strong>
          <ShieldCheck />
          {dish.confidenceScore ?? '?'}%
          <small>
            Độ tin cậy tổng
            <br />
            <i>{(dish.confidenceScore ?? 0) >= 80 ? 'Cao' : (dish.confidenceScore ?? 0) >= 60 ? 'Trung bình' : 'Thấp'}</i>
          </small>
        </strong>
        {[
          [dish.media?.length ?? 0, 'media', FileText],
          [dish.fieldEvidences?.length ?? 0, 'bằng chứng', Leaf],
          [dish.nutritionProfiles?.length ?? 0, 'dinh dưỡng', Utensils],
          [dish.fieldEvidences?.filter((e) => !e.isResolved).length ?? 0, 'cảnh báo', AlertTriangle],
        ].map(([n, l, Icon]) => {
          const I = Icon as typeof FileText
          return (
            <span key={l as string}>
              <I />
              <b>{n as number}</b>
              <small>{l as string}</small>
            </span>
          )
        })}
      </Card>

      {/* Body */}
      <div className="review-body">
        {/* Evidence / Conflicts */}
        {dish.fieldEvidences && dish.fieldEvidences.length > 0 && (
          <Card>
            <h3>Bằng chứng & Xung đột</h3>
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Trường</th>
                  <th>Giá trị</th>
                  <th>Nguồn</th>
                  <th>Tin cậy</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {dish.fieldEvidences.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.field}</td>
                    <td><b>{ev.value}</b></td>
                    <td>
                      {ev.sourceUrl ? (
                        <a href={ev.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                          Xem nguồn
                        </a>
                      ) : '—'}
                    </td>
                    <td className={ev.confidence >= 80 ? 'green-text' : 'orange-text'}>
                      {ev.confidence}%
                    </td>
                    <td>
                      {!ev.isResolved && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            size="sm"
                            onClick={() => actions.resolveEvidence.mutate({ dishId: dish.id, evidenceId: ev.id, accepted: true })}
                            disabled={actions.resolveEvidence.isPending}
                          >
                            <Check size={14} /> Chấp nhận
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => actions.resolveEvidence.mutate({ dishId: dish.id, evidenceId: ev.id, accepted: false })}
                            disabled={actions.resolveEvidence.isPending}
                          >
                            Bỏ qua
                          </Button>
                        </div>
                      )}
                      {ev.isResolved && <Badge className="published">Đã giải quyết</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Nutrition */}
        {nutrition && (
          <Card>
            <h3>Dinh dưỡng</h3>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                ['Calo', nutrition.calories, 'kcal'],
                ['Đạm', nutrition.protein, 'g'],
                ['Carb', nutrition.carbs, 'g'],
                ['Béo', nutrition.fat, 'g'],
                ['Chất xơ', nutrition.fiber, 'g'],
              ].map(([label, val, unit]) => (
                <div key={label as string} style={{ textAlign: 'center' }}>
                  <b style={{ fontSize: 20 }}>{val ?? '?'}</b>
                  <small style={{ display: 'block' }}>{unit as string}</small>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label as string}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="sticky-actions">
        <Button variant="danger" onClick={() => setShowReject(true)}>Từ chối</Button>
        <Button variant="outline" onClick={() => setShowRequestChanges(true)}>Yêu cầu sửa</Button>
        <Button onClick={handleApprove} disabled={actions.approve.isPending}>
          <CheckCircle2 />
          {actions.approve.isPending ? 'Đang duyệt...' : 'Duyệt & xuất bản'}
        </Button>
      </div>

      {showRequestChanges && (
        <ActionDialog
          title="Yêu cầu chỉnh sửa"
          isPending={actions.requestChanges.isPending}
          onClose={() => setShowRequestChanges(false)}
          onConfirm={(reasonCode, note) => {
            actions.requestChanges.mutate({ dishId: dish.id, reasonCode, note })
            setShowRequestChanges(false)
            onBack()
          }}
        />
      )}

      {showReject && (
        <ActionDialog
          title="Từ chối món ăn"
          isPending={actions.reject.isPending}
          onClose={() => setShowReject(false)}
          onConfirm={(reasonCode, note) => {
            actions.reject.mutate({ dishId: dish.id, reasonCode, note })
            setShowReject(false)
            onBack()
          }}
        />
      )}
    </>
  )
}

// ─── Queue List ───────────────────────────────────────────────────────────────

// ─── Community Reviews Tab ────────────────────────────────────────────────────

function CommunityReviewsTab() {
  const [reviews, setReviews]   = useState<CommunityReview[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [filter, setFilter]     = useState<'all' | 'visible' | 'hidden'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
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

  useEffect(() => { loadReviews(1) }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleHide = async (review: CommunityReview, isVisible: boolean) => {
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.hide(review.id, isVisible)
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, isVisible } : r))
    } catch {
      alert(isVisible ? 'Không thể hiện lại review' : 'Không thể ẩn review')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (review: CommunityReview) => {
    if (!window.confirm(`Xóa đánh giá này?\n"${review.comment?.slice(0, 80)}"`)) return
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.delete(review.id)
      setReviews(prev => prev.filter(r => r.id !== review.id))
      setTotal(t => t - 1)
    } catch {
      alert('Không thể xóa review')
    } finally {
      setActionLoading(null) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/60">
          {(['all', 'visible', 'hidden'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                filter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Tất cả đánh giá' : f === 'visible' ? 'Hiển thị' : 'Đã ẩn'}
            </button>
          ))}
        </div>
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
              {reviews.map(review => (
                <TableRow key={review.id} className={`hover:bg-muted/30 transition-colors ${!review.isVisible ? 'opacity-60' : ''}`}>
                  <TableCell>
                    <div className="font-semibold text-xs text-foreground">
                      {review.dish?.name ?? <span className="text-muted-foreground">—</span>}
                    </div>
                    <code className="text-[10px] text-muted-foreground">#{review.dishId.slice(0, 8)}</code>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {review.profile?.displayName ?? <span className="text-muted-foreground">Ẩn danh</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star
                          key={i}
                          size={11}
                          fill={i <= review.rating ? '#f59e0b' : 'none'}
                          color={i <= review.rating ? '#f59e0b' : '#d4d4d8'}
                        />
                      ))}
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1.5">{review.rating}</span>
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
                        onClick={() => handleDelete(review)}
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
          <Button variant="outline" size="sm" onClick={() => loadReviews(page - 1)} disabled={page === 1}>
            ← Trước
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            Trang {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => loadReviews(page + 1)} disabled={page >= totalPages}>
            Tiếp →
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main ReviewPage ──────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { data, isLoading } = useReviewQueue({ limit: 30 })
  const [selected, setSelected] = useState<ReviewQueueItem | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'community'>('content')

  if (selected) {
    return <ReviewDetail dish={selected} onBack={() => setSelected(null)} />
  }

  const items = data?.data ?? []
  const total = data?.total ?? items.length

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
          <ShieldCheck size={28} className="text-amber-500" />
          Hàng đợi kiểm duyệt (Moderation Queue)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? 'Đang tải dữ liệu...' : `Hiện có ${total} món ăn đang trong trạng thái chờ rà soát chất lượng dữ liệu.`}
        </p>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3">
        {[
          { id: 'content', label: 'Kiểm duyệt nội dung món', count: total },
          { id: 'community', label: 'Đánh giá & Phản hồi cộng đồng' },
        ].map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-amber-400 text-zinc-950 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-zinc-950 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'content' && (
        <div className="space-y-3">
          {isLoading && (
            <Card>
              <CardContent className="p-4">
                <TableSkeleton rows={4} cols={4} />
              </CardContent>
            </Card>
          )}

          {!isLoading && items.length === 0 && (
            <Card>
              <CardContent className="py-14 text-center text-muted-foreground">
                <CheckCircle2 size={44} className="mx-auto text-emerald-500 opacity-40 mb-2" />
                <div className="font-semibold text-foreground text-sm">Hàng đợi trống</div>
                <p className="text-xs text-muted-foreground mt-1">Tất cả món ăn đã được kiểm duyệt hoàn tất.</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {items.map((item) => {
              const primaryMedia = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]
              const nutrition = item.nutritionProfiles?.[0]
              return (
                <Card
                  key={item.id}
                  className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-amber-400/60"
                  onClick={() => setSelected(item)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {primaryMedia?.publicUrl ? (
                        <img
                          src={primaryMedia.publicUrl}
                          alt={item.name}
                          className="h-14 w-14 rounded-xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                          <Utensils size={20} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm truncate">{item.name}</span>
                          <Badge variant="warning" className="text-[10px]">Chờ duyệt</Badge>
                          {(item.confidenceScore ?? 0) < 70 && (
                            <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                              <AlertTriangle size={11} /> {item.confidenceScore}% tin cậy
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          #{item.id.slice(0, 8)} • {item.region?.name ?? 'Món Việt'} •{' '}
                          {nutrition ? `${nutrition.calories ?? '?'} kcal` : 'Chưa có thông số calo'}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                      <ChevronRight size={18} />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'community' && <CommunityReviewsTab />}
    </div>
  )
}
