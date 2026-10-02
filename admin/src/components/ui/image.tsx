import * as React from 'react'
import { ImageIcon, Utensils, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'
import { MediaLightbox, useMediaLightbox } from './media-lightbox'

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: 'utensils' | 'image' | 'user' | React.ReactNode
  fallbackText?: string
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto'
  zoomable?: boolean
  title?: string
  subtitle?: string
  containerClassName?: string
}

export function Image({
  src,
  alt = '',
  className,
  fallbackIcon = 'utensils',
  fallbackText,
  aspectRatio = 'auto',
  zoomable = false,
  title,
  subtitle,
  containerClassName,
  onClick,
  ...props
}: ImageProps) {
  const [loading, setLoading] = React.useState(Boolean(src))
  const [error, setError] = React.useState(false)
  const { openImage, lightboxProps } = useMediaLightbox()

  React.useEffect(() => {
    setLoading(Boolean(src))
    setError(false)
  }, [src])

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
        ? 'aspect-video'
        : aspectRatio === 'portrait'
          ? 'aspect-[3/4]'
          : ''

  const renderFallbackIcon = () => {
    if (React.isValidElement(fallbackIcon)) return fallbackIcon
    if (fallbackIcon === 'image') return <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
    return <Utensils className="h-6 w-6 text-muted-foreground/60" />
  }

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomable && src && !error) {
      e.stopPropagation()
      openImage(src, title || alt, subtitle)
    }
  }

  return (
    <>
      <div
        className={cn(
          'group relative inline-flex items-center justify-center overflow-hidden rounded-md bg-muted/40 transition-colors',
          aspectClass,
          zoomable && src && !error && 'cursor-zoom-in',
          containerClassName
        )}
        onClick={handleContainerClick}
      >
        {/* Loading Skeleton */}
        {loading && !error && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        )}

        {/* Actual Image */}
        {src && !error ? (
          <img
            src={src}
            alt={alt}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(true)
            }}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-200',
              loading ? 'opacity-0' : 'opacity-100',
              className
            )}
            onClick={onClick}
            {...props}
          />
        ) : (
          /* Error or Empty Fallback */
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
            {renderFallbackIcon()}
            {fallbackText && (
              <span className="text-[11px] font-medium leading-none line-clamp-1">
                {fallbackText}
              </span>
            )}
          </div>
        )}

        {/* Zoom Icon Overlay */}
        {zoomable && src && !error && !loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <ZoomIn className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
        )}
      </div>

      {zoomable && <MediaLightbox {...lightboxProps} />}
    </>
  )
}
