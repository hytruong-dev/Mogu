import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  createContext,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Context ──────────────────────────────────────────────────────────────────

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
})

// ── Root ─────────────────────────────────────────────────────────────────────

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open = false, onOpenChange = () => {}, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

// ── Trigger ──────────────────────────────────────────────────────────────────

export function DialogTrigger({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useContext(DialogContext)
  return (
    <button className={cn('', className)} onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  )
}

// ── Portal / Overlay / Content ────────────────────────────────────────────────

export function DialogContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { open, onOpenChange } = useContext(DialogContext)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) document.body.classList.add('overflow-hidden')
    else document.body.classList.remove('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onOpenChange])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px] animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl bg-card text-card-foreground shadow-2xl border border-border',
          'animate-fade-in',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Đóng cửa sổ"
        >
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  )
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-5 pb-3 pr-14 sm:p-6 sm:pb-4 sm:pr-14', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 p-5 pt-3 sm:flex-row sm:justify-end sm:p-6 sm:pt-4', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-base font-semibold leading-snug tracking-tight sm:text-lg', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function DialogOverlay({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { onOpenChange } = useContext(DialogContext)
  return (
    <div
      className={cn(
        'fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200',
        className
      )}
      onClick={() => onOpenChange(false)}
      {...props}
    />
  )
}

// ── Close button ─────────────────────────────────────────────────────────────

export function DialogClose({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useContext(DialogContext)
  return (
    <button
      className={cn('', className)}
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </button>
  )
}
