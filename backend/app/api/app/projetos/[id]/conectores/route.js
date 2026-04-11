import { NextResponse } from "next/server"

import { listConnectorsForUser } from "@/lib/conectores"
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
