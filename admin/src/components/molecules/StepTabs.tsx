import { CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepTab {
  n: number
  label: string
  active?: boolean
  done?: boolean
  onClick?: () => void
}

/**
 * Thanh 6 bước theo design Mogu:
 * - done: icon CircleCheck xanh
 * - active: nền vàng Mogu, badge trắng
 * - pending: nền trắng, số trong vòng tròn
 */
export function StepTabs({ steps }: { steps: StepTab[] }) {
  return (
    <div className="grid grid-cols-6 gap-4">
      {steps.map(({ n, label, active, done, onClick }) => (
        <button
          key={n}
          type="button"
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-2xl border px-5 py-3 text-[15px] transition',
            active
              ? 'border-mogu-yellow bg-mogu-yellow font-semibold text-black shadow-sm'
              : 'border-black/10 bg-white text-gray-800 hover:border-mogu-yellow/60',
          )}
        >
          {done && !active ? (
            <CircleCheck className="h-6 w-6 shrink-0 text-ok-green" strokeWidth={1.8} />
          ) : (
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                active ? 'border-black/40 bg-white' : 'border-black/15 text-gray-500',
              )}
            >
              {n}
            </span>
          )}
          {label}
        </button>
      ))}
    </div>
  )
}
