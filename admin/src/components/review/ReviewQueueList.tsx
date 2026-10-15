import {
  Search,
  LayoutGrid,
  List,
  CheckCircle2,
  Utensils,
  AlertTriangle,
  MapPin,
  Flame,
  Layers,
  Check,
  Eye,
  MoreVertical,
  XCircle,
} from 'lucide-react'
import type { ReviewQueueItem } from '../../types'
import { Card, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Select } from '../ui/select'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Image } from '../ui/image'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { TableSkeleton } from '../ui/page-skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { getConfidenceMeta } from './types'

export interface ReviewQueueListProps {
  isLoading: boolean
  items: ReviewQueueItem[]
  availableRegions: { id: string; name: string }[]
  searchTerm: string
  onSearchChange: (val: string) => void
  regionFilter: string
  onRegionChange: (val: string) => void
  qualityFilter: 'ALL' | 'READY' | 'NEEDS_WORK'
  onQualityChange: (val: 'ALL' | 'READY' | 'NEEDS_WORK') => void
  sortBy: 'NEWEST' | 'SCORE_DESC' | 'SCORE_ASC' | 'NAME'
  onSortChange: (val: 'NEWEST' | 'SCORE_DESC' | 'SCORE_ASC' | 'NAME') => void
  viewMode: 'grid' | 'table'
  onViewModeChange: (val: 'grid' | 'table') => void
  onSelect: (item: ReviewQueueItem) => void
  onQuickApprove: (item: ReviewQueueItem) => void
  onRequestChanges: (item: ReviewQueueItem) => void
  onQuickReject: (item: ReviewQueueItem) => void
  isApproving?: boolean
}

export function ReviewQueueList({
  isLoading,
  items,
  availableRegions,
  searchTerm,
  onSearchChange,
  regionFilter,
  onRegionChange,
  qualityFilter,
  onQualityChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onSelect,
  onQuickApprove,
  onRequestChanges,
  onQuickReject,
  isApproving,
}: ReviewQueueListProps) {
  return (
    <div className="space-y-4">
      {/* Toolbar: Search, Filters & View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {/* Search input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Tìm theo tên món, mã #id, vùng miền..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Region filter */}
          <Select
            value={regionFilter}
            onChange={(e) => onRegionChange(e.target.value)}
            className="h-9 text-xs w-36"
          >
            <option value="ALL">Tất cả vùng miền</option>
            {availableRegions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>

          {/* Quality filter */}
          <Select
            value={qualityFilter}
            onChange={(e) => onQualityChange(e.target.value as any)}
            className="h-9 text-xs w-44"
          >
            <option value="ALL">Tất cả độ hoàn thiện</option>
            <option value="READY">Đủ chuẩn duyệt (≥80%)</option>
            <option value="NEEDS_WORK">Cần bổ sung (&lt;80%)</option>
          </Select>

          {/* Sort by */}
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as any)}
            className="h-9 text-xs w-36"
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="SCORE_DESC">Điểm cao nhất</option>
            <option value="SCORE_ASC">Cần lưu ý trước</option>
            <option value="NAME">Tên A-Z</option>
          </Select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border-l border-border pl-3 self-end sm:self-auto">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange('grid')}
            title="Dạng thẻ trực quan"
          >
            <LayoutGrid size={15} />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange('table')}
            title="Dạng bảng đối chiếu"
          >
            <List size={15} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <TableSkeleton rows={5} cols={4} />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 opacity-60 mb-3" />
            <div className="font-bold text-foreground text-base">
              {searchTerm || regionFilter !== 'ALL' || qualityFilter !== 'ALL'
                ? 'Không tìm thấy món ăn phù hợp với bộ lọc'
                : 'Hàng đợi kiểm duyệt trống'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchTerm || regionFilter !== 'ALL' || qualityFilter !== 'ALL'
                ? 'Hãy thử thay đổi từ khóa hoặc điều chỉnh lại các điều kiện lọc phía trên.'
                : 'Tất cả món ăn đã được kiểm duyệt và xuất bản hoàn tất! Các món mới do người dùng hoặc AI tạo sẽ hiển thị tại đây.'}
            </p>
            {(searchTerm || regionFilter !== 'ALL' || qualityFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => {
                  onSearchChange('')
                  onRegionChange('ALL')
                  onQualityChange('ALL')
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Mode 1: Grid Cards View ─────────────────────────────── */}
      {!isLoading && items.length > 0 && viewMode === 'grid' && (
        <div className="space-y-3">
          {items.map((item) => {
            const primaryMedia = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]
            const nutrition = item.nutritionProfiles?.[0]
            const meta = getConfidenceMeta(item.confidenceScore)
            const MetaIcon = meta.icon
            const unresolvedCount = item.fieldEvidences?.filter((e) => !e.isResolved).length ?? 0

            return (
              <Card
                key={item.id}
                className="group border border-border hover:border-amber-400/80 hover:shadow-md transition-all duration-200 bg-card overflow-hidden"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Thumbnail & Core info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Thumbnail */}
                    <div
                      className="relative shrink-0 rounded-xl overflow-hidden border border-border shadow-xs bg-muted/30 w-18 h-18 sm:w-20 sm:h-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {primaryMedia?.publicUrl ? (
                        <Image
                          src={primaryMedia.publicUrl}
                          alt={item.name}
                          aspectRatio="square"
                          zoomable
                          title={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground">
                          <Utensils size={22} className="opacity-40" />
                          <span className="text-[9px] mt-1 font-medium">Chưa có ảnh</span>
                        </div>
                      )}
                      {item.media && item.media.length > 1 && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                          +{item.media.length - 1}
                        </span>
                      )}
                    </div>

                    {/* Title, Badges & Meta */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Top row: Name & Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-bold text-base text-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer truncate"
                          onClick={() => onSelect(item)}
                        >
                          {item.name}
                        </span>

                        <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                          Chờ duyệt
                        </Badge>

                        <Badge
                          variant={meta.variant}
                          className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${meta.colorClass}`}
                        >
                          <MetaIcon size={11} />
                          {meta.label}
                        </Badge>

                        {unresolvedCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-2 py-0.5 flex items-center gap-1"
                          >
                            <AlertTriangle size={11} />
                            {unresolvedCount} cảnh báo
                          </Badge>
                        )}
                      </div>

                      {/* Middle row: Metadata tags */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded text-foreground/80">
                          #{item.id.slice(0, 8)}
                        </span>

                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-amber-600" />
                          {item.region?.name ?? 'Món Việt'}
                        </span>

                        <span className="flex items-center gap-1">
                          <Flame size={12} className="text-orange-500" />
                          {nutrition?.calories
                            ? `${Number(nutrition.calories).toLocaleString()} kcal`
                            : 'Chưa có calo'}
                        </span>

                        <span className="flex items-center gap-1">
                          <Utensils size={12} className="text-emerald-600" />
                          {item._count?.ingredients ?? 0} nguyên liệu
                        </span>

                        <span className="flex items-center gap-1">
                          <Layers size={12} className="text-blue-500" />
                          {item._count?.steps ?? 0} bước nấu
                        </span>
                      </div>

                      {/* Mini Progress Indicator */}
                      <div className="flex items-center gap-2 max-w-xs pt-0.5">
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${meta.barColor}`}
                            style={{ width: `${meta.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {meta.pct}% hoàn chỉnh
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border justify-end">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 h-9 text-xs px-3 shadow-xs"
                      onClick={() => onQuickApprove(item)}
                      disabled={isApproving}
                    >
                      <Check size={14} />
                      Duyệt nhanh
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs gap-1.5 px-3 border-border hover:bg-accent hover:border-amber-400"
                      onClick={() => onSelect(item)}
                    >
                      <Eye size={14} />
                      Chi tiết
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onRequestChanges(item)}>
                          <AlertTriangle size={13} className="mr-2 text-amber-500" />
                          Yêu cầu sửa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600"
                          onClick={() => onQuickReject(item)}
                        >
                          <XCircle size={13} className="mr-2" />
                          Từ chối món
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Mode 2: Table View ──────────────────────────────────── */}
      {!isLoading && items.length > 0 && viewMode === 'table' && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-16">Ảnh</TableHead>
                <TableHead className="min-w-[180px]">Món ăn & Mã</TableHead>
                <TableHead className="w-36">Vùng miền</TableHead>
                <TableHead className="w-40">Cấu trúc</TableHead>
                <TableHead className="w-28">Năng lượng</TableHead>
                <TableHead className="w-36 text-center">Độ hoàn thiện</TableHead>
                <TableHead className="w-48 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const primaryMedia = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]
                const nutrition = item.nutritionProfiles?.[0]
                const meta = getConfidenceMeta(item.confidenceScore)
                const MetaIcon = meta.icon

                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* Image */}
                    <TableCell>
                      <div className="w-11 h-11 rounded-lg overflow-hidden border border-border bg-muted/40 shrink-0">
                        {primaryMedia?.publicUrl ? (
                          <Image
                            src={primaryMedia.publicUrl}
                            alt={item.name}
                            aspectRatio="square"
                            zoomable
                            title={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Utensils size={14} className="opacity-40" />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Name & ID */}
                    <TableCell>
                      <div
                        className="font-bold text-xs text-foreground hover:text-amber-600 cursor-pointer truncate max-w-[200px]"
                        onClick={() => onSelect(item)}
                      >
                        {item.name}
                      </div>
                      <code className="text-[10px] text-muted-foreground font-mono">
                        #{item.id.slice(0, 8)}
                      </code>
                    </TableCell>

                    {/* Region */}
                    <TableCell className="text-xs text-foreground">
                      {item.region?.name ?? 'Món Việt'}
                    </TableCell>

                    {/* Ingredients / Steps */}
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{item._count?.ingredients ?? 0} nguyên liệu</div>
                      <div className="text-[11px]">{item._count?.steps ?? 0} bước nấu</div>
                    </TableCell>

                    {/* Calories */}
                    <TableCell className="text-xs font-medium text-foreground">
                      {nutrition?.calories
                        ? `${Number(nutrition.calories).toLocaleString()} kcal`
                        : '—'}
                    </TableCell>

                    {/* Score badge */}
                    <TableCell className="text-center">
                      <Badge
                        variant={meta.variant}
                        className={`text-[10px] px-2 py-0.5 inline-flex items-center gap-1 ${meta.colorClass}`}
                      >
                        <MetaIcon size={10} />
                        {meta.label}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5"
                          onClick={() => onQuickApprove(item)}
                          disabled={isApproving}
                        >
                          <Check size={12} className="mr-1" /> Duyệt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5"
                          onClick={() => onSelect(item)}
                        >
                          <Eye size={12} className="mr-1" /> Chi tiết
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
