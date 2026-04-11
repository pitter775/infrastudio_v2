import { getAgenteByIdentifier } from "@/lib/agentes"
import { logChatConfigEvent } from "@/lib/chat/diagnostics"
import { emptyChatOptionsResponse, jsonChatResponse } from "@/lib/chat/http"
import { getChatWidgetByProjetoAgente } from "@/lib/chat-widgets"
import { getProjetoByIdentifier } from "@/lib/projetos"

export async function OPTIONS(request) {
  return emptyChatOptionsResponse(request.headers.get("origin"))
}

export async function GET(request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  const startedAt = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const projetoIdentifier = searchParams.get("projeto")?.trim() || ""
    const agenteIdentifier = searchParams.get("agente")?.trim() || ""

    if (!projetoIdentifier) {
      logChatConfigEvent({
        event: "validation_error",
        origin,
        host,
        status: 400,
        elapsedMs: Date.now() - startedAt,
        error: "Parametro `projeto` obrigatorio.",
      })
      return jsonChatResponse({ error: "Parametro `projeto` obrigatorio." }, { status: 400, origin })
    }

    const projeto = await getProjetoByIdentifier(projetoIdentifier)
    if (!projeto) {
      logChatConfigEvent({
        event: "not_found",
        origin,
        host,
        projeto: projetoIdentifier,
        agente: agenteIdentifier || null,
        status: 404,
        elapsedMs: Date.now() - startedAt,
        error: "Projeto nao encontrado.",
      })
      return jsonChatResponse({ error: "Projeto nao encontrado." }, { status: 404, origin })
    }

    let agente = agenteIdentifier ? await getAgenteByIdentifier(agenteIdentifier, projeto.id) : null
    const explicitAgentRequested = Boolean(agenteIdentifier)

    if (agente && (!agente.ativo || agente.projetoId !== projeto.id)) {
      agente = null
    }

    if (!agente) {
      logChatConfigEvent({
        event: "not_found",
        origin,
        host,
        projeto: projetoIdentifier,
        agente: agenteIdentifier || null,
        status: 404,
        elapsedMs: Date.now() - startedAt,
        error: explicitAgentRequested
          ? "Agente nao encontrado, inativo ou fora do projeto."
          : "Nenhum agente valido informado para este chat.",
      })
      return jsonChatResponse(
        {
          error: explicitAgentRequested
            ? "Agente nao encontrado, inativo ou fora do projeto."
            : "Nenhum agente valido informado para este chat.",
        },
        { status: 404, origin }
      )
    }

    const widget = await getChatWidgetByProjetoAgente({
      projetoId: projeto.id,
      agenteId: agente.id,
    })

    logChatConfigEvent({
      event: "completed",
      origin,
      host,
      projeto: projetoIdentifier,
      agente: agenteIdentifier || null,
      status: 200,
      elapsedMs: Date.now() - startedAt,
    })

    return jsonChatResponse(
      {
        projeto: {
          id: projeto.id,
          slug: projeto.slug,
          nome: projeto.nome,
        },
        agente: {
          id: agente.id,
          slug: agente.slug,
          nome: agente.nome,
        },
        ui: {
          title: widget?.nome ?? agente.nome ?? projeto.nome ?? "Chat",
          theme: widget?.tema ?? null,
          accent: widget?.corPrimaria ?? null,
          transparent: widget?.fundoTransparente ?? null,
          whatsappCelular: widget?.whatsappCelular ?? null,
        },
      },
      { status: 200, origin }
    )
  } catch (error) {
    console.error("[chat-config] failed to resolve chat config", error)
    logChatConfigEvent({
      event: "failed",
      origin,
      host,
      status: 500,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Nao foi possivel carregar a configuracao.",
    })
    return jsonChatResponse({ error: "Nao foi possivel carregar a configuracao." }, { status: 500, origin })
  }
}
