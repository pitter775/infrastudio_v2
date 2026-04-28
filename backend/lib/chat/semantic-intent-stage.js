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

  if (semanticIntent.intent === "same_type_search" && sanitizeString(semanticIntent.targetType)) {
    return {
      kind: "catalog_search_refinement",
      confidence: semanticIntent.confidence,
      reason: semanticIntent.reason ?? "Cliente pediu outro item do mesmo tipo.",
      matchedProducts: [],
      usedLlm: Boolean(semanticIntent.usedLlm),
      shouldBlockNewSearch: false,
      searchCandidates: [sanitizeString(semanticIntent.targetType)],
      excludeCurrentProduct: semanticIntent.excludeCurrentProduct !== false,
    }
  }

  return null
}

export async function classifySemanticIntentStage(input = {}) {
  const latestUserMessage = sanitizeString(input?.latestUserMessage)
  const currentCatalogProduct = input?.currentCatalogProduct
  const openAiKey = sanitizeString(input?.openAiKey)
  const model = sanitizeString(input?.model) || "gpt-4o-mini"

  if (!latestUserMessage || !currentCatalogProduct?.nome || !openAiKey) {
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
            "Classifique a mensagem do cliente no contexto de um produto Mercado Livre em foco.",
            "Retorne somente JSON valido.",
            'Schema: {"intent":"current_product_question|same_type_search|other","confidence":0..1,"reason":"string","targetType":"string","excludeCurrentProduct":true|false}.',
            "Use same_type_search apenas quando o cliente pedir outro item do mesmo tipo ou da mesma classe do produto atual.",
            "Quando usar same_type_search, extraia targetType curto e literal, por exemplo saleiro, jarra, xicara, prato.",
            "Nao invente targetType. Se nao tiver certeza, retorne other.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            message: latestUserMessage,
            currentProduct: {
              nome: sanitizeString(currentCatalogProduct.nome),
              categoriaLabel: sanitizeString(currentCatalogProduct.categoriaLabel),
              atributos: Array.isArray(currentCatalogProduct.atributos)
                ? currentCatalogProduct.atributos.slice(0, 8).map((item) => ({
                    nome: sanitizeString(item?.nome),
                    valor: sanitizeString(item?.valor),
                  }))
                : [],
            },
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
                enum: ["current_product_question", "same_type_search", "other"],
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
              excludeCurrentProduct: {
                type: "boolean",
              },
            },
            required: ["intent", "confidence", "reason", "targetType", "excludeCurrentProduct"],
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
    excludeCurrentProduct: parsed?.excludeCurrentProduct !== false,
    usedLlm: true,
  }
}

export async function classifySemanticApiIntentStage() {
  return null
}

export function shouldBypassCatalogHeuristicFallback() {
  return false
}
