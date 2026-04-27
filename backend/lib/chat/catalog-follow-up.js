import { buildProductSearchCandidates, shouldSearchProducts } from "@/lib/chat/sales-heuristics"
import { normalizeText } from "@/lib/chat/text-utils"

const RECENT_CATALOG_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 12
const REFINEMENT_STOPWORDS = new Set([
  "gostei",
  "quero",
  "queria",
  "desse",
  "dessa",
  "esse",
  "essa",
  "me",
  "fala",
  "falar",
  "mais",
  "sobre",
  "dele",
  "dela",
  "dele",
  "manda",
  "mostra",
  "mostrar",
  "detalhes",
  "detalhe",
  "informacao",
  "informacoes",
  "produto",
  "produtos",
  "item",
  "itens",
  "quais",
  "qual",
  "tem",
  "com",
  "sem",
  "para",
  "pra",
  "por",
  "uma",
  "uns",
  "umas",
  "dos",
  "das",
  "nos",
  "nas",
])
const REFINEMENT_HINT_PATTERN =
  /\b(inox|vidro|cristal|porcelana|ceramica|madeira|metal|prata|bronze|dourado|azul|verde|amarelo|preto|branco|bege|rosa|redondo|quadrado|grande|pequeno|moderno|antigo|vintage|rustico|industrial|material|cor|modelo|acabamento|estilo)\b/
const REFINEMENT_SEARCH_PATTERN =
  /\b(quero|queria|procuro|busco|preciso|tem|com|sem|de|na cor|material|modelo|estilo|acabamento)\b/

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

function extractCatalogMessageTokens(message) {
  return normalizeCatalogMessage(message)
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !REFINEMENT_STOPWORDS.has(token))
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
  const normalized = normalizeCatalogMessage(message)
  return /\b(mais|outras|outros|modelos|opcoes)\b/.test(normalized) ||
    /\b(manda|mande|envia|envie|mostra|mostre|traz|traga)\b[\s\S]{0,40}\btiver(?:em)?\b/.test(normalized) ||
    /\b(o que tiver|oq tiver|q tiver|qualquer um|qualquer coisa)\b/.test(normalized)
}

export function detectCatalogSearchRefinement(message, context, deps = {}) {
  const products = normalizeRecentCatalogProducts(context)
  if (!products.length) {
    return null
  }

  const normalized = normalizeCatalogMessage(message)
  const searchRequested = (deps.shouldSearchProducts ?? shouldSearchProducts)(message)
  const searchCandidates = (deps.buildProductSearchCandidates ?? buildProductSearchCandidates)(message)
  const messageTokens = extractCatalogMessageTokens(message)

  if (!messageTokens.length || (!searchRequested && !REFINEMENT_HINT_PATTERN.test(normalized) && !REFINEMENT_SEARCH_PATTERN.test(normalized))) {
    return null
  }

  const uncoveredTokens = messageTokens.filter((token) => !products.some((product) => productHaystack(product).includes(token)))
  if (!uncoveredTokens.length) {
    return null
  }

  return {
    kind: "catalog_search_refinement",
    confidence: 0.8,
    reason: "Mensagem adiciona filtros novos fora da ultima lista mostrada.",
    matchedProducts: [],
    searchCandidates,
    uncoveredTokens,
    usedLlm: false,
    shouldBlockNewSearch: false,
  }
}

export function decideCatalogFollowUpHeuristically(message, context, deps = {}) {
  const products = normalizeRecentCatalogProducts(context)
  if (!products.length) {
    return null
  }

  const refinementDecision = detectCatalogSearchRefinement(message, context, deps)
  if (refinementDecision) {
    return refinementDecision
  }

  const candidates = (deps.buildProductSearchCandidates ?? buildProductSearchCandidates)(message)
  const search = (deps.shouldSearchProducts ?? shouldSearchProducts)(message)
  if (isCatalogLoadMoreIntent(message)) {
    return {
      kind: "catalog_search",
      confidence: 0.7,
      reason: "Mensagem pede nova busca ou mais opcoes de catalogo.",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: false,
    }
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

  if (products.length > 1) {
    if (search && candidates.length) {
      return {
        kind: "catalog_search",
        confidence: 0.65,
        reason: "Mensagem parece nova busca de catalogo.",
        matchedProducts: [],
        usedLlm: false,
        shouldBlockNewSearch: false,
      }
    }

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
