'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

import { formatStoreCurrency, getStoreProductImages, trackStoreEvent } from '@/components/store/store-utils'

export function StoreProductCard({ storeSlug, product, accentColor, onOpenSheet, compact = false, analyticsSource = 'grid_card' }) {
  const href = `/loja/${storeSlug}/produto/${product.slug}`
  const images = getStoreProductImages(product)
  const [imageIndex, setImageIndex] = useState(0)
  const image = images[imageIndex] || images[0] || ''
  const hasGallery = images.length > 1
  const statusLabel = String(product.status || '').trim()
  const categoryLabel = String(product.categoryId || '').trim()
  const stockValue = typeof product.stock === 'number' && product.stock > 0 ? String(product.stock) : '-'
  const locationLabel = categoryLabel || 'Mercado Livre'
  const description = categoryLabel
    ? `Produto publicado na categoria ${categoryLabel.toLowerCase()} com checkout final no Mercado Livre.`
    : 'Produto publicado com checkout final no Mercado Livre e atendimento direto pela loja.'

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
        onClick={(event) => {
          event.preventDefault()
          trackStoreEvent({
            storeSlug,
            type: 'product_open',
            source: analyticsSource,
            product,
            dedupeKey: `${storeSlug}:product_open:${analyticsSource}:${product.slug}`,
          })
          onOpenSheet(product.slug)
        }}
        className={
          compact
            ? 'group flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_20px_46px_-40px_rgba(15,23,42,0.2)] transition duration-300 hover:shadow-[0_30px_72px_-28px_rgba(21,94,239,0.28)]'
            : 'group flex h-full flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_22px_50px_-40px_rgba(15,23,42,0.2)] transition duration-300 hover:shadow-[0_44px_92px_-30px_rgba(21,94,239,0.26)]'
        }
      >
        <div className={compact ? 'relative aspect-[1.12/1] overflow-hidden bg-[#eef2f7]' : 'relative aspect-[1.15/1] overflow-hidden bg-[#eef2f7]'}>
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
            {categoryLabel ? (
              <span className="inline-flex rounded-[10px] bg-[#3b82f6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                {categoryLabel}
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

        <div className={compact ? 'flex min-h-[240px] flex-1 flex-col gap-4 p-5' : 'flex min-h-[260px] flex-1 flex-col gap-4 p-6'}>
          <div className="flex items-center justify-between gap-4">
            <span className={compact ? 'text-[1.45rem] font-bold leading-none' : 'text-[1.55rem] font-bold leading-none'} style={{ color: accentColor }}>
              {formatStoreCurrency(product.price, product.currencyId)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {locationLabel}
            </span>
          </div>

          <div className={compact ? 'line-clamp-2 text-[1.2rem] font-bold leading-tight tracking-[-0.025em] text-slate-950' : 'line-clamp-2 text-[1.24rem] font-bold leading-tight tracking-[-0.025em] text-slate-950'}>
            {product.title}
          </div>

          <div className="line-clamp-2 min-h-[56px] text-[15px] leading-7 text-slate-600">{description}</div>

          <div className="mt-auto grid grid-cols-[repeat(2,minmax(0,1fr))_auto] gap-3 border-t border-slate-200 pt-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</span>
              <span className="mt-1 text-sm font-bold text-slate-950">{statusLabel || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Estoque</span>
              <span className="mt-1 text-sm font-bold text-slate-950">{stockValue}</span>
            </div>
            <div className="flex items-end justify-end">
              <span className="inline-flex h-11 items-center justify-center rounded-[12px] bg-slate-950 px-5 text-sm font-bold text-white transition group-hover:-translate-y-0.5">
                Detalhes
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
