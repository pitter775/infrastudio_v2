export function formatStoreCurrency(price, currencyId = 'BRL') {
  return Number(price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currencyId || 'BRL',
  })
}

export function formatStoreInstallmentText(product, fallbackQuantity = 12) {
  const quantity = Number(product?.installmentQuantity ?? 0) || Number(fallbackQuantity ?? 0) || 0
  const amount = Number(product?.installmentAmount ?? 0) || Number(product?.price ?? 0) / quantity
  if (quantity <= 1 || !Number.isFinite(amount) || amount <= 0) {
    return ''
  }

  return `${quantity}x ${formatStoreCurrency(amount, product?.currencyId)}`
}

function normalizeHexColor(value, fallback = '#155eef') {
  const input = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(input)) {
    return input
  }
  if (/^#[0-9a-f]{3}$/i.test(input)) {
    return `#${input.slice(1).split('').map((char) => char + char).join('')}`
  }
  return fallback
}

function mixHexColors(primary, secondary, ratio) {
  const from = normalizeHexColor(primary).slice(1)
  const to = normalizeHexColor(secondary).slice(1)
  const weight = Math.max(0, Math.min(1, ratio))

  const channels = [0, 2, 4].map((index) => {
    const fromValue = Number.parseInt(from.slice(index, index + 2), 16)
    const toValue = Number.parseInt(to.slice(index, index + 2), 16)
    return Math.round(fromValue * (1 - weight) + toValue * weight)
  })

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function buildStoreAccentPalette(accentColor) {
  const accent = normalizeHexColor(accentColor)
  return {
    accent,
    accentDark: mixHexColors(accent, '#020617', 0.28),
    accentSoft: mixHexColors(accent, '#ffffff', 0.82),
    accentMuted: mixHexColors(accent, '#ffffff', 0.9),
    accentBorder: mixHexColors(accent, '#e2e8f0', 0.6),
    accentShadow: mixHexColors(accent, '#0f172a', 0.45),
  }
}

function getStoreAnalyticsSessionId() {
  if (typeof window === 'undefined') {
    return null
  }

  const storageKey = 'infrastudio-store-analytics-session'

  try {
    const current = window.sessionStorage.getItem(storageKey)
    if (current) {
      return current
    }

    const nextValue = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.sessionStorage.setItem(storageKey, nextValue)
    return nextValue
  } catch {
    return null
  }
}

function shouldSkipStoreAnalyticsEvent(dedupeKey) {
  if (typeof window === 'undefined' || !dedupeKey) {
    return false
  }

  try {
    const storageKey = `infrastudio-store-event:${dedupeKey}`
    if (window.sessionStorage.getItem(storageKey)) {
      return true
    }
    window.sessionStorage.setItem(storageKey, '1')
    return false
  } catch {
    return false
  }
}

export function trackStoreEvent({ storeSlug, type, source = null, product = null, dedupeKey = null }) {
  if (typeof window === 'undefined' || !storeSlug || !type) {
    return
  }

  if (shouldSkipStoreAnalyticsEvent(dedupeKey)) {
    return
  }

  const payload = {
    type,
    source,
    sessionId: getStoreAnalyticsSessionId(),
    productSlug: product?.slug || null,
    mlItemId: product?.mlItemId || product?.id || null,
  }

  const url = `/api/loja/${storeSlug}/eventos`

  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }

    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

function getMercadoLivreImageVariant(value, variant = 'O') {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  return normalized.replace(/-([A-Z])(\.(jpg|jpeg|png|webp)(\?.*)?)$/i, `-${variant}$2`)
}

export function getStoreProductImages(product, options = {}) {
  const variant = options?.variant || ''
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : []
  if (images.length) {
    return variant ? images.map((image) => getMercadoLivreImageVariant(image, variant)).filter(Boolean) : images
  }

  const fallback = product?.thumbnail ? [product.thumbnail] : []
  return variant ? fallback.map((image) => getMercadoLivreImageVariant(image, variant)).filter(Boolean) : fallback
}

function getYoutubeVideoId(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  const match = normalized.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i)
  return match?.[1] || (/^[A-Za-z0-9_-]{6,}$/.test(normalized) ? normalized : '')
}

function normalizeStoreProductVideo(video) {
  const source = video && typeof video === 'object' && !Array.isArray(video) ? video : { id: video }
  const url = String(source.url || source.secure_url || source.permalink || '').trim()
  const id = String(source.id || source.video_id || source.videoId || source.youtubeId || source.youtube_id || getYoutubeVideoId(url)).trim()
  const thumbnail = String(source.thumbnail || source.thumbnail_url || source.picture_url || '').trim()

  if (!id && !url) {
    return null
  }

  const youtubeId = getYoutubeVideoId(id || url)
  return {
    id: id || youtubeId || url,
    url,
    provider: String(source.provider || (youtubeId ? 'youtube' : 'video')).trim(),
    thumbnail: thumbnail || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : ''),
    embedUrl: youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : '',
  }
}

export function getStoreProductVideos(product) {
  const candidates = [
    ...(Array.isArray(product?.videos) ? product.videos : []),
    product?.videoId,
    product?.video_id,
  ]
  const seen = new Set()
  return candidates
    .map(normalizeStoreProductVideo)
    .filter(Boolean)
    .filter((video) => {
      const key = video.id || video.url
      if (!key || seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

export function getStoreProductMedia(product, options = {}) {
  const images = getStoreProductImages(product, options).map((url, index) => ({
    type: 'image',
    id: `image-${index}-${url}`,
    url,
    thumbnail: getStoreProductImages(product)[index] || url,
  }))
  const videos = getStoreProductVideos(product).map((video, index) => ({
    type: 'video',
    id: `video-${index}-${video.id || video.url}`,
    url: video.url,
    thumbnail: video.thumbnail,
    embedUrl: video.embedUrl,
    provider: video.provider,
  }))

  if (!videos.length) {
    return images
  }

  const [coverImage, ...remainingImages] = images
  return [coverImage, ...videos, ...remainingImages].filter(Boolean)
}

export function openStoreChat(widget) {
  if (typeof window === 'undefined') {
    return
  }

  const detail =
    widget && typeof widget === 'object'
      ? {
          widgetId: widget.widgetId || widget.id || null,
          widgetSlug: widget.widgetSlug || widget.slug || null,
        }
      : {
          widgetId: null,
          widgetSlug: widget || null,
        }

  window.dispatchEvent(
    new CustomEvent('infrastudio-chat:open', {
      detail,
    }),
  )
}

function getStoreSlug(storeOrSlug) {
  return typeof storeOrSlug === 'string'
    ? storeOrSlug
    : String(storeOrSlug?.slug || '').trim()
}

function getActiveStoreDomain(storeOrSlug) {
  if (!storeOrSlug || typeof storeOrSlug === 'string') {
    return ''
  }

  const domain = String(storeOrSlug.customDomain || '').trim()
  const active = storeOrSlug.customDomainActive === true && storeOrSlug.customDomainStatus === 'active'
  return active && domain ? `https://${domain}` : ''
}

function buildStoreBaseHref(storeOrSlug) {
  const customDomain = getActiveStoreDomain(storeOrSlug)
  if (customDomain) {
    return customDomain
  }

  const storeSlug = getStoreSlug(storeOrSlug)
  return storeSlug ? `/loja/${storeSlug}` : ''
}

export function buildStoreUrl(storeOrSlug, query, page, categoryId, sort) {
  const params = new URLSearchParams()
  if (query) {
    params.set('q', query)
  }
  if (page > 1) {
    params.set('page', String(page))
  }
  if (categoryId) {
    params.set('cat', categoryId)
  }
  if (sort && sort !== 'recent') {
    params.set('sort', sort)
  }

  const serialized = params.toString()
  const baseHref = buildStoreBaseHref(storeOrSlug)
  return serialized ? `${baseHref}?${serialized}` : baseHref
}

export function buildStoreProductHref(storeOrSlug, product) {
  const itemId = String(product?.itemId || product?.id || '').trim()
  const slug = String(product?.slug || product?.title || '').trim()
  const productRef = itemId ? `${itemId}${slug ? `-${slug}` : ''}` : slug
  const baseHref = buildStoreBaseHref(storeOrSlug)
  return `${baseHref}/produto/${productRef}`
}

export function navigateStoreHref(router, href, options = {}) {
  const targetHref = String(href || '').trim()
  if (!targetHref) {
    return
  }

  if (/^https?:\/\//i.test(targetHref) && typeof window !== 'undefined') {
    const targetUrl = new URL(targetHref)
    if (targetUrl.origin !== window.location.origin) {
      window.location.assign(targetHref)
      return
    }

    router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`, options)
    return
  }

  router.push(targetHref, options)
}

function slugifyMercadoLivreTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140)
}

function formatMercadoLivreItemIdForUrl(value) {
  const normalized = String(value || '').trim().toUpperCase()
  const match = normalized.match(/^MLB-?(\d+)$/)
  return match ? `MLB-${match[1]}` : normalized
}

export function buildStoreProductExternalUrl(product) {
  const permalink = String(product?.permalink || '').trim()
  if (permalink && !/internal-shop\.mercadoshops\.com\.br/i.test(permalink)) {
    return permalink
  }

  const itemId = String(product?.itemId || product?.id || '').trim()
  if (!itemId) {
    return permalink
  }

  const slug = slugifyMercadoLivreTitle(product?.title || product?.slug || '')
  const formattedItemId = formatMercadoLivreItemIdForUrl(itemId)
  return `https://produto.mercadolivre.com.br/${formattedItemId}${slug ? `-${slug}` : ''}-_JM`
}

export function buildStoreWhatsAppUrl(phone, message = '') {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    return ''
  }

  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
    digits = `55${digits}`
  }

  const text = String(message || '').trim()
  const params = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${params}`
}
