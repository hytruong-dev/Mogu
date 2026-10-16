import type { ReactNode } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '../../ui/checkbox'
import { Switch } from '../../ui/switch'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'

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
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(!!c)}
        className="mt-0.5 data-[state=checked]:bg-mogu-yellow data-[state=checked]:text-black data-[state=checked]:border-mogu-yellow"
      />
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
  const variant = {
    green: 'success' as const,
    orange: 'warning' as const,
    gray: 'neutral' as const,
    red: 'destructive' as const,
    blue: 'info' as const,
    purple: 'purple' as const,
  }[tone]
  return (
    <Badge variant={variant} className="gap-1 px-2 py-0.5 text-[11px] font-semibold">
      {children}
    </Badge>
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
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-10 px-4 text-sm font-semibold text-black bg-white hover:bg-black/[0.03]',
        className,
      )}
    >
      {children}
    </Button>
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
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-10 bg-mogu-yellow px-5 text-sm font-bold text-black hover:bg-mogu-yellow-dark shadow-none',
        className,
      )}
    >
      {children}
    </Button>
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
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-mogu-yellow"
      />
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
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#22C55E]"
      />
      {label && <span className="text-sm font-medium text-black">{label}</span>}
    </label>
  )
}

