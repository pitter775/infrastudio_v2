import { normalizeText } from "@/lib/chat/text-utils"

export function extractPhone(message) {
  const digits = String(message || "").replace(/\D/g, "")
  return digits.length >= 10 ? digits : null
}

export function extractName(message) {
  const raw = String(message || "").trim()
  const explicit = raw.match(/\b(?:meu nome e|me chamo|sou)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})/i)
  if (explicit?.[1]) {
    return explicit[1].replace(/\d+/g, "").trim()
  }

  if (/^[A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,2}$/.test(raw)) {
    return raw.trim()
  }

  return null
}

export function enrichLeadContext(currentContext = {}, history = [], latestUserMessage = "") {
  const nome = extractName(latestUserMessage)
  const telefone = extractPhone(latestUserMessage)
  const lead = {
    ...(currentContext.lead ?? {}),
  }

  if (nome) lead.nome = nome
  if (telefone) lead.telefone = telefone
  lead.identificado = Boolean(lead.nome || lead.telefone)

  return {
    ...currentContext,
    lead,
  }
}

export function isLikelyLeadNameReply(message, history = [], deps = {}) {
  const normalized = normalizeText(message)
  if (!normalized || normalized.split(/\s+/).length > 3) {
    return false
  }

  const lastAssistant = [...(history ?? [])].reverse().find((item) => item.role === "assistant")
  const askedName = /chamar|nome|quem/.test(normalizeText(lastAssistant?.content ?? lastAssistant?.conteudo))
  const name = (deps.extractName ?? extractName)(message)
  return Boolean(askedName && name)
}

export function buildLeadNameAcknowledgementReply(name, canContinue = true) {
  return canContinue
    ? `Perfeito, ${name}. Vou seguir daqui.`
    : `Perfeito, ${name}.`
}

export function findRecentUserIntentBeforeLeadNameReply(history = []) {
  return [...history].reverse().find((item) => item.role === "user") ?? null
}
