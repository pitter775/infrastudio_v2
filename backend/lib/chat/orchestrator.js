import { buildApiFallbackReply, buildFocusedApiContext } from "@/lib/chat/api-runtime"
import {
  decideCatalogFollowUpHeuristically,
  hasRecentCatalogSnapshot,
  resolveCatalogReferenceHeuristicReply,
} from "@/lib/chat/catalog-follow-up"
import { buildLeadNameAcknowledgementReply, enrichLeadContext, extractName, isLikelyLeadNameReply } from "@/lib/chat/lead-stage"
import {
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicReply,
  resolveMercadoLivreHeuristicState,
} from "@/lib/chat/mercado-livre"
import {
  buildAgentAssetInstruction,
  buildAnalyticalReplyInstruction,
  buildChannelReplyInstruction,
  buildRuntimePrompt,
  buildStructuredReplyInstruction,
  buildSystemPrompt,
  prefersStructuredReply,
} from "@/lib/chat/prompt-builders"
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

function buildConversationMemory(context = {}) {
  const snippets = []
  const resumo = String(context?.memoria?.resumo || "").trim()
  const historicoIdentificado = String(context?.memoria?.historicoIdentificado || "").trim()
  const currentProduct = context?.catalogo?.produtoAtual?.nome
  const latestSearch = context?.catalogo?.ultimaBusca

  if (resumo) snippets.push(`Resumo de continuidade: ${resumo}`)
  if (historicoIdentificado) snippets.push(`Historico importado do usuario identificado:\n${historicoIdentificado}`)
  if (currentProduct) snippets.push(`Produto em foco: ${currentProduct}`)
  if (latestSearch) snippets.push(`Busca recente do cliente: ${latestSearch}`)

  return snippets.join("\n")
}

function buildFocusedApiInstructions(focusedApiContext) {
  if (!focusedApiContext?.fields?.length) {
    return ""
  }

  return [
    "Campos de API diretamente relacionados ao pedido atual:",
    ...focusedApiContext.fields.slice(0, 8).map((field) => `${field.apiNome} > ${field.nome}: ${field.valor}`),
  ].join("\n")
}

function buildSelectedProductInstructions(product) {
  if (!product?.nome) {
    return ""
  }

  return [
    `Produto atualmente em foco: ${product.nome}.`,
    product.descricao ? `Contexto do produto: ${product.descricao}` : "",
    product.preco != null ? `Preco conhecido: ${product.preco}.` : "",
    product.link ? `Link conhecido: ${product.link}` : "",
  ]
    .filter(Boolean)
    .join("\n")
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
  if (typeof options.generateSalesReply === "function") {
    return options.generateSalesReply(history, context)
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"
  const agentName = context?.agente?.nome?.trim() || ""
  const agentPromptBase = context?.agente?.promptBase?.trim() || context?.agente?.descricao?.trim() || ""
  const latestUserMessage = [...(history ?? [])].reverse().find((item) => item.role === "user")?.content ?? ""
  const runtimeApis = Array.isArray(context?.runtimeApis) ? context.runtimeApis : []
  const runtimeConfig = getAgentRuntimeConfig(context)
  const structuredResponse = prefersStructuredReply(context)
  const focusedApiContext = buildFocusedApiContext(latestUserMessage, runtimeApis)
  const hasFocusedApiContext = focusedApiContext.fields.length > 0
  const catalogFollowUpDecision =
    hasRecentCatalogSnapshot(context) || context?.catalogo?.produtoAtual
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
      shouldContinueProductSearch(history, message, context, {
        isGreetingOrAckMessage,
      }),
    buildProductSearchCandidates,
  })
  const mercadoLivreState = await resolveMercadoLivreHeuristicState({
    context,
    project: context?.projeto ?? null,
    latestUserMessage,
    productSearchRequested: mercadoLivreFlowState.productSearchRequested,
    genericMercadoLivreListingRequested: mercadoLivreFlowState.genericMercadoLivreListingRequested,
    loadMoreCatalogRequested: mercadoLivreFlowState.loadMoreCatalogRequested,
    productSearchTerm: mercadoLivreFlowState.productSearchTerm,
    lastSearchTerm: mercadoLivreFlowState.lastSearchTerm,
    paginationOffset: mercadoLivreFlowState.paginationOffset,
    paginationPoolLimit: mercadoLivreFlowState.paginationPoolLimit,
    currentCatalogProduct: mercadoLivreFlowState.currentCatalogProduct,
    referencedCatalogProducts: mercadoLivreFlowState.referencedCatalogProducts,
  })
  const mercadoLivreReply = resolveMercadoLivreHeuristicReply(mercadoLivreState)
  const mercadoLivreAssets = Array.isArray(mercadoLivreState?.mercadoLivreAssets) ? mercadoLivreState.mercadoLivreAssets : []
  const mercadoLivreCatalogSearchState =
    mercadoLivreState?.catalogSearchState && typeof mercadoLivreState.catalogSearchState === "object"
      ? mercadoLivreState.catalogSearchState
      : null
  const mercadoLivreSelectedProduct =
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
  const currentCatalogProduct = mercadoLivreSelectedProduct ?? context?.catalogo?.produtoAtual ?? null
  const catalogPricingReply = runtimeConfig?.pricingCatalog?.enabled
    ? buildCatalogPricingReply(history, context, {
        normalizeText,
        prefersStructuredReply,
        runtimeConfig,
      })
    : buildCatalogPricingReply(currentCatalogProduct)
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
    catalogoProdutoAtual: currentCatalogProduct ?? null,
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
    const apiReply = buildApiFallbackReply(latestUserMessage, runtimeApis)
    if (apiReply) {
      return buildHeuristicReplyResult(apiReply, {
        ...heuristicMetadata,
        heuristicStage: "api_runtime",
        domainStage: "api_runtime",
        provider: "api_runtime",
      })
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
      return buildHeuristicReplyResult(`Encontrei mais de um item com esse perfil: ${productNames.join(", ")}. Me diga qual deles voce quer seguir.`, {
        ...heuristicMetadata,
        heuristicStage: "catalog_reference_ambiguous",
        domainStage: "catalog",
      })
    }
  }

  if (catalogReferenceReply) {
    return buildHeuristicReplyResult(catalogReferenceReply, {
      ...heuristicMetadata,
      heuristicStage: "catalog_reference",
      domainStage: "catalog",
    })
  }

  if (mercadoLivreReply && /\b(gostei|esse|essa|detalhe|detalhes|link|garantia|frete|estoque|serve|combina)\b/i.test(latestUserMessage)) {
    return {
      ...buildHeuristicReplyResult(mercadoLivreReply, {
        ...heuristicMetadata,
        heuristicStage: "mercado_livre",
        domainStage: "catalog",
      }),
      assets: mercadoLivreAssets,
      metadata: {
        ...heuristicMetadata,
        provider: "mercado_livre_runtime",
        model: "mercado_livre_connector",
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

  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY nao configurada para executar o agente do chat.")
  }

  const systemPrompt = [
    buildSystemPrompt(
      {
        nome: agentName,
        promptBase: agentPromptBase,
      },
      context,
      structuredResponse
    ),
    buildRuntimePrompt(
      {
        nome: agentName,
        promptBase: agentPromptBase,
      },
      context,
      { structuredResponse }
    ),
    buildChannelReplyInstruction(context?.channel?.kind ?? context?.canal ?? "web"),
    buildAnalyticalReplyInstruction(),
    structuredResponse ? buildStructuredReplyInstruction() : "",
    buildAgentAssetInstruction(Array.isArray(context?.agente?.arquivos) ? context.agente.arquivos : []),
    buildConversationMemory(context),
    buildFocusedApiInstructions(focusedApiContext),
    buildSelectedProductInstructions(currentCatalogProduct),
  ]
    .filter(Boolean)
    .join("\n\n")

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
          content: systemPrompt,
        },
        ...(history ?? []).slice(simpleCommercialQuestion ? -6 : -10).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        })),
      ],
      max_output_tokens: simpleCommercialQuestion ? 260 : 420,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI retornou ${response.status}`)
  }

  const payload = await response.json()
  const reply =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? [])?.find((item) => item.type === "output_text")?.text ??
    ""

  if (!String(reply || "").trim()) {
    throw new Error("OpenAI nao retornou texto util para o agente do chat.")
  }

  return {
    reply,
    assets: [],
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
    },
    metadata: {
      provider: "openai",
      model,
      agenteId: context?.agente?.id ?? null,
      agenteNome: context?.agente?.nome ?? null,
      routeStage: "sales",
      heuristicStage: pipelineState.heuristicIntentStage ?? null,
      domainStage: pipelineState.conversationDomainStage ?? "general",
      catalogoProdutoAtual: currentCatalogProduct ?? null,
    },
  }
}

export { enrichLeadContext }
