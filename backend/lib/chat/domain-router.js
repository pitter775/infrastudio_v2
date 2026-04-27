import { normalizeText } from "@/lib/chat/text-utils"

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

function hasCatalogSignal(message) {
  const normalized = normalizeText(message)
  if (/\b(plano|planos|assinatura|mensalidade|basic|starter|plus|pro|free|credito|creditos)\b/.test(normalized)) {
    return false
  }

  return /\b(produto|produtos|item|itens|catalogo|loja|mercado livre|mlb\d+|tem|vende|estoque|modelo|opcoes|opcao|mostra|mostrar|mostre|manda|mande|envia|envie|traz|traga|procuro|quero ver|link|preciso|quero|busco|procurando|tiver|qualquer)\b/.test(
    normalized
  )
}

function hasCatalogFollowUpSignal(message) {
  return /\b(mais|outras|outros|opcoes|opcao|modelos|esse|essa|desse|dessa|link|detalhe|detalhes|gostei|quero|manda|mande|envia|envie|mostra|mostre|traz|traga|tiver|qualquer)\b/i.test(
    String(message || "")
  )
}

function hasBillingSignal(message) {
  return /\b(plano|planos|assinatura|mensalidade|basic|starter|plus|pro|free|credito|creditos|quanto custa|preco|valor)\b/i.test(
    String(message || "")
  )
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

  if (hasBillingSignal(message) && !hasCatalogSignal(message)) {
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

  if (capabilities.mercadoLivre && hasCatalogSignal(message)) {
    return {
      domain: "catalog",
      source: "mercado_livre",
      confidence: 0.86,
      reason: "catalog_signal",
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

  if (activeFocus?.domain === "catalog" && capabilities.mercadoLivre && hasCatalogFollowUpSignal(message)) {
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
