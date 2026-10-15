import { useState } from 'react'
import { Checkbox } from '../ui/checkbox'
import { Image } from '../ui/image'
import { Badge } from '../ui/badge'
import { Star, Flame, Eye, ImageOff } from 'lucide-react'
import { MediaLightbox } from '../ui/media-lightbox'
import { DishRowActions } from './DishRowActions'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS, getMediaUrl } from './types'
import type { Dish } from '../../types'

interface FoodsTableProps {
  dishes: Dish[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onView: (dish: Dish) => void
  onEdit: (dish: Dish) => void
  isLoading?: boolean
}

export function FoodsTable({
  dishes,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  isLoading,
}: FoodsTableProps) {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)

  const isAllSelected = dishes.length > 0 && dishes.every((d) => selectedIds.has(d.id))
  const isSomeSelected = dishes.some((d) => selectedIds.has(d.id)) && !isAllSelected

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="inline-block animate-spin text-2xl mb-2">🍽️</div>
        <p className="text-xs text-slate-500 font-medium">Đang tải danh sách món ăn...</p>
      </div>
    )
  }

  if (dishes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-sm space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl">
          🍲
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800">Không tìm thấy món ăn nào</h3>
          <p className="text-xs text-slate-400">Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="w-10 px-4 py-3 text-center">
                  <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th className="w-16 px-3 py-3">Ảnh</th>
                <th className="px-4 py-3 min-w-[220px]">Món ăn</th>
                <th className="px-4 py-3 min-w-[140px]">Danh mục & Bữa</th>
                <th className="px-4 py-3 min-w-[150px]">Dinh dưỡng</th>
                <th className="px-3 py-3 w-24">Đánh giá</th>
                <th className="px-4 py-3 w-32">Trạng thái</th>
                <th className="px-4 py-3 w-28">Cập nhật</th>
                <th className="px-4 py-3 w-28 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dishes.map((dish) => {
                const isSelected = selectedIds.has(dish.id)
                const primaryMedia = dish.media?.find((m: any) => m.isPrimary) ?? dish.media?.[0]
                const imgUrl = getMediaUrl(primaryMedia)
                const nutrition = dish.nutrition
                const statusStyle = STATUS_BADGE_VARIANTS[dish.status] ?? {
                  bg: 'bg-slate-100',
                  text: 'text-slate-700',
                  border: 'border-slate-200',
                }

                return (
                  <tr
                    key={dish.id}
                    className={`hover:bg-amber-50/30 transition-colors group ${
                      isSelected ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(dish.id)}
                        aria-label={`Chọn ${dish.name}`}
                      />
                    </td>

                    {/* Image Thumbnail */}
                    <td className="px-3 py-3">
                      {imgUrl ? (
                        <div
                          onClick={() => setLightboxImage({ url: imgUrl, name: dish.name })}
                          className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80 cursor-zoom-in relative group/img flex-shrink-0"
                          title="Bấm để xem ảnh lớn"
                        >
                          <Image
                            src={imgUrl}
                            alt={dish.name}
                            aspectRatio="square"
                            className="h-full w-full object-cover group-hover/img:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye size={12} />
                          </div>
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </td>

                    {/* Dish Info */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer text-[13px] line-clamp-1" onClick={() => onView(dish)}>
                        {dish.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {dish.region?.name && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {dish.region.name}
                          </span>
                        )}
                        {dish.difficulty && (
                          <span className="text-[10px] text-slate-400">
                            • {dish.difficulty === 'EASY' ? 'Dễ' : dish.difficulty === 'MEDIUM' ? 'Vừa' : 'Khó'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Categories & Meal types */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {dish.categories && dish.categories.length > 0 ? (
                          dish.categories.slice(0, 2).map((c: any, idx: number) => {
                            const name = c.name ?? c.category?.name ?? ''
                            const id = c.id ?? c.category?.id ?? String(idx)
                            return (
                              <span
                                key={id}
                                className="inline-block bg-slate-100 text-slate-600 text-[10.5px] px-2 py-0.5 rounded font-medium truncate max-w-[110px]"
                              >
                                {name}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </div>
                    </td>

                    {/* Nutrition Macro Chips */}
                    <td className="px-4 py-3">
                      {nutrition?.calories ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-bold text-slate-800 text-[11.5px]">
                            <Flame size={12} className="text-amber-500" />
                            <span>{nutrition.calories} kcal</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                            <span>P:{nutrition.proteinG ?? 0}g</span>
                            <span>C:{nutrition.carbsG ?? 0}g</span>
                            <span>F:{nutrition.fatG ?? 0}g</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Chưa tính</span>
                      )}
                    </td>

                    {/* Rating */}
                    <td className="px-3 py-3">
                      {dish.ratingAvg != null && dish.ratingAvg > 0 ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <Star size={12} className="fill-amber-400 text-amber-500" />
                          <span>{Number(dish.ratingAvg).toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({dish.ratingCount ?? 0})</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        {STATUS_LABELS[dish.status] ?? dish.status}
                      </Badge>
                    </td>

                    {/* Updated At */}
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(dish.updatedAt).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <DishRowActions dish={dish} onView={onView} onEdit={onEdit} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <MediaLightbox
          open={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          media={{
            type: 'image',
            title: lightboxImage.name,
            url: lightboxImage.url,
          }}
        />
      )}
    </>
  )
}
