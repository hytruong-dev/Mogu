import type { ImportJob, ImportJobStatus } from '../../types'

export const STEP_DEFS = [
  { key: 'SEARCHING', label: 'Tìm nguồn', desc: 'Phân tích yêu cầu và xây dựng context.' },
  { key: 'EXTRACTING', label: 'Trích xuất AI', desc: 'Gọi AI để sinh công thức và nguyên liệu.' },
  { key: 'NORMALIZING', label: 'Chuẩn hóa', desc: 'Đổi đơn vị, chuẩn hóa tên nguyên liệu.' },
  { key: 'RECONCILING', label: 'Đối chiếu', desc: 'Kiểm tra trùng lặp với kho món ăn.' },
  { key: 'ENRICHING', label: 'Làm giàu dữ liệu', desc: 'Ước tính dinh dưỡng từ danh sách nguyên liệu.' },
  { key: 'DRAFTING', label: 'Tạo bản nháp', desc: 'Lưu món ăn DRAFT vào hệ thống.' },
]

export const ACTIVE_STATUSES: ImportJobStatus[] = [
  'PENDING',
  'SEARCHING',
  'EXTRACTING',
  'NORMALIZING',
  'RECONCILING',
  'ENRICHING',
  'DRAFTING',
]

export const SOURCE_OPTIONS = [
  { value: 'AI_GENERATED', label: 'AI tổng hợp', description: 'Dùng AI để sinh công thức từ tên món.' },
  { value: 'JSON_LD', label: 'Website công thức', description: 'Ưu tiên các trang có dữ liệu có cấu trúc.' },
  { value: 'VIDEO', label: 'Video YouTube', description: 'Trích xuất từ video hướng dẫn nấu ăn.' },
  { value: 'NUTRITION', label: 'Cơ sở dữ liệu dinh dưỡng', description: 'USDA FoodData Central và nguồn chuẩn.' },
]

export function parseJobSummary(job: ImportJob) {
  const logs = job.logs ?? []
  const ingLog = logs.find((l) => l.step === 'EXTRACTING' || l.step === 'NORMALIZING')
  const nutLog = logs.find((l) => l.step === 'ENRICHING')
  const ingMatch = ingLog?.message?.match(/(\d+)\s*nguyên liệu/)
  const stepMatch = ingLog?.message?.match(/(\d+)\s*bước/)
  const calMatch = nutLog?.message?.match(/(\d+)\s*kcal/)
  const protMatch = nutLog?.message?.match(/([\d.]+)g\s*đạm/)
  return {
    ingredients: ingMatch ? ingMatch[1] : null,
    steps: stepMatch ? stepMatch[1] : null,
    calories: calMatch ? calMatch[1] : null,
    protein: protMatch ? protMatch[1] : null,
  }
}

export function formatRelativeTime(timeStr?: string): string {
  if (!timeStr) return 'vừa xong'
  const diffSec = Math.floor((Date.now() - new Date(timeStr).getTime()) / 1000)
  if (diffSec < 60) return `${Math.max(1, diffSec)}s trước`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`
  return `${Math.floor(diffSec / 86400)} ngày trước`
}
