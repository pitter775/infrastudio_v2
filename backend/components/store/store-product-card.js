'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react'

import { buildStoreAccentPalette, buildStoreProductHref, formatStoreCurrency, getStoreProductImages, trackStoreEvent } from '@/components/store/store-utils'

function shouldHideCategoryCode(label) {
  return /^MLB\d+$/i.test(String(label || '').trim())
}

function formatMarketplaceInstallment(price, currencyId) {
  const installmentValue = Number(price || 0) / 12
  if (!Number.isFinite(installmentValue) || installmentValue <= 0) {
    return ''
  }

  return `12x ${formatStoreCurrency(installmentValue, currencyId)}`
}

export function StoreProductCard({ storeSlug, product, accentColor, compact = false, analyticsSource = 'grid_card', variant = 'default' }) {
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
  const visibleStatusLabel = /^active$/i.test(statusLabel) ? '' : statusLabel
  const stockValue = typeof product.stock === 'number' && product.stock > 0 ? String(product.stock) : '-'
  const locationLabel = visibleCategoryLabel || 'Mercado Livre'
  const description =
    String(product.shortDescription || product.descriptionLong || '').trim() ||
    (visibleCategoryLabel
      ? `Produto publicado na categoria ${visibleCategoryLabel.toLowerCase()} com checkout final no Mercado Livre.`
      : 'Produto publicado com checkout final no Mercado Livre e atendimento direto pela loja.')
  const marketplaceInstallment = formatMarketplaceInstallment(product.price, product.currencyId)

  if (variant === 'marketplace') {
    return (
      <div className="snap-start">
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
          className="group relative flex h-full min-h-[366px] flex-col overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white text-left shadow-none transition duration-200 hover:border-[#d1d5db] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
        >
          {isOpening ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/72 backdrop-blur-[2px]">
              <div className="inline-flex items-center gap-2 rounded-[4px] bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-[0_8px_18px_rgba(0,0,0,0.12)]">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: palette.accentDark }} />
                Abrindo
              </div>
            </div>
          ) : null}

          <div className="relative h-[224px] shrink-0 overflow-hidden bg-[#f5f5f5]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" />
            ) : null}

            <div className="absolute left-2 top-2 flex max-w-[calc(100%-16px)] flex-wrap gap-1.5">
              {visibleStatusLabel ? (
                <span className="inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur" style={{ backgroundColor: `${palette.accentDark}99` }}>
                  {visibleStatusLabel}
                </span>
              ) : null}
              {visibleCategoryLabel ? (
                <span className="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur" style={{ backgroundColor: `${palette.accent}8c` }}>
                  {visibleCategoryLabel}
                </span>
              ) : null}
            </div>

            {hasGallery ? (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:scale-105 group-hover:inline-flex"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:scale-105 group-hover:inline-flex"
                  aria-label="Proxima imagem"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/15 px-2 py-1 backdrop-blur">
                  {images.map((_, index) => (
                    <span
                      key={`${product.id}-marketplace-dot-${index}`}
                      className={`rounded-full transition-all ${index === imageIndex ? 'h-2.5 w-5 bg-white' : 'h-2.5 w-2.5 bg-white/65'}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col px-3 pb-3 pt-3">
            <div className="line-clamp-2 min-h-[40px] text-[14px] font-normal leading-5 text-[#333333]">{product.title}</div>
            <div className="mt-3 flex items-start gap-0.5 text-[#333333]">
              <span className="text-[23px] font-normal leading-none">{formatStoreCurrency(product.price, product.currencyId).replace(/\s/g, ' ')}</span>
            </div>
            {marketplaceInstallment ? <div className="mt-1 text-[12px] leading-4 text-[#333333]">{marketplaceInstallment}</div> : null}
            <div className="mt-2 text-[12px] font-semibold leading-4 text-[#00a650]">
              Frete gratis <span className="font-normal text-[#777777]">por ser sua primeira compra</span>
            </div>
          </div>
        </Link>
      </div>
    )
  }

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
