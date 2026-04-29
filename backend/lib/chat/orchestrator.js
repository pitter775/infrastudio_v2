import { buildApiCatalogSearchState, buildApiFallbackReply, buildFocusedApiContext, resolveApiCatalogReply } from "@/lib/chat/api-runtime"
import { hasRecentCatalogSnapshot } from "@/lib/chat/catalog-follow-up"
import { resolveCatalogDecisionState } from "@/lib/chat/catalog-intent-handler"
import { buildLeadNameAcknowledgementReply, enrichLeadContext, extractName, isLikelyLeadNameReply } from "@/lib/chat/lead-stage"
import { resolveChatDomainRoute } from "@/lib/chat/domain-router"
import {
  buildFocusedProductFactualReply,
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
  extractSemanticBusinessRuntimeFromAgentText,
  extractSemanticPricingCatalogFromAgentText,
} from "@/lib/chat/semantic-intent-stage"
import {
  buildPricingCatalogReplyFromIntent,
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
  return ["api_fact_query", "api_status_query"].includes(decision?.kind)
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
      routingDecision: metadata.routingDecision ?? null,
      focus: metadata.focus ?? null,
    },
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

  if (["handoff", "agenda", "catalog", "billing"].includes(baseDecision?.domain)) {
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
  const runtimeApis = Array.isArray(context?.runtimeApis) ? context.runtimeApis : []
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
  const semanticApiDecision = buildApiDecisionFromSemanticIntent({ semanticIntent: semanticApiIntent })
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
  const routingDecision = buildCatalogRoutingOverride(billingRoutingDecision, latestUserMessage, semanticCatalogDecision, context)
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
  const apiCatalogSearchState = shouldUseApiRuntime ? buildApiCatalogSearchState(runtimeApis) : null
  const apiCatalogProduct =
    (apiCatalogSearchState?.produtoAtual && typeof apiCatalogSearchState.produtoAtual === "object"
      ? apiCatalogSearchState.produtoAtual
      : null) ??
    (Array.isArray(apiCatalogSearchState?.ultimosProdutos) && apiCatalogSearchState.ultimosProdutos.length === 1
      ? apiCatalogSearchState.ultimosProdutos[0]
      : null)
  const apiCatalogReply =
    shouldUseApiRuntime
      ? resolveApiCatalogReply(latestUserMessage, context, runtimeApis, {
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
  const deterministicMercadoLivreFactualReply =
    shouldUseMercadoLivre && currentCatalogProduct ? buildFocusedProductFactualReply(currentCatalogProduct, latestUserMessage) : null
  const shouldPreferMercadoLivreListing =
    shouldUseMercadoLivre &&
    mercadoLivreAssets.length > 0 &&
    (mercadoLivreFlowState.productSearchRequested ||
      mercadoLivreFlowState.genericMercadoLivreListingRequested ||
      mercadoLivreFlowState.loadMoreCatalogRequested)
  const catalogPricingReply = runtimeConfig?.pricingCatalog?.enabled
    ? buildPricingCatalogReplyFromIntent(runtimeConfig, context, semanticBillingDecision, {
        prefersStructuredReply,
      })
    : null
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
  const heuristicMetadata = {
    agenteId: context?.agente?.id ?? null,
    agenteNome: context?.agente?.nome ?? null,
    routeStage: "sales",
    domainStage: pipelineState.conversationDomainStage,
    catalogoProdutoAtual: (shouldUseMercadoLivre || shouldUseApiRuntime) ? currentCatalogProduct ?? null : null,
    routingDecision,
    focus: routingDecision.focus ?? null,
    semanticIntent: semanticBillingIntent ?? semanticCatalogIntent ?? semanticApiIntent,
  }

  if (!context?.agente?.id || !agentName || !agentPromptBase) {
    throw new Error("Agente do chat sem configuracao valida de prompt.")
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
      })
    if (apiReply) {
      return buildHeuristicReplyResult(apiReply, {
        ...heuristicMetadata,
        heuristicStage: "api_runtime",
        domainStage: "api_runtime",
        provider: "api_runtime",
        catalogoProdutoAtual: apiCatalogProduct ?? currentCatalogProduct ?? null,
        catalogoBusca: apiCatalogSearchState,
      })
    }
  }

  if (apiCatalogReply) {
    return buildHeuristicReplyResult(apiCatalogReply, {
      ...heuristicMetadata,
      heuristicStage: "api_catalog_runtime",
      domainStage: "api_runtime",
      provider: "api_runtime",
      catalogoProdutoAtual: apiCatalogProduct ?? currentCatalogProduct ?? null,
      catalogoBusca: apiCatalogSearchState,
    })
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
      return buildHeuristicReplyResult(`Encontrei mais de um item com esse perfil: ${productNames.join(", ")}. Me diga qual deles voce quer seguir.`, {
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
    return buildHeuristicReplyResult(catalogPricingReply, {
      ...heuristicMetadata,
      heuristicStage: "pricing_catalog",
      domainStage: "catalog",
      provider: "local_heuristic",
      model: "heuristic",
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
      },
    }
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
      routingDecision,
      focus: routingDecision.focus ?? null,
    },
  })
}

export { enrichLeadContext }
