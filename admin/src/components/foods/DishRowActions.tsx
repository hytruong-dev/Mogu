import { useState } from 'react'
import { MoreVertical, Eye, Pencil, Trash2, Send, CheckCircle2, PauseCircle, PlayCircle, Archive, RotateCcw, Copy } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
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
import { useAuth } from '../../providers/AuthProvider'
import { useDishLifecycle, useDeleteDish, useCreateDish } from '../../hooks/useDishes'
import type { Dish } from '../../types'

interface DishRowActionsProps {
  dish: Dish
  onView: (dish: Dish) => void
  onEdit: (dish: Dish) => void
}

export function DishRowActions({ dish, onView, onEdit }: DishRowActionsProps) {
  const { isSuperAdmin, isContentAdmin } = useAuth()
  const canEdit = isSuperAdmin || isContentAdmin
  const lifecycle = useDishLifecycle()
  const deleteDish = useDeleteDish()
  const createDish = useCreateDish()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDuplicate = () => {
    createDish.mutate({
      name: `${dish.name} (Bản sao)`,
      shortDescription: dish.shortDescription ?? undefined,
      difficulty: dish.difficulty ?? undefined,
      prepMinutes: dish.prepMinutes ?? undefined,
      cookMinutes: dish.cookMinutes ?? undefined,
      regionId: (dish as any).regionId ?? dish.region?.id ?? undefined,
      categoryIds: dish.categories?.map((c: any) => c.id ?? c.category?.id).filter(Boolean),
      mealTypeIds: dish.mealTypes?.map((m: any) => m.id ?? m.mealTypeTag?.id).filter(Boolean),
    })
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      await deleteDish.mutateAsync(dish.id)
      setShowDeleteConfirm(false)
    } catch (e: any) {
      alert(`Xóa thất bại: ${e?.message ?? 'Đã có lỗi xảy ra'}`)
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* Quick view button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          onClick={() => onView(dish)}
          title="Xem chi tiết"
        >
          <Eye size={15} />
        </Button>

        {/* Quick edit button */}
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
            onClick={() => onEdit(dish)}
            title="Chỉnh sửa"
          >
            <Pencil size={15} />
          </Button>
        )}

        {/* More dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <MoreVertical size={15} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5 shadow-xl rounded-xl">
            <DropdownMenuItem
              onClick={() => onView(dish)}
              className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
            >
              <Eye size={14} className="text-slate-500" />
              <span>Xem chi tiết</span>
            </DropdownMenuItem>

            {canEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(dish)}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
              >
                <Pencil size={14} className="text-slate-500" />
                <span>Chỉnh sửa món</span>
              </DropdownMenuItem>
            )}

            {canEdit && (
              <DropdownMenuItem
                onClick={handleDuplicate}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium"
              >
                <Copy size={14} className="text-slate-500" />
                <span>Nhân bản món ăn</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="my-1" />

            {canEdit && (dish.status === 'DRAFT' || dish.status === 'CHANGES_REQUESTED') && (
              <DropdownMenuItem
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('mogu:submit-review', {
                      detail: { id: dish.id, name: dish.name },
                    })
                  )
                }
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-amber-700"
              >
                <Send size={14} />
                <span>Gửi kiểm duyệt</span>
              </DropdownMenuItem>
            )}

            {isSuperAdmin && dish.status === 'PENDING_REVIEW' && (
              <DropdownMenuItem
                onClick={() => lifecycle.publishDirect.mutate(dish.id)}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-bold text-emerald-700"
              >
                <CheckCircle2 size={14} />
                <span>Xuất bản ngay</span>
              </DropdownMenuItem>
            )}

            {dish.status === 'PUBLISHED' && (
              <DropdownMenuItem
                onClick={() => lifecycle.unpublish.mutate(dish.id)}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-slate-700"
              >
                <PauseCircle size={14} />
                <span>Hủy xuất bản</span>
              </DropdownMenuItem>
            )}

            {dish.status === 'UNPUBLISHED' && (
              <DropdownMenuItem
                onClick={() => lifecycle.republish.mutate(dish.id)}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-emerald-700"
              >
                <PlayCircle size={14} />
                <span>Xuất bản lại</span>
              </DropdownMenuItem>
            )}

            {canEdit && dish.status !== 'ARCHIVED' && (
              <DropdownMenuItem
                onClick={() => lifecycle.archive.mutate(dish.id)}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-purple-700"
              >
                <Archive size={14} />
                <span>Lưu trữ</span>
              </DropdownMenuItem>
            )}

            {isSuperAdmin && dish.status === 'ARCHIVED' && (
              <DropdownMenuItem
                onClick={() => lifecycle.restore.mutate(dish.id)}
                className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-emerald-700"
              >
                <RotateCcw size={14} />
                <span>Khôi phục</span>
              </DropdownMenuItem>
            )}

            {isSuperAdmin && (
              <>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="gap-2.5 py-2 px-3 cursor-pointer text-xs font-medium text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                >
                  <Trash2 size={14} />
                  <span>Xóa vĩnh viễn</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Inline Delete Confirm Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-2">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">Xóa vĩnh viễn món ăn?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Món <b>"{dish.name}"</b> sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.<br />
              Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteDish.isPending ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
