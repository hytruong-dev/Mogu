import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Composable Select Context ────────────────────────────────────────────────

interface SelectContextValue {
  value?: string
  onValueChange?: (val: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  labelMap: Map<string, React.ReactNode>
  registerItem: (val: string, label: React.ReactNode) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

// ── Select Root ──────────────────────────────────────────────────────────────

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'defaultValue'> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
  onChange,
  disabled,
  ...nativeProps
}: SelectProps) {
  const isDirectNative = onChange !== undefined && onValueChange === undefined

  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? '')
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const labelMapRef = React.useRef(new Map<string, React.ReactNode>())
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen

  const handleValueChange = (val: string) => {
    if (controlledValue === undefined) setUncontrolledValue(val)
    onValueChange?.(val)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  const registerItem = React.useCallback((val: string, label: React.ReactNode) => {
    if (!labelMapRef.current.has(val)) {
      labelMapRef.current.set(val, label)
      forceUpdate()
    }
  }, [])

  if (isDirectNative) {
    return (
      <div className="relative w-full">
        <select
          value={controlledValue}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...nativeProps}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    )
  }

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen: handleOpenChange,
        labelMap: labelMapRef.current,
        registerItem,
        triggerRef,
      }}
    >
      <div className={cn('relative inline-block w-full', className)}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

// ── Select Trigger ───────────────────────────────────────────────────────────

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, disabled, ...props }, ref) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const combinedRef = (node: HTMLButtonElement | null) => {
    ctx.triggerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
  }

  return (
    <button
      ref={combinedRef}
      type="button"
      role="combobox"
      aria-expanded={ctx.open}
      disabled={disabled}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors',
        'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-150" />
    </button>
  )
})
SelectTrigger.displayName = 'SelectTrigger'

// ── Select Value ─────────────────────────────────────────────────────────────

export function SelectValue({
  placeholder,
  className,
}: {
  placeholder?: string
  className?: string
}) {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const displayed = ctx.value ? ctx.labelMap.get(ctx.value) ?? ctx.value : null

  return (
    <span className={cn('truncate', !displayed && 'text-muted-foreground', className)}>
      {displayed || placeholder || ''}
    </span>
  )
}

// ── Select Content ───────────────────────────────────────────────────────────

export function SelectContent({
  className,
  children,
  position: _position = 'popper',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { position?: 'popper' | 'item-aligned' }) {
  const ctx = React.useContext(SelectContext)
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!ctx?.open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        ctx.triggerRef.current &&
        !ctx.triggerRef.current.contains(target)
      ) {
        ctx.setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ctx.setOpen(false)
        ctx.triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ctx])

  if (!ctx || !ctx.open) return null

  return (
    <div
      ref={contentRef}
      role="listbox"
      className={cn(
        'absolute left-0 top-[calc(100%+4px)] z-50 max-h-60 w-full min-w-[8rem] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ── Select Item ──────────────────────────────────────────────────────────────

export function SelectItem({
  value,
  children,
  disabled = false,
  className,
  ...props
}: {
  value: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  const ctx = React.useContext(SelectContext)

  // In native option mode:
  if (!ctx) {
    return (
      <option value={value} disabled={disabled} {...props}>
        {children}
      </option>
    )
  }

  // In composable mode:
  ctx.registerItem(value, children)
  const isSelected = ctx.value === value

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return
        ctx.onValueChange?.(value)
        ctx.setOpen(false)
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors duration-100',
        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        isSelected && 'font-medium bg-accent/50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      <span className="truncate">{children}</span>
    </div>
  )
}

// ── Select Helpers ───────────────────────────────────────────────────────────

export function SelectGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-1', className)} {...props} />
}

export function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('py-1.5 pl-8 pr-2 text-xs font-semibold text-muted-foreground', className)} {...props} />
}

export function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}
