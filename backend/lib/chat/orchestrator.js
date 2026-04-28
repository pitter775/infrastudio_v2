import { buildApiCatalogSearchState, buildApiFallbackReply, buildFocusedApiContext, resolveApiCatalogReply } from "@/lib/chat/api-runtime"
import {
  decideCatalogFollowUpHeuristically,
  hasRecentCatalogSnapshot,
  resolveCatalogReferenceHeuristicReply,
} from "@/lib/chat/catalog-follow-up"
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
  buildCatalogPricingReply,
  buildProductSearchCandidates,
  isGreetingOrAckMessage,
  isOutOfScopeForCatalog,
  maybeAskForLeadIdentification,
  shouldContinueProductSearch,
  shouldSearchProducts,
} from "@/lib/chat/sales-heuristics"
import { normalizeText } from "@/lib/chat/text-utils"

export const USE_ORCHESTRATOR = true

function mapMessageRole(autor) {
  return autor === "atendente" ? "assistant" : "user"
}

function hasFactualApiSignal(message) {
  return /\b(status|pedido|data|previsao|prazo|valor|estoque|codigo)\b/i.test(String(message || ""))
}

function getAgentRuntimeConfig(context = {}) {
  const runtimeConfig = context?.agente?.runtimeConfig ?? context?.agente?.configuracoes?.runtimeConfig ?? null
  return runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig) ? runtimeConfig : null
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
    },
  }
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
  const agentPromptBase = context?.agente?.promptBase?.trim() || context?.agente?.descricao?.trim() || ""
  const latestUserMessage = [...(history ?? [])].reverse().find((item) => item.role === "user")?.content ?? ""
  const runtimeApis = Array.isArray(context?.runtimeApis) ? context.runtimeApis : []
  const runtimeConfig = getAgentRuntimeConfig(context)
  const structuredResponse = prefersStructuredReply(context)
  const focusedApiContext = buildFocusedApiContext(latestUserMessage, runtimeApis)
  const routingDecision = resolveChatDomainRoute({
    latestUserMessage,
    history,
    context,
    project: context?.projeto ?? null,
    runtimeApis,
    focusedApiContext,
    runtimeConfig,
  })
  const shouldUseApiRuntime = routingDecision.domain === "api_runtime" && routingDecision.shouldUseTool === true
  const shouldUseMercadoLivre = routingDecision.domain === "catalog" && routingDecision.source === "mercado_livre" && routingDecision.shouldUseTool === true
  const hasFocusedApiContext = shouldUseApiRuntime && focusedApiContext.fields.length > 0
  const catalogFollowUpDecision =
    (shouldUseMercadoLivre || hasRecentCatalogSnapshot(context) || context?.catalogo?.produtoAtual) &&
    (hasRecentCatalogSnapshot(context) || context?.catalogo?.produtoAtual)
      ? decideCatalogFollowUpHeuristically(latestUserMessage, context, {
          buildProductSearchCandidates,
          shouldSearchProducts,
        })
      : null
  const catalogReferenceReply = resolveCatalogReferenceHeuristicReply(catalogFollowUpDecision)
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
  const apiCatalogReply = shouldUseApiRuntime ? resolveApiCatalogReply(latestUserMessage, context, runtimeApis) : null
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
    ? buildCatalogPricingReply(history, context, {
        normalizeText,
        prefersStructuredReply,
        runtimeConfig,
      })
    : buildCatalogPricingReply(shouldUseMercadoLivre ? currentCatalogProduct : null)
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

  if (hasFocusedApiContext && hasFactualApiSignal(latestUserMessage)) {
    const apiReply = apiCatalogReply ?? buildApiFallbackReply(latestUserMessage, runtimeApis)
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
    return options.generateSalesReply(history, context)
  }

  return generateOpenAiSalesReply({
    openAiKey,
    model,
    agentName,
    agentPromptBase,
    context,
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
