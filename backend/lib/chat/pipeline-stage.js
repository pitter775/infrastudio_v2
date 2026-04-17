export function resolveConversationPipelineStageState(input = {}) {
  const heuristicIntentStage = input.leadNameAcknowledgementReply
    ? "lead_name_acknowledgement"
    : input.hasCatalogReferenceHeuristicReply
      ? "catalog_reference"
      : input.hasMercadoLivreHeuristicReply
        ? "mercado_livre"
        : input.catalogPricingReply
          ? "catalog_pricing"
          : input.leadIdentificationReply
            ? "lead_capture"
            : "none"

  const conversationDomainStage = input.hasFocusedApiContext
    ? "api_runtime"
    : input.hasCurrentCatalogContext || input.hasMercadoLivreContext
      ? "catalog"
      : input.hasLeadContext
        ? "sales"
        : "general"

  const hasBlockingHeuristic =
    heuristicIntentStage !== "none" || Boolean(input.catalogPricingReply)

  return {
    conversationDomainStage,
    heuristicIntentStage,
    shouldCallModel: Boolean(input.hasValidAgent && input.hasOpenAiKey && !hasBlockingHeuristic),
  }
}
