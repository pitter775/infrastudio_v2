import { processChatRequest } from "@/lib/chat/service"
import { logPublicChatEvent } from "@/lib/chat/diagnostics"
import { emptyChatOptionsResponse, formatPublicChatResult, jsonChatResponse, normalizePublicChatBody } from "@/lib/chat/http"

export async function OPTIONS(request) {
  return emptyChatOptionsResponse(request.headers.get("origin"))
}

export async function POST(request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  const startedAt = Date.now()

  try {
    const body = await request.json()
    const normalizedBody = normalizePublicChatBody(body)

    const hasAttachments = Array.isArray(normalizedBody.attachments) && normalizedBody.attachments.length > 0
    if (!normalizedBody.message && !hasAttachments) {
      logPublicChatEvent({
        event: "validation_error",
        origin,
        host,
        method: "POST",
        body: normalizedBody,
        status: 400,
        elapsedMs: Date.now() - startedAt,
        error: "Mensagem obrigatoria.",
      })
      return jsonChatResponse(
        { error: "Mensagem obrigatoria." },
        { status: 400, origin }
      )
    }

    const result = await processChatRequest(normalizedBody)
    logPublicChatEvent({
      event: "completed",
      origin,
      host,
      method: "POST",
      body: normalizedBody,
      status: 200,
      chatId: result.chatId ?? null,
      elapsedMs: Date.now() - startedAt,
    })
    return jsonChatResponse(formatPublicChatResult(result), { status: 200, origin })
  } catch (error) {
    console.error("CHAT ERROR:", error)
    logPublicChatEvent({
      event: "failed",
      origin,
      host,
      method: "POST",
      status: 500,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Erro interno no chat",
    })

    return jsonChatResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno no chat",
      },
      { status: 500, origin }
    )
  }
}
