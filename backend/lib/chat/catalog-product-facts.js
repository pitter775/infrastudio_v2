function sanitizeString(value) {
  const normalized = String(value ?? "").trim()
  return normalized || ""
}

function sanitizeNumber(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

const FACT_HINT_ALIASES = new Map([
  ["preco", "price"],
  ["valor", "price"],
  ["material", "material"],
  ["cor", "color"],
  ["acabamento", "color"],
  ["garantia", "warranty"],
  ["estoque", "stock"],
  ["disponibilidade", "stock"],
  ["frete", "shipping"],
  ["entrega", "shipping"],
  ["link", "link"],
  ["anuncio", "link"],
  ["detalhes", "details"],
  ["detalhe", "details"],
  ["descricao", "details"],
  ["dimensoes", "dimensions"],
  ["dimensao", "dimensions"],
  ["medidas", "dimensions"],
  ["medida", "dimensions"],
  ["tamanho", "dimensions"],
  ["altura", "height"],
  ["largura", "width"],
  ["comprimento", "length"],
  ["profundidade", "depth"],
  ["diametro", "diameter"],
  ["peso", "weight"],
  ["capacidade", "capacity"],
  ["peso_embalagem", "weight"],
  ["peso embalagem", "weight"],
  ["medidas_embalagem", "dimensions"],
  ["medidas embalagem", "dimensions"],
])

const FACT_SCOPE_ALIASES = new Map([
  ["product", "product"],
  ["produto", "product"],
  ["package", "package"],
  ["embalagem", "package"],
  ["shipping", "shipping"],
  ["envio", "shipping"],
  ["commercial", "commercial"],
  ["comercial", "commercial"],
  ["general", "general"],
  ["geral", "general"],
])

const COMMERCIAL_ADVICE_ALIASES = new Map([
  ["price_objection", "price_objection"],
  ["objecao_preco", "price_objection"],
  ["caro", "price_objection"],
  ["improvement_suggestion", "improvement_suggestion"],
  ["melhoria", "improvement_suggestion"],
  ["value_assessment", "value_assessment"],
  ["custo_beneficio", "value_assessment"],
  ["fit_advice", "fit_advice"],
  ["adequacao", "fit_advice"],
  ["other", "other"],
])

const DIMENSION_FIELD_ORDER = ["height", "width", "length", "depth", "diameter", "capacity"]

function createDimensionBucket() {
  return {
    height: "",
    width: "",
    length: "",
    depth: "",
    diameter: "",
    capacity: "",
    raw: [],
  }
}

function pushUnique(target, value) {
  const text = sanitizeString(value)
  if (!text) {
    return
  }

  const key = normalizeToken(text)
  if (!target.some((item) => normalizeToken(item) === key)) {
    target.push(text)
  }
}

function normalizeFactHint(value) {
  const normalized = normalizeToken(value).replace(/[_-]+/g, " ")
  return FACT_HINT_ALIASES.get(normalized) || ""
}

export function normalizeCatalogFactHints(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => normalizeFactHint(item)).filter(Boolean))]
}

export function normalizeCatalogFactScope(value) {
  const normalized = normalizeToken(value)
  return FACT_SCOPE_ALIASES.get(normalized) || ""
}

export function normalizeCatalogCommercialAdviceType(value) {
  const normalized = normalizeToken(value).replace(/[\s-]+/g, "_")
  return COMMERCIAL_ADVICE_ALIASES.get(normalized) || "other"
}

function resolveAttributeScope(attributeName) {
  const normalizedName = normalizeToken(attributeName)
  return /\b(embalagem|pacote|caixa|vendor)\b/.test(normalizedName) ? "package" : "product"
}

function resolveAttributeDimensionField(attributeName) {
  const normalizedName = normalizeToken(attributeName)
  if (!normalizedName) {
    return ""
  }

  if (/\baltura\b/.test(normalizedName)) return "height"
  if (/\blargura\b/.test(normalizedName)) return "width"
  if (/\bcomprimento\b/.test(normalizedName)) return "length"
  if (/\bprofundidade\b/.test(normalizedName)) return "depth"
  if (/\bdiametro\b/.test(normalizedName)) return "diameter"
  if (/\bcapacidade\b/.test(normalizedName)) return "capacity"
  if (/\b(dimensao|dimensoes|medida|medidas|tamanho)\b/.test(normalizedName)) return "dimensions"
  if (/\bpeso\b/.test(normalizedName)) return "weight"
  return ""
}

function formatCurrency(value, currencyId = "BRL") {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) {
    return ""
  }

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currencyId || "BRL",
    }).format(parsed)
  } catch {
    return `R$ ${parsed.toFixed(2).replace(".", ",")}`
  }
}

function assignAttributeFact(facts, attribute) {
  const name = sanitizeString(attribute?.nome)
  const value = sanitizeString(attribute?.valor)
  const normalizedName = normalizeToken(name)
  if (!name || !value || !normalizedName) {
    return
  }

  if (!facts.material && /\bmaterial\b/.test(normalizedName)) {
    facts.material = value
    return
  }

  if (!facts.color && /\b(cor|color|acabamento|estampa)\b/.test(normalizedName)) {
    facts.color = value
    return
  }

  if (!facts.warranty && /\bgarantia\b/.test(normalizedName)) {
    facts.warranty = value
    return
  }

  const scope = resolveAttributeScope(name)
  const field = resolveAttributeDimensionField(name)
  if (!field) {
    pushUnique(facts.details, `${name}: ${value}`)
    return
  }

  if (field === "weight") {
    facts.weight[scope] = facts.weight[scope] || value
    return
  }

  if (field === "dimensions") {
    pushUnique(facts.dimensions[scope].raw, `${name}: ${value}`)
    return
  }

  facts.dimensions[scope][field] = facts.dimensions[scope][field] || value
}

export function buildCatalogProductFacts(product = {}) {
  if (!product || typeof product !== "object") {
    return null
  }

  if (product.facts && typeof product.facts === "object") {
    return product.facts
  }

  const facts = {
    productId: sanitizeString(product.id),
    price: sanitizeNumber(product.preco, null),
    priceLabel: sanitizeNumber(product.preco, null) != null ? formatCurrency(product.preco, product.currencyId || "BRL") : "",
    material: sanitizeString(product.material),
    color: sanitizeString(product.cor),
    warranty: sanitizeString(product.warranty),
    availableQuantity: sanitizeNumber(product.availableQuantity, 0),
    freeShipping: product.freeShipping === true,
    link: sanitizeString(product.link),
    dimensions: {
      product: createDimensionBucket(),
      package: createDimensionBucket(),
    },
    weight: {
      product: "",
      package: "",
    },
    details: [],
  }

  const attributes = Array.isArray(product.atributos) ? product.atributos : []
  attributes.forEach((attribute) => assignAttributeFact(facts, attribute))

  return facts
}

function hasDimensionValues(bucket) {
  if (!bucket || typeof bucket !== "object") {
    return false
  }

  return DIMENSION_FIELD_ORDER.some((field) => sanitizeString(bucket[field])) || (Array.isArray(bucket.raw) && bucket.raw.length > 0)
}

function formatDimensionFieldLabel(field) {
  if (field === "height") return "Altura"
  if (field === "width") return "Largura"
  if (field === "length") return "Comprimento"
  if (field === "depth") return "Profundidade"
  if (field === "diameter") return "Diametro"
  if (field === "capacity") return "Capacidade"
  return ""
}

function formatDimensionField(bucket, field) {
  const value = sanitizeString(bucket?.[field])
  if (!value) {
    return ""
  }

  const label = formatDimensionFieldLabel(field)
  return label ? `${label}: ${value}` : value
}

function collectDimensionLines(bucket) {
  const lines = DIMENSION_FIELD_ORDER.map((field) => formatDimensionField(bucket, field)).filter(Boolean)
  if (Array.isArray(bucket?.raw)) {
    bucket.raw.forEach((entry) => pushUnique(lines, entry))
  }
  return lines
}

function inferFactHintsFromMessage(message = "") {
  const normalized = normalizeToken(message)
  const hints = []

  if (/\b(preco|valor|custa|quanto)\b/.test(normalized)) hints.push("price")
  if (/\bmaterial\b/.test(normalized)) hints.push("material")
  if (/\b(cor|acabamento|estampa)\b/.test(normalized)) hints.push("color")
  if (/\b(estoque|disponivel|disponibilidade|quantas unidades)\b/.test(normalized)) hints.push("stock")
  if (/\bgarantia\b/.test(normalized)) hints.push("warranty")
  if (/\b(link|anuncio|comprar agora|página de compra)\b/.test(normalized)) hints.push("link")
  if (/\b(entrega|envio|frete|prazo|retirada)\b/.test(normalized)) hints.push("shipping")
  if (/\baltura\b/.test(normalized)) hints.push("height")
  if (/\blargura\b/.test(normalized)) hints.push("width")
  if (/\bcomprimento\b/.test(normalized)) hints.push("length")
  if (/\bprofundidade\b/.test(normalized)) hints.push("depth")
  if (/\bdiametro\b/.test(normalized)) hints.push("diameter")
  if (/\bpeso\b/.test(normalized)) hints.push("weight")
  if (/\bcapacidade\b/.test(normalized)) hints.push("capacity")
  if (/\b(dimensao|dimensoes|medida|medidas|tamanho)\b/.test(normalized)) hints.push("dimensions")

  return [...new Set(hints)]
}

function isDimensionOrWeightHint(hint) {
  return ["dimensions", "height", "width", "length", "depth", "diameter", "capacity", "weight"].includes(hint)
}

function shouldReusePreviousScope(factHints = [], previousFactContext = null) {
  if (!previousFactContext || typeof previousFactContext !== "object") {
    return false
  }

  const previousScope = normalizeCatalogFactScope(previousFactContext.scope)
  if (!previousScope || previousScope === "product") {
    return false
  }

  if (!Array.isArray(factHints) || !factHints.length) {
    return false
  }

  return factHints.every((hint) => isDimensionOrWeightHint(hint))
}

function normalizeFactFieldSet(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => sanitizeString(item)).filter(Boolean))].sort()
}

function areSameFactSets(left = [], right = []) {
  const leftSet = normalizeFactFieldSet(left)
  const rightSet = normalizeFactFieldSet(right)
  if (leftSet.length !== rightSet.length) {
    return false
  }

  return leftSet.every((item, index) => item === rightSet[index])
}

function countMessageTokens(message = "") {
  return normalizeToken(message)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length
}

function shouldPreferCompactReply(factHints = [], productId = "", message = "", previousFactContext = null) {
  if (!previousFactContext || typeof previousFactContext !== "object") {
    return false
  }

  const previousProductId = sanitizeString(previousFactContext.productId)
  if (!previousProductId || !productId || previousProductId !== productId) {
    return false
  }

  if (!areSameFactSets(factHints, previousFactContext.fields)) {
    return false
  }

  return countMessageTokens(message) <= 4
}

function resolveFactHints(input = {}) {
  const semanticHints = Array.isArray(input?.semanticIntent?.targetFactHints)
    ? normalizeCatalogFactHints(input.semanticIntent.targetFactHints)
    : []
  if (semanticHints.length) {
    return semanticHints
  }

  return inferFactHintsFromMessage(input?.message)
}

function resolveFactScope(input = {}) {
  const previousFactContext = input?.previousFactContext && typeof input.previousFactContext === "object" ? input.previousFactContext : null
  const semanticScope = normalizeCatalogFactScope(input?.semanticIntent?.factScope)
  if (semanticScope) {
    return semanticScope
  }

  const normalized = normalizeToken(input?.message)
  if (/\bembalagem\b/.test(normalized)) {
    return "package"
  }

  if (shouldReusePreviousScope(input?.factHints, previousFactContext)) {
    return normalizeCatalogFactScope(previousFactContext.scope) || "product"
  }
  return "product"
}

function buildDimensionsReply(facts, scope, options = {}) {
  const selectedScope = scope === "package" ? "package" : "product"
  const primaryLines = collectDimensionLines(facts?.dimensions?.[selectedScope])
  if (primaryLines.length) {
    if (options.compact === true) {
      return `${primaryLines.join(", ")}.`
    }
    return selectedScope === "package"
      ? `As medidas da embalagem que encontrei foram: ${primaryLines.join(", ")}.`
      : `As medidas do produto que encontrei foram: ${primaryLines.join(", ")}.`
  }

  if (selectedScope === "product") {
    const packageLines = collectDimensionLines(facts?.dimensions?.package)
    if (packageLines.length) {
      return `Não encontrei medidas do produto. O anúncio só informa medidas da embalagem: ${packageLines.join(", ")}.`
    }
  }

  return selectedScope === "package"
    ? "Não encontrei medidas de embalagem informadas neste anúncio."
    : "Não encontrei medidas do produto informadas neste anúncio."
}

function buildSingleDimensionReply(facts, field, scope, options = {}) {
  const selectedScope = scope === "package" ? "package" : "product"
  const primaryValue = sanitizeString(facts?.dimensions?.[selectedScope]?.[field])
  if (primaryValue) {
    return `${formatDimensionFieldLabel(field)}${selectedScope === "package" ? " da embalagem" : ""}: ${primaryValue}.`
  }

  if (selectedScope === "product") {
    const packageValue = sanitizeString(facts?.dimensions?.package?.[field])
    if (packageValue) {
      return `Não encontrei ${formatDimensionFieldLabel(field).toLowerCase()} do produto. O anúncio só informa ${formatDimensionFieldLabel(field).toLowerCase()} da embalagem: ${packageValue}.`
    }
  }

  return `Não encontrei ${formatDimensionFieldLabel(field).toLowerCase()} informada${field === "capacity" ? "" : ""} neste anúncio.`
}

function buildWeightReply(facts, scope, options = {}) {
  const selectedScope = scope === "package" ? "package" : "product"
  const primaryValue = sanitizeString(facts?.weight?.[selectedScope])
  if (primaryValue) {
    return selectedScope === "package" ? `Peso da embalagem: ${primaryValue}.` : `Peso do produto: ${primaryValue}.`
  }

  if (selectedScope === "product") {
    const packageValue = sanitizeString(facts?.weight?.package)
    if (packageValue) {
      return `Não encontrei o peso do produto. O anúncio só informa o peso da embalagem: ${packageValue}.`
    }
  }

  return selectedScope === "package"
    ? "Não encontrei peso da embalagem informado neste anúncio."
    : "Não encontrei peso do produto informado neste anúncio."
}

export function buildFocusedCatalogProductFactualResolution(product, message = "", options = {}) {
  if (!product?.nome) {
    return null
  }

  const facts = buildCatalogProductFacts(product)
  if (!facts) {
    return null
  }

  const factHints = resolveFactHints({
    message,
    semanticIntent: options.semanticIntent,
  })
  if (!factHints.length) {
    return null
  }

  const factScope = resolveFactScope({
    message,
    semanticIntent: options.semanticIntent,
    factHints,
    previousFactContext: options.previousFactContext,
  })
  const compactReply = shouldPreferCompactReply(factHints, facts.productId || sanitizeString(product?.id), message, options.previousFactContext)
  const pieces = []

  factHints.forEach((hint) => {
    if (hint === "price") {
      pieces.push(facts.priceLabel ? `O valor atual deste produto é ${facts.priceLabel}.` : "Não encontrei o valor exato deste produto no momento.")
      return
    }

    if (hint === "material") {
      pieces.push(facts.material ? `O material deste produto é ${facts.material}.` : "Não encontrei o material informado deste produto no momento.")
      return
    }

    if (hint === "color") {
      pieces.push(facts.color ? `A cor ou acabamento informado é ${facts.color}.` : "Não encontrei a cor ou acabamento informado deste produto no momento.")
      return
    }

    if (hint === "stock") {
      pieces.push(
        facts.availableQuantity > 0
          ? `No momento eu vejo ${facts.availableQuantity} unidade${facts.availableQuantity > 1 ? "s" : ""} em estoque.`
          : "Não encontrei estoque disponível para este item no momento."
      )
      return
    }

    if (hint === "warranty") {
      pieces.push(
        facts.warranty && !/^sem garantia$/i.test(facts.warranty)
          ? `A garantia informada no anuncio e ${facts.warranty}.`
          : "Não encontrei garantia informada neste anúncio."
      )
      return
    }

    if (hint === "shipping") {
      pieces.push(
        facts.freeShipping
          ? "A entrega e feita pelo Mercado Livre e este anuncio indica frete gratis."
          : "A entrega e feita pelo Mercado Livre e o frete aparece no checkout conforme o seu CEP."
      )
      return
    }

    if (hint === "link") {
      pieces.push(facts.link ? `Se quiser, eu mando o link direto do anúncio: ${facts.link}` : "Não encontrei o link direto deste anuncio no momento.")
      return
    }

    if (hint === "details") {
      pieces.push(facts.details.length ? `Os principais detalhes que encontrei foram: ${facts.details.slice(0, 4).join(", ")}.` : "Não encontrei detalhes adicionais relevantes neste anúncio.")
      return
    }

    if (hint === "dimensions") {
      pieces.push(buildDimensionsReply(facts, factScope, { compact: compactReply }))
      return
    }

    if (["height", "width", "length", "depth", "diameter", "capacity"].includes(hint)) {
      pieces.push(buildSingleDimensionReply(facts, hint, factScope, { compact: compactReply }))
      return
    }

    if (hint === "weight") {
      pieces.push(buildWeightReply(facts, factScope, { compact: compactReply }))
    }
  })

  const replyPieces = [...new Set(pieces.map((item) => sanitizeString(item)).filter(Boolean))]
  if (!replyPieces.length) {
    return null
  }

  return {
    reply: replyPieces.join(" "),
    factContext: {
      fields: factHints,
      scope: factScope,
      productId: facts.productId || sanitizeString(product?.id),
      source: Array.isArray(options?.semanticIntent?.targetFactHints) && options.semanticIntent.targetFactHints.length ? "semantic" : "fallback",
    },
    facts,
  }
}

function collectKnownFactLabels(facts) {
  const labels = []
  if (facts?.priceLabel) labels.push(`valor: ${facts.priceLabel}`)
  if (facts?.material) labels.push(`material: ${facts.material}`)
  if (facts?.color) labels.push(`cor/acabamento: ${facts.color}`)
  if (facts?.availableQuantity > 0) labels.push(`estoque: ${facts.availableQuantity} unidade${facts.availableQuantity > 1 ? "s" : ""}`)
  if (facts?.freeShipping) labels.push("frete gratis indicado")
  return labels
}

export function buildFocusedCatalogProductCommercialReply(product, options = {}) {
  if (!product?.nome) {
    return null
  }

  const facts = buildCatalogProductFacts(product)
  if (!facts) {
    return null
  }

  const adviceType = normalizeCatalogCommercialAdviceType(options?.adviceType)
  const knownFacts = collectKnownFactLabels(facts)
  const knownFactsText = knownFacts.length ? ` Pelo anuncio, eu tenho ${knownFacts.slice(0, 4).join(", ")}.` : ""

  if (adviceType === "price_objection") {
    const priceText = facts.priceLabel ? `Ele está anunciado por ${facts.priceLabel}.` : "Eu não tenho o valor exato confirmado no anuncio agora."
    const materialText = facts.material ? ` O material informado e ${facts.material}.` : ""
    return `${priceText}${materialText} Se a sua dúvida é custo-benefício, eu não avaliaria só pelo material: confira estado nas fotos, medidas, frete no seu CEP e se a peça resolve o que você procura. Se ficar caro para o que você quer, posso buscar opções parecidas da loja para comparar.`
  }

  if (adviceType === "improvement_suggestion") {
    return `Para decidir melhor sobre este produto, eu melhoraria a validacao destes pontos: medidas reais do produto, estado/conservacao pelas fotos, frete no seu CEP, garantia e se ha algum detalhe de uso ou avaria no anuncio.${knownFactsText}`
  }

  if (adviceType === "value_assessment") {
    return `Para avaliar se vale a pena, compare preco, material, estado, medidas e frete com produtos parecidos da propria loja.${knownFactsText} Se quiser, eu busco alternativas similares para comparar lado a lado.`
  }

  if (adviceType === "fit_advice") {
    return `Para ver se esse item combina com o que você precisa, eu olharia principalmente medidas, material, acabamento e condição do anúncio.${knownFactsText}`
  }

  return `Consigo te ajudar a avaliar este produto pelo que o anuncio informa: preco, material, medidas, estoque, frete e detalhes visiveis.${knownFactsText}`
}
