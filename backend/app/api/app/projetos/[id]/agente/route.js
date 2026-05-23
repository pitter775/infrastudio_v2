import { NextResponse } from "next/server"

import {
  buildAgentRuntimeConfigFromStructuredConfig,
  buildAgentStructuredConfigDraft,
  normalizeAgentStructuredConfig,
} from "@/lib/agent-structured-config"
import { createDefaultAgenteForUser, listAgentVersionsForUser, restoreAgentVersionForUser, updateAgenteForUser } from "@/lib/agentes"
import { ensureDefaultChatWidgetForAgent } from "@/lib/chat-widgets"
import { validateJsonObjectConfig } from "@/lib/json-validation"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
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
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
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
    return NextResponse.json({ error: "Não foi possível atualizar o agente." }, { status: 500 })
  }

  const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)
  const { widget } = await ensureDefaultChatWidgetForAgent(project, agent, user)

  return NextResponse.json({ agent: { ...agent, versions }, versions, widget }, { status: 200 })
}

export async function POST(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
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
      return NextResponse.json({ error: "Não foi possível criar o agente." }, { status: 500 })
    }

    const { widget, error } = await ensureDefaultChatWidgetForAgent(project, agent, user)

    if (error) {
      return NextResponse.json({ error, agent }, { status: 500 })
    }

    return NextResponse.json({ agent, widget }, { status: 201 })
  }

  if (!project?.agent?.id) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 })
  }

  if (body.action === "structure_agent_text") {
    const sourceText = String(body.sourceText || project.agent.prompt || "").trim()
    if (!sourceText) {
      return NextResponse.json({ error: "Informe um texto para organizar." }, { status: 400 })
    }

    const draft = await buildAgentStructuredConfigDraft({
      sourceText,
      mode: body.mode === "update" ? "update" : body.mode === "reset" ? "reset" : "analyze",
      currentStructuredConfig: project.agent.structuredConfig,
      openAiKey: process.env.OPENAI_API_KEY?.trim(),
      model: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini",
    })

    if (!draft?.structuredConfig) {
      return NextResponse.json({ error: "NÃ£o foi possÃ­vel organizar o texto do agente." }, { status: 500 })
    }

    const nextConfiguracoes = {
      ...(project.agent.configuracoes || {}),
      structuredConfigDraft: draft.structuredConfig,
      structuredConfigDraftRuntimeConfig: draft.runtimeConfig,
    }

    const agent = await updateAgenteForUser(
      {
        agenteId: project.agent.id,
        projetoId: project.id,
        name: project.agent.name,
        description: project.agent.description,
        prompt: project.agent.prompt,
        active: project.agent.active,
        runtimeConfig: project.agent.runtimeConfig,
        configuracoes: nextConfiguracoes,
      },
      user,
    )

    if (!agent) {
      return NextResponse.json({ error: "NÃ£o foi possÃ­vel salvar o rascunho estruturado." }, { status: 500 })
    }

    const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)
    return NextResponse.json({ agent: { ...agent, versions }, draft, versions }, { status: 200 })
  }

  if (body.action === "apply_structured_config") {
    const structuredConfig = normalizeAgentStructuredConfig(body.structuredConfig || project.agent.structuredConfigDraft)
    if (!structuredConfig) {
      return NextResponse.json({ error: "Rascunho estruturado invÃ¡lido." }, { status: 400 })
    }

    const runtimeConfig = buildAgentRuntimeConfigFromStructuredConfig(structuredConfig)
    const nextConfiguracoes = {
      ...(project.agent.configuracoes || {}),
      structuredConfig,
      runtimeConfig,
    }
    delete nextConfiguracoes.structuredConfigDraft
    delete nextConfiguracoes.structuredConfigDraftRuntimeConfig

    const agent = await updateAgenteForUser(
      {
        agenteId: project.agent.id,
        projetoId: project.id,
        name: project.agent.name,
        description: project.agent.description,
        prompt: project.agent.prompt,
        active: project.agent.active,
        runtimeConfig,
        configuracoes: nextConfiguracoes,
      },
      user,
    )

    if (!agent) {
      return NextResponse.json({ error: "NÃ£o foi possÃ­vel aplicar a estrutura do agente." }, { status: 500 })
    }

    const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)
    return NextResponse.json({ agent: { ...agent, versions }, versions }, { status: 200 })
  }

  if (body.action === "discard_structured_config_draft") {
    const nextConfiguracoes = { ...(project.agent.configuracoes || {}) }
    delete nextConfiguracoes.structuredConfigDraft
    delete nextConfiguracoes.structuredConfigDraftRuntimeConfig

    const agent = await updateAgenteForUser(
      {
        agenteId: project.agent.id,
        projetoId: project.id,
        name: project.agent.name,
        description: project.agent.description,
        prompt: project.agent.prompt,
        active: project.agent.active,
        runtimeConfig: project.agent.runtimeConfig,
        configuracoes: nextConfiguracoes,
      },
      user,
    )

    if (!agent) {
      return NextResponse.json({ error: "NÃ£o foi possÃ­vel descartar o rascunho." }, { status: 500 })
    }

    const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)
    return NextResponse.json({ agent: { ...agent, versions }, versions }, { status: 200 })
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
    return NextResponse.json({ error: "Não foi possível restaurar a versão." }, { status: 500 })
  }

  const versions = await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user)

  return NextResponse.json({ agent, versions }, { status: 200 })
}
