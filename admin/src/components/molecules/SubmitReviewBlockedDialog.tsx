import { AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react'
import type { DishValidationResult } from '../../api/dishes'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { PendingIngredientsPanel } from './PendingIngredientsPanel'

interface SubmitReviewBlockedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dishId?: string
  dishName?: string
  validation: DishValidationResult | null
  /** Gọi khi admin bấm "Kiểm tra lại điều kiện" (thường: validate lại rồi gửi duyệt). */
  onResolved?: () => void
  /** Gọi sau mỗi thao tác duyệt/gộp/từ chối nguyên liệu trong panel (thường: validate lại). */
  onIngredientsChanged?: () => void
}

const SECTION_LABELS: Record<string, string> = {
  BASIC_INFO: 'Thông tin cơ bản',
  CLASSIFICATION: 'Phân loại',
  INGREDIENTS: 'Nguyên liệu',
  NUTRITION: 'Dinh dưỡng',
  RECIPE: 'Công thức & Các bước nấu',
  MEDIA: 'Hình ảnh & Truyền thông',
}

export function SubmitReviewBlockedDialog({
  open,
  onOpenChange,
  dishId,
  dishName,
  validation,
  onResolved,
  onIngredientsChanged,
}: SubmitReviewBlockedDialogProps) {
  if (!validation) return null

  const blockingErrors = validation.blockingErrors ?? []
  const ingredientIssues = validation.ingredientIssues ?? []

  // Nhóm lỗi theo section
  const errorsBySection = blockingErrors.reduce<Record<string, typeof blockingErrors>>(
    (acc, err) => {
      const sec = err.section || 'OTHER'
      if (!acc[sec]) acc[sec] = []
      acc[sec].push(err)
      return acc
    },
    {},
  )

  const hasIngredientIssues =
    ingredientIssues.length > 0 || Boolean(errorsBySection.INGREDIENTS)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-6 w-6" />
            <DialogTitle className="text-lg font-bold text-red-900">
              Không thể gửi duyệt món ăn
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-zinc-600 pt-1">
            Món {dishName ? <strong>&quot;{dishName}&quot;</strong> : 'này'} chưa thỏa mãn điều
            kiện kiểm duyệt xuất bản. Vui lòng hoàn thiện các mục bắt buộc bên dưới.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Danh sách lỗi khác (không phải INGREDIENTS) */}
          {Object.entries(errorsBySection)
            .filter(([sec]) => sec !== 'INGREDIENTS')
            .map(([sec, errors]) => (
              <div
                key={sec}
                className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm text-red-900"
              >
                <div className="font-semibold text-red-950">
                  {SECTION_LABELS[sec] || sec}
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-red-800">
                  {errors.map((e, idx) => (
                    <li key={idx}>{e.message}</li>
                  ))}
                </ul>
              </div>
            ))}

          {/* Phần lỗi nguyên liệu kèm panel duyệt tại chỗ */}
          {hasIngredientIssues && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900">
                  Nguyên liệu chưa được phê duyệt:
                </span>
                <a
                  href="/food-data?tab=ingredients&status=PENDING_REVIEW"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
                >
                  Mở kho nguyên liệu <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <PendingIngredientsPanel
                dishId={dishId}
                items={ingredientIssues.length ? ingredientIssues : undefined}
                onChanged={() => {
                  onIngredientsChanged?.()
                }}
              />
            </div>
          )}

          {/* Cảnh báo (warnings nếu có) */}
          {(validation.warnings ?? []).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Cảnh báo khuyến nghị (không chặn duyệt):
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-800">
                {validation.warnings.map((w, idx) => (
                  <li key={idx}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          {onResolved && (
            <Button
              variant="default"
              onClick={() => {
                onResolved()
                onOpenChange(false)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Kiểm tra lại &amp; gửi duyệt
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
