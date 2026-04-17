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

export function normalizePublicChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {}
  }

  const message = String(body.message ?? body.mensagem ?? body.texto ?? "").trim()
  const conversationId = String(body.conversationId ?? "").trim()
  const chatId = String(body.chatId ?? "").trim()

  return {
    ...body,
    message,
    chatId: chatId || undefined,
    canal: body.canal ?? body.context?.channel?.kind ?? (body.widgetSlug ? "external_widget" : "web"),
    identificadorExterno:
      typeof body.identificadorExterno === "string" && body.identificadorExterno.trim()
        ? body.identificadorExterno.trim()
        : conversationId || undefined,
    source: body.source ?? (body.widgetSlug || body.projeto || body.agente ? "site_widget" : "admin_attendance_v2"),
  }
}

export function formatPublicChatResult(result) {
  return {
    chatId: result?.chatId ?? "",
    messageId: result?.messageId ?? null,
    reply: result?.reply ?? "",
    followUpReply: result?.followUpReply ?? "",
    messageSequence: Array.isArray(result?.messageSequence) ? result.messageSequence : [],
    assets: Array.isArray(result?.assets) ? result.assets : [],
    whatsapp: result?.whatsapp ?? null,
    handoff: result?.handoff ?? null,
  }
}
