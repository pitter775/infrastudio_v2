import { NextResponse } from "next/server"

import { listAgentVersionsForUser, restoreAgentVersionForUser, updateAgenteForUser } from "@/lib/agentes"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project?.agent?.id) {
    return NextResponse.json({ versions: [] }, { status: 200 })
  }

  const versions = await listAgentVersionsForUser(
    {
      agenteId: project.agent.id,
      projetoId: project.id,
    },
    user,
  )

  return NextResponse.json({ versions }, { status: 200 })
}

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
      runtimeConfig: body.runtimeConfig,
    },
    user,
  )

  if (!agent) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o agente." }, { status: 500 })
  }

  const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)

  return NextResponse.json({ agent: { ...agent, versions }, versions }, { status: 200 })
}

export async function POST(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project?.agent?.id) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 })
  }

  const body = await request.json()

  if (body.action !== "restore_version" || !body.versionId) {
    return NextResponse.json({ error: "Acao invalida." }, { status: 400 })
  }

  const agent = await restoreAgentVersionForUser(
    {
      agenteId: project.agent.id,
      projetoId: project.id,
      versionId: body.versionId,
    },
    user,
  )

  if (!agent) {
    return NextResponse.json({ error: "Nao foi possivel restaurar a versao." }, { status: 500 })
  }

  const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)

  return NextResponse.json({ agent, versions }, { status: 200 })
}
