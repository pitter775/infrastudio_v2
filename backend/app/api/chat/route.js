import { processChatRequest } from "@/lib/chat/service"
import { recordPublicChatEvent } from "@/lib/chat/diagnostics"
import { emptyChatOptionsResponse, formatPublicChatResult, jsonChatResponse, normalizePublicChatBody } from "@/lib/chat/http"

function inferChatFailureOrigin(error) {
  const message = String(error?.message || "").toLowerCase()

  if (message.includes("openai")) {
    return "openai"
  }

  if (message.includes("mensagem do cliente") || message.includes("salvar a resposta") || message.includes("banco")) {
    return "persistence"
  }

  if (message.includes("billing") || message.includes("limite")) {
    return "billing"
  }

  return "runtime"
}

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
      await recordPublicChatEvent({
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
    await recordPublicChatEvent({
      event: "completed",
      origin,
      host,
      method: "POST",
      body: normalizedBody,
      status: 200,
      projectId: result?.diagnostics?.projetoId ?? null,
      chatId: result.chatId ?? null,
      elapsedMs: Date.now() - startedAt,
      errorSource: null,
    })
    return jsonChatResponse(formatPublicChatResult(result), { status: 200, origin })
  } catch (error) {
    console.error("CHAT ERROR:", error)
    await recordPublicChatEvent({
      event: "failed",
      origin,
      host,
      method: "POST",
      status: 500,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Erro interno no chat",
      errorSource: inferChatFailureOrigin(error),
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
