import { Textarea } from '../components/ui/textarea'
// TODO: connect API — chưa có backend endpoint cho quản lý cộng đồng
import { CheckCircle2, Clock3, FileText, Flag } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

const assets = { pho: '/assets/pho-bo.jpg', bun: '/assets/bun-rieu.jpg', avatar: '/assets/avatar.jpg' }

function Stat({ icon: Icon, value, label, tone = 'yellow', note }: { icon: typeof FileText; value: string; label: string; tone?: string; note?: string }) {
  return <Card className="stat-card"><div className={`metric-icon ${tone}`}><Icon size={27} /></div><div><b>{value}</b><p>{label}</p>{note && <small className="note">{note}</small>}</div></Card>
}

const reports = ['Hương Giang', 'Minh Anh', 'Đức Nam', 'Lan Phương', 'Hoàng Long']

export default function CommunityPage() {
  return (
    <>
      <div className="page-heading">
        <div><h1>Kiểm duyệt cộng đồng</h1><p>Giữ nội dung Mogu an toàn và hữu ích</p></div>
      </div>
      <div className="stats-grid">
        <Stat icon={FileText} value="42" label="báo cáo mới" tone="yellow" note="+12 so với hôm qua" />
        <Stat icon={Clock3} value="18" label="chờ xử lý" tone="yellow" note="-5 so với hôm qua" />
        <Stat icon={Flag} value="6" label="ưu tiên cao" tone="red" note="+2 so với hôm qua" />
        <Stat icon={CheckCircle2} value="95%" label="xử lý trong ngày" tone="green" note="+4% so với hôm qua" />
      </div>
      <div className="community-grid">
        <Card className="moderation-filter">
          <h3>Bộ lọc</h3>
          <small>Loại nội dung</small>
          {['Bài viết                  27', 'Bình luận                9', 'Hình ảnh                   6'].map((x, i) => <button className={i === 0 ? 'chosen' : ''} key={x}>{x}</button>)}
          <hr />
          <small>Lý do báo cáo</small>
          {['Spam                         14', 'Sai thông tin              18', 'Ngôn từ không phù hợp   6'].map((x) => <label key={x}><input type="checkbox" /> {x}</label>)}
          <Button variant="outline">↻ Xóa bộ lọc</Button>
        </Card>
        <Card className="report-list">
          <header><Button variant="outline" size="sm">Mới nhất</Button><small>27 kết quả</small></header>
          {reports.map((x, i) => (
            <button key={x} className={i === 0 ? 'report selected-report' : 'report'}>
              <img src={i % 2 ? assets.avatar : assets.pho} />
              <span>
                <b>{x}</b>
                <small>{i + 2} giờ trước</small>
                <p>{i ? 'Quán này dở tệ, đừng ai tới!' : 'Hôm nay Mogu chọn Bún bò Huế cho mình!'}</p>
                <Badge>⚑ Ưu tiên cao</Badge>
              </span>
              <em>{12 - i * 2} báo cáo</em>
            </button>
          ))}
        </Card>
        <Card className="report-detail">
          <h4>Nội dung được báo cáo</h4>
          <div className="author-mini"><img src={assets.avatar} /><b>Hương Giang</b><small>2 giờ trước · Bài viết</small></div>
          <p>Hôm nay Mogu chọn Bún bò Huế cho mình!</p>
          <Badge>Kết quả Random</Badge>
          <img className="report-food" src={assets.bun} />
          <hr />
          <b>Tóm tắt báo cáo</b>
          <p>⚠ Lý do: Thông tin dinh dưỡng chưa chính xác</p>
          <p>♧ 12 người dùng đã báo cáo</p>
          <h4>Hướng dẫn cộng đồng</h4>
          {['Nội dung chính xác và đáng tin cậy', 'Tôn trọng và lịch sự với mọi người', 'Không đăng thông tin gây hiểu lầm'].map((x) => (
            <p className="guideline" key={x}><CheckCircle2 /> {x}</p>
          ))}
        </Card>
        <Card className="actions-card">
          <h4>Hành động</h4>
          {['Bỏ qua báo cáo', 'Ẩn nội dung', 'Cảnh cáo người dùng', 'Xóa nội dung'].map((x, i) => (
            <Button variant={i === 3 ? 'danger' : 'outline'} key={x}>
              {x}
              <small>{i === 3 ? 'Xóa vĩnh viễn bài viết' : 'Nội dung hợp lệ, không vi phạm'}</small>
            </Button>
          ))}
          <label>Ghi chú (tùy chọn)<Textarea placeholder="Nhập ghi chú nội bộ..." /></label>
          <Button className="full">Lưu hành động</Button>
        </Card>
      </div>
    </>
  )
}
