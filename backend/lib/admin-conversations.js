import "server-only"

import { listChatHandoffsByChatIds } from "@/lib/chat-handoffs"
import { getChatAttachmentsMetadata, uploadChatAttachmentPayloads } from "@/lib/chat-attachments"
import { appendMessage, getChatById, listChatMessages, listLatestChatMessages } from "@/lib/chats"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function formatTime(value) {
  return new Date(value || Date.now()).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function mapRoleToAutor(role) {
  return role === "assistant" ? "atendente" : role === "system" ? "sistema" : "cliente"
}

export function buildAiObservability(metadata = {}, message = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const provider = typeof metadata.provider === "string" ? metadata.provider : null
  const routeStage = typeof metadata.routeStage === "string" ? metadata.routeStage : null
  const heuristicStage = typeof metadata.heuristicStage === "string" ? metadata.heuristicStage : null
  const domainStage = typeof metadata.domainStage === "string" ? metadata.domainStage : null
  const usageTelemetry =
    metadata.usageTelemetry && typeof metadata.usageTelemetry === "object" && !Array.isArray(metadata.usageTelemetry)
      ? metadata.usageTelemetry
      : null
  const runtimeApis = Array.isArray(metadata.runtimeApis) ? metadata.runtimeApis : []

  if (!provider && !routeStage && !heuristicStage && !domainStage && !usageTelemetry && !runtimeApis.length) {
    return null
  }

  return {
    stage: typeof metadata.stage === "string" ? metadata.stage : null,
    failClosed: metadata.failClosed === true,
    provider,
    model: typeof metadata.model === "string" ? metadata.model : null,
    agenteId: metadata.agenteId ?? null,
    agenteNome: metadata.agenteNome ?? null,
    widgetId: metadata.widgetId ?? null,
    widgetName: metadata.widgetName ?? null,
    widgetSlug: typeof metadata.widgetSlug === "string" ? metadata.widgetSlug : null,
    routeStage,
    heuristicStage,
    domainStage,
    handoffDecision: typeof metadata.handoffDecision === "string" ? metadata.handoffDecision : null,
    handoffReason: typeof metadata.handoffReason === "string" ? metadata.handoffReason : null,
    handoffRequested: metadata.handoffRequested === true,
    catalogoProdutoAtual: metadata.catalogoProdutoAtual ?? null,
    runtimeApiCount: metadata.runtimeApiCount ?? runtimeApis.length,
    runtimeApiCacheHits: metadata.runtimeApiCacheHits ?? runtimeApis.filter((item) => item?.cacheHit === true).length,
    runtimeApis: runtimeApis.map((item) => ({
      id: item?.id ?? null,
      nome: item?.nome ?? null,
      metodo: item?.metodo ?? null,
      cacheHit: item?.cacheHit === true,
    })),
    usage: {
      inputTokens: message.tokensInput ?? usageTelemetry?.inputTokens ?? null,
      outputTokens: message.tokensOutput ?? usageTelemetry?.outputTokens ?? null,
      totalTokens: usageTelemetry?.totalTokens ?? null,
      estimatedCostUsd: message.custo ?? usageTelemetry?.estimatedCostUsd ?? null,
      billingOrigin: usageTelemetry?.billingOrigin ?? null,
    },
    assetsCount: Array.isArray(metadata.assets) ? metadata.assets.length : 0,
    followUpReply: metadata.followUpReply === true,
  }
}

export function mapAdminConversationMessage(message) {
  const observability = message.role === "assistant" ? buildAiObservability(message.metadata, message) : null
  return {
    id: message.id,
    autor: mapRoleToAutor(message.role),
    texto: message.conteudo,
    horario: formatTime(message.createdAt),
    createdAt: message.createdAt,
    attachments: Array.isArray(message.metadata?.attachments) ? message.metadata.attachments : [],
    assets: Array.isArray(message.metadata?.assets) ? message.metadata.assets : [],
    actions: Array.isArray(message.metadata?.actions) ? message.metadata.actions : [],
    whatsapp: message.metadata?.whatsappCta ?? null,
    observability,
  }
}

async function loadMessagesForChat(chatId, options = {}) {
  const messages = await listChatMessages(chatId, options)
  return messages.map(mapAdminConversationMessage)
}

function mapConversationStatus(handoff) {
  const autoPauseActive = handoff?.metadata?.autoPause?.active === true
  return handoff?.status === "human"
    ? "humano"
    : autoPauseActive
      ? "pausado_loop"
      : handoff?.status === "pending_human"
        ? "pendente_humano"
        : "ia"
}

function loadHandoffFromMap(chatId, handoffsByChatId) {
  const handoff = handoffsByChatId.get(chatId) ?? null
  return {
    handoff,
    status: mapConversationStatus(handoff),
  }
}

async function listChatsByIds(chatIds) {
  const normalizedChatIds = Array.from(new Set((Array.isArray(chatIds) ? chatIds : []).filter(Boolean))).slice(0, 8)
  if (!normalizedChatIds.length) {
    return []
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("chats")
    .select(
      "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto"
    )
    .in("id", normalizedChatIds)

  if (error || !Array.isArray(data)) {
    if (error) {
      console.error("[admin-conversations] failed to load chats by ids", error)
    }
    return []
  }

  return normalizedChatIds
    .map((chatId) => data.find((item) => item.id === chatId))
    .filter(Boolean)
    .map((row) => ({
      id: row.id,
      titulo: row.titulo || "Nova conversa",
      contatoNome: row.contato_nome,
      contatoTelefone: row.contato_telefone,
      contatoAvatarUrl: row.contato_avatar_url,
      updatedAt: row.updated_at,
      canal: row.canal || "web",
      contexto: row.contexto ?? {},
      identificadorExterno: row.identificador_externo ?? null,
      projetoId: row.projeto_id ?? null,
    }))
}

function getScopedProjectIds(user) {
  if (user?.role === "admin") {
    return null
  }

  return user?.memberships?.map((item) => item.projetoId).filter(Boolean) ?? []
}

function canAccessConversation(user, chat) {
  if (user?.role === "admin") {
    return true
  }

  return Boolean(chat?.projetoId && user?.memberships?.some((item) => item.projetoId === chat.projetoId))
}

function normalizeConversationPhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  if (!digits) {
    return null
  }

  return digits.length > 11 ? digits.slice(-11) : digits
}

function buildConversationGroupKey(row) {
  const phoneKey = normalizeConversationPhone(row.contato_telefone || row.identificador_externo)
  if (phoneKey) {
    return `phone:${phoneKey}`
  }

  const nameKey = String(row.contato_nome || row.titulo || "")
    .trim()
    .toLowerCase()
  return nameKey ? `name:${nameKey}` : `chat:${row.id}`
}

export async function listAdminConversations(user) {
  try {
    const scopedProjectIds = getScopedProjectIds(user)
    if (Array.isArray(scopedProjectIds) && scopedProjectIds.length === 0) {
      return []
    }

    const supabase = getSupabaseAdminClient()
    let query = supabase
      .from("chats")
      .select(
        "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto, projeto:projetos(id, nome, slug)",
      )
      .neq("canal", "admin_agent_test")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(50)

    if (Array.isArray(scopedProjectIds)) {
      query = query.in("projeto_id", scopedProjectIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("[admin-conversations] failed to list chats", error)
      return []
    }

    const chatIds = data.map((row) => row.id)
    const [handoffsByChatId, latestMessagesByChatId] = await Promise.all([
      listChatHandoffsByChatIds(chatIds),
      listLatestChatMessages(chatIds, { perChatLimit: 1, batchSize: 200, maxRounds: 5 }),
    ])
    const hydratedRows = await Promise.all(
      data.map(async (row) => {
        const chat = {
          id: row.id,
          titulo: row.titulo || "Nova conversa",
          contatoNome: row.contato_nome,
          contatoTelefone: row.contato_telefone,
          contatoAvatarUrl: row.contato_avatar_url,
          updatedAt: row.updated_at,
          canal: row.canal || "web",
          contexto: row.contexto ?? {},
        }
        const mensagens = (latestMessagesByChatId.get(chat.id) ?? []).map(mapAdminConversationMessage)
        const handoff = loadHandoffFromMap(chat.id, handoffsByChatId)

        return { row, chat, mensagens, handoff }
      }),
    )

    const grouped = new Map()

    for (const item of hydratedRows) {
      const key = buildConversationGroupKey(item.row)
      const currentGroup = grouped.get(key)

      if (!currentGroup) {
        grouped.set(key, {
          primaryChatId: item.chat.id,
          cliente: {
            nome: item.chat.contatoNome || item.chat.titulo || "Cliente",
            telefone: item.chat.contatoTelefone || item.row.identificador_externo || "",
            avatarUrl: item.chat.contatoAvatarUrl || null,
          },
          projeto: {
            id: item.row.projeto_id ?? null,
            nome: Array.isArray(item.row.projeto) ? item.row.projeto[0]?.nome ?? null : item.row.projeto?.nome ?? null,
            slug: Array.isArray(item.row.projeto) ? item.row.projeto[0]?.slug ?? null : item.row.projeto?.slug ?? null,
          },
          origem: item.chat.canal === "whatsapp" ? "whatsapp" : "site",
          status: item.handoff.status,
          handoff: item.handoff.handoff,
          mensagens: [...item.mensagens],
          updatedAt: item.chat.updatedAt,
          chatIds: [item.chat.id],
        })
        continue
      }

      currentGroup.chatIds.push(item.chat.id)
      if (item.mensagens[0]) {
        currentGroup.mensagens = [item.mensagens[0]]
      }

      if (new Date(item.chat.updatedAt).getTime() >= new Date(currentGroup.updatedAt).getTime()) {
        currentGroup.primaryChatId = item.chat.id
        currentGroup.updatedAt = item.chat.updatedAt
        currentGroup.cliente = {
          nome: item.chat.contatoNome || item.chat.titulo || currentGroup.cliente.nome,
          telefone: item.chat.contatoTelefone || item.row.identificador_externo || currentGroup.cliente.telefone,
          avatarUrl: item.chat.contatoAvatarUrl || currentGroup.cliente.avatarUrl,
        }
        currentGroup.projeto = {
          id: item.row.projeto_id ?? currentGroup.projeto?.id ?? null,
          nome:
            (Array.isArray(item.row.projeto) ? item.row.projeto[0]?.nome ?? null : item.row.projeto?.nome ?? null) ||
            currentGroup.projeto?.nome ||
            null,
          slug:
            (Array.isArray(item.row.projeto) ? item.row.projeto[0]?.slug ?? null : item.row.projeto?.slug ?? null) ||
            currentGroup.projeto?.slug ||
            null,
        }
        currentGroup.handoff = item.handoff.handoff
      }

      if (item.chat.canal === "whatsapp") {
        currentGroup.origem = "whatsapp"
      }

      if (item.handoff.status === "humano") {
        currentGroup.status = "humano"
      } else if (currentGroup.status !== "humano" && item.handoff.status === "pausado_loop") {
        currentGroup.status = "pausado_loop"
      } else if (currentGroup.status !== "humano" && item.handoff.status === "pendente_humano") {
        currentGroup.status = "pendente_humano"
      }
    }

    return Array.from(grouped.values())
      .map((conversation) => ({
        id: conversation.primaryChatId,
        chatIds: conversation.chatIds,
        cliente: conversation.cliente,
        projeto: conversation.projeto ?? null,
        origem: conversation.origem,
        status: conversation.status,
        handoff: conversation.handoff,
        totalMensagens: conversation.chatIds.length,
        mensagens: conversation.mensagens.sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        ),
        updatedAt: conversation.updatedAt,
      }))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  } catch (error) {
    console.error("[admin-conversations] failed to list conversations", error)
    return []
  }
}

export async function getAdminConversationDetail(input, user) {
  const primaryChatId = String(input?.chatId || "").trim()
  if (!primaryChatId) {
    return null
  }

  const requestedChatIds = Array.isArray(input?.chatIds)
    ? input.chatIds.map((item) => String(item || "").trim()).filter(Boolean)
    : []
  const chatIds = Array.from(new Set([primaryChatId, ...requestedChatIds])).slice(0, 8)
  const handoffsByChatId = await listChatHandoffsByChatIds(chatIds)

  const chats = (
    await Promise.all(
      (await listChatsByIds(chatIds)).map(async (chat) => {
        if (!chat || !canAccessConversation(user, chat)) {
          return null
        }

        const mensagens = await loadMessagesForChat(chat.id, { limit: 80 })
        const handoff = loadHandoffFromMap(chat.id, handoffsByChatId)

        return { chat, mensagens, handoff }
      }),
    )
  ).filter(Boolean)

  if (!chats.length) {
    return null
  }

  const primaryChat = chats.find((item) => item.chat.id === primaryChatId) ?? chats[0]
  const mergedMessages = chats
    .flatMap((item) => item.mensagens)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())

  return {
    id: primaryChat.chat.id,
    chatIds: chats.map((item) => item.chat.id),
    cliente: {
      nome: primaryChat.chat.contatoNome || primaryChat.chat.titulo || "Cliente",
      telefone: primaryChat.chat.contatoTelefone || primaryChat.chat.identificadorExterno || "",
      avatarUrl: primaryChat.chat.contatoAvatarUrl || null,
    },
    projeto: null,
    origem: primaryChat.chat.canal === "whatsapp" ? "whatsapp" : "site",
    status: primaryChat.handoff.status,
    handoff: primaryChat.handoff.handoff,
    totalMensagens: mergedMessages.length,
    mensagens: mergedMessages,
    updatedAt: primaryChat.chat.updatedAt,
  }
}

export async function appendAdminConversationMessage(chatId, texto, attachments = [], user) {
  const chat = await getChatById(chatId)

  if (!chat) {
    return null
  }

  if (!canAccessConversation(user, chat)) {
    return false
  }

  const uploadedAttachments = await uploadChatAttachmentPayloads({
    projetoId: chat.projetoId ?? "admin",
    chatId,
    attachments: Array.isArray(attachments) ? attachments : [],
  })

  const content = String(texto ?? "").trim() || (uploadedAttachments.length ? "[Anexo enviado]" : "")
  if (!content) {
    return null
  }

  const message = await appendMessage({
    chatId,
    role: "assistant",
    conteudo: content,
    canal: chat.canal,
    identificadorExterno: chat.identificadorExterno,
    metadata: {
      source: "admin_attendance",
      manual: true,
      attachments: getChatAttachmentsMetadata(uploadedAttachments),
    },
  })

  return message ? mapAdminConversationMessage(message) : null
}

export function userCanAccessAdminConversation(user, chat) {
  return canAccessConversation(user, chat)
}
