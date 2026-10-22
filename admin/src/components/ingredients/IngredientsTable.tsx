import { useState } from 'react'
import { Image } from '../ui/image'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { MediaLightbox } from '../ui/media-lightbox'
import {
  Eye,
  Pencil,
  GitMerge,
  Trash2,
  MoreVertical,
  ImageOff,
  Salad,
  AlertTriangle,
} from 'lucide-react'
import { IngredientsTableSkeleton } from '../ui/page-skeleton'
import { EmptyState } from '../ui/empty-state'
import {
  STATUS_LABELS,
  STATUS_BADGES,
  CREATED_VIA_LABELS,
  getIngredientImageUrl,
} from './types'
import type { Ingredient } from '../../api/ingredients'

interface IngredientsTableProps {
  ingredients: Ingredient[]
  isLoading?: boolean
  allergenMap: Record<string, string>
  onView: (item: Ingredient) => void
  onEdit: (item: Ingredient) => void
  onMerge: (item: Ingredient) => void
  onDelete: (item: Ingredient) => void
  onToggleActive: (id: string, active: boolean) => void
}

export function IngredientsTable({
  ingredients,
  isLoading,
  allergenMap,
  onView,
  onEdit,
  onMerge,
  onDelete,
  onToggleActive,
}: IngredientsTableProps) {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null)

  if (isLoading) {
    return <IngredientsTableSkeleton rows={8} />
  }

  if (ingredients.length === 0) {
    return (
      <EmptyState
        icon={Salad}
        title="Không tìm thấy nguyên liệu nào"
        description="Hãy thử đổi điều kiện lọc tìm kiếm hoặc tạo mới một nguyên liệu vào từ điển dữ liệu."
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
                <TableHead className="w-16 px-4 py-3">Ảnh</TableHead>
                <TableHead className="px-4 py-3 min-w-[200px]">Tên nguyên liệu</TableHead>
                <TableHead className="px-4 py-3 min-w-[120px]">Mã code</TableHead>
                <TableHead className="px-4 py-3 w-36">Dị ứng</TableHead>
                <TableHead className="px-4 py-3 w-28">Nguồn tạo</TableHead>
                <TableHead className="px-4 py-3 w-24">Số món</TableHead>
                <TableHead className="px-4 py-3 w-28 text-center">Kích hoạt</TableHead>
                <TableHead className="px-4 py-3 w-28">Trạng thái</TableHead>
                <TableHead className="px-4 py-3 w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((item) => {
                const imgUrl = getIngredientImageUrl(item.imageUrl)
                const allergenName = item.allergenCode ? (allergenMap[item.allergenCode] || item.allergenCode) : null
                const statusBadge = STATUS_BADGES[item.status ?? ''] ?? {
                  bg: 'bg-muted',
                  text: 'text-muted-foreground',
                  border: 'border-border',
                }

                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    {/* Thumbnail */}
                    <TableCell className="px-4 py-3">
                      {imgUrl ? (
                        <div
                          onClick={() => setLightboxImage({ url: imgUrl, name: item.name })}
                          className="w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border cursor-zoom-in relative group/img shrink-0"
                          title="Bấm để xem ảnh lớn"
                        >
                          <Image
                            src={imgUrl}
                            alt={item.name}
                            aspectRatio="square"
                            className="h-full w-full object-cover group-hover/img:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye size={12} />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted border border-dashed border-border flex items-center justify-center text-muted-foreground">
                          <ImageOff size={14} />
                        </div>
                      )}
                    </TableCell>

                    {/* Name & Synonyms */}
                    <TableCell className="px-4 py-3">
                      <div
                        onClick={() => onView(item)}
                        className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-[13px] line-clamp-1"
                      >
                        {item.name}
                      </div>
                      {item.synonyms && item.synonyms.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          Đồng nghĩa: {item.synonyms.slice(0, 3).join(', ')}
                          {item.synonyms.length > 3 && ` (+${item.synonyms.length - 3})`}
                        </div>
                      )}
                    </TableCell>

                    {/* Code */}
                    <TableCell className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {item.code}
                    </TableCell>

                    {/* Allergen */}
                    <TableCell className="px-4 py-3">
                      {allergenName ? (
                        <Badge
                          variant="warning"
                          className="text-[10px] font-semibold py-0.5 px-2 flex items-center gap-1 w-fit max-w-[140px] truncate"
                        >
                          <AlertTriangle size={11} className="shrink-0" />
                          <span className="truncate">{allergenName}</span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/80 text-[11px]">—</span>
                      )}
                    </TableCell>

                    {/* Created Via */}
                    <TableCell className="px-4 py-3">
                      <span className="text-[10.5px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {CREATED_VIA_LABELS[item.createdVia ?? 'MANUAL'] ?? item.createdVia}
                      </span>
                    </TableCell>

                    {/* Dish count */}
                    <TableCell className="px-4 py-3 font-semibold text-foreground text-[11.5px]">
                      {(item.dishCount ?? 0).toLocaleString('vi-VN')} món
                    </TableCell>

                    {/* Active toggle */}
                    <TableCell className="px-4 py-3 text-center">
                      <Switch
                        checked={!!item.isActive}
                        onCheckedChange={(checked) => onToggleActive(item.id, checked)}
                        aria-label={`Bật tắt trạng thái hoạt động ${item.name}`}
                      />
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                      >
                        {STATUS_LABELS[item.status ?? ''] ?? (item.isActive ? 'Hoạt động' : 'Đã ẩn')}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onView(item)}
                          title="Xem chi tiết"
                        >
                          <Eye size={14} />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-xl rounded-xl">
                            <DropdownMenuItem
                              onClick={() => onView(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
                            >
                              <Eye size={14} className="text-muted-foreground" />
                              <span>Xem chi tiết</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => onEdit(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
                            >
                              <Pencil size={14} className="text-muted-foreground" />
                              <span>Sửa thông tin</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => onMerge(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-purple-600 focus:text-purple-700"
                            >
                              <GitMerge size={14} />
                              <span>Gộp nguyên liệu</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1" />

                            <DropdownMenuItem
                              onClick={() => onDelete(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 size={14} />
                              <span>Xóa nguyên liệu</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

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
