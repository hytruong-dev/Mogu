import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import { UploadCloud, Image as ImageIcon, X, Loader2, Link2, Check, AlertCircle } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { mediaApi } from '../../api/media'

export interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  folder?: string
  label?: string
  description?: string
  aspectRatio?: 'video' | 'square' | 'banner' | 'auto'
  className?: string
  disabled?: boolean
}

export function ImageUpload({
  value,
  onChange,
  folder = 'general',
  label,
  description = 'Hỗ trợ JPG, PNG, WEBP (tối đa 10MB)',
  aspectRatio = 'video',
  className = '',
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const aspectClass = {
    video: 'aspect-[16/9]',
    banner: 'aspect-[21/9]',
    square: 'aspect-square max-w-[200px]',
    auto: 'min-h-[160px] max-h-[300px]',
  }[aspectRatio]

  const handleFileProcess = async (file: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng ảnh vượt quá giới hạn cho phép (10MB).')
      return
    }

    setUploadError(null)
    setIsUploading(true)

    try {
      const publicUrl = await mediaApi.uploadImage(file, folder)
      onChange(publicUrl)
    } catch (err: any) {
      console.error('Lỗi khi tải ảnh lên:', err)
      // Fallback: nếu API server gặp lỗi, dùng URL.createObjectURL để người dùng không bị tắc nghẽn
      try {
        const localUrl = URL.createObjectURL(file)
        onChange(localUrl)
        setUploadError('Tải lên máy chủ thất bại, đang dùng bộ nhớ tạm trình duyệt.')
      } catch {
        setUploadError(err?.message || 'Không thể tải ảnh lên. Vui lòng thử lại.')
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleFileProcess(file)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || isUploading) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFileProcess(file)
    }
  }

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return
    onChange(customUrl.trim())
    setCustomUrl('')
    setShowUrlInput(false)
    setUploadError(null)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ImageIcon size={14} className="text-muted-foreground" />
            {label}
          </label>
          <button
            type="button"
            onClick={() => setShowUrlInput((v) => !v)}
            className="text-[11px] font-medium text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
          >
            <Link2 size={12} />
            {showUrlInput ? 'Ẩn dán URL' : 'Dán link URL ảnh'}
          </button>
        </div>
      )}

      {/* URL input drawer toggle */}
      {showUrlInput && (
        <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border animate-in fade-in-50">
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Dán đường dẫn ảnh: https://..."
            className="h-8 text-xs bg-card"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleApplyUrl()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleApplyUrl}
            className="h-8 text-xs shrink-0 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Check size={13} className="mr-1" />
            Áp dụng
          </Button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || isUploading}
      />

      {/* Image Preview State */}
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-border shadow-xs bg-muted/30">
          <div className={`w-full ${aspectClass} overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-900`}>
            <img
              src={value}
              alt="Ảnh xem trước"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = '/assets/dish-fallback.png'
              }}
            />
          </div>

          {/* Action Overlay */}
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="text-xs h-8 bg-white/90 hover:bg-white text-slate-900 font-medium shadow-sm"
            >
              <UploadCloud size={14} className="mr-1.5" />
              Đổi ảnh khác
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onChange('')}
              disabled={disabled || isUploading}
              className="text-xs h-8 shadow-sm"
              title="Xóa ảnh này"
            >
              <X size={14} className="mr-1" />
              Xóa
            </Button>
          </div>
        </div>
      ) : (
        /* Empty Upload Dropzone State */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`w-full ${aspectClass} rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-200 select-none ${
            isDragging
              ? 'border-amber-500 bg-amber-500/10 scale-[0.99]'
              : 'border-border/80 hover:border-amber-500/60 hover:bg-muted/40 bg-card'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
              <Loader2 size={28} className="animate-spin text-amber-500" />
              <p className="text-xs font-semibold text-foreground">Đang tải ảnh lên kho lưu trữ...</p>
              <span className="text-[11px] text-muted-foreground">Vui lòng chờ trong giây lát</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 flex items-center justify-center shadow-xs">
                <UploadCloud size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  <span className="text-amber-600 dark:text-amber-400 hover:underline">Nhấn để tải ảnh lên</span> hoặc kéo thả ảnh vào đây
                </p>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-1.5 animate-in fade-in-50">
          <AlertCircle size={13} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  )
}
