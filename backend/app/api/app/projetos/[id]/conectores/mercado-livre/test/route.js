import { NextResponse } from "next/server"

import { listMercadoLivreTestItemsForUser } from "@/lib/mercado-livre-connector"
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

  const limit = new URL(request.url).searchParams.get("limit")?.trim() || "8"
  const { items, connector, error } = await listMercadoLivreTestItemsForUser(project, user, { limit })

  if (error) {
    return NextResponse.json({ error, items, connector }, { status: 400 })
  }

  return NextResponse.json({ items, connector }, { status: 200 })
}
