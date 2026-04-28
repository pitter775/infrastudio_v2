export function formatStoreCurrency(price, currencyId = 'BRL') {
  return Number(price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currencyId || 'BRL',
  })
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

export function getStoreProductImages(product) {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : []
  if (images.length) {
    return images
  }

  return product?.thumbnail ? [product.thumbnail] : []
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
