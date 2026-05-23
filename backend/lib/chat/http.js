export function buildChatCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  }
}

export function jsonChatResponse(payload, init = {}) {
  const { origin = null, headers = {}, ...responseInit } = init

  return Response.json(payload, {
    ...responseInit,
    headers: {
      ...buildChatCorsHeaders(origin),
      ...headers,
    },
  })
}

export function emptyChatOptionsResponse(origin) {
  return new Response(null, {
    status: 204,
    headers: buildChatCorsHeaders(origin),
  })
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function mergeInboundWhatsAppContext(body) {
  const baseContext = isPlainObject(body.context) ? body.context : {}
  const baseWhatsApp = isPlainObject(baseContext.whatsapp) ? baseContext.whatsapp : {}
  const topLevelWhatsApp = isPlainObject(body.whatsapp) ? body.whatsapp : {}
  const rawContact = isPlainObject(topLevelWhatsApp.rawContact)
    ? topLevelWhatsApp.rawContact
    : isPlainObject(body.rawContact)
      ? body.rawContact
      : null
  const rawMessage = isPlainObject(topLevelWhatsApp.rawMessage)
    ? topLevelWhatsApp.rawMessage
    : isPlainObject(body.rawMessage)
      ? body.rawMessage
      : null
  const topLevelCandidates = {
    contactName: body.contactName,
    pushName: body.pushName ?? body.pushname,
    shortName: body.shortName,
    displayName: body.displayName,
    name: body.name,
    notifyName: body.notifyName,
    senderName: body.senderName,
    chatName: body.chatName,
    formattedName: body.formattedName,
    verifiedName: body.verifiedName,
    remotePhone: body.remotePhone ?? body.phone ?? body.from,
    remoteJid: body.remoteJid ?? body.from,
    profilePicUrl: body.profilePicUrl,
  }
  const whatsapp = {
    ...topLevelCandidates,
    ...topLevelWhatsApp,
    ...baseWhatsApp,
    ...(rawContact ? { rawContact: { ...rawContact, ...(isPlainObject(baseWhatsApp.rawContact) ? baseWhatsApp.rawContact : {}) } } : {}),
    ...(rawMessage ? { rawMessage: { ...rawMessage, ...(isPlainObject(baseWhatsApp.rawMessage) ? baseWhatsApp.rawMessage : {}) } } : {}),
  }

  return {
    ...baseContext,
    whatsapp,
  }
}

export function normalizePublicChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {}
  }

  const message = String(body.message ?? body.mensagem ?? body.texto ?? "").trim()
  const conversationId = String(body.conversationId ?? "").trim()
  const chatId = String(body.chatId ?? "").trim()
  const canal = body.canal ?? body.context?.channel?.kind ?? (body.widgetId || body.widgetSlug ? "external_widget" : "web")
  const context = canal === "whatsapp" ? mergeInboundWhatsAppContext(body) : body.context

  return {
    ...body,
    message,
    chatId: chatId || undefined,
    canal,
    context,
    identificadorExterno:
      typeof body.identificadorExterno === "string" && body.identificadorExterno.trim()
        ? body.identificadorExterno.trim()
        : conversationId || undefined,
    source: body.source ?? (body.widgetId || body.widgetSlug || body.projeto || body.agente ? "site_widget" : "admin_attendance_v2"),
  }
}

export function formatPublicChatResult(result) {
  return {
    chatId: result?.chatId ?? "",
    messageId: result?.messageId ?? null,
    createdAt: result?.createdAt ?? null,
    reply: result?.reply ?? "",
    followUpReply: result?.followUpReply ?? "",
    messageSequence: Array.isArray(result?.messageSequence) ? result.messageSequence : [],
    assets: Array.isArray(result?.assets) ? result.assets : [],
    whatsapp: result?.whatsapp ?? null,
    actions: Array.isArray(result?.actions) ? result.actions : [],
    ui: result?.ui && typeof result.ui === "object" && !Array.isArray(result.ui) ? result.ui : null,
    handoff: result?.handoff ?? null,
    debugUsage:
      result?.debugUsage && typeof result.debugUsage === "object" && !Array.isArray(result.debugUsage)
        ? result.debugUsage
        : null,
  }
}
