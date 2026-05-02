'use client'

import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getStoreProductImages } from '@/components/store/store-utils'

export function StoreProductHeroGallery({ product, title = '' }) {
  const images = useMemo(() => getStoreProductImages(product), [product])
  const [activeIndex, setActiveIndex] = useState(0)
  const safeActiveIndex = activeIndex >= images.length ? 0 : activeIndex
  const activeImage = images[safeActiveIndex] || ''

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
      <div className="relative overflow-hidden rounded-[8px]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[8px]">
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeImage} alt={title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
        <div className="grid grid-cols-6 gap-2">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`overflow-hidden rounded-[6px] transition ${
                index === safeActiveIndex ? 'ring-2 ring-slate-900/10' : ''
              }`}
              aria-label={`Ver imagem ${index + 1}`}
            >
              <div className="aspect-square overflow-hidden rounded-[6px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`${title} ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
