import { buildSearchTokens, normalizeText, singularizeToken } from "@/lib/chat/text-utils"
import { resolveRecentCatalogProductReference } from "@/lib/chat/catalog-follow-up"

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
  "pontos de atencao",
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

function normalizeComparisonMessage(message) {
  return String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function normalizeApiFieldName(name, deps) {
  return deps.normalizeText(String(name || "").replace(/\./g, "_"))
}

function groupApiFieldsAsCatalogItem(api, deps) {
  const fields = Array.isArray(api?.campos) ? api.campos : []
  if (!fields.length) {
    return null
  }

  const fieldMap = new Map(fields.map((field) => [normalizeApiFieldName(field.nome, deps), field.valor]))
  const readField = (...keys) => {
    for (const key of keys) {
      if (fieldMap.has(key)) {
        return fieldMap.get(key)
      }
    }
    return undefined
  }
  const id =
    sanitizeString(readField("id")) ||
    sanitizeString(readField("sku")) ||
    sanitizeString(readField("codigo")) ||
    sanitizeString(api?.apiId)
  const nome =
    sanitizeString(readField("nome")) ||
    sanitizeString(readField("titulo")) ||
    sanitizeString(readField("title")) ||
    sanitizeString(readField("produto")) ||
    sanitizeString(readField("sku")) ||
    sanitizeString(api?.nome)
  const preco = sanitizeNumber(readField("preco", "valor"), null)
  const availableQuantity = sanitizeNumber(readField("estoque", "quantidade"), 0)
  const status =
    sanitizeString(readField("status")) ||
    (availableQuantity > 0 ? "disponivel" : "")
  const warranty = sanitizeString(readField("garantia", "warranty"))
  const material = sanitizeString(readField("material"))
  const cor = sanitizeString(readField("cor", "color"))
  const link = sanitizeString(readField("link", "url", "permalink"))
  const imagem = sanitizeString(readField("imagem", "image", "thumbnail"))
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

  return {
    id,
    nome,
    descricao,
    preco,
    link,
    imagem,
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
  }
}

export function extractApiCatalogProducts(apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  return (apis ?? []).map((api) => groupApiFieldsAsCatalogItem(api, deps)).filter(Boolean)
}

export function buildApiCatalogSearchState(apis = [], customDeps = {}) {
  const products = extractApiCatalogProducts(apis, customDeps)
  if (!products.length) {
    return null
  }

  return {
    ultimaBusca: null,
    paginationOffset: 0,
    paginationNextOffset: 0,
    paginationPoolLimit: products.length,
    paginationHasMore: false,
    paginationTotal: products.length,
    produtoAtual: products.length === 1 ? products[0] : null,
    ultimosProdutos: products,
  }
}

function detectApiCatalogComparisonIntent(message) {
  const normalized = normalizeComparisonMessage(message)
  if (/\b(vale mais a pena|qual e melhor|qual melhor|melhor opcao|compensa mais|qual voce indica|qual voce recomenda)\b/.test(normalized)) {
    return "best_choice"
  }
  if (/\b(mais caro|maior preco|maior valor|produto mais caro)\b/.test(normalized)) {
    return "highest_price"
  }
  if (/\b(mais barato|menor preco|menor valor|produto mais barato)\b/.test(normalized)) {
    return "lowest_price"
  }
  return null
}

function normalizeApiComparisonMode(value) {
  return ["best_choice", "highest_price", "lowest_price"].includes(String(value || "")) ? String(value) : null
}

function isPriceRankingComparisonMode(value) {
  return value === "highest_price" || value === "lowest_price"
}

function resolveApiCatalogComparisonIndexes(message, products) {
  const normalized = normalizeComparisonMessage(message)
  const patterns = [
    { pattern: /\b1\b|\bum\b|\bprimeiro\b|\bprimeira\b/, index: 0 },
    { pattern: /\b2\b|\bsegundo\b|\bsegunda\b/, index: 1 },
    { pattern: /\b3\b|\bterceiro\b|\bterceira\b/, index: 2 },
  ]
  return [...new Set(patterns.filter((item) => item.pattern.test(normalized)).map((item) => item.index))].filter((index) => products[index])
}

function hasRecentApiListContext(contextProducts, products) {
  return (Array.isArray(contextProducts) && contextProducts.length > 1) || (Array.isArray(products) && products.length > 1)
}

function hasTextualApiComparisonAnchor(message, contextProducts, products) {
  const explicitIndexes = resolveApiCatalogComparisonIndexes(message, products)
  if (explicitIndexes.length >= 2) {
    return true
  }

  return hasRecentApiListContext(contextProducts, products)
}

function resolveApiCatalogSemanticComparisonIndexes(indexes, products) {
  return [...new Set((Array.isArray(indexes) ? indexes : []).map((item) => Number(item) - 1))]
    .filter((index) => Number.isInteger(index) && index >= 0 && products[index])
}

function buildApiCatalogAdvantageLines(product) {
  const lines = []
  if (product?.freeShipping) lines.push("frete gratis")
  if (product?.warranty) lines.push(`garantia ${product.warranty}`)
  if (product?.preco != null) lines.push(`preco ${formatCurrencyValue(product.preco)}`)
  if (sanitizeNumber(product?.availableQuantity, 0) > 0) lines.push(`${sanitizeNumber(product.availableQuantity, 0)} em estoque`)
  if (product?.material) lines.push(product.material)
  if (product?.cor) lines.push(product.cor)
  return lines
}

function buildApiCatalogComparisonReply(products, comparisonIntent, indexes) {
  if (!Array.isArray(products) || !products.length || !comparisonIntent) {
    return null
  }

  if (comparisonIntent === "highest_price" || comparisonIntent === "lowest_price") {
    const pricedProducts = products.filter((item) => Number.isFinite(Number(item?.preco)))
    if (!pricedProducts.length) return null
    const selected = pricedProducts.reduce((winner, item) => {
      if (!winner) return item
      return comparisonIntent === "lowest_price"
        ? Number(item.preco) < Number(winner.preco) ? item : winner
        : Number(item.preco) > Number(winner.preco) ? item : winner
    }, null)
    const intro = comparisonIntent === "lowest_price" ? "Dos itens que te mostrei, o mais barato e" : "Dos itens que te mostrei, o mais caro e"
    return `${intro} ${selected.nome}: ${formatCurrencyValue(selected.preco)}.`
  }

  if (comparisonIntent === "best_choice" && indexes.length >= 2) {
    const compared = indexes.map((index) => products[index]).filter(Boolean)
    const scored = [...compared].sort((left, right) => {
      const score = (item) =>
        (item?.freeShipping ? 3 : 0) +
        (item?.warranty ? 2 : 0) +
        (sanitizeNumber(item?.availableQuantity, 0) > 0 ? 4 : 0) +
        (Number.isFinite(Number(item?.preco)) ? Math.max(0, 1000 - Number(item.preco)) / 100 : 0)
      return score(right) - score(left)
    })
    const winner = scored[0]
    const runnerUp = scored[1]
    if (!winner?.nome || !runnerUp?.nome) return null
    return [
      `Entre ${winner.nome} e ${runnerUp.nome}, eu iria em ${winner.nome}.`,
      `Ele sai na frente por ${buildApiCatalogAdvantageLines(winner).slice(0, 3).join(", ")}.`,
      `Se quiser, eu tambem posso te dizer qual dos dois faz mais sentido pelo estilo ou pela faixa de preco.`,
    ].join(" ")
  }

  return null
}

function buildApiSelectedCatalogReply(product) {
  if (!product?.nome) {
    return null
  }
  return [
    `${product.nome} parece a opcao mais consistente para seguir agora.`,
    product.preco != null ? `Preco atual: ${formatCurrencyValue(product.preco)}.` : "",
    sanitizeNumber(product.availableQuantity, 0) > 0 ? `Tenho ${sanitizeNumber(product.availableQuantity, 0)} em estoque.` : "",
    product.freeShipping ? "Esse item esta com frete gratis." : "",
    product.warranty ? `Garantia informada: ${product.warranty}.` : "",
    product.link ? "Se quiser, eu posso te mandar o link direto." : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export function resolveApiCatalogReply(message, context = {}, apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  const contextProducts = Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos.filter(Boolean) : []
  const products = contextProducts.length ? contextProducts : extractApiCatalogProducts(apis, deps)
  if (!products.length) {
    return null
  }

  const semanticApiDecision = customDeps?.semanticApiDecision
  const semanticComparisonMode = normalizeApiComparisonMode(semanticApiDecision?.comparisonMode)
  const textualComparisonIntent = detectApiCatalogComparisonIntent(message)
  const comparisonIntent = semanticComparisonMode ?? textualComparisonIntent
  if (comparisonIntent) {
    const semanticIndexes = resolveApiCatalogSemanticComparisonIndexes(semanticApiDecision?.referencedProductIndexes, products)
    if (!semanticComparisonMode) {
      const textualIndexes = resolveApiCatalogComparisonIndexes(message, products)
      const hasExplicitIndexes = textualIndexes.length >= 2
      const hasRecentListAnchor = Array.isArray(contextProducts) && contextProducts.length > 1
      const allowTextualComparison = isPriceRankingComparisonMode(comparisonIntent)
        ? hasExplicitIndexes || hasRecentListAnchor
        : hasExplicitIndexes
      if (!allowTextualComparison || !hasTextualApiComparisonAnchor(message, contextProducts, products)) {
        return null
      }
    }

    const indexes = semanticIndexes.length ? semanticIndexes : resolveApiCatalogComparisonIndexes(message, products)
    return buildApiCatalogComparisonReply(products, comparisonIntent, indexes)
  }

  const reference = resolveRecentCatalogProductReference(message, {
    ...context,
    catalogo: {
      ...(context?.catalogo && typeof context.catalogo === "object" ? context.catalogo : {}),
      ultimosProdutos: products,
    },
  })

  if (reference.length === 1) {
    return buildApiSelectedCatalogReply(reference[0])
  }

  return null
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
  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) return `Pontos de atencao: ${formattedValue}`
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
  const availableApis = apiContexts.filter((api) => Array.isArray(api.campos) && api.campos.length > 0)
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
  const directMatches = mergePreferredApiFields(baseMatches[0] ?? preferredApiId, baseMatches)
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
  const ambiguousAcrossApis = !lookupPlan.preferredApiId && !lookupPlan.hasStructuredHints && countDistinctApiIds(strongMatches) > 1

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
  const availableApis = (apis ?? []).filter((api) => Array.isArray(api.campos) && api.campos.length > 0)
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
          "Se a informacao pedida nao estiver presente, diga isso com clareza.",
          "Campos relevantes:\n" +
            analyticalFallbackFields
              .map((field) => `- ${formatApiFieldLabel(field.nome)} (${field.nome}): ${formatApiFieldValue(field.nome, field.valor, deps)}`)
              .join("\n"),
        ].join("\n\n"),
      }
    }

    return { instructions: failedApis.length ? failedApis.map((api) => `- API indisponivel: ${api.nome}. Motivo: ${api.erro}`).join("\n") : "", fields: [], apis: [] }
  }
  const primaryField = lookupPlan.hintMatches[0] ?? lookupPlan.intentMatches[0] ?? lookupPlan.directMatches[0] ?? null
  const selectedFields = lookupPlan.hintMatches.length
    ? mergePreferredApiFields(primaryField ?? lookupPlan.hintMatches[0], lookupPlan.hintMatches, lookupPlan.supportMatches).slice(0, 6)
    : lookupPlan.intentMatches.length
      ? mergePreferredApiFields(primaryField ?? lookupPlan.intentMatches[0], lookupPlan.intentMatches, lookupPlan.supportMatches).slice(0, 6)
      : lookupPlan.directMatches.length
        ? lookupPlan.directMatches.slice(0, 6)
        : lookupPlan.fallbackMatches
  const scopedSelectedFields =
    !lookupPlan.preferredApiId && !lookupPlan.hasStructuredHints && countDistinctApiIds(selectedFields) > 1 ? [] : selectedFields
  const fieldLines = scopedSelectedFields.map(
    (field) => `- ${formatApiFieldLabel(field.nome)} (${field.nome}): ${formatApiFieldValue(field.nome, field.valor, deps)}`
  )
  const failedLines = failedApis.map((api) => `- API indisponivel: ${api.nome}. Motivo: ${api.erro}`)

  return {
    fields: scopedSelectedFields,
    apis: scopedSelectedFields.length ? apis : [],
    instructions: [
      scopedSelectedFields.length ? "Use somente os dados factuais abaixo como fonte da verdade quando a pergunta for objetiva." : "",
      scopedSelectedFields.length ? "Se a informacao pedida nao estiver presente, diga isso com clareza." : "",
      fieldLines.length ? "Campos relevantes:\n" + fieldLines.join("\n") : "",
      failedLines.length ? "APIs indisponiveis:\n" + failedLines.join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  }
}

export function buildApiFallbackReply(message, apis = [], customDeps = {}) {
  const deps = getDeps(customDeps)
  const analytical = isAnalyticalQuery(message, deps)
  const directReply = buildDirectApiReply(message, apis, deps, customDeps)

  if (directReply && !analytical) {
    return directReply
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
      "Proximo passo:",
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
