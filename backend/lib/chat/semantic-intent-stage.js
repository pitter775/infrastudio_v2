function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function normalizeText(value = "") {
  return sanitizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function slugifyPricingName(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parsePriceAmountFromLabel(value = "") {
  const match = sanitizeString(value).match(/r\$\s*([\d.]+(?:,\d{1,2})?)/i)
  if (!match?.[1]) {
    return null
  }

  const amount = Number(match[1].replace(/\./g, "").replace(",", "."))
  return Number.isFinite(amount) ? amount : null
}

function parseCreditLimitFromLines(lines = []) {
  const creditLine = lines.find((line) => /\bcréditos?\b/i.test(normalizeText(line)))
  const match = normalizeText(creditLine).match(/([\d.]+)\s*créditos?/i)
  if (!match?.[1]) {
    return null
  }

  const amount = Number(match[1].replace(/\./g, ""))
  return Number.isFinite(amount) ? amount : null
}

function extractMonthlyPlansSection(sourceText = "") {
  const text = sanitizeString(sourceText)
  const sectionStart = text.search(/planos?\s+mensais/i)
  if (sectionStart < 0) {
    return text
  }

  const tail = text.slice(sectionStart)
  const sectionEnd = tail.search(/\n\s*(regras importantes|desenvolvimento sob medida|projetos sob medida|quando o cliente demonstrar)/i)
  return sectionEnd > 0 ? tail.slice(0, sectionEnd) : tail
}

export function extractDeterministicPricingCatalogFromAgentText(sourceText = "") {
  const section = extractMonthlyPlansSection(sourceText)
  const lines = section
    .split(/\r?\n/)
    .map((line) => sanitizeString(line))
    .filter(Boolean)
  const items = []

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index]
    const priceLabel = lines[index + 1]
    if (!/^[\p{L}\d][\p{L}\d\s._-]{1,40}$/u.test(name) || !/^r\$\s*[\d.]+(?:,\d{1,2})?\s*(?:\/\s*mes|por\s+mes)?$/i.test(normalizeText(priceLabel))) {
      continue
    }

    const slug = slugifyPricingName(name)
    if (!slug) {
      continue
    }

    const detailLines = []
    for (let detailIndex = index + 2; detailIndex < lines.length; detailIndex += 1) {
      if (/^r\$\s*/i.test(normalizeText(lines[detailIndex]))) {
        break
      }
      if (
        detailIndex + 1 < lines.length &&
        /^[\p{L}\d][\p{L}\d\s._-]{1,40}$/u.test(lines[detailIndex]) &&
        /^r\$\s*[\d.]+(?:,\d{1,2})?/i.test(normalizeText(lines[detailIndex + 1]))
      ) {
        break
      }
      detailLines.push(lines[detailIndex])
    }

    items.push({
      slug,
      name,
      matchAny: [name, slug],
      priceLabel,
      attendanceLimit: null,
      agentLimit: null,
      creditLimit: parseCreditLimitFromLines(detailLines),
      whatsappIncluded: null,
      supportLevel: "",
      features: detailLines.slice(0, 4),
      channels: [],
    })
  }

  const uniqueItems = [...new Map(items.map((item) => [item.slug, item])).values()]
    .filter((item) => item.name && item.priceLabel && parsePriceAmountFromLabel(item.priceLabel) != null)

  if (uniqueItems.length < 2) {
    return null
  }

  return {
    enabled: true,
    items: uniqueItems,
    extractionMode: "deterministic_agent_text",
  }
}

function extractResponseText(payload) {
  return (
    payload?.output_text ??
    payload?.output?.flatMap((item) => item?.content ?? [])?.find((item) => item?.type === "output_text")?.text ??
    ""
  )
}

function parseResponseJson(payload) {
  const rawText = extractResponseText(payload)
  if (!rawText) {
    return null
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

export function buildCatalogDecisionFromSemanticIntent(input) {
  const semanticIntent = input?.semanticIntent
  const recentProducts = Array.isArray(input?.recentProducts) ? input.recentProducts : []
  const hasCurrentProduct = Boolean(input?.currentCatalogProduct?.nome)
  if (!semanticIntent || semanticIntent.confidence < 0.7) {
    return null
  }

  if (["product_question", "current_product_question", "product_detail"].includes(semanticIntent.intent)) {
    if (!hasCurrentProduct && recentProducts.length > 1) {
      return {
        kind: "recent_product_reference_unresolved",
        confidence: semanticIntent.confidence,
        reason: semanticIntent.reason ?? "Cliente fez pergunta factual sobre a lista recente sem item unico resolvido.",
        matchedProducts: recentProducts.slice(0, 3),
        targetFactHints: Array.isArray(semanticIntent.targetFactHints)
          ? semanticIntent.targetFactHints.map((item) => sanitizeString(item)).filter(Boolean)
          : [],
        factScope: sanitizeString(semanticIntent.factScope),
        usedLlm: Boolean(semanticIntent.usedLlm),
        shouldBlockNewSearch: true,
      }
    }

    return {
      kind: "non_catalog_message",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Pergunta sobre produto em foco.",
      matchedProducts: [],
      targetFactHints: Array.isArray(semanticIntent.targetFactHints)
        ? semanticIntent.targetFactHints.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      factScope: sanitizeString(semanticIntent.factScope),
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: true,
    }
  }

  if (semanticIntent.intent === "current_product_commercial_advice" && hasCurrentProduct) {
    return {
      kind: "current_product_commercial_advice",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu avaliacao comercial do produto em foco.",
      matchedProducts: [],
      adviceType: sanitizeString(semanticIntent.adviceType) || "other",
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: true,
    }
  }

  if (semanticIntent.intent === "current_product_affirmation" && hasCurrentProduct) {
    return {
      kind: "current_product_affirmation",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente sinalizou interesse em continuar com o produto em foco.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: true,
    }
  }

  if (semanticIntent.intent === "recent_product_reference") {
    const referencedIds = Array.isArray(semanticIntent.referencedProductIds)
      ? semanticIntent.referencedProductIds.map((item) => sanitizeString(item)).filter(Boolean)
      : []
    const matchedProducts = referencedIds.length
      ? recentProducts.filter((item) => referencedIds.includes(sanitizeString(item?.id)))
      : []

    if (matchedProducts.length) {
      return {
        kind: "recent_product_reference",
        confidence: semanticIntent.confidence,
        reason: semanticIntent.reason ?? "Cliente referenciou um item recente do catálogo.",
        matchedProducts,
        usedLlm: Boolean(semanticIntent.usedLlm),
        shouldBlockNewSearch: true,
      }
    }
  }

  if (semanticIntent.intent === "recent_product_reference_ambiguous") {
    const referencedIds = Array.isArray(semanticIntent.referencedProductIds)
      ? semanticIntent.referencedProductIds.map((item) => sanitizeString(item)).filter(Boolean)
      : []
    const matchedProducts = referencedIds.length
      ? recentProducts.filter((item) => referencedIds.includes(sanitizeString(item?.id)))
      : []

    if (matchedProducts.length > 1) {
      return {
        kind: "recent_product_reference_ambiguous",
        confidence: semanticIntent.confidence,
        reason: semanticIntent.reason ?? "Cliente referenciou mais de um item recente do catálogo.",
        matchedProducts,
        usedLlm: Boolean(semanticIntent.usedLlm),
        shouldBlockNewSearch: true,
      }
    }
  }

  if (semanticIntent.intent === "recent_product_reference_unresolved" && recentProducts.length) {
    return {
      kind: "recent_product_reference_unresolved",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente segue na lista recente sem item unico resolvido.",
      matchedProducts: recentProducts.slice(0, 3),
      targetFactHints: Array.isArray(semanticIntent.targetFactHints)
        ? semanticIntent.targetFactHints.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      factScope: sanitizeString(semanticIntent.factScope),
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: true,
    }
  }

  if (semanticIntent.intent === "same_type_search" && sanitizeString(semanticIntent.targetType)) {
    return {
      kind: "same_type_search",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu outro item do mesmo tipo.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: [sanitizeString(semanticIntent.targetType)],
      excludeCurrentProduct: semanticIntent.excludeCurrentProduct !== false,
    }
  }

  if (semanticIntent.intent === "similar_items_search") {
    return {
      kind: "similar_items_search",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu itens parecidos com o produto atual.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: sanitizeString(semanticIntent.targetType) ? [sanitizeString(semanticIntent.targetType)] : [],
      excludeCurrentProduct: semanticIntent.excludeCurrentProduct !== false,
    }
  }

  if (semanticIntent.intent === "catalog_alternative_search") {
    return {
      kind: "catalog_alternative_search",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu alternativas ao produto em foco.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: sanitizeString(semanticIntent.targetType) ? [sanitizeString(semanticIntent.targetType)] : [],
      excludeCurrentProduct: semanticIntent.excludeCurrentProduct !== false,
      relation: sanitizeString(semanticIntent.relation) || "storewide",
      priceConstraint: sanitizeString(semanticIntent.priceConstraint) || "any",
    }
  }

  if (semanticIntent.intent === "catalog_search_refinement" && sanitizeString(semanticIntent.targetType)) {
    return {
      kind: "catalog_search_refinement",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente refinou a busca recente com atributo novo.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: [sanitizeString(semanticIntent.targetType)],
      uncoveredTokens: [sanitizeString(semanticIntent.targetType)],
      excludeCurrentProduct: semanticIntent.excludeCurrentProduct === true,
    }
  }

  if (semanticIntent.intent === "new_catalog_search" && sanitizeString(semanticIntent.targetType)) {
    return {
      kind: "catalog_search_refinement",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente iniciou uma nova busca de catálogo.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: [sanitizeString(semanticIntent.targetType)],
      uncoveredTokens: [sanitizeString(semanticIntent.targetType)],
      excludeCurrentProduct: false,
    }
  }

  if (semanticIntent.intent === "catalog_browse") {
    return {
      kind: "catalog_browse",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu sugestões amplas do catálogo.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: [],
      uncoveredTokens: [],
      excludeCurrentProduct: false,
    }
  }

  if (semanticIntent.intent === "catalog_load_more") {
    if (sanitizeString(semanticIntent.targetType)) {
      return {
        kind: "catalog_search_refinement",
        confidence: semanticIntent.confidence,
        reason: semanticIntent.reason ?? "Cliente pediu uma busca de catálogo com tipo concreto.",
        matchedProducts: [],
        usedLlm: Boolean(semanticIntent.usedLlm),
        shouldBlockNewSearch: false,
        searchCandidates: [sanitizeString(semanticIntent.targetType)],
        uncoveredTokens: [sanitizeString(semanticIntent.targetType)],
        excludeCurrentProduct: false,
      }
    }

    return {
      kind: "catalog_load_more",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu mais opções da busca recente.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
    }
  }

  return null
}

export function buildBillingDecisionFromSemanticIntent(input) {
  const semanticIntent = input?.semanticIntent
  if (!semanticIntent || semanticIntent.confidence < 0.7) {
    return null
  }

  if (
    [
      "pricing_overview",
      "highest_priced_plan",
      "lowest_priced_plan",
      "plan_comparison",
      "specific_plan_question",
      "plan_limit_question",
      "plan_feature_question",
      "plan_recommendation",
    ].includes(semanticIntent.intent)
  ) {
    return {
      kind: semanticIntent.intent,
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Intencao de pricing estruturado.",
      requestedPlanNames: Array.isArray(semanticIntent.requestedPlanNames)
        ? semanticIntent.requestedPlanNames.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      targetField: sanitizeString(semanticIntent.targetField),
      targetFields: Array.isArray(semanticIntent.targetFields)
        ? semanticIntent.targetFields.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      usedLlm: Boolean(semanticIntent.usedLlm),
    }
  }

  return null
}

export function buildApiDecisionFromSemanticIntent(input) {
  const semanticIntent = input?.semanticIntent
  if (!semanticIntent) {
    return null
  }

  if (["api_fact_query", "api_status_query", "api_comparison", "api_create_record", "api_catalog_search"].includes(semanticIntent.intent)) {
    const parameterValues = normalizeSemanticApiParameterValues(semanticIntent.parameterValues)
    const confidence = Number(semanticIntent.confidence ?? 0) || 0
    const minimumConfidence =
      semanticIntent.intent === "api_catalog_search" && Object.keys(parameterValues).length > 0
        ? 0.55
        : 0.7

    if (confidence < minimumConfidence) {
      return null
    }

    return {
      kind: semanticIntent.intent,
      confidence,
      reason: semanticIntent.reason ?? "Intencao estruturada de API runtime.",
      targetFieldHints: Array.isArray(semanticIntent.targetFieldHints)
        ? semanticIntent.targetFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      supportFieldHints: Array.isArray(semanticIntent.supportFieldHints)
        ? semanticIntent.supportFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      comparisonMode: sanitizeString(semanticIntent.comparisonMode),
      apiId: sanitizeString(semanticIntent.apiId),
      intentType: normalizeSemanticApiIntentType(semanticIntent.intentType),
      parameterValues,
      referencedProductIndexes: Array.isArray(semanticIntent.referencedProductIndexes)
        ? semanticIntent.referencedProductIndexes
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item >= 1)
        : [],
      usedLlm: Boolean(semanticIntent.usedLlm),
    }
  }

  return null
}

const SEMANTIC_API_INTENT_TYPES = new Set([
  "create_record",
  "lookup_by_identifier",
  "knowledge_search",
  "catalog_search",
  "generic_fact",
])

function normalizeSemanticApiIntentType(value) {
  const normalized = sanitizeString(value).toLowerCase()
  return SEMANTIC_API_INTENT_TYPES.has(normalized) ? normalized : "generic_fact"
}

function normalizeSemanticApiParameterValues(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((item) => [sanitizeString(item?.name), sanitizeString(item?.value)])
        .filter(([name, itemValue]) => name && itemValue),
    )
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, itemValue]) => [sanitizeString(key), sanitizeString(itemValue)])
        .filter(([key, itemValue]) => key && itemValue),
    )
  }

  return {}
}

export async function extractSemanticPricingCatalogFromAgentText(input = {}) {
  const sourceText = sanitizeString(input?.sourceText)
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"

  if (!sourceText) {
    return null
  }

  const deterministicCatalog = extractDeterministicPricingCatalogFromAgentText(sourceText)
  if (deterministicCatalog?.items?.length) {
    return deterministicCatalog
  }

  if (!openAiKey) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "Extraia um catálogo estruturado de planos/preços a partir do texto do agente.",
            "Retorne somente JSON valido.",
            'Schema: {"enabled":true|false,"items":[{"slug":"string","name":"string","matchAny":["string"],"priceLabel":"string","attendanceLimit":0,"agentLimit":0,"creditLimit":0,"whatsappIncluded":true,"supportLevel":"string","features":["string"],"channels":["string"]}]}.',
            "Use enabled=true apenas quando houver pelo menos um plano ou valor identificavel no texto.",
            "Cada item precisa ter nome e priceLabel.",
            "Use slug curto, estavel e em minusculas.",
            "matchAny deve conter variações literais úteis do plano, incluindo o próprio nome.",
            "Se o texto trouxer limites, créditos, quantidade de agentes, canais ou suporte, preencha esses campos.",
            "Quando um dado não existir no texto, retorne null, false ou lista vazia conforme o schema.",
            "Não invente preço nem plano que não esteja claramente no texto.",
            "Ignore texto comercial generico sem valores concretos.",
          ].join("\n"),
        },
        {
          role: "user",
          content: sourceText.slice(0, 8000),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "semantic_pricing_catalog",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              enabled: {
                type: "boolean",
              },
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    slug: { type: "string" },
                    name: { type: "string" },
                    matchAny: {
                      type: "array",
                      items: { type: "string" },
                    },
                    priceLabel: { type: "string" },
                    attendanceLimit: { type: ["number", "null"] },
                    agentLimit: { type: ["number", "null"] },
                    creditLimit: { type: ["number", "null"] },
                    whatsappIncluded: { type: ["boolean", "null"] },
                    supportLevel: { type: "string" },
                    features: {
                      type: "array",
                      items: { type: "string" },
                    },
                    channels: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "slug",
                    "name",
                    "matchAny",
                    "priceLabel",
                    "attendanceLimit",
                    "agentLimit",
                    "creditLimit",
                    "whatsappIncluded",
                    "supportLevel",
                    "features",
                    "channels",
                  ],
                },
              },
            },
            required: ["enabled", "items"],
          },
        },
      },
      max_output_tokens: 900,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const parsed = parseResponseJson(payload)
  if (!parsed) return null

  const items = Array.isArray(parsed?.items)
    ? parsed.items
        .map((item) => ({
          slug: sanitizeString(item?.slug),
          name: sanitizeString(item?.name),
          matchAny: Array.isArray(item?.matchAny) ? item.matchAny.map((token) => sanitizeString(token)).filter(Boolean) : [],
          priceLabel: sanitizeString(item?.priceLabel),
          attendanceLimit: item?.attendanceLimit == null ? null : Number(item.attendanceLimit),
          agentLimit: item?.agentLimit == null ? null : Number(item.agentLimit),
          creditLimit: item?.creditLimit == null ? null : Number(item.creditLimit),
          whatsappIncluded: typeof item?.whatsappIncluded === "boolean" ? item.whatsappIncluded : null,
          supportLevel: sanitizeString(item?.supportLevel),
          features: Array.isArray(item?.features) ? item.features.map((token) => sanitizeString(token)).filter(Boolean) : [],
          channels: Array.isArray(item?.channels) ? item.channels.map((token) => sanitizeString(token)).filter(Boolean) : [],
        }))
        .filter((item) => item.slug && item.name && item.priceLabel)
    : []

  if (!items.length || parsed?.enabled !== true) {
    return null
  }

  return {
    enabled: true,
    items,
  }
}

export async function extractSemanticBusinessRuntimeFromAgentText(input = {}) {
  const sourceText = sanitizeString(input?.sourceText)
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"

  if (!sourceText || !openAiKey) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "Extraia contexto comercial estruturado a partir do texto do agente.",
            "Retorne somente JSON valido.",
            'Schema: {"business":{"summary":"string","services":["string"]},"sales":{"cta":"string"}}.',
            "Use business.summary como resumo curto do negócio e da proposta comercial.",
            "Use business.services apenas com servicos reais e objetivos citados no texto.",
            "Use sales.cta apenas se houver uma chamada comercial clara de continuidade.",
            "Não invente serviços nem CTA não citados no texto.",
          ].join("\n"),
        },
        {
          role: "user",
          content: sourceText.slice(0, 8000),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "semantic_business_runtime",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              business: {
                type: "object",
                additionalProperties: false,
                properties: {
                  summary: { type: "string" },
                  services: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["summary", "services"],
              },
              sales: {
                type: "object",
                additionalProperties: false,
                properties: {
                  cta: { type: "string" },
                },
                required: ["cta"],
              },
            },
            required: ["business", "sales"],
          },
        },
      },
      max_output_tokens: 520,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const parsed = parseResponseJson(payload)
  if (!parsed) return null

  const services = Array.isArray(parsed?.business?.services)
    ? parsed.business.services.map((item) => sanitizeString(item)).filter(Boolean)
    : []
  const summary = sanitizeString(parsed?.business?.summary)
  const cta = sanitizeString(parsed?.sales?.cta)

  if (!summary && services.length === 0 && !cta) {
    return null
  }

  return {
    business: {
      summary,
      services,
    },
    sales: {
      cta,
    },
  }
}

export async function classifySemanticIntentStage(input = {}) {
  const latestUserMessage = sanitizeString(input?.latestUserMessage)
  const currentCatalogProduct = input?.currentCatalogProduct
  const recentProducts = Array.isArray(input?.recentProducts) ? input.recentProducts : []
  const storefrontContext = input?.storefrontContext && typeof input.storefrontContext === "object" ? input.storefrontContext : null
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"

  if (!latestUserMessage || (!currentCatalogProduct?.nome && !recentProducts.length && !storefrontContext) || !openAiKey) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "Classifique a mensagem do cliente no contexto de catálogo de produtos.",
            "Retorne somente JSON valido.",
            'Schema: {"intent":"current_product_question|current_product_commercial_advice|current_product_affirmation|recent_product_reference|recent_product_reference_ambiguous|recent_product_reference_unresolved|same_type_search|similar_items_search|catalog_alternative_search|catalog_search_refinement|new_catalog_search|catalog_browse|catalog_load_more|other","confidence":0..1,"reason":"string","targetType":"string","referencedProductIds":["string"],"excludeCurrentProduct":true|false,"targetFactHints":["string"],"factScope":"product|package|shipping|commercial|general|","adviceType":"price_objection|improvement_suggestion|value_assessment|fit_advice|risk_assessment|other|","relation":"same_type|similar|storewide|","priceConstraint":"below_current|any|"}.',
            "Use current_product_commercial_advice quando o cliente pedir uma avaliacao consultiva do produto atual, questionar custo-beneficio, reclamar que esta caro, perguntar riscos, pontos de atencao, o que melhorar/validar antes de comprar ou pedir opiniao comercial sem pedir um campo factual isolado.",
            "Para current_product_commercial_advice, preencha adviceType com price_objection, improvement_suggestion, value_assessment, fit_advice, risk_assessment ou other e deixe targetFactHints vazio, exceto se o cliente tambem pedir um dado factual especifico.",
            "Use current_product_affirmation quando o cliente sinalizar interesse, aceitacao, aprovacao ou vontade de continuar no produto atual sem pedir alternativa, nova busca ou dado especifico.",
            "Use same_type_search apenas quando o cliente pedir outro item do mesmo tipo ou da mesma classe do produto atual.",
            "Quando usar same_type_search, extraia targetType curto e literal, por exemplo saleiro, jarra, xicara, prato.",
            "Use similar_items_search quando o cliente pedir algo parecido, similar, semelhante ou na mesma linha do produto atual, mesmo sem citar o tipo explicitamente.",
            "Em similar_items_search, targetType pode vir vazio quando o tipo precisara ser derivado do proprio produto atual.",
            "Use catalog_alternative_search quando o cliente pedir alternativas ao produto atual, outros produtos ou opcoes fora do item aberto; preencha relation e use priceConstraint=below_current quando ele pedir alternativa mais barata que o produto atual.",
            "Em catalog_alternative_search, não trate o produto atual como alvo da resposta; use-o apenas como referência de tipo/categoria/preço e mantenha excludeCurrentProduct=true.",
            "Use catalog_search_refinement quando o cliente refinar a ultima lista com um atributo novo ou filtro novo, por exemplo inox, azul, madeira, vintage, grande.",
            "Quando usar catalog_search_refinement, extraia targetType curto e literal com o termo novo principal da busca.",
            "Use new_catalog_search quando o cliente iniciar uma nova busca de catálogo, inclusive na vitrine, com um tipo ou termo curto claro, por exemplo saleiro azul, xícara vintage, vaso amarelo.",
            "Use catalog_browse quando o cliente pedir sugestões amplas, ideias, presentes, algo bom/interessante ou recomendação sem informar um tipo concreto de produto. Não use presente, bom, bonito ou interessante como targetType.",
            "Use catalog_load_more quando o cliente pedir mais opções, mais modelos, outras opções, perguntar se tem mais, se são só aqueles itens ou o que tiver, sem mudar o tipo principal da busca.",
            "Não use catalog_load_more quando a mensagem tiver um tipo concreto de produto, como prato, xicara, vaso, saleiro ou bandeja. Nesses casos use new_catalog_search ou catalog_search_refinement com targetType concreto.",
            "Se existir contexto de busca/listagem recente e a conversa estiver em página de detalhe, pedidos como tem mais, só esses, quero ver mais ou me mostra outras opções continuam sendo catalog_load_more, nao current_product_question.",
            "Use recent_product_reference quando o cliente estiver se referindo a um item da lista recente e for possível identificar qual item é.",
            "Use recent_product_reference_ambiguous quando a fala apontar para mais de um item recente de forma plausivel.",
            "Use recent_product_reference_unresolved quando o cliente ainda estiver falando da lista recente, mas sem item unico resolvido.",
            "Se houver lista recente com mais de um item e o cliente fizer pergunta factual curta como garantia, frete, estoque, material, cor, medidas ou detalhes sem indicar qual item, use recent_product_reference_unresolved.",
            "Quando a pergunta for factual sobre atributos do produto, preencha targetFactHints com literais curtos como preco, material, cor, garantia, estoque, frete, link, dimensoes, altura, largura, comprimento, profundidade, diametro, peso, capacidade ou detalhes.",
            "Use factScope=package apenas quando o cliente pedir embalagem ou medidas/peso de envio. Para atributos fisicos normais prefira factScope=product.",
            "Em pedidos amplos como qual tamanho, use targetFactHints=['dimensoes'] em vez de explodir todos os campos.",
            "Quando usar recent_product_reference, preencha referencedProductIds apenas com ids reais da lista recente.",
            "Não invente targetType. Se não tiver certeza, retorne other.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            message: latestUserMessage,
            conversationMode: sanitizeString(input?.context?.conversation?.mode),
            storefrontContext: storefrontContext
              ? {
                  kind: sanitizeString(storefrontContext?.kind),
                  pageKind: sanitizeString(storefrontContext?.pageKind),
                }
              : null,
            currentProduct: {
              nome: sanitizeString(currentCatalogProduct?.nome),
              categoriaLabel: sanitizeString(currentCatalogProduct?.categoriaLabel),
              atributos: Array.isArray(currentCatalogProduct?.atributos)
                ? currentCatalogProduct.atributos.slice(0, 8).map((item) => ({
                    nome: sanitizeString(item?.nome),
                    valor: sanitizeString(item?.valor),
                  }))
                : [],
            },
            recentProducts: recentProducts.slice(0, 6).map((item, index) => ({
              id: sanitizeString(item?.id),
              index: index + 1,
              nome: sanitizeString(item?.nome),
              descricao: sanitizeString(item?.descricao),
              material: sanitizeString(item?.material),
              cor: sanitizeString(item?.cor),
            })),
            lastSearchTerm: sanitizeString(input?.context?.catalogo?.ultimaBusca),
            hasRecentListContext:
              Boolean(sanitizeString(input?.context?.catalogo?.ultimaBusca)) ||
              recentProducts.length > 0 ||
              input?.context?.catalogo?.paginationHasMore === true ||
              Number(input?.context?.catalogo?.paginationTotal ?? 0) > 0,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "semantic_catalog_intent",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                enum: [
                  "current_product_question",
                  "current_product_commercial_advice",
                  "current_product_affirmation",
                  "recent_product_reference",
                  "recent_product_reference_ambiguous",
                  "recent_product_reference_unresolved",
                  "same_type_search",
                  "similar_items_search",
                  "catalog_alternative_search",
                  "catalog_search_refinement",
                  "new_catalog_search",
                  "catalog_browse",
                  "catalog_load_more",
                  "other",
                ],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: "string",
              },
              targetType: {
                type: "string",
              },
              referencedProductIds: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              excludeCurrentProduct: {
                type: "boolean",
              },
              targetFactHints: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              factScope: {
                type: "string",
                enum: ["", "product", "package", "shipping", "commercial", "general"],
              },
              adviceType: {
                type: "string",
                enum: ["", "price_objection", "improvement_suggestion", "value_assessment", "fit_advice", "risk_assessment", "other"],
              },
              relation: {
                type: "string",
                enum: ["", "same_type", "similar", "storewide"],
              },
              priceConstraint: {
                type: "string",
                enum: ["", "below_current", "any"],
              },
            },
            required: [
              "intent",
              "confidence",
              "reason",
              "targetType",
              "referencedProductIds",
              "excludeCurrentProduct",
              "targetFactHints",
              "factScope",
              "adviceType",
              "relation",
              "priceConstraint",
            ],
          },
        },
      },
      max_output_tokens: 150,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const parsed = parseResponseJson(payload)
  if (!parsed) return null

  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    targetType: sanitizeString(parsed?.targetType),
    referencedProductIds: Array.isArray(parsed?.referencedProductIds)
      ? parsed.referencedProductIds.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    excludeCurrentProduct: parsed?.excludeCurrentProduct !== false,
    targetFactHints: Array.isArray(parsed?.targetFactHints)
      ? parsed.targetFactHints.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    factScope: sanitizeString(parsed?.factScope),
    adviceType: sanitizeString(parsed?.adviceType),
    relation: sanitizeString(parsed?.relation),
    priceConstraint: sanitizeString(parsed?.priceConstraint),
    usedLlm: true,
  }
}

export async function classifySemanticBillingIntentStage(input = {}) {
  const latestUserMessage = sanitizeString(input?.latestUserMessage)
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"
  const pricingItems = Array.isArray(input?.pricingItems) ? input.pricingItems : []

  if (!latestUserMessage || !openAiKey || !pricingItems.length) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "Classifique a mensagem do cliente no contexto de catalogo estruturado de planos/precos.",
            "Retorne somente JSON valido.",
            'Schema: {"intent":"pricing_overview|highest_priced_plan|lowest_priced_plan|plan_comparison|specific_plan_question|plan_limit_question|plan_feature_question|plan_recommendation|other","confidence":0..1,"reason":"string","requestedPlanNames":["string"],"targetField":"attendance_limit|agent_limit|credit_limit|whatsapp_included|support_level|price|","targetFields":["attendance_limit","agent_limit","credit_limit","whatsapp_included","support_level","price"]}',
            "Use pricing_overview quando o cliente pedir tabela, lista, valores, planos ou precos em geral.",
            "Use highest_priced_plan ou lowest_priced_plan quando ele pedir mais caro ou mais barato.",
            "Use plan_comparison quando ele pedir comparacao entre mais de um plano.",
            "Use specific_plan_question quando citar explicitamente um plano do catalogo e pedir uma visao geral dele.",
            "Use plan_limit_question quando pedir capacidade, quantidade, limite, quantos atendimentos, quantos agentes ou créditos de um plano.",
            "Use plan_feature_question quando pedir se o plano inclui WhatsApp, suporte ou algum recurso estruturado do catalogo.",
            "Use plan_recommendation quando ele pedir indicacao do melhor plano, mesmo sem explicitar o criterio. Quando o criterio nao estiver claro, deixe targetField vazio e targetFields vazio.",
            "Quando existir billing.planFocus no contexto e o cliente falar esse plano, nele ou equivalente, use esse foco sem inventar novo nome.",
            "Quando existir billing.comparisonFocus no contexto e o cliente fizer follow-up comparativo, mantenha a comparacao mesmo sem repetir os nomes dos planos.",
            "Preencha targetField com attendance_limit, agent_limit, credit_limit, whatsapp_included, support_level ou price quando houver um slot factual claro.",
            "Quando a pergunta cobrar mais de um fato ao mesmo tempo, preencha targetFields com todos os slots pedidos e preserve targetField como o principal.",
            "Nao invente nomes de plano. So use nomes realmente presentes no catalogo.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            message: latestUserMessage,
            billingContext: {
              planFocus: sanitizeString(input?.context?.billing?.planFocus?.name),
              comparisonPlans: Array.isArray(input?.context?.billing?.comparisonFocus?.plans)
                ? input.context.billing.comparisonFocus.plans.map((item) => sanitizeString(item?.name)).filter(Boolean)
                : [],
              comparisonFields: Array.isArray(input?.context?.billing?.comparisonFocus?.fields)
                ? input.context.billing.comparisonFocus.fields.map((item) => sanitizeString(item)).filter(Boolean)
                : [],
              lastField: sanitizeString(input?.context?.billing?.lastField),
              lastFields: Array.isArray(input?.context?.billing?.lastFields)
                ? input.context.billing.lastFields.map((item) => sanitizeString(item)).filter(Boolean)
                : [],
            },
            pricingItems: pricingItems.slice(0, 12).map((item) => ({
              name: sanitizeString(item?.name || item?.nome),
              slug: sanitizeString(item?.slug),
              priceLabel: sanitizeString(item?.priceLabel || item?.precoLabel),
            })),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "semantic_billing_intent",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                enum: [
                  "pricing_overview",
                  "highest_priced_plan",
                  "lowest_priced_plan",
                  "plan_comparison",
                  "specific_plan_question",
                  "plan_limit_question",
                  "plan_feature_question",
                  "plan_recommendation",
                  "other",
                ],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: "string",
              },
              requestedPlanNames: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              targetField: {
                type: "string",
                enum: ["", "attendance_limit", "agent_limit", "credit_limit", "whatsapp_included", "support_level", "price"],
              },
              targetFields: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["attendance_limit", "agent_limit", "credit_limit", "whatsapp_included", "support_level", "price"],
                },
              },
            },
            required: ["intent", "confidence", "reason", "requestedPlanNames", "targetField", "targetFields"],
          },
        },
      },
      max_output_tokens: 140,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const parsed = parseResponseJson(payload)
  if (!parsed) return null

  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    requestedPlanNames: Array.isArray(parsed?.requestedPlanNames)
      ? parsed.requestedPlanNames.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    targetField: sanitizeString(parsed?.targetField),
    targetFields: Array.isArray(parsed?.targetFields)
      ? parsed.targetFields.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    usedLlm: true,
  }
}

export async function classifySemanticApiIntentStage(input = {}) {
  const latestUserMessage = sanitizeString(input?.latestUserMessage)
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"
  const runtimeApis = Array.isArray(input?.runtimeApis) ? input.runtimeApis : []

  if (!latestUserMessage || !openAiKey || !runtimeApis.length) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "Classifique a mensagem do cliente no contexto de APIs estruturadas ja disponiveis no runtime.",
            "Retorne somente JSON valido.",
            'Schema: {"intent":"api_fact_query|api_status_query|api_comparison|api_create_record|api_catalog_search|other","confidence":0..1,"reason":"string","apiId":"string","intentType":"create_record|lookup_by_identifier|knowledge_search|catalog_search|generic_fact|","targetFieldHints":["string"],"supportFieldHints":["string"],"parameterValues":[{"name":"campo","value":"valor"}],"comparisonMode":"best_choice|highest_price|lowest_price|","referencedProductIndexes":[1,2]}.',
            "Use api_fact_query para pedido factual sobre campos disponiveis, como valor, data, endereco, documento, descricao.",
            "Use api_status_query para status, codigo, pedido, estoque, disponibilidade, rastreio.",
            "Use api_comparison para comparacao ou melhor opcao entre registros/itens retornados.",
            "Use api_catalog_search quando a API de catalogo precisa buscar itens, produtos ou registros a partir de um termo informado pelo cliente.",
            "Use api_create_record somente quando o cliente pedir cadastro, envio, registro, lead ou abertura de solicitação em API de create_record.",
            "Escolha apiId e intentType da API mais compatível. Se houver conflito entre APIs de cadastro, consulta, conhecimento e catálogo, reduza a confiança ou retorne other.",
            "Nunca classifique create_record como consulta factual sem pedido explícito de cadastro e dados obrigatórios suficientes.",
            "Quando o cliente informar nome, titulo, predio, produto, bairro, cidade ou termo de busca, prefira uma API catalog_search com parametro de busca, nao uma API de consulta por id.",
            "Use lookup_by_identifier somente quando existir identificador exato como id, propertyId, codigo, protocolo ou documento compativel com os parametros da API.",
            "Nao escolha API com parametro de URL ausente se a mensagem nao trouxer valor compativel para esse parametro.",
            "Quando a intencao for factual ou status, preencha targetFieldHints com campos curtos e literais do runtime, por exemplo matricula, cartorio, valor, status, codigo, data_leilao, endereco, cidade, descricao.",
            "Quando fizer sentido adicionar contexto util, preencha supportFieldHints com campos complementares curtos e literais, por exemplo status, data_leilao, valor_minimo, ocupacao, cidade.",
            "Quando a intencao for api_comparison, preencha comparisonMode com best_choice, highest_price ou lowest_price.",
            "Quando a API tiver parametros ausentes na URL ou campos obrigatorios, extraia valores literais da mensagem em parameterValues. Exemplo: para URL com {titulo} e mensagem 'imovel EDIFICIO VILLA', retorne parameterValues=[{name:'titulo', value:'EDIFICIO VILLA'}].",
            "Quando a intencao comparar itens numerados da lista, preencha referencedProductIndexes com numeros 1-based reais.",
            "Se nao houver evidência suficiente, retorne other.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            message: latestUserMessage,
            runtimeApis: runtimeApis.slice(0, 6).map((api) => ({
              apiId: sanitizeString(api?.apiId),
              nome: sanitizeString(api?.nome),
              method: sanitizeString(api?.method),
              url: sanitizeString(api?.url),
              descricao: sanitizeString(api?.descricao),
              intentType: normalizeSemanticApiIntentType(api?.config?.runtime?.intentType),
              descriptionForIntent: sanitizeString(api?.config?.runtime?.descriptionForIntent),
              requiredFields: Array.isArray(api?.config?.runtime?.requiredFields)
                ? api.config.runtime.requiredFields.map((field) => sanitizeString(field?.name || field)).filter(Boolean)
                : [],
              campos: Array.isArray(api?.campos)
                ? api.campos.slice(0, 12).map((field) => sanitizeString(field?.nome)).filter(Boolean)
                : [],
              missingParams: Array.isArray(api?.missingParams) ? api.missingParams.map((item) => sanitizeString(item)).filter(Boolean) : [],
            })),
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "semantic_api_intent",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                enum: ["api_fact_query", "api_status_query", "api_comparison", "api_create_record", "api_catalog_search", "other"],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: "string",
              },
              apiId: {
                type: "string",
              },
              intentType: {
                type: "string",
                enum: ["create_record", "lookup_by_identifier", "knowledge_search", "catalog_search", "generic_fact", ""],
              },
              targetFieldHints: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              supportFieldHints: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              parameterValues: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: {
                      type: "string",
                    },
                    value: {
                      type: "string",
                    },
                  },
                  required: ["name", "value"],
                },
              },
              comparisonMode: {
                type: "string",
              },
              referencedProductIndexes: {
                type: "array",
                items: {
                  type: "integer",
                },
              },
            },
            required: [
              "intent",
              "confidence",
              "reason",
              "apiId",
              "intentType",
              "targetFieldHints",
              "supportFieldHints",
              "parameterValues",
              "comparisonMode",
              "referencedProductIndexes",
            ],
          },
        },
      },
      max_output_tokens: 180,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const parsed = parseResponseJson(payload)
  if (!parsed) return null

  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    apiId: sanitizeString(parsed?.apiId),
    intentType: normalizeSemanticApiIntentType(parsed?.intentType),
    targetFieldHints: Array.isArray(parsed?.targetFieldHints)
      ? parsed.targetFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    supportFieldHints: Array.isArray(parsed?.supportFieldHints)
      ? parsed.supportFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    parameterValues: normalizeSemanticApiParameterValues(parsed?.parameterValues),
    comparisonMode: sanitizeString(parsed?.comparisonMode),
    referencedProductIndexes: Array.isArray(parsed?.referencedProductIndexes)
      ? parsed.referencedProductIndexes.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1)
      : [],
    usedLlm: true,
  }
}

export async function classifySemanticApiConfirmationStage(input = {}) {
  const latestUserMessage = sanitizeString(input?.latestUserMessage)
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"
  const pendingApiRuntime = input?.pendingApiRuntime && typeof input.pendingApiRuntime === "object" && !Array.isArray(input.pendingApiRuntime)
    ? input.pendingApiRuntime
    : null

  if (!latestUserMessage || !openAiKey || !pendingApiRuntime?.lastApiId || pendingApiRuntime?.lastIntentType !== "create_record") {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "Classifique se a mensagem confirma ou cancela um cadastro de API que ja esta pendente.",
            "Retorne somente JSON valido.",
            'Schema: {"intent":"api_confirm_create_record|api_cancel_create_record|other","confidence":0..1,"reason":"string","apiId":"string"}.',
            "Use api_confirm_create_record somente quando o cliente aprovar explicitamente registrar/enviar o cadastro pendente.",
            "Use api_cancel_create_record quando o cliente negar, pedir para parar ou corrigir antes de registrar.",
            "Se a mensagem trouxer novos dados, duvida, pergunta ou ambiguidade, retorne other.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            message: latestUserMessage,
            pendingApiRuntime: {
              lastApiId: sanitizeString(pendingApiRuntime.lastApiId),
              lastIntentType: sanitizeString(pendingApiRuntime.lastIntentType),
              missingRequiredFields: Array.isArray(pendingApiRuntime.missingRequiredFields)
                ? pendingApiRuntime.missingRequiredFields.map((item) => sanitizeString(item)).filter(Boolean)
                : [],
              blockedReasons: Array.isArray(pendingApiRuntime.blockedReasons)
                ? pendingApiRuntime.blockedReasons.map((item) => sanitizeString(item)).filter(Boolean)
                : [],
            },
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "semantic_api_confirmation",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              intent: {
                type: "string",
                enum: ["api_confirm_create_record", "api_cancel_create_record", "other"],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: "string",
              },
              apiId: {
                type: "string",
              },
            },
            required: ["intent", "confidence", "reason", "apiId"],
          },
        },
      },
      max_output_tokens: 80,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const parsed = parseResponseJson(payload)
  if (!parsed) return null

  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    apiId: sanitizeString(parsed?.apiId),
    usedLlm: true,
  }
}

export function shouldBypassCatalogHeuristicFallback() {
  return false
}
