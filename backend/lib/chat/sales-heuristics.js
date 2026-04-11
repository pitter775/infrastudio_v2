import { buildSearchTokens, normalizeText } from "@/lib/chat/text-utils"

export function isGreetingOrAckMessage(message, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(message)
  return ["oi", "ola", "olá", "ok", "obrigado", "obrigada", "bom dia", "boa tarde", "boa noite"].includes(normalized)
}

export function buildProductSearchCandidates(message, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(message)
  if (!normalized || isGreetingOrAckMessage(normalized, deps)) {
    return []
  }

  const fixes = normalized.replace(/\bsoperia\b/g, "sopeira")
  const stopWords = new Set(["vc", "voce", "tem", "um", "uma", "de", "do", "da", "para", "pra", "quero", "procuro"])
  const tokens = fixes.split(/\s+/).filter((token) => token.length >= 3 && !stopWords.has(token))
  const candidate = tokens.join(" ").trim()

  return candidate ? [candidate] : []
}

export function shouldSearchProducts(message, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(message)
  return /\b(tem|produto|produtos|procuro|buscar|busca|mostra|mostrar|vende|loja|catalogo)\b/.test(normalized)
}

export function shouldContinueProductSearch(history, latestUserMessage, context, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(latestUserMessage)
  if (!normalized || deps.isGreetingOrAckMessage?.(latestUserMessage)) {
    return false
  }

  const hasCatalogSearch = Boolean(context?.catalogo?.ultimaBusca)
  const wantsMore = /\b(mais|outras|outros|modelos|opcoes)\b/.test(normalized)
  return Boolean(hasCatalogSearch && wantsMore)
}

export function shouldUseMercadoLivreConnectorFallback(history, latestUserMessage, context, deps = {}) {
  if (deps.isLikelyLeadNameReply?.(latestUserMessage, history)) {
    return false
  }

  if (!context?.catalogo?.ultimaBusca && /\b(gostei|esse|essa|desse|dessa)\b/.test(normalizeText(latestUserMessage))) {
    return false
  }

  return shouldSearchProducts(latestUserMessage, deps) || shouldContinueProductSearch(history, latestUserMessage, context, deps)
}

export function isMercadoLivreListingIntent(message, deps = {}) {
  return /\b(lista|listar|opcoes|modelos|produtos|mais)\b/.test((deps.normalizeText ?? normalizeText)(message))
}

export function buildCatalogPricingReply(product) {
  if (!product?.nome || product?.preco == null) {
    return null
  }

  return `${product.nome} esta por R$ ${Number(product.preco).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}.`
}

export function maybeAskForLeadIdentification(context) {
  return context?.lead?.nome ? null : "Como posso te chamar?"
}

export function isOutOfScopeForCatalog(message) {
  return /\b(politica|religiao|codigo|programar)\b/i.test(String(message || ""))
}

export { buildSearchTokens }
