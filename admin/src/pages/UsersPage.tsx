// TODO: connect API — chưa có backend endpoint cho quản lý người dùng
import { useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  MoreVertical,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'

const assets = { pho: '/assets/pho-bo.jpg', bun: '/assets/bun-rieu.jpg', avatar: '/assets/avatar.jpg' }

function Stat({ icon: Icon, value, label, tone = 'yellow', note }: { icon: typeof Users; value: string; label: string; tone?: string; note?: string }) {
  return <Card className="stat-card"><div className={`metric-icon ${tone}`}><Icon size={27} /></div><div><b>{value}</b><p>{label}</p>{note && <small className="note">{note}</small>}</div></Card>
}

function UserDrawer({ close }: { close: () => void }) {
  return (
    <Card className="user-drawer">
      <header><b>Hương Giang</b><button onClick={close}><X /></button></header>
      <div className="drawer-profile">
        <img src={assets.avatar} />
        <span><b>Hương Giang</b><small>huonggiang@gmail.com</small><small>Tham gia: 12/01/2024</small></span>
      </div>
      {[['Mục tiêu', 'Giảm cân'], ['Dị ứng', 'Hải sản'], ['Trạng thái tài khoản', 'Hoạt động'], ['Xác minh email', 'Đã xác minh'], ['Số món đã lưu', '23 món'], ['Số lượt random', '156 lượt']].map(([a, b]) => (
        <div className="drawer-item" key={a}><span>{a}</span><b>{b}</b></div>
      ))}
      <h3>Món đã lưu (3)</h3>
      {['Ức gà áp chảo sốt chanh dây', 'Salad quinoa rau củ', 'Bánh yến mạch chuối'].map((x) => (
        <div className="saved-item" key={x}><img src={assets.pho} /><span>{x}<small>320 kcal · Giảm cân</small></span><BookOpen size={18} /></div>
      ))}
      <footer><Button variant="outline">Xem hồ sơ</Button><Button variant="danger">Hạn chế tài khoản</Button></footer>
    </Card>
  )
}

const list = ['Hương Giang', 'Minh Quân', 'Lan Anh', 'Quốc Huy', 'Ngọc Mai']

export default function UsersPage() {
  const [selected, setSelected] = useState(false)
  return (
    <>
      <div className="page-heading">
        <div><h1>Người dùng</h1><p>Quản lý tài khoản, sức khỏe và quyền truy cập</p></div>
      </div>
      <div className="stats-grid">
        <Stat icon={Users} value="28.450" label="người dùng" tone="yellow" note="↑ 12,5% so với tuần trước" />
        <Stat icon={Zap} value="1.286" label="hoạt động hôm nay" tone="yellow" note="↑ 8,3% so với hôm qua" />
        <Stat icon={Users} value="348" label="tài khoản mới" tone="green" note="↑ 15,7% so với hôm qua" />
        <Stat icon={ShieldCheck} value="17" label="bị hạn chế" tone="red" note="↑ 3 so với hôm qua" />
      </div>
      <div className={selected ? 'users-layout open' : 'users-layout'}>
        <Card className="table-card users-table">
          <div className="filters">
            <label><Search size={18} /><Input placeholder="Tìm tên, email..." /></label>
            <Button variant="outline">Trạng thái<ChevronDown /></Button>
            <Button variant="outline">Mục tiêu<ChevronDown /></Button>
            <Button variant="outline"><Upload /> Xuất dữ liệu</Button>
          </div>
          <table>
            <thead><tr><th>Người dùng</th><th>Mục tiêu</th><th>Trạng thái</th><th>Hoạt động gần nhất</th><th>Ngày tham gia</th><th>Hành động</th></tr></thead>
            <tbody>
              {list.map((x, i) => (
                <tr key={x} className={i === 0 ? 'selected-row' : ''} onClick={() => setSelected(true)}>
                  <td className="user-cell"><img src={i % 2 ? assets.pho : assets.avatar} /><span><b>{x}</b><small>{x.toLowerCase().replace(' ', '')}@gmail.com</small></span></td>
                  <td>{i % 2 ? 'Tăng cơ' : 'Giảm cân'}</td>
                  <td><Badge className={i === 2 ? 'pending' : 'published'}>• Hoạt động</Badge></td>
                  <td>{i + 2} phút trước</td>
                  <td>12/01/2024</td>
                  <td><MoreVertical /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        {selected && <UserDrawer close={() => setSelected(false)} />}
      </div>
    </>
  )
}
