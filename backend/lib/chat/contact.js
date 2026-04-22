function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "")
}

export function getIdentifiedContactKey(context, fallbackExternalIdentifier) {
  const lead = isPlainObject(context?.lead) ? context.lead : null
  const email = typeof lead?.email === "string" ? lead.email.trim().toLowerCase() : ""
  const phone = sanitizePhone(lead?.telefone || lead?.phone || "")

  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return email
  }

  if (phone.length >= 10) {
    return phone
  }

  const fallback = String(fallbackExternalIdentifier || "").trim()
  return fallback.includes("@") || sanitizePhone(fallback).length >= 10 ? fallback : null
}

export function buildImportedHistorySummary(messages) {
  const normalized = Array.isArray(messages) ? messages.filter((message) => message?.conteudo) : []
  if (!normalized.length) {
    return null
  }

  return normalized
    .slice(-10)
    .map((message) => `${message.role === "assistant" ? "Assistente" : "Cliente"}: ${String(message.conteudo).slice(0, 220)}`)
    .join("\n")
}

export function normalizeInboundPhoneCandidate(value) {
  const raw = String(value || "").trim()
  if (!raw || raw.includes("@")) {
    return null
  }

  const digits = raw.replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 13) {
    return null
  }

  return digits
}

export function getWhatsAppContactNameFromContext(context) {
  if (!isPlainObject(context?.whatsapp)) {
    return null
  }

  const value = context.whatsapp.contactName
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function getWhatsAppContactPhoneFromContext(context) {
  if (!isPlainObject(context?.lead) && !isPlainObject(context?.whatsapp)) {
    return null
  }

  const leadPhone = isPlainObject(context?.lead) ? context.lead.telefone : null
  const normalizedLeadPhone = normalizeInboundPhoneCandidate(typeof leadPhone === "string" ? leadPhone : null)
  if (normalizedLeadPhone) {
    return normalizedLeadPhone
  }

  if (!isPlainObject(context?.whatsapp)) {
    return null
  }

  const remotePhone = context.whatsapp.remotePhone
  const normalizedRemotePhone = normalizeInboundPhoneCandidate(typeof remotePhone === "string" ? remotePhone : null)
  if (normalizedRemotePhone) {
    return normalizedRemotePhone
  }

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null
  const rawContactNumber = rawContact?.number
  const normalizedRawContactNumber = normalizeInboundPhoneCandidate(
    typeof rawContactNumber === "string" ? rawContactNumber : null
  )
  if (normalizedRawContactNumber) {
    return normalizedRawContactNumber
  }

  const senderPhone = context.whatsapp.remetente
  return normalizeInboundPhoneCandidate(typeof senderPhone === "string" ? senderPhone : null)
}

export function getWhatsAppContactAvatarFromContext(context) {
  if (!isPlainObject(context?.whatsapp)) {
    return null
  }

  const value = context.whatsapp.profilePicUrl
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null
  const fallbackValue = rawContact?.profilePicUrl
  return typeof fallbackValue === "string" && fallbackValue.trim() ? fallbackValue.trim() : null
}

export function resolveChatContactSnapshot(context, fallbackExternalIdentifier) {
  return {
    contatoNome: getWhatsAppContactNameFromContext(context),
    contatoTelefone: getWhatsAppContactPhoneFromContext(context) ?? normalizeInboundPhoneCandidate(fallbackExternalIdentifier),
    contatoAvatarUrl: getWhatsAppContactAvatarFromContext(context),
  }
}

export function resolveCanonicalWhatsAppExternalIdentifier(input) {
  const contextPhone = getWhatsAppContactPhoneFromContext(input.context)
  if (contextPhone) {
    return contextPhone
  }

  const normalizedExternal = normalizeInboundPhoneCandidate(input.identificadorExterno)
  if (normalizedExternal) {
    return normalizedExternal
  }

  const normalizedFallback = normalizeInboundPhoneCandidate(input.identificador)
  if (normalizedFallback) {
    return normalizedFallback
  }

  return sanitizePhone(input.identificadorExterno ?? input.identificador)
}
