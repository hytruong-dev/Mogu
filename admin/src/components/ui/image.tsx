import * as React from 'react'
import { ImageIcon, Utensils, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'
import { MediaLightbox, useMediaLightbox } from './media-lightbox'

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: 'utensils' | 'image' | 'user' | React.ReactNode
  fallbackText?: string
  fallbackSrc?: string
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto'
  zoomable?: boolean
  title?: string
  subtitle?: string
  containerClassName?: string
}

export function Image({
  src,
  fallbackSrc,
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
  loading: loadingProp = 'lazy',
  decoding: decodingProp = 'async',
  referrerPolicy: referrerPolicyProp = 'no-referrer',
  ...props
}: ImageProps) {
  const [currentSrc, setCurrentSrc] = React.useState<string | undefined>(src)
  const [hasTriedFallback, setHasTriedFallback] = React.useState(false)
  const [loading, setLoading] = React.useState(Boolean(src))
  const [error, setError] = React.useState(!src)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const { openImage, lightboxProps } = useMediaLightbox()

  // Reset state when incoming `src` prop changes
  React.useEffect(() => {
    setCurrentSrc(src)
    setHasTriedFallback(false)

    if (!src) {
      setLoading(false)
      setError(true)
      return
    }

    // Check if image is already cached and completed in browser
    if (imgRef.current?.complete && imgRef.current.currentSrc === src) {
      if (imgRef.current.naturalWidth > 0) {
        setLoading(false)
        setError(false)
        return
      }
    }

    setLoading(true)
    setError(false)
  }, [src])

  // Immediate check after DOM attachment (handles cached images where onLoad does not fire)
  React.useLayoutEffect(() => {
    if (!currentSrc) return
    const el = imgRef.current
    if (el && el.complete) {
      if (el.naturalWidth > 0) {
        setLoading(false)
        setError(false)
      } else if (el.naturalWidth === 0 && !loading) {
        if (fallbackSrc && !hasTriedFallback && fallbackSrc !== currentSrc) {
          setHasTriedFallback(true)
          setCurrentSrc(fallbackSrc)
          setLoading(true)
        } else {
          setError(true)
          setLoading(false)
        }
      }
    }
  }, [currentSrc, fallbackSrc, hasTriedFallback, loading])

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
    if (zoomable && currentSrc && !error) {
      e.stopPropagation()
      openImage(currentSrc, title || alt, subtitle)
    }
  }

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoading(false)
    setError(false)
    props.onLoad?.(e)
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && !hasTriedFallback && fallbackSrc !== currentSrc) {
      setHasTriedFallback(true)
      setCurrentSrc(fallbackSrc)
      setLoading(true)
      return
    }
    setLoading(false)
    setError(true)
    props.onError?.(e)
  }

  return (
    <>
      <div
        className={cn(
          'group relative inline-flex items-center justify-center overflow-hidden rounded-md bg-muted/40 transition-colors',
          aspectClass,
          zoomable && currentSrc && !error && 'cursor-zoom-in',
          containerClassName
        )}
        onClick={handleContainerClick}
      >
        {/* Loading Skeleton */}
        {loading && !error && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        )}

        {/* Actual Image */}
        {currentSrc && !error ? (
          <img
            ref={imgRef}
            src={currentSrc}
            alt={alt}
            loading={loadingProp}
            decoding={decodingProp}
            referrerPolicy={referrerPolicyProp}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-150',
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
        {zoomable && currentSrc && !error && !loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <ZoomIn className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
        )}
      </div>

      {/* Only mount Lightbox portal when it is actually open */}
      {zoomable && lightboxProps.open && <MediaLightbox {...lightboxProps} />}
    </>
  )
}
