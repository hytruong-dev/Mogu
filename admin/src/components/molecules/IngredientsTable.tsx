import { useMemo, useState } from 'react'
import { CircleCheck, Plus, Search, Trash2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Select } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import IngredientPicker from '../ui/ingredient-picker'
import { cn } from '@/lib/utils'

export interface DishIngredientRow {
  id: number
  clientRef: string
  name: string
  ingredientId?: string
  ingredientImageUrl?: string
  ingredientStatus?: 'PENDING_REVIEW' | 'ACTIVE' | 'INACTIVE' | 'REJECTED' | 'MERGED'
  resolutionStatus:
    | 'EMPTY'
    | 'SEARCHING'
    | 'LINKED'
    | 'NOT_FOUND'
    | 'PROVISIONING'
    | 'PENDING_REVIEW'
    | 'AMBIGUOUS'
    | 'ERROR'
  qty: string
  unit: string
  prep: string
  required: boolean
}

export const emptyDishIngredient = (): DishIngredientRow => ({
  id: Date.now() + Math.random(),
  clientRef: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  resolutionStatus: 'EMPTY',
  qty: '',
  unit: '',
  prep: '',
  required: true,
})

const UNIT_OPTIONS = [
  '', 'g', 'kg', 'mg', 'lít', 'ml', 'muỗng cà phê', 'muỗng canh',
  'chén', 'bát', 'tô', 'đĩa', 'cái', 'quả', 'củ', 'tép', 'cây',
  'nhánh', 'lá', 'miếng', 'gói', 'khẩu phần', 'vừa đủ', 'một ít',
]

function SmallSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-lg border border-black/10 bg-white text-sm"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </Select>
  )
}

interface IngredientsTableProps {
  rows: DishIngredientRow[]
  onChange: (rows: DishIngredientRow[]) => void
  servings: number
  onServingsChange: (n: number) => void
}

function detectGluten(rows: DishIngredientRow[]) {
  return rows.some((r) =>
    /phở|bột mì|gluten|bánh mì|mì|bún tươi|bột/i.test(r.name),
  )
}

export function IngredientsTable({ rows, onChange, servings, onServingsChange }: IngredientsTableProps) {
  const [search, setSearch] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const update = (id: number, patch: Partial<DishIngredientRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRow = (id: number) => onChange(rows.filter((r) => r.id !== id))
  const addRow = () => onChange([...rows, emptyDishIngredient()])

  const visible = useMemo(
    () => (search.trim() ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rows),
    [rows, search],
  )

  const hasGluten = detectGluten(rows)

  const applyPaste = () => {
    const parsed = pasteText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s+([\d.,]+)\s*([a-zA-Zà-ỹ%]+)?$/)
        return {
          ...emptyDishIngredient(),
          id: Date.now() + Math.random(),
          name: m?.[1] ?? line,
          qty: m?.[2] ?? '',
          unit: m?.[3] || '',
        } satisfies DishIngredientRow
      })
    if (parsed.length) onChange([...rows, ...parsed])
    setPasteText('')
    setPasteOpen(false)
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8">
      <h2 className="text-lg font-bold">Thành phần món ăn</h2>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="relative max-w-[340px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Lọc trong danh sách thành phần..."
            className="h-11 w-full rounded-xl border-black/10 bg-white pl-10 pr-4 text-sm focus-visible:ring-mogu-yellow"
          />
        </div>
        <Button
          type="button"
          onClick={addRow}
          className="flex h-11 items-center gap-2 rounded-xl border-2 border-mogu-yellow bg-white px-5 text-sm font-semibold text-foreground hover:bg-mogu-yellow-light"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Thêm nguyên liệu mới
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => setPasteOpen(true)}
          className="ml-2 text-sm font-semibold text-gray-900 underline underline-offset-4 hover:text-mogu-yellow-dark"
        >
          Nhập nhanh từ văn bản
        </Button>
      </div>

      <Table className="mt-5">
        <TableHeader>
          <TableRow className="border-b border-black/10 text-left text-sm text-gray-800">
            <TableHead className="w-[24%] pb-3 font-semibold">Nguyên liệu</TableHead>
            <TableHead className="w-[13%] pb-3 font-semibold">Số lượng</TableHead>
            <TableHead className="w-[13%] pb-3 font-semibold">Đơn vị</TableHead>
            <TableHead className="w-[22%] pb-3 font-semibold">Cách sơ chế</TableHead>
            <TableHead className="w-[16%] pb-3 font-semibold">Bắt buộc</TableHead>
            <TableHead className="w-[12%] pb-3 font-semibold">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => (
            <TableRow key={row.id} className="border-b border-black/5">
              <TableCell className="py-2.5 pr-4">
                <IngredientPicker
                  value={row.name}
                  ingredientId={row.ingredientId}
                  ingredientImageUrl={row.ingredientImageUrl}
                  ingredientStatus={row.ingredientStatus}
                  resolutionStatus={row.resolutionStatus}
                  onChange={(name, ingredient, meta) =>
                    update(row.id, {
                      name,
                      ingredientId: ingredient?.id,
                      ingredientImageUrl: ingredient?.imageUrl,
                      ingredientStatus: ingredient?.status as DishIngredientRow['ingredientStatus'],
                      resolutionStatus:
                        meta?.resolutionStatus ??
                        (ingredient?.id
                          ? ingredient.status === 'PENDING_REVIEW'
                            ? 'PENDING_REVIEW'
                            : 'LINKED'
                          : name.trim()
                            ? 'NOT_FOUND'
                            : 'EMPTY'),
                      unit: ingredient?.unit || row.unit,
                    })
                  }
                  placeholder="Tìm nguyên liệu..."
                  style={{ flex: 'unset', width: '100%' }}
                />
              </TableCell>
              <TableCell className="py-2.5 pr-4">
                <Input
                  value={row.qty}
                  onChange={(e) => update(row.id, { qty: e.target.value })}
                  className="h-10 rounded-lg border-black/10 shadow-none focus-visible:border-mogu-yellow focus-visible:ring-mogu-yellow/30"
                />
              </TableCell>
              <TableCell className="py-2.5 pr-4">
                <SmallSelect value={row.unit} options={UNIT_OPTIONS} onChange={(unit) => update(row.id, { unit })} />
              </TableCell>
              <TableCell className="py-2.5 pr-4">
                <Input
                  value={row.prep}
                  onChange={(e) => update(row.id, { prep: e.target.value })}
                  placeholder="vd: luộc và xé"
                  className="h-10 rounded-lg border-black/10 shadow-none focus-visible:border-mogu-yellow focus-visible:ring-mogu-yellow/30"
                />
              </TableCell>
              <TableCell className="py-2.5 pr-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <Checkbox
                    checked={row.required}
                    onCheckedChange={(checked) => update(row.id, { required: Boolean(checked) })}
                  />
                  <span>{row.required ? 'Bắt buộc' : 'Tùy chọn'}</span>
                </label>
              </TableCell>
              <TableCell className="py-2.5">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-[18px] w-[18px]" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && (
        <p className="mt-4 text-sm text-gray-400">Chưa có nguyên liệu. Bấm “Thêm nguyên liệu mới” để bắt đầu.</p>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={addRow}
        className="mt-4 flex h-10 items-center gap-2 rounded-xl text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        Thêm dòng
      </Button>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-[15px] font-medium">Định lượng cho</span>
        <Input
          type="number"
          min={1}
          value={servings}
          onChange={(e) => onServingsChange(Math.max(1, Number(e.target.value) || 1))}
          className="h-10 w-20 text-center text-sm"
        />
        <span className="text-[15px]">khẩu phần</span>
      </div>

      <div className="mt-6">
        <h3 className="text-[15px] font-semibold">Dị ứng & thành phần cần cảnh báo</h3>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', hasGluten ? 'border-warn-orange-border bg-warn-orange-bg' : 'border-black/10 bg-white')}>
            {hasGluten ? (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-warn-orange text-xs font-bold text-warn-orange">!</span>
            ) : (
              <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-ok-green" strokeWidth={1.8} />
            )}
            <div>
              <div className="text-[15px] font-semibold">Gluten</div>
              <div className={cn('text-sm', hasGluten ? 'text-warn-orange' : 'text-ok-green')}>
                {hasGluten ? 'Có thể chứa' : 'Không chứa'}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-black/10 bg-white px-4 py-3">
            <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-ok-green" strokeWidth={1.8} />
            <div>
              <div className="text-[15px] font-semibold">Đậu phộng</div>
              <div className="text-sm text-ok-green">Không chứa</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-black/10 bg-white px-4 py-3">
            <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-ok-green" strokeWidth={1.8} />
            <div>
              <div className="text-[15px] font-semibold">Sữa</div>
              <div className="text-sm text-ok-green">Không chứa</div>
            </div>
          </div>
        </div>

        {hasGluten && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-warn-orange-border bg-warn-orange-bg px-4 py-3.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-warn-orange text-xs font-bold text-warn-orange">!</span>
            <p className="text-[15px] text-gray-900">Bánh phở và gia vị cần kiểm tra nguồn để xác nhận gluten.</p>
          </div>
        )}
      </div>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="p-6">
          <DialogHeader className="p-0 pb-4">
            <DialogTitle>Nhập nhanh từ văn bản</DialogTitle>
          </DialogHeader>
          <p className="mb-2 text-sm text-gray-500">Mỗi dòng một nguyên liệu, ví dụ: <code>Thịt gà 400 g</code></p>
          <Textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={'Bánh phở 500 g\nThịt gà 400 g'} />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPasteOpen(false)}>Hủy</Button>
            <Button type="button" onClick={applyPaste}>Thêm vào bảng</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
