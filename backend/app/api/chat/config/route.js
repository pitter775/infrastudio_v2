import { getAgenteById, getAgenteByIdentifier } from "@/lib/agentes"
import { recordChatConfigEvent } from "@/lib/chat/diagnostics"
import { emptyChatOptionsResponse, jsonChatResponse } from "@/lib/chat/http"
import { getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets"
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos"

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
    const widgetSlug = searchParams.get("widgetSlug")?.trim() || searchParams.get("widget")?.trim() || ""

    if (!projetoIdentifier && !widgetSlug) {
      await recordChatConfigEvent({
        event: "validation_error",
        origin,
        host,
        status: 400,
        elapsedMs: Date.now() - startedAt,
        error: "Parametro `projeto` ou `widgetSlug` obrigatorio.",
      })
      return jsonChatResponse({ error: "Parametro `projeto` ou `widgetSlug` obrigatorio." }, { status: 400, origin })
    }

    const requestedWidget = widgetSlug ? await getChatWidgetBySlug(widgetSlug) : null
    const projeto = projetoIdentifier
      ? await getProjetoByIdentifier(projetoIdentifier)
      : requestedWidget?.projetoId
        ? await getProjetoById(requestedWidget.projetoId)
        : null

    if (!projeto) {
      await recordChatConfigEvent({
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

    let agente = agenteIdentifier
      ? await getAgenteByIdentifier(agenteIdentifier, projeto.id)
      : requestedWidget?.agenteId
        ? await getAgenteById(requestedWidget.agenteId)
        : null
    const explicitAgentRequested = Boolean(agenteIdentifier || requestedWidget?.agenteId)

    if (agente && (!agente.active || agente.projectId !== projeto.id)) {
      agente = null
    }

    if (!agente) {
      await recordChatConfigEvent({
        event: "not_found",
        origin,
        host,
        projectId: projeto.id,
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

    const widget =
      requestedWidget?.projetoId === projeto.id && requestedWidget?.agenteId === agente.id
        ? requestedWidget
        : await getChatWidgetByProjetoAgente({
            projetoId: projeto.id,
            agenteId: agente.id,
          })

    await recordChatConfigEvent({
      event: "completed",
      origin,
      host,
      projectId: projeto.id,
      agentId: agente.id,
      projeto: projetoIdentifier,
      agente: agenteIdentifier || null,
      widgetSlug: widgetSlug || null,
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
          nome: agente.name,
        },
        widget: widget
          ? {
              id: widget.id,
              slug: widget.slug,
              nome: widget.nome,
            }
          : null,
        ui: {
          title: widget?.nome ?? agente.name ?? projeto.nome ?? "Chat",
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
    await recordChatConfigEvent({
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
