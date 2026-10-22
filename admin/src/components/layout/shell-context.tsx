import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface ShellContextValue {
  /** Desktop: sidebar shows icons only */
  collapsed: boolean
  toggleCollapsed: () => void
  /** Mobile/tablet: off-canvas drawer is open */
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean | ((prev: boolean) => boolean)) => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

const COLLAPSE_KEY = 'noan_sidebar_collapsed'

export function ShellProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1')
      return !prev
    })
  }, [])

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Global Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <ShellContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen, commandOpen, setCommandOpen }}
    >
      {children}
    </ShellContext.Provider>
  )
}

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used inside <ShellProvider>')
  return ctx
}
