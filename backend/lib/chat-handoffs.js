import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function mapChatHandoff(row) {
  return {
    id: row.id,
    chatId: row.chat_id,
    projetoId: row.projeto_id,
    canalWhatsappId: row.canal_whatsapp_id ?? null,
    status: row.status,
    motivo: row.motivo?.trim() || null,
    requestedBy: row.requested_by,
    requestedByUsuarioId: row.requested_by_usuario_id ?? null,
    claimedByUsuarioId: row.claimed_by_usuario_id ?? null,
    releasedByUsuarioId: row.released_by_usuario_id ?? null,
    requestedAt: row.requested_at ?? new Date().toISOString(),
    claimedAt: row.claimed_at ?? null,
    releasedAt: row.released_at ?? null,
    lastAlertAt: row.last_alert_at ?? null,
    alertMessage: row.alert_message?.trim() || null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

export function shouldPauseAssistantForHandoff(handoff) {
  return handoff?.status === "human"
}

export async function getChatHandoffByChatId(chatId) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("chat_handoffs")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle()

  if (error) {
    console.error("[chat-handoffs] failed to load handoff by chat", error)
    return null
  }

  return data ? mapChatHandoff(data) : null
}

async function ensureChatHandoff(input) {
  const existing = await getChatHandoffByChatId(input.chatId)
  if (existing) {
    return existing
  }

  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("chat_handoffs")
    .insert({
      chat_id: input.chatId,
      projeto_id: input.projetoId,
      canal_whatsapp_id: input.canalWhatsappId ?? null,
      status: "bot",
      requested_by: "system",
      requested_at: now,
      metadata: {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("[chat-handoffs] failed to ensure handoff", error)
    return existing
  }

  return mapChatHandoff(data)
}

async function updateChatHandoffRecord(input) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("chat_handoffs")
    .update({
      ...input.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.handoffId)
    .select("*")
    .single()

  if (error || !data) {
    console.error("[chat-handoffs] failed to update handoff", error)
    return null
  }

  return mapChatHandoff(data)
}

export async function requestHumanHandoff(input) {
  const current =
    (await ensureChatHandoff({
      chatId: input.chatId,
      projetoId: input.projetoId,
      canalWhatsappId: input.canalWhatsappId ?? null,
    })) ?? (await getChatHandoffByChatId(input.chatId))

  if (!current) {
    return null
  }

  const next = await updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      projeto_id: input.projetoId,
      canal_whatsapp_id: input.canalWhatsappId ?? current.canalWhatsappId ?? null,
      status: current.status === "human" ? "human" : "pending_human",
      motivo: input.motivo?.trim() || current.motivo || null,
      requested_by: input.requestedBy ?? "agent",
      requested_by_usuario_id: input.requestedByUsuarioId ?? null,
      requested_at: new Date().toISOString(),
      last_alert_at: new Date().toISOString(),
      alert_message: input.alertMessage?.trim() || current.alertMessage || null,
      metadata: {
        ...(current.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    },
  })

  return next || current
}
