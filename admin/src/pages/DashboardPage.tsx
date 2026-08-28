import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  Plus,
  Sparkles,
  Utensils,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { useAdminDishes } from '../hooks/useDishes'
import { useReviewQueue } from '../hooks/useReviewQueue'
import { useImportJobs } from '../hooks/useImportJobs'
import type { Dish, ImportJob } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  value,
  label,
  tone = 'yellow',
  note,
}: {
  icon: typeof BookOpen
  value: string | number
  label: string
  tone?: string
  note?: string
}) {
  return (
    <Card className="stat-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={27} />
      </div>
      <div>
        <b>{value}</b>
        <p>{label}</p>
        {note && <small className="note">{note}</small>}
      </div>
    </Card>
  )
}

// ─── Sub-widgets ──────────────────────────────────────────────────────────────

function Pipeline({ jobs }: { jobs: ImportJob[] }) {
  const active = jobs.filter((j) =>
    ['PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING', 'RECONCILING', 'ENRICHING'].includes(j.status),
  )

  return (
    <Card className="compact-card">
      <h3>Pipeline đang chạy</h3>
      {active.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>Không có job nào đang chạy</p>
      )}
      {active.slice(0, 5).map((job) => {
        const pct = job.progress ?? 0
        const colorClass = pct >= 70 ? 'green' : pct >= 40 ? 'orange' : 'red'
        return (
          <div className="pipeline-row" key={job.id}>
            <span>
              <b>{job.query}</b>
              <small>{job.status}</small>
              <i>
                <em className={colorClass} style={{ width: `${pct}%` }} />
              </i>
            </span>
            <strong className={colorClass}>{pct}%</strong>
          </div>
        )
      })}
      <footer>
        Xem tất cả pipeline <ChevronRight size={17} />
      </footer>
    </Card>
  )
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
function getMediaUrl(media: { publicUrl?: string; storageKey?: string; bucket?: string } | undefined): string | null {
  if (!media) return null
  if (media.publicUrl) return media.publicUrl
  if (media.storageKey && media.bucket) return `${SUPABASE_URL}/storage/v1/object/public/${media.bucket}/${media.storageKey}`
  return null
}

function PopularFoods({ dishes }: { dishes: Dish[] }) {
  const published = dishes.filter((d) => d.status === 'PUBLISHED').slice(0, 5)
  return (
    <Card className="compact-card">
      <h3>Món được chọn nhiều hôm nay</h3>
      {published.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>Chưa có dữ liệu</p>
      )}
      {published.map((dish, i) => {
        const primaryMedia = dish.media?.find((m: any) => m.isPrimary) ?? dish.media?.[0]
        const imgUrl = getMediaUrl(primaryMedia)
        return (
          <div className="popular-row" key={dish.id}>
            <i>{i + 1}</i>
            {imgUrl ? (
              <img src={imgUrl} alt={dish.name} />
            ) : (
              <div style={{ width: 36, height: 36, background: 'var(--bg-muted)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Utensils size={14} />
              </div>
            )}
            <b>{dish.name}</b>
            <strong>
              {(dish.viewCount ?? 0).toLocaleString()}
              <small>lượt xem</small>
            </strong>
          </div>
        )
      })}
      <footer>
        Xem tất cả <ChevronRight size={17} />
      </footer>
    </Card>
  )
}

function Activity({ jobs }: { jobs: ImportJob[] }) {
  const recent = [...jobs]
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    .slice(0, 5)

  return (
    <Card className="compact-card">
      <h3>Hoạt động gần đây</h3>
      {recent.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>Chưa có hoạt động</p>
      )}
      {recent.map((job) => {
        const isDone = job.status === 'DONE'
        const isFail = job.status === 'FAILED'
        return (
          <div className="activity-row" key={job.id}>
            <i className={isDone ? 'green' : isFail ? 'red' : 'orange'}>
              <Check size={14} />
            </i>
            <span>
              <b>Job "{job.query}" — {job.status}</b>
              <small>
                {(job.sourceTypes ?? []).join(', ')} · {job.progress ?? 0}%
              </small>
            </span>
            <time>
              {new Date(job.updatedAt ?? job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        )
      })}
      <footer>
        Xem tất cả hoạt động <ChevronRight size={17} />
      </footer>
    </Card>
  )
}

function Tasks({
  pendingReview,
  needsCheck,
}: {
  pendingReview: number
  needsCheck: number
}) {
  const tasks = [
    { count: pendingReview, title: 'Món ưu tiên kiểm duyệt', sub: 'Cần xử lý sớm', color: 'orange' },
    { count: needsCheck, title: 'Món cần kiểm tra lại', sub: 'Độ tin cậy thấp', color: 'yellow' },
  ]
  return (
    <Card className="tasks">
      <h3>Công việc cần xử lý</h3>
      {tasks.map((t) => (
        <button className="task-row" key={t.title}>
          <i className={`task-ring ${t.color}`}>{t.count}</i>
          <span>
            <b>{t.title}</b>
            <small>{t.sub}</small>
          </span>
          <ChevronRight />
        </button>
      ))}
    </Card>
  )
}

// ─── Static chart (giữ nguyên visual) ────────────────────────────────────────

function LineChart() {
  return (
    <Card className="chart-card">
      <h3>Hoạt động dữ liệu 7 ngày</h3>
      <div className="legend">
        <i className="yellow-dot" /> Món mới <i className="green-dot" /> Đã xuất bản
      </div>
      <svg viewBox="0 0 620 180" aria-label="Biểu đồ hoạt động 7 ngày">
        <g className="grid-lines">
          {[25, 65, 105, 145].map((y) => (
            <line key={y} x1="30" y1={y} x2="600" y2={y} />
          ))}
        </g>
        <polyline className="line yellow-line" points="35,128 125,92 210,50 300,76 390,51 480,69 575,51" />
        <polyline className="line green-line" points="35,145 125,126 210,104 300,106 390,91 480,78 575,61" />
        {[[35, 128], [125, 92], [210, 50], [300, 76], [390, 51], [480, 69], [575, 51]].map(([cx, cy]) => (
          <circle key={`${cx}`} className="yellow-point" cx={cx} cy={cy} r="4" />
        ))}
        {[[35, 145], [125, 126], [210, 104], [300, 106], [390, 91], [480, 78], [575, 61]].map(([cx, cy]) => (
          <circle key={`${cx}`} className="green-point" cx={cx} cy={cy} r="4" />
        ))}
      </svg>
      <div className="chart-dates">
        {['06/08', '07/08', '08/08', '09/08', '10/08', '11/08', '12/08'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: dishesData, isLoading: dishesLoading } = useAdminDishes({ limit: 50 })
  const { data: reviewData, isLoading: reviewLoading } = useReviewQueue({ limit: 50 })
  const { data: jobsData, isLoading: jobsLoading } = useImportJobs({ limit: 50 })

  const dishes = dishesData?.data ?? []
  const reviewItems = reviewData?.data ?? []
  const jobs = jobsData?.data ?? []

  const totalDishes = dishesData?.total ?? 0
  const publishedCount = dishes.filter((d) => d.status === 'PUBLISHED').length
  const pendingReview = reviewData?.total ?? reviewItems.length
  const activeJobs = jobs.filter((j) =>
    ['PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING', 'RECONCILING', 'ENRICHING'].includes(j.status),
  ).length

  const loading = dishesLoading || reviewLoading || jobsLoading

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Tổng quan</h1>
          <p>
            Chào buổi sáng, Admin Mogu 👋
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline">
            <Clock3 size={18} />
            {new Date().toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Button>
          <Button>
            <Plus size={19} /> Tạo job nhập món
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Stat
          icon={BookOpen}
          value={loading ? '...' : publishedCount.toLocaleString()}
          label="Món đã xuất bản"
          tone="green"
          note={loading ? '' : `Trên ${totalDishes} tổng số món`}
        />
        <Stat
          icon={Clock3}
          value={loading ? '...' : pendingReview}
          label="Chờ kiểm duyệt"
          tone="orange"
          note="Cần xử lý sớm"
        />
        <Stat
          icon={Zap}
          value={loading ? '...' : activeJobs}
          label="Đang xử lý"
          tone="blue"
        />
        <Stat
          icon={AlertTriangle}
          value={loading ? '...' : dishes.filter((d) => d.status === 'FAILED').length}
          label="Thất bại"
          tone="red"
          note="Cần kiểm tra"
        />
      </div>

      {/* Middle row */}
      <div className="dashboard-mid">
        <LineChart />
        <Tasks
          pendingReview={pendingReview}
          needsCheck={dishes.filter((d) => (d.confidenceScore ?? 100) < 70).length}
        />
      </div>

      {/* Triple grid */}
      <div className="triple-grid">
        <Pipeline jobs={jobs} />
        <PopularFoods dishes={dishes} />
        <Activity jobs={jobs} />
      </div>

      {/* Tip */}
      <Card className="operation-tip">
        <div className="metric-icon yellow">
          <Sparkles />
        </div>
        <div>
          <b>Gợi ý vận hành</b>
          <p>
            Dựa trên dữ liệu hôm nay, có {pendingReview} món đang chờ kiểm duyệt. Ưu tiên duyệt những món có độ tin cậy cao.
          </p>
        </div>
        <span />
        <FileCheck2 />
        <b>Ưu tiên kiểm duyệt {pendingReview} món đang chờ</b>
        <Button size="sm">
          Xem chi tiết <ChevronRight size={17} />
        </Button>
      </Card>
    </>
  )
}
