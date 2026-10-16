import {
  X,
  GitMerge,
  Pencil,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Leaf,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Image } from '../ui/image'
import { Skeleton } from '../ui/skeleton'
import {
  STATUS_LABELS,
  STATUS_BADGES,
  CREATED_VIA_LABELS,
  getAllergenDisplayName,
  getIngredientImageUrl,
} from './types'
import type { Ingredient, IngredientImageCandidate } from '../../api/ingredients'

interface IngredientDetailDrawerProps {
  item: Ingredient | null
  allergenMap?: Record<string, string>
  onClose: () => void
  onEdit: (item: Ingredient) => void
  onMerge: (item: Ingredient) => void
  onDelete: (item: Ingredient) => void
  onApprove: (item: Ingredient) => void
  onReject: (item: Ingredient) => void
  imageCandidates: IngredientImageCandidate[]
  imageBusy: boolean
  onSearchImages: () => void
  onApproveCandidate: (candidateId: string) => void
}

export function IngredientDetailDrawer({
  item,
  allergenMap,
  onClose,
  onEdit,
  onMerge,
  onDelete,
  onApprove,
  onReject,
  imageCandidates,
  imageBusy,
  onSearchImages,
  onApproveCandidate,
}: IngredientDetailDrawerProps) {
  if (!item) return null

  const imgUrl = getIngredientImageUrl(item.imageUrl)
  const isPending = item.status === 'PENDING_REVIEW'
  const allergenName = item.allergenCode
    ? getAllergenDisplayName(item.allergenCode, allergenMap)
    : null

  const statusStyle = STATUS_BADGES[item.status ?? 'ACTIVE'] ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Chi tiết nguyên liệu</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body scroll */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
        {/* Cover Photo */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={item.name}
              aspectRatio="video"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-1.5">
              <Leaf size={28} className="text-slate-300" />
              <span className="text-[11px] text-slate-400">Chưa có ảnh nguyên liệu</span>
            </div>
          )}
        </div>

        {/* Title & Status */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{item.name}</h2>
            {item.nameEn && (
              <p className="text-slate-500 italic mt-0.5">EN: {item.nameEn}</p>
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
          >
            {STATUS_LABELS[item.status ?? ''] ?? (item.isActive ? 'Hoạt động' : 'Đã ẩn')}
          </Badge>
        </div>

        {/* Description */}
        {item.description && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 leading-relaxed">
            {item.description}
          </div>
        )}

        {/* Metadata grid */}
        <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between p-2.5">
            <span className="text-slate-500">Mã nguyên liệu:</span>
            <span className="font-mono font-bold text-slate-800">{item.code}</span>
          </div>
          <div className="flex items-center justify-between p-2.5">
            <span className="text-slate-500">Đơn vị chuẩn:</span>
            <span className="font-semibold text-slate-800">{item.unit || '—'}</span>
          </div>
          <div className="flex items-center justify-between p-2.5">
            <span className="text-slate-500">Dị ứng:</span>
            <span className="font-semibold text-slate-800">
              {allergenName ? (
                <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md text-[11px]">
                  <AlertTriangle size={12} className="text-rose-500" />
                  {allergenName}
                </span>
              ) : (
                'Không có'
              )}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5">
            <span className="text-slate-500">Nguồn tạo:</span>
            <span className="font-semibold text-slate-800">
              {CREATED_VIA_LABELS[item.createdVia ?? 'MANUAL'] ?? item.createdVia}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5">
            <span className="text-slate-500">Số món đang dùng:</span>
            <span className="font-bold text-amber-700">
              {(item.dishCount ?? 0).toLocaleString('vi-VN')} món
            </span>
          </div>
        </div>

        {/* Synonyms */}
        {item.synonyms && item.synonyms.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Tên gọi khác ({item.synonyms.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {item.synonyms.map((s) => (
                <span
                  key={s}
                  className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Image Candidates */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Ảnh ứng viên AI ({imageCandidates.length})
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={imageBusy}
              onClick={onSearchImages}
              className="h-7 text-[11px] gap-1 px-2"
            >
              <RefreshCw size={11} className={imageBusy ? 'animate-spin' : ''} />
              {imageBusy ? 'Đang tìm...' : 'Tìm lại ảnh'}
            </Button>
          </div>

          {imageBusy && imageCandidates.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-2">
              {imageCandidates.map((c) => (
                <div
                  key={c.id}
                  className="p-2 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2.5"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                    <Image
                      src={c.publicUrl || c.previewUrl || c.originalUrl}
                      alt=""
                      aspectRatio="square"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{c.provider}</div>
                    <div className="text-[10px] text-slate-400">Điểm phù hợp: {c.score}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onApproveCandidate(c.id)}
                    disabled={imageBusy}
                    className="h-7 text-[11px] px-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                  >
                    Chọn ảnh này
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col gap-2">
        {isPending && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onApprove(item)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
            >
              <CheckCircle2 size={13} /> Duyệt hoạt động
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onReject(item)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
            >
              Từ chối
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMerge(item)}
            className="flex-1 text-purple-700 border-purple-200 hover:bg-purple-50 text-xs gap-1.5"
          >
            <GitMerge size={13} /> Gộp vào...
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(item)}
            className="flex-1 text-slate-700 text-xs gap-1.5"
          >
            <Pencil size={13} /> Sửa
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDelete(item)}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    </aside>
  )
}
