import { useRef, useState } from 'react'
import {
  Bold,
  Code,
  Columns,
  Eye,
  FileEdit,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  previewHtml: string
  placeholder?: string
  rows?: number
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  previewHtml,
  placeholder = 'Nhập nội dung markdown tại đây...',
  rows = 14,
  className,
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertText = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end) || defaultText

    const replacement = `${before}${selected}${after}`
    const newValue = value.substring(0, start) + replacement + value.substring(end)
    onChange(newValue)

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selected.length + after.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 10)
  }

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const charCount = value.length
  const estimatedReadMinutes = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div className={cn('border border-border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col', className)}>
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40 shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('**', '**', 'chữ đậm')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="In đậm (Bold)"
          >
            <Bold size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('*', '*', 'chữ nghiêng')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="In nghiêng (Italic)"
          >
            <Italic size={14} />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('\n## ', '\n', 'Tiêu đề chính')}
            className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            title="Tiêu đề H2"
          >
            <Heading2 size={14} className="mr-0.5" /> H2
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('\n### ', '\n', 'Tiêu đề phụ')}
            className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            title="Tiêu đề H3"
          >
            <Heading3 size={14} className="mr-0.5" /> H3
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('\n- ', '', 'Mục danh sách')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Danh sách dấu gạch đầu dòng"
          >
            <List size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('\n1. ', '', 'Bước thực hiện')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Danh sách đánh số"
          >
            <ListOrdered size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('\n> ', '', 'Đoạn trích dẫn nổi bật')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Trích dẫn"
          >
            <Quote size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('`', '`', 'code')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Mã nguồn (Code inline)"
          >
            <Code size={14} />
          </Button>
          <div className="h-4 w-px bg-border mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('[', '](https://example.com)', 'Tiêu đề liên kết')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Chèn liên kết"
          >
            <Link2 size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('![', '](https://images.unsplash.com/...)', 'Chú thích ảnh')}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Chèn ảnh Markdown"
          >
            <ImageIcon size={14} />
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
              viewMode === 'edit'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Chỉ soạn thảo"
          >
            <FileEdit size={12} />
            <span className="hidden sm:inline">Soạn thảo</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
              viewMode === 'split'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Chia đôi màn hình"
          >
            <Columns size={12} />
            <span className="hidden sm:inline">Song song</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
              viewMode === 'preview'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Xem trước kết quả"
          >
            <Eye size={12} />
            <span className="hidden sm:inline">Xem trước</span>
          </button>
        </div>
      </div>

      {/* Editor & Preview Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border flex-1 min-h-[320px]">
        {/* Editor Column */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={cn('relative flex flex-col', viewMode === 'edit' && 'md:col-span-2')}>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={rows}
              className="w-full flex-1 p-4 border-0 rounded-none font-mono text-xs leading-relaxed focus-visible:ring-0 resize-none bg-transparent"
            />
          </div>
        )}

        {/* Preview Column */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={cn(
              'p-4 bg-muted/10 overflow-y-auto max-h-[460px] flex flex-col',
              viewMode === 'preview' && 'md:col-span-2'
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center justify-between pb-2 border-b border-border/50">
              <span className="flex items-center gap-1">
                <Eye size={12} className="text-amber-500" />
                Xem trước trực quan
              </span>
              <span className="font-normal font-sans text-[11px] text-muted-foreground">
                Chuẩn hiển thị Feed ứng dụng Mogu
              </span>
            </div>
            {value.trim() ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none space-y-2 text-foreground text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/60 py-12 text-xs">
                <FileEdit size={24} className="mb-2 opacity-40" />
                <span>Nội dung Markdown sẽ hiển thị trực quan tại đây...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between shrink-0 font-mono">
        <div className="flex items-center gap-3">
          <span>{wordCount} từ</span>
          <span>•</span>
          <span>{charCount} ký tự</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-600 font-sans font-medium">
          <span>Ước tính đọc: ~{estimatedReadMinutes} phút</span>
        </div>
      </div>
    </div>
  )
}
