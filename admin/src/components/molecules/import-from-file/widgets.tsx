import type { ReactNode } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const WIZARD_STEPS = [
  { n: 1, key: 'upload', label: 'Tải file' },
  { n: 2, key: 'mapping', label: 'Ánh xạ cột' },
  { n: 3, key: 'validate', label: 'Kiểm tra dữ liệu' },
  { n: 4, key: 'confirm', label: 'Nhập dữ liệu' },
] as const

export function ExcelMark({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg shadow-sm"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(180deg, #33C481 0%, #1F9A57 100%)',
      }}
    >
      <span className="font-extrabold leading-none text-white" style={{ fontSize: size * 0.44 }}>
        X
      </span>
    </div>
  )
}

export function ImportStepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-0">
      {WIZARD_STEPS.map((step, i) => {
        const done = step.n < current
        const active = step.n === current
        return (
          <div key={step.n} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold',
                  active && 'bg-mogu-yellow text-black',
                  done && 'bg-[#22C55E] text-white',
                  !active && !done && 'bg-[#E5E7EB] text-[#9CA3AF]',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step.n}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[13px]',
                  active ? 'font-semibold text-black' : done ? 'font-medium text-[#166534]' : 'text-[#9CA3AF]',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={cn('mx-3 h-px w-10 sm:w-14', done ? 'bg-[#22C55E]' : 'bg-[#E5E7EB]')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function YellowCheck({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition',
          checked ? 'border-mogu-yellow bg-mogu-yellow' : 'border-black/25 bg-white',
        )}
      >
        {checked && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
      </button>
      <span>
        <span className="text-sm font-medium text-black">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[#6B7280]">{hint}</span>}
      </span>
    </label>
  )
}

export function YellowRadio({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean
  onChange: () => void
  title: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
          checked ? 'border-mogu-yellow' : 'border-black/25',
        )}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-mogu-yellow" />}
      </button>
      <span>
        <span className="text-sm font-medium text-black">{title}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-[#6B7280]">{hint}</span>}
      </span>
    </label>
  )
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'green' | 'orange' | 'gray' | 'red' | 'blue' | 'purple'
  children: ReactNode
}) {
  const cls = {
    green: 'bg-[#ECFDF3] text-[#166534]',
    orange: 'bg-[#FFF7ED] text-[#C2410C]',
    gray: 'bg-[#F3F4F6] text-[#6B7280]',
    red: 'bg-[#FEF2F2] text-[#B91C1C]',
    blue: 'bg-[#EFF6FF] text-[#1D4ED8]',
    purple: 'bg-[#F5F3FF] text-[#6D28D9]',
  }[tone]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>
      {children}
    </span>
  )
}

export function MapStatusBadge({ status }: { status: 'mapped' | 'check' | 'skip' }) {
  if (status === 'mapped') {
    return (
      <StatusPill tone="green">
        <CheckCircle2 className="h-3 w-3" /> Đã ánh xạ
      </StatusPill>
    )
  }
  if (status === 'check') {
    return <StatusPill tone="orange">Cần kiểm tra</StatusPill>
  }
  return <StatusPill tone="gray">Bỏ qua</StatusPill>
}

export function GhostBtn({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 text-sm font-semibold text-black transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-mogu-yellow px-5 text-sm font-bold text-black transition hover:bg-mogu-yellow-dark disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function YellowSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-mogu-yellow' : 'bg-[#D1D5DB]',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-black">{label}</span>}
    </label>
  )
}

export function GreenSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-[#22C55E]' : 'bg-[#D1D5DB]',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-black">{label}</span>}
    </label>
  )
}

