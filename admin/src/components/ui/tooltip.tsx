import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
})

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function Tooltip({ children, delayDuration = 150 }: { children: React.ReactNode; delayDuration?: number }) {
  const [open, setOpen] = React.useState(false)
  const timerRef = React.useRef<number | null>(null)

  const handleOpen = () => {
    timerRef.current = window.setTimeout(() => setOpen(true), delayDuration)
  }

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
  }

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div
        className="relative inline-flex"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  )
}

export function TooltipTrigger({ asChild, children, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  return (
    <div className={cn('inline-flex items-center cursor-help', className)} {...props}>
      {children}
    </div>
  )
}

export function TooltipContent({
  className,
  side = 'top',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const { open } = React.useContext(TooltipContext)
  if (!open) return null

  const sideStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      role="tooltip"
      className={cn(
        'absolute z-50 overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none whitespace-nowrap',
        sideStyles[side],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
