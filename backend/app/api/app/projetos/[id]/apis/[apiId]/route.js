import { NextResponse } from "next/server"

import { updateApiForUser } from "@/lib/apis"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function PUT(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id, apiId } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const body = await request.json()
  const { api, error } = await updateApiForUser(apiId, project.id, body, user)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ api }, { status: 200 })
}
