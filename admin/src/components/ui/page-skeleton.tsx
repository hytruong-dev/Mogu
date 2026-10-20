import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'

/** Full-page / section skeleton — không dùng spinner khi chờ API. */
export function PageSkeleton({
  className,
  rows = 6,
  withAvatar = false,
}: {
  className?: string
  rows?: number
  withAvatar?: boolean
}) {
  return (
    <div className={cn('w-full space-y-3 p-6', className)}>
      {withAvatar && (
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-4 w-2/5" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({
  rows = 6,
  cols = 6,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={cn('w-full overflow-hidden rounded-xl border border-border bg-card shadow-xs', className)}>
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="h-11 px-4 text-left align-middle">
                  <Skeleton className={cn('h-3.5', i === 0 ? 'w-12' : i === 1 ? 'w-32' : 'w-20')} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-b border-border last:border-0 hover:bg-muted/40">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="p-3.5 align-middle">
                    {c === 0 ? (
                      <Skeleton className="h-4 w-4 rounded" />
                    ) : c === 1 ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ) : c === cols - 1 ? (
                      <div className="flex items-center gap-1.5 justify-end">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                    ) : (
                      <Skeleton className="h-4 w-20" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Pixel-perfect Skeleton for FoodsTable (`/foods`) */
export function FoodsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="h-11 px-3 w-10 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></th>
              <th className="h-11 px-3 w-14 text-center"><Skeleton className="h-3.5 w-8 mx-auto" /></th>
              <th className="h-11 px-4 text-left"><Skeleton className="h-3.5 w-24" /></th>
              <th className="h-11 px-4 text-left"><Skeleton className="h-3.5 w-28" /></th>
              <th className="h-11 px-4 text-left"><Skeleton className="h-3.5 w-24" /></th>
              <th className="h-11 px-3 text-left"><Skeleton className="h-3.5 w-16" /></th>
              <th className="h-11 px-3 text-left"><Skeleton className="h-3.5 w-20" /></th>
              <th className="h-11 px-3 text-left"><Skeleton className="h-3.5 w-16" /></th>
              <th className="h-11 px-4 text-right"><Skeleton className="h-3.5 w-14 ml-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-3 w-10 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
                <td className="px-3 py-3 w-14"><Skeleton className="h-13 w-13 rounded-xl mx-auto shrink-0" /></td>
                <td className="px-4 py-3 min-w-[200px]">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Skeleton className="h-3.5 w-3.5 rounded-full" />
                    <Skeleton className="h-3.5 w-8" />
                  </div>
                </td>
                <td className="px-3 py-3"><Skeleton className="h-6 w-20 rounded-full" /></td>
                <td className="px-3 py-3"><Skeleton className="h-3.5 w-16" /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20">
        <Skeleton className="h-3.5 w-44" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Pixel-perfect Skeleton for IngredientsTable (`/food-data`) */
export function IngredientsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="h-11 px-3 w-10 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></th>
              <th className="h-11 px-4 text-left"><Skeleton className="h-3.5 w-28" /></th>
              <th className="h-11 px-3 text-left"><Skeleton className="h-3.5 w-16" /></th>
              <th className="h-11 px-3 text-left"><Skeleton className="h-3.5 w-14" /></th>
              <th className="h-11 px-3 text-left"><Skeleton className="h-3.5 w-16" /></th>
              <th className="h-11 px-4 text-left"><Skeleton className="h-3.5 w-24" /></th>
              <th className="h-11 px-3 text-center"><Skeleton className="h-3.5 w-16 mx-auto" /></th>
              <th className="h-11 px-4 text-right"><Skeleton className="h-3.5 w-14 ml-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-3 py-3 w-10 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><Skeleton className="h-3.5 w-14 font-mono" /></td>
                <td className="px-3 py-3"><Skeleton className="h-5 w-10 rounded" /></td>
                <td className="px-3 py-3"><Skeleton className="h-3.5 w-14" /></td>
                <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                <td className="px-3 py-3 text-center"><Skeleton className="h-5 w-9 rounded-full mx-auto" /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/20">
        <Skeleton className="h-3.5 w-48" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Pixel-perfect Skeleton for CreateDishPage (`/foods/:id`) */
export function DishFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* 6 Steps Bar Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-2xs">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <Skeleton className="h-3.5 w-16 flex-1" />
          </div>
        ))}
      </div>

      {/* 2-Column Content Layout: Left Form + Right App Preview */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_420px]">
        {/* Left Form Box */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-60" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Box */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-16" />
            </div>
            {/* Live Card Preview */}
            <Skeleton className="aspect-video w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>

          {/* Checklist Progress */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Detail Dialog Skeleton for DishDetailDialog */
export function DishDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="p-6 space-y-6">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-2.5 p-3 rounded-xl border border-border bg-muted/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5 text-center">
              <Skeleton className="h-3 w-12 mx-auto" />
              <Skeleton className="h-5 w-16 mx-auto" />
            </div>
          ))}
        </div>
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        {/* Ingredients Grid */}
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {/* Steps */}
        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}
