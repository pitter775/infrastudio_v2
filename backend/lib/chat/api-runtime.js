import { buildSearchTokens, normalizeText, singularizeToken } from "@/lib/chat/text-utils"
import { buildCatalogProductFacts, buildFocusedCatalogProductFactualResolution, normalizeCatalogFactHints } from "@/lib/chat/catalog-product-facts"
import {
  normalizeCatalogComparisonIntent,
  resolveCatalogComparisonDecisionState,
  resolveCatalogExecutionState,
} from "@/lib/chat/catalog-intent-handler"

const API_RUNTIME_INTENT_TYPES = new Set([
  "create_record",
  "lookup_by_identifier",
  "knowledge_search",
  "catalog_search",
  "generic_fact",
])

export function normalizeApiRuntimeIntentType(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return API_RUNTIME_INTENT_TYPES.has(normalized) ? normalized : "generic_fact"
}

function hasExplicitApiRuntimeIntentType(api) {
  return Boolean(String(api?.config?.runtime?.intentType || api?.configuracoes?.runtime?.intentType || "").trim())
}

function getApiRuntimeIntentType(api) {
  return normalizeApiRuntimeIntentType(api?.config?.runtime?.intentType || api?.configuracoes?.runtime?.intentType)
}

function shouldUseApiForFactLookup(api, customDeps = {}) {
  const intentType = getApiRuntimeIntentType(api)
  if (intentType === "create_record") {
    return customDeps?.intentType === "create_record"
  }
  return true
}

function shouldUseApiAsCatalog(api) {
  const intentType = getApiRuntimeIntentType(api)
  return intentType === "catalog_search" || (!hasExplicitApiRuntimeIntentType(api) && intentType === "generic_fact")
}

function getApiRuntimeRequiredFields(api) {
  const requiredFields = api?.config?.runtime?.requiredFields
  if (!Array.isArray(requiredFields)) {
    return []
  }

  return requiredFields
    .map((field) => {
      if (typeof field === "string") {
        return { name: sanitizeString(field), label: formatApiFieldLabel(field) }
      }

      const name = sanitizeString(field?.name || field?.nome || field?.param || field?.contextPath || field?.source)
      const label = sanitizeString(field?.label || field?.titulo || field?.description || field?.descricao) || formatApiFieldLabel(name)
      return name ? { name, label } : null
    })
    .filter(Boolean)
}

function hasApiRuntimeFieldValue(api, fieldName, deps) {
  const normalizedName = normalizeApiFieldName(fieldName, deps)
  return (Array.isArray(api?.campos) ? api.campos : []).some((field) => {
    const normalizedField = normalizeApiFieldName(field?.nome, deps)
    return (
      normalizedField &&
      (normalizedField === normalizedName || normalizedField.endsWith(`_${normalizedName}`) || normalizedField.endsWith(normalizedName)) &&
      field?.valor != null &&
      String(field.valor).trim()
    )
  })
}

function resolveTargetRuntimeApis(apis = [], customDeps = {}) {
  const desiredApiId = sanitizeString(customDeps?.apiId)
  const desiredIntentType = normalizeApiRuntimeIntentType(customDeps?.intentType)
  const hasExplicitIntent = Boolean(sanitizeString(customDeps?.intentType))
  const availableApis = (apis ?? []).filter((api) => api && typeof api === "object")

  if (desiredApiId) {
    return availableApis.filter((api) => sanitizeString(api?.apiId || api?.id) === desiredApiId)
  }

  if (hasExplicitIntent) {
    return availableApis.filter((api) => getApiRuntimeIntentType(api) === desiredIntentType)
  }

  return availableApis
}

function buildMissingRequiredFieldsReply(message, apis = [], deps, customDeps = {}) {
  const targetApis = resolveTargetRuntimeApis(apis, customDeps)
  const candidates = targetApis
    .map((api) => {
      const missingFields = getApiRuntimeRequiredFields(api).filter((field) => !hasApiRuntimeFieldValue(api, field.name, deps))
      return {
        api,
        intentType: getApiRuntimeIntentType(api),
        missingFields,
      }
    })
    .filter((item) => item.missingFields.length)

  if (!candidates.length) {
    return null
  }

  const preferred =
    candidates.find((item) => item.intentType === customDeps?.intentType) ??
    candidates.find((item) => item.intentType === "create_record") ??
    candidates[0]
  const labels = preferred.missingFields.map((field) => field.label).filter(Boolean)
  if (!labels.length) {
    return null
  }

  const apiName = sanitizeString(preferred.api?.nome || preferred.api?.name) || "essa API"
  const fieldList = labels.length === 1 ? labels[0] : labels.slice(0, -1).join(", ") + " e " + labels.at(-1)

  if (preferred.intentType === "create_record") {
    return `Para fazer esse cadastro com segurança, preciso de: ${fieldList}. Me envie esses dados e eu confirmo antes de registrar.`
  }

  if (preferred.intentType === "lookup_by_identifier") {
    return `Para consultar ${apiName}, preciso de: ${fieldList}.`
  }

  return `Para usar ${apiName} com segurança, preciso de: ${fieldList}.`
}

const ANALYTICAL_QUERY_SIGNALS = [
  "vale a pena",
  "compensa",
  "e uma boa",
  "o que acha",
  "sua opiniao",
  "recomenda",
  "devo",
  "deveria",
  "melhor opcao",
  "faz sentido",
  "quais os riscos",
  "principais riscos",
  "pontos de atenção",
  "analise",
  "analisa",
  "resuma",
  "resumo",
  "compare",
  "comparar",
]

const API_FIELD_INTENTS = [
  {
    id: "risk",
    triggers: ["problema", "problemas", "risco", "riscos", "alerta", "pendencia", "pendencias", "restricao", "restricoes"],
    targets: ["riscos", "risco", "restricoes", "observacoes", "status", "ocupacao", "cartorio", "matricula"],
  },
  {
    id: "docs",
    triggers: ["documento", "documentos", "registro", "registros", "matricula", "cartorio"],
    targets: ["matricula", "cartorio", "observacoes", "riscos"],
  },
  {
    id: "price",
    triggers: ["preco", "precos", "valor", "valores", "quanto", "custa", "lance", "mercado", "avaliacao", "orcamento"],
    targets: ["valor", "preco", "valor_minimo", "valor_avaliacao", "valor_mercado", "lance", "roi", "custo"],
  },
  {
    id: "location",
    triggers: ["localizacao", "endereco", "onde", "rua", "numero", "cep", "cidade", "estado"],
    targets: ["endereco", "rua", "numero", "complemento", "cep", "cidade", "estado", "localizacao"],
  },
  {
    id: "description",
    triggers: ["descricao", "resumo", "sobre", "apresentacao", "detalhe", "detalhes"],
    targets: ["titulo", "descricao", "resumo", "analise", "tipo"],
  },
  {
    id: "specs",
    triggers: ["caracteristica", "caracteristicas", "quartos", "banheiros", "area", "tipo", "metragem"],
    targets: ["tipo", "quartos", "banheiros", "area_total", "area_construida", "area_util"],
  },
  {
    id: "date",
    triggers: ["data", "prazo", "quando", "agenda", "previsao", "vencimento", "leilao"],
    targets: ["data", "prazo", "previsao", "data_leilao", "status"],
  },
  {
    id: "status",
    triggers: ["status", "codigo", "pedido", "estoque", "disponivel", "disponibilidade"],
    targets: ["status", "codigo", "pedido", "estoque", "disponibilidade", "sku"],
  },
]

const DIRECT_REPLY_FACTUAL_SIGNALS = [
  "matricula",
  "cartorio",
  "cep",
  "rua",
  "numero",
  "cidade",
  "estado",
  "ocupacao",
  "status",
  "data leilao",
  "data do leilao",
  "data",
  "prazo",
  "previsao",
  "valor minimo",
  "valor de avaliacao",
  "valor",
  "preco",
  "quartos",
  "banheiros",
  "area total",
  "area construida",
  "codigo",
  "estoque",
]

const API_VOCABULARY = new Set(
  [
    ...API_FIELD_INTENTS.flatMap((intent) => [...intent.triggers, ...intent.targets]),
    ...DIRECT_REPLY_FACTUAL_SIGNALS,
  ].map((item) => String(item || "").trim()).filter(Boolean)
)

function getDeps(deps = {}) {
  return {
    normalizeText: deps.normalizeText ?? normalizeText,
    buildSearchTokens: deps.buildSearchTokens ?? buildSearchTokens,
    singularizeToken: deps.singularizeToken ?? singularizeToken,
  }
}

function resolveTargetHintFields(availableApis = [], targetFieldHints = [], deps) {
  const hints = Array.isArray(targetFieldHints)
    ? targetFieldHints
        .map((item) => normalizeApiFieldName(item, deps))
        .filter(Boolean)
    : []

  if (!hints.length) {
    return []
  }

  const selected = availableApis.flatMap((api) =>
    (Array.isArray(api?.campos) ? api.campos : []).flatMap((field) => {
      const normalizedField = normalizeApiFieldName(field?.nome, deps)
      if (!normalizedField) {
        return []
      }

      const fieldTokens = tokenizeApiField(normalizedField, deps)
      return hints.some(
        (hint) => normalizedField === hint || normalizedField.endsWith(`.${hint}`) || normalizedField.endsWith(hint) || fieldTokens.includes(hint)
      )
        ? [
            {
              apiId: sanitizeString(api?.apiId),
              apiNome: sanitizeString(api?.nome),
              nome: sanitizeString(field?.nome),
              valor: field?.valor,
              score: 10,
            },
          ]
        : []
    })
  )

  return [...new Map(selected.map((item) => [`${item.apiId}:${item.nome}`, item])).values()].slice(0, 6)
}

function resolveSupportHintFields(apiContexts = [], primaryField, supportFieldHints = [], deps) {
  const hints = Array.isArray(supportFieldHints)
    ? supportFieldHints.map((item) => normalizeApiFieldName(item, deps)).filter(Boolean)
    : []

  if (!hints.length) {
    return []
  }

  const primaryName = deps.normalizeText(primaryField?.nome)
  const selected = apiContexts.flatMap((api) =>
    (api.campos ?? []).flatMap((field) => {
      const normalizedName = deps.normalizeText(field?.nome)
      if (!normalizedName || normalizedName === primaryName) {
        return []
      }

      const fieldTokens = tokenizeApiField(normalizedName, deps)
      return hints.some(
        (hint) => normalizedName === hint || normalizedName.endsWith(`.${hint}`) || normalizedName.endsWith(hint) || fieldTokens.includes(hint)
      )
        ? [
            {
              ...field,
              apiId: api.apiId,
              apiNome: api.nome,
              supportScore: 10,
            },
          ]
        : []
    })
  )

  return [...new Map(selected.map((item) => [`${item.apiId}:${item.nome}`, item])).values()].slice(0, 3)
}

function sanitizeString(value) {
  const normalized = String(value ?? "").trim()
  return normalized || ""
}

function sanitizeNumber(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isScalarApiValue(value) {
  return value == null || ["string", "number", "boolean"].includes(typeof value)
}

function normalizeApiFieldValueForContext(value) {
  if (value == null) {
    return ""
  }

  if (isScalarApiValue(value)) {
    return String(value).trim()
  }

  try {
    return JSON.stringify(value).slice(0, 600)
  } catch {
    return String(value).slice(0, 600)
  }
}

function buildApiItemFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field) => {
      const name = sanitizeString(field?.nome || field?.name || field?.key)
      const value = normalizeApiFieldValueForContext(field?.valor ?? field?.value)
      if (!name || !value) {
        return null
      }

      return {
        name,
        label: formatApiFieldLabel(name),
        value,
      }
    })
    .filter(Boolean)
    .slice(0, 40)
}

function buildApiItemRawContext(fields = []) {
  const entries = buildApiItemFields(fields).slice(0, 28)
  if (!entries.length) {
    return ""
  }

  return entries.map((field) => `${field.label}: ${field.value}`).join("\n").slice(0, 6000)
}

function pushCatalogImageUrl(target, value) {
  const raw = sanitizeString(value)
  if (!raw) {
    return
  }

  if (!target.includes(raw)) {
    target.push(raw)
  }
}

function collectCatalogImageUrls(value, target = []) {
  if (value == null || target.length >= 6) {
    return target
  }

  if (typeof value === "string") {
    const text = value.trim()
    if (!text) {
      return target
    }

    if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
      try {
        return collectCatalogImageUrls(JSON.parse(text), target)
      } catch {
        pushCatalogImageUrl(target, text)
        return target
      }
    }

    pushCatalogImageUrl(target, text)
    return target
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectCatalogImageUrls(item, target))
    return target
  }

  if (typeof value === "object") {
    const candidates = [
      value.publicUrl,
      value.url,
      value.src,
      value.href,
      value.imagem,
      value.image,
      value.thumbnail,
      value.thumb,
      value.foto,
      value.path,
    ]
    candidates.forEach((item) => collectCatalogImageUrls(item, target))
  }

  return target
}

function normalizeApiFieldName(name, deps) {
  return deps.normalizeText(String(name || "").replace(/\./g, "_"))
}

function groupApiFieldsAsCatalogItem(api, deps) {
  if (!shouldUseApiAsCatalog(api)) {
    return null
  }

  const fields = Array.isArray(api?.campos) ? api.campos : []
  return groupApiFieldListAsCatalogItem(api, fields, deps)
}

function groupApiFieldListAsCatalogItem(api, fields, deps, itemIndex = 0) {
  if (!fields.length) {
    return null
  }

  const itemFields = buildApiItemFields(fields)
  const rawContext = buildApiItemRawContext(fields)
  const fieldMap = new Map(fields.map((field) => [normalizeApiFieldName(field.nome, deps), field.valor]))
  const readField = (...keys) => {
    for (const key of keys) {
      const normalizedKey = normalizeApiFieldName(key, deps)
      if (fieldMap.has(normalizedKey)) {
        return fieldMap.get(normalizedKey)
      }
    }
    return undefined
  }
  const id =
    sanitizeString(readField("id")) ||
    sanitizeString(readField("propertyid", "property_id", "uuid")) ||
    sanitizeString(readField("sku")) ||
    sanitizeString(readField("codigo")) ||
    (sanitizeString(api?.apiId) ? `${sanitizeString(api.apiId)}:${itemIndex + 1}` : "")
  const nome =
    sanitizeString(readField("nome")) ||
    sanitizeString(readField("titulo")) ||
    sanitizeString(readField("title")) ||
    sanitizeString(readField("produto")) ||
    sanitizeString(readField("sku")) ||
    sanitizeString(api?.nome)
  const preco = sanitizeNumber(readField("preco", "valor", "valor_publico", "valor_minimo", "valor_avaliacao", "valor_primeiro_leilao"), null)
  const availableQuantity = sanitizeNumber(readField("estoque", "quantidade"), 0)
  const status =
    sanitizeString(readField("status")) ||
    (availableQuantity > 0 ? "disponivel" : "")
  const warranty = sanitizeString(readField("garantia", "warranty"))
  const categoriaLabel =
    sanitizeString(readField("categoria", "category", "categoria_nome", "tipo", "type")) ||
    sanitizeString(api?.categoriaLabel)
  const material = sanitizeString(readField("material"))
  const cor = sanitizeString(readField("cor", "color"))
  const link = sanitizeString(readField("link", "url", "permalink"))
  const imagens = collectCatalogImageUrls(
    readField("imagens", "images", "fotos", "photos", "pictures", "galeria", "gallery")
  )
  collectCatalogImageUrls(readField("imagem", "image", "thumbnail", "thumb", "foto", "picture"), imagens)
  const imagem = imagens[0] || ""
  const cidade = sanitizeString(readField("cidade", "city"))
  const estado = sanitizeString(readField("estado", "uf", "state"))
  const endereco = sanitizeString(readField("endereco", "rua", "logradouro"))
  const freeShippingValue = readField("frete_gratis", "frete gratis", "free_shipping", "free shipping")
  const freeShipping = freeShippingValue === true || String(freeShippingValue).toLowerCase() === "true"
  const descricao =
    sanitizeString(readField("descricao")) ||
    sanitizeString(readField("resumo")) ||
    [
      preco != null ? formatCurrencyValue(preco) : "",
      availableQuantity > 0 ? `${availableQuantity} em estoque` : "",
      material,
      cor,
      freeShipping ? "frete gratis" : "",
    ]
      .filter(Boolean)
      .join(" - ")

  const hasCatalogSignal = Boolean(nome && (preco != null || availableQuantity > 0 || warranty || material || cor || descricao))
  if (!hasCatalogSignal) {
    return null
  }

  const product = {
    id,
    nome,
    categoriaLabel,
    descricao,
    preco,
    link,
    imagem,
    imagens,
    cidade,
    estado,
    endereco,
    availableQuantity,
    status,
    warranty,
    material,
    cor,
    freeShipping,
    atributos: [
      material ? { nome: "material", valor: material } : null,
      cor ? { nome: "cor", valor: cor } : null,
      warranty ? { nome: "garantia", valor: warranty } : null,
    ].filter(Boolean),
    source: "api_runtime",
    apiId: sanitizeString(api?.apiId),
    apiNome: sanitizeString(api?.nome),
    sourceListingSessionId: sanitizeString(api?.listingSessionId),
    cardIndex: itemIndex,
    fields: itemFields,
    rawContext,
  }

  return {
    ...product,
    facts: buildCatalogProductFacts(product),
  }
}

export function extractApiCatalogProducts(apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  return (apis ?? [])
    .flatMap((api) => {
      const catalogItems = Array.isArray(api?.catalogItems) ? api.catalogItems : []
      if (catalogItems.length) {
        return catalogItems
          .map((fields, index) => groupApiFieldListAsCatalogItem(api, Array.isArray(fields) ? fields : [], deps, index))
          .filter(Boolean)
      }

      return [groupApiFieldsAsCatalogItem(api, deps)].filter(Boolean)
    })
    .filter(Boolean)
}

export function buildApiCatalogSearchState(apis = [], customDeps = {}) {
  const products = extractApiCatalogProducts(apis, customDeps)
  if (!products.length) {
    return null
  }

  return {
    ultimaBusca: sanitizeString(customDeps?.searchTerm),
    paginationOffset: 0,
    paginationNextOffset: 0,
    paginationPoolLimit: products.length,
    paginationHasMore: false,
    paginationTotal: products.length,
    produtoAtual: products.length === 1 ? products[0] : null,
    ultimosProdutos: products,
    listingSession: {
      id: buildApiListingSessionId(customDeps?.searchTerm, products),
      snapshotId: "",
      searchTerm: sanitizeString(customDeps?.searchTerm),
      matchedProductIds: products.map((item) => sanitizeString(item?.id)).filter(Boolean),
      offset: 0,
      nextOffset: 0,
      poolLimit: products.length,
      hasMore: false,
      total: products.length,
      source: "api_runtime",
    },
  }
}

function buildApiListingSessionId(searchTerm, products = []) {
  const seed = [
    sanitizeString(searchTerm),
    ...(Array.isArray(products) ? products.map((item) => sanitizeString(item?.id)).filter(Boolean).slice(0, 8) : []),
  ]
    .filter(Boolean)
    .join(":")

  return seed ? `api:${Buffer.from(seed).toString("base64url").slice(0, 32)}` : `api:${Date.now().toString(36)}`
}

function buildApiCatalogSearchReply(products = [], searchTerm = "") {
  const total = Array.isArray(products) ? products.length : 0
  if (!total) {
    return null
  }

  if (total === 1) {
    return buildApiSelectedCatalogReply(products[0])
  }

  const term = sanitizeString(searchTerm)
  return term
    ? `Encontrei ${total} opções para ${term}. Vou te mostrar as principais agora.`
    : `Encontrei ${total} opções. Vou te mostrar as principais agora.`
}

export function buildApiCatalogAssetsFromProducts(products = []) {
  return products.slice(0, 6).map((product, index) => {
    const priceLabel = product.preco != null ? formatCurrencyValue(product.preco) : ""
    const locationLabel = [product.cidade, product.estado].filter(Boolean).join(" - ")
    const description = [priceLabel, locationLabel, product.descricao].filter(Boolean).join(" - ")

    return {
      id: product.id || `api-runtime-${index + 1}`,
      kind: "product",
      provider: "api_runtime",
      categoria: "image",
      nome: product.nome || "Item encontrado",
      slug: product.id || `api-runtime-${index + 1}`,
      descricao: description,
      resumo: product.descricao || "",
      priceValue: product.preco,
      priceLabel,
      targetUrl: product.link || "",
      publicUrl: product.imagem || "",
      images: Array.isArray(product.imagens) && product.imagens.length ? product.imagens : product.imagem ? [product.imagem] : [],
      whatsappText: [priceLabel, locationLabel, product.descricao].filter(Boolean).join("\n"),
      metadata: {
        productId: product.id || "",
        apiId: product.apiId || "",
        apiNome: product.apiNome || "",
        status: product.status || "",
        availableQuantity: product.availableQuantity ?? 0,
        priceValue: product.preco,
        cidade: product.cidade || "",
        estado: product.estado || "",
        endereco: product.endereco || "",
        source: "api_runtime",
      },
    }
  })
}

export function buildApiCatalogAssets(apis = [], customDeps = {}) {
  return buildApiCatalogAssetsFromProducts(extractApiCatalogProducts(apis, customDeps))
}

function hasRecentApiListContext(contextProducts, products) {
  return (Array.isArray(contextProducts) && contextProducts.length > 1) || (Array.isArray(products) && products.length > 1)
}

function buildApiSelectedCatalogReply(product) {
  if (!product?.nome) {
    return null
  }
  const locationLabel = [product.cidade, product.estado].filter(Boolean).join(" - ")
  return [
    `Encontrei o imóvel ${product.nome} e separei o card para você avaliar melhor.`,
    product.descricao ? `Detalhes: ${product.descricao}.` : "",
    locationLabel ? `Localização: ${locationLabel}.` : "",
    product.endereco ? `Endereço: ${product.endereco}.` : "",
    product.preco != null ? `Preço atual: ${formatCurrencyValue(product.preco)}.` : "",
    sanitizeNumber(product.availableQuantity, 0) > 0 ? `Tenho ${sanitizeNumber(product.availableQuantity, 0)} em estoque.` : "",
    product.freeShipping ? "Esse item está com frete grátis." : "",
    product.warranty ? `Garantia informada: ${product.warranty}.` : "",
    product.link ? "Se quiser, eu posso te mandar o link direto." : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function buildApiCatalogFactualResolution(message, product, context = {}, semanticApiDecision = null) {
  if (!product?.nome) {
    return null
  }

  const targetFactHints = normalizeCatalogFactHints(semanticApiDecision?.targetFieldHints)
  return buildFocusedCatalogProductFactualResolution(product, message, {
    semanticIntent: targetFactHints.length
      ? {
          targetFactHints,
          factScope: "",
        }
      : null,
    previousFactContext: context?.catalogo?.productFocus?.factualContext ?? null,
  })
}

function findApiProductField(product, candidates = [], deps = getDeps()) {
  const fields = Array.isArray(product?.fields) ? product.fields : []
  const normalizedCandidates = candidates.map((item) => normalizeApiFieldName(item, deps)).filter(Boolean)
  if (!fields.length || !normalizedCandidates.length) {
    return null
  }

  return fields.find((field) => {
    const normalizedName = normalizeApiFieldName(field.name || field.label, deps)
    return normalizedCandidates.some(
      (candidate) =>
        normalizedName === candidate ||
        normalizedName.endsWith(`_${candidate}`) ||
        normalizedName.endsWith(candidate) ||
        normalizedName.includes(candidate)
    )
  }) ?? null
}

function hasMeaningfulApiField(product, candidates = [], deps = getDeps()) {
  const field = findApiProductField(product, candidates, deps)
  return field && sanitizeString(field.value) ? field : null
}

function buildApiFocusedCatalogAdvisoryReply(message, product, context = {}, semanticCatalogDecision = null) {
  if (!product?.nome) {
    return null
  }

  const deps = getDeps()
  const normalized = deps.normalizeText(message)
  const adviceType = sanitizeString(semanticCatalogDecision?.adviceType)
  const asksRisk =
    /\b(risco|riscos|problema|problemas|pendencia|pendencias|restricao|restricoes|atencao|validar|conferir)\b/.test(normalized)
  const asksValue =
    adviceType === "value_assessment" ||
    /\b(vale a pena|compensa|faz sentido|preco|valor|custo|retorno|roi)\b/.test(normalized)
  const asksFit =
    adviceType === "fit_advice" ||
    /\b(recomenda|indicaria|serve|adequado|bom para|melhor opcao)\b/.test(normalized)

  if (!asksRisk && !asksValue && !asksFit && semanticCatalogDecision?.kind !== "current_product_commercial_advice") {
    return null
  }

  const status = hasMeaningfulApiField(product, ["status", "situacao", "disponibilidade"], deps)
  const occupation = hasMeaningfulApiField(product, ["ocupacao", "ocupado", "desocupado"], deps)
  const risk = hasMeaningfulApiField(product, ["risco", "riscos", "pendencias", "restricoes", "observacoes", "alertas"], deps)
  const document = hasMeaningfulApiField(product, ["matricula", "cartorio", "documento", "edital", "processo"], deps)
  const date = hasMeaningfulApiField(product, ["data", "data_leilao", "prazo", "encerramento"], deps)
  const marketValue = hasMeaningfulApiField(product, ["valor_mercado", "valor_avaliacao", "avaliacao"], deps)
  const currentValue = hasMeaningfulApiField(product, ["valor_minimo", "valor_publico", "preco", "valor", "lance"], deps)
  const location = [product.endereco, product.cidade, product.estado].filter(Boolean).join(" - ")

  const lines = []
  if (risk) lines.push(`- ${risk.label}: ${risk.value}`)
  if (status) lines.push(`- ${status.label}: ${status.value}`)
  if (occupation) lines.push(`- ${occupation.label}: ${occupation.value}`)
  if (document) lines.push(`- ${document.label}: ${document.value}`)
  if (date) lines.push(`- ${date.label}: ${date.value}`)
  if (currentValue) lines.push(`- ${currentValue.label}: ${currentValue.value}`)
  if (marketValue && marketValue.value !== currentValue?.value) lines.push(`- ${marketValue.label}: ${marketValue.value}`)
  if (location) lines.push(`- Localização: ${location}`)

  const missingChecks = [
    risk ? "" : "riscos ou pendências explícitas",
    document ? "" : "documentação, matrícula ou edital",
    occupation ? "" : "ocupação",
    status ? "" : "status operacional ou jurídico",
  ].filter(Boolean)

  const intro = asksRisk
    ? `Sobre ${product.nome}, eu trataria como análise inicial, não como validação final.`
    : asksValue
      ? `Sobre ${product.nome}, dá para fazer uma leitura inicial com os dados da API.`
      : `Sobre ${product.nome}, eu avaliaria pelos dados disponíveis antes de avançar.`

  return [
    intro,
    lines.length ? "\nO que a API trouxe de concreto:" : "",
    ...lines.slice(0, 8),
    missingChecks.length ? "\nO que ainda precisa ser conferido antes de decidir:" : "",
    ...missingChecks.slice(0, 4).map((item) => `- ${item}`),
    "\nPróximo passo: validar os pontos ausentes na fonte oficial ou com o responsável antes de assumir compromisso.",
  ]
    .filter(Boolean)
    .join("\n")
}

function buildApiCatalogExitFocusReply(catalogDecision = null) {
  const kind = sanitizeString(catalogDecision?.kind)
  if (!kind) {
    return null
  }

  if (kind === "catalog_load_more") {
    return "Entendi. Para continuar essa lista pela API, preciso executar uma nova consulta ou receber mais resultados da própria API."
  }

  if (["same_type_search", "similar_items_search", "catalog_alternative_search"].includes(kind)) {
    return "Entendi. Vou sair do item atual. Para buscar alternativas pela API, me diga o termo ou filtro principal que devo usar."
  }

  if (["catalog_search_refinement", "new_catalog_search", "catalog_browse"].includes(kind)) {
    return "Entendi. Vou sair do item atual e tratar isso como uma nova busca na API."
  }

  return null
}

function isApiFocusAffirmation(message) {
  const normalized = normalizeText(message)
  if (!normalized || normalized.length > 80) {
    return false
  }

  return /\b(gostei|interessei|curti|quero esse|quero este|pode ser|ok|beleza|legal)\b/.test(normalized)
}

function buildApiFocusedAffirmationReply(product) {
  if (!product?.nome) {
    return null
  }

  const locationLabel = [product.cidade, product.estado].filter(Boolean).join(" - ")
  const priceLabel = product.preco != null ? formatCurrencyValue(product.preco) : ""
  const contextPieces = [priceLabel, locationLabel].filter(Boolean)
  return [
    `Certo, vou manter ${product.nome} como foco.`,
    contextPieces.length ? `Pelo que a API trouxe: ${contextPieces.join(" · ")}.` : "",
    "Pode me perguntar sobre riscos, localização, valor, documentação ou próximos passos desse item.",
  ]
    .filter(Boolean)
    .join(" ")
}

export function resolveApiCatalogReplyResolution(message, context = {}, apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  const contextProducts = Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos.filter(Boolean) : []
  const products = contextProducts.length ? contextProducts : extractApiCatalogProducts(apis, deps)
  if (!products.length) {
    return null
  }

  const semanticApiDecision = customDeps?.semanticApiDecision
  const semanticCatalogDecision = customDeps?.semanticCatalogDecision
  const catalogDecision = customDeps?.catalogDecision ?? semanticCatalogDecision
  const explicitCatalogAction = sanitizeString(context?.ui?.catalogAction || context?.catalogAction).toLowerCase()
  const explicitProductId = sanitizeString(context?.ui?.catalogProductId || context?.catalogProductId)
  if (explicitCatalogAction === "product_detail" && explicitProductId) {
    const selectedProduct = products.find((product) => {
      const productId = sanitizeString(product?.id || product?.productId)
      return productId && productId === explicitProductId
    })
    if (selectedProduct?.nome) {
      return {
        reply: buildApiSelectedCatalogReply(selectedProduct),
        currentCatalogProduct: selectedProduct,
        factContext: null,
        attachAssets: true,
      }
    }
  }

  const focusedProductId = sanitizeString(context?.catalogo?.productFocus?.productId || context?.catalogo?.produtoAtual?.id)
  const earlyFocusedProduct =
    (focusedProductId
      ? products.find((product) => sanitizeString(product?.id || product?.productId) === focusedProductId)
      : null) ??
    (context?.catalogo?.produtoAtual && typeof context.catalogo.produtoAtual === "object" ? context.catalogo.produtoAtual : null) ??
    (products.length === 1 ? products[0] : null)
  if (earlyFocusedProduct?.nome) {
    if (isApiFocusAffirmation(message)) {
      return {
        reply: buildApiFocusedAffirmationReply(earlyFocusedProduct),
        currentCatalogProduct: earlyFocusedProduct,
        factContext: null,
        attachAssets: false,
      }
    }

    const advisoryReply = buildApiFocusedCatalogAdvisoryReply(message, earlyFocusedProduct, context, semanticCatalogDecision)
    if (advisoryReply) {
      return {
        reply: advisoryReply,
        currentCatalogProduct: earlyFocusedProduct,
        factContext: {
          productId: sanitizeString(earlyFocusedProduct.id),
          fields: ["api_advisory"],
          scope: "commercial",
          source: "api_runtime_advisory",
        },
        attachAssets: false,
      }
    }
  }

  if (semanticApiDecision?.kind === "api_catalog_search") {
    return {
      reply: buildApiCatalogSearchReply(products, getApiSearchTermFromSemanticDecision(semanticApiDecision)),
      currentCatalogProduct: products.length === 1 ? products[0] : null,
      factContext: null,
      attachAssets: true,
    }
  }

  const semanticComparisonMode = normalizeCatalogComparisonIntent(semanticApiDecision?.comparisonMode)
  const executionState = resolveCatalogExecutionState({
    latestUserMessage: message,
    context: {
      ...context,
      catalogo: {
        ...(context?.catalogo && typeof context.catalogo === "object" ? context.catalogo : {}),
        produtoAtual:
          context?.catalogo?.produtoAtual && typeof context.catalogo.produtoAtual === "object"
            ? context.catalogo.produtoAtual
            : products.length === 1
              ? products[0]
              : null,
        ultimosProdutos: products,
      },
    },
    products,
    catalogDecision,
    detectProductSearch: () => false,
    buildProductSearchCandidates: () => [],
    isCatalogListingIntent: () => false,
  })
  const textualComparisonIntent = executionState.comparisonState.comparisonIntent
  const comparisonIntent = semanticComparisonMode ?? textualComparisonIntent
  if (comparisonIntent) {
    const comparisonState = resolveCatalogComparisonDecisionState({
      latestUserMessage: message,
      products,
      comparisonIntent,
      referencedProductIndexes: semanticApiDecision?.referencedProductIndexes,
      isSemanticComparison: Boolean(semanticComparisonMode),
      hasRecentListContext: hasRecentApiListContext(contextProducts, products),
    })
    return comparisonState.comparisonReply
      ? {
          reply: comparisonState.comparisonReply,
          currentCatalogProduct: executionState.currentCatalogProduct ?? null,
          factContext: null,
          attachAssets: false,
        }
      : null
  }

  if (executionState.intentState.forceNewSearch || executionState.intentState.loadMoreCatalogRequested) {
    const exitReply = buildApiCatalogExitFocusReply(catalogDecision)
    if (exitReply) {
      return {
        reply: exitReply,
        currentCatalogProduct: null,
        factContext: null,
        attachAssets: false,
      }
    }
  }

  if (!executionState.intentState.forceNewSearch && executionState.currentCatalogProduct?.nome) {
    const advisoryReply = buildApiFocusedCatalogAdvisoryReply(
      message,
      executionState.currentCatalogProduct,
      context,
      semanticCatalogDecision
    )
    if (advisoryReply) {
      return {
        reply: advisoryReply,
        currentCatalogProduct: executionState.currentCatalogProduct,
        factContext: {
          productId: sanitizeString(executionState.currentCatalogProduct.id),
          fields: ["api_advisory"],
          scope: "commercial",
          source: "api_runtime_advisory",
        },
        attachAssets: false,
      }
    }
  }

  if (!executionState.intentState.forceNewSearch && executionState.currentCatalogProduct?.nome) {
    const factualResolution = buildApiCatalogFactualResolution(message, executionState.currentCatalogProduct, context, semanticApiDecision)
    if (factualResolution?.reply) {
      return {
        reply: factualResolution.reply,
        currentCatalogProduct: executionState.currentCatalogProduct,
        factContext: factualResolution.factContext ?? null,
        attachAssets: false,
      }
    }
  }

  if (hasApiExplicitLookupSignal(message, deps) || ["api_fact_query", "api_status_query"].includes(String(semanticApiDecision?.kind || ""))) {
    return null
  }

  if (!executionState.intentState.forceNewSearch && executionState.currentCatalogProduct?.nome) {
    return {
      reply: buildApiSelectedCatalogReply(executionState.currentCatalogProduct),
      currentCatalogProduct: executionState.currentCatalogProduct,
      factContext: null,
      attachAssets: false,
    }
  }

  return null
}

function getApiSearchTermFromSemanticDecision(decision = null) {
  const values =
    decision?.parameterValues && typeof decision.parameterValues === "object" && !Array.isArray(decision.parameterValues)
      ? Object.values(decision.parameterValues)
          .map((value) => sanitizeString(value))
          .filter(Boolean)
      : []

  return values[0] || ""
}

export function resolveApiCatalogReply(message, context = {}, apis = [], customDeps = {}) {
  return resolveApiCatalogReplyResolution(message, context, apis, customDeps)?.reply ?? null
}

function formatApiDateValue(value) {
  const textValue = String(value ?? "").trim()
  if (!textValue) return null

  const date = new Date(textValue)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

function formatCurrencyValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(value)
  }

  const textValue = String(value ?? "").trim()
  if (!textValue) return null

  const numeric = textValue
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".")
  const parsed = Number(numeric)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(parsed)
}

function isAnalyticalQuery(message, deps) {
  const normalized = deps.normalizeText(message)
  return ANALYTICAL_QUERY_SIGNALS.some((signal) => normalized.includes(signal))
}

function formatApiFieldLabel(path) {
  return String(path || "")
    .split(".")
    .pop()
    .replace(/_/g, " ")
    .trim()
}

function formatApiFieldValue(fieldName, value, deps) {
  const normalizedField = deps.normalizeText(fieldName)
  const formattedDate = formatApiDateValue(value)
  const formattedCurrency = formatCurrencyValue(value)

  if (formattedDate && /(data|prazo|previsao)/.test(normalizedField)) {
    return formattedDate
  }

  if (formattedCurrency && /(valor|preco|avaliacao|lance|custo|roi|lucro)/.test(normalizedField)) {
    return formattedCurrency
  }

  return String(value ?? "").trim()
}

function formatDirectFieldReply(fieldName, value, deps) {
  const normalizedField = deps.normalizeText(fieldName)
  const formattedValue = formatApiFieldValue(fieldName, value, deps)

  if (!formattedValue) {
    return null
  }

  if (normalizedField.endsWith("matricula")) return `Matricula: ${formattedValue}`
  if (normalizedField.endsWith("cartorio")) return `Cartorio: ${formattedValue}`
  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) return `Pontos de atenção: ${formattedValue}`
  if (normalizedField.endsWith("ocupacao")) return `Ocupacao: ${formattedValue}`
  if (normalizedField.endsWith("valor_minimo")) return `Valor minimo: ${formattedValue}`
  if (normalizedField.endsWith("valor_avaliacao")) return `Valor de avaliacao: ${formattedValue}`
  if (normalizedField.endsWith("valor_mercado")) return `Valor de mercado: ${formattedValue}`
  if (normalizedField.endsWith("preco") || normalizedField.endsWith("valor")) return `Valor: ${formattedValue}`
  if (normalizedField.endsWith("data_leilao")) return `Data do leilao: ${formattedValue}`
  if (normalizedField.endsWith("status")) return `Status: ${formattedValue}`
  if (normalizedField.endsWith("rua")) return `Rua: ${formattedValue}`
  if (normalizedField.endsWith("numero")) return `Numero: ${formattedValue}`
  if (normalizedField.endsWith("cep")) return `CEP: ${formattedValue}`
  if (normalizedField.endsWith("cidade")) return `Cidade: ${formattedValue}`
  if (normalizedField.endsWith("estado")) return `Estado: ${formattedValue}`
  if (normalizedField.endsWith("quartos")) return `Quartos: ${formattedValue}`
  if (normalizedField.endsWith("banheiros")) return `Banheiros: ${formattedValue}`
  if (normalizedField.endsWith("area_total")) return `Area total: ${formattedValue}`
  if (normalizedField.endsWith("area_construida")) return `Area construida: ${formattedValue}`
  if (normalizedField.endsWith("descricao")) return `Detalhes do imovel: ${formattedValue}`
  if (normalizedField.endsWith("resumo")) return `Resumo: ${formattedValue}`
  if (normalizedField.endsWith("analise")) return `Analise: ${formattedValue}`

  return `${formatApiFieldLabel(fieldName)}: ${formattedValue}`
}

function detectApiIntent(message, deps) {
  const tokens = getApiKeywordGroups(message, deps)
  return (
    API_FIELD_INTENTS.find((intent) =>
      intent.triggers.some((trigger) => tokens.directTokens.includes(trigger))
    ) ?? null
  )
}

function detectApiIntentFromHints(targetFieldHints, deps) {
  const normalizedHints = Array.isArray(targetFieldHints)
    ? targetFieldHints.map((item) => deps.normalizeText(item)).filter(Boolean)
    : []

  if (!normalizedHints.length) {
    return null
  }

  return (
    API_FIELD_INTENTS.find((intent) =>
      intent.targets.some((target) => normalizedHints.includes(deps.normalizeText(target)))
    ) ?? null
  )
}

function resolveIntentTargetFields(apiContexts = [], targetNames = [], deps, score = 8) {
  const normalizedTargets = Array.isArray(targetNames)
    ? targetNames.map((item) => normalizeApiFieldName(item, deps)).filter(Boolean)
    : []

  if (!normalizedTargets.length) {
    return []
  }

  const selected = apiContexts.flatMap((api) =>
    (api.campos ?? []).flatMap((field) => {
      const normalizedName = normalizeApiFieldName(field?.nome, deps)
      if (!normalizedName) {
        return []
      }

      const fieldTokens = tokenizeApiField(normalizedName, deps)
      return normalizedTargets.some(
        (target) => normalizedName === target || normalizedName.endsWith(`.${target}`) || normalizedName.endsWith(target) || fieldTokens.includes(target)
      )
        ? [
            {
              ...field,
              apiId: api.apiId,
              apiNome: api.nome,
              score,
            },
          ]
        : []
    })
  )

  return [...new Map(selected.map((item) => [`${item.apiId}:${item.nome}`, item])).values()]
}

function filterFieldsByApiId(fields = [], apiId = "") {
  if (!apiId) {
    return Array.isArray(fields) ? fields : []
  }

  return (Array.isArray(fields) ? fields : []).filter((field) => String(field?.apiId || "").trim() === apiId)
}

function uniqueFieldsByApiAndName(fields = []) {
  return [...new Map((Array.isArray(fields) ? fields : []).map((item) => [`${item.apiId}:${item.nome}`, item])).values()]
}

function countDistinctApiIds(fields = []) {
  return new Set((Array.isArray(fields) ? fields : []).map((item) => String(item?.apiId || "").trim()).filter(Boolean)).size
}

function mergePreferredApiFields(primaryFieldOrApiId, ...fieldGroups) {
  const primaryApiId =
    typeof primaryFieldOrApiId === "string"
      ? primaryFieldOrApiId.trim()
      : String(primaryFieldOrApiId?.apiId || "").trim()
  const merged = uniqueFieldsByApiAndName(fieldGroups.flatMap((group) => group ?? []))

  if (!primaryApiId) {
    return merged
  }

  const scoped = filterFieldsByApiId(merged, primaryApiId)
  return scoped.length ? scoped : merged
}

function normalizeApiValueForLookup(value, deps) {
  const normalized = deps.normalizeText(String(value ?? ""))
  return normalized || ""
}

function resolvePreferredApiIdFromMessage(apiContexts = [], message, deps) {
  const normalizedMessage = deps.normalizeText(message)
  const messageTokens = new Set(deps.buildSearchTokens(message).filter((token) => token.length >= 4))
  if (!normalizedMessage && messageTokens.size === 0) {
    return ""
  }

  const scoredApis = apiContexts
    .map((api) => {
      const score = (api.campos ?? []).reduce((total, field) => {
        const normalizedValue = normalizeApiValueForLookup(field?.valor, deps)
        if (!normalizedValue || normalizedValue.length < 4) {
          return total
        }

        const valueTokens = normalizedValue.split(/[^a-z0-9]+/i).filter((token) => token.length >= 4)
        const hasFullValueMatch = normalizedMessage.includes(normalizedValue)
        const tokenMatches = valueTokens.filter((token) => messageTokens.has(token)).length

        return total + (hasFullValueMatch ? 10 : 0) + tokenMatches * 3
      }, 0)

      return {
        apiId: String(api?.apiId || "").trim(),
        score,
      }
    })
    .filter((item) => item.apiId && item.score > 0)
    .sort((left, right) => right.score - left.score)

  return scoredApis[0]?.apiId ?? ""
}

function getSupportFieldSuffixes(intentId) {
  switch (intentId) {
    case "price":
      return ["data_leilao", "status", "ocupacao", "cidade", "estado"]
    case "date":
      return ["status", "valor_minimo", "valor_avaliacao", "ocupacao"]
    case "risk":
    case "docs":
      return ["status", "ocupacao", "data_leilao", "valor_minimo"]
    case "location":
      return ["cidade", "estado", "tipo", "valor_minimo"]
    case "description":
      return ["tipo", "cidade", "estado", "valor_minimo"]
    case "specs":
      return ["tipo", "cidade", "estado", "valor_minimo"]
    case "status":
      return ["data_leilao", "valor_minimo", "ocupacao"]
    default:
      return ["status", "data_leilao", "valor_minimo"]
  }
}

function findSupportFields(apiContexts, primaryField, message, deps, customDeps = {}) {
  const primaryApiId = String(primaryField?.apiId || "").trim()
  const scopedApiContexts = primaryApiId
    ? apiContexts.filter((api) => String(api?.apiId || "").trim() === primaryApiId)
    : apiContexts
  const hintSupportFields = resolveSupportHintFields(apiContexts, primaryField, customDeps?.supportFieldHints, deps)
  if (hintSupportFields.length) {
    return filterFieldsByApiId(hintSupportFields, primaryApiId).slice(0, 3)
  }

  const intent = detectApiIntentFromHints(customDeps?.targetFieldHints, deps) ?? detectApiIntent(message, deps)
  const intentSupportFields = resolveIntentTargetFields(scopedApiContexts, getSupportFieldSuffixes(intent?.id), deps, 7).filter(
    (field) => deps.normalizeText(field.nome) !== deps.normalizeText(primaryField?.nome)
  )
  if (intentSupportFields.length) {
    return intentSupportFields.slice(0, 3)
  }

  return []
}

function buildContextualDirectReply(primaryField, supportFields, deps) {
  const primaryReply = formatDirectFieldReply(primaryField.nome, primaryField.valor, deps)
  if (!primaryReply) {
    return null
  }

  const supportReplies = supportFields
    .map((field) => formatDirectFieldReply(field.nome, field.valor, deps))
    .filter(Boolean)

  if (!supportReplies.length) {
    return primaryReply
  }

  return [primaryReply, "", "**Contexto util:**", ...supportReplies.map((reply) => `- ${reply}`)].join("\n")
}

function getApiFieldIcon(fieldName, deps) {
  const normalizedField = deps.normalizeText(fieldName)

  if (/(data|prazo|previsao)/.test(normalizedField)) return "[data]"
  if (/(riscos|risco|observacoes)/.test(normalizedField)) return "[risco]"
  if (/(cartorio|matricula|documento)/.test(normalizedField)) return "[doc]"
  if (/(valor|preco|avaliacao|lance|roi|lucro|custo)/.test(normalizedField)) return "[$]"
  if (/(ocupacao|status|disponibilidade|estoque)/.test(normalizedField)) return "[status]"

  return "-"
}

function getApiKeywordGroups(message, deps) {
  const directTokens = deps.buildSearchTokens(message)
  const singularDirectTokens = directTokens.flatMap((token) => [token, deps.singularizeToken(token)])
  const relevantDirectTokens = singularDirectTokens.filter((token) => API_VOCABULARY.has(token))

  const intentTokens = API_FIELD_INTENTS.flatMap((intent) =>
    intent.triggers.some((trigger) => relevantDirectTokens.includes(trigger))
      ? intent.targets
      : []
  )

  return {
    directTokens: [...new Set(relevantDirectTokens)],
    intentTokens: [...new Set(intentTokens.flatMap((token) => [token, deps.singularizeToken(token)]))],
  }
}

function hasApiExplicitLookupSignal(message, deps) {
  const { directTokens, intentTokens } = getApiKeywordGroups(message, deps)
  return directTokens.length > 0 && intentTokens.length > 0
}

function tokenizeApiField(value, deps) {
  return deps
    .normalizeText(String(value || ""))
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
}

function findMatchingApiFields(apiContexts, message, deps) {
  const { directTokens, intentTokens } = getApiKeywordGroups(message, deps)
  if (!directTokens.length) {
    return []
  }

  return apiContexts.flatMap((api) =>
    (api.campos ?? []).flatMap((field) => {
      const normalizedPath = deps.normalizeText(field.nome)
      const normalizedLabel = deps.normalizeText(formatApiFieldLabel(field.nome))
      const leafLabel = normalizedLabel.split(".").at(-1) ?? normalizedLabel
      const fieldTokens = [...new Set([...tokenizeApiField(normalizedPath, deps), ...tokenizeApiField(normalizedLabel, deps)])]

      const directScore = directTokens.reduce((total, keyword) => {
        if (!keyword) return total
        if (leafLabel === keyword) return total + 60
        if (normalizedPath === keyword || normalizedLabel === keyword) return total + 40
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 28
        if (fieldTokens.includes(keyword)) return total + 14
        return total
      }, 0)

      const intentScore = intentTokens.reduce((total, keyword) => {
        if (!keyword) return total
        if (leafLabel === keyword) return total + 22
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 12
        if (fieldTokens.includes(keyword)) return total + 5
        return total
      }, 0)

      if (directScore <= 0) {
        return []
      }

      const score = directScore + intentScore

      return [
        {
          ...field,
          apiId: api.apiId,
          apiNome: api.nome,
          score,
        },
      ]
    })
  )
}

function buildFallbackFields(apiContexts, deps, message, customDeps = {}) {
  const availableApis = apiContexts.filter((api) => Array.isArray(api.campos) && api.campos.length > 0)
  const detectedIntent = detectApiIntentFromHints(customDeps?.targetFieldHints, deps) ?? detectApiIntent(message, deps)
  if (!detectedIntent?.targets?.length) {
    return []
  }

  const preferredFields = detectedIntent?.targets?.length
    ? detectedIntent.targets
    : []

  const selected = preferredFields.flatMap((suffix) =>
    availableApis.flatMap((api) =>
      api.campos.flatMap((field) =>
        deps.normalizeText(field.nome).endsWith(suffix)
          ? [
              {
                ...field,
                apiId: api.apiId,
                apiNome: api.nome,
                score: 1,
              },
            ]
          : []
      )
    )
  )

  if (selected.length) {
    return selected.slice(0, 5)
  }

  return []
}

function buildAnalyticalFallbackFields(apiContexts = [], deps) {
  if (!Array.isArray(apiContexts) || apiContexts.length !== 1) {
    return []
  }

  const preferredSuffixes = [
    "status",
    "riscos",
    "risco",
    "valor_minimo",
    "valor_avaliacao",
    "valor_mercado",
    "preco",
    "valor",
    "data_leilao",
    "previsao_envio",
    "matricula",
    "cartorio",
    "descricao",
    "resumo",
    "roi_estimado",
    "estoque",
  ]
  const [api] = apiContexts
  const selected = preferredSuffixes.flatMap((suffix) =>
    (api.campos ?? []).flatMap((field) =>
      deps.normalizeText(field?.nome).endsWith(suffix)
        ? [
            {
              ...field,
              apiId: api.apiId,
              apiNome: api.nome,
              score: 1,
            },
          ]
        : []
    )
  )

  return uniqueFieldsByApiAndName(selected).slice(0, 6)
}

function resolveApiFieldLookupPlan(message, apiContexts, deps, customDeps = {}) {
  const availableApis = apiContexts.filter(
    (api) => Array.isArray(api.campos) && api.campos.length > 0 && shouldUseApiForFactLookup(api, customDeps)
  )
  if (!availableApis.length) {
    return {
      availableApis: [],
      preferredApiId: "",
      hintMatches: [],
      intentMatches: [],
      supportMatches: [],
      directMatches: [],
      fallbackMatches: [],
      hasStructuredHints: false,
      hasExplicitLookupSignal: false,
      analyticalFallbackFields: [],
    }
  }

  const preferredApiId = resolvePreferredApiIdFromMessage(availableApis, message, deps)
  const rawHintMatches = resolveTargetHintFields(availableApis, customDeps?.targetFieldHints, deps)
  const hintMatches = mergePreferredApiFields(preferredApiId, rawHintMatches)
  const detectedIntent = detectApiIntentFromHints(customDeps?.targetFieldHints, deps) ?? detectApiIntent(message, deps)
  const rawIntentMatches = resolveIntentTargetFields(availableApis, detectedIntent?.targets, deps)
  const intentMatches = mergePreferredApiFields(preferredApiId, rawIntentMatches)
  const hasStructuredHints = hintMatches.length > 0 || intentMatches.length > 0
  const hasExplicitLookupSignal = hasApiExplicitLookupSignal(message, deps)

  if (!hintMatches.length && !intentMatches.length && !hasExplicitLookupSignal) {
    return {
      availableApis,
      preferredApiId,
      hintMatches,
      intentMatches,
      supportMatches: [],
      directMatches: [],
      fallbackMatches: [],
      hasStructuredHints,
      hasExplicitLookupSignal,
      analyticalFallbackFields: customDeps?.allowAnalyticalFallback === true ? buildAnalyticalFallbackFields(availableApis, deps) : [],
    }
  }

  const baseMatches = hintMatches.length ? hintMatches : intentMatches.length ? intentMatches : findMatchingApiFields(availableApis, message, deps)
  const directMatches = mergePreferredApiFields(preferredApiId, baseMatches)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
  const primaryField = directMatches[0] ?? hintMatches[0] ?? intentMatches[0] ?? null
  const supportMatches = primaryField ? findSupportFields(availableApis, primaryField, message, deps, customDeps) : []
  const fallbackMatches =
    !hintMatches.length && !intentMatches.length && !directMatches.length
      ? buildFallbackFields(availableApis, deps, message, customDeps)
      : []

  return {
    availableApis,
    preferredApiId,
    hintMatches,
    intentMatches,
    supportMatches,
    directMatches,
    fallbackMatches,
    hasStructuredHints,
    hasExplicitLookupSignal,
    analyticalFallbackFields: [],
  }
}

function buildDirectApiReply(message, apiContexts, deps, customDeps = {}) {
  const lookupPlan = resolveApiFieldLookupPlan(message, apiContexts, deps, customDeps)
  if (!lookupPlan.availableApis.length) {
    return null
  }

  if (!lookupPlan.hintMatches.length && !lookupPlan.intentMatches.length && !lookupPlan.hasExplicitLookupSignal) {
    return null
  }

  const matches = lookupPlan.directMatches
    .slice(0, 3)

  if (!matches.length) {
    return null
  }

  const topScore = matches[0]?.score ?? 0
  const strongMatches = matches.filter((field) => field.score >= topScore - 3)
  const ambiguousAcrossApis = !lookupPlan.preferredApiId && countDistinctApiIds(strongMatches) > 1

  if (strongMatches.length > 2 || topScore < 20 || ambiguousAcrossApis) {
    return null
  }

  const primaryField = strongMatches[0]
  const supportFields = filterFieldsByApiId(lookupPlan.supportMatches, primaryField.apiId).slice(0, 3)
  const contextualReply = buildContextualDirectReply(primaryField, supportFields, deps)
  if (contextualReply) {
    return contextualReply
  }

  const replies = strongMatches.map((field) => formatDirectFieldReply(field.nome, field.valor, deps)).filter(Boolean)
  return replies.length ? replies.join("\n") : null
}

export function buildFocusedApiContext(message, apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  const availableApis = (apis ?? []).filter(
    (api) => Array.isArray(api.campos) && api.campos.length > 0 && shouldUseApiForFactLookup(api, customDeps)
  )
  const failedApis = (apis ?? []).filter((api) => api.erro)
  if (!availableApis.length && !failedApis.length) {
    return { instructions: "", fields: [], apis: [] }
  }

  const lookupPlan = resolveApiFieldLookupPlan(message, availableApis, deps, customDeps)

  if (!lookupPlan.hintMatches.length && !lookupPlan.intentMatches.length && !lookupPlan.hasExplicitLookupSignal) {
    const analyticalFallbackFields = lookupPlan.analyticalFallbackFields
    if (analyticalFallbackFields.length) {
      return {
        fields: analyticalFallbackFields,
        apis,
        instructions: [
          "Use somente os dados factuais abaixo como fonte da verdade quando a pergunta pedir analise objetiva.",
    "Se a informação pedida não estiver presente, diga isso com clareza.",
          "Campos relevantes:\n" +
            analyticalFallbackFields
              .map((field) => `- ${formatApiFieldLabel(field.nome)} (${field.nome}): ${formatApiFieldValue(field.nome, field.valor, deps)}`)
              .join("\n"),
        ].join("\n\n"),
      }
    }

    return { instructions: failedApis.length ? failedApis.map((api) => `- API indisponível: ${api.nome}. Motivo: ${api.erro}`).join("\n") : "", fields: [], apis: [] }
  }
  const primaryField = lookupPlan.hintMatches[0] ?? lookupPlan.intentMatches[0] ?? lookupPlan.directMatches[0] ?? null
  const selectedFields = lookupPlan.hintMatches.length
    ? mergePreferredApiFields(lookupPlan.preferredApiId ? primaryField : "", lookupPlan.hintMatches, lookupPlan.supportMatches).slice(0, 6)
    : lookupPlan.intentMatches.length
      ? mergePreferredApiFields(lookupPlan.preferredApiId ? primaryField : "", lookupPlan.intentMatches, lookupPlan.supportMatches).slice(0, 6)
      : lookupPlan.directMatches.length
        ? lookupPlan.directMatches.slice(0, 6)
        : lookupPlan.fallbackMatches
  const scopedSelectedFields =
    !lookupPlan.preferredApiId && countDistinctApiIds(selectedFields) > 1 ? [] : selectedFields
  const fieldLines = scopedSelectedFields.map(
    (field) => `- ${formatApiFieldLabel(field.nome)} (${field.nome}): ${formatApiFieldValue(field.nome, field.valor, deps)}`
  )
  const failedLines = failedApis.map((api) => `- API indisponível: ${api.nome}. Motivo: ${api.erro}`)

  return {
    fields: scopedSelectedFields,
    apis: scopedSelectedFields.length ? apis : [],
    instructions: [
      scopedSelectedFields.length ? "Use somente os dados factuais abaixo como fonte da verdade quando a pergunta for objetiva." : "",
      scopedSelectedFields.length ? "Se a informação pedida não estiver presente, diga isso com clareza." : "",
      fieldLines.length ? "Campos relevantes:\n" + fieldLines.join("\n") : "",
      failedLines.length ? "APIs indisponíveis:\n" + failedLines.join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  }
}

export function buildApiFallbackReply(message, apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  const analytical = isAnalyticalQuery(message, deps)
  const directReply = buildDirectApiReply(message, apis, deps, customDeps)
  const missingRequiredFieldsReply = buildMissingRequiredFieldsReply(message, apis, deps, customDeps)

  if (directReply && !analytical) {
    return directReply
  }

  if (missingRequiredFieldsReply && !analytical) {
    return missingRequiredFieldsReply
  }

  if (!analytical && !(Array.isArray(customDeps?.targetFieldHints) && customDeps.targetFieldHints.length) && !hasApiExplicitLookupSignal(message, deps)) {
    return null
  }

  const focused = buildFocusedApiContext(message, apis, {
    ...customDeps,
    allowAnalyticalFallback: analytical,
  })
  if (!focused.fields.length) {
    return null
  }

  if (analytical) {
    const highlights = focused.fields
      .slice(0, 4)
      .map(
        (field) =>
          `${getApiFieldIcon(field.nome, deps)} ${formatApiFieldLabel(field.nome)}: ${formatApiFieldValue(field.nome, field.valor, deps)}`
      )

    return [
      "Conclusao:",
      "Ha base para uma leitura inicial, mas a decisao depende de como esses pontos pesam no seu contexto.",
      "",
      "Motivos:",
      ...highlights,
      "",
      "Próximo passo:",
      "Se quiser, eu sigo pelo criterio que mais pesa agora, como risco, documentos, custo, retorno ou prazo.",
    ].join("\n")
  }

  return focused.fields
    .slice(0, 3)
    .map((field) => formatDirectFieldReply(field.nome, field.valor, deps))
    .filter(Boolean)
    .join("\n")
}

export const API_RUNTIME_FACTUAL_SIGNALS = DIRECT_REPLY_FACTUAL_SIGNALS
