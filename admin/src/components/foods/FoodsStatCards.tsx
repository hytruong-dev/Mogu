import { Utensils, CheckCircle2, Clock3, FileText, Archive } from 'lucide-react'
import { Card } from '../ui/card'
import type { DishStatus } from '../../types'

interface FoodsStatCardsProps {
  stats: {
    total: number
    published: number
    pending: number
    draft: number
    archived: number
  }
  activeStatus: DishStatus | 'ALL'
  onSelectStatus: (status: DishStatus | 'ALL') => void
}

export function FoodsStatCards({
  stats,
  activeStatus,
  onSelectStatus,
}: FoodsStatCardsProps) {
  const cards = [
    {
      id: 'ALL' as const,
      label: 'Tổng số món',
      value: stats.total,
      icon: Utensils,
      tone: 'yellow',
      active: activeStatus === 'ALL',
    },
    {
      id: 'PUBLISHED' as const,
      label: 'Đã xuất bản',
      value: stats.published,
      icon: CheckCircle2,
      tone: 'green',
      active: activeStatus === 'PUBLISHED',
    },
    {
      id: 'PENDING_REVIEW' as const,
      label: 'Chờ duyệt',
      value: stats.pending,
      icon: Clock3,
      tone: 'orange',
      active: activeStatus === 'PENDING_REVIEW',
    },
    {
      id: 'DRAFT' as const,
      label: 'Bản nháp',
      value: stats.draft,
      icon: FileText,
      tone: 'slate',
      active: activeStatus === 'DRAFT',
    },
    {
      id: 'ARCHIVED' as const,
      label: 'Đã lưu trữ',
      value: stats.archived,
      icon: Archive,
      tone: 'purple',
      active: activeStatus === 'ARCHIVED',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card
            key={card.id}
            onClick={() => onSelectStatus(card.id)}
            className={`p-4 cursor-pointer transition-all border rounded-xl hover:shadow-md ${
              card.active
                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-400/30 shadow-sm'
                : 'border-border bg-card hover:border-amber-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  card.active
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {card.value.toLocaleString('vi-VN')}
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
