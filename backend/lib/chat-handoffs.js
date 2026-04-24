import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const HUMAN_HANDOFF_IDLE_TIMEOUT_MS = 5 * 60 * 1000

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
  const metadata = handoff?.metadata && typeof handoff.metadata === "object" ? handoff.metadata : {}
  return handoff?.status === "human" || metadata?.autoPause?.active === true
}

function normalizeIsoTimestamp(value) {
  const raw = String(value || "").trim()
  if (!raw) {
    return null
  }

  const timestamp = new Date(raw)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}

function getHumanActivityTimestamp(handoff) {
  const metadata = handoff?.metadata && typeof handoff.metadata === "object" ? handoff.metadata : {}
  return (
    normalizeIsoTimestamp(metadata.lastHumanActivityAt) ??
    normalizeIsoTimestamp(handoff?.claimedAt) ??
    normalizeIsoTimestamp(handoff?.updatedAt) ??
    null
  )
}

export function isHumanHandoffExpired(handoff, now = Date.now()) {
  if (handoff?.status !== "human") {
    return false
  }

  const activityAt = getHumanActivityTimestamp(handoff)
  if (!activityAt) {
    return false
  }

  return now - new Date(activityAt).getTime() >= HUMAN_HANDOFF_IDLE_TIMEOUT_MS
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

export async function listChatHandoffsByChatIds(chatIds) {
  const normalizedChatIds = Array.from(
    new Set((Array.isArray(chatIds) ? chatIds : []).map((item) => String(item || "").trim()).filter(Boolean)),
  )

  if (!normalizedChatIds.length) {
    return new Map()
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.from("chat_handoffs").select("*").in("chat_id", normalizedChatIds)

  if (error || !Array.isArray(data)) {
    if (error) {
      console.error("[chat-handoffs] failed to load handoffs by chats", error)
    }
    return new Map()
  }

  return new Map(data.map((row) => [row.chat_id, mapChatHandoff(row)]))
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

export async function requestAutoPauseHandoff(input) {
  const current =
    (await ensureChatHandoff({
      chatId: input.chatId,
      projetoId: input.projetoId,
      canalWhatsappId: input.canalWhatsappId ?? null,
    })) ?? (await getChatHandoffByChatId(input.chatId))

  if (!current) {
    return null
  }

  const previousAutoPause =
    current.metadata?.autoPause && typeof current.metadata.autoPause === "object" ? current.metadata.autoPause : {}

  const next = await updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      projeto_id: input.projetoId ?? current.projetoId ?? null,
      canal_whatsapp_id: input.canalWhatsappId ?? current.canalWhatsappId ?? null,
      motivo: input.motivo?.trim() || current.motivo || "Conversa pausada automaticamente por suspeita de loop.",
      metadata: {
        ...(current.metadata ?? {}),
        autoPause: {
          ...previousAutoPause,
          active: true,
          reason: input.reason?.trim() || previousAutoPause.reason || "loop_detected",
          pausedAt: new Date().toISOString(),
          triggerMessage: input.triggerMessage?.trim() || previousAutoPause.triggerMessage || null,
          details: input.details ?? previousAutoPause.details ?? null,
        },
      },
    },
  })

  return next || current
}

export async function claimHumanHandoff(input) {
  const current =
    (await ensureChatHandoff({
      chatId: input.chatId,
      projetoId: input.projetoId,
      canalWhatsappId: input.canalWhatsappId ?? null,
    })) ?? (await getChatHandoffByChatId(input.chatId))

  if (!current) {
    return null
  }

  return updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      status: "human",
      claimed_by_usuario_id: input.usuarioId ?? null,
      claimed_at: new Date().toISOString(),
      released_by_usuario_id: null,
      released_at: null,
      metadata: {
        ...(current.metadata ?? {}),
        claimedBy: "admin",
        lastHumanActivityAt: new Date().toISOString(),
        autoPause: {
          ...(current.metadata?.autoPause ?? {}),
          active: false,
          resumedAt: new Date().toISOString(),
        },
      },
    },
  })
}

export async function touchHumanHandoff(input) {
  const current = await getChatHandoffByChatId(input.chatId)

  if (!current || current.status !== "human") {
    return current
  }

  return updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      metadata: {
        ...(current.metadata ?? {}),
        lastHumanActivityAt: new Date().toISOString(),
      },
    },
  })
}

export async function releaseHumanHandoff(input) {
  const current = await getChatHandoffByChatId(input.chatId)

  if (!current) {
    return null
  }

  return updateChatHandoffRecord({
    handoffId: current.id,
    patch: {
      status: "bot",
      released_by_usuario_id: input.usuarioId ?? null,
      released_at: new Date().toISOString(),
      metadata: {
        ...(current.metadata ?? {}),
        releasedBy: "admin",
        lastHumanActivityAt: null,
        autoReleasedAt: input.autoReleased === true ? new Date().toISOString() : current.metadata?.autoReleasedAt ?? null,
        autoPause: {
          ...(current.metadata?.autoPause ?? {}),
          active: false,
          resumedAt: new Date().toISOString(),
        },
      },
    },
  })
}
