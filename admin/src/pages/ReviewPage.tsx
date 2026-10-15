import { useState, useMemo } from 'react'
import { Clock, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useReviewQueue, useReviewActions } from '../hooks/useReviewQueue'
import type { ReviewQueueItem } from '../types'
import { PageContainer, PageHeader } from '../components/layout'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import {
  ReviewMetricsCards,
  ReviewQueueList,
  ReviewDishDetail,
  ReviewActionDialog,
  CommunityReviewsTab,
} from '../components/review'

export default function ReviewPage() {
  const { data, isLoading } = useReviewQueue({ limit: 50 })
  const actions = useReviewActions()

  const [selected, setSelected] = useState<ReviewQueueItem | null>(null)
  const [activeTab, setActiveTab] = useState<'content' | 'community'>('content')

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [qualityFilter, setQualityFilter] = useState<'ALL' | 'READY' | 'NEEDS_WORK'>('ALL')
  const [sortBy, setSortBy] = useState<'NEWEST' | 'SCORE_DESC' | 'SCORE_ASC' | 'NAME'>('NEWEST')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Quick Action State
  const [quickApproveItem, setQuickApproveItem] = useState<ReviewQueueItem | null>(null)
  const [quickRejectItem, setQuickRejectItem] = useState<ReviewQueueItem | null>(null)
  const [quickRequestChangesItem, setQuickRequestChangesItem] = useState<ReviewQueueItem | null>(null)

  const items = data?.data ?? []
  const total = data?.total ?? items.length

  // Calculate metrics
  const metrics = useMemo(() => {
    let readyCount = 0
    let needsWorkCount = 0
    let totalScore = 0

    items.forEach((item) => {
      const score = item.confidenceScore ?? 0
      totalScore += score
      if (score >= 80) readyCount++
      else needsWorkCount++
    })

    const avgScore = items.length > 0 ? Math.round(totalScore / items.length) : 0

    return {
      readyCount,
      needsWorkCount,
      avgScore,
    }
  }, [items])

  // Extract regions for filter
  const availableRegions = useMemo(() => {
    const map = new Map<string, string>()
    items.forEach((item) => {
      if (item.region?.id && item.region?.name) {
        map.set(item.region.id, item.region.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...items]

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.region?.name?.toLowerCase().includes(q)
      )
    }

    if (regionFilter !== 'ALL') {
      result = result.filter((item) => item.region?.id === regionFilter)
    }

    if (qualityFilter === 'READY') {
      result = result.filter((item) => (item.confidenceScore ?? 0) >= 80)
    } else if (qualityFilter === 'NEEDS_WORK') {
      result = result.filter((item) => (item.confidenceScore ?? 0) < 80)
    }

    result.sort((a, b) => {
      if (sortBy === 'SCORE_DESC') {
        return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0)
      }
      if (sortBy === 'SCORE_ASC') {
        return (a.confidenceScore ?? 0) - (b.confidenceScore ?? 0)
      }
      if (sortBy === 'NAME') {
        return a.name.localeCompare(b.name, 'vi')
      }
      return 0
    })

    return result
  }, [items, searchTerm, regionFilter, qualityFilter, sortBy])

  const handleConfirmQuickApprove = async () => {
    if (!quickApproveItem) return
    await actions.approve.mutateAsync(quickApproveItem.id)
    setQuickApproveItem(null)
  }

  if (selected) {
    return (
      <PageContainer>
        <ReviewDishDetail dish={selected} onBack={() => setSelected(null)} />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Hàng đợi kiểm duyệt"
        description="Rà soát đối chiếu hình ảnh, định lượng nguyên liệu, dinh dưỡng và phê duyệt món ăn xuất bản."
        badge={
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <ShieldCheck size={16} />
            <span>Vận hành & Kiểm duyệt</span>
          </div>
        }
        actions={
          <Badge
            variant="outline"
            className="px-3 py-1 text-xs gap-1.5 font-medium border-amber-300 dark:border-amber-700 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          >
            <Clock size={13} className="text-amber-500" />
            Tự động cập nhật mỗi 30s
          </Badge>
        }
      />

      <ReviewMetricsCards isLoading={isLoading} total={total} metrics={metrics} />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as typeof activeTab)}
        className="w-full"
      >
        <TabsList className="bg-muted/60 p-1 h-10 w-full sm:w-auto">
          <TabsTrigger
            value="content"
            className="px-4 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Món ăn chờ duyệt ({total})
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="px-4 text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Đánh giá người dùng
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'content' && (
        <ReviewQueueList
          isLoading={isLoading}
          items={filteredItems}
          availableRegions={availableRegions}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
          qualityFilter={qualityFilter}
          onQualityChange={setQualityFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSelect={setSelected}
          onQuickApprove={setQuickApproveItem}
          onRequestChanges={setQuickRequestChangesItem}
          onQuickReject={setQuickRejectItem}
          isApproving={actions.approve.isPending}
        />
      )}

      {activeTab === 'community' && <CommunityReviewsTab />}

      {/* Quick Approve Dialog */}
      <AlertDialog open={!!quickApproveItem} onOpenChange={(open) => !open && setQuickApproveItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              Duyệt nhanh món ăn?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn duyệt và xuất bản món “
              <span className="font-bold text-foreground">{quickApproveItem?.name}</span>” ngay lập tức?
              Món ăn sẽ hiển thị công khai trên ứng dụng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.approve.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmQuickApprove}
              disabled={actions.approve.isPending}
            >
              {actions.approve.isPending ? 'Đang duyệt…' : 'Xác nhận duyệt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Request Changes Dialog */}
      {quickRequestChangesItem && (
        <ReviewActionDialog
          title={`Yêu cầu sửa: ${quickRequestChangesItem.name}`}
          isPending={actions.requestChanges.isPending}
          onClose={() => setQuickRequestChangesItem(null)}
          onConfirm={(reasonCode, note) => {
            actions.requestChanges.mutate({ dishId: quickRequestChangesItem.id, reasonCode, note })
            setQuickRequestChangesItem(null)
          }}
        />
      )}

      {/* Quick Reject Dialog */}
      {quickRejectItem && (
        <ReviewActionDialog
          title={`Từ chối món: ${quickRejectItem.name}`}
          isPending={actions.reject.isPending}
          onClose={() => setQuickRejectItem(null)}
          onConfirm={(reasonCode, note) => {
            actions.reject.mutate({ dishId: quickRejectItem.id, reasonCode, note })
            setQuickRejectItem(null)
          }}
        />
      )}
    </PageContainer>
  )
}
