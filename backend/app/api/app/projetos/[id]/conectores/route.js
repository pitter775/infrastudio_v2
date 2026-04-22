import { NextResponse } from "next/server"

import { listConnectorsForUser } from "@/lib/conectores"
import { upsertMercadoLivreConnectorForUser } from "@/lib/mercado-livre-connector"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const connectors = await listConnectorsForUser(project.id, user)
  return NextResponse.json({ connectors }, { status: 200 })
}

export async function POST(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  if (String(body.provider || "").trim().toLowerCase() !== "mercado_livre") {
    return NextResponse.json({ error: "Provider de conector invalido." }, { status: 400 })
  }

  const { connector, error } = await upsertMercadoLivreConnectorForUser(project, body, user)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ connector }, { status: 200 })
}
