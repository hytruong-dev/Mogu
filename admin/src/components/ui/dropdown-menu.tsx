import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
})

export function DropdownMenu({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, onClick, asChild, ...props }, ref) => {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext)

  const combinedRef = (node: HTMLButtonElement | null) => {
    triggerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onClick?.(e)
    setOpen(!open)
  }

  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as Record<string, any>
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: combinedRef,
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      className: cn(childProps.className, className),
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        childProps.onClick?.(e)
        handleClick(e)
      },
      ...props,
    })
  }

  return (
    <button
      ref={combinedRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

export function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export function DropdownMenuContent({
  align = 'end',
  sideOffset = 4,
  className,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = React.useState<{
    top: number
    left?: number
    right?: number
    transform?: string
  } | null>(null)

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let top = rect.bottom + sideOffset
    let transform: string | undefined = undefined

    // Measure height if rendered, flip upwards if overflowing bottom of viewport
    if (contentRef.current) {
      const menuHeight = contentRef.current.offsetHeight
      if (top + menuHeight > viewportHeight - 8 && rect.top - menuHeight - sideOffset > 8) {
        top = rect.top - menuHeight - sideOffset
      }
    }

    let left: number | undefined = undefined
    let right: number | undefined = undefined

    if (align === 'start') {
      left = Math.max(8, Math.min(rect.left, viewportWidth - 8))
    } else if (align === 'center') {
      left = rect.left + rect.width / 2
      transform = 'translateX(-50%)'
    } else {
      // align === 'end'
      right = Math.max(8, Math.min(viewportWidth - rect.right, viewportWidth - 8))
    }

    setCoords({ top, left, right, transform })
  }, [align, sideOffset, triggerRef])

  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  React.useEffect(() => {
    if (!open) return

    const handleScrollOrResize = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      // If trigger is scrolled out of viewport, close menu
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false)
        return
      }
      updatePosition()
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, setOpen, triggerRef, updatePosition])

  if (!open || typeof document === 'undefined') return null

  const initialTop = (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + sideOffset
  const initialRight =
    align === 'end'
      ? Math.max(8, window.innerWidth - (triggerRef.current?.getBoundingClientRect().right ?? 0))
      : undefined
  const initialLeft =
    align === 'start'
      ? Math.max(8, triggerRef.current?.getBoundingClientRect().left ?? 0)
      : align === 'center'
        ? (triggerRef.current?.getBoundingClientRect().left ?? 0) +
          (triggerRef.current?.getBoundingClientRect().width ?? 0) / 2
        : undefined

  const finalStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords ? coords.top : initialTop,
    left: coords?.left ?? initialLeft,
    right: coords?.right ?? initialRight,
    transform: coords?.transform ?? (align === 'center' ? 'translateX(-50%)' : undefined),
    zIndex: 9999,
    ...style,
  }

  return createPortal(
    <div
      ref={contentRef}
      role="menu"
      style={finalStyle}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
  )
}

export function DropdownMenuItem({
  className,
  children,
  disabled,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const { setOpen } = React.useContext(DropdownMenuContext)

  return (
    <div
      role="menuitem"
      aria-disabled={disabled}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none transition-colors duration-100',
        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      onClick={(e) => {
        if (disabled) return
        onClick?.(e)
        setOpen(false)
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-2.5 py-1.5 text-xs font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

export function DropdownMenuGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-0.5', className)} {...props} />
}

export function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
      {...props}
    />
  )
}
