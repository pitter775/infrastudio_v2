import { NextResponse } from "next/server"

import { buildMercadoLivreAuthorizationUrl } from "@/lib/mercado-livre-connector"
import { createLogEntry } from "@/lib/logs"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  try {
    const authorizationUrl = await buildMercadoLivreAuthorizationUrl(project, user, new URL(request.url).origin)
    return NextResponse.json({ authorizationUrl }, { status: 200 })
  } catch (error) {
    await createLogEntry({
      projectId: project.id,
      type: "mercado_livre_oauth",
      origin: "laboratorio",
      level: "error",
      description: "Falha ao iniciar o OAuth do Mercado Livre.",
      payload: {
        event: "oauth_start_route_error",
        projetoId: project.id,
        requestOrigin: new URL(request.url).origin,
        error: error instanceof Error ? error.message : "Nao foi possivel iniciar o OAuth do Mercado Livre.",
        forcePersist: true,
        keep: true,
        sourceHint: "mercado_livre_oauth",
      },
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel iniciar o OAuth do Mercado Livre." },
      { status: 400 },
    )
  }
}
