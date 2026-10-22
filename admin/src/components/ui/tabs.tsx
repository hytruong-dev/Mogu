import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  createContext,
  useContext,
  useState,
} from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (v: string) => void
}
const TabsContext = createContext<TabsContextValue>({ value: '', onValueChange: () => {} })

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
}

export function Tabs({ defaultValue, value: controlledValue, onValueChange, children, className, ...props }: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const value = controlledValue ?? uncontrolled
  const handleChange = (v: string) => {
    setUncontrolled(v)
    onValueChange?.(v)
  }
  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange }}>
      <div className={cn('', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-9 max-w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const ctx = useContext(TabsContext)
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:opacity-50',
        active
          ? 'bg-card text-foreground shadow-xs ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
          : 'hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const ctx = useContext(TabsContext)
  if (ctx.value !== value) return null
  return (
    <div
      className={cn('mt-2 focus-visible:outline-none', className)}
      {...props}
    />
  )
}
