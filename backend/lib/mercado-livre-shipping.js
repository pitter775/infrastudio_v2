import "server-only"

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com"

function sanitizeText(value, max = 0) {
  const normalized = String(value || "").trim()
  return max > 0 ? normalized.slice(0, max) : normalized
}

function normalizeZipCode(value) {
  return sanitizeText(value, 16).replace(/\D/g, "").slice(0, 8)
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeDeliveryTime(option) {
  const estimated = option?.estimated_delivery_time || option?.estimatedDeliveryTime || {}
  const min = toNumber(estimated?.shipping, 0) || toNumber(estimated?.handling, 0)
  const max = toNumber(estimated?.unit === "hour" ? estimated?.offset?.date : estimated?.shipping, 0)
  const unit = sanitizeText(estimated?.unit, 24)

  if (unit === "hour" && min > 0) {
    return min <= 24 ? "Até 1 dia útil" : `${Math.ceil(min / 24)} dias úteis`
  }

  if (min > 0 && max > min) {
    return `${min} a ${max} dias úteis`
  }

  if (min > 0) {
    return `${min} dias úteis`
  }

  return ""
}

function normalizeShippingOption(option, index) {
  const cost = option?.cost ?? option?.list_cost ?? option?.base_cost ?? 0
  const id = sanitizeText(option?.id || option?.shipping_method_id || option?.name || `option-${index}`, 80)
  const name = sanitizeText(option?.name || option?.shipping_method_name || option?.display_name, 120) || "Envio"

  if (!id) {
    return null
  }

  return {
    id,
    name,
    amount: toNumber(cost),
    currencyId: sanitizeText(option?.currency_id || option?.currencyId || "BRL", 12) || "BRL",
    estimatedDeliveryTime: normalizeDeliveryTime(option),
    rawSummary: {
      mode: sanitizeText(option?.mode, 40),
      logisticType: sanitizeText(option?.logistic_type, 60),
      freeShipping: option?.free_shipping === true,
    },
  }
}

export async function calculateMercadoLivreShippingOptions(input = {}, deps = {}) {
  const itemId = sanitizeText(input.itemId, 80)
  const zipCode = normalizeZipCode(input.zipCode)

  if (!itemId) {
    return { options: [], error: "Produto do Mercado Livre não informado." }
  }

  if (zipCode.length !== 8) {
    return { options: [], error: "Informe um CEP válido para calcular o frete." }
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const url = new URL(`${MERCADO_LIVRE_API_BASE}/items/${encodeURIComponent(itemId)}/shipping_options`)
  url.searchParams.set("zip_code", zipCode)

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  }).catch(() => null)

  const payload = await response?.json().catch(() => ({}))

  if (!response?.ok) {
    return {
      options: [],
      error: payload?.message || payload?.error || "Não foi possível calcular o frete agora.",
    }
  }

  const rawOptions = Array.isArray(payload?.options) ? payload.options : []
  const options = rawOptions
    .map(normalizeShippingOption)
    .filter(Boolean)
    .sort((left, right) => left.amount - right.amount)
    .slice(0, 6)

  if (!options.length) {
    return { options: [], error: "Nenhuma opção de frete foi encontrada para este CEP." }
  }

  return { options, error: null }
}

export { normalizeZipCode }
