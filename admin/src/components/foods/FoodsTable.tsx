import { useState } from 'react'
import { Checkbox } from '../ui/checkbox'
import { Image } from '../ui/image'
import { Badge } from '../ui/badge'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table'
import { Star, Flame, Eye, ImageOff, UtensilsCrossed } from 'lucide-react'
import { MediaLightbox } from '../ui/media-lightbox'
import { DishRowActions } from './DishRowActions'
import { STATUS_LABELS, STATUS_BADGE_VARIANTS, getMediaUrl } from './types'
import { FoodsTableSkeleton } from '../ui/page-skeleton'
import { EmptyState } from '../ui/empty-state'
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
    return <FoodsTableSkeleton rows={8} />
  }

  if (dishes.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Không tìm thấy món ăn nào"
        description="Hãy thử điều chỉnh bộ lọc, khoảng giá, hoặc từ khóa tìm kiếm để tìm thấy món ăn phù hợp."
      />
    )
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 px-4 py-3 text-center">
                  <Checkbox
                    checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Chọn tất cả"
                  />
                </TableHead>
                <TableHead className="w-16 px-3 py-3">Ảnh</TableHead>
                <TableHead className="px-4 py-3 min-w-[220px]">Món ăn</TableHead>
                <TableHead className="px-4 py-3 min-w-[140px]">Danh mục & Bữa</TableHead>
                <TableHead className="px-4 py-3 min-w-[150px]">Dinh dưỡng</TableHead>
                <TableHead className="px-3 py-3 w-24">Đánh giá</TableHead>
                <TableHead className="px-4 py-3 w-32">Trạng thái</TableHead>
                <TableHead className="px-4 py-3 w-28">Cập nhật</TableHead>
                <TableHead className="px-4 py-3 w-28 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dishes.map((dish) => {
                const isSelected = selectedIds.has(dish.id)
                const primaryMedia = dish.media?.find((m: any) => m.isPrimary) ?? dish.media?.[0]
                const imgUrl = getMediaUrl(primaryMedia)
                const nutrition = dish.nutrition
                const statusStyle = STATUS_BADGE_VARIANTS[dish.status] ?? {
                  bg: 'bg-muted',
                  text: 'text-muted-foreground',
                  border: 'border-border',
                }

                return (
                  <TableRow
                    key={dish.id}
                    className={`hover:bg-muted/30 transition-colors group ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <TableCell className="px-4 py-3 text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(dish.id)}
                        aria-label={`Chọn ${dish.name}`}
                      />
                    </TableCell>

                    {/* Image Thumbnail */}
                    <TableCell className="px-3 py-3">
                      {imgUrl ? (
                        <div
                          onClick={() => setLightboxImage({ url: imgUrl, name: dish.name })}
                          className="w-11 h-11 rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in relative group/img shrink-0"
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
                        <div className="w-11 h-11 rounded-lg bg-muted border border-dashed border-border flex items-center justify-center text-muted-foreground">
                          <ImageOff size={16} />
                        </div>
                      )}
                    </TableCell>

                    {/* Dish Info */}
                    <TableCell className="px-4 py-3">
                      <div
                        className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-[13px] line-clamp-1"
                        onClick={() => onView(dish)}
                      >
                        {dish.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {dish.region?.name && (
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {dish.region.name}
                          </span>
                        )}
                        {dish.difficulty && (
                          <span className="text-[10px] text-muted-foreground">
                            • {dish.difficulty === 'EASY' ? 'Dễ' : dish.difficulty === 'MEDIUM' ? 'Vừa' : 'Khó'}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Categories & Meal types */}
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {dish.categories && dish.categories.length > 0 ? (
                          dish.categories.slice(0, 2).map((c: any, idx: number) => {
                            const name = c.name ?? c.category?.name ?? ''
                            const id = c.id ?? c.category?.id ?? String(idx)
                            return (
                              <span
                                key={id}
                                className="inline-block bg-muted text-muted-foreground text-[10.5px] px-2 py-0.5 rounded font-medium truncate max-w-[110px]"
                              >
                                {name}
                              </span>
                            )
                          })
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Nutrition Macro Chips */}
                    <TableCell className="px-4 py-3">
                      {nutrition?.calories ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 font-bold text-foreground text-[11.5px]">
                            <Flame size={12} className="text-amber-500" />
                            <span>{nutrition.calories} kcal</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10.5px] font-mono font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400">P:{nutrition.proteinG ?? 0}g</span>
                            <span className="text-blue-600 dark:text-blue-400">C:{nutrition.carbsG ?? 0}g</span>
                            <span className="text-amber-600 dark:text-amber-400">F:{nutrition.fatG ?? 0}g</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Chưa tính</span>
                      )}
                    </TableCell>

                    {/* Rating */}
                    <TableCell className="px-3 py-3">
                      {dish.ratingAvg != null && dish.ratingAvg > 0 ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                          <Star size={12} className="fill-amber-400 text-amber-500" />
                          <span>{Number(dish.ratingAvg).toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">({dish.ratingCount ?? 0})</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/80 text-[11px]">—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        {STATUS_LABELS[dish.status] ?? dish.status}
                      </Badge>
                    </TableCell>

                    {/* Updated At */}
                    <TableCell className="px-4 py-3 text-muted-foreground text-[11px]">
                      {new Date(dish.updatedAt).toLocaleDateString('vi-VN')}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3 text-right">
                      <DishRowActions dish={dish} onView={onView} onEdit={onEdit} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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
