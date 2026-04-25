export function formatStoreCurrency(price, currencyId = 'BRL') {
  return Number(price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currencyId || 'BRL',
  })
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
