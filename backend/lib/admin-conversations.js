import "server-only"

import { getChatHandoffByChatId } from "@/lib/chat-handoffs"
import { appendMessage, getChatById, listChatMessages } from "@/lib/chats"
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

  if (!provider && !routeStage && !heuristicStage && !domainStage && !usageTelemetry) {
    return null
  }

  return {
    provider,
    model: typeof metadata.model === "string" ? metadata.model : null,
    agenteId: metadata.agenteId ?? null,
    agenteNome: metadata.agenteNome ?? null,
    routeStage,
    heuristicStage,
    domainStage,
    catalogoProdutoAtual: metadata.catalogoProdutoAtual ?? null,
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
    observability,
  }
}

async function loadMessagesForChat(chatId) {
  const messages = await listChatMessages(chatId)
  return messages.map(mapAdminConversationMessage)
}

async function loadHandoff(chat) {
  const handoff = await getChatHandoffByChatId(chat.id)
  return {
    handoff,
    status: handoff?.status === "human" ? "humano" : handoff?.status === "pending_human" ? "pendente_humano" : "ia",
  }
}

export async function listAdminConversations() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("chats")
      .select(
        "id, titulo, contato_nome, contato_telefone, contato_avatar_url, status, created_at, updated_at, total_tokens, total_custo, agente_id, usuario_id, projeto_id, canal, identificador_externo, contexto",
      )
      .neq("canal", "admin_agent_test")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(50)

    if (error) {
      console.error("[admin-conversations] failed to list chats", error)
      return []
    }

    return Promise.all(
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
        const mensagens = await loadMessagesForChat(chat.id)
        const handoff = await loadHandoff(chat)

        return {
          id: chat.id,
          cliente: {
            nome: chat.contatoNome || chat.titulo || "Cliente",
            telefone: chat.contatoTelefone || row.identificador_externo || "",
            avatarUrl: chat.contatoAvatarUrl || null,
          },
          origem: chat.canal === "whatsapp" ? "whatsapp" : "site",
          status: handoff.status,
          handoff: handoff.handoff,
          mensagens,
          updatedAt: chat.updatedAt,
        }
      }),
    )
  } catch (error) {
    console.error("[admin-conversations] failed to list conversations", error)
    return []
  }
}

export async function appendAdminConversationMessage(chatId, texto, attachments = []) {
  const chat = await getChatById(chatId)

  if (!chat) {
    return null
  }

  const message = await appendMessage({
    chatId,
    role: "assistant",
    conteudo: texto,
    canal: chat.canal,
    identificadorExterno: chat.identificadorExterno,
    metadata: {
      source: "admin_attendance",
      manual: true,
      attachments: Array.isArray(attachments)
        ? attachments
            .map((item) => ({
              name: String(item.name || "arquivo").trim(),
              type: String(item.type || "application/octet-stream").trim(),
              size: Number(item.size || 0),
            }))
            .slice(0, 5)
        : [],
    },
  })

  return message ? mapAdminConversationMessage(message) : null
}
