import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { useReviewQueue } from '../../hooks/useReviewQueue'
import { useFoodScanReportSummary } from '../../hooks/useFoodScanReports'
import { navGroups } from './nav-config'

export function Sidebar({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { data: queueData } = useReviewQueue()
  const queueCount = queueData?.total ?? queueData?.data?.length ?? 0
  const { data: scanSummary } = useFoodScanReportSummary()
  const scanMissingCount = scanSummary?.new ?? 0

  return (
    <aside className="modern-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-container">
        <div className="sidebar-brand-logo">
          <div className="brand-icon-wrapper">
            <Sparkles size={18} className="text-zinc-950 fill-zinc-950" />
          </div>
          <div className="brand-text-block">
            <div className="brand-title-row">
              <span className="brand-title">NOAN</span>
              <span className="brand-badge">PRO</span>
            </div>
            <span className="brand-subtitle">Studio Console</span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav-scroll">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || hasRole(...item.roles))
          if (visibleItems.length === 0) return null

          return (
            <div key={group.title} className="sidebar-group">
              <span className="sidebar-group-title">{group.title}</span>
              <div className="sidebar-group-items">
                {visibleItems.map(({ path, label, icon: Icon, badge }) => {
                  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path))
                  const itemBadge =
                    path === '/review'
                      ? (queueCount > 0 ? String(queueCount) : undefined)
                      : path === '/food-scan-reports'
                        ? (scanMissingCount > 0 ? String(scanMissingCount) : undefined)
                        : badge

                  return (
                    <button
                      key={path}
                      type="button"
                      className={`sidebar-nav-button ${isActive ? 'is-active' : ''}`}
                      onClick={() => navigate(path)}
                    >
                      <Icon size={17} strokeWidth={isActive ? 2.1 : 1.8} />
                      <span className="nav-label">{label}</span>
                      {itemBadge && (
                        <span className="nav-badge-pill">{itemBadge}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer-container">
        <div className="system-status-indicator">
          <span className="status-pulse-dot" />
          <div className="system-status-text">
            <span>Hệ thống ổn định</span>
            <small>v1.2.0 • Mogu Cloud</small>
          </div>
        </div>

        <div className="sidebar-cmd-hint">
          <span>Tìm kiếm nhanh</span>
          <kbd>⌘K</kbd>
        </div>
      </div>
    </aside>
  )
}
