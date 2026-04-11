import { buildProductSearchCandidates, shouldSearchProducts } from "@/lib/chat/sales-heuristics"
import { normalizeText } from "@/lib/chat/text-utils"

export function normalizeRecentCatalogProducts(context) {
  return Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos : []
}

export function hasRecentCatalogSnapshot(context) {
  return normalizeRecentCatalogProducts(context).length > 0
}

function productHaystack(product) {
  return normalizeText([product?.nome, product?.descricao].filter(Boolean).join(" "))
}

function scoreProduct(message, product) {
  const normalized = normalizeText(message).replace(/\bdopeira\b/g, "sopeira").replace(/\bsoperia\b/g, "sopeira")
  const haystack = productHaystack(product)
  let score = 0
  for (const token of normalized.split(/\s+/).filter((item) => item.length >= 4)) {
    if (haystack.includes(token)) score += 1
  }
  return score
}

export function resolveRecentCatalogProductReference(message, context) {
  const products = normalizeRecentCatalogProducts(context)
  return products.filter((product) => scoreProduct(message, product) > 0)
}

export function isRecentCatalogReferenceAttempt(message) {
  return /\b(gostei|quero|esse|essa|desse|dessa|amarelo|floral|sopeira|dopeira|soperia)\b/i.test(String(message || ""))
}

export function isCatalogLoadMoreIntent(message) {
  return /\b(mais|outras|outros|modelos|opcoes)\b/i.test(String(message || ""))
}

export function decideCatalogFollowUpHeuristically(message, context, deps = {}) {
  const products = normalizeRecentCatalogProducts(context)
  if (!products.length || !isRecentCatalogReferenceAttempt(message)) {
    return null
  }

  const matchedProducts = resolveRecentCatalogProductReference(message, context)
  if (/\bamarelo\b/i.test(normalizeText(message))) {
    const ambiguousMatches = products.filter((item) => /amarel[ao]/.test(productHaystack(item)))
    if (ambiguousMatches.length > 1) {
      return {
        kind: "recent_product_reference_ambiguous",
        confidence: 0.72,
        reason: "Mensagem referencia mais de um produto recente.",
        matchedProducts: ambiguousMatches,
        usedLlm: false,
        shouldBlockNewSearch: true,
      }
    }
  }

  if (matchedProducts.length === 1) {
    return {
      kind: "recent_product_reference",
      confidence: 0.9,
      reason: "Mensagem referencia um produto recente do catalogo.",
      matchedProducts,
      usedLlm: false,
      shouldBlockNewSearch: true,
    }
  }

  if (matchedProducts.length > 1) {
    const ambiguousMatches = matchedProducts
    return {
      kind: "recent_product_reference_ambiguous",
      confidence: 0.72,
      reason: "Mensagem referencia mais de um produto recente.",
      matchedProducts: ambiguousMatches,
      usedLlm: false,
      shouldBlockNewSearch: true,
    }
  }

  const candidates = (deps.buildProductSearchCandidates ?? buildProductSearchCandidates)(message)
  const search = (deps.shouldSearchProducts ?? shouldSearchProducts)(message)
  return search && candidates.length
    ? {
        kind: "catalog_search",
        confidence: 0.65,
        reason: "Mensagem parece nova busca de catalogo.",
        matchedProducts: [],
        usedLlm: false,
        shouldBlockNewSearch: false,
      }
    : null
}

export function resolveCatalogReferenceHeuristicReply(decision) {
  const product = decision?.matchedProducts?.[0]
  return product?.nome ? `Perfeito, vamos seguir com ${product.nome}.` : null
}
