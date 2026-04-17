import { buildSearchTokens, normalizeText, singularizeToken } from "@/lib/chat/text-utils"

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

const API_KEYWORD_GROUPS = [
  ["endereco", "rua", "numero", "complemento", "cep", "cidade", "estado", "localizacao"],
  ["valor", "preco", "avaliacao", "minimo", "mercado", "lance", "roi", "lucro", "custo"],
  ["leilao", "data", "prazo", "previsao", "agenda", "status"],
  ["ocupacao", "ocupado", "desocupado", "disponibilidade", "estoque"],
  ["matricula", "cartorio", "juridico", "documento", "observacoes", "risco", "riscos"],
  ["quarto", "quartos", "banheiro", "banheiros", "area", "construida", "total", "tipo", "propriedade"],
  ["resumo", "descricao", "detalhe", "detalhes", "analise"],
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

function getDeps(deps = {}) {
  return {
    normalizeText: deps.normalizeText ?? normalizeText,
    buildSearchTokens: deps.buildSearchTokens ?? buildSearchTokens,
    singularizeToken: deps.singularizeToken ?? singularizeToken,
  }
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

function isApiContinuationMessage(message, deps) {
  const normalized = deps.normalizeText(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) return false
  if (normalized.length > 48) return false

  const words = normalized.split(" ").filter(Boolean)
  if (words.length > 8) return false

  return !/^(oi|ola|bom dia|boa tarde|boa noite)$/.test(normalized)
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

  if (normalizedField.endsWith("matricula")) return `A matricula informada e ${formattedValue}.`
  if (normalizedField.endsWith("cartorio")) return `O cartorio informado e ${formattedValue}.`
  if (normalizedField.endsWith("riscos") || normalizedField.endsWith("risco")) return `Os riscos informados sao ${formattedValue}.`
  if (normalizedField.endsWith("ocupacao")) return `A ocupacao informada e ${formattedValue}.`
  if (normalizedField.endsWith("valor_minimo")) return `O valor minimo informado e ${formattedValue}.`
  if (normalizedField.endsWith("valor_avaliacao")) return `O valor de avaliacao informado e ${formattedValue}.`
  if (normalizedField.endsWith("valor_mercado")) return `O valor de mercado informado e ${formattedValue}.`
  if (normalizedField.endsWith("preco") || normalizedField.endsWith("valor")) return `O valor informado e ${formattedValue}.`
  if (normalizedField.endsWith("data_leilao")) return `A data informada e ${formattedValue}.`
  if (normalizedField.endsWith("status")) return `O status atual informado e ${formattedValue}.`
  if (normalizedField.endsWith("rua")) return `A rua informada e ${formattedValue}.`
  if (normalizedField.endsWith("numero")) return `O numero informado e ${formattedValue}.`
  if (normalizedField.endsWith("cep")) return `O CEP informado e ${formattedValue}.`
  if (normalizedField.endsWith("cidade")) return `A cidade informada e ${formattedValue}.`
  if (normalizedField.endsWith("estado")) return `O estado informado e ${formattedValue}.`
  if (normalizedField.endsWith("quartos")) return `A quantidade de quartos informada e ${formattedValue}.`
  if (normalizedField.endsWith("banheiros")) return `A quantidade de banheiros informada e ${formattedValue}.`
  if (normalizedField.endsWith("area_total")) return `A area total informada e ${formattedValue}.`
  if (normalizedField.endsWith("area_construida")) return `A area construida informada e ${formattedValue}.`
  if (normalizedField.endsWith("descricao")) return `A descricao encontrada e: ${formattedValue}`
  if (normalizedField.endsWith("resumo")) return `O resumo encontrado e: ${formattedValue}`
  if (normalizedField.endsWith("analise")) return `A analise encontrada e: ${formattedValue}`

  return `${formatApiFieldLabel(fieldName)}: ${formattedValue}`
}

function detectApiIntent(message, deps) {
  const normalizedMessage = deps.normalizeText(message)
  const tokens = getApiKeywordGroups(message, deps)
  return (
    API_FIELD_INTENTS.find((intent) =>
      intent.triggers.some(
        (trigger) =>
          normalizedMessage.includes(trigger) ||
          tokens.directTokens.includes(trigger) ||
          tokens.intentTokens.includes(trigger)
      )
    ) ?? null
  )
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

function findSupportFields(apiContexts, primaryField, message, deps) {
  const intent = detectApiIntent(message, deps)
  const supportSuffixes = getSupportFieldSuffixes(intent?.id)
  const primaryName = deps.normalizeText(primaryField?.nome)

  return apiContexts
    .flatMap((api) =>
      (api.campos ?? []).flatMap((field) => {
        const normalizedName = deps.normalizeText(field.nome)
        if (!normalizedName || normalizedName === primaryName) {
          return []
        }

        const matchedSuffix = supportSuffixes.find((suffix) => normalizedName.endsWith(suffix))
        if (!matchedSuffix) {
          return []
        }

        return [
          {
            ...field,
            apiId: api.apiId,
            apiNome: api.nome,
            supportScore: supportSuffixes.length - supportSuffixes.indexOf(matchedSuffix),
          },
        ]
      })
    )
    .sort((left, right) => right.supportScore - left.supportScore || left.nome.localeCompare(right.nome))
    .filter((field, index, list) => list.findIndex((item) => item.nome === field.nome) === index)
    .slice(0, 2)
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

  return [primaryReply, `Contexto util: ${supportReplies.join(" ")}`].join("\n")
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
  const normalizedMessage = deps.normalizeText(message)
  const directTokens = deps.buildSearchTokens(message)
  const singularDirectTokens = directTokens.flatMap((token) => [token, deps.singularizeToken(token)])

  const intentTokens = API_FIELD_INTENTS.flatMap((intent) =>
    intent.triggers.some((trigger) => singularDirectTokens.includes(trigger) || normalizedMessage.includes(trigger))
      ? intent.targets
      : []
  )

  const matchedGroup =
    API_KEYWORD_GROUPS.find(
      (group) =>
        group.some((keyword) => normalizedMessage.includes(keyword)) ||
        group.some((keyword) => singularDirectTokens.includes(keyword))
    ) ?? []

  return {
    directTokens: [...new Set(singularDirectTokens)],
    intentTokens: [...new Set(intentTokens.flatMap((token) => [token, deps.singularizeToken(token)]))],
    relatedTokens: matchedGroup.filter((keyword) => !singularDirectTokens.includes(keyword)),
  }
}

function findMatchingApiFields(apiContexts, message, deps) {
  const { directTokens, intentTokens, relatedTokens } = getApiKeywordGroups(message, deps)

  return apiContexts.flatMap((api) =>
    (api.campos ?? []).flatMap((field) => {
      const normalizedPath = deps.normalizeText(field.nome)
      const normalizedLabel = deps.normalizeText(formatApiFieldLabel(field.nome))
      const leafLabel = normalizedLabel.split(".").at(-1) ?? normalizedLabel

      const directScore = directTokens.reduce((total, keyword) => {
        if (!keyword) return total
        if (leafLabel === keyword) return total + 60
        if (normalizedPath === keyword || normalizedLabel === keyword) return total + 40
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 28
        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) return total + 16
        return total
      }, 0)

      const intentScore = intentTokens.reduce((total, keyword) => {
        if (!keyword) return total
        if (leafLabel === keyword) return total + 22
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 12
        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) return total + 6
        return total
      }, 0)

      const relatedScore = relatedTokens.reduce((total, keyword) => {
        if (!keyword) return total
        if (normalizedPath === keyword || normalizedLabel === keyword) return total + 6
        if (normalizedPath.endsWith(`.${keyword}`) || normalizedPath.endsWith(keyword)) return total + 4
        if (normalizedPath.includes(keyword) || normalizedLabel.includes(keyword)) return total + 2
        return total
      }, 0)

      const score = directScore + intentScore + relatedScore
      if (score <= 0) {
        return []
      }

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

function buildFallbackFields(apiContexts, deps, message) {
  const normalizedMessage = deps.normalizeText(message)
  const availableApis = apiContexts.filter((api) => Array.isArray(api.campos) && api.campos.length > 0)
  const preferredFields = [
    "riscos",
    "risco",
    "cartorio",
    "matricula",
    "data_leilao",
    "status",
    "valor_minimo",
    "valor_avaliacao",
    "valor_mercado",
    "valor",
    "preco",
    "roi_estimado",
    "titulo",
    "nome",
    "descricao",
    "resumo",
  ]

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

  if (isApiContinuationMessage(normalizedMessage, deps)) {
    return availableApis
      .flatMap((api) =>
        api.campos.slice(0, 5).map((field) => ({
          ...field,
          apiId: api.apiId,
          apiNome: api.nome,
          score: 1,
        }))
      )
      .slice(0, 5)
  }

  return []
}

function buildDirectApiReply(message, apiContexts, deps) {
  const availableApis = apiContexts.filter((api) => Array.isArray(api.campos) && api.campos.length > 0)
  if (!availableApis.length) {
    return null
  }

  const matches = findMatchingApiFields(availableApis, message, deps)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 3)

  if (!matches.length) {
    return null
  }

  const topScore = matches[0]?.score ?? 0
  const strongMatches = matches.filter((field) => field.score >= topScore - 3)

  if (strongMatches.length > 2 || topScore < 20) {
    return null
  }

  const primaryField = strongMatches[0]
  const supportFields = findSupportFields(availableApis, primaryField, message, deps)
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

  const matches = findMatchingApiFields(availableApis, message, deps)
    .sort((left, right) => right.score - left.score || left.nome.localeCompare(right.nome))
    .slice(0, 6)

  const selectedFields = matches.length ? matches : buildFallbackFields(availableApis, deps, message)
  const fieldLines = selectedFields.map(
    (field) => `- ${formatApiFieldLabel(field.nome)} (${field.nome}): ${formatApiFieldValue(field.nome, field.valor, deps)}`
  )
  const failedLines = failedApis.map((api) => `- API indisponivel: ${api.nome}. Motivo: ${api.erro}`)

  return {
    fields: selectedFields,
    apis: selectedFields.length ? apis : [],
    instructions: [
      selectedFields.length ? "Use somente os dados factuais abaixo como fonte da verdade quando a pergunta for objetiva." : "",
      selectedFields.length ? "Se a informacao pedida nao estiver presente, diga isso com clareza." : "",
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
  const directReply = buildDirectApiReply(message, apis, deps)

  if (directReply && !analytical) {
    return directReply
  }

  const focused = buildFocusedApiContext(message, apis, deps)
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
