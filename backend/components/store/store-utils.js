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

export function buildStoreUrl(storeSlug, query, page, categoryId, sort) {
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
  return serialized ? `/loja/${storeSlug}?${serialized}` : `/loja/${storeSlug}`
}

export function buildStoreProductHref(storeSlug, product) {
  const itemId = String(product?.itemId || product?.id || '').trim()
  const slug = String(product?.slug || product?.title || '').trim()
  const productRef = itemId ? `${itemId}${slug ? `-${slug}` : ''}` : slug
  return `/loja/${storeSlug}/produto/${productRef}`
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
  return `https://produto.mercadolivre.com.br/${itemId}${slug ? `-${slug}` : ''}-_JM`
}
