import { NextResponse } from "next/server"

import { createDefaultAgenteForUser, listAgentVersionsForUser, restoreAgentVersionForUser, updateAgenteForUser } from "@/lib/agentes"
import { ensureDefaultChatWidgetForAgent } from "@/lib/chat-widgets"
import { validateJsonObjectConfig } from "@/lib/json-validation"
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
  const agentId = body.agenteId || body.agentId
  const agentName = body.name || body.nome
  const agentDescription = body.description || body.descricao
  const agentPrompt = body.prompt || body.promptBase
  const agentActive = typeof body.active === "boolean" ? body.active : body.ativo

  if (!agentId || !agentName || !agentPrompt) {
    return NextResponse.json(
      { error: "Agente, nome e prompt sao obrigatorios." },
      { status: 400 },
    )
  }

  const runtimeValidation = validateJsonObjectConfig(body.runtimeConfig, "runtimeConfig")
  if (!runtimeValidation.ok) {
    return NextResponse.json({ error: runtimeValidation.error }, { status: 400 })
  }

  const configValidation = validateJsonObjectConfig(body.configuracoes, "configuracoes")
  if (!configValidation.ok) {
    return NextResponse.json({ error: configValidation.error }, { status: 400 })
  }

  const agent = await updateAgenteForUser(
    {
      agenteId: agentId,
      projetoId: project.id,
      name: agentName,
      description: agentDescription,
      prompt: agentPrompt,
      active: agentActive,
      runtimeConfig: runtimeValidation.value,
      configuracoes: configValidation.value,
    },
    user,
  )

  if (!agent) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o agente." }, { status: 500 })
  }

  const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)
  const { widget } = await ensureDefaultChatWidgetForAgent(project, agent, user)

  return NextResponse.json({ agent: { ...agent, versions }, versions, widget }, { status: 200 })
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

  const body = await request.json()

  if (body.action === "create_agent") {
    if (project.agent?.id) {
      const { widget } = await ensureDefaultChatWidgetForAgent(project, project.agent, user)
      return NextResponse.json({ agent: project.agent, widget }, { status: 200 })
    }

    const agent = await createDefaultAgenteForUser(
      {
        projetoId: project.id,
        projectName: project.name,
        nome: body.nome || `${project.name} Assistente`,
        descricao: body.businessContext,
        businessContext: body.businessContext,
      },
      user,
    )

    if (!agent) {
      return NextResponse.json({ error: "Nao foi possivel criar o agente." }, { status: 500 })
    }

    const { widget, error } = await ensureDefaultChatWidgetForAgent(project, agent, user)

    if (error) {
      return NextResponse.json({ error, agent }, { status: 500 })
    }

    return NextResponse.json({ agent, widget }, { status: 201 })
  }

  if (!project?.agent?.id) {
    return NextResponse.json({ error: "Agente nao encontrado." }, { status: 404 })
  }

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
