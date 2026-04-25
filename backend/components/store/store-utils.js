export function formatStoreCurrency(price, currencyId = 'BRL') {
  return Number(price || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currencyId || 'BRL',
  })
}

export function openStoreChat(widgetSlug) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('infrastudio-chat:open', {
      detail: {
        widgetSlug: widgetSlug || null,
      },
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
