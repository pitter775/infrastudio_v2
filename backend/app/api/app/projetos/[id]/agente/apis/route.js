import { NextResponse } from "next/server"

import { replaceAgentApiLinksForUser } from "@/lib/apis"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function PUT(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project?.agent?.id) {
    return NextResponse.json({ error: "Projeto sem agente ativo." }, { status: 400 })
  }

  const body = await request.json()
  const { apiIds, error } = await replaceAgentApiLinksForUser(
    {
      agenteId: project.agent.id,
      projetoId: project.id,
      apiIds: body.apiIds,
    },
    user,
  )

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ apiIds }, { status: 200 })
}
