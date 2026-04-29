import {
  buildAgendaActionPayload,
  hasConfirmedAgendaReservation,
} from "@/lib/chat/agenda-skill"
import { getConfiguredWhatsAppDestination } from "@/lib/chat/whatsapp-availability"

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "")
}

export function normalizeWhatsAppDestination(value) {
  const digits = sanitizePhone(value)
  if (!digits) {
    return null
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return digits
  }

  if (digits.length === 11) {
    return `55${digits}`
  }

  return digits.length >= 10 ? digits : null
}

export function hasConfiguredWhatsAppDestination(nextContext) {
  return Boolean(normalizeWhatsAppDestination(getConfiguredWhatsAppDestination(nextContext)))
}

export function hasWhatsAppIntentSignal(text) {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return (
    /\bwhatsapp\b/.test(normalized) ||
    /wa\.me|api\.whatsapp\.com/i.test(normalized) ||
    /\bmeu numero\b|\bmeu telefone\b|\bchama\b|\bfalar por la\b|\bcontinuar por la\b|\bcontinuar no whatsapp\b|\bir pro whatsapp\b|\bquero ir ao whatsapp\b/i.test(normalized) ||
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(String(text || ""))
  )
}

function summarizeTextForWhatsApp(value, maxLength = 180) {
  const sanitized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()

  if (!sanitized) {
    return ""
  }

  if (sanitized.length <= maxLength) {
    return sanitized
  }

  return `${sanitized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function buildWhatsAppPrefilledMessage(input = {}) {
  const userSummary = summarizeTextForWhatsApp(input.userMessage, 180)
  const assistantSummary = summarizeTextForWhatsApp(
    sanitizeReplyForWhatsAppCta(`${input.reply || ""}\n${input.followUpReply || ""}`, "Continuar no WhatsApp"),
    220
  )

  const lines = ["Oi! Vim do chat do site e quero continuar por aqui."]

  if (userSummary || assistantSummary) {
    lines.push("", "Resumo rapido:")
  }

  if (userSummary) {
    lines.push(`- Meu interesse: ${userSummary}`)
  }

  if (assistantSummary) {
    lines.push(`- Contexto do atendimento: ${assistantSummary}`)
  }

  return lines.join("\n").trim()
}

function buildWhatsAppActionPayload(input = {}) {
  const destination = normalizeWhatsAppDestination(getConfiguredWhatsAppDestination(input.nextContext))
  if (!destination) {
    return null
  }

  const prefilledMessage = buildWhatsAppPrefilledMessage(input)

  return {
    type: "whatsapp_link",
    label: "Continuar no WhatsApp",
    icon: "whatsapp",
    url: `https://wa.me/${destination}${prefilledMessage ? `?text=${encodeURIComponent(prefilledMessage)}` : ""}`,
    summary: "Leva um resumo rapido desta conversa.",
  }
}

export function buildWhatsAppContinuationCta(input = {}) {
  if (input.channelKind === "whatsapp" || input.nextContext?.whatsapp?.ctaEnabled !== true) {
    return null
  }

  const action = buildWhatsAppActionPayload(input)
  if (!action?.url) {
    return null
  }

  return {
    label: "Continuar no WhatsApp",
    url: action.url,
    summary: action.summary,
  }
}

function isCatalogConversationContext(nextContext = {}) {
  const mode = String(nextContext?.conversation?.mode || nextContext?.ui?.mode || "").trim().toLowerCase()
  const focusMode = String(nextContext?.catalogo?.focusMode || "").trim().toLowerCase()
  if (mode === "listing" || mode === "product_detail" || mode === "product_focus" || mode === "comparison") {
    return true
  }

  if (focusMode === "listing" || focusMode === "product_focus" || focusMode === "comparison") {
    return true
  }

  if (nextContext?.storefront?.kind === "mercado_livre") {
    return true
  }

  if (nextContext?.ui?.catalogPreferred === true || nextContext?.ui?.productDetailPreferred === true) {
    return true
  }

  if (nextContext?.focus?.domain === "catalog") {
    return true
  }

  if (nextContext?.catalogo?.produtoAtual?.nome) {
    return true
  }

  return Array.isArray(nextContext?.catalogo?.ultimosProdutos) && nextContext.catalogo.ultimosProdutos.length > 0
}

function isCatalogActionAsset(asset) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    return false
  }

  if (asset.kind === "product" && (asset.provider === "mercado_livre" || asset.provider === "api_runtime")) {
    return true
  }

  return Boolean(
    (typeof asset.id === "string" && (/^MLB/i.test(asset.id) || asset.id.startsWith("mercado-livre-"))) ||
      typeof asset.targetUrl === "string"
  )
}

function buildCatalogLoadMoreAction(input = {}) {
  const assets = Array.isArray(input.assets) ? input.assets : []
  if (!assets.some(isCatalogActionAsset) || !isCatalogConversationContext(input.nextContext)) {
    return null
  }

  return {
    type: "message",
    label: "Ver mais opcoes",
    icon: "sparkles",
    message: "Ver mais opcoes",
    userBubbleText: "Ver mais opcoes",
    skipUserBubble: true,
    source: "widget_catalog_load_more",
    extraContext: {
      ui: {
        catalogAction: "load_more",
      },
    },
  }
}

export function buildChatWidgetActions(input = {}) {
  if (input.channelKind === "whatsapp") {
    return []
  }

  const actions = []
  const catalogLoadMoreAction = buildCatalogLoadMoreAction(input)
  const whatsappAction = buildWhatsAppActionPayload(input)
  const agendaAction =
    hasConfirmedAgendaReservation(input.nextContext) || isCatalogConversationContext(input.nextContext)
      ? null
      : buildAgendaActionPayload(input.agendaSlots)

  if (catalogLoadMoreAction) {
    actions.push(catalogLoadMoreAction)
  }

  if (whatsappAction) {
    actions.push(whatsappAction)
  }

  if (agendaAction) {
    actions.push(agendaAction)
  }

  return actions
}

export function buildActionSuggestionReply(actions, baseText = "", options = {}) {
  if (!Array.isArray(actions) || !actions.length) {
    return String(baseText || "").trim()
  }

  const hasWhatsApp = actions.some((action) => action?.type === "whatsapp_link")
  const hasAgenda = actions.some((action) => action?.type === "agenda_schedule")
  const forceWhatsAppSuggestion = options.forceWhatsAppSuggestion === true
  let suggestion = ""

  if (hasWhatsApp && hasAgenda) {
    suggestion = "Se preferir, voce pode marcar um horario para contato."
  } else if (hasWhatsApp && forceWhatsAppSuggestion) {
    suggestion = ""
  } else if (hasAgenda) {
    suggestion = "Se preferir, voce pode marcar um horario para contato."
  }

  if (!suggestion) {
    return String(baseText || "").trim()
  }

  const normalizedBase = String(baseText || "").trim()
  if (!normalizedBase) {
    return suggestion
  }

  if (normalizedBase.toLowerCase().includes(suggestion.toLowerCase())) {
    return normalizedBase
  }

  return `${normalizedBase}\n\n${suggestion}`.trim()
}

export function sanitizeReplyForWhatsAppCta(reply, label = "Continuar no WhatsApp") {
  const sanitized = String(reply || "")
    .replace(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^\s)]+/gi, "")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
    .replace(/(?:meu|nosso)\s+(?:numero|telefone)\s+(?:e|\u00e9)\s*[:\-]?\s*/gi, "")
    .replace(/(?:me chama|pode me chamar|pode falar comigo)\s+no\s+whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/(?:se quiser|se preferir),?\s*(?:clique|clica|toque|toca)\s+em\s+["']?continuar no whatsapp["']?[^.!?\n]*[.!?]?/gi, "")
    .replace(/(?:se quiser|se preferir),?\s*(?:podemos|pode|voce pode)?\s*(?:continuar|seguir|falar|chamar)[^.!?\n]*whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/(?:se quiser|se preferir)\s+mais\s+detalhes[^.!?\n]*whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(new RegExp(`(?:se quiser|se preferir),?\\s*clique em ["']?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?[^.!?\\n]*[.!?]?`, "gi"), "")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!sanitized) {
    return ""
  }

  return sanitized
}

export function sanitizeReplyWithoutWhatsAppCta(reply) {
  const sanitized = String(reply || "")
    .replace(/infelizmente,[^.!?\n]*whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/nao posso[^.!?\n]*whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/nao consigo[^.!?\n]*whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/mas posso continuar te ajudando por aqui[^.!?\n]*[.!?]?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return sanitized || "Posso continuar te ajudando por aqui."
}
