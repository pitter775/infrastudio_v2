import { NextResponse } from "next/server"

import { createChatWidgetForUser, listChatWidgetsForUser } from "@/lib/chat-widgets"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

async function loadProject(identifier) {
  const user = await getSessionUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  }

  const project = await getProjectForUser(identifier, user)

  if (!project) {
    return { response: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) }
  }

  return { user, project }
}

export async function GET(_request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const widgets = await listChatWidgetsForUser(loaded.project, loaded.user)
  return NextResponse.json({ widgets }, { status: 200 })
}

export async function POST(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const body = await request.json()
  const { widget, error } = await createChatWidgetForUser(loaded.project, body, loaded.user)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ widget }, { status: 201 })
}
