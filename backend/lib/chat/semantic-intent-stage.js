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

  return null
}

export async function classifySemanticIntentStage() {
  return null
}

export async function classifySemanticApiIntentStage() {
  return null
}

export function shouldBypassCatalogHeuristicFallback() {
  return false
}
