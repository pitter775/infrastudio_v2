import { createLogEntry } from "@/lib/logs"

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
    projetoId: input.projectId ?? null,
    agenteId: input.agentId ?? null,
    channelKind: input.channelKind ?? null,
    elapsedMs: input.elapsedMs ?? null,
    status: input.status ?? null,
    chatId: input.chatId ?? null,
    errorSource: input.errorSource ?? null,
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

function resolvePublicChatLogLevel(payload) {
  if (payload.status >= 500 || payload.error) {
    return "error"
  }

  if (payload.status >= 400) {
    return "warn"
  }

  return "info"
}

function buildPublicChatLogDescription(payload) {
  if (payload.error) {
    return payload.error
  }

  if (payload.event === "completed") {
    return "Chat publico processado com sucesso."
  }

  if (payload.event === "validation_error") {
    return "Falha de validacao no chat publico."
  }

  return "Evento do chat publico."
}

export async function recordPublicChatEvent(input = {}) {
  const payload = buildPublicChatRequestDiagnostics(input)
  logPublicChatEvent(input)

  return createLogEntry({
    projectId: input.projectId ?? payload.projetoId ?? null,
    type: payload.error ? "chat_error" : "chat_event",
    origin: payload.source,
    level: resolvePublicChatLogLevel(payload),
    description: buildPublicChatLogDescription(payload),
    payload,
  })
}

export function buildChatConfigDiagnostics(input = {}) {
  return {
    timestamp: nowIso(),
    source: "public_chat_config",
    event: input.event ?? "request",
    origin: input.origin ?? null,
    host: input.host ?? null,
    projetoId: input.projectId ?? null,
    projeto: input.projeto ?? null,
    agenteId: input.agentId ?? null,
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

function resolveChatConfigLogLevel(payload) {
  if (payload.status >= 500 || payload.error) {
    return "error"
  }

  if (payload.status >= 400) {
    return "warn"
  }

  return "info"
}

function buildChatConfigLogDescription(payload) {
  if (payload.error) {
    return payload.error
  }

  if (payload.event === "completed") {
    return "Configuracao publica do chat carregada."
  }

  return "Evento da configuracao publica do chat."
}

export async function recordChatConfigEvent(input = {}) {
  const payload = buildChatConfigDiagnostics(input)
  logChatConfigEvent(input)

  return createLogEntry({
    projectId: input.projectId ?? payload.projetoId ?? null,
    type: payload.error ? "chat_config_error" : "chat_config_event",
    origin: payload.source,
    level: resolveChatConfigLogLevel(payload),
    description: buildChatConfigLogDescription(payload),
    payload,
  })
}
