const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com"
const MERCADO_LIVRE_RESOLVE_MAX_ATTEMPTS = 4
const MERCADO_LIVRE_RESOLVE_DELAY_MS = 1500

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractMercadoLivreProductId(value) {
  const normalized = sanitizeString(value)
  const match = normalized.match(/MLB-?(\d+)/i)
  return match ? `MLB${match[1]}` : ""
}

function detectMercadoLivreSourceType(value) {
  const normalized = sanitizeString(value).toLowerCase()
  if (normalized.includes("/pagina/")) {
    return "store_page"
  }
  if (extractMercadoLivreProductId(normalized)) {
    return "product_page"
  }
  return "unknown"
}

function extractMercadoLivreSellerId(value) {
  const normalized = sanitizeString(value)
  const patterns = [
    /(?:seller_id|sellerId|official_store_id)=([^&]+)/i,
    /"seller_id"\s*:\s*"?(?<value>\d+)"?/i,
    /"sellerId"\s*:\s*"?(?<value>\d+)"?/i,
    /"official_store_id"\s*:\s*"?(?<value>\d+)"?/i,
    /seller_id["'\s:=]+(\d+)/i,
    /sellerId["'\s:=]+(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = sanitizeString(match?.groups?.value || match?.[1])
    if (candidate) {
      return candidate
    }
  }

  return ""
}

function extractMercadoLivreStoreName(value) {
  const normalized = sanitizeString(value)
  const patterns = [
    /"shop_name"\s*:\s*"(?<value>[^"]+)"/i,
    /"seller_name"\s*:\s*"(?<value>[^"]+)"/i,
    /<meta\s+name="title"\s+content="(?<value>[^"]+?)\s+em\s+Mercado\s+Livre"/i,
    /<meta\s+property="og:title"\s+content="(?<value>[^"]+?)\s+em\s+Mercado\s+Livre"/i,
    /<title[^>]*>(?<value>[^<|]+?)\s+\|\s+P[aÃ¡]gina do vendedor<\/title>/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = sanitizeString(match?.groups?.value || match?.[1])
    if (candidate) {
      return candidate
    }
  }

  return ""
}

function mapMercadoLivreResolvedProduct(payload, fallback = {}) {
  return {
    seedId: sanitizeString(payload?.seller_id || payload?.sellerId || payload?.official_store_id || fallback.seedId),
    productId: sanitizeString(payload?.id || fallback.productId),
    storeName: sanitizeString(payload?.seller_custom_field || payload?.seller_name || payload?.nickname || fallback.storeName),
    title: sanitizeString(payload?.title || fallback.title),
    permalink: sanitizeString(payload?.permalink || fallback.permalink),
    sourceType: sanitizeString(fallback.sourceType || "unknown"),
    source: sanitizeString(fallback.source || "api"),
  }
}

async function fetchMercadoLivrePublicItem(itemId, fetchImpl = fetch) {
  const response = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/items/${encodeURIComponent(itemId)}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.id) {
    return null
  }

  return payload
}

async function fetchMercadoLivrePageSource(productUrl, fetchImpl = fetch) {
  const response = await fetchImpl(productUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return ""
  }

  return response.text().catch(() => "")
}

export async function resolveMercadoLivreProductInternal(productUrl, deps = {}) {
  const normalizedUrl = sanitizeString(productUrl)
  if (!normalizedUrl) {
    return { product: null, error: "Cole a URL de um produto da loja." }
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const sellerIdFromUrl = extractMercadoLivreSellerId(normalizedUrl)
  const productId = extractMercadoLivreProductId(normalizedUrl)
  const sourceType = detectMercadoLivreSourceType(normalizedUrl)
  let pageSource = ""

  async function getPageSource() {
    if (!pageSource) {
      pageSource = await fetchMercadoLivrePageSource(normalizedUrl, fetchImpl)
    }
    return pageSource
  }

  if (productId) {
    const itemPayload = await fetchMercadoLivrePublicItem(productId, fetchImpl)
    const initialStoreName = extractMercadoLivreStoreName(await getPageSource())
    const resolvedFromApi = mapMercadoLivreResolvedProduct(itemPayload, {
      seedId: sellerIdFromUrl,
      productId,
      storeName: initialStoreName,
      permalink: normalizedUrl,
      sourceType,
      source: initialStoreName ? "api_html" : "api",
    })

    if (resolvedFromApi.seedId) {
      return { product: resolvedFromApi, error: null }
    }
  }

  if (sellerIdFromUrl) {
    const storeName = extractMercadoLivreStoreName(await getPageSource())
    return {
      product: {
        seedId: sellerIdFromUrl,
        productId,
        storeName,
        title: "",
        permalink: normalizedUrl,
        sourceType,
        source: storeName ? "url_html" : "url",
      },
      error: null,
    }
  }

  for (let attempt = 0; attempt < MERCADO_LIVRE_RESOLVE_MAX_ATTEMPTS; attempt += 1) {
    const source =
      attempt === 0 && pageSource
        ? pageSource
        : await fetchMercadoLivrePageSource(normalizedUrl, fetchImpl)
    if (!pageSource && source) {
      pageSource = source
    }
    const sellerId = extractMercadoLivreSellerId(source)
    const storeName = extractMercadoLivreStoreName(source)

    if (sellerId || storeName) {
      return {
        product: {
          seedId: sellerId,
          productId: extractMercadoLivreProductId(source) || productId,
          storeName,
          title: "",
          permalink: normalizedUrl,
          sourceType,
          source: attempt === 0 ? "html" : "html_retry",
        },
        error: null,
      }
    }

    if (attempt < MERCADO_LIVRE_RESOLVE_MAX_ATTEMPTS - 1) {
      await sleep(MERCADO_LIVRE_RESOLVE_DELAY_MS)
    }
  }

  return {
    product: {
      seedId: "",
      productId,
      storeName: "",
      title: "",
      permalink: normalizedUrl,
      sourceType,
      source: "",
    },
    error: "Nao foi possivel localizar o seller_id automaticamente. Preencha manualmente.",
  }
}
