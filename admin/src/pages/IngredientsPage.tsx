import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import {
  ingredientsApi,
  type CreateIngredientDto,
  type Ingredient,
  type UpdateIngredientDto,
  type IngredientImageCandidate,
} from '../api/ingredients'
import { taxonomyAdminApi } from '../api/taxonomy'
import { useFoodDataActions } from '../components/food-data/food-data-context'
import { FoodDataPagination } from '../components/food-data/FoodDataPagination'
import { Button } from '../components/ui/button'
import { PageContainer, PageHeader } from '../components/layout'
import {
  IngredientsFilterBar,
  IngredientsTable,
  IngredientFormDialog,
  IngredientMergeDialog,
  IngredientDetailDrawer,
  LEGACY_ALLERGEN_LABELS,
  SUPABASE_URL,
} from '../components/ingredients'

export default function IngredientsPage({
  embedded = false,
  isActive = true,
}: {
  embedded?: boolean
  isActive?: boolean
}) {
  const qc = useQueryClient()
  const { registerCreateHandler } = useFoodDataActions()

  // Filters & Pagination
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('ALL')
  const [allergenCode, setAllergenCode] = useState<string | undefined>()
  const [createdVia, setCreatedVia] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Modals & Drawers state
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Ingredient | null>(null)
  const [detailItem, setDetailItem] = useState<Ingredient | null>(null)
  const [mergeSource, setMergeSource] = useState<Ingredient | null>(null)
  const [imageCandidates, setImageCandidates] = useState<IngredientImageCandidate[]>([])
  const [imageBusy, setImageBusy] = useState(false)

  // Taxonomy allergens
  const { data: allergens = [] } = useQuery({
    queryKey: ['admin-allergens'],
    queryFn: taxonomyAdminApi.listAllergens,
    staleTime: 60_000,
  })

  const allergenOptions = useMemo(() => {
    const fromCatalog = allergens
      .filter((a) => a.active)
      .map((a) => ({ value: a.code, label: a.name }))
    if (fromCatalog.length > 0) return fromCatalog
    return Object.entries(LEGACY_ALLERGEN_LABELS).map(([value, label]) => ({ value, label }))
  }, [allergens])

  const allergenMap = useMemo(() => {
    const map: Record<string, string> = {}
    allergens.forEach((a) => {
      if (a.code && a.name) {
        map[a.code] = a.name
        map[a.code.toUpperCase()] = a.name
        map[a.code.toLowerCase()] = a.name
      }
    })
    return map
  }, [allergens])

  // Fetch ingredients
  const { data: ingredientsResponse, isLoading } = useQuery({
    queryKey: ['admin-ingredients', search, allergenCode, status, page, limit],
    queryFn: () =>
      ingredientsApi.adminList({
        q: search || undefined,
        allergenCode: allergenCode || undefined,
        status: status !== 'ALL' ? (status as any) : undefined,
        page,
        limit,
      }),
  })

  const ingredients = ingredientsResponse?.data ?? []
  const totalCount = ingredientsResponse?.pagination?.total ?? ingredients.length

  // Fetch image candidates when detail item opens
  useEffect(() => {
    if (!detailItem?.id) {
      setImageCandidates([])
      return
    }
    let cancelled = false
    void ingredientsApi
      .listImageCandidates(detailItem.id)
      .then((res) => {
        if (!cancelled) setImageCandidates(res.candidates as any)
      })
      .catch(() => {
        if (!cancelled) setImageCandidates([])
      })
    return () => {
      cancelled = true
    }
  }, [detailItem?.id])

  // Mutations
  const createMut = useMutation({
    mutationFn: ingredientsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateIngredientDto }) =>
      ingredientsApi.update(id, dto),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
      setDetailItem((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
    },
  })

  const deleteMut = useMutation({
    mutationFn: ingredientsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      qc.invalidateQueries({ queryKey: ['food-data-tab-count', 'ingredients'] })
      setDetailItem(null)
    },
  })

  // Register create handler if inside FoodDataPage tab view
  useEffect(() => {
    if (!embedded || !isActive) return
    registerCreateHandler(() => {
      setEditTarget(null)
      setModalOpen(true)
    })
    return () => registerCreateHandler(null)
  }, [embedded, isActive, registerCreateHandler])

  const handleSave = async (dto: CreateIngredientDto, imageFile: File | null) => {
    let saved: Ingredient
    if (editTarget) {
      const { code: _code, ...updateDto } = dto
      void _code
      saved = await updateMut.mutateAsync({ id: editTarget.id, dto: updateDto })
    } else {
      saved = await createMut.mutateAsync(dto)
    }

    if (imageFile && saved?.id) {
      try {
        await ingredientsApi.uploadImage(saved.id, imageFile, SUPABASE_URL)
        qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      } catch {
        // Keep record even if image upload fails
      }
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await updateMut.mutateAsync({ id, dto: { isActive: active } })
    } catch (err) {
      console.error(err)
    }
  }

  const handleApprove = async (item: Ingredient) => {
    try {
      await ingredientsApi.approve(item.id)
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      setDetailItem(null)
    } catch (err: any) {
      alert(`Duyệt thất bại: ${err?.message ?? 'Đã có lỗi'}`)
    }
  }

  const handleReject = async (item: Ingredient) => {
    try {
      await ingredientsApi.reject(item.id)
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
      setDetailItem(null)
    } catch (err: any) {
      alert(`Từ chối thất bại: ${err?.message ?? 'Đã có lỗi'}`)
    }
  }

  const handleMergeConfirm = async (targetId: string) => {
    if (!mergeSource) return
    await ingredientsApi.merge(mergeSource.id, targetId)
    qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
    setMergeSource(null)
    setDetailItem(null)
  }

  const handleSearchImages = async () => {
    if (!detailItem) return
    setImageBusy(true)
    try {
      await ingredientsApi.enqueueImageSearch(detailItem.id)
      const res = await ingredientsApi.listImageCandidates(detailItem.id)
      setImageCandidates(res.candidates as any)
    } catch (err: any) {
      alert(`Tìm ảnh thất bại: ${err?.message ?? 'Đã có lỗi'}`)
    } finally {
      setImageBusy(false)
    }
  }

  const handleApproveCandidate = async (candidateId: string) => {
    if (!detailItem) return
    setImageBusy(true)
    try {
      const updated = await ingredientsApi.setImage(detailItem.id, { candidateId })
      setDetailItem((prev) => (prev ? { ...prev, ...updated } : prev))
      qc.invalidateQueries({ queryKey: ['admin-ingredients'] })
    } catch (err: any) {
      alert(`Chọn ảnh thất bại: ${err?.message ?? 'Đã có lỗi'}`)
    } finally {
      setImageBusy(false)
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setStatus('ALL')
    setAllergenCode(undefined)
    setCreatedVia(undefined)
    setPage(1)
  }

  const content = (
    <>
      {!embedded && (
        <PageHeader
          title="Từ điển nguyên liệu"
          description="Quản lý danh mục nguyên liệu, phân loại dị ứng, dinh dưỡng chuẩn hóa và ảnh minh họa tự động."
          actions={
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditTarget(null)
                setModalOpen(true)
              }}
              className="text-xs h-9 gap-1.5 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
            >
              <Plus size={15} />
              Thêm nguyên liệu
            </Button>
          }
        />
      )}

      {/* Filter Bar */}
      <IngredientsFilterBar
        search={search}
        onSearchChange={(s) => {
          setSearch(s)
          setPage(1)
        }}
        status={status}
        onStatusChange={(st) => {
          setStatus(st)
          setPage(1)
        }}
        allergenCode={allergenCode}
        onAllergenCodeChange={(a) => {
          setAllergenCode(a)
          setPage(1)
        }}
        allergenOptions={allergenOptions}
        createdVia={createdVia}
        onCreatedViaChange={(c) => {
          setCreatedVia(c)
          setPage(1)
        }}
        onReset={handleResetFilters}
        totalCount={totalCount}
      />

      {/* Table */}
      <IngredientsTable
        ingredients={ingredients}
        isLoading={isLoading}
        allergenMap={allergenMap}
        onView={(item) => setDetailItem(item)}
        onEdit={(item) => {
          setEditTarget(item)
          setModalOpen(true)
        }}
        onMerge={(item) => setMergeSource(item)}
        onDelete={(item) => {
          if (confirm(`Bạn có chắc chắn muốn xóa nguyên liệu "${item.name}"?`)) {
            deleteMut.mutate(item.id)
          }
        }}
        onToggleActive={handleToggleActive}
      />

      {/* Pagination */}
      {ingredientsResponse?.pagination && (
        <div className="mt-4">
          <FoodDataPagination
            page={page}
            limit={limit}
            total={totalCount}
            totalPages={ingredientsResponse.pagination.totalPages}
            onPageChange={setPage}
            onLimitChange={setLimit}
            itemLabel="nguyên liệu"
          />
        </div>
      )}

      {/* Form Dialog */}
      <IngredientFormDialog
        open={modalOpen}
        ingredient={editTarget}
        allergenOptions={allergenOptions}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        saving={createMut.isPending || updateMut.isPending}
      />

      {/* Merge Dialog */}
      <IngredientMergeDialog
        sourceItem={mergeSource}
        onClose={() => setMergeSource(null)}
        onMerge={handleMergeConfirm}
      />

      {/* Slide-out Detail Drawer */}
      <IngredientDetailDrawer
        item={detailItem}
        allergenMap={allergenMap}
        onClose={() => setDetailItem(null)}
        onEdit={(item) => {
          setDetailItem(null)
          setEditTarget(item)
          setModalOpen(true)
        }}
        onMerge={(item) => {
          setMergeSource(item)
        }}
        onDelete={(item) => {
          if (confirm(`Bạn có chắc muốn xóa nguyên liệu "${item.name}"?`)) {
            deleteMut.mutate(item.id)
          }
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        imageCandidates={imageCandidates}
        imageBusy={imageBusy}
        onSearchImages={handleSearchImages}
        onApproveCandidate={handleApproveCandidate}
      />
    </>
  )

  if (embedded) {
    return <div className="space-y-4 pt-1">{content}</div>
  }

  return <PageContainer>{content}</PageContainer>
}
