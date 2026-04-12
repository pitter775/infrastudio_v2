import { randomUUID } from "node:crypto"

import { buildInitialChatContext, processChatRequest } from "@/lib/chat/service"
import { buildAiObservability } from "@/lib/admin-conversations"
import { recordPublicChatEvent } from "@/lib/chat/diagnostics"
import { emptyChatOptionsResponse, formatPublicChatResult, jsonChatResponse, normalizePublicChatBody } from "@/lib/chat/http"
import { createLogEntry } from "@/lib/logs"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function isAdminAgentTestRequest(body) {
  return (
    body?.canal === "admin_agent_test" ||
    body?.context?.channel?.kind === "admin_agent_test" ||
    body?.context?.admin?.source === "agent_simulator"
  )
}

async function validateAdminAgentTestRequest(body, origin) {
  const user = await getSessionUser()
  if (!user) {
    return {
      ok: false,
      response: jsonChatResponse({ error: "Nao autenticado." }, { status: 401, origin }),
    }
  }

  const projectIdentifier = body?.context?.admin?.projetoId ?? body?.projeto
  const project = await getProjectForUser(projectIdentifier, user)
  if (!project) {
    return {
      ok: false,
      response: jsonChatResponse({ error: "Projeto nao encontrado." }, { status: 403, origin }),
    }
  }

  const agentId = body?.context?.admin?.agenteId ?? body?.agente
  if (agentId && project.agent?.id && agentId !== project.agent.id) {
    return {
      ok: false,
      response: jsonChatResponse({ error: "Agente nao pertence ao projeto." }, { status: 403, origin }),
    }
  }

  return { ok: true, project, user }
}

function mapSimulatorHistory(history, channelKind, externalIdentifier) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .map((item, index) => ({
      id: `sim-history-${index}`,
      chatId: "simulator",
      role: item?.role === "assistant" ? "assistant" : "user",
      conteudo: String(item?.content || "").trim(),
      canal: channelKind,
      identificadorExterno: externalIdentifier,
      tokensInput: null,
      tokensOutput: null,
      custo: null,
      metadata: null,
      createdAt: new Date(Date.now() - (history.length - index) * 1000).toISOString(),
    }))
    .filter((item) => item.conteudo)
}

function createAdminAgentTestRuntimeOptions({ normalizedBody, project, user }) {
  const chatId = randomUUID()
  const channelKind = normalizedBody.canal || "admin_agent_test"
  const externalIdentifier = normalizedBody.identificadorExterno || `admin-agent-test:${chatId}`
  const adminContext = isPlainObject(normalizedBody.context?.admin) ? normalizedBody.context.admin : {}
  const simulatorContext = isPlainObject(adminContext.simulatorContext) ? adminContext.simulatorContext : {}
  const messages = mapSimulatorHistory(adminContext.history, channelKind, externalIdentifier)
  let latestContext = simulatorContext

  return {
    getContext: () => latestContext,
    options: {
      ensureActiveChatSession: async (input) => {
        const initialContext = buildInitialChatContext({
          resolved: input.resolved,
          extraContext: {
            ...simulatorContext,
            admin: normalizedBody.context?.admin ?? null,
            laboratory: normalizedBody.context?.laboratory ?? null,
            ui: normalizedBody.context?.ui ?? null,
          },
          channelKind: input.channelKind,
          normalizedExternalIdentifier: input.normalizedExternalIdentifier,
        })
        latestContext = initialContext

        return {
          chat: {
          id: chatId,
            titulo: "Teste do agente",
            status: "ativo",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalTokens: 0,
            totalCusto: 0,
            agenteId: input.resolved?.agente?.id ?? project?.agent?.id ?? null,
            usuarioId: user?.id ?? null,
            projetoId: input.resolved?.projeto?.id ?? project?.id ?? null,
            canal: input.channelKind,
            identificadorExterno: input.normalizedExternalIdentifier,
            contexto: initialContext,
            contatoNome: null,
            contatoTelefone: null,
            contatoAvatarUrl: null,
          },
          created: false,
          initialContext,
        }
      },
      uploadChatAttachmentPayloads: async () => [],
      persistUserTurn: async (input) => {
        const userMessage = {
          id: randomUUID(),
          chatId,
          role: "user",
          conteudo: input.message || "Mensagem de teste.",
          canal: input.channelKind,
          identificadorExterno: input.normalizedExternalIdentifier,
          tokensInput: null,
          tokensOutput: null,
          custo: null,
          metadata: null,
          createdAt: new Date().toISOString(),
        }
        messages.push(userMessage)
        return userMessage
      },
      loadChatHistory: async () => messages,
      applyHandoffGuardrail: async () => ({ paused: false, handoff: null, result: null }),
      requestRuntimeHumanHandoff: async () => ({
        handoff: {
          id: randomUUID(),
          status: "pending_human",
          simulator: true,
        },
        acknowledgement: "Atendimento humano simulado no teste do agente.",
      }),
      persistAssistantTurn: async (input) => {
        const assistantMessage = {
          id: randomUUID(),
          chatId,
          role: "assistant",
          conteudo: input.content,
          canal: input.channelKind,
          identificadorExterno: input.normalizedExternalIdentifier,
          tokensInput: input.tokensInput ?? null,
          tokensOutput: input.tokensOutput ?? null,
          custo: input.custo ?? null,
          metadata: input.aiMetadata ?? null,
          createdAt: new Date().toISOString(),
        }
        messages.push(assistantMessage)
        return assistantMessage
      },
      persistAssistantState: async (input) => {
        latestContext = input.nextContext
      },
      registrarUso: async (projectId, tokens, custo, details = {}) => {
        try {
          const supabase = getSupabaseAdminClient()
          const { error } = await supabase.from("consumos").insert({
            projeto_id: projectId,
            usuario_id: details.usuarioId ?? user?.id ?? null,
            origem: details.origem ?? "admin_agent_test",
            tokens_input: details.tokensInput ?? 0,
            tokens_output: details.tokensOutput ?? 0,
            custo_total: custo ?? 0,
            referencia_id: null,
          })

          if (error) {
            console.error("[chat] failed to record admin agent test usage", error)
            return null
          }

          return { ok: true, tokens, custo }
        } catch (error) {
          console.error("[chat] failed to record admin agent test usage", error)
          return null
        }
      },
    },
  }
}

async function recordAdminAgentTestLog({ normalizedBody, result, project }) {
  await createLogEntry({
    projectId: result?.diagnostics?.projetoId ?? project?.id ?? null,
    type: "lab_agent_test",
    origin: "laboratorio",
    level: "info",
    description: "Teste manual do agente pelo editor.",
    payload: {
      event: "agent_admin_test",
      inputMessage: normalizedBody.message,
      outputReply: result?.reply ?? "",
      chatId: result?.chatId ?? null,
      ephemeral: true,
      agenteId: result?.diagnostics?.agenteId ?? normalizedBody?.agente ?? null,
      agenteNome: result?.diagnostics?.agenteNome ?? project?.agent?.name ?? null,
      diagnostics: result?.diagnostics ?? null,
      observability: buildAiObservability(result?.diagnostics ?? {}, {}),
    },
  })
}

function inferChatFailureOrigin(error) {
  const message = String(error?.message || "").toLowerCase()

  if (message.includes("openai")) {
    return "openai"
  }

  if (message.includes("mensagem do cliente") || message.includes("salvar a resposta") || message.includes("banco")) {
    return "persistence"
  }

  if (message.includes("billing") || message.includes("limite")) {
    return "billing"
  }

  return "runtime"
}

export async function OPTIONS(request) {
  return emptyChatOptionsResponse(request.headers.get("origin"))
}

export async function POST(request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  const startedAt = Date.now()

  try {
    const body = await request.json()
    const normalizedBody = normalizePublicChatBody(body)
    const isAdminAgentTest = isAdminAgentTestRequest(normalizedBody)
    const adminAgentTestContext = isAdminAgentTest
      ? await validateAdminAgentTestRequest(normalizedBody, origin)
      : { ok: true, project: null }

    if (!adminAgentTestContext.ok) {
      return adminAgentTestContext.response
    }

    const hasAttachments = Array.isArray(normalizedBody.attachments) && normalizedBody.attachments.length > 0
    if (!normalizedBody.message && !hasAttachments) {
      await recordPublicChatEvent({
        event: "validation_error",
        origin,
        host,
        method: "POST",
        body: normalizedBody,
        status: 400,
        elapsedMs: Date.now() - startedAt,
        error: "Mensagem obrigatoria.",
      })
      return jsonChatResponse(
        { error: "Mensagem obrigatoria." },
        { status: 400, origin }
      )
    }

    const adminAgentTestRuntime = isAdminAgentTest
      ? createAdminAgentTestRuntimeOptions({
          normalizedBody,
          project: adminAgentTestContext.project,
          user: adminAgentTestContext.user,
        })
      : null
    const result = await processChatRequest(normalizedBody, adminAgentTestRuntime?.options ?? {})
    if (isAdminAgentTest) {
      await recordAdminAgentTestLog({
        normalizedBody,
        result,
        project: adminAgentTestContext.project,
      })
    }

    await recordPublicChatEvent({
      event: "completed",
      origin,
      host,
      method: "POST",
      body: normalizedBody,
      status: 200,
      projectId: result?.diagnostics?.projetoId ?? null,
      chatId: result.chatId ?? null,
      elapsedMs: Date.now() - startedAt,
      errorSource: null,
    })

    const responsePayload = formatPublicChatResult(result)
    if (isAdminAgentTest) {
      responsePayload.diagnostics = result?.diagnostics ?? null
      responsePayload.ephemeral = true
      responsePayload.simulatorContext = adminAgentTestRuntime?.getContext() ?? null
    }

    return jsonChatResponse(responsePayload, { status: 200, origin })
  } catch (error) {
    console.error("CHAT ERROR:", error)
    await recordPublicChatEvent({
      event: "failed",
      origin,
      host,
      method: "POST",
      status: 500,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Erro interno no chat",
      errorSource: inferChatFailureOrigin(error),
    })

    return jsonChatResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno no chat",
      },
      { status: 500, origin }
    )
  }
}
