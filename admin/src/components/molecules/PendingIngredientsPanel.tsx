import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  ExternalLink,
  GitMerge,
  RefreshCw,
  X,
  ZoomIn,
} from 'lucide-react'
import { MediaLightbox, useMediaLightbox } from '../ui/media-lightbox'
import {
  ingredientsApi,
  type IngredientImageCandidate,
  type PendingIngredientIssue,
} from '../../api/ingredients'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Image } from '../ui/image'
import { Input } from '../ui/input'
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
import IngredientPicker from '../ui/ingredient-picker'

interface PendingIngredientsPanelProps {
  dishId?: string
  items?: PendingIngredientIssue[]
  onChanged?: () => void
  compact?: boolean
}

export function PendingIngredientsPanel({
  dishId,
  items: initialItems,
  onChanged,
  compact = false,
}: PendingIngredientsPanelProps) {
  const queryClient = useQueryClient()

  const {
    data: fetchedItems,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-dish-pending-ingredients', dishId],
    queryFn: () => (dishId ? ingredientsApi.pendingForDish(dishId) : Promise.resolve([])),
    enabled: Boolean(dishId && !initialItems),
  })

  const list = initialItems ?? fetchedItems ?? []

  const handleRefresh = async () => {
    if (dishId) {
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['admin-dish-validation', dishId] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dish', dishId] })
    }
    onChanged?.()
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
          <span>Đang kiểm tra trạng thái nguyên liệu...</span>
        </div>
      </div>
    )
  }

  if (!list.length) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
        <div className="flex items-center gap-2 font-medium">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>Tất cả nguyên liệu trong món đã được phê duyệt hợp lệ.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h4 className="font-semibold text-amber-950">
            {list.length} nguyên liệu tự động tìm cần phê duyệt
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-800">
          <span>Cần duyệt hoặc gộp trước khi gửi duyệt món</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded px-2 py-1 font-medium hover:bg-amber-100"
          >
            <RefreshCw className="h-3 w-3" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {list.map((issue) => (
          <PendingIngredientRow
            key={issue.dishIngredientId || issue.ingredientId || issue.rawText}
            issue={issue}
            compact={compact}
            onUpdated={handleRefresh}
          />
        ))}
      </div>
    </div>
  )
}

function PendingIngredientRow({
  issue,
  compact,
  onUpdated,
}: {
  issue: PendingIngredientIssue
  compact: boolean
  onUpdated: () => void
}) {
  const ing = issue.ingredient
  const ingId = issue.ingredientId

  const [name, setName] = useState(ing?.name ?? issue.parsedName ?? issue.rawText)
  const [nameEn, setNameEn] = useState(ing?.nameEn ?? '')
  const [description, setDescription] = useState(ing?.description ?? '')
  const [groupLabel, setGroupLabel] = useState(ing?.groupLabel ?? '')
  const [synonymsText, setSynonymsText] = useState((ing?.synonyms ?? []).join(', '))

  const [isMerging, setIsMerging] = useState(false)
  const [targetMergeId, setTargetMergeId] = useState<string | null>(null)
  const [targetMergeName, setTargetMergeName] = useState<string>('')

  const [isChoosingImage, setIsChoosingImage] = useState(false)
  const [candidates, setCandidates] = useState<IngredientImageCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )
  const { openImage, lightboxProps } = useMediaLightbox()

  useEffect(() => {
    if (ing) {
      setName(ing.name)
      setNameEn(ing.nameEn ?? '')
      setDescription(ing.description ?? '')
      setGroupLabel(ing.groupLabel ?? '')
      setSynonymsText((ing.synonyms ?? []).join(', '))
    }
  }, [ing])

  const openCandidatePicker = async () => {
    if (!ingId) return
    setIsChoosingImage(true)
    setLoadingCandidates(true)
    try {
      const res = await ingredientsApi.listImageCandidates(ingId)
      setCandidates(res.candidates ?? [])
    } catch {
      setCandidates([])
    } finally {
      setLoadingCandidates(false)
    }
  }

  const handleApprove = async () => {
    if (!ingId) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      const syns = synonymsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      await ingredientsApi.approve(ingId, {
        name: name.trim() || undefined,
        nameEn: nameEn.trim() || undefined,
        description: description.trim() || undefined,
        groupLabel: groupLabel.trim() || undefined,
        synonyms: syns,
        imageCandidateId: selectedCandidateId,
      })
      setFeedback({ type: 'success', message: 'Đã duyệt nguyên liệu thành công!' })
      onUpdated()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Lỗi khi duyệt nguyên liệu',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [showMergeConfirm, setShowMergeConfirm] = useState(false)

  const handleReject = async () => {
    if (!ingId) return
    setIsSubmitting(true)
    try {
      await ingredientsApi.reject(ingId)
      setShowRejectConfirm(false)
      onUpdated()
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi từ chối')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMerge = async () => {
    if (!ingId || !targetMergeId) return
    setIsSubmitting(true)
    try {
      await ingredientsApi.merge(ingId, targetMergeId)
      setShowMergeConfirm(false)
      setIsMerging(false)
      onUpdated()
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi gộp nguyên liệu')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReSearchImage = async () => {
    if (!ingId) return
    try {
      await ingredientsApi.enqueueImageSearch(ingId)
      setFeedback({ type: 'success', message: 'Đã gửi yêu cầu tìm lại ảnh!' })
      setTimeout(onUpdated, 1500)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const isProvisional = ing?.imageStatus === 'PENDING_REVIEW' && ing.imageUrl
  const isApprovedImage = ing?.imageStatus === 'APPROVED'

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-3.5 shadow-sm transition hover:border-amber-300">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {/* Thumbnail & Image Badge */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0 group">
            <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
              <Image
                src={ing?.imageUrl}
                alt={name}
                aspectRatio="square"
                zoomable
                title={name}
                subtitle="Nguyên liệu"
                fallbackIcon="image"
                className="h-16 w-16 rounded-lg"
              />
            </div>
            {isProvisional && (
              <span className="absolute -bottom-2 -left-1 -right-1 block text-center text-[9px] font-semibold text-amber-700 bg-amber-100 rounded px-1 py-0.5 border border-amber-300 shadow-xs">
                Ảnh tự động
              </span>
            )}
            {isApprovedImage && (
              <span className="absolute -bottom-2 -left-1 -right-1 block text-center text-[9px] font-semibold text-emerald-700 bg-emerald-100 rounded px-1 py-0.5 border border-emerald-300">
                Đã duyệt
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-zinc-900">{name}</span>
              {issue.quantity && (
                <span className="text-xs text-zinc-500">
                  ({issue.quantity} {issue.unit || ''})
                </span>
              )}
              {issue.reason === 'UNLINKED' && (
                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 text-[10px]">
                  Chưa liên kết
                </Badge>
              )}
              {issue.reason === 'PENDING_REVIEW' && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px]">
                  Tự động tìm - cần duyệt
                </Badge>
              )}
              {issue.reason === 'REJECTED' && (
                <Badge variant="outline" className="border-red-400 bg-red-100 text-red-800 text-[10px]">
                  Đã từ chối
                </Badge>
              )}
              {ing?.createdVia === 'AI_IMPORT' && (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">
                  AI Import
                </Badge>
              )}
            </div>

            {/* Entity reference links */}
            {ing?.enrichment?.entity && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-600">Thực thể:</span>
                {ing.enrichment.entity.viTitle && (
                  <a
                    href={`https://vi.wikipedia.org/wiki/${encodeURIComponent(ing.enrichment.entity.viTitle)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    Wikipedia ↗
                  </a>
                )}
                {ing.enrichment.entity.wikidataId && (
                  <a
                    href={`https://www.wikidata.org/wiki/${ing.enrichment.entity.wikidataId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    Wikidata ({ing.enrichment.entity.wikidataId}) ↗
                  </a>
                )}
                {ing.enrichment.entity.offTag && (
                  <a
                    href={`https://world.openfoodfacts.org/ingredient/${ing.enrichment.entity.offTag.replace(/^en:/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    Open Food Facts ↗
                  </a>
                )}
              </div>
            )}

            {/* Quick edit fields */}
            {!compact && (
              <div className="grid grid-cols-1 gap-2 pt-1 text-xs sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500">Tên EN:</label>
                  <Input
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="VD: beef, pork belly..."
                    className="mt-0.5 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-500">Nhóm nguyên liệu:</label>
                  <Input
                    value={groupLabel}
                    onChange={(e) => setGroupLabel(e.target.value)}
                    placeholder="VD: Thịt, Rau củ, Gia vị..."
                    className="mt-0.5 h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-zinc-500">Mô tả ngắn:</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả súc tích về đặc điểm/công dụng..."
                    className="mt-0.5 h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium text-zinc-500">Từ đồng nghĩa (phẩy cách):</label>
                  <Input
                    value={synonymsText}
                    onChange={(e) => setSynonymsText(e.target.value)}
                    placeholder="VD: bắp bò, thịt bò thăn..."
                    className="mt-0.5 h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-end">
          {ingId && (
            <>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2.5"
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Duyệt
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsMerging((v) => !v)}
                  disabled={isSubmitting}
                  className="h-7 text-xs px-2"
                >
                  <GitMerge className="mr-1 h-3.5 w-3.5" />
                  Gộp vào...
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={isSubmitting}
                  className="h-7 text-xs text-red-600 hover:bg-red-50 border-red-200 px-2"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Từ chối
                </Button>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={openCandidatePicker}
                  className="text-[11px] text-zinc-600 hover:text-amber-700 underline"
                >
                  Đổi ảnh...
                </button>
                <span className="text-zinc-300">·</span>
                <button
                  type="button"
                  onClick={handleReSearchImage}
                  className="text-[11px] text-zinc-600 hover:text-amber-700 underline"
                >
                  Tìm lại ảnh
                </button>
                <span className="text-zinc-300">·</span>
                <a
                  href={`/food-data?tab=ingredients&q=${encodeURIComponent(name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-zinc-800"
                >
                  Kho NL <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-2 rounded p-2 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Inline Merge Picker */}
      {isMerging && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs">
          <div className="mb-2 font-medium text-amber-900">
            Chọn nguyên liệu đích đã có sẵn để gộp:
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <IngredientPicker
                value={targetMergeName}
                onChange={(selectedName, selectedIng) => {
                  setTargetMergeName(selectedName)
                  setTargetMergeId(selectedIng?.id ?? null)
                }}
                placeholder="Gõ tên nguyên liệu đích trong kho..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowMergeConfirm(true)}
                disabled={!targetMergeId || isSubmitting}
                className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
              >
                Xác nhận gộp
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsMerging(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate image picker drawer/dialog */}
      {isChoosingImage && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-zinc-800">
              Chọn ảnh từ nguồn gợi ý (Wikimedia / Openverse):
            </span>
            <button
              type="button"
              onClick={() => setIsChoosingImage(false)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loadingCandidates ? (
            <div className="py-4 text-center text-xs text-zinc-500">Đang tải danh sách ảnh...</div>
          ) : candidates.length === 0 ? (
            <div className="py-3 text-center text-xs text-zinc-500">
              Chưa có ứng viên ảnh nào. Hãy nhấn &quot;Tìm lại ảnh&quot; để tìm tự động.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {candidates.map((c) => {
                const isAiVerified = c.scoreBreakdown?.vision?.matchesName === true
                const isAiRejected = c.scoreBreakdown?.vision?.matchesName === false
                const providerBadge =
                  c.provider === 'wikipedia_lead'
                    ? 'Wikipedia'
                    : c.provider === 'wikidata_p18'
                      ? 'Wikidata'
                      : c.provider === 'pixabay'
                        ? 'Pixabay'
                        : c.provider === 'commons_category'
                          ? 'Commons Cat'
                          : c.provider === 'wikimedia_commons'
                            ? 'Commons'
                            : c.provider

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCandidateId(c.id)}
                    className={`group relative cursor-pointer overflow-hidden rounded-md border p-1 text-center transition ${
                      selectedCandidateId === c.id
                        ? 'border-emerald-500 ring-2 ring-emerald-300'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="relative overflow-hidden rounded">
                      <Image
                        src={c.previewUrl || c.originalUrl}
                        alt={c.providerAssetId}
                        className="h-20 w-full rounded object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const candidateImg = c.originalUrl || c.previewUrl
                          if (candidateImg) {
                            openImage(
                              candidateImg,
                              `Ứng viên: ${name}`,
                              `${providerBadge} · Điểm: ${c.score}`,
                            )
                          }
                        }}
                        className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/80"
                        title="Phóng to ảnh ứng viên"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[10px]">
                      <span className="font-semibold text-zinc-700">Điểm: {c.score}</span>
                      <span className="rounded bg-zinc-100 px-1 py-0.5 text-[9px] text-zinc-600">{providerBadge}</span>
                    </div>
                    {isAiVerified && (
                      <div className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 text-[9px] font-medium text-emerald-700">
                        ✓ AI xác minh
                      </div>
                    )}
                    {isAiRejected && (
                      <div className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-red-50 px-1 text-[9px] font-medium text-red-600">
                        ✗ AI cảnh báo
                      </div>
                    )}
                    <div className="mt-0.5 truncate text-[9px] text-zinc-400">
                      <a
                        href={c.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline text-blue-500"
                      >
                        {c.licenseCode || 'Nguồn'} ↗
                      </a>
                    </div>
                    {selectedCandidateId === c.id && (
                      <div className="absolute right-1 top-1 rounded-full bg-emerald-600 p-0.5 text-white">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Từ chối nguyên liệu?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn từ chối nguyên liệu <b>"{name}"</b>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Đang từ chối...' : 'Xác nhận từ chối'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMergeConfirm} onOpenChange={setShowMergeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận gộp nguyên liệu</AlertDialogTitle>
            <AlertDialogDescription>
              Xác nhận gộp <b>"{name}"</b> vào <b>"{targetMergeName}"</b>? Các công thức liên quan sẽ được tự động cập nhật sang nguyên liệu đích.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMerge}
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? 'Đang gộp...' : 'Đồng ý gộp'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MediaLightbox {...lightboxProps} />
    </div>
  )
}
