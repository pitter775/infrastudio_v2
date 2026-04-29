import { normalizeText, singularizeToken } from "@/lib/chat/text-utils"

function sanitizeString(value = "") {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => sanitizeString(item)).filter(Boolean))]
}

function normalizeLabelTokens(value = "") {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => singularizeToken(token))
    .filter((token) => token.length >= 3)
}

function resolveCatalogTypeAttributeValues(product = {}) {
  const attributes = Array.isArray(product?.atributos) ? product.atributos : []
  return attributes
    .filter((attribute) => /^(tipo|categoria|classe|linha|category)$/i.test(sanitizeString(attribute?.nome)))
    .map((attribute) => sanitizeString(attribute?.valor))
    .filter(Boolean)
}

export function resolveCatalogItemTypeCandidates(product = {}) {
  const directCandidates = uniqueStrings([
    product?.categoriaLabel,
    product?.categoryLabel,
    product?.tipo,
    product?.typeLabel,
    ...resolveCatalogTypeAttributeValues(product),
  ])

  const normalizedCandidates = directCandidates.flatMap((candidate) => {
    const tokens = normalizeLabelTokens(candidate)
    if (!tokens.length) {
      return []
    }

    return [candidate, tokens.join(" ")]
  })

  return uniqueStrings(normalizedCandidates)
}

export function buildCatalogSimilarSearchCandidates(product = {}, semanticTargetType = "") {
  const explicitTarget = sanitizeString(semanticTargetType)
  if (explicitTarget) {
    return uniqueStrings([explicitTarget, ...resolveCatalogItemTypeCandidates(product)])
  }

  return resolveCatalogItemTypeCandidates(product)
}

