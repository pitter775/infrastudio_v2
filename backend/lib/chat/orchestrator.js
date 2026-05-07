import { buildApiCatalogAssets, buildApiCatalogSearchState, buildApiFallbackReply, buildFocusedApiContext, resolveApiCatalogReplyResolution } from "@/lib/chat/api-runtime"
import { loadAgentRuntimeApis } from "@/lib/apis"
import { buildBillingContextUpdate, buildBillingReplyResult } from "@/lib/chat/billing-intent-handler"
import { hasRecentCatalogSnapshot } from "@/lib/chat/catalog-follow-up"
import { resolveCatalogDecisionState } from "@/lib/chat/catalog-intent-handler"
import { buildLeadNameAcknowledgementReply, enrichLeadContext, extractName, isLikelyLeadNameReply } from "@/lib/chat/lead-stage"
import { resolveChatDomainRoute } from "@/lib/chat/domain-router"
import {
  buildFocusedProductCommercialReply,
  buildFocusedProductFactualResolution,
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicReply,
  resolveMercadoLivreHeuristicState,
  shouldAttachMercadoLivreAssetForMessage,
} from "@/lib/chat/mercado-livre"
import { generateOpenAiSalesReply } from "@/lib/chat/openai-sales-reply"
import { prefersStructuredReply } from "@/lib/chat/prompt-builders"
import { resolveConversationPipelineStageState } from "@/lib/chat/pipeline-stage"
import {
  buildApiDecisionFromSemanticIntent,
  buildBillingDecisionFromSemanticIntent,
  buildCatalogDecisionFromSemanticIntent,
  classifySemanticApiIntentStage,
  classifySemanticBillingIntentStage,
  classifySemanticIntentStage,
  extractDeterministicPricingCatalogFromAgentText,
  extractSemanticBusinessRuntimeFromAgentText,
  extractSemanticPricingCatalogFromAgentText,
} from "@/lib/chat/semantic-intent-stage"
import {
  buildProductSearchCandidates,
  isGreetingOrAckMessage,
  isOutOfScopeForCatalog,
  maybeAskForLeadIdentification,
  shouldContinueProductSearch,
  shouldSearchProducts,
} from "@/lib/chat/sales-heuristics"
import { normalizeText } from "@/lib/chat/text-utils"

export const USE_ORCHESTRATOR = true
const PRICING_CATALOG_CACHE_TTL_MS = 15 * 60 * 1000

function getPricingCatalogExtractionCache() {
  if (!globalThis.__infrastudioPricingCatalogExtractionCache) {
    globalThis.__infrastudioPricingCatalogExtractionCache = new Map()
  }

  return globalThis.__infrastudioPricingCatalogExtractionCache
}

function mapMessageRole(autor) {
  return autor === "atendente" ? "assistant" : "user"
}

function isSemanticApiFactualDecision(decision) {
  return ["api_fact_query", "api_status_query", "api_create_record", "api_catalog_search"].includes(decision?.kind)
}

function getAgentRuntimeConfig(context = {}) {
  const runtimeConfig = context?.agente?.runtimeConfig ?? context?.agente?.configuracoes?.runtimeConfig ?? null
  return runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig) ? runtimeConfig : null
}

function hasRuntimePricingCatalog(runtimeConfig = null) {
  return Boolean(
    runtimeConfig?.pricingCatalog?.enabled &&
      Array.isArray(runtimeConfig?.pricingCatalog?.items) &&
      runtimeConfig.pricingCatalog.items.length > 0
  )
}

function hasWeakRuntimePricingCatalog(runtimeConfig = null) {
  const items = Array.isArray(runtimeConfig?.pricingCatalog?.items) ? runtimeConfig.pricingCatalog.items : []
  if (!runtimeConfig?.pricingCatalog?.enabled || items.length < 2) {
    return true
  }

  return items.every((item) => normalizeText(`${item?.name || ""} ${item?.priceLabel || ""}`).includes("projetos sob medida"))
}

function hasRuntimeBusinessContext(runtimeConfig = null) {
  return Boolean(
    runtimeConfig?.business?.summary ||
      (Array.isArray(runtimeConfig?.business?.services) && runtimeConfig.business.services.length > 0) ||
      runtimeConfig?.sales?.cta
  )
}

function mergeRuntimePricingCatalog(runtimeConfig = null, pricingCatalog = null) {
  if (!pricingCatalog?.enabled || !Array.isArray(pricingCatalog?.items) || pricingCatalog.items.length === 0) {
    return runtimeConfig
  }

  return {
    ...(runtimeConfig ?? {}),
    pricingCatalog: {
      ...(runtimeConfig?.pricingCatalog ?? {}),
      ...pricingCatalog,
    },
  }
}

function mergeRuntimeBusinessContext(runtimeConfig = null, businessRuntime = null) {
  const hasBusinessSummary = Boolean(businessRuntime?.business?.summary)
  const hasBusinessServices = Array.isArray(businessRuntime?.business?.services) && businessRuntime.business.services.length > 0
  const hasSalesCta = Boolean(businessRuntime?.sales?.cta)

  if (!hasBusinessSummary && !hasBusinessServices && !hasSalesCta) {
    return runtimeConfig
  }

  return {
    ...(runtimeConfig ?? {}),
    business: {
      ...(runtimeConfig?.business ?? {}),
      ...(hasBusinessSummary ? { summary: businessRuntime.business.summary } : {}),
      ...(hasBusinessServices ? { services: businessRuntime.business.services } : {}),
    },
    sales: {
      ...(runtimeConfig?.sales ?? {}),
      ...(hasSalesCta ? { cta: businessRuntime.sales.cta } : {}),
    },
  }
}

function hashText(value = "") {
  let hash = 2166136261
  const text = String(value || "")
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

function buildPricingCatalogCacheKey(agentId = "", agentPromptBase = "") {
  const safeAgentId = String(agentId || "").trim()
  const safePrompt = String(agentPromptBase || "").trim()
  return `${safeAgentId}::${hashText(safePrompt)}`
}

async function resolveEffectiveRuntimePricingCatalog(input = {}) {
  const runtimeConfig = input.runtimeConfig ?? null
  const agentId = String(input.agentId || "").trim()
  const agentPromptBase = String(input.agentPromptBase || "").trim()
  const openAiKey = String(input.openAiKey || "").trim()
  const model = String(input.model || "").trim() || "gpt-4o-mini"

  if (agentPromptBase) {
    const deterministicPricingCatalog = extractDeterministicPricingCatalogFromAgentText(agentPromptBase)
    if (
      deterministicPricingCatalog?.enabled &&
      Array.isArray(deterministicPricingCatalog.items) &&
      deterministicPricingCatalog.items.length >= 2 &&
      (!hasRuntimePricingCatalog(runtimeConfig) || hasWeakRuntimePricingCatalog(runtimeConfig))
    ) {
      return mergeRuntimePricingCatalog(runtimeConfig, deterministicPricingCatalog)
    }
  }

  if (hasRuntimePricingCatalog(runtimeConfig) || !agentPromptBase || !openAiKey) {
    return runtimeConfig
  }

  const cache = getPricingCatalogExtractionCache()
  const cacheKey = buildPricingCatalogCacheKey(agentId, agentPromptBase)
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return mergeRuntimePricingCatalog(runtimeConfig, cached.value)
  }

  const extractedPricingCatalog = await (input.extractSemanticPricingCatalogFromAgentText ?? extractSemanticPricingCatalogFromAgentText)({
    sourceText: agentPromptBase,
    context: input.context,
    openAiKey,
    model,
  })

  cache.set(cacheKey, {
    value: extractedPricingCatalog,
    expiresAt: Date.now() + PRICING_CATALOG_CACHE_TTL_MS,
  })

  return mergeRuntimePricingCatalog(runtimeConfig, extractedPricingCatalog)
}

async function resolveEffectiveRuntimeBusinessContext(input = {}) {
  const runtimeConfig = input.runtimeConfig ?? null
  const agentId = String(input.agentId || "").trim()
  const agentPromptBase = String(input.agentPromptBase || "").trim()
  const openAiKey = String(input.openAiKey || "").trim()
  const model = String(input.model || "").trim() || "gpt-4o-mini"

  if (hasRuntimeBusinessContext(runtimeConfig) || !agentPromptBase || !openAiKey) {
    return runtimeConfig
  }

  const cache = getPricingCatalogExtractionCache()
  const cacheKey = `${buildPricingCatalogCacheKey(agentId, agentPromptBase)}::business`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return mergeRuntimeBusinessContext(runtimeConfig, cached.value)
  }

  const extractedBusinessRuntime = await (input.extractSemanticBusinessRuntimeFromAgentText ?? extractSemanticBusinessRuntimeFromAgentText)({
    sourceText: agentPromptBase,
    context: input.context,
    openAiKey,
    model,
  })

  cache.set(cacheKey, {
    value: extractedBusinessRuntime,
    expiresAt: Date.now() + PRICING_CATALOG_CACHE_TTL_MS,
  })

  return mergeRuntimeBusinessContext(runtimeConfig, extractedBusinessRuntime)
}

function isSimpleCommercialQuestion(message = "") {
  return (
    /\b(preco|precos|preÃ§os|valor|quanto|plano|planos|starter|basic|plus|pro|free|mensal|assinatura|teste)\b/i.test(
      String(message || "")
    ) || isCommercialCapabilityMessage(message)
  )
}

function isCommercialCapabilityMessage(message) {
  return /\b(site|sites|sistema|sistemas|ia|automacao|automação|whatsapp|integra(c|ç)(a|ã)o|painel|como funciona|faz|fazer|cria|criar|desenvolve|desenvolver)\b/i.test(
    String(message || "")
  )
}

function buildHeuristicReplyResult(reply, metadata = {}) {
  return {
    reply,
    assets: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
    metadata: {
      provider: metadata.provider ?? "local_heuristic",
      model: metadata.model ?? "heuristic",
      agenteId: metadata.agenteId ?? null,
      agenteNome: metadata.agenteNome ?? null,
      routeStage: metadata.routeStage ?? "sales",
      heuristicStage: metadata.heuristicStage ?? null,
      domainStage: metadata.domainStage ?? "general",
      catalogoProdutoAtual: metadata.catalogoProdutoAtual ?? null,
      catalogoBusca: metadata.catalogoBusca ?? null,
      semanticIntent: metadata.semanticIntent ?? null,
      catalogDiagnostics: metadata.catalogDiagnostics ?? null,
      billingDiagnostics: metadata.billingDiagnostics ?? null,
      billingContextUpdate: metadata.billingContextUpdate ?? null,
      apiRuntimeDiagnostics: metadata.apiRuntimeDiagnostics ?? null,
      apiRuntimeContextUpdate: metadata.apiRuntimeContextUpdate ?? null,
      routingDecision: metadata.routingDecision ?? null,
      focus: metadata.focus ?? null,
    },
  }
}

function buildCatalogDiagnosticsPayload(input = {}) {
  const listingSession = input.context?.catalogo?.listingSession ?? null
  return {
    contextCatalogo: input.context?.catalogo ?? null,
    catalogAction: input.context?.ui?.catalogAction ?? input.context?.catalogAction ?? null,
    catalogDecision: input.catalogFollowUpDecision ?? null,
    productSearchTerm: input.productSearchTerm ?? "",
    paginationOffset: input.paginationOffset ?? 0,
    paginationNextOffset: listingSession?.nextOffset ?? input.paginationNextOffset ?? 0,
    matchedCount: input.matchedCount ?? 0,
    replyAssetsCount: input.replyAssetsCount ?? 0,
  }
}

function buildBillingDiagnosticsPayload(input = {}) {
  const semanticTargetField =
    typeof input.semanticBillingDecision?.targetField === "string" && input.semanticBillingDecision.targetField.trim()
      ? input.semanticBillingDecision.targetField.trim()
      : null
  const semanticTargetFields = Array.isArray(input.semanticBillingDecision?.targetFields)
    ? input.semanticBillingDecision.targetFields.filter(Boolean)
    : []
  return {
    billingIntent: input.semanticBillingDecision?.kind ?? null,
    targetPlan: input.billingReplyMetadata?.targetPlan ?? null,
    targetField: semanticTargetField ?? input.billingReplyMetadata?.targetField ?? null,
    targetFields: semanticTargetFields.length ? semanticTargetFields : input.billingReplyMetadata?.targetFields ?? [],
    comparisonFocusBefore: input.context?.billing?.comparisonFocus ?? null,
    comparisonFocusAfter: input.billingContextUpdate?.comparisonFocus ?? input.context?.billing?.comparisonFocus ?? null,
    planFocusBefore: input.context?.billing?.planFocus ?? null,
    planFocusAfter: input.billingContextUpdate?.planFocus ?? input.context?.billing?.planFocus ?? null,
    fieldFound: input.billingReplyMetadata?.fieldFound ?? null,
    replyStrategy: input.billingReplyMetadata?.replyStrategy ?? null,
  }
}

function buildBillingRoutingOverride(baseDecision, latestUserMessage, semanticBillingDecision) {
  if (!semanticBillingDecision) {
    return baseDecision
  }

  if (["handoff", "agenda", "api_runtime", "catalog"].includes(baseDecision?.domain)) {
    return baseDecision
  }

  return {
    ...(baseDecision ?? {}),
    domain: "billing",
    source: "agent",
    confidence: semanticBillingDecision.confidence ?? 0.9,
    reason: semanticBillingDecision.reason || "billing_semantic_intent",
    shouldUseTool: false,
    focus: {
      domain: "billing",
      source: "agent",
      subject: latestUserMessage,
      confidence: semanticBillingDecision.confidence ?? 0.9,
    },
  }
}

function buildApiRoutingOverride(baseDecision, latestUserMessage, semanticApiDecision) {
  if (!semanticApiDecision) {
    return baseDecision
  }

  if (["handoff", "agenda", "billing"].includes(baseDecision?.domain)) {
    return baseDecision
  }

  return {
    ...(baseDecision ?? {}),
    domain: "api_runtime",
    source: "api",
    confidence: semanticApiDecision.confidence ?? 0.9,
    reason: semanticApiDecision.reason || "api_runtime_semantic_intent",
    shouldUseTool: true,
    focus: {
      domain: "api_runtime",
      source: "api",
      subject: latestUserMessage,
      confidence: semanticApiDecision.confidence ?? 0.9,
    },
  }
}

function buildCatalogRoutingOverride(baseDecision, latestUserMessage, semanticCatalogDecision, context = {}) {
  if (!semanticCatalogDecision) {
    return baseDecision
  }

  if (["handoff", "agenda", "api_runtime", "billing"].includes(baseDecision?.domain)) {
    return baseDecision
  }

  const hasMercadoLivreCapability =
    Number(baseDecision?.capabilities?.mercadoLivre ?? context?.projeto?.directConnections?.mercadoLivre ?? 0) > 0
  if (!hasMercadoLivreCapability) {
    return baseDecision
  }

  return {
    ...(baseDecision ?? {}),
    domain: "catalog",
    source: "mercado_livre",
    confidence: semanticCatalogDecision.confidence ?? 0.9,
    reason: semanticCatalogDecision.reason || "catalog_semantic_intent",
    shouldUseTool: true,
    focus: {
      domain: "catalog",
      source: "mercado_livre",
      subject: context?.catalogo?.produtoAtual?.nome || latestUserMessage,
      confidence: semanticCatalogDecision.confidence ?? 0.9,
    },
  }
}

function buildExplicitCatalogActionRoutingOverride(baseDecision, latestUserMessage, context = {}) {
  const explicitAction = String(context?.ui?.catalogAction || context?.catalogAction || "").trim().toLowerCase()
  if (!["load_more", "product_detail"].includes(explicitAction)) {
    return baseDecision
  }

  if (["handoff", "agenda", "api_runtime", "billing"].includes(baseDecision?.domain)) {
    return baseDecision
  }

  const hasMercadoLivreCapability =
    Number(baseDecision?.capabilities?.mercadoLivre ?? context?.projeto?.directConnections?.mercadoLivre ?? 0) > 0
  if (!hasMercadoLivreCapability) {
    return baseDecision
  }

  return {
    ...(baseDecision ?? {}),
    domain: "catalog",
    source: "mercado_livre",
    confidence: 1,
    reason: `explicit_catalog_action_${explicitAction}`,
    shouldUseTool: true,
    focus: {
      domain: "catalog",
      source: "mercado_livre",
      subject: context?.catalogo?.produtoAtual?.nome || latestUserMessage,
      confidence: 1,
    },
  }
}

function normalizeRuntimeApiIntentType(api) {
  const value = String(api?.config?.runtime?.intentType || "").trim().toLowerCase()
  return ["create_record", "lookup_by_identifier", "knowledge_search", "catalog_search", "generic_fact"].includes(value)
    ? value
    : "generic_fact"
}

function formatRuntimeFieldLabel(value) {
  return String(value || "")
    .split(".")
    .pop()
    .replace(/_/g, " ")
    .trim()
}

function getRuntimeRequiredFieldsForDiagnostics(api) {
  const requiredFields = api?.config?.runtime?.requiredFields
  if (!Array.isArray(requiredFields)) {
    return []
  }

  return requiredFields
    .map((field) => {
      if (typeof field === "string") {
        const name = String(field || "").trim()
        return name ? { name, label: formatRuntimeFieldLabel(name) } : null
      }

      const name = String(field?.name || field?.nome || field?.param || field?.contextPath || field?.source || "").trim()
      const label = String(field?.label || field?.titulo || field?.description || field?.descricao || "").trim() || formatRuntimeFieldLabel(name)
      return name ? { name, label } : null
    })
    .filter(Boolean)
}

function hasRuntimeFieldValueForDiagnostics(api, fieldName) {
  const normalizedName = normalizeText(String(fieldName || "").replace(/\./g, "_"))
  return (Array.isArray(api?.campos) ? api.campos : []).some((field) => {
    const normalizedField = normalizeText(String(field?.nome || "").replace(/\./g, "_"))
    return (
      normalizedField &&
      (normalizedField === normalizedName || normalizedField.endsWith(`_${normalizedName}`) || normalizedField.endsWith(normalizedName)) &&
      field?.valor != null &&
      String(field.valor).trim()
    )
  })
}

function buildRuntimeApiDiagnosticItem(api) {
  const intentType = normalizeRuntimeApiIntentType(api)
  const requiredFields = getRuntimeRequiredFieldsForDiagnostics(api)
  const missingRequiredFields = requiredFields.filter((field) => !hasRuntimeFieldValueForDiagnostics(api, field.name))
  const method = String(api?.metodo || api?.method || "").toUpperCase()
  const executed = Number(api?.status ?? 0) > 0 || Number(api?.durationMs ?? 0) > 0 || Boolean(String(api?.contentType || "").trim())
  const blockedReasons = [
    intentType === "create_record" && !executed ? "create_record_sem_execucao_automatica" : "",
    api?.config?.runtime?.requiresConfirmation === true && !executed ? "requires_confirmation" : "",
    missingRequiredFields.length ? "missing_required_fields" : "",
    api?.ok === false ? "api_unavailable_or_not_executed" : "",
  ].filter(Boolean)

  return {
    id: api?.apiId ?? api?.id ?? null,
    nome: api?.nome ?? api?.name ?? null,
    method: method || null,
    intentType,
    ok: api?.ok !== false,
    status: api?.status ?? null,
    cacheHit: api?.cache?.hit === true,
    fields: Array.isArray(api?.campos) ? api.campos.length : 0,
    requiredFields: requiredFields.map((field) => field.label),
    missingRequiredFields: missingRequiredFields.map((field) => field.label),
    blockedReasons,
  }
}

function buildApiRuntimeDiagnosticsPayload({ runtimeApis = [], semanticApiDecision = null, focusedApiContext = null, routingDecision = null } = {}) {
  const apiItems = (runtimeApis ?? []).map(buildRuntimeApiDiagnosticItem)
  const selectedApiId = semanticApiDecision?.apiId || focusedApiContext?.fields?.[0]?.apiId || null
  const selectedApi = selectedApiId ? apiItems.find((api) => api.id === selectedApiId) ?? null : null
  const conflictingApiIds =
    !selectedApiId && semanticApiDecision?.intentType
      ? apiItems.filter((api) => api.intentType === semanticApiDecision.intentType).map((api) => api.id).filter(Boolean)
      : []

  return {
    selectedApiId,
    intentType: semanticApiDecision?.intentType || null,
    semanticKind: semanticApiDecision?.kind || null,
    semanticConfidence: semanticApiDecision?.confidence ?? null,
    semanticReason: semanticApiDecision?.reason || null,
    parameterValues:
      semanticApiDecision?.parameterValues && typeof semanticApiDecision.parameterValues === "object" && !Array.isArray(semanticApiDecision.parameterValues)
        ? semanticApiDecision.parameterValues
        : {},
    routeDomain: routingDecision?.domain || null,
    routeReason: routingDecision?.reason || null,
    focusedFieldCount: Array.isArray(focusedApiContext?.fields) ? focusedApiContext.fields.length : 0,
    selectedMissingRequiredFields: selectedApi?.missingRequiredFields ?? [],
    selectedBlockedReasons: selectedApi?.blockedReasons ?? [],
    conflictingApiIds: conflictingApiIds.length > 1 ? conflictingApiIds : [],
    apis: apiItems,
  }
}

function buildApiRuntimeContextUpdate({ semanticApiDecision = null, apiRuntimeDiagnostics = null } = {}) {
  if (!apiRuntimeDiagnostics?.selectedApiId && !apiRuntimeDiagnostics?.intentType && !apiRuntimeDiagnostics?.semanticKind) {
    return null
  }

  const missingRequiredFields = Array.isArray(apiRuntimeDiagnostics?.selectedMissingRequiredFields)
    ? apiRuntimeDiagnostics.selectedMissingRequiredFields.filter((field) => typeof field === "string" && field.trim())
    : []
  const blockedReasons = Array.isArray(apiRuntimeDiagnostics?.selectedBlockedReasons)
    ? apiRuntimeDiagnostics.selectedBlockedReasons.filter((reason) => typeof reason === "string" && reason.trim())
    : []

  return {
    lastApiId: typeof apiRuntimeDiagnostics.selectedApiId === "string" ? apiRuntimeDiagnostics.selectedApiId : null,
    lastIntent: typeof apiRuntimeDiagnostics.semanticKind === "string" ? apiRuntimeDiagnostics.semanticKind : semanticApiDecision?.kind ?? null,
    lastIntentType:
      typeof apiRuntimeDiagnostics.intentType === "string" ? apiRuntimeDiagnostics.intentType : semanticApiDecision?.intentType ?? null,
    missingRequiredFields,
    blockedReasons,
    pendingConfirmation:
      blockedReasons.includes("requires_confirmation") || blockedReasons.includes("create_record_sem_execucao_automatica"),
    updatedAt: new Date().toISOString(),
  }
}

function buildBaseRoutingDecision(latestUserMessage, history, context, runtimeApis, focusedApiContext, runtimeConfig) {
  return resolveChatDomainRoute({
    latestUserMessage,
    history,
    context,
    project: context?.projeto ?? null,
    runtimeApis,
    focusedApiContext,
    runtimeConfig,
  })
}

function getRuntimeApiId(api) {
  return String(api?.apiId || api?.id || "").trim()
}

function getRuntimeApiMissingParams(api) {
  return Array.isArray(api?.missingParams) ? api.missingParams.map((item) => String(item || "").trim()).filter(Boolean) : []
}

function hasCatalogSearchSignal(message) {
  const normalized = normalizeText(message)
  if (!normalized || isGreetingOrAckMessage(message)) {
    return false
  }

  return [
    "imovel",
    "imoveis",
    "produto",
    "item",
    "busca",
    "buscar",
    "tem",
    "procura",
    "procurar",
    "traga",
    "trazer",
    "titulo",
    "titulos",
    "nome",
    "predio",
    "apartamento",
    "casa",
    "terreno",
    "condominio",
  ].some((signal) => normalized.split(" ").includes(signal))
}

function extractSingleCatalogSearchTerm(message) {
  const rawWords = String(message || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
  const stopwords = new Set([
    "a",
    "as",
    "busca",
    "buscar",
    "da",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "esse",
    "essa",
    "este",
    "esta",
    "imovel",
    "imoveis",
    "me",
    "nome",
    "o",
    "os",
    "por",
    "pode",
    "procura",
    "procurar",
    "tem",
    "tenho",
    "titulo",
    "titulos",
    "traga",
    "trazer",
    "um",
    "uma",
    "vc",
    "voce",
  ])
  const terms = rawWords.filter((word) => !stopwords.has(normalizeText(word)))
  const value = (terms.length ? terms : rawWords).join(" ").trim()
  if (!value || value.length < 2 || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) {
    return ""
  }

  return value.slice(0, 120)
}

function isLikelyStandaloneCatalogSearchTerm(message, term) {
  if (!term || isGreetingOrAckMessage(message)) {
    return false
  }

  const termWords = term.split(/\s+/).filter(Boolean)
  if (termWords.length < 2 || termWords.length > 8) {
    return false
  }

  const normalized = normalizeText(message)
  if (/\?$/.test(String(message || "").trim()) && !hasCatalogSearchSignal(message)) {
    return false
  }

  return !["obrigado", "obrigada", "valeu", "beleza", "blz", "ok"].some((signal) => normalized === signal)
}

function buildSingleCatalogSearchFallbackDecision(latestUserMessage, runtimeApis = [], semanticApiDecision = null) {
  if (semanticApiDecision) {
    return null
  }

  const candidates = runtimeApis.filter((api) => normalizeRuntimeApiIntentType(api) === "catalog_search")
  if (candidates.length !== 1) {
    return null
  }

  const api = candidates[0]
  const missingParams = getRuntimeApiMissingParams(api)
  if (missingParams.length !== 1) {
    return null
  }

  const term = extractSingleCatalogSearchTerm(latestUserMessage)
  if (!hasCatalogSearchSignal(latestUserMessage) && !isLikelyStandaloneCatalogSearchTerm(latestUserMessage, term)) {
    return null
  }

  if (!term) {
    return null
  }

  return {
    kind: "api_catalog_search",
    confidence: 0.62,
    reason: "single_catalog_search_parameter_fallback",
    targetFieldHints: [],
    supportFieldHints: [],
    comparisonMode: "",
    apiId: getRuntimeApiId(api),
    intentType: "catalog_search",
    parameterValues: {
      [missingParams[0]]: term,
    },
    referencedProductIndexes: [],
    usedLlm: false,
  }
}

function getApiSearchTermFromDecision(decision = null) {
  const values =
    decision?.parameterValues && typeof decision.parameterValues === "object" && !Array.isArray(decision.parameterValues)
      ? Object.values(decision.parameterValues)
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : []

  return values[0] || ""
}

async function reloadRuntimeApisWithSemanticParameters({ semanticApiDecision, context, runtimeApis, options = {} }) {
  let parameterValues =
    semanticApiDecision?.parameterValues && typeof semanticApiDecision.parameterValues === "object" && !Array.isArray(semanticApiDecision.parameterValues)
      ? Object.fromEntries(
          Object.entries(semanticApiDecision.parameterValues)
            .map(([key, value]) => [String(key || "").trim(), String(value ?? "").trim()])
            .filter(([key, value]) => key && value),
        )
      : {}
  const selectedApiId = String(semanticApiDecision?.apiId || "").trim()
  const targetApis = runtimeApis.filter((api) => {
    const apiId = String(api?.apiId || api?.id || "").trim()
    const intentType = String(api?.config?.runtime?.intentType || "").trim()
    const hasMissingParams = Array.isArray(api?.missingParams) && api.missingParams.length > 0

    if (selectedApiId) {
      return apiId === selectedApiId
    }

    return hasMissingParams && intentType === semanticApiDecision?.intentType
  })
  const fallbackTargetApis =
    targetApis.length > 0
      ? targetApis
      : !selectedApiId && semanticApiDecision?.kind === "api_catalog_search"
        ? runtimeApis.filter((api) => String(api?.config?.runtime?.intentType || "").trim() === "catalog_search")
        : []
  const resolvedSelectedApiId =
    selectedApiId || (fallbackTargetApis.length === 1 ? String(fallbackTargetApis[0]?.apiId || fallbackTargetApis[0]?.id || "").trim() : "")
  const resolvedTargetApi = fallbackTargetApis.find((api) => String(api?.apiId || api?.id || "").trim() === resolvedSelectedApiId)
  const missingParams = Array.isArray(resolvedTargetApi?.missingParams)
    ? resolvedTargetApi.missingParams.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  if (missingParams.length === 1 && !parameterValues[missingParams[0]]) {
    const extractedValues = Object.values(parameterValues).map((value) => String(value || "").trim()).filter(Boolean)
    if (extractedValues.length === 1) {
      parameterValues = {
        ...parameterValues,
        [missingParams[0]]: extractedValues[0],
      }
    }
  }
  const needsReload = Object.keys(parameterValues).length > 0 && Boolean(resolvedSelectedApiId)

  if (!needsReload || !context?.agente?.id || !context?.projeto?.id) {
    return runtimeApis
  }

  const loadApis = options.loadAgentRuntimeApis ?? loadAgentRuntimeApis
  const enrichedContext = {
    ...context,
    ...parameterValues,
    apiRuntime: {
      ...(context?.apiRuntime && typeof context.apiRuntime === "object" && !Array.isArray(context.apiRuntime) ? context.apiRuntime : {}),
      parameterValues,
      selectedApiId: resolvedSelectedApiId,
    },
  }

  const reloadedApis = await loadApis({
    agenteId: context.agente.id,
    projetoId: context.projeto.id,
    context: enrichedContext,
  })

  return Array.isArray(reloadedApis) && reloadedApis.length ? reloadedApis : runtimeApis
}

function hasLockedCatalogProductPricingPriority(routingDecision, context = {}) {
  if (routingDecision?.domain !== "catalog") {
    return false
  }

  if (!context?.catalogo?.produtoAtual?.nome) {
    return false
  }

  const mode = String(context?.conversation?.mode || context?.ui?.mode || context?.storefront?.pageKind || "").trim().toLowerCase()
  return ["product_detail", "product_focus"].includes(mode)
}

function hasCatalogStorefrontSemanticContext(context = {}) {
  const pageKind = String(context?.storefront?.pageKind || "").trim().toLowerCase()
  const kind = String(context?.storefront?.kind || "").trim().toLowerCase()
  const conversationMode = String(context?.conversation?.mode || context?.ui?.mode || "").trim().toLowerCase()

  return (
    kind === "mercado_livre" ||
    pageKind === "storefront" ||
    pageKind === "product_detail" ||
    conversationMode === "listing" ||
    context?.ui?.catalogPreferred === true
  )
}

export function buildConversationHistory(conversation, texto) {
  const messages = conversation?.mensagens ?? []
  const history = messages.map((message) => ({
    role: mapMessageRole(message.autor),
    content: message.texto,
  }))

  return [
    ...history,
    {
      role: "user",
      content: texto,
    },
  ]
}

export async function executeSalesOrchestrator(history, context, options = {}) {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"
  const agentName = context?.agente?.nome?.trim() || ""
  const agentId = context?.agente?.id?.trim() || ""
  const agentPromptBase = context?.agente?.promptBase?.trim() || context?.agente?.descricao?.trim() || ""
  const latestUserMessage = [...(history ?? [])].reverse().find((item) => item.role === "user")?.content ?? ""
  let runtimeApis = Array.isArray(context?.runtimeApis) ? context.runtimeApis : []
  const baseRuntimeConfig = getAgentRuntimeConfig(context)
  const structuredResponse = prefersStructuredReply(context)
  const initialFocusedApiContext = buildFocusedApiContext(latestUserMessage, runtimeApis)
  const initialRoutingDecision = buildBaseRoutingDecision(
    latestUserMessage,
    history,
    context,
    runtimeApis,
    initialFocusedApiContext,
    baseRuntimeConfig
  )
  const hasProductPricingPriority = hasLockedCatalogProductPricingPriority(initialRoutingDecision, context)
  const shouldResolveBusinessRuntimeFromAgentText =
    !hasRuntimeBusinessContext(baseRuntimeConfig) &&
    agentPromptBase &&
    openAiKey &&
    !["handoff", "agenda", "catalog", "api_runtime"].includes(initialRoutingDecision?.domain)
  const shouldResolvePricingCatalogFromAgentText =
    !hasRuntimePricingCatalog(baseRuntimeConfig) &&
    agentPromptBase &&
    openAiKey &&
    !hasProductPricingPriority &&
    !["handoff", "agenda", "catalog", "api_runtime"].includes(initialRoutingDecision?.domain)
  const runtimeConfigWithBusiness =
    shouldResolveBusinessRuntimeFromAgentText
      ? await resolveEffectiveRuntimeBusinessContext({
          runtimeConfig: baseRuntimeConfig,
          agentId,
          agentPromptBase,
          context,
          openAiKey,
          model,
          extractSemanticBusinessRuntimeFromAgentText: options.extractSemanticBusinessRuntimeFromAgentText,
        })
      : baseRuntimeConfig
  const runtimeConfig = shouldResolvePricingCatalogFromAgentText
    ? await resolveEffectiveRuntimePricingCatalog({
        runtimeConfig: runtimeConfigWithBusiness,
        agentId,
        agentPromptBase,
        context,
        openAiKey,
        model,
        extractSemanticPricingCatalogFromAgentText: options.extractSemanticPricingCatalogFromAgentText,
      })
    : runtimeConfigWithBusiness
  const runtimeConfigMeta = {
    pricingCatalogDerived: !hasRuntimePricingCatalog(baseRuntimeConfig) && hasRuntimePricingCatalog(runtimeConfig),
    businessDerived: !hasRuntimeBusinessContext(baseRuntimeConfig) && hasRuntimeBusinessContext(runtimeConfig),
  }
  const effectiveContext =
    runtimeConfig === baseRuntimeConfig
      ? context
      : {
          ...context,
          agente: {
            ...(context?.agente ?? {}),
            runtimeConfig,
            runtimeConfigMeta,
          },
        }
  const baseRoutingDecision =
    effectiveContext === context && runtimeConfig === baseRuntimeConfig
      ? initialRoutingDecision
      : buildBaseRoutingDecision(latestUserMessage, history, effectiveContext, runtimeApis, initialFocusedApiContext, runtimeConfig)
  const semanticApiIntent =
    runtimeApis.length
      ? await (options.classifySemanticApiIntentStage ?? classifySemanticApiIntentStage)({
          latestUserMessage,
          runtimeApis,
          context: effectiveContext,
          openAiKey,
          model,
        })
      : null
  const semanticApiDecision =
    buildApiDecisionFromSemanticIntent({ semanticIntent: semanticApiIntent }) ??
    buildSingleCatalogSearchFallbackDecision(latestUserMessage, runtimeApis, null)
  runtimeApis = await reloadRuntimeApisWithSemanticParameters({
    semanticApiDecision,
    context: effectiveContext,
    runtimeApis,
    options,
  })
  const focusedApiContext =
    semanticApiDecision?.targetFieldHints?.length || semanticApiDecision?.supportFieldHints?.length
      ? buildFocusedApiContext(latestUserMessage, runtimeApis, {
          targetFieldHints: semanticApiDecision?.targetFieldHints,
          supportFieldHints: semanticApiDecision?.supportFieldHints,
        })
      : initialFocusedApiContext
  const shouldUseBaseApiRuntime = baseRoutingDecision.domain === "api_runtime" && baseRoutingDecision.shouldUseTool === true
  const shouldUseBaseMercadoLivre =
    baseRoutingDecision.domain === "catalog" && baseRoutingDecision.source === "mercado_livre" && baseRoutingDecision.shouldUseTool === true
  const shouldEvaluateSemanticCatalog =
    (shouldUseBaseMercadoLivre || Number(baseRoutingDecision?.capabilities?.mercadoLivre ?? context?.projeto?.directConnections?.mercadoLivre ?? 0) > 0) &&
    (context?.catalogo?.produtoAtual || hasRecentCatalogSnapshot(context) || hasCatalogStorefrontSemanticContext(context))
  const semanticCatalogIntent =
    shouldEvaluateSemanticCatalog
      ? await (options.classifySemanticIntentStage ?? classifySemanticIntentStage)({
          latestUserMessage,
          currentCatalogProduct: context?.catalogo?.produtoAtual,
          recentProducts: context?.catalogo?.ultimosProdutos,
          storefrontContext: hasCatalogStorefrontSemanticContext(context) ? context?.storefront ?? { kind: "mercado_livre" } : null,
          context: effectiveContext,
          openAiKey,
          model,
        })
      : null
  const semanticCatalogDecision = buildCatalogDecisionFromSemanticIntent({
    semanticIntent: semanticCatalogIntent,
    recentProducts: context?.catalogo?.ultimosProdutos,
    currentCatalogProduct: context?.catalogo?.produtoAtual,
  })
  const semanticBillingIntent =
    hasRuntimePricingCatalog(runtimeConfig) && !hasProductPricingPriority
      ? await (options.classifySemanticBillingIntentStage ?? classifySemanticBillingIntentStage)({
          latestUserMessage,
          pricingItems: runtimeConfig.pricingCatalog.items,
          context: effectiveContext,
          openAiKey,
          model,
        })
      : null
  const semanticBillingDecision = buildBillingDecisionFromSemanticIntent({ semanticIntent: semanticBillingIntent })
  const apiRoutingDecision = buildApiRoutingOverride(baseRoutingDecision, latestUserMessage, semanticApiDecision)
  const billingRoutingDecision = buildBillingRoutingOverride(apiRoutingDecision, latestUserMessage, semanticBillingDecision)
  const explicitCatalogActionRoutingDecision = buildExplicitCatalogActionRoutingOverride(
    billingRoutingDecision,
    latestUserMessage,
    context
  )
  const routingDecision = buildCatalogRoutingOverride(
    explicitCatalogActionRoutingDecision,
    latestUserMessage,
    semanticCatalogDecision,
    context
  )
  const shouldUseApiRuntime = routingDecision.domain === "api_runtime" && routingDecision.shouldUseTool === true
  const shouldUseMercadoLivre = routingDecision.domain === "catalog" && routingDecision.source === "mercado_livre" && routingDecision.shouldUseTool === true
  const hasFocusedApiContext = shouldUseApiRuntime && focusedApiContext.fields.length > 0
  const { catalogDecision: catalogFollowUpDecision, catalogReferenceReply } = resolveCatalogDecisionState({
    latestUserMessage,
    context,
    semanticDecision: semanticCatalogDecision,
    shouldUseCatalog: shouldUseMercadoLivre,
    buildProductSearchCandidates,
    shouldSearchProducts,
  })
  const mercadoLivreFlowState = resolveMercadoLivreFlowState({
    latestUserMessage,
    context,
    catalogFollowUpDecision,
    detectProductSearch: (message) =>
      shouldUseMercadoLivre &&
      (shouldSearchProducts(message, {
        normalizeText,
      }) ||
        shouldContinueProductSearch(history, message, context, {
          isGreetingOrAckMessage,
        })),
    buildProductSearchCandidates,
    isMercadoLivreListingIntent: () => shouldUseMercadoLivre,
  })
  const mercadoLivreState = await resolveMercadoLivreHeuristicState({
    context,
    project: context?.projeto ?? null,
    latestUserMessage,
    productSearchRequested: shouldUseMercadoLivre && mercadoLivreFlowState.productSearchRequested,
    genericMercadoLivreListingRequested: shouldUseMercadoLivre && mercadoLivreFlowState.genericMercadoLivreListingRequested,
    forceNewSearch: shouldUseMercadoLivre && mercadoLivreFlowState.forceNewSearch,
    loadMoreCatalogRequested: shouldUseMercadoLivre && mercadoLivreFlowState.loadMoreCatalogRequested,
    productSearchTerm: mercadoLivreFlowState.productSearchTerm,
    excludeCurrentProductFromSearch: mercadoLivreFlowState.excludeCurrentProductFromSearch,
    excludeCatalogProductIds: mercadoLivreFlowState.excludeCatalogProductIds,
    priceMaxExclusive: mercadoLivreFlowState.priceMaxExclusive,
    allowEmptyCatalogSearch: mercadoLivreFlowState.allowEmptyCatalogSearch,
    lastSearchTerm: mercadoLivreFlowState.lastSearchTerm,
    paginationOffset: mercadoLivreFlowState.paginationOffset,
    paginationPoolLimit: mercadoLivreFlowState.paginationPoolLimit,
    catalogComparisonIntent: mercadoLivreFlowState.catalogComparisonIntent,
    currentCatalogProduct: mercadoLivreFlowState.currentCatalogProduct,
    recentCatalogProducts: mercadoLivreFlowState.recentCatalogProducts,
    referencedCatalogProducts: mercadoLivreFlowState.referencedCatalogProducts,
    resolveMercadoLivreSearch: options.resolveMercadoLivreSearch,
    resolveMercadoLivreProductById: options.resolveMercadoLivreProductById,
  })
  const selectedMercadoLivreProductReply = mercadoLivreState?.selectedProductSalesReply ?? null
  const selectedMercadoLivreProductShouldAttachAsset = mercadoLivreState?.selectedProductShouldAttachAsset === true
  const mercadoLivreReply = resolveMercadoLivreHeuristicReply(mercadoLivreState)
  const apiSearchTerm = getApiSearchTermFromDecision(semanticApiDecision)
  const baseApiCatalogSearchState = shouldUseApiRuntime ? buildApiCatalogSearchState(runtimeApis) : null
  const apiCatalogSearchState =
    baseApiCatalogSearchState && apiSearchTerm
      ? {
          ...baseApiCatalogSearchState,
          ultimaBusca: apiSearchTerm,
        }
      : baseApiCatalogSearchState
  const apiCatalogAssets = shouldUseApiRuntime ? buildApiCatalogAssets(runtimeApis) : []
  const apiCatalogProduct =
    (apiCatalogSearchState?.produtoAtual && typeof apiCatalogSearchState.produtoAtual === "object"
      ? apiCatalogSearchState.produtoAtual
      : null) ??
    (Array.isArray(apiCatalogSearchState?.ultimosProdutos) && apiCatalogSearchState.ultimosProdutos.length === 1
      ? apiCatalogSearchState.ultimosProdutos[0]
      : null)
  const apiCatalogReply =
    shouldUseApiRuntime
      ? resolveApiCatalogReplyResolution(latestUserMessage, context, runtimeApis, {
          semanticApiDecision,
        })
      : null
  const mercadoLivreAssets = Array.isArray(mercadoLivreState?.mercadoLivreAssets) ? mercadoLivreState.mercadoLivreAssets : []
  const mercadoLivreCatalogSearchState =
    mercadoLivreState?.catalogSearchState && typeof mercadoLivreState.catalogSearchState === "object"
      ? mercadoLivreState.catalogSearchState
      : null
  const mercadoLivreSelectedProduct =
    mercadoLivreState?.selectedCatalogProduct ??
    mercadoLivreFlowState.currentCatalogProduct ??
    (Array.isArray(mercadoLivreState?.mercadoLivreProducts) && mercadoLivreState.mercadoLivreProducts.length === 1
      ? {
          id: mercadoLivreState.mercadoLivreProducts[0].id,
          nome: mercadoLivreState.mercadoLivreProducts[0].title,
          preco: mercadoLivreState.mercadoLivreProducts[0].price,
          descricao: mercadoLivreAssets[0]?.descricao ?? mercadoLivreState.mercadoLivreProducts[0].title,
          link: mercadoLivreState.mercadoLivreProducts[0].permalink,
          imagem: mercadoLivreState.mercadoLivreProducts[0].thumbnail,
          sellerId: mercadoLivreState.mercadoLivreProducts[0].sellerId,
          sellerName: mercadoLivreState.mercadoLivreProducts[0].sellerName,
          availableQuantity: mercadoLivreState.mercadoLivreProducts[0].availableQuantity,
        }
      : null)
  const leadNameReplyDetected = isLikelyLeadNameReply(latestUserMessage, history, { extractName })
  const extractedLeadName = leadNameReplyDetected ? extractName(latestUserMessage) : null
  const leadNameAcknowledgementReply =
    leadNameReplyDetected && extractedLeadName ? buildLeadNameAcknowledgementReply(extractedLeadName, true) : null
  const currentCatalogProduct = mercadoLivreSelectedProduct ?? apiCatalogProduct ?? context?.catalogo?.produtoAtual ?? null
  const deterministicMercadoLivreFactualResolution =
    shouldUseMercadoLivre && currentCatalogProduct
      ? buildFocusedProductFactualResolution(currentCatalogProduct, latestUserMessage, {
          semanticIntent: semanticCatalogIntent,
          previousFactContext: context?.catalogo?.productFocus?.factualContext ?? null,
        })
      : null
  const deterministicMercadoLivreFactualReply = deterministicMercadoLivreFactualResolution?.reply ?? null
  const deterministicMercadoLivreCommercialReply =
    shouldUseMercadoLivre &&
    currentCatalogProduct &&
    semanticCatalogDecision?.kind === "current_product_commercial_advice"
      ? buildFocusedProductCommercialReply(currentCatalogProduct, {
          adviceType: semanticCatalogDecision.adviceType,
        })
      : null
  const shouldPreferMercadoLivreListing =
    shouldUseMercadoLivre &&
    mercadoLivreAssets.length > 0 &&
    (mercadoLivreFlowState.productSearchRequested ||
      mercadoLivreFlowState.genericMercadoLivreListingRequested ||
      mercadoLivreFlowState.loadMoreCatalogRequested)
  const catalogPricingReply = runtimeConfig?.pricingCatalog?.enabled
    ? buildBillingReplyResult(runtimeConfig, effectiveContext, semanticBillingDecision)
    : null
  const billingContextUpdate = catalogPricingReply ? buildBillingContextUpdate(semanticBillingDecision, runtimeConfig, effectiveContext) : null
  const shouldDeferLeadCapture =
    Boolean(runtimeConfig?.leadCapture?.deferOnQuestions) &&
    (isCommercialCapabilityMessage(latestUserMessage) || /\?/.test(String(latestUserMessage || "")))
  const simpleCommercialQuestion = isSimpleCommercialQuestion(latestUserMessage)
  const leadIdentificationReply =
    !leadNameReplyDetected && !shouldDeferLeadCapture
      ? maybeAskForLeadIdentification(context, history, latestUserMessage, {
          normalizeText,
          runtimeConfig,
          isOutOfScopeForCatalog: (conversationHistory) =>
            runtimeConfig?.leadCapture?.respectCatalogBoundary ? isOutOfScopeForCatalog(conversationHistory, { normalizeText }) : true,
          isWhatsAppChannel: (runtimeContext) =>
            String(runtimeContext?.channel?.kind ?? runtimeContext?.canal ?? "").toLowerCase() === "whatsapp",
          isGreetingOrAckMessage: (message) => isGreetingOrAckMessage(message, { normalizeText }),
        })
      : null
  const pipelineState = resolveConversationPipelineStageState({
    hasFocusedApiContext,
    hasCurrentCatalogContext: Boolean(currentCatalogProduct),
    hasMercadoLivreContext: Boolean(mercadoLivreReply),
    hasCatalogReferenceHeuristicReply: Boolean(catalogReferenceReply),
    hasMercadoLivreHeuristicReply: Boolean(mercadoLivreReply),
    leadIdentificationReply,
    catalogPricingReply,
    hasValidAgent: Boolean(context?.agente?.id && agentName && agentPromptBase),
    hasOpenAiKey: Boolean(openAiKey),
  })
  const apiRuntimeDiagnostics = buildApiRuntimeDiagnosticsPayload({
    runtimeApis,
    semanticApiDecision,
    focusedApiContext,
    routingDecision,
  })
  const apiRuntimeContextUpdate = buildApiRuntimeContextUpdate({
    semanticApiDecision,
    apiRuntimeDiagnostics,
  })
  const heuristicMetadata = {
    agenteId: context?.agente?.id ?? null,
    agenteNome: context?.agente?.nome ?? null,
    routeStage: "sales",
    domainStage: pipelineState.conversationDomainStage,
    catalogoProdutoAtual: (shouldUseMercadoLivre || shouldUseApiRuntime) ? currentCatalogProduct ?? null : null,
    routingDecision,
    focus: routingDecision.focus ?? null,
    semanticIntent: semanticBillingIntent ?? semanticCatalogIntent ?? semanticApiIntent,
    catalogDiagnostics: buildCatalogDiagnosticsPayload({
      context,
      catalogFollowUpDecision,
      productSearchTerm: mercadoLivreFlowState.productSearchTerm,
      paginationOffset: mercadoLivreFlowState.paginationOffset,
      paginationNextOffset: context?.catalogo?.paginationNextOffset ?? 0,
      matchedCount:
        mercadoLivreCatalogSearchState?.listingSession?.total ??
        mercadoLivreCatalogSearchState?.paginationTotal ??
        mercadoLivreState?.mercadoLivreProducts?.length ??
        context?.catalogo?.listingSession?.total ??
        context?.catalogo?.paginationTotal ??
        0,
      replyAssetsCount: mercadoLivreAssets.length,
      }),
    billingDiagnostics: buildBillingDiagnosticsPayload({
      context: effectiveContext,
      semanticBillingDecision,
      billingReplyMetadata: catalogPricingReply?.metadata ?? null,
      billingContextUpdate,
    }),
    apiRuntimeDiagnostics,
    apiRuntimeContextUpdate,
  }

  if (!context?.agente?.id || !agentName || !agentPromptBase) {
    throw new Error("Agente do chat sem configuração válida de prompt.")
  }

  if (leadNameAcknowledgementReply) {
    return buildHeuristicReplyResult(leadNameAcknowledgementReply, {
      ...heuristicMetadata,
      heuristicStage: "lead_name_acknowledgement",
    })
  }

  if (shouldUseApiRuntime && (isSemanticApiFactualDecision(semanticApiDecision) || hasFocusedApiContext)) {
    const apiReply =
      apiCatalogReply ??
      buildApiFallbackReply(latestUserMessage, runtimeApis, {
        targetFieldHints: semanticApiDecision?.targetFieldHints,
        supportFieldHints: semanticApiDecision?.supportFieldHints,
        apiId: semanticApiDecision?.apiId,
        intentType: semanticApiDecision?.intentType,
      })
    const apiReplyText = typeof apiReply === "string" ? apiReply : apiReply?.reply
    if (apiReplyText) {
      return {
        ...buildHeuristicReplyResult(apiReplyText, {
          ...heuristicMetadata,
          heuristicStage: "api_runtime",
          domainStage: "api_runtime",
          provider: "api_runtime",
          catalogoProdutoAtual: apiReply?.currentCatalogProduct ?? apiCatalogProduct ?? currentCatalogProduct ?? null,
          catalogoBusca: apiCatalogSearchState,
          catalogFactContext: apiReply?.factContext ?? null,
        }),
        assets: apiCatalogAssets,
      }
    }
  }

  if (apiCatalogReply?.reply) {
    return {
      ...buildHeuristicReplyResult(apiCatalogReply.reply, {
        ...heuristicMetadata,
        heuristicStage: "api_catalog_runtime",
        domainStage: "api_runtime",
        provider: "api_runtime",
        catalogoProdutoAtual: apiCatalogReply.currentCatalogProduct ?? apiCatalogProduct ?? currentCatalogProduct ?? null,
        catalogoBusca: apiCatalogSearchState,
        catalogFactContext: apiCatalogReply.factContext ?? null,
      }),
      assets: apiCatalogAssets,
    }
  }

  if (
    catalogFollowUpDecision?.kind === "recent_product_reference_ambiguous" &&
    Array.isArray(catalogFollowUpDecision.matchedProducts) &&
    catalogFollowUpDecision.matchedProducts.length > 1
  ) {
    const productNames = catalogFollowUpDecision.matchedProducts
      .slice(0, 3)
      .map((item) => item?.nome)
      .filter(Boolean)

    if (productNames.length) {
      return buildHeuristicReplyResult(`Encontrei mais de um item com esse perfil: ${productNames.join(", ")}. Me diga qual deles você quer seguir.`, {
        ...heuristicMetadata,
        heuristicStage: "catalog_reference_ambiguous",
        domainStage: "catalog",
      })
    }
  }

  if (catalogReferenceReply && catalogFollowUpDecision?.kind !== "catalog_search_refinement") {
    return buildHeuristicReplyResult(catalogReferenceReply, {
      ...heuristicMetadata,
      heuristicStage: "catalog_reference",
      domainStage: "catalog",
    })
  }

  if (catalogPricingReply && !shouldPreferMercadoLivreListing && !mercadoLivreReply) {
    return buildHeuristicReplyResult(catalogPricingReply.reply, {
      ...heuristicMetadata,
      heuristicStage: "billing_runtime",
      domainStage: "billing",
      provider: "billing_runtime",
      model: "structured_pricing_catalog",
      focus: billingContextUpdate?.planFocus
        ? {
            domain: "billing",
            source: "billing_runtime",
            subject: billingContextUpdate.planFocus.name,
            confidence: semanticBillingDecision?.confidence ?? 0.9,
          }
        : routingDecision.focus ?? null,
      billingContextUpdate,
    })
  }

  if (deterministicMercadoLivreFactualReply) {
    return {
      ...buildHeuristicReplyResult(deterministicMercadoLivreFactualReply, {
        ...heuristicMetadata,
        provider: "mercado_livre_runtime",
        model: "mercado_livre_connector",
        heuristicStage: "mercado_livre_product_fact",
        domainStage: "catalog",
        catalogoProdutoAtual: currentCatalogProduct ?? null,
        catalogoBusca: mercadoLivreCatalogSearchState,
        catalogFactContext: deterministicMercadoLivreFactualResolution?.factContext ?? null,
      }),
      assets: shouldAttachMercadoLivreAssetForMessage(latestUserMessage) ? mercadoLivreAssets : [],
      metadata: {
        ...heuristicMetadata,
        provider: "mercado_livre_runtime",
        model: "mercado_livre_connector",
        routeStage: "sales",
        heuristicStage: "mercado_livre_product_fact",
        domainStage: "catalog",
        catalogoProdutoAtual: currentCatalogProduct ?? null,
        catalogoBusca: mercadoLivreCatalogSearchState,
        catalogFactContext: deterministicMercadoLivreFactualResolution?.factContext ?? null,
      },
    }
  }

  if (deterministicMercadoLivreCommercialReply) {
    return buildHeuristicReplyResult(deterministicMercadoLivreCommercialReply, {
      ...heuristicMetadata,
      provider: "mercado_livre_runtime",
      model: "mercado_livre_connector",
      heuristicStage: "mercado_livre_product_commercial_advice",
      domainStage: "catalog",
      catalogoProdutoAtual: currentCatalogProduct ?? null,
      catalogoBusca: mercadoLivreCatalogSearchState,
    })
  }

  if (selectedMercadoLivreProductReply) {
    return {
      ...buildHeuristicReplyResult(selectedMercadoLivreProductReply, {
        ...heuristicMetadata,
        provider: "mercado_livre_runtime",
        model: "mercado_livre_connector",
        heuristicStage: "mercado_livre_product_fact",
        domainStage: "catalog",
        catalogoProdutoAtual: currentCatalogProduct ?? null,
        catalogoBusca: mercadoLivreCatalogSearchState,
      }),
      assets: selectedMercadoLivreProductShouldAttachAsset ? mercadoLivreAssets : [],
      metadata: {
        ...heuristicMetadata,
        provider: "mercado_livre_runtime",
        model: "mercado_livre_connector",
        routeStage: "sales",
        heuristicStage: "mercado_livre_product_fact",
        domainStage: "catalog",
        catalogoProdutoAtual: currentCatalogProduct ?? null,
        catalogoBusca: mercadoLivreCatalogSearchState,
      },
    }
  }

  if (
    mercadoLivreReply &&
    /\b(gostei|esse|essa|detalhe|detalhes|link|garantia|frete|estoque|serve|combina)\b/i.test(latestUserMessage)
  ) {
    return {
      ...buildHeuristicReplyResult(mercadoLivreReply, {
        ...heuristicMetadata,
        heuristicStage: "mercado_livre",
        domainStage: "catalog",
      }),
      assets: mercadoLivreAssets,
      metadata: {
        ...heuristicMetadata,
        provider: "local_heuristic",
        model: "heuristic",
        routeStage: "sales",
        heuristicStage: "mercado_livre",
        domainStage: "catalog",
        catalogoProdutoAtual: currentCatalogProduct ?? null,
        catalogoBusca: mercadoLivreCatalogSearchState,
      },
    }
  }

  if (mercadoLivreReply && mercadoLivreAssets.length > 0) {
    return {
      ...buildHeuristicReplyResult(mercadoLivreReply, {
        ...heuristicMetadata,
        heuristicStage: "mercado_livre_search",
        domainStage: "catalog",
      }),
      assets: mercadoLivreAssets,
      metadata: {
        ...heuristicMetadata,
        provider: "mercado_livre_runtime",
        model: "mercado_livre_connector",
        routeStage: "sales",
        heuristicStage: "mercado_livre_search",
        domainStage: "catalog",
        catalogoProdutoAtual: currentCatalogProduct ?? null,
        catalogoBusca: mercadoLivreCatalogSearchState,
      },
    }
  }

  if (mercadoLivreReply) {
    return buildHeuristicReplyResult(mercadoLivreReply, {
      ...heuristicMetadata,
      provider: "mercado_livre_runtime",
      model: "mercado_livre_connector",
      heuristicStage: "mercado_livre_reply",
      domainStage: "catalog",
      catalogoProdutoAtual: currentCatalogProduct ?? null,
      catalogoBusca: mercadoLivreCatalogSearchState,
    })
  }

  if (leadIdentificationReply && !isGreetingOrAckMessage(latestUserMessage)) {
    return buildHeuristicReplyResult(leadIdentificationReply, {
      ...heuristicMetadata,
      heuristicStage: "lead_capture",
      domainStage: pipelineState.conversationDomainStage,
    })
  }

  if (typeof options.generateSalesReply === "function") {
    return options.generateSalesReply(history, effectiveContext)
  }

  return generateOpenAiSalesReply({
    openAiKey,
    model,
    agentName,
    agentPromptBase,
    context: effectiveContext,
    structuredResponse,
    focusedApiContext,
    currentCatalogProduct: shouldUseMercadoLivre ? currentCatalogProduct : null,
    salesAssets: selectedMercadoLivreProductReply ? mercadoLivreAssets : [],
    history,
    simpleCommercialQuestion,
    metadata: {
      agenteId: context?.agente?.id ?? null,
      agenteNome: context?.agente?.nome ?? null,
      routeStage: "sales",
      heuristicStage: pipelineState.heuristicIntentStage ?? null,
      domainStage: pipelineState.conversationDomainStage ?? "general",
      catalogoProdutoAtual: (shouldUseMercadoLivre || shouldUseApiRuntime) ? currentCatalogProduct ?? null : null,
      catalogDiagnostics: heuristicMetadata.catalogDiagnostics ?? null,
      billingDiagnostics: heuristicMetadata.billingDiagnostics ?? null,
      billingContextUpdate: heuristicMetadata.billingContextUpdate ?? null,
      apiRuntimeDiagnostics: heuristicMetadata.apiRuntimeDiagnostics ?? null,
      apiRuntimeContextUpdate: heuristicMetadata.apiRuntimeContextUpdate ?? null,
      routingDecision,
      focus: routingDecision.focus ?? null,
    },
  })
}

export { enrichLeadContext }
