import { NextResponse } from "next/server"

import { listMercadoLivreOrdersForUser } from "@/lib/mercado-livre-connector"
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

  const url = new URL(request.url)
  const limit = url.searchParams.get("limit")?.trim() || "10"
  const offset = url.searchParams.get("offset")?.trim() || "0"
  const { orders, paging, connector, error } = await listMercadoLivreOrdersForUser(project, user, { limit, offset })

  if (error) {
    return NextResponse.json({ error, orders, paging, connector }, { status: 400 })
  }

  return NextResponse.json({ orders, paging, connector }, { status: 200 })
}
