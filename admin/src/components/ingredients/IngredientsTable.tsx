import { useState } from 'react'
import {
  Eye,
  GitMerge,
  ImageOff,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Switch } from '../ui/switch'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Image } from '../ui/image'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { MediaLightbox } from '../ui/media-lightbox'
import {
  STATUS_LABELS,
  STATUS_BADGES,
  CREATED_VIA_LABELS,
  getAllergenDisplayName,
  getIngredientImageUrl,
} from './types'
import type { Ingredient } from '../../api/ingredients'

interface IngredientsTableProps {
  ingredients: Ingredient[]
  isLoading?: boolean
  allergenMap?: Record<string, string>
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
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="inline-block animate-spin text-2xl mb-2">🥬</div>
        <p className="text-xs text-slate-500 font-medium">Đang tải danh sách nguyên liệu...</p>
      </div>
    )
  }

  if (ingredients.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-sm space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-xl">
          🥬
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800">Không tìm thấy nguyên liệu nào</h3>
          <p className="text-xs text-slate-400">Hãy thử đổi điều kiện lọc hoặc tạo mới nguyên liệu</p>
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
                <th className="w-16 px-4 py-3">Ảnh</th>
                <th className="px-4 py-3 min-w-[200px]">Tên nguyên liệu</th>
                <th className="px-4 py-3 min-w-[120px]">Mã code</th>
                <th className="px-4 py-3 w-32">Dị ứng</th>
                <th className="px-4 py-3 w-28">Nguồn tạo</th>
                <th className="px-4 py-3 w-24">Số món</th>
                <th className="px-4 py-3 w-28 text-center">Kích hoạt</th>
                <th className="px-4 py-3 w-28">Trạng thái</th>
                <th className="px-4 py-3 w-24 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ingredients.map((item) => {
                const imgUrl = getIngredientImageUrl(item.imageUrl)
                const statusBadge = STATUS_BADGES[item.status ?? 'ACTIVE'] ?? {
                  bg: 'bg-slate-100',
                  text: 'text-slate-700',
                  border: 'border-slate-200',
                }
                const allergenName = item.allergenCode
                  ? getAllergenDisplayName(item.allergenCode, allergenMap)
                  : null

                return (
                  <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      {imgUrl ? (
                        <div
                          onClick={() => setLightboxImage({ url: imgUrl, name: item.name })}
                          className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80 cursor-zoom-in relative group flex-shrink-0"
                          title="Bấm để xem ảnh lớn"
                        >
                          <Image
                            src={imgUrl}
                            alt={item.name}
                            aspectRatio="square"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                          <ImageOff size={15} />
                        </div>
                      )}
                    </td>

                    {/* Name & Synonyms */}
                    <td className="px-4 py-3">
                      <div
                        onClick={() => onView(item)}
                        className="font-bold text-slate-900 hover:text-amber-700 cursor-pointer text-[13px] line-clamp-1"
                      >
                        {item.name}
                      </div>
                      {item.synonyms && item.synonyms.length > 0 && (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          Đồng nghĩa: {item.synonyms.slice(0, 3).join(', ')}
                          {item.synonyms.length > 3 && ` (+${item.synonyms.length - 3})`}
                        </div>
                      )}
                    </td>

                    {/* Code */}
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {item.code}
                    </td>

                    {/* Allergen */}
                    <td className="px-4 py-3">
                      {allergenName ? (
                        <span className="inline-block bg-rose-50 text-rose-700 border border-rose-200 text-[10.5px] px-2 py-0.5 rounded font-medium">
                          ⚠️ {allergenName}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Created Via */}
                    <td className="px-4 py-3">
                      <span className="text-[10.5px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {CREATED_VIA_LABELS[item.createdVia ?? 'MANUAL'] ?? item.createdVia}
                      </span>
                    </td>

                    {/* Dish count */}
                    <td className="px-4 py-3 font-semibold text-slate-700 text-[11.5px]">
                      {(item.dishCount ?? 0).toLocaleString('vi-VN')} món
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={!!item.isActive}
                        onCheckedChange={(checked) => onToggleActive(item.id, checked)}
                      />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-md ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                      >
                        {STATUS_LABELS[item.status ?? ''] ?? (item.isActive ? 'Hoạt động' : 'Đã ẩn')}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900"
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
                              className="h-8 w-8 text-slate-400 hover:text-slate-700"
                            >
                              <MoreVertical size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-xl rounded-xl">
                            <DropdownMenuItem
                              onClick={() => onView(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
                            >
                              <Eye size={14} className="text-slate-500" />
                              <span>Xem chi tiết</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => onEdit(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
                            >
                              <Pencil size={14} className="text-slate-500" />
                              <span>Sửa thông tin</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => onMerge(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-purple-700"
                            >
                              <GitMerge size={14} />
                              <span>Gộp nguyên liệu</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1" />

                            <DropdownMenuItem
                              onClick={() => onDelete(item)}
                              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-rose-600 focus:bg-rose-50"
                            >
                              <Trash2 size={14} />
                              <span>Xóa nguyên liệu</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
