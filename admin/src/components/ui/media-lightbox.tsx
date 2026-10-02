import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

export type LightboxMediaItem = {
  url: string
  title?: string
  subtitle?: string
}

export type LightboxMedia =
  | {
      type: 'image'
      url: string
      title?: string
      subtitle?: string
    }
  | {
      type: 'gallery'
      items: LightboxMediaItem[]
      initialIndex?: number
      title?: string
    }
  | {
      type: 'video'
      videoUrl: string
      title?: string
      subtitle?: string
    }

export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/)
  return match?.[1] ?? null
}

export interface MediaLightboxProps {
  open: boolean
  onClose: () => void
  media: LightboxMedia | null
}

export function MediaLightbox({ open, onClose, media }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoom, setZoom] = useState(1)

  // Sync index when media changes
  useEffect(() => {
    if (media?.type === 'gallery') {
      setCurrentIndex(media.initialIndex ?? 0)
    } else {
      setCurrentIndex(0)
    }
    setZoom(1)
  }, [media])

  const galleryItems = media?.type === 'gallery' ? media.items : []
  const hasMultiple = galleryItems.length > 1

  const handlePrev = useCallback(() => {
    if (!hasMultiple) return
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : galleryItems.length - 1))
    setZoom(1)
  }, [hasMultiple, galleryItems.length])

  const handleNext = useCallback(() => {
    if (!hasMultiple) return
    setCurrentIndex((prev) => (prev < galleryItems.length - 1 ? prev + 1 : 0))
    setZoom(1)
  }, [hasMultiple, galleryItems.length])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrev()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 3))
      } else if (e.key === '-') {
        setZoom((z) => Math.max(z - 0.25, 0.5))
      } else if (e.key === '0') {
        setZoom(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('overflow-hidden')
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('overflow-hidden')
    }
  }, [open, onClose, handlePrev, handleNext])

  if (!open || !media) return null

  // Resolve current item
  let currentImageUrl = ''
  let currentTitle = ''
  let currentSubtitle = ''

  if (media.type === 'image') {
    currentImageUrl = media.url
    currentTitle = media.title ?? ''
    currentSubtitle = media.subtitle ?? ''
  } else if (media.type === 'gallery') {
    const item = galleryItems[currentIndex]
    currentImageUrl = item?.url ?? ''
    currentTitle = item?.title ?? media.title ?? ''
    currentSubtitle = item?.subtitle ?? ''
  }

  const isVideo = media.type === 'video'
  const youtubeId = isVideo ? extractYouTubeId(media.videoUrl) : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black/85 p-3 sm:p-5 backdrop-blur-md transition-opacity duration-200"
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        className="flex w-full max-w-5xl items-center justify-between gap-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-3">
          {media.type === 'gallery' && hasMultiple && (
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold tracking-wide">
              {currentIndex + 1} / {galleryItems.length}
            </span>
          )}
          <div className="min-w-0">
            {currentTitle && (
              <h3 className="truncate text-sm font-semibold text-white sm:text-base">
                {currentTitle}
              </h3>
            )}
            {currentSubtitle && (
              <p className="truncate text-xs text-white/70">{currentSubtitle}</p>
            )}
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!isVideo && currentImageUrl && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                title="Thu nhỏ (-)"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Kích thước chuẩn (0)"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                title="Phóng to (+)"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <a
                href={currentImageUrl}
                target="_blank"
                rel="noreferrer"
                title="Mở ảnh gốc trong tab mới"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </>
          )}

          {isVideo && (
            <a
              href={media.videoUrl}
              target="_blank"
              rel="noreferrer"
              title="Mở video trong tab mới"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Đóng (ESC)"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-red-600/80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div
        className="relative flex flex-1 w-full max-w-5xl items-center justify-center overflow-hidden py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handlePrev}
            title="Ảnh trước (Mũi tên trái)"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white shadow-lg backdrop-blur-sm transition hover:bg-white/20 hover:scale-110 sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Content */}
        {isVideo ? (
          <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
            {youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                title={media.title || 'Video Player'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : (
              <video
                src={media.videoUrl}
                controls
                autoPlay
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center overflow-auto p-2">
            <img
              src={currentImageUrl}
              alt={currentTitle || 'Media preview'}
              style={{
                transform: `scale(${zoom})`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl select-none"
            />
          </div>
        )}

        {/* Next Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handleNext}
            title="Ảnh kế tiếp (Mũi tên phải)"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-white shadow-lg backdrop-blur-sm transition hover:bg-white/20 hover:scale-110 sm:right-4"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Footer / Thumbnail strip for gallery */}
      {hasMultiple && (
        <div
          className="flex max-w-2xl gap-2 overflow-x-auto py-2 px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {galleryItems.map((item, idx) => (
            <button
              key={`${item.url}-${idx}`}
              type="button"
              onClick={() => {
                setCurrentIndex(idx)
                setZoom(1)
              }}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                currentIndex === idx
                  ? 'border-mogu-yellow scale-105 shadow-md'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Hook tiện ích giúp tích hợp MediaLightbox nhanh chóng vào bất kỳ trang nào.
 */
export function useMediaLightbox() {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState<LightboxMedia | null>(null)

  const openImage = useCallback((url: string, title?: string, subtitle?: string) => {
    if (!url) return
    setMedia({ type: 'image', url, title, subtitle })
    setOpen(true)
  }, [])

  const openGallery = useCallback(
    (items: LightboxMediaItem[], initialIndex = 0, title?: string) => {
      if (!items.length) return
      setMedia({ type: 'gallery', items, initialIndex, title })
      setOpen(true)
    },
    [],
  )

  const openVideo = useCallback((videoUrl: string, title?: string, subtitle?: string) => {
    if (!videoUrl) return
    setMedia({ type: 'video', videoUrl, title, subtitle })
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return {
    open,
    media,
    openImage,
    openGallery,
    openVideo,
    close,
    lightboxProps: {
      open,
      onClose: close,
      media,
    },
  }
}
