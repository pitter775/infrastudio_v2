import { NextResponse } from "next/server"

import { createApiForUser, listAgentApiIdsForUser, listApisForUser } from "@/lib/apis"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

async function loadProject(identifier) {
  const user = await getSessionUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }) }
  }

  const project = await getProjectForUser(identifier, user)

  if (!project) {
    return { response: NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 }) }
  }

  return { user, project }
}

export async function GET(_request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const [apis, linkedApiIds] = await Promise.all([
    listApisForUser(loaded.project.id, loaded.user),
    loaded.project.agent?.id
      ? listAgentApiIdsForUser(loaded.project.agent.id, loaded.project.id, loaded.user)
      : [],
  ])

  return NextResponse.json({ apis, linkedApiIds }, { status: 200 })
}

export async function POST(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    return loaded.response
  }

  const body = await request.json()
  const { api, error } = await createApiForUser(loaded.project.id, body, loaded.user)

  if (error) {
    return NextResponse.json({ error }, { status: api ? 200 : 400 })
  }

  return NextResponse.json({ api }, { status: 201 })
}
