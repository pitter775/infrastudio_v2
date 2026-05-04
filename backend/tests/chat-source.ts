export {
  decideCatalogFollowUpHeuristically,
  resolveCatalogLoadMoreDecision,
  resolveRecentCatalogReferenceDecision,
  resolveDeterministicCatalogFollowUpDecision,
  resolveRecentCatalogProductReference,
} from "@/lib/chat/catalog-follow-up";

export {
  buildApiFallbackReply,
  buildFocusedApiContext,
  resolveApiCatalogReply,
} from "@/lib/chat/api-runtime";

export {
  appendOptionalHumanOffer,
  buildHumanHandoffReply,
  classifyHumanEscalationNeed,
  isHumanHandoffIntent,
} from "@/lib/chat/handoff-policy";

export {
  buildLeadNameAcknowledgementReply,
  enrichLeadContext,
  isLikelyLeadNameReply,
} from "@/lib/chat/lead-stage";

export { buildSystemPrompt } from "@/lib/chat/prompt-builders";

export { executeSalesOrchestrator } from "@/lib/chat/orchestrator";

export { resolveConversationPipelineStageState } from "@/lib/chat/pipeline-stage";
export { resolveChatDomainRoute } from "@/lib/chat/domain-router";

export {
  buildFocusedProductFactualReply,
  enforceMercadoLivreSearchReplyCoherence,
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicState,
} from "@/lib/chat/mercado-livre";

export { resolveCatalogIntentState } from "@/lib/chat/catalog-intent-handler";
export { resolveCatalogDecisionState } from "@/lib/chat/catalog-intent-handler";
export { resolveCatalogExecutionState } from "@/lib/chat/catalog-intent-handler";
export { resolveCatalogComparisonDecisionState } from "@/lib/chat/catalog-intent-handler";

export {
  buildProductSearchCandidates,
  isGreetingOrAckMessage,
  shouldContinueProductSearch,
  shouldUseMercadoLivreConnectorFallback,
} from "@/lib/chat/sales-heuristics";

export {
  buildIsolatedChatResult,
  buildSilentChatResult,
  buildBillingBlockedResult,
  buildFinalChatResult,
} from "@/lib/chat/result-builders";

export {
  buildCoreChatRequest,
  buildFallbackChatTitle,
  buildInitialChatContext,
  buildAssistantMessageMetadata,
  buildUserMessageMetadata,
  applyAdminTestContextOverrides,
  buildNextContext,
  prepareAiReplyPayload,
  buildContinuationMessage,
  extractRecentMercadoLivreProductsFromAssets,
  getWhatsAppContactAvatarFromContext,
  getWhatsAppContactNameFromContext,
  getAdminTestAgentId,
  getAdminTestProjectId,
  hasSupabaseServerEnv,
  isCatalogLoadMoreMessage,
  isCatalogSearchMessage,
  mergeContext,
  normalizeExternalIdentifier,
  normalizeInboundAttachments,
  normalizeInboundMessage,
  normalizeChannelKind,
  parseAssetPrice,
  processChatRequest,
  prepareChatPrelude,
  executeV2RuntimePrelude,
  finalizeV2AiTurn,
  loadChatHistory,
  persistAssistantTurn,
  ensureActiveChatSession,
  applyBillingGuardrail,
  applyHandoffGuardrail,
  persistAssistantState,
  persistUserTurn,
  requestRuntimeHumanHandoff,
  resolveChatContactSnapshot,
  resolveChatChannel,
  splitCatalogReplyForWhatsApp,
  updateContextFromAiResult,
  buildWhatsAppMessageSequence,
  resolveCanonicalWhatsAppExternalIdentifier,
  sanitizeWhatsAppCustomerFacingReply,
} from "@/lib/chat/service";

export {
  buildUsagePersistencePayload,
  persistUsageRecord,
} from "@/lib/chat/usage-persistence";

export {
  getChatWidgetByProjetoAgente,
  getChatWidgetBySlug,
} from "@/lib/chat-widgets";

export {
  buildAiObservability,
  mapAdminConversationMessage,
  resolveAdminReplyChannelFromMessages,
  resolveAdminReplyChannel,
} from "@/lib/admin-conversations";

export { isStoreProductAvailable } from "@/lib/mercado-livre-store-core/sanitize";
export { isMercadoLivreSellableItem } from "@/lib/mercado-livre-connector";

export {
  getChatHandoffByChatId,
  requestHumanHandoff,
  shouldPauseAssistantForHandoff,
} from "@/lib/chat-handoffs";

export {
  CHAT_ATTACHMENTS_BUCKET,
  getChatAttachmentsMetadata,
  uploadChatAttachmentPayloads,
} from "@/lib/chat-attachments";

export {
  buildChatUsageOrigin,
  buildChatUsageTelemetry,
} from "@/lib/chat-usage-metrics";

export {
  buildChatConfigDiagnostics,
  buildPublicChatRequestDiagnostics,
  logChatConfigEvent,
  logPublicChatEvent,
  recordChatConfigEvent,
  recordPublicChatEvent,
} from "@/lib/chat/diagnostics";

export {
  buildLogSearchText,
  filterAdminLogs,
  mapLogRow,
  normalizeLogLevel,
} from "@/lib/logs";

export {
  buildBillingSnapshot,
  mapBillingPlan,
} from "@/lib/billing";

export {
  buildFeedbackRecord,
  mapFeedbackMessageRow,
  sortFeedbacks,
} from "@/lib/feedbacks";

export {
  buildChatCorsHeaders,
  formatPublicChatResult,
  normalizePublicChatBody,
} from "@/lib/chat/http";

export { estimateOpenAICostUsd, resolvePricingModel } from "@/lib/openai-pricing";

export {
  extractChatContactSnapshot,
  findChatByChannelScope,
  findChatByWhatsAppPhone,
  findActiveChatByContactPhone,
  getChatContext,
  mapChat,
  mapMensagem,
  normalizeWhatsAppLookupPhone,
} from "@/lib/chats";

export {
  buildApiDecisionFromSemanticIntent,
  buildBillingDecisionFromSemanticIntent,
  buildCatalogDecisionFromSemanticIntent,
  extractDeterministicPricingCatalogFromAgentText,
} from "@/lib/chat/semantic-intent-stage";

export {
  buildBillingContextUpdate,
  buildBillingReplyResult,
  getStructuredPricingItems,
} from "@/lib/chat/billing-intent-handler";

export { validateMercadoPagoWebhookSignature } from "@/lib/mercado-pago-billing";

export {
  shouldThrottleSessionSync,
  updateWhatsAppChannelSession,
} from "@/lib/whatsapp-channels";
