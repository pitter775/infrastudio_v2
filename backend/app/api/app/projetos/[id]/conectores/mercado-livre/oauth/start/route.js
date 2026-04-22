import { NextResponse } from "next/server"

import { buildMercadoLivreAuthorizationUrl } from "@/lib/mercado-livre-connector"
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel iniciar o OAuth do Mercado Livre." },
      { status: 400 },
    )
  }
}
