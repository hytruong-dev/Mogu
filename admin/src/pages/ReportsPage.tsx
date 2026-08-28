// TODO: connect API — chưa có backend analytics endpoint
import { Archive, CheckCircle2, Clock3, FileText, Leaf, Sparkles, Zap } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

function Stat({ icon: Icon, value, label, tone = 'yellow', note }: { icon: typeof Sparkles; value: string; label: string; tone?: string; note?: string }) {
  return <Card className="stat-card"><div className={`metric-icon ${tone}`}><Icon size={27} /></div><div><b>{value}</b><p>{label}</p>{note && <small className="note">{note}</small>}</div></Card>
}

function LineChart() {
  return (
    <Card className="chart-card">
      <h3>Hoạt động dữ liệu 7 ngày</h3>
      <div className="legend"><i className="yellow-dot" /> Món mới <i className="green-dot" /> Đã xuất bản</div>
      <svg viewBox="0 0 620 180" aria-label="Biểu đồ">
        <g className="grid-lines">{[25, 65, 105, 145].map((y) => <line key={y} x1="30" y1={y} x2="600" y2={y} />)}</g>
        <polyline className="line yellow-line" points="35,128 125,92 210,50 300,76 390,51 480,69 575,51" />
        <polyline className="line green-line" points="35,145 125,126 210,104 300,106 390,91 480,78 575,61" />
        {[[35, 128], [125, 92], [210, 50], [300, 76], [390, 51], [480, 69], [575, 51]].map(([cx, cy]) => <circle key={`${cx}`} className="yellow-point" cx={cx} cy={cy} r="4" />)}
        {[[35, 145], [125, 126], [210, 104], [300, 106], [390, 91], [480, 78], [575, 61]].map(([cx, cy]) => <circle key={`${cx}`} className="green-point" cx={cx} cy={cy} r="4" />)}
      </svg>
      <div className="chart-dates">{['06/08', '07/08', '08/08', '09/08', '10/08', '11/08', '12/08'].map((d) => <span key={d}>{d}</span>)}</div>
    </Card>
  )
}

export default function ReportsPage() {
  return (
    <>
      <div className="page-heading">
        <div><h1>Báo cáo & phân tích</h1><p>Thống kê hệ thống</p></div>
        <div className="heading-actions">
          <Button variant="outline">▣ &nbsp;01–31 Tháng 8, 2026</Button>
          <Button><FileText /> Xuất PDF</Button>
        </div>
      </div>
      <div className="stats-grid">
        <Stat icon={Sparkles} value="186.240" label="Lượt random" tone="yellow" note="↑ 18,4%" />
        <Stat icon={CheckCircle2} value="72%" label="Tỷ lệ chọn món" tone="yellow" note="↑ 6,2%" />
        <Stat icon={Clock3} value="4,6 phút" label="Thời gian phiên trung bình" tone="yellow" note="↑ 0,8 phút" />
        <Stat icon={Archive} value="38%" label="Tỷ lệ quay lại (7 ngày)" tone="yellow" note="↑ 4,5%" />
      </div>
      <div className="report-grid">
        <LineChart />
        <Card className="donut-card">
          <h3>Nhu cầu phổ biến</h3>
          <div>
            <div className="donut">72%</div>
            <ul>
              {[['Ăn ngon', '34%'], ['Lành mạnh', '28%'], ['Tiết kiệm', '21%'], ['Nhanh gọn', '17%']].map(([a, b]) => (
                <li key={a}><i /> {a}<b>{b}</b></li>
              ))}
            </ul>
          </div>
        </Card>
        <Card className="ranked">
          <h3>Món được chọn nhiều nhất</h3>
          {['Phở bò', 'Cơm tấm', 'Bún bò Huế', 'Bánh mì', 'Gỏi cuốn'].map((x, i) => (
            <p key={x}>{i + 1}. &nbsp;{x}<span><i style={{ width: `${100 - i * 13}%` }} /></span><b>{24680 - i * 2800}</b></p>
          ))}
        </Card>
      </div>
      <Card className="data-insights">
        <h3>Gợi ý từ dữ liệu</h3>
        {['Tăng cường gợi ý "Ăn ngon" vào cuối tuần', 'Đẩy mạnh nhóm "Lành mạnh" buổi tối', 'Tối ưu món "Nhanh gọn" giờ cao điểm'].map((x, i) => (
          <div key={x}>
            <div className="metric-icon yellow">{i === 1 ? <Leaf /> : <Zap />}</div>
            <b>{x}</b>
            <p>Nhu cầu tăng cao, ưu tiên hiển thị nội dung phù hợp.</p>
          </div>
        ))}
      </Card>
    </>
  )
}
