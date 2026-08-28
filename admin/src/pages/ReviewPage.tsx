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
import { Card } from '../components/ui/card'
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
    <div className="modal-overlay" onClick={onClose}>
      <Card className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ marginBottom: 16 }}>{title}</h3>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Lý do *</span>
          <Select
            
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as ReviewReasonCode)}
          >
            {REASON_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Ghi chú (tùy chọn)</span>
          <Textarea
            
            placeholder="Nhập ghi chú chi tiết..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button
            onClick={() => onConfirm(reasonCode, note)}
            disabled={isPending}
          >
            {isPending ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </div>
      </Card>
    </div>
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

  const handleHide = async (review: CommunityReview) => {
    setActionLoading(review.id)
    try {
      await reviewsAdminApi.hide(review.id)
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, isVisible: false } : r))
    } catch {
      alert('Không thể ẩn review')
    } finally {
      setActionLoading(null) }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'visible', 'hidden'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
              borderColor: filter === f ? '#f0a500' : 'var(--border)',
              background: filter === f ? '#fff8e8' : '#fff',
              color: filter === f ? '#c07800' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'Tất cả' : f === 'visible' ? '👁 Hiện' : '🙈 Đã ẩn'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
          {loading ? 'Đang tải...' : `${total} đánh giá`}
        </span>
      </div>

      {/* Table */}
      <Card className="table-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <MessageCircle size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
            <p>Không có đánh giá nào</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Món ăn</th>
                <th>Người dùng</th>
                <th style={{ textAlign: 'center' }}>Rating</th>
                <th>Nhận xét</th>
                <th>Trạng thái</th>
                <th>Ngày</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(review => (
                <tr key={review.id} style={{ opacity: review.isVisible ? 1 : 0.6 }}>
                  <td style={{ maxWidth: 140 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {review.dish?.name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: 11 }}>#{review.dishId.slice(0, 8)}</small>
                  </td>
                  <td style={{ maxWidth: 120 }}>
                    <div style={{ fontSize: 13 }}>
                      {review.profile?.displayName ?? <span style={{ color: 'var(--text-muted)' }}>Ẩn danh</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={12} fill={i <= review.rating ? '#f0a500' : 'none'} color={i <= review.rating ? '#f0a500' : '#ccc'} />
                      ))}
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#c07800', marginLeft: 4 }}>{review.rating}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: 200, fontSize: 13 }}>
                    {review.comment ? (
                      <span title={review.comment}>
                        {review.comment.length > 80 ? review.comment.slice(0, 80) + '...' : review.comment}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {review.isVisible ? (
                      <Badge className="published"><Eye size={11} /> Hiện</Badge>
                    ) : (
                      <Badge className="draft"><EyeOff size={11} /> Đã ẩn</Badge>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {review.isVisible && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleHide(review)}
                          disabled={actionLoading === review.id}
                          title="Ẩn đánh giá"
                        >
                          <EyeOff size={13} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(review)}
                        disabled={actionLoading === review.id}
                        title="Xóa đánh giá"
                        style={{ color: '#e53e3e', borderColor: '#e53e3e' }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => loadReviews(page - 1)} disabled={page === 1}>← Trước</Button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            Trang {page}/{totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => loadReviews(page + 1)} disabled={page >= totalPages}>Tiếp →</Button>
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
    <>
      <div className="page-heading">
        <div>
          <h1>Kiểm duyệt</h1>
          <p>
            {isLoading ? 'Đang tải...' : `${total} món đang chờ kiểm duyệt`}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { id: 'content', label: '🛡 Kiểm duyệt nội dung', count: total },
          { id: 'community', label: '⭐ Đánh giá cộng đồng' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              color: activeTab === tab.id ? '#f0a500' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2.5px solid #f0a500' : '2.5px solid transparent',
              marginBottom: -2,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span style={{ background: '#f0a500', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'content' && (
        <>
          {isLoading && (
            <Card>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
            </Card>
          )}

          {!isLoading && items.length === 0 && (
            <Card>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>Không có món nào chờ duyệt</p>
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item) => {
              const primaryMedia = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]
              const nutrition = item.nutritionProfiles?.[0]
              return (
                <Card
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(item)}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {primaryMedia?.publicUrl ? (
                      <img
                        src={primaryMedia.publicUrl}
                        alt={item.name}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <div style={{ width: 60, height: 60, background: 'var(--bg-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Utensils size={24} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <b>{item.name}</b>
                        <Badge className="warning">Chờ duyệt</Badge>
                        {(item.confidenceScore ?? 0) < 70 && (
                          <Badge className="pending">
                            <AlertTriangle size={12} /> {item.confidenceScore}% tin cậy
                          </Badge>
                        )}
                      </div>
                      <small style={{ color: 'var(--text-muted)' }}>
                        #{item.id.slice(0, 8)} · {item.region?.name ?? 'Không rõ vùng'} ·{' '}
                        {nutrition ? `${nutrition.calories ?? '?'} kcal` : 'Chưa có dinh dưỡng'}
                      </small>
                    </div>
                    <ChevronRight size={20} />
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {activeTab === 'community' && <CommunityReviewsTab />}
    </>
  )
}
