function nowIso() {
  return new Date().toISOString()
}

export function buildPublicChatRequestDiagnostics(input = {}) {
  const body = input.body ?? {}

  return {
    timestamp: nowIso(),
    source: "public_chat",
    event: input.event ?? "request",
    origin: input.origin ?? null,
    host: input.host ?? null,
    method: input.method ?? null,
    widgetSlug: typeof body.widgetSlug === "string" ? body.widgetSlug : null,
    projeto: typeof body.projeto === "string" ? body.projeto : null,
    agente: typeof body.agente === "string" ? body.agente : null,
    canal: typeof body.canal === "string" ? body.canal : body.context?.channel?.kind ?? null,
    sourceHint: typeof body.source === "string" ? body.source : null,
    hasChatId: Boolean(body.chatId),
    hasConversationId: Boolean(body.conversationId),
    hasAttachments: Array.isArray(body.attachments) && body.attachments.length > 0,
    elapsedMs: input.elapsedMs ?? null,
    status: input.status ?? null,
    chatId: input.chatId ?? null,
    error: input.error ?? null,
  }
}

export function logPublicChatEvent(input = {}) {
  const payload = buildPublicChatRequestDiagnostics(input)
  if (payload.error) {
    console.error("[public-chat]", payload)
  } else {
    console.info("[public-chat]", payload)
  }
}

export function buildChatConfigDiagnostics(input = {}) {
  return {
    timestamp: nowIso(),
    source: "public_chat_config",
    event: input.event ?? "request",
    origin: input.origin ?? null,
    host: input.host ?? null,
    projeto: input.projeto ?? null,
    agente: input.agente ?? null,
    elapsedMs: input.elapsedMs ?? null,
    status: input.status ?? null,
    error: input.error ?? null,
  }
}

export function logChatConfigEvent(input = {}) {
  const payload = buildChatConfigDiagnostics(input)
  if (payload.error) {
    console.error("[public-chat-config]", payload)
  } else {
    console.info("[public-chat-config]", payload)
  }
}
