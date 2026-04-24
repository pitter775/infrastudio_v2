import { buildProductSearchCandidates, shouldSearchProducts } from "@/lib/chat/sales-heuristics"
import { normalizeText } from "@/lib/chat/text-utils"

const RECENT_CATALOG_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 12

function isCatalogSnapshotFresh(context) {
  const snapshotCreatedAt = context?.catalogo?.snapshotCreatedAt
  if (!snapshotCreatedAt) {
    return true
  }

  const parsed = new Date(snapshotCreatedAt)
  if (Number.isNaN(parsed.getTime())) {
    return true
  }

  return Date.now() - parsed.getTime() <= RECENT_CATALOG_SNAPSHOT_MAX_AGE_MS
}

export function normalizeRecentCatalogProducts(context) {
  if (!isCatalogSnapshotFresh(context)) {
    return []
  }

  return Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos : []
}

export function hasRecentCatalogSnapshot(context) {
  return normalizeRecentCatalogProducts(context).length > 0
}

function productHaystack(product) {
  return normalizeText([product?.nome, product?.descricao].filter(Boolean).join(" "))
}

function normalizeCatalogMessage(message) {
  return normalizeText(message).replace(/\bdopeira\b/g, "sopeira").replace(/\bsoperia\b/g, "sopeira")
}

function resolveProductByExplicitOrder(message, products) {
  const normalized = normalizeCatalogMessage(message)
  const explicitPatterns = [
    { pattern: /\b1\b|\bum\b|\bprimeiro\b|\bprimeira\b|\bo primeiro\b|\ba primeira\b|\bo de cima\b/, index: 0 },
    { pattern: /\b2\b|\bsegundo\b|\bsegunda\b|\bo segundo\b|\ba segunda\b|\bo do meio\b/, index: 1 },
    { pattern: /\b3\b|\bterceiro\b|\bterceira\b|\bo terceiro\b|\ba terceira\b|\bo ultimo\b|\bo final\b/, index: 2 },
  ]

  const matched = explicitPatterns.find((item) => item.pattern.test(normalized))
  if (!matched) {
    return null
  }

  return products[matched.index] ? [products[matched.index]] : null
}

function resolveProductsByTitleTokens(message, products) {
  const normalized = normalizeCatalogMessage(message)
  const tokens = normalized
    .split(/\s+/)
    .filter((item) => item.length >= 4)
    .filter(
      (item) =>
        ![
          "gostei",
          "quero",
          "desse",
          "dessa",
          "esse",
          "essa",
          "mandou",
          "mostrou",
          "mostra",
          "tenho",
          "tenha",
          "quiser",
          "queria",
        ].includes(item)
    )

  if (!tokens.length) {
    return []
  }

  return products.filter((product) => {
    const haystack = productHaystack(product)
    return tokens.every((token) => haystack.includes(token))
  })
}

export function resolveRecentCatalogProductReference(message, context) {
  const products = normalizeRecentCatalogProducts(context)
  const byOrder = resolveProductByExplicitOrder(message, products)
  if (byOrder?.length) {
    return byOrder
  }

  return resolveProductsByTitleTokens(message, products)
}

export function isRecentCatalogReferenceAttempt(message) {
  return /\b(gostei|quero|esse|essa|desse|dessa|primeiro|primeira|segundo|segunda|terceiro|terceira|1|2|3)\b/i.test(
    String(message || "")
  )
}

export function isCatalogLoadMoreIntent(message) {
  return /\b(mais|outras|outros|modelos|opcoes)\b/i.test(String(message || ""))
}

export function decideCatalogFollowUpHeuristically(message, context, deps = {}) {
  const products = normalizeRecentCatalogProducts(context)
  if (!products.length) {
    return null
  }

  const matchedProducts = resolveRecentCatalogProductReference(message, context)
  if (!isRecentCatalogReferenceAttempt(message) && matchedProducts.length === 0) {
    return null
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
  if (products.length > 1) {
    return {
      kind: "recent_product_reference_unresolved",
      confidence: 0.61,
      reason: "Mensagem parece referenciar os produtos recentes, mas sem sinal textual suficiente para resolver.",
      matchedProducts: products.slice(0, 3),
      usedLlm: false,
      shouldBlockNewSearch: true,
    }
  }

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
  if (decision?.kind === "recent_product_reference_unresolved") {
    const options = Array.isArray(decision?.matchedProducts) ? decision.matchedProducts.slice(0, 3) : []

    if (options.length >= 2) {
      const lines = options.map((item, index) => `${index + 1}. ${item?.nome}`).filter(Boolean)
      return [`Quero confirmar qual voce quis dizer.`, ...lines, "Me responde com 1, 2 ou 3."].join("\n")
    }
  }

  return null
}
