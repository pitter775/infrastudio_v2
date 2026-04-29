function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function extractResponseText(payload) {
  return (
    payload?.output_text ??
    payload?.output?.flatMap((item) => item?.content ?? [])?.find((item) => item?.type === "output_text")?.text ??
    ""
  )
}

export function buildCatalogDecisionFromSemanticIntent(input) {
  const semanticIntent = input?.semanticIntent
  const recentProducts = Array.isArray(input?.recentProducts) ? input.recentProducts : []
  if (!semanticIntent || semanticIntent.confidence < 0.7) {
    return null
  }

  if (["product_question", "current_product_question", "product_detail"].includes(semanticIntent.intent)) {
    return {
      kind: "non_catalog_message",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Pergunta sobre produto em foco.",
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
        reason: semanticIntent.reason ?? "Cliente referenciou um item recente do catalogo.",
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
        reason: semanticIntent.reason ?? "Cliente referenciou mais de um item recente do catalogo.",
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
      reason: semanticIntent.reason ?? "Cliente iniciou uma nova busca de catalogo.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: [sanitizeString(semanticIntent.targetType)],
      uncoveredTokens: [sanitizeString(semanticIntent.targetType)],
      excludeCurrentProduct: false,
    }
  }

  if (semanticIntent.intent === "catalog_load_more") {
    return {
      kind: "catalog_load_more",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu mais opcoes da busca recente.",
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
    ].includes(semanticIntent.intent)
  ) {
    return {
      kind: semanticIntent.intent,
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Intencao de pricing estruturado.",
      requestedPlanNames: Array.isArray(semanticIntent.requestedPlanNames)
        ? semanticIntent.requestedPlanNames.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      usedLlm: Boolean(semanticIntent.usedLlm),
    }
  }

  return null
}

export function buildApiDecisionFromSemanticIntent(input) {
  const semanticIntent = input?.semanticIntent
  if (!semanticIntent || semanticIntent.confidence < 0.7) {
    return null
  }

  if (["api_fact_query", "api_status_query", "api_comparison"].includes(semanticIntent.intent)) {
    return {
      kind: semanticIntent.intent,
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Intencao estruturada de API runtime.",
      targetFieldHints: Array.isArray(semanticIntent.targetFieldHints)
        ? semanticIntent.targetFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      supportFieldHints: Array.isArray(semanticIntent.supportFieldHints)
        ? semanticIntent.supportFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
        : [],
      comparisonMode: sanitizeString(semanticIntent.comparisonMode),
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

export async function extractSemanticPricingCatalogFromAgentText(input = {}) {
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
            "Extraia um catalogo estruturado de planos/precos a partir do texto do agente.",
            "Retorne somente JSON valido.",
            'Schema: {"enabled":true|false,"items":[{"slug":"string","name":"string","matchAny":["string"],"priceLabel":"string"}]}.',
            "Use enabled=true apenas quando houver pelo menos um plano ou valor identificavel no texto.",
            "Cada item precisa ter nome e priceLabel.",
            "Use slug curto, estavel e em minusculas.",
            "matchAny deve conter variacoes literais uteis do plano, incluindo o proprio nome.",
            "Nao invente preco nem plano que nao esteja claramente no texto.",
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
                  },
                  required: ["slug", "name", "matchAny", "priceLabel"],
                },
              },
            },
            required: ["enabled", "items"],
          },
        },
      },
      max_output_tokens: 300,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const rawText = extractResponseText(payload)
  if (!rawText) {
    return null
  }

  const parsed = JSON.parse(rawText)
  const items = Array.isArray(parsed?.items)
    ? parsed.items
        .map((item) => ({
          slug: sanitizeString(item?.slug),
          name: sanitizeString(item?.name),
          matchAny: Array.isArray(item?.matchAny) ? item.matchAny.map((token) => sanitizeString(token)).filter(Boolean) : [],
          priceLabel: sanitizeString(item?.priceLabel),
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
            "Use business.summary como resumo curto do negocio e da proposta comercial.",
            "Use business.services apenas com servicos reais e objetivos citados no texto.",
            "Use sales.cta apenas se houver uma chamada comercial clara de continuidade.",
            "Nao invente servicos nem CTA nao citados no texto.",
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
      max_output_tokens: 260,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const rawText = extractResponseText(payload)
  if (!rawText) {
    return null
  }

  const parsed = JSON.parse(rawText)
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
            "Classifique a mensagem do cliente no contexto de catalogo Mercado Livre.",
            "Retorne somente JSON valido.",
            'Schema: {"intent":"current_product_question|recent_product_reference|recent_product_reference_ambiguous|recent_product_reference_unresolved|same_type_search|similar_items_search|catalog_search_refinement|new_catalog_search|catalog_load_more|other","confidence":0..1,"reason":"string","targetType":"string","referencedProductIds":["string"],"excludeCurrentProduct":true|false}.',
            "Use same_type_search apenas quando o cliente pedir outro item do mesmo tipo ou da mesma classe do produto atual.",
            "Quando usar same_type_search, extraia targetType curto e literal, por exemplo saleiro, jarra, xicara, prato.",
            "Use similar_items_search quando o cliente pedir algo parecido, similar, semelhante ou na mesma linha do produto atual, mesmo sem citar o tipo explicitamente.",
            "Em similar_items_search, targetType pode vir vazio quando o tipo precisara ser derivado do proprio produto atual.",
            "Use catalog_search_refinement quando o cliente refinar a ultima lista com um atributo novo ou filtro novo, por exemplo inox, azul, madeira, vintage, grande.",
            "Quando usar catalog_search_refinement, extraia targetType curto e literal com o termo novo principal da busca.",
            "Use new_catalog_search quando o cliente iniciar uma nova busca de catalogo, inclusive na vitrine, com um tipo ou termo curto claro, por exemplo saleiro azul, xicara vintage, vaso amarelo.",
            "Use catalog_load_more quando o cliente pedir mais opcoes, mais modelos, outras opcoes, perguntar se tem mais, se sao so aqueles itens ou o que tiver, sem mudar o tipo principal da busca.",
            "Se existir contexto de busca/listagem recente e a conversa estiver em pagina de detalhe, pedidos como tem mais, so esses, quero ver mais ou me mostra outras opcoes continuam sendo catalog_load_more, nao current_product_question.",
            "Use recent_product_reference quando o cliente estiver se referindo a um item da lista recente e for possivel identificar qual item e.",
            "Use recent_product_reference_ambiguous quando a fala apontar para mais de um item recente de forma plausivel.",
            "Use recent_product_reference_unresolved quando o cliente ainda estiver falando da lista recente, mas sem item unico resolvido.",
            "Quando usar recent_product_reference, preencha referencedProductIds apenas com ids reais da lista recente.",
            "Nao invente targetType. Se nao tiver certeza, retorne other.",
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
                  "recent_product_reference",
                  "recent_product_reference_ambiguous",
                  "recent_product_reference_unresolved",
                  "same_type_search",
                  "similar_items_search",
                  "catalog_search_refinement",
                  "new_catalog_search",
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
            },
            required: ["intent", "confidence", "reason", "targetType", "referencedProductIds", "excludeCurrentProduct"],
          },
        },
      },
      max_output_tokens: 120,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const rawText = extractResponseText(payload)
  if (!rawText) {
    return null
  }

  const parsed = JSON.parse(rawText)
  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    targetType: sanitizeString(parsed?.targetType),
    referencedProductIds: Array.isArray(parsed?.referencedProductIds)
      ? parsed.referencedProductIds.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    excludeCurrentProduct: parsed?.excludeCurrentProduct !== false,
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
            'Schema: {"intent":"pricing_overview|highest_priced_plan|lowest_priced_plan|plan_comparison|specific_plan_question|other","confidence":0..1,"reason":"string","requestedPlanNames":["string"]}.',
            "Use pricing_overview quando o cliente pedir tabela, lista, valores, planos ou precos em geral.",
            "Use highest_priced_plan ou lowest_priced_plan quando ele pedir mais caro ou mais barato.",
            "Use plan_comparison quando ele pedir comparacao entre mais de um plano.",
            "Use specific_plan_question quando citar explicitamente um plano do catalogo.",
            "Nao invente nomes de plano. So use nomes realmente presentes no catalogo.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            message: latestUserMessage,
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
                enum: ["pricing_overview", "highest_priced_plan", "lowest_priced_plan", "plan_comparison", "specific_plan_question", "other"],
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
            },
            required: ["intent", "confidence", "reason", "requestedPlanNames"],
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
  const rawText = extractResponseText(payload)
  if (!rawText) {
    return null
  }

  const parsed = JSON.parse(rawText)
  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    requestedPlanNames: Array.isArray(parsed?.requestedPlanNames)
      ? parsed.requestedPlanNames.map((item) => sanitizeString(item)).filter(Boolean)
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
            'Schema: {"intent":"api_fact_query|api_status_query|api_comparison|other","confidence":0..1,"reason":"string","targetFieldHints":["string"],"supportFieldHints":["string"],"comparisonMode":"best_choice|highest_price|lowest_price|","referencedProductIndexes":[1,2]}.',
            "Use api_fact_query para pedido factual sobre campos disponiveis, como valor, data, endereco, documento, descricao.",
            "Use api_status_query para status, codigo, pedido, estoque, disponibilidade, rastreio.",
            "Use api_comparison para comparacao ou melhor opcao entre registros/itens retornados.",
            "Quando a intencao for factual ou status, preencha targetFieldHints com campos curtos e literais do runtime, por exemplo matricula, cartorio, valor, status, codigo, data_leilao, endereco, cidade, descricao.",
            "Quando fizer sentido adicionar contexto util, preencha supportFieldHints com campos complementares curtos e literais, por exemplo status, data_leilao, valor_minimo, ocupacao, cidade.",
            "Quando a intencao for api_comparison, preencha comparisonMode com best_choice, highest_price ou lowest_price.",
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
              campos: Array.isArray(api?.campos)
                ? api.campos.slice(0, 12).map((field) => sanitizeString(field?.nome)).filter(Boolean)
                : [],
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
                enum: ["api_fact_query", "api_status_query", "api_comparison", "other"],
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              reason: {
                type: "string",
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
            required: ["intent", "confidence", "reason", "targetFieldHints", "supportFieldHints", "comparisonMode", "referencedProductIndexes"],
          },
        },
      },
      max_output_tokens: 100,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null)
  const rawText = extractResponseText(payload)
  if (!rawText) {
    return null
  }

  const parsed = JSON.parse(rawText)
  return {
    intent: sanitizeString(parsed?.intent),
    confidence: Number(parsed?.confidence ?? 0) || 0,
    reason: sanitizeString(parsed?.reason),
    targetFieldHints: Array.isArray(parsed?.targetFieldHints)
      ? parsed.targetFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    supportFieldHints: Array.isArray(parsed?.supportFieldHints)
      ? parsed.supportFieldHints.map((item) => sanitizeString(item)).filter(Boolean)
      : [],
    comparisonMode: sanitizeString(parsed?.comparisonMode),
    referencedProductIndexes: Array.isArray(parsed?.referencedProductIndexes)
      ? parsed.referencedProductIndexes.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1)
      : [],
    usedLlm: true,
  }
}

export function shouldBypassCatalogHeuristicFallback() {
  return false
}
