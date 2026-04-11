export function resolveConversationPipelineStageState(input = {}) {
  const conversationDomainStage = input.hasFocusedApiContext
    ? "api_runtime"
    : input.hasCurrentCatalogContext || input.hasMercadoLivreContext
      ? "catalog"
      : "general"

  const heuristicIntentStage = input.hasCatalogReferenceHeuristicReply
    ? "catalog_reference"
    : input.hasMercadoLivreHeuristicReply
      ? "mercado_livre"
      : input.leadIdentificationReply
        ? "lead_capture"
        : "none"

  return {
    conversationDomainStage,
    heuristicIntentStage,
    shouldCallModel: Boolean(input.hasValidAgent && input.hasOpenAiKey && !input.catalogPricingReply),
  }
}
