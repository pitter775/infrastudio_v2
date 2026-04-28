'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react'

import { buildStoreAccentPalette, buildStoreProductHref, formatStoreCurrency, getStoreProductImages, trackStoreEvent } from '@/components/store/store-utils'

function shouldHideCategoryCode(label) {
  return /^MLB\d+$/i.test(String(label || '').trim())
}

export function StoreProductCard({ storeSlug, product, accentColor, compact = false, analyticsSource = 'grid_card' }) {
  const href = buildStoreProductHref(storeSlug, product)
  const images = getStoreProductImages(product)
  const [imageIndex, setImageIndex] = useState(0)
  const [isOpening, setIsOpening] = useState(false)
  const palette = buildStoreAccentPalette(accentColor)
  const image = images[imageIndex] || images[0] || ''
  const hasGallery = images.length > 1
  const statusLabel = String(product.status || '').trim()
  const categoryLabel = String(product.categoryLabel || product.categoryId || '').trim()
  const visibleCategoryLabel = shouldHideCategoryCode(categoryLabel) ? '' : categoryLabel
  const stockValue = typeof product.stock === 'number' && product.stock > 0 ? String(product.stock) : '-'
  const locationLabel = visibleCategoryLabel || 'Mercado Livre'
  const description =
    String(product.shortDescription || product.descriptionLong || '').trim() ||
    (visibleCategoryLabel
      ? `Produto publicado na categoria ${visibleCategoryLabel.toLowerCase()} com checkout final no Mercado Livre.`
      : 'Produto publicado com checkout final no Mercado Livre e atendimento direto pela loja.')

  function showPreviousImage(event) {
    event.preventDefault()
    event.stopPropagation()
    setImageIndex((current) => (current - 1 + images.length) % images.length)
  }

  function showNextImage(event) {
    event.preventDefault()
    event.stopPropagation()
    setImageIndex((current) => (current + 1) % images.length)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={href}
        onClick={() => {
          setIsOpening(true)
          trackStoreEvent({
            storeSlug,
            type: 'product_open',
            source: analyticsSource,
            product,
            dedupeKey: `${storeSlug}:product_open:${analyticsSource}:${product.slug}`,
          })
        }}
        aria-busy={isOpening}
        className={
          compact
            ? 'group relative flex h-full flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_16px_30px_-28px_rgba(15,23,42,0.16)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_20px_-14px_rgba(0,0,0,0.22)]'
            : 'group relative flex h-full flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_16px_30px_-28px_rgba(15,23,42,0.16)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_20px_-14px_rgba(0,0,0,0.22)]'
        }
      >
        {isOpening ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/72 backdrop-blur-[2px]">
            <div className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.26)]">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: palette.accentDark }} />
              Abrindo
            </div>
          </div>
        ) : null}
        <div className={compact ? 'relative aspect-[1.12/1] overflow-hidden bg-[#eef2f7]' : 'relative aspect-[1.1/1] overflow-hidden bg-[#eef2f7]'}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]" />
          ) : null}

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {statusLabel ? (
              <span className="inline-flex rounded-[10px] bg-[#155eef] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                {statusLabel}
              </span>
            ) : null}
            {visibleCategoryLabel ? (
              <span className="inline-flex rounded-[10px] bg-[#3b82f6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                {visibleCategoryLabel}
              </span>
            ) : null}
          </div>

          {hasGallery ? (
            <>
              <button
                type="button"
                onClick={showPreviousImage}
                className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-900 shadow-[0_16px_32px_-18px_rgba(15,23,42,0.26)] transition hover:scale-105"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={showNextImage}
                className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-900 shadow-[0_16px_32px_-18px_rgba(15,23,42,0.26)] transition hover:scale-105"
                aria-label="Proxima imagem"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/58 px-3 py-1.5 backdrop-blur">
                {images.map((_, index) => (
                  <span
                    key={`${product.id}-dot-${index}`}
                    className={`rounded-full transition-all ${index === imageIndex ? 'h-2.5 w-5 bg-white' : 'h-2.5 w-2.5 bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className={compact ? 'flex min-h-[210px] flex-1 flex-col gap-3 p-4' : 'flex min-h-[226px] flex-1 flex-col gap-3 p-4'}>
          <div className="flex items-center justify-between gap-4">
            <span className={compact ? 'text-[1.28rem] font-bold leading-none' : 'text-[1.34rem] font-bold leading-none'} style={{ color: palette.accentDark }}>
              {formatStoreCurrency(product.price, product.currencyId)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {locationLabel}
            </span>
          </div>

          <div className={compact ? 'line-clamp-2 text-[1.02rem] font-bold leading-tight tracking-[-0.025em] text-slate-950' : 'line-clamp-2 text-[1.06rem] font-bold leading-tight tracking-[-0.025em] text-slate-950'}>
            {product.title}
          </div>

          <div className="line-clamp-2 min-h-[44px] text-[13px] leading-6 text-slate-600">{description}</div>

          <div className="mt-auto grid grid-cols-[repeat(2,minmax(0,1fr))_auto] gap-3 border-t border-slate-200 pt-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
              <span className="mt-1 text-sm font-bold text-slate-950">{statusLabel || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Estoque</span>
              <span className="mt-1 text-sm font-bold text-slate-950">{stockValue}</span>
            </div>
            <div className="flex items-end justify-end">
              <span className="inline-flex h-10 items-center justify-center rounded-[12px] px-4 text-sm font-bold text-white transition" style={{ backgroundColor: palette.accentDark }}>
                Detalhes
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
