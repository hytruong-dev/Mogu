import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  createContext,
  useContext,
  useEffect,
  useRef,
} from 'react'
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-xl bg-card shadow-xl border border-border',
          'animate-fade-in',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
        {...props}
      >
        {children}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-4', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
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
