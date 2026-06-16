'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, Play, X } from 'lucide-react'

import { buildStoreAccentPalette, buildStoreProductHref, formatStoreCurrency, formatStoreInstallmentText, getStoreProductImages, getStoreProductVideos, trackStoreEvent } from '@/components/store/store-utils'

const MAX_IMAGE_RETRIES = 8
const liveImagesByProductRef = new Map()
const pendingLiveImageRequests = new Map()
const imageProbeBySrc = new Map()
const pendingImageProbeBySrc = new Map()

function isImageDebugEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('debugImages') === '1' || window.localStorage.getItem('infrastudio-store-image-debug') === '1'
  } catch {
    return false
  }
}

function logStoreImageDebug(event, details = {}) {
  if (!isImageDebugEnabled()) {
    return
  }

  console.info('[store-image-debug]', event, details)
}

function shouldHideCategoryCode(label) {
  return /^MLB\d+$/i.test(String(label || '').trim())
}

function buildRetriedImageSrc(src, retryCount = 0) {
  const value = String(src || '').trim()
  if (!value || retryCount <= 0) {
    return value
  }

  const separator = value.includes('?') ? '&' : '?'
  return `${value}${separator}_ml_retry=${retryCount}`
}

function buildProductRef(product) {
  const itemId = String(product?.itemId || product?.id || '').trim()
  const slug = String(product?.slug || product?.title || '').trim()
  return itemId ? `${itemId}${slug ? `-${slug}` : ''}` : slug
}

function ProductVideoDialog({ onClose, product, video }) {
  if (!video) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Vídeo de ${product?.title || 'produto'}`}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[8px] bg-black shadow-[0_28px_70px_-28px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-sm transition hover:bg-white"
          aria-label="Fechar vídeo"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="aspect-video w-full bg-black">
          {video.embedUrl ? (
            <iframe
              src={video.embedUrl}
              title={`Vídeo de ${product?.title || 'produto'}`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video src={video.url} poster={video.thumbnail || undefined} controls autoPlay className="h-full w-full object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}

export function StoreProductCard({ store, storeSlug, product, accentColor, compact = false, analyticsSource = 'grid_card', variant = 'default' }) {
  const resolvedStoreSlug = storeSlug || store?.slug
  const href = buildStoreProductHref(store || resolvedStoreSlug, product)
  const [recoveredImages, setRecoveredImages] = useState([])
  const rawImages = recoveredImages.length ? recoveredImages : getStoreProductImages(product)
  const videos = getStoreProductVideos(product)
  const [imageIndex, setImageIndex] = useState(0)
  const [imageRetries, setImageRetries] = useState({})
  const retryTimersRef = useRef(new Map())
  const [isOpening, setIsOpening] = useState(false)
  const [activeVideo, setActiveVideo] = useState(null)
  const images = rawImages
  const palette = buildStoreAccentPalette(accentColor)
  const safeImageIndex = imageIndex >= images.length ? 0 : imageIndex
  const image = images[safeImageIndex] || images[0] || ''
  const imageRetryCount = imageRetries[image] || 0
  const imageSrc = buildRetriedImageSrc(image, imageRetryCount)
  const hasGallery = images.length > 1
  const hasVideo = videos.length > 0
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
  const marketplaceInstallment = formatStoreInstallmentText(product)

  useEffect(() => {
    retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    retryTimersRef.current.clear()
    setImageIndex(0)
    setImageRetries({})
    setRecoveredImages([])
  }, [product?.id])

  useEffect(() => {
    return () => {
      retryTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      retryTimersRef.current.clear()
    }
  }, [])

  function clearImageRetry(src) {
    const value = String(src || '').trim()
    if (!value || !retryTimersRef.current.has(value)) {
      return
    }

    window.clearTimeout(retryTimersRef.current.get(value))
    retryTimersRef.current.delete(value)
  }

  function buildImageDebugPayload(src, extra = {}) {
    return {
      productId: product?.itemId || product?.id || null,
      productSlug: product?.slug || null,
      productTitle: product?.title || null,
      storeSlug: resolvedStoreSlug || null,
      src,
      retryCount: imageRetries[src] || 0,
      snapshotImages: getStoreProductImages(product),
      recoveredImages,
      ...extra,
    }
  }

  function moveToNextImage(src) {
    if (images.length <= 1) {
      return
    }

    const currentIndex = images.findIndex((item) => item === src)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % images.length : 0
    setImageIndex(nextIndex)
  }

  async function probeMercadoLivreImage(src, slot) {
    const value = String(src || '').trim()
    if (!value || !/mlstatic\.com/i.test(value)) {
      return null
    }

    if (imageProbeBySrc.has(value)) {
      return imageProbeBySrc.get(value)
    }

    if (pendingImageProbeBySrc.has(value)) {
      return pendingImageProbeBySrc.get(value)
    }

    const request = fetch(`/api/public/mercado-livre/image-probe?url=${encodeURIComponent(value)}`, {
      cache: 'force-cache',
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        imageProbeBySrc.set(value, payload)
        return payload
      })
      .finally(() => {
        pendingImageProbeBySrc.delete(value)
      })

    pendingImageProbeBySrc.set(value, request)
    logStoreImageDebug('probe_started', buildImageDebugPayload(value, { slot }))
    return request
  }

  async function handleLoadedImageProbe(src, slot) {
    const probe = await probeMercadoLivreImage(src, slot).catch(() => null)
    if (!probe) {
      return
    }

    logStoreImageDebug('probe_response', buildImageDebugPayload(src, {
      slot,
      probe,
    }))

    if (probe.placeholder === true) {
      logStoreImageDebug('placeholder_detected', buildImageDebugPayload(src, {
        slot,
        probe,
      }))
      moveToNextImage(src)
      refreshLiveImages()
    }
  }

  function handleImageLoad(src, event, slot) {
    clearImageRetry(src)
    const target = event?.currentTarget
    logStoreImageDebug('load', buildImageDebugPayload(src, {
      slot,
      renderedSrc: target?.currentSrc || target?.src || '',
      naturalWidth: target?.naturalWidth || 0,
      naturalHeight: target?.naturalHeight || 0,
    }))
    if (slot === 'cover') {
      handleLoadedImageProbe(src, slot)
    }
  }

  function retryImage(src, slot) {
    if (!src) {
      return
    }

    const currentCount = imageRetries[src] || 0
    if (currentCount >= MAX_IMAGE_RETRIES || retryTimersRef.current.has(src)) {
      logStoreImageDebug('retry_skipped', buildImageDebugPayload(src, {
        slot,
        reason: currentCount >= MAX_IMAGE_RETRIES ? 'max_retries' : 'pending_timer',
      }))
      return
    }

    const retryDelay = Math.min(800 * 2 ** currentCount, 30000)
    logStoreImageDebug('error_retry_scheduled', buildImageDebugPayload(src, {
      slot,
      nextRetryCount: currentCount + 1,
      retryDelay,
    }))
    const timer = window.setTimeout(() => {
      retryTimersRef.current.delete(src)
      setImageRetries((current) => ({
        ...current,
        [src]: (current[src] || 0) + 1,
      }))
    }, retryDelay)
    retryTimersRef.current.set(src, timer)
    refreshLiveImages()
  }

  async function refreshLiveImages() {
    const productRef = buildProductRef(product)
    const cacheKey = `${resolvedStoreSlug}:${productRef}`
    if (!resolvedStoreSlug || !productRef) {
      return
    }

    const cachedImages = liveImagesByProductRef.get(cacheKey)
    if (cachedImages?.length) {
      logStoreImageDebug('live_images_cache_hit', buildImageDebugPayload(image, {
        productRef,
        liveImages: cachedImages,
      }))
      setRecoveredImages(cachedImages)
      setImageRetries({})
      setImageIndex(0)
      return
    }

    if (pendingLiveImageRequests.has(cacheKey)) {
      logStoreImageDebug('live_images_request_joined', buildImageDebugPayload(image, { productRef }))
      const pendingImages = await pendingLiveImageRequests.get(cacheKey).catch(() => [])
      if (pendingImages.length) {
        setRecoveredImages(pendingImages)
        setImageRetries({})
        setImageIndex(0)
      }
      return
    }

    logStoreImageDebug('live_images_request_started', buildImageDebugPayload(image, { productRef }))
    const request = fetch(`/api/loja/${encodeURIComponent(resolvedStoreSlug)}/produto/${encodeURIComponent(productRef)}?forceLiveDetails=1`, {
      cache: 'no-store',
    })
      .then((response) => response.json().then((payload) => ({ response, payload })).catch(() => ({ response, payload: {} })))
      .then(({ response, payload }) => {
        const nextImages = response.ok ? getStoreProductImages(payload?.product) : []
        logStoreImageDebug('live_images_response', buildImageDebugPayload(image, {
          productRef,
          ok: response.ok,
          status: response.status,
          liveProductId: payload?.product?.itemId || payload?.product?.id || null,
          liveImages: nextImages,
        }))
        if (nextImages.length) {
          liveImagesByProductRef.set(cacheKey, nextImages)
        }
        return nextImages
      })
      .finally(() => {
        pendingLiveImageRequests.delete(cacheKey)
      })

    pendingLiveImageRequests.set(cacheKey, request)
    const nextImages = await request.catch(() => [])
    if (nextImages.length) {
      setRecoveredImages(nextImages)
      setImageRetries({})
      setImageIndex(0)
    }
  }

  function openVideo(event) {
    event.preventDefault()
    event.stopPropagation()
    setActiveVideo(videos[0] || null)
  }

  if (variant === 'marketplace') {
    return (
      <div className="snap-start relative">
        {hasVideo ? (
          <button
            type="button"
            onClick={openVideo}
            className="absolute left-1 top-1 z-20 inline-flex items-center gap-1 rounded-[3px] bg-slate-950/82 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur-md transition hover:bg-slate-900"
            aria-label="Abrir vídeo do produto"
          >
            <Play className="h-2.5 w-2.5 fill-current" />
            Vídeo
          </button>
        ) : null}
        <Link
          href={href}
          onClick={() => {
            setIsOpening(true)
            trackStoreEvent({
              storeSlug: resolvedStoreSlug,
              type: 'product_open',
              source: analyticsSource,
              product,
              dedupeKey: `${resolvedStoreSlug}:product_open:${analyticsSource}:${product.slug}`,
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

          <div className="relative h-[224px] shrink-0 overflow-hidden bg-white p-[5px]">
            {image ? (
              <Image
                key={imageSrc}
                src={imageSrc}
                alt={product.title}
                fill
                sizes="(min-width: 1024px) 280px, 50vw"
                unoptimized
                className="h-full w-full rounded-[4px] bg-white object-contain transition duration-300 group-hover:scale-[1.02]"
                onError={() => retryImage(image, 'cover')}
                onLoad={(event) => handleImageLoad(image, event, 'cover')}
              />
            ) : null}

            <div className="absolute left-1 top-1 flex max-w-[calc(100%-8px)] flex-wrap gap-1">
              {visibleCategoryLabel ? (
                <span className={hasVideo ? 'ml-[52px] inline-flex max-w-full truncate rounded-[3px] px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur-md' : 'inline-flex max-w-full truncate rounded-[3px] px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur-md'} style={{ backgroundColor: `${palette.accentDark}d9` }}>
                  {visibleCategoryLabel}
                </span>
              ) : null}
              {!visibleCategoryLabel && visibleStatusLabel ? (
                <span className="inline-flex rounded-[3px] px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white backdrop-blur-md" style={{ backgroundColor: `${palette.accentDark}d9` }}>
                  {visibleStatusLabel}
                </span>
              ) : null}
            </div>

            {hasGallery ? (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/34 text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0.10)] backdrop-blur-md transition hover:scale-105 hover:bg-white/48 group-hover:inline-flex"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/34 text-slate-900 shadow-[0_4px_12px_rgba(0,0,0,0.10)] backdrop-blur-md transition hover:scale-105 hover:bg-white/48 group-hover:inline-flex"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-2 right-2 grid grid-cols-5 gap-1 overflow-hidden rounded-[4px] bg-white/42 p-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-md">
                  {images.slice(0, 5).map((thumbnail, index) => (
                    <button
                      type="button"
                      key={`${product.id}-marketplace-thumb-${index}`}
                      onClick={(event) => showImage(event, index)}
                      className="relative aspect-square min-w-0 overflow-hidden rounded-[3px] bg-white"
                      aria-label={`Ver imagem ${index + 1}`}
                    >
                      <Image
                        key={buildRetriedImageSrc(thumbnail, imageRetries[thumbnail] || 0)}
                        src={buildRetriedImageSrc(thumbnail, imageRetries[thumbnail] || 0)}
                        alt={`${product.title} ${index + 1}`}
                        fill
                        sizes="48px"
                        unoptimized
                        className="h-full w-full object-cover"
                        onError={() => retryImage(thumbnail, `thumbnail_${index}`)}
                        onLoad={(event) => handleImageLoad(thumbnail, event, `thumbnail_${index}`)}
                      />
                      <span
                        className="pointer-events-none absolute inset-0 rounded-[3px] border-2"
                        style={{ borderColor: index === safeImageIndex ? palette.accentDark : 'transparent' }}
                      />
                    </button>
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
              Frete grátis <span className="font-normal text-[#777777]">por ser sua primeira compra</span>
            </div>
          </div>
        </Link>
        <ProductVideoDialog video={activeVideo} product={product} onClose={() => setActiveVideo(null)} />
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

  function showImage(event, index) {
    event.preventDefault()
    event.stopPropagation()
    setImageIndex(index)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {hasVideo ? (
        <button
          type="button"
          onClick={openVideo}
          className="absolute left-1 top-1 z-20 inline-flex items-center gap-1 rounded-[3px] bg-slate-950/82 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur-md transition hover:bg-slate-900"
          aria-label="Abrir vídeo do produto"
        >
          <Play className="h-2.5 w-2.5 fill-current" />
          Vídeo
        </button>
      ) : null}
      <Link
        href={href}
        onClick={() => {
          setIsOpening(true)
          trackStoreEvent({
            storeSlug: resolvedStoreSlug,
            type: 'product_open',
            source: analyticsSource,
            product,
            dedupeKey: `${resolvedStoreSlug}:product_open:${analyticsSource}:${product.slug}`,
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
            <Image
              key={imageSrc}
              src={imageSrc}
              alt={product.title}
              fill
              sizes={compact ? "(min-width: 1024px) 260px, 50vw" : "(min-width: 1024px) 360px, 100vw"}
              unoptimized
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
              onError={() => retryImage(image, 'cover')}
              onLoad={(event) => handleImageLoad(image, event, 'cover')}
            />
          ) : null}

          <div className="absolute left-1 top-1 flex max-w-[calc(100%-8px)] flex-wrap gap-1">
            {visibleCategoryLabel ? (
              <span className={hasVideo ? 'ml-[52px] inline-flex max-w-full truncate rounded-[3px] px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur-md' : 'inline-flex max-w-full truncate rounded-[3px] px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white shadow-[0_4px_10px_rgba(15,23,42,0.12)] backdrop-blur-md'} style={{ backgroundColor: `${palette.accentDark}d9` }}>
                {visibleCategoryLabel}
              </span>
            ) : null}
            {!visibleCategoryLabel && statusLabel ? (
              <span className="inline-flex rounded-[3px] px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-[0.08em] text-white backdrop-blur-md" style={{ backgroundColor: `${palette.accentDark}d9` }}>
                {statusLabel}
              </span>
            ) : null}
          </div>

          {hasGallery ? (
            <>
              <button
                type="button"
                onClick={showPreviousImage}
                className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/34 text-slate-900 shadow-[0_16px_32px_-18px_rgba(15,23,42,0.20)] backdrop-blur-md transition hover:scale-105 hover:bg-white/48"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={showNextImage}
                className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/34 text-slate-900 shadow-[0_16px_32px_-18px_rgba(15,23,42,0.20)] backdrop-blur-md transition hover:scale-105 hover:bg-white/48"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-3 right-3 grid grid-cols-5 gap-1.5 overflow-hidden rounded-[6px] bg-white/42 p-1.5 shadow-[0_10px_20px_-14px_rgba(15,23,42,0.24)] backdrop-blur-md">
                {images.slice(0, 5).map((thumbnail, index) => (
                  <button
                    type="button"
                    key={`${product.id}-thumb-${index}`}
                    onClick={(event) => showImage(event, index)}
                    className="relative aspect-square min-w-0 overflow-hidden rounded-[4px] bg-white"
                    aria-label={`Ver imagem ${index + 1}`}
                  >
                    <Image
                      key={buildRetriedImageSrc(thumbnail, imageRetries[thumbnail] || 0)}
                      src={buildRetriedImageSrc(thumbnail, imageRetries[thumbnail] || 0)}
                      alt={`${product.title} ${index + 1}`}
                      fill
                      sizes="72px"
                      unoptimized
                      className="h-full w-full object-cover"
                      onError={() => retryImage(thumbnail, `thumbnail_${index}`)}
                      onLoad={(event) => handleImageLoad(thumbnail, event, `thumbnail_${index}`)}
                    />
                    <span
                      className="pointer-events-none absolute inset-0 rounded-[4px] border-2"
                      style={{ borderColor: index === safeImageIndex ? palette.accentDark : 'transparent' }}
                    />
                  </button>
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
              <Image src="/icomercado.png" alt="" width={20} height={16} className="h-4 w-5 object-contain" />
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
      <ProductVideoDialog video={activeVideo} product={product} onClose={() => setActiveVideo(null)} />
    </motion.div>
  )
}
