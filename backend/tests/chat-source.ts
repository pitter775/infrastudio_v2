export {
  decideCatalogFollowUpHeuristically,
  resolveRecentCatalogProductReference,
} from "@/lib/chat/catalog-follow-up";

export {
  buildApiFallbackReply,
  buildFocusedApiContext,
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

export { resolveConversationPipelineStageState } from "@/lib/chat/pipeline-stage";

export {
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicState,
} from "@/lib/chat/mercado-livre";

export {
  buildProductSearchCandidates,
  isGreetingOrAckMessage,
  shouldContinueProductSearch,
  shouldUseMercadoLivreConnectorFallback,
} from "@/lib/chat/sales-heuristics";

export {
  buildCoreChatRequest,
  buildFallbackChatTitle,
  buildBillingBlockedResult,
  buildFinalChatResult,
  buildInitialChatContext,
  buildAssistantMessageMetadata,
  buildUsagePersistencePayload,
  buildUserMessageMetadata,
  applyAdminTestContextOverrides,
  buildIsolatedChatResult,
  buildNextContext,
  prepareAiReplyPayload,
  buildSilentChatResult,
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
  persistUsageRecord,
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
  DEFAULT_HOME_WIDGET_SLUG,
  getChatWidgetByProjetoAgente,
  getChatWidgetBySlug,
} from "@/lib/chat-widgets";

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
} from "@/lib/chat/diagnostics";

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
  getChatContext,
  mapChat,
  mapMensagem,
  normalizeWhatsAppLookupPhone,
} from "@/lib/chats";

export { buildCatalogDecisionFromSemanticIntent } from "@/lib/chat/semantic-intent-stage";
