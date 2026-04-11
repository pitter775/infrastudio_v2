import { NextResponse } from "next/server"

import { updateAgenteForUser } from "@/lib/agentes"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function PATCH(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const body = await request.json()

  if (!body.agenteId || !body.nome || !body.promptBase) {
    return NextResponse.json(
      { error: "Agente, nome e prompt sao obrigatorios." },
      { status: 400 },
    )
  }

  const agent = await updateAgenteForUser(
    {
      agenteId: body.agenteId,
      projetoId: project.id,
      nome: body.nome,
      descricao: body.descricao,
      promptBase: body.promptBase,
      ativo: body.ativo,
    },
    user,
  )

  if (!agent) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o agente." }, { status: 500 })
  }

  return NextResponse.json({ agent }, { status: 200 })
}
