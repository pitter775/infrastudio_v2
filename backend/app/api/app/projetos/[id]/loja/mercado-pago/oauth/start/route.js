import { NextResponse } from "next/server"

import { createLogEntry } from "@/lib/logs"
import { buildMercadoPagoStoreAuthorizationUrl } from "@/lib/mercado-pago-store"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  try {
    const authorizationUrl = await buildMercadoPagoStoreAuthorizationUrl(project, user, new URL(request.url).origin)
    return NextResponse.json({ authorizationUrl }, { status: 200 })
  } catch (error) {
    await createLogEntry({
      projectId: project.id,
      type: "store_mercado_pago_oauth_error",
      origin: "mercado_pago_store_oauth",
      level: "error",
      description: "Falha ao iniciar OAuth Mercado Pago da loja.",
      payload: {
        error: error instanceof Error ? error.message : "Não foi possível iniciar OAuth Mercado Pago da loja.",
        forcePersist: true,
      },
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível iniciar OAuth Mercado Pago da loja." },
      { status: 400 },
    )
  }
}
