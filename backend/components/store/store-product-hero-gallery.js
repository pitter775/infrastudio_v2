'use client'

import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getStoreProductImages } from '@/components/store/store-utils'

export function StoreProductHeroGallery({ accentColor = '#0f172a', product, title = '' }) {
  const images = useMemo(() => getStoreProductImages(product), [product])
  const largeImages = useMemo(() => getStoreProductImages(product, { variant: 'F' }), [product])
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = activeIndex >= images.length ? 0 : activeIndex
  const activeImage = largeImages[safeActiveIndex] || images[safeActiveIndex] || ''

  function goToPreviousImage() {
    if (!images.length) return
    setActiveIndex((current) => (current - 1 + images.length) % images.length)
  }

  function goToNextImage() {
    if (!images.length) return
    setActiveIndex((current) => (current + 1) % images.length)
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
      <div className="relative overflow-hidden rounded-[8px] bg-white">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] bg-white">
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={activeImage} src={activeImage} alt={title} loading="eager" decoding="async" fetchPriority="high" className="store-gallery-active-image h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goToPreviousImage}
                className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[12px] bg-white/94 text-slate-900 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.3)] transition hover:-translate-y-[52%]"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNextImage}
                className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[12px] bg-white/94 text-slate-900 shadow-[0_8px_16px_-10px_rgba(15,23,42,0.3)] transition hover:-translate-y-[52%]"
                aria-label="Proxima imagem"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="relative aspect-square overflow-hidden rounded-[6px] bg-transparent p-0 leading-none transition hover:shadow-[0_8px_18px_-12px_rgba(15,23,42,0.34)]"
              aria-label={`Ver imagem ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`${title} ${index + 1}`} loading="lazy" decoding="async" className="block h-full w-full object-cover" />
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
