import { randomUUID } from "node:crypto"

import { recordJsonApiUsage } from "@/lib/api-usage-metrics"
import { buildSilentChatResult } from "@/lib/chat/result-builders"
import { buildInitialChatContext, isSavedWhatsAppContact, processChatRequest, resolveProjectAgent } from "@/lib/chat/service"
import { buildAiObservability } from "@/lib/admin-conversations"
import { registerProjectBillingUsage, verifyProjectBillingAccess } from "@/lib/billing"
import { APP_BUILD_LABEL } from "@/lib/build-info"
import { recordPublicChatEvent } from "@/lib/chat/diagnostics"
import { emptyChatOptionsResponse, formatPublicChatResult, jsonChatResponse, normalizePublicChatBody } from "@/lib/chat/http"
import { createLogEntry } from "@/lib/logs"
import { getChatById, listChatMessages } from "@/lib/chats"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getWhatsAppChannelById, resolveSavedContactFlags } from "@/lib/whatsapp-channels"

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
          return registerProjectBillingUsage(projectId, tokens, custo, {
            ...details,
            usuarioId: details.usuarioId ?? user?.id ?? null,
            origem: details.origem ?? "admin_agent_test",
            referenciaId: null,
          })
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

function getIncomingWhatsAppChannelId(body) {
  if (typeof body?.whatsappChannelId === "string" && body.whatsappChannelId.trim()) {
    return body.whatsappChannelId.trim()
  }

  if (typeof body?.context?.whatsapp?.channelId === "string" && body.context.whatsapp.channelId.trim()) {
    return body.context.whatsapp.channelId.trim()
  }

  return null
}

function buildWhatsAppContextWithSavedContactFlags(context, whatsappChannel) {
  const savedContactFlags = resolveSavedContactFlags(whatsappChannel?.sessionData)
  if (!savedContactFlags) {
    return context
  }

  const baseContext = isPlainObject(context) ? { ...context } : {}
  const whatsapp = isPlainObject(baseContext.whatsapp) ? { ...baseContext.whatsapp } : {}
  const rawContact = isPlainObject(whatsapp.rawContact) ? { ...whatsapp.rawContact } : null
  const hasExplicitFlags = [
    whatsapp.isSavedContact,
    whatsapp.isMyContact,
    whatsapp.isSaved,
    rawContact?.isSavedContact,
    rawContact?.isMyContact,
    rawContact?.isSaved,
  ].some((value) => typeof value === "boolean")

  if (hasExplicitFlags) {
    return baseContext
  }

  return {
    ...baseContext,
    whatsapp: {
      ...whatsapp,
      ...savedContactFlags,
      ...(rawContact
        ? {
            rawContact: {
              ...rawContact,
              ...savedContactFlags,
            },
          }
        : {}),
    },
  }
}

function isSavedWhatsAppInboundContext(context, whatsappChannel) {
  if (isSavedWhatsAppContact(context)) {
    return true
  }

  const savedContactFlags = resolveSavedContactFlags(whatsappChannel?.sessionData)
  if (!savedContactFlags) {
    return false
  }

  return [savedContactFlags.isSavedContact, savedContactFlags.isMyContact, savedContactFlags.isSaved].some(
    (value) => value === true
  )
}

function buildPresentFieldMap(source, keys) {
  return keys.reduce((accumulator, key) => {
    const value = source?.[key]
    const present =
      value !== null &&
      typeof value !== "undefined" &&
      (!(typeof value === "string") || value.trim().length > 0)

    accumulator[key] = present
    return accumulator
  }, {})
}

function measurePayloadSize(value) {
  try {
    return JSON.stringify(value).length
  } catch {
    return null
  }
}

function listPresentKeys(source, keys) {
  return keys.filter((key) => {
    const value = source?.[key]
    return (
      value !== null &&
      typeof value !== "undefined" &&
      (!(typeof value === "string") || value.trim().length > 0)
    )
  })
}

function buildWhatsAppSavedContactDiagnostic(context, whatsappChannel, resolvedProjectAgent) {
  const whatsapp = isPlainObject(context?.whatsapp) ? context.whatsapp : {}
  const rawContact = isPlainObject(whatsapp.rawContact) ? whatsapp.rawContact : {}
  const savedContactFlags = resolveSavedContactFlags(whatsappChannel?.sessionData) ?? null
  const blockedAsSavedContact = isSavedWhatsAppInboundContext(context, whatsappChannel)
  const whatsappFieldPresence = buildPresentFieldMap(whatsapp, [
    "contactName",
    "pushName",
    "shortName",
    "displayName",
    "remotePhone",
    "remoteJid",
    "profilePicUrl",
    "isSavedContact",
    "isMyContact",
    "isSaved",
    "savedContactFlags",
    "rawContact",
  ])
  const rawContactFieldPresence = buildPresentFieldMap(rawContact, [
    "number",
    "name",
    "pushname",
    "shortName",
    "isMyContact",
    "isSavedContact",
    "isSaved",
    "isUser",
    "isWAContact",
    "isBusiness",
    "isEnterprise",
    "profilePicUrl",
    "verifiedName",
    "labels",
  ])
  const minimalCandidate = {
    remotePhone: typeof whatsapp.remotePhone === "string" ? whatsapp.remotePhone : null,
    contactName: typeof whatsapp.contactName === "string" ? whatsapp.contactName : null,
    pushName: typeof whatsapp.pushName === "string" ? whatsapp.pushName : null,
    shortName: typeof whatsapp.shortName === "string" ? whatsapp.shortName : null,
    isSavedContact: typeof whatsapp.isSavedContact === "boolean" ? whatsapp.isSavedContact : null,
    isMyContact: typeof whatsapp.isMyContact === "boolean" ? whatsapp.isMyContact : null,
    isSaved: typeof whatsapp.isSaved === "boolean" ? whatsapp.isSaved : null,
    savedContactFlags,
    rawContact: {
      number: typeof rawContact.number === "string" ? rawContact.number : null,
      name: typeof rawContact.name === "string" ? rawContact.name : null,
      pushname: typeof rawContact.pushname === "string" ? rawContact.pushname : null,
      shortName: typeof rawContact.shortName === "string" ? rawContact.shortName : null,
      isMyContact: typeof rawContact.isMyContact === "boolean" ? rawContact.isMyContact : null,
      isSavedContact: typeof rawContact.isSavedContact === "boolean" ? rawContact.isSavedContact : null,
      isSaved: typeof rawContact.isSaved === "boolean" ? rawContact.isSaved : null,
      isUser: typeof rawContact.isUser === "boolean" ? rawContact.isUser : null,
      isWAContact: typeof rawContact.isWAContact === "boolean" ? rawContact.isWAContact : null,
      isBusiness: typeof rawContact.isBusiness === "boolean" ? rawContact.isBusiness : null,
      isEnterprise: typeof rawContact.isEnterprise === "boolean" ? rawContact.isEnterprise : null,
    },
  }
  const minimalWhatsappKeys = listPresentKeys(minimalCandidate, [
    "remotePhone",
    "contactName",
    "pushName",
    "shortName",
    "isSavedContact",
    "isMyContact",
    "isSaved",
    "savedContactFlags",
    "rawContact",
  ])
  const minimalRawContactKeys = listPresentKeys(minimalCandidate.rawContact, [
    "number",
    "name",
    "pushname",
    "shortName",
    "isMyContact",
    "isSavedContact",
    "isSaved",
    "isUser",
    "isWAContact",
    "isBusiness",
    "isEnterprise",
  ])

  return {
    event: "whatsapp_saved_contact_probe",
    buildLabel: APP_BUILD_LABEL,
    runtimeHost: process.env.RAILWAY_PUBLIC_DOMAIN?.trim() || process.env.VERCEL_URL?.trim() || null,
    onlyReplyToUnsavedContacts: whatsappChannel?.onlyReplyToUnsavedContacts === true,
    channelToggleValue: whatsappChannel?.onlyReplyToUnsavedContacts ?? null,
    blockedAsSavedContact,
    projectId: resolvedProjectAgent?.projeto?.id ?? whatsappChannel?.projetoId ?? null,
    agentId: resolvedProjectAgent?.agente?.id ?? whatsappChannel?.agenteId ?? null,
    channelId: whatsappChannel?.id ?? null,
    channelProjectId: whatsappChannel?.projetoId ?? null,
    channelAgentId: whatsappChannel?.agenteId ?? null,
    channelStatus: whatsappChannel?.status ?? null,
    hasChannelRecord: Boolean(whatsappChannel?.id),
    contactName: typeof whatsapp.contactName === "string" ? whatsapp.contactName : null,
    pushName: typeof whatsapp.pushName === "string" ? whatsapp.pushName : null,
    remotePhone: typeof whatsapp.remotePhone === "string" ? whatsapp.remotePhone : null,
    rawContactName: typeof rawContact.name === "string" ? rawContact.name : null,
    rawContactPushname: typeof rawContact.pushname === "string" ? rawContact.pushname : null,
    rawContactNumber: typeof rawContact.number === "string" ? rawContact.number : null,
    explicitFlags: {
      whatsappIsSavedContact: typeof whatsapp.isSavedContact === "boolean" ? whatsapp.isSavedContact : null,
      whatsappIsMyContact: typeof whatsapp.isMyContact === "boolean" ? whatsapp.isMyContact : null,
      whatsappIsSaved: typeof whatsapp.isSaved === "boolean" ? whatsapp.isSaved : null,
      rawIsSavedContact: typeof rawContact.isSavedContact === "boolean" ? rawContact.isSavedContact : null,
      rawIsMyContact: typeof rawContact.isMyContact === "boolean" ? rawContact.isMyContact : null,
      rawIsSaved: typeof rawContact.isSaved === "boolean" ? rawContact.isSaved : null,
    },
    channelSavedContactFlags: savedContactFlags,
    inboundWhatsappKeys: Object.keys(whatsapp).sort(),
    inboundRawContactKeys: Object.keys(rawContact).sort(),
    inboundWhatsappFieldPresence: whatsappFieldPresence,
    inboundRawContactFieldPresence: rawContactFieldPresence,
    inboundWhatsappPayloadSize: measurePayloadSize(whatsapp),
    inboundRawContactPayloadSize: measurePayloadSize(rawContact),
    minimalCandidatePayloadSize: measurePayloadSize(minimalCandidate),
    minimalCandidateKeys: {
      whatsapp: minimalWhatsappKeys,
      rawContact: minimalRawContactKeys,
    },
    sessionDataKeys: isPlainObject(whatsappChannel?.sessionData) ? Object.keys(whatsappChannel.sessionData).sort() : [],
  }
}

async function recordWhatsAppSavedContactDiagnostic(input) {
  const {
    context,
    whatsappChannel,
    resolvedProjectAgent,
    host,
    channelId,
  } = input

  await createLogEntry({
    projectId: resolvedProjectAgent?.projeto?.id ?? whatsappChannel?.projetoId ?? null,
    type: "lab_whatsapp_saved_contact_probe",
    origin: "laboratorio",
    level: "error",
    description: "Diagnostico temporario do inbound WhatsApp para contatos salvos.",
    payload: {
      requestHost: host ?? null,
      requestChannelId: channelId ?? null,
      ...buildWhatsAppSavedContactDiagnostic(context, whatsappChannel, resolvedProjectAgent),
    },
  })
}

export async function OPTIONS(request) {
  return emptyChatOptionsResponse(request.headers.get("origin"))
}

function mapPublicChatMessage(message) {
  return {
    id: message.id,
    role: message.role,
    text: message.conteudo ?? "",
    createdAt: message.createdAt,
    assets: Array.isArray(message.metadata?.assets) ? message.metadata.assets : [],
    attachments: Array.isArray(message.metadata?.attachments) ? message.metadata.attachments : [],
    whatsapp: message.metadata?.whatsappCta ?? null,
    actions: Array.isArray(message.metadata?.actions) ? message.metadata.actions : [],
    ui: message.metadata?.ui ?? null,
    manual: message.metadata?.manual === true,
  }
}

export async function GET(request) {
  const origin = request.headers.get("origin")
  const startedAt = Date.now()
  const url = new URL(request.url)
  const chatId = String(url.searchParams.get("chatId") || "").trim()
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50)

  if (!chatId) {
    const payload = { error: "chatId obrigatorio." }
    recordJsonApiUsage({
      route: "/api/chat",
      method: "GET",
      status: 400,
      elapsedMs: Date.now() - startedAt,
      source: "public_chat_sync",
      payload,
    })
    return jsonChatResponse(payload, { status: 400, origin })
  }

  const chat = await getChatById(chatId)
  if (!chat) {
    const payload = { error: "Conversa nao encontrada." }
    recordJsonApiUsage({
      route: "/api/chat",
      method: "GET",
      status: 404,
      elapsedMs: Date.now() - startedAt,
      source: "public_chat_sync",
      payload,
    })
    return jsonChatResponse(payload, { status: 404, origin })
  }

  const widgetSlug = String(url.searchParams.get("widgetSlug") || "").trim()
  const widgetId = String(url.searchParams.get("widgetId") || "").trim()
  const projeto = String(url.searchParams.get("projeto") || "").trim()
  const agente = String(url.searchParams.get("agente") || "").trim()
  const resolved =
    widgetId || widgetSlug || projeto || agente
      ? await resolveProjectAgent({
          widgetId: widgetId || undefined,
          widgetSlug: widgetSlug || undefined,
          projeto: projeto || undefined,
          agente: agente || undefined,
        })
      : { projeto: null, agente: null }
  const projectMatches = !resolved.projeto?.id || !chat.projetoId || resolved.projeto.id === chat.projetoId
  const agentMatches = !resolved.agente?.id || !chat.agenteId || resolved.agente.id === chat.agenteId

  if ((widgetId || widgetSlug || projeto || agente) && (!projectMatches || !agentMatches)) {
    const payload = { error: "Acesso negado." }
    recordJsonApiUsage({
      route: "/api/chat",
      method: "GET",
      status: 403,
      elapsedMs: Date.now() - startedAt,
      projectId: chat.projetoId,
      source: "public_chat_sync",
      payload,
    })
    return jsonChatResponse(payload, { status: 403, origin })
  }

  const after = String(url.searchParams.get("after") || "").trim()
  const afterTime = after ? new Date(after).getTime() : null
  let messages = (await listChatMessages(chatId, { ascending: false, limit: afterTime ? 50 : limit }))
    .filter((message) => message.role === "assistant" || message.role === "user")
    .filter((message) => !afterTime || new Date(message.createdAt).getTime() > afterTime)
    .map(mapPublicChatMessage)

  if (!afterTime) {
    messages = messages.reverse()
  }

  const payload = { chatId, messages }
  recordJsonApiUsage({
    route: "/api/chat",
    method: "GET",
    status: 200,
    elapsedMs: Date.now() - startedAt,
    projectId: chat.projetoId,
    source: "public_chat_sync",
    payload,
  })
  return jsonChatResponse(payload, { status: 200, origin })
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
    const channelId = getIncomingWhatsAppChannelId(normalizedBody)
    const resolvedProjectAgent =
      normalizedBody?.canal === "whatsapp" && channelId
        ? await resolveProjectAgent(normalizedBody)
        : null
    const whatsappChannel =
      normalizedBody?.canal === "whatsapp" && channelId
        ? await getWhatsAppChannelById(channelId)
        : null
    const effectiveContext =
      normalizedBody?.canal === "whatsapp"
        ? buildWhatsAppContextWithSavedContactFlags(normalizedBody?.context, whatsappChannel)
        : normalizedBody?.context
    const effectiveBody =
      effectiveContext === normalizedBody?.context
        ? normalizedBody
        : {
            ...normalizedBody,
            context: effectiveContext,
          }

    if (effectiveBody?.canal === "whatsapp") {
      await recordWhatsAppSavedContactDiagnostic({
        context: effectiveBody?.context,
        whatsappChannel,
        resolvedProjectAgent,
        host,
        channelId,
      })
    }

    if (
      effectiveBody?.canal === "whatsapp" &&
      whatsappChannel?.onlyReplyToUnsavedContacts === true &&
      isSavedWhatsAppInboundContext(effectiveBody?.context, whatsappChannel)
    ) {
      await recordPublicChatEvent({
        event: "completed",
        origin,
        host,
        method: "POST",
        body: effectiveBody,
        status: 200,
        projectId: resolvedProjectAgent?.projeto?.id ?? null,
        chatId: effectiveBody.chatId ?? channelId,
        elapsedMs: Date.now() - startedAt,
        errorSource: null,
      })

      return jsonChatResponse(formatPublicChatResult(buildSilentChatResult(effectiveBody.chatId ?? channelId)), {
        status: 200,
        origin,
      })
    }

    const result = await processChatRequest(effectiveBody, {
      verificarLimite: verifyProjectBillingAccess,
      registrarUso: registerProjectBillingUsage,
      ...(adminAgentTestRuntime?.options ?? {}),
    })
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

    recordJsonApiUsage({
      route: "/api/chat",
      method: "POST",
      status: 200,
      elapsedMs: Date.now() - startedAt,
      projectId: result?.diagnostics?.projetoId ?? null,
      source: isAdminAgentTest ? "admin_agent_test" : normalizedBody?.canal || normalizedBody?.source || "public_chat",
      payload: responsePayload,
    })

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

    const payload = {
      error:
        error instanceof Error
          ? error.message
          : "Erro interno no chat",
    }
    recordJsonApiUsage({
      route: "/api/chat",
      method: "POST",
      status: 500,
      elapsedMs: Date.now() - startedAt,
      source: "public_chat",
      payload,
    })

    return jsonChatResponse(payload, { status: 500, origin })
  }
}
