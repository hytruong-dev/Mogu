import { useNavigate } from 'react-router-dom'
import { Sparkles, Activity, Command } from 'lucide-react'
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
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col h-screen sticky top-0 shrink-0 select-none z-40 transition-colors">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-sm shadow-amber-500/20 text-white shrink-0">
            <Sparkles size={18} className="fill-white/20" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">NOAN</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                STUDIO
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 -mt-0.5">Admin Management</span>
          </div>
        </div>
      </div>

      {/* Navigation Scroll */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || hasRole(...item.roles))
          if (visibleItems.length === 0) return null

          return (
            <div key={group.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {group.title}
              </div>
              <div className="space-y-0.5 pt-1">
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
                      onClick={() => navigate(path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-400/10 font-semibold ring-1 ring-amber-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon
                        size={16}
                        className={`transition-colors shrink-0 ${
                          isActive
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                        }`}
                      />
                      <span className="truncate flex-1 text-left">{label}</span>
                      {itemBadge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                            isActive
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {itemBadge}
                        </span>
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
      <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Hệ thống ổn định</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Mogu Cloud • v1.3</span>
            </div>
          </div>
          <Activity size={14} className="text-slate-400 dark:text-slate-500" />
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span>Tìm kiếm nhanh</span>
          <kbd className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            <Command size={10} /> K
          </kbd>
        </div>
      </div>
    </aside>
  )
}
