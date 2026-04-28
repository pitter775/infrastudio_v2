import { normalizeText } from "@/lib/chat/text-utils"
import { buildProductSearchCandidates, isGreetingOrAckMessage } from "@/lib/chat/sales-heuristics"

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function getActiveFocus(context = {}, now = new Date()) {
  const focus = context?.focus && typeof context.focus === "object" && !Array.isArray(context.focus) ? context.focus : null
  if (!focus?.domain) {
    return null
  }

  const expiresAt = sanitizeString(focus.expiresAt)
  if (expiresAt) {
    const expiresMs = new Date(expiresAt).getTime()
    if (Number.isFinite(expiresMs) && expiresMs < now.getTime()) {
      return null
    }
  }

  return focus
}

function buildExpiresAt(minutes = 12) {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

function getConversationMode(context = {}) {
  const mode = String(context?.conversation?.mode || context?.ui?.mode || "").trim().toLowerCase()
  return mode || null
}

function getCatalogFocusMode(context = {}) {
  const mode = String(context?.catalogo?.focusMode || "").trim().toLowerCase()
  return mode || null
}

function extractPricingPlanTokens(runtimeConfig = {}) {
  const items = Array.isArray(runtimeConfig?.pricingCatalog?.items) ? runtimeConfig.pricingCatalog.items : []
  return [...new Set(
    items
      .flatMap((item) => [item?.slug, item?.name])
      .map((item) => normalizeText(item))
      .filter(Boolean)
  )]
}

function hasApiRuntimeSignal(message, focusedApiContext) {
  const normalized = normalizeText(message)
  if (!focusedApiContext?.fields?.length) {
    return false
  }

  if (/\b(status|pedido|codigo|protocolo|rastreio|rastreamento|consulta|consultar|data|previsao|prazo|estoque|disponibilidade)\b/.test(normalized)) {
    return true
  }

  if (/\b(mais caro|mais barato|vale mais a pena|melhor opcao|qual melhor|qual e melhor|primeiro|segundo|terceiro)\b/.test(normalized)) {
    return true
  }

  return /\b\d{3,}\b/.test(normalized)
}

function hasExplicitCatalogObjectSignal(message) {
  const normalized = normalizeText(message)

  return /\b(produto|produtos|item|itens|catalogo|loja|mercado livre|mlb\d+|estoque|modelo|link)\b/.test(normalized)
}

function hasCatalogSignal(message, context = {}) {
  const normalized = normalizeText(message)
  if (/\b(plano|planos|assinatura|mensalidade|basic|starter|plus|pro|free|credito|creditos)\b/.test(normalized)) {
    return false
  }

  if (hasExplicitCatalogObjectSignal(normalized)) {
    return hasStorefrontCatalogContext(context) || hasRecentCatalogContext(context) || hasMeaningfulCatalogSearchCandidate(normalized)
  }

  if (/\b(tem|vende|mostra|mostrar|mostre|manda|mande|envia|envie|traz|traga|procuro|quero ver|preciso|quero|busco|procurando)\b/.test(normalized)) {
    return hasMeaningfulCatalogSearchCandidate(normalized)
  }

  return false
}

function hasMeaningfulCatalogSearchCandidate(message) {
  const ignored = new Set([
    "tem",
    "vende",
    "mostra",
    "mostrar",
    "mostre",
    "manda",
    "mande",
    "envia",
    "envie",
    "traz",
    "traga",
    "procuro",
    "quero",
    "ver",
    "quero ver",
    "preciso",
    "busco",
    "procurando",
    "mais",
    "opcao",
    "opcoes",
    "modelo",
    "modelos",
  ])

  return buildProductSearchCandidates(message).some((candidate) => {
    const normalizedCandidate = normalizeText(candidate)
    return normalizedCandidate && !ignored.has(normalizedCandidate)
  })
}

function hasStorefrontCatalogContext(context) {
  return (
    getConversationMode(context) === "listing" ||
    context?.ui?.catalogPreferred === true ||
    context?.storefront?.kind === "mercado_livre" ||
    context?.storefront?.pageKind === "storefront" ||
    context?.storefront?.pageKind === "product_detail"
  )
}

function hasProductDetailCatalogContext(context) {
  return Boolean(
    (getCatalogFocusMode(context) === "product_focus" ||
      getConversationMode(context) === "product_focus" ||
      getConversationMode(context) === "product_detail" ||
      context?.ui?.productDetailPreferred === true ||
      context?.storefront?.pageKind === "product_detail") &&
      context?.catalogo?.produtoAtual?.nome
  )
}

function hasShortCatalogQuerySignal(message) {
  const rawMessage = String(message || "").trim()
  const normalized = normalizeText(rawMessage)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized || isGreetingOrAckMessage(rawMessage)) {
    return false
  }

  if (hasBillingSignal(normalized) || hasAgendaSignal(normalized) || hasHandoffSignal(normalized)) {
    return false
  }

  const tokens = normalized.split(" ").filter(Boolean)
  if (!tokens.length || tokens.length > 3) {
    return false
  }

  if (tokens.some((token) => /^\d+$/.test(token))) {
    return false
  }

  return buildProductSearchCandidates(normalized).length > 0
}

function hasCatalogFollowUpSignal(message) {
  return /\b(mais|outras|outros|opcoes|opcao|modelos|esse|essa|desse|dessa|aquele|aquela|daquele|daquela|link|detalhe|detalhes|gostei|quero|manda|mande|envia|envie|mostra|mostre|traz|traga|tiver|qualquer)\b/i.test(
    String(message || "")
  )
}

function hasRecentCatalogContext(context = {}) {
  return (
    Boolean(context?.catalogo?.produtoAtual?.nome) ||
    (Array.isArray(context?.catalogo?.ultimosProdutos) && context.catalogo.ultimosProdutos.length > 0)
  )
}

function hasBillingSignal(message) {
  return /\b(plano|planos|assinatura|mensalidade|credito|creditos)\b/i.test(String(message || ""))
}

function hasExplicitPricingCatalogSignal(message, runtimeConfig = {}) {
  const normalized = normalizeText(message)
  const planTokens = extractPricingPlanTokens(runtimeConfig)

  if (/\b(plano|planos|assinatura|mensalidade|credito|creditos)\b/.test(normalized)) {
    return true
  }

  return planTokens.some((token) => token && normalized.includes(token))
}

function hasRecentCatalogPrompt(history = []) {
  return [...(history ?? [])]
    .reverse()
    .slice(0, 4)
    .some((item) => {
      if (item?.role !== "assistant") {
        return false
      }

      const normalized = normalizeText(item.content ?? item.conteudo ?? "")
      return /\b(produto|produtos|item|itens|loja|catalogo|catalogo|reliquia|reliquias|procurando|procura|buscando|busca|quer ver|mostrar)\b/.test(
        normalized
      )
    })
}

function isLikelyCatalogAnswerAfterPrompt(message, history = []) {
  const normalized = normalizeText(message).trim()
  if (!normalized || normalized.length < 3) {
    return false
  }

  if (hasBillingSignal(normalized) || hasAgendaSignal(normalized) || hasHandoffSignal(normalized)) {
    return false
  }

  if (/^(oi|ola|ok|obrigado|obrigada|sim|nao|bom dia|boa tarde|boa noite|entendi|certo|beleza|perfeito|show)$/.test(normalized)) {
    return false
  }

  return hasRecentCatalogPrompt(history) && (hasCatalogFollowUpSignal(normalized) || hasShortCatalogQuerySignal(normalized))
}

function isCatalogFollowUpWithRecentState(message, history = [], context = {}) {
  if (!hasRecentCatalogContext(context)) {
    return false
  }

  return isLikelyCatalogAnswerAfterPrompt(message, history)
}

function hasAgendaSignal(message) {
  return /\b(agenda|agendar|marcar|horario|reserva|reservar|reuniao|visita|disponibilidade)\b/i.test(String(message || ""))
}

function hasHandoffSignal(message) {
  return /\b(humano|atendente|pessoa|suporte|falar com alguem|me liga|telefone|whatsapp)\b/i.test(String(message || ""))
}

export function resolveChatDomainRoute(input = {}) {
  const message = sanitizeString(input.latestUserMessage)
  const context = input.context && typeof input.context === "object" ? input.context : {}
  const runtimeApis = Array.isArray(input.runtimeApis) ? input.runtimeApis : []
  const focusedApiContext = input.focusedApiContext ?? null
  const runtimeConfig = input.runtimeConfig && typeof input.runtimeConfig === "object" ? input.runtimeConfig : {}
  const projectConnections = input.project?.directConnections ?? context?.projeto?.directConnections ?? {}
  const capabilities = {
    mercadoLivre: Number(projectConnections?.mercadoLivre ?? 0) > 0,
    apis: runtimeApis.length > 0,
    whatsapp: Number(projectConnections?.whatsapp ?? 0) > 0,
    chatWidget: Number(projectConnections?.chatWidget ?? 0) > 0,
    agenda: Array.isArray(context?.agenda?.horariosDisponiveis) && context.agenda.horariosDisponiveis.length > 0,
    billing: true,
  }
  const activeFocus = getActiveFocus(context)

  if (hasHandoffSignal(message)) {
    return {
      domain: "handoff",
      source: capabilities.whatsapp ? "whatsapp" : "agent",
      confidence: 0.92,
      reason: "handoff_explicit",
      shouldUseTool: capabilities.whatsapp,
      capabilities,
      focus: {
        domain: "handoff",
        source: capabilities.whatsapp ? "whatsapp" : "agent",
        subject: "human_support",
        confidence: 0.92,
        expiresAt: buildExpiresAt(8),
      },
    }
  }

  if (hasAgendaSignal(message)) {
    return {
      domain: "agenda",
      source: capabilities.agenda ? "agenda" : "agent",
      confidence: 0.88,
      reason: "agenda_intent",
      shouldUseTool: capabilities.agenda,
      capabilities,
      focus: {
        domain: "agenda",
        source: "agenda",
        subject: message,
        confidence: 0.88,
        expiresAt: buildExpiresAt(15),
      },
    }
  }

  if (hasExplicitPricingCatalogSignal(message, runtimeConfig) && !hasCatalogSignal(message, context) && !hasProductDetailCatalogContext(context)) {
    return {
      domain: "billing",
      source: "agent",
      confidence: 0.9,
      reason: "billing_pricing_intent",
      shouldUseTool: false,
      capabilities,
      focus: {
        domain: "billing",
        source: "agent",
        subject: message,
        confidence: 0.9,
        expiresAt: buildExpiresAt(8),
      },
    }
  }

  if (capabilities.apis && hasApiRuntimeSignal(message, focusedApiContext)) {
    return {
      domain: "api_runtime",
      source: "api",
      confidence: 0.86,
      reason: "api_runtime_signal",
      shouldUseTool: true,
      capabilities,
      focus: {
        domain: "api_runtime",
        source: "api",
        subject: message,
        confidence: 0.86,
        expiresAt: buildExpiresAt(12),
      },
    }
  }

  if (capabilities.mercadoLivre && hasProductDetailCatalogContext(context)) {
    return {
      domain: "catalog",
      source: "mercado_livre",
      confidence: 0.94,
      reason: "catalog_product_detail_focus",
      shouldUseTool: true,
      capabilities,
      focus: {
        domain: "catalog",
        source: "mercado_livre",
        subject: context?.catalogo?.produtoAtual?.nome || message,
        confidence: 0.94,
        expiresAt: buildExpiresAt(15),
      },
    }
  }

  const storefrontCatalogSignal =
    capabilities.mercadoLivre && hasStorefrontCatalogContext(context) && hasShortCatalogQuerySignal(message)

  if (
    capabilities.mercadoLivre &&
    (hasCatalogSignal(message, context) || isCatalogFollowUpWithRecentState(message, input.history, context) || storefrontCatalogSignal)
  ) {
    return {
      domain: "catalog",
      source: "mercado_livre",
      confidence: storefrontCatalogSignal ? 0.9 : 0.86,
      reason: storefrontCatalogSignal ? "catalog_storefront_short_query" : "catalog_signal",
      shouldUseTool: true,
      capabilities,
      focus: {
        domain: "catalog",
        source: "mercado_livre",
        subject: message,
        confidence: 0.86,
        expiresAt: buildExpiresAt(12),
      },
    }
  }

  if (
    activeFocus?.domain === "catalog" &&
    capabilities.mercadoLivre &&
    (hasCatalogFollowUpSignal(message) || hasShortCatalogQuerySignal(message))
  ) {
    return {
      domain: "catalog",
      source: "mercado_livre",
      confidence: 0.78,
      reason: "catalog_focus_continuation",
      shouldUseTool: true,
      capabilities,
      focus: {
        ...activeFocus,
        expiresAt: buildExpiresAt(12),
      },
    }
  }

  if (activeFocus?.domain === "api_runtime" && capabilities.apis && hasApiRuntimeSignal(message, focusedApiContext)) {
    return {
      domain: "api_runtime",
      source: "api",
      confidence: 0.76,
      reason: "api_focus_continuation",
      shouldUseTool: true,
      capabilities,
      focus: {
        ...activeFocus,
        expiresAt: buildExpiresAt(12),
      },
    }
  }

  return {
    domain: "general",
    source: "agent",
    confidence: 0.55,
    reason: capabilities.mercadoLivre || capabilities.apis ? "no_tool_intent" : "no_connected_tool",
    shouldUseTool: false,
    capabilities,
    focus: null,
  }
}
