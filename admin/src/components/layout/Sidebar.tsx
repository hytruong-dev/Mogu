import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { useReviewQueue } from '../../hooks/useReviewQueue'
import { useFoodScanReportSummary } from '../../hooks/useFoodScanReports'
import { cn } from '../../lib/utils'
import { isNavItemActive, navGroups } from './nav-config'
import { useShell } from './shell-context'

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/dashboard"
      className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <img
        src="/noan-mark.png"
        alt="NOAN"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-[9px] shadow-xs ring-1 ring-black/5"
      />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-foreground">NOAN Studio</div>
          <div className="text-[11px] font-medium text-muted-foreground">Quản trị nội dung</div>
        </div>
      )}
    </Link>
  )
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const { hasRole } = useAuth()
  const { data: queueData } = useReviewQueue()
  const { data: scanSummary } = useFoodScanReportSummary()
  const { pathname } = useLocation()

  const counters: Record<string, number> = {
    review: queueData?.total ?? queueData?.data?.length ?? 0,
    scan: scanSummary?.new ?? 0,
  }

  return (
    <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3', collapsed ? 'px-2' : 'px-3')}>
      {navGroups.map((group) => {
        const items = group.items.filter((item) => !item.roles || hasRole(...item.roles))
        if (items.length === 0) return null

        return (
          <div key={group.title} className="mb-4 last:mb-0">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border first:hidden" />
            ) : (
              <div className="mb-1 px-2.5 text-[11px] font-semibold text-muted-foreground/80">
                {group.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon
                const active = isNavItemActive(pathname, item.path)
                const count = item.counter ? counters[item.counter] : 0

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      data-active={active}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn('nav-item group', collapsed && 'justify-center px-0')}
                    >
                      <Icon
                        size={18}
                        strokeWidth={active ? 2.2 : 1.9}
                        className={cn(
                          'shrink-0 transition-colors',
                          active
                            ? 'text-brand-600 dark:text-brand-400'
                            : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                        )}
                      />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {count > 0 &&
                        (collapsed ? (
                          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-[hsl(var(--sidebar))]" />
                        ) : (
                          <span
                            className={cn(
                              'ml-auto min-w-[20px] shrink-0 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums',
                              active
                                ? 'bg-brand-500 text-white'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                            )}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        ))}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useShell()

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-border bg-[hsl(var(--sidebar))] transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-[248px]'
        )}
      >
        <div className={cn('flex h-[var(--header-h)] items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-4')}>
          <Brand collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className={cn('border-t border-border p-2', !collapsed && 'px-3')}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn('nav-item', collapsed && 'justify-center px-0')}
            title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            {collapsed ? <ChevronsRight size={18} className="text-slate-400" /> : <ChevronsLeft size={18} className="text-slate-400" />}
            {!collapsed && <span>Thu gọn</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile / tablet drawer ── */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-[hsl(var(--sidebar))] shadow-pop transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Điều hướng"
        >
          <div className="flex h-[var(--header-h)] items-center justify-between border-b border-border px-4">
            <Brand collapsed={false} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          </div>
          <SidebarNav collapsed={false} />
        </aside>
      </div>
    </>
  )
}
