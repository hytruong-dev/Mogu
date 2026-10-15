import { useNavigate } from 'react-router-dom'
import type { ImportJob } from '../../types'
import { useAdminDish } from '../../hooks/useDishes'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Image } from '../ui/image'
import { parseJobSummary } from './types'

export interface ImportSuccessViewProps {
  job: ImportJob
  onNew: () => void
}

export function ImportSuccessView({ job, onNew }: ImportSuccessViewProps) {
  const navigate = useNavigate()
  const { data: dish } = useAdminDish(job.resultDishId ?? '')
  const summary = parseJobSummary(job)
  const image = (job as any).suggestedImageUrl as string | undefined
  const nutrition = (dish as any)?.nutrition
  const ingredients = (dish as any)?.dishIngredients ?? []
  const steps = (dish as any)?.recipeSteps ?? []
  const dishName = dish?.name ?? job.query
  const reconLog = (job.logs ?? []).find((l) => l.step === 'RECONCILING')
  const logPending = Number(
    `${reconLog?.message ?? ''} ${(reconLog as any)?.detail ?? ''}`.match(/Mới:\s*(\d+)/)?.[1] ?? 0
  )
  const pendingIngredients = dish
    ? ingredients.filter((di: any) => !di.ingredient || di.ingredient.status !== 'ACTIVE').length
    : job.pendingIngredientCount ?? logPending

  return (
    <div className="ai-success-page">
      <div className="ai-success-check">✓</div>
      <h1>Đã tạo bản nháp</h1>
      <p>AI đã hoàn tất {dishName}. Hãy kiểm tra trước khi gửi duyệt.</p>
      <Card className="ai-success-card">
        <header>
          <span>♨</span>
          <div>
            <b>{dishName}</b>
            <small>
              <em>BẢN NHÁP</em> · DISH-{(job.resultDishId ?? job.id).slice(0, 6).toUpperCase()}
            </small>
          </div>
        </header>
        <div className="ai-success-counts">
          <div>
            <b>{ingredients.length || summary.ingredients || 0}</b>
            <small>nguyên liệu</small>
          </div>
          <div>
            <b>{steps.length || summary.steps || 0}</b>
            <small>bước chế biến</small>
          </div>
          <div>
            <b>
              {[nutrition?.calories, nutrition?.proteinG, nutrition?.carbsG, nutrition?.fatG, nutrition?.fiberG].filter(
                Boolean
              ).length || 0}
            </b>
            <small>chỉ số dinh dưỡng</small>
          </div>
          <div>
            <b>{image ? 1 : 0}</b>
            <small>ảnh minh họa</small>
          </div>
        </div>
        <div className="ai-success-warning">
          △ Dữ liệu do AI tạo có thể chưa chính xác. Cần kiểm tra nguyên liệu, định lượng, khẩu phần và dinh dưỡng.
        </div>
        {pendingIngredients > 0 && (
          <div
            className="ai-success-warning"
            style={{
              background: '#fff7e6',
              borderColor: '#f3d38b',
              color: '#92400e',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <span>
              🥬 <b>{pendingIngredients}</b> nguyên liệu mới tự động tìm (thông tin + ảnh tạm), cần duyệt trước khi gửi duyệt món.
            </span>
            {job.resultDishId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/foods/${job.resultDishId}?step=ingredients`)}
              >
                Xử lý nguyên liệu →
              </Button>
            )}
          </div>
        )}
        <div className="ai-success-hero">
          <div className="ai-success-photo">
            {image ? (
              <Image
                src={image}
                alt={dishName}
                aspectRatio="square"
                zoomable
                title={dishName}
                subtitle="Ảnh minh họa AI"
                className="w-full h-full object-cover"
              />
            ) : (
              '🍜'
            )}
          </div>
          <div>
            <small>◷ Thời gian chế biến</small>
            <b>{dish?.cookMinutes ?? '—'} phút</b>
          </div>
          <div>
            <small>⚑ Khẩu phần</small>
            <b>{dish?.servings ?? '—'} người</b>
          </div>
          <div>
            <small>♨ Năng lượng</small>
            <b>{nutrition?.calories ?? summary.calories ?? '—'} kcal</b>
          </div>
          <div>
            <small>☆ Độ khó</small>
            <b>{dish?.difficulty === 'EASY' ? 'Dễ' : dish?.difficulty === 'HARD' ? 'Khó' : 'Trung bình'}</b>
          </div>
        </div>
        <Button
          className="ai-success-edit"
          onClick={() => job.resultDishId && navigate(`/foods/${job.resultDishId}`)}
        >
          ✎ Mở để chỉnh sửa
        </Button>
        <footer>
          <Button variant="outline" onClick={() => navigate('/foods')}>
            ⌘ Về kho món
          </Button>
          <Button variant="outline" onClick={onNew}>
            ＋ Nhập món khác
          </Button>
        </footer>
      </Card>
    </div>
  )
}
