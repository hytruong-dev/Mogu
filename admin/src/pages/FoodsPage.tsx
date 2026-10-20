import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { PageContainer, PageHeader } from '../components/layout'
import {
  FoodsStatCards,
  FoodsFilterBar,
  FoodsTable,
  FoodsBatchBar,
  DishDetailDialog,
} from '../components/foods'
import { ImportFromFileModal } from '../components/molecules/import-from-file'
import { SubmitReviewBlockedDialog } from '../components/molecules/SubmitReviewBlockedDialog'
import {
  useAdminDishes,
  useDishLifecycle,
  useDeleteDish,
} from '../hooks/useDishes'
import {
  useCategories,
  useMealTypes,
  useRegions,
} from '../hooks/useTaxonomy'
import { useAuth } from '../providers/AuthProvider'
import { dishesApi, type AdminDishQuery } from '../api/dishes'
import type { Dish, DishStatus } from '../types'

export default function FoodsPage() {
  const navigate = useNavigate()
  const { isSuperAdmin, isContentAdmin } = useAuth()
  const canEdit = isSuperAdmin || isContentAdmin
  const lifecycle = useDishLifecycle()
  const deleteDish = useDeleteDish()

  // Taxonomy queries
  const { data: categories = [] } = useCategories()
  const { data: mealTypes = [] } = useMealTypes()
  const { data: regions = [] } = useRegions()

  // Query filter states
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<DishStatus | 'ALL'>('ALL')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [mealTypeId, setMealTypeId] = useState<string | undefined>()
  const [regionId, setRegionId] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const limit = 20

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Build query parameters
  const queryParams: AdminDishQuery = useMemo(() => {
    const params: AdminDishQuery = {
      limit,
    }
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim()
    if (status !== 'ALL') params.status = status
    if (categoryId) params.categoryCode = categories.find((c: any) => c.id === categoryId)?.code
    if (mealTypeId) params.mealTypeCode = mealTypes.find((m: any) => m.id === mealTypeId)?.code
    if (regionId) params.regionId = regionId
    return params
  }, [limit, debouncedSearch, status, categoryId, mealTypeId, regionId, categories, mealTypes])

  const { data: dishesResponse, isLoading } = useAdminDishes(queryParams)
  const dishes = dishesResponse?.data ?? []
  const totalCount = dishesResponse?.total ?? dishes.length
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  // Separate stats queries for quick metrics
  const { data: allDishes } = useAdminDishes({ limit: 1 })
  const { data: pubDishes } = useAdminDishes({ status: 'PUBLISHED', limit: 1 })
  const { data: pendDishes } = useAdminDishes({ status: 'PENDING_REVIEW', limit: 1 })
  const { data: draftDishes } = useAdminDishes({ status: 'DRAFT', limit: 1 })
  const { data: archDishes } = useAdminDishes({ status: 'ARCHIVED', limit: 1 })

  const stats = {
    total: allDishes?.total ?? 0,
    published: pubDishes?.total ?? 0,
    pending: pendDishes?.total ?? 0,
    draft: draftDishes?.total ?? 0,
    archived: archDishes?.total ?? 0,
  }

  // Row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (dishes.every((d) => selectedIds.has(d.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(dishes.map((d) => d.id)))
    }
  }

  // Modals & Drawers state
  const [detailDish, setDetailDish] = useState<Dish | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [blocked, setBlocked] = useState<{ dishId: string; dishName: string; validation: any } | null>(null)
  const [bulkNotice, setBulkNotice] = useState<string | null>(null)

  // Listen for review submission requests from row actions
  useEffect(() => {
    const handler = async (e: any) => {
      const { id, name } = e.detail || {}
      if (!id) return
      try {
        const val = await dishesApi.validate(id)
        if (val && !val.canSubmitReview) {
          setBlocked({ dishId: id, dishName: name || 'Món ăn', validation: val })
          return
        }
        await lifecycle.submitForReview.mutateAsync({ id })
        setBulkNotice(`Đã gửi kiểm duyệt món "${name}" thành công`)
      } catch (err: any) {
        alert(err?.message || 'Gửi kiểm duyệt thất bại')
      }
    }
    window.addEventListener('mogu:submit-review', handler)
    return () => window.removeEventListener('mogu:submit-review', handler)
  }, [lifecycle.submitForReview])

  // Batch actions
  const handleBatchPublish = () => {
    selectedIds.forEach((id) => lifecycle.publishDirect.mutate(id))
    setBulkNotice(`Đang xuất bản ${selectedIds.size} món ăn đã chọn...`)
    setSelectedIds(new Set())
  }

  const handleBatchArchive = () => {
    selectedIds.forEach((id) => lifecycle.archive.mutate(id))
    setBulkNotice(`Đang lưu trữ ${selectedIds.size} món ăn đã chọn...`)
    setSelectedIds(new Set())
  }

  const handleBatchDelete = async () => {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.size} món ăn đã chọn?`)) return
    for (const id of selectedIds) {
      try {
        await deleteDish.mutateAsync(id)
      } catch (e) {
        console.error(e)
      }
    }
    setSelectedIds(new Set())
    setBulkNotice('Đã hoàn tất xóa hàng loạt món ăn')
  }

  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setStatus('ALL')
    setCategoryId(undefined)
    setMealTypeId(undefined)
    setRegionId(undefined)
    setPage(1)
  }

  return (
    <PageContainer>
      <PageHeader
        title="Kho món ăn"
        description="Quản lý toàn bộ cơ sở dữ liệu ẩm thực, chỉ số dinh dưỡng, công thức và hình ảnh minh họa."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="text-xs h-9 gap-1.5 font-semibold text-slate-700 bg-white"
            >
              <Upload size={14} />
              Nhập từ file Excel
            </Button>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                onClick={() => navigate('/foods/new')}
                className="text-xs h-9 gap-1.5 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
              >
                <Plus size={15} />
                Thêm món mới
              </Button>
            )}
          </div>
        }
      />

      {/* Metric Cards */}
      <FoodsStatCards
        stats={stats}
        activeStatus={status}
        onSelectStatus={(s) => {
          setStatus(s)
          setPage(1)
        }}
      />

      {/* Filter Bar */}
      <FoodsFilterBar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={(s) => {
          setStatus(s)
          setPage(1)
        }}
        categoryId={categoryId}
        onCategoryChange={(c) => {
          setCategoryId(c)
          setPage(1)
        }}
        categories={categories}
        mealTypeId={mealTypeId}
        onMealTypeChange={(m) => {
          setMealTypeId(m)
          setPage(1)
        }}
        mealTypes={mealTypes}
        regionId={regionId}
        onRegionChange={(r) => {
          setRegionId(r)
          setPage(1)
        }}
        regions={regions}
        onReset={handleResetFilters}
        totalCount={totalCount}
      />

      {/* Main Foods Table */}
      <FoodsTable
        dishes={dishes}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onView={(d) => setDetailDish(d)}
        onEdit={(d) => navigate(`/foods/${d.id}`)}
        isLoading={isLoading}
      />

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2 text-xs text-slate-500">
          <div>
            Trang <b className="text-slate-900">{page}</b> / {totalPages} (Tổng {totalCount} món)
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2 text-xs gap-1"
            >
              <ChevronLeft size={14} /> Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2 text-xs gap-1"
            >
              Sau <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Floating Batch Actions Bar */}
      <FoodsBatchBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onBatchPublish={handleBatchPublish}
        onBatchArchive={handleBatchArchive}
        onBatchDelete={handleBatchDelete}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Dish Detail Dialog */}
      {detailDish && (
        <DishDetailDialog
          dish={detailDish}
          onClose={() => setDetailDish(null)}
          onEdit={(d) => {
            setDetailDish(null)
            navigate(`/foods/${d.id}`)
          }}
        />
      )}

      {/* Import from Excel / JSON Modal */}
      <ImportFromFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onViewDrafts={() => {
          setStatus('DRAFT')
          setPage(1)
        }}
      />

      {/* Submit Review Blocked Dialog */}
      <SubmitReviewBlockedDialog
        open={!!blocked}
        onOpenChange={(o) => {
          if (!o) setBlocked(null)
        }}
        dishId={blocked?.dishId}
        dishName={blocked?.dishName}
        validation={blocked?.validation ?? null}
        onIngredientsChanged={() => {
          if (!blocked) return
          const { dishId, dishName } = blocked
          void dishesApi
            .validate(dishId)
            .then((v) => {
              if (v) setBlocked((cur) => (cur && cur.dishId === dishId ? { dishId, dishName, validation: v } : cur))
            })
            .catch(() => undefined)
        }}
        onResolved={() => {
          if (!blocked) return
          const { dishId, dishName } = blocked
          void dishesApi
            .validate(dishId)
            .then((v) => {
              if (!v || v.canSubmitReview) {
                setBlocked(null)
                lifecycle.submitForReview.mutate({ id: dishId })
              } else {
                setBlocked({ dishId, dishName, validation: v })
              }
            })
            .catch(() => undefined)
        }}
      />

      {/* Floating Toast Notification */}
      {bulkNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-amber-200 rounded-xl shadow-xl p-3.5 flex items-center gap-3 text-xs text-slate-800 animate-in fade-in slide-in-from-bottom-2">
          <span>{bulkNotice}</span>
          <button
            type="button"
            onClick={() => setBulkNotice(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </PageContainer>
  )
}
