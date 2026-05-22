'use client'

import { ChevronLeft, ChevronRight, ImageIcon, Play } from 'lucide-react'
import Image from 'next/image'
import { useMemo, useRef, useState } from 'react'

import { getStoreProductMedia } from '@/components/store/store-utils'

export function StoreProductHeroGallery({ accentColor = '#0f172a', product, title = '' }) {
  const media = useMemo(() => getStoreProductMedia(product), [product])
  const largeMedia = useMemo(() => getStoreProductMedia(product, { variant: 'F' }), [product])
  const [activeIndex, setActiveIndex] = useState(0)
  const swipeRef = useRef({ active: false, startX: 0, startY: 0 })
  const safeActiveIndex = activeIndex >= media.length ? 0 : activeIndex
  const activeMedia = largeMedia[safeActiveIndex] || media[safeActiveIndex] || null

  function goToPreviousMedia() {
    if (!media.length) return
    setActiveIndex((current) => (current - 1 + media.length) % media.length)
  }

  function goToNextMedia() {
    if (!media.length) return
    setActiveIndex((current) => (current + 1) % media.length)
  }

  function handleTouchStart(event) {
    if (media.length <= 1) return
    const touch = event.touches?.[0]
    if (!touch) return
    swipeRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
    }
  }

  function handleTouchEnd(event) {
    if (!swipeRef.current.active || media.length <= 1) return
    const touch = event.changedTouches?.[0]
    swipeRef.current.active = false
    if (!touch) return

    const deltaX = touch.clientX - swipeRef.current.startX
    const deltaY = touch.clientY - swipeRef.current.startY
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return

    if (deltaX < 0) {
      goToNextMedia()
    } else {
      goToPreviousMedia()
    }
  }

  return (
    <div className="grid gap-3">
      <style jsx>{`
        @keyframes store-gallery-fade {
          from {
            opacity: 0.28;
          }
          to {
            opacity: 1;
          }
        }
        .store-gallery-active-image {
          animation: store-gallery-fade 220ms ease-out both;
        }
      `}</style>
      <div className="relative -mx-3 max-w-[calc(100%+1.5rem)] overflow-hidden bg-white min-[390px]:-mx-5 min-[390px]:max-w-[calc(100%+2.5rem)] sm:mx-0 sm:max-w-full sm:rounded-[8px]">
        <div
          className="relative aspect-square touch-pan-y overflow-hidden bg-white sm:aspect-[4/3] sm:rounded-[8px]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeMedia?.type === 'video' && activeMedia.embedUrl ? (
            <iframe
              key={activeMedia.embedUrl}
              src={activeMedia.embedUrl}
              title={`Vídeo de ${title}`}
              className="h-full w-full sm:rounded-[8px]"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : activeMedia?.type === 'video' && activeMedia.url ? (
            <video key={activeMedia.url} src={activeMedia.url} poster={activeMedia.thumbnail || undefined} controls className="h-full w-full bg-black object-contain sm:rounded-[8px]" />
          ) : activeMedia?.url ? (
            <Image
              key={activeMedia.url}
              src={activeMedia.url}
              alt={title}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
              unoptimized
              className="store-gallery-active-image h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          {media.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goToPreviousMedia}
                className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[12px] bg-white/94 text-slate-900 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.3)] transition hover:-translate-y-[52%]"
                aria-label="Mídia anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNextMedia}
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[12px] bg-white/94 text-slate-900 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.3)] transition hover:-translate-y-[52%]"
                aria-label="Próxima mídia"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {media.length > 1 ? (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
          {media.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="relative aspect-square overflow-hidden rounded-[6px] bg-transparent p-0 leading-none transition hover:shadow-[0_8px_18px_-12px_rgba(15,23,42,0.34)]"
              aria-label={item.type === 'video' ? `Ver vídeo ${index + 1}` : `Ver imagem ${index + 1}`}
            >
              {item.thumbnail || item.url ? (
                <Image src={item.thumbnail || item.url} alt={`${title} ${index + 1}`} fill sizes="96px" unoptimized className="block h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                  <Play className="h-4 w-4" />
                </span>
              )}
              {item.type === 'video' ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              ) : null}
              <span
                className="pointer-events-none absolute inset-0 rounded-[6px] border-[3px] transition"
                style={{ borderColor: index === safeActiveIndex ? `${accentColor}55` : 'transparent' }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
