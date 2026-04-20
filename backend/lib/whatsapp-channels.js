import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const channelFields =
  "id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at"

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function pickBooleanCandidate(...values) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value
    }
  }

  return null
}

export function resolveSavedContactFlags(sessionData) {
  if (!isPlainObject(sessionData)) {
    return null
  }

  const savedContactFlags = isPlainObject(sessionData.savedContactFlags) ? sessionData.savedContactFlags : null
  const rawContact = isPlainObject(sessionData.rawContact) ? sessionData.rawContact : null
  const isSavedContact = pickBooleanCandidate(
    sessionData.isSavedContact,
    savedContactFlags?.isSavedContact,
    rawContact?.isSavedContact
  )
  const isMyContact = pickBooleanCandidate(
    sessionData.isMyContact,
    savedContactFlags?.isMyContact,
    rawContact?.isMyContact
  )
  const isSaved = pickBooleanCandidate(
    sessionData.isSaved,
    savedContactFlags?.isSaved,
    rawContact?.isSaved
  )

  if (isSavedContact === null && isMyContact === null && isSaved === null) {
    return null
  }

  return {
    ...(isSavedContact !== null ? { isSavedContact } : {}),
    ...(isMyContact !== null ? { isMyContact } : {}),
    ...(isSaved !== null ? { isSaved } : {}),
  }
}

function normalizeSessionPatch(patch) {
  const safePatch = isPlainObject(patch) ? { ...patch } : {}
  const rawContact = isPlainObject(safePatch.rawContact) ? { ...safePatch.rawContact } : null
  const nestedFlags = resolveSavedContactFlags({
    ...safePatch,
    ...(rawContact ? { rawContact } : {}),
  })

  if (!nestedFlags) {
    return safePatch
  }

  const nextPatch = {
    ...safePatch,
    savedContactFlags: {
      ...(isPlainObject(safePatch.savedContactFlags) ? safePatch.savedContactFlags : {}),
      ...nestedFlags,
    },
    ...nestedFlags,
  }

  if (rawContact) {
    nextPatch.rawContact = {
      ...rawContact,
      ...nestedFlags,
    }
  }

  return nextPatch
}

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function mapChannel(row) {
  const session = row.session_data && typeof row.session_data === "object" ? row.session_data : {}
  const savedContactFlags = resolveSavedContactFlags(session)

  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    number: row.numero || "",
    status: row.status || "ativo",
    connectionStatus: session.connectionStatus || session.status || "desconectado",
    qrCodeDataUrl: session.qrCodeDataUrl || null,
    qrCodeText: session.qrCodeText || null,
    notes: session.notes || "",
    lastError: session.lastError || "",
    lastInboundAt: session.lastInboundAt || null,
    lastOutboundAt: session.lastOutboundAt || null,
    onlyReplyToUnsavedContacts:
      session.responseOnlyUnsavedContacts === true || session.onlyReplyToUnsavedContacts === true,
    savedContactFlags,
    sessionData: session,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "")
}

export function getWhatsAppWorkerBaseUrl() {
  return process.env.WHATSAPP_WORKER_URL?.trim() || process.env.WHATSAPP_SERVICE_URL?.trim() || "http://localhost:3010"
}

export async function listWhatsAppChannelsForUser(project, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("projeto_id", project.id)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("[whatsapp] failed to list channels", error)
      return []
    }

    return data.map(mapChannel)
  } catch (error) {
    console.error("[whatsapp] failed to list channels", error)
    return []
  }
}

export async function createWhatsAppChannelForUser(project, input, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { channel: null, error: "Acesso negado." }
  }

  const number = normalizePhone(input.numero || input.number)
  if (number.length < 10) {
    return { channel: null, error: "Numero de WhatsApp invalido." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("canais_whatsapp")
      .insert({
        projeto_id: project.id,
        agente_id: input.agenteId === null ? null : input.agenteId || project.agent?.id || null,
        numero: number,
        status: input.status === "inativo" ? "inativo" : "ativo",
        session_data: {
          connectionStatus: "desconectado",
          notes: "Canal criado no v2.",
        },
      })
      .select(channelFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to create channel", error)
      }
      return { channel: null, error: "Nao foi possivel criar o canal." }
    }

    return { channel: mapChannel(data), error: null }
  } catch (error) {
    console.error("[whatsapp] failed to create channel", error)
    return { channel: null, error: "Nao foi possivel criar o canal." }
  }
}

export async function getWhatsAppChannelForUser(channelId, project, user) {
  if (!channelId || !project?.id || !userCanAccessProject(user, project.id)) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("id", channelId)
      .eq("projeto_id", project.id)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to get channel", error)
      }
      return null
    }

    return mapChannel(data)
  } catch (error) {
    console.error("[whatsapp] failed to get channel", error)
    return null
  }
}

export async function getPrimaryWhatsAppChannelByProjectId(projectId, deps = {}) {
  if (!projectId) {
    return null
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("projeto_id", projectId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to load primary project channel", error)
      }
      return null
    }

    return mapChannel(data)
  } catch (error) {
    console.error("[whatsapp] failed to load primary project channel", error)
    return null
  }
}

function isConnectedConnectionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return ["online", "connected", "conectado", "ready", "ativo"].includes(normalized)
}

export async function getActiveWhatsAppChannelByProjectAgent(input, deps = {}) {
  if (!input?.projetoId || !input?.agenteId) {
    return null
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("projeto_id", input.projetoId)
      .eq("agente_id", input.agenteId)
      .eq("status", "ativo")
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error || !Array.isArray(data)) {
      if (error) {
        console.error("[whatsapp] failed to load active agent channel", error)
      }
      return null
    }

    const connectedChannel = data
      .map(mapChannel)
      .find((channel) => channel.number && isConnectedConnectionStatus(channel.connectionStatus))

    return connectedChannel ?? null
  } catch (error) {
    console.error("[whatsapp] failed to load active agent channel", error)
    return null
  }
}

export async function getWhatsAppChannelById(channelId, deps = {}) {
  if (!channelId) {
    return null
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("id", channelId)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to load channel by id", error)
      }
      return null
    }

    return mapChannel(data)
  } catch (error) {
    console.error("[whatsapp] failed to load channel by id", error)
    return null
  }
}

export async function updateWhatsAppChannelForUser(channelId, project, input, user) {
  if (!channelId || !project?.id || !userCanAccessProject(user, project.id)) {
    return { channel: null, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: current, error: currentError } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("id", channelId)
      .eq("projeto_id", project.id)
      .maybeSingle()

    if (currentError || !current) {
      if (currentError) {
        console.error("[whatsapp] failed to load channel for update", currentError)
      }
      return { channel: null, error: "Canal nao encontrado." }
    }

    const session = current.session_data && typeof current.session_data === "object" ? current.session_data : {}
    const nextSession = { ...session }

    if (typeof input.onlyReplyToUnsavedContacts === "boolean") {
      nextSession.responseOnlyUnsavedContacts = input.onlyReplyToUnsavedContacts
      nextSession.onlyReplyToUnsavedContacts = input.onlyReplyToUnsavedContacts
    }

    const { data, error } = await supabase
      .from("canais_whatsapp")
      .update({
        session_data: nextSession,
        updated_at: new Date().toISOString(),
      })
      .eq("id", channelId)
      .eq("projeto_id", project.id)
      .select(channelFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to update channel", error)
      }
      return { channel: null, error: "Nao foi possivel atualizar o canal." }
    }

    const channel = mapChannel(data)

    try {
      await syncWhatsAppWorkerChannelConfig(channel)
    } catch (error) {
      console.error("[whatsapp] failed to sync worker channel config", error)
      return { channel: null, error: "Canal atualizado no banco, mas o worker nao recebeu a configuracao." }
    }

    return { channel, error: null }
  } catch (error) {
    console.error("[whatsapp] failed to update channel", error)
    return { channel: null, error: "Nao foi possivel atualizar o canal." }
  }
}

export async function deleteWhatsAppChannelForUser(channelId, project, user) {
  if (!channelId || !project?.id || !userCanAccessProject(user, project.id)) {
    return { ok: false, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    await supabase.from("whatsapp_handoff_contatos").delete().eq("canal_whatsapp_id", channelId)
    const { error } = await supabase.from("canais_whatsapp").delete().eq("id", channelId).eq("projeto_id", project.id)

    if (error) {
      console.error("[whatsapp] failed to delete channel", error)
      return { ok: false, error: "Nao foi possivel remover o WhatsApp." }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error("[whatsapp] failed to delete channel", error)
    return { ok: false, error: "Nao foi possivel remover o WhatsApp." }
  }
}

export async function updateWhatsAppChannelSession(channelId, patch) {
  if (!channelId) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: current, error: currentError } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("id", channelId)
      .maybeSingle()

    if (currentError || !current) {
      if (currentError) {
        console.error("[whatsapp] failed to load channel for session update", currentError)
      }
      return null
    }

    const session = current.session_data && typeof current.session_data === "object" ? current.session_data : {}
    const normalizedPatch = normalizeSessionPatch(patch)
    const nextSession = {
      ...session,
      ...normalizedPatch,
      ...(isPlainObject(session.savedContactFlags) || isPlainObject(normalizedPatch.savedContactFlags)
        ? {
            savedContactFlags: {
              ...(isPlainObject(session.savedContactFlags) ? session.savedContactFlags : {}),
              ...(isPlainObject(normalizedPatch.savedContactFlags) ? normalizedPatch.savedContactFlags : {}),
            },
          }
        : {}),
      updatedAt: new Date().toISOString(),
    }
    const nextStatus =
      normalizedPatch.connectionStatus === "offline" || normalizedPatch.connectionStatus === "desconectado"
        ? "inativo"
        : "ativo"

    const { data, error } = await supabase
      .from("canais_whatsapp")
      .update({
        session_data: nextSession,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", channelId)
      .select(channelFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to update channel session", error)
      }
      return null
    }

    return mapChannel(data)
  } catch (error) {
    console.error("[whatsapp] failed to update channel session", error)
    return null
  }
}

export async function callWhatsAppWorker(path, init = {}) {
  const baseUrl = getWhatsAppWorkerBaseUrl()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || `Worker WhatsApp retornou ${response.status}.`)
  }

  return data
}

async function syncWhatsAppWorkerChannelConfig(channel) {
  if (!channel?.id) {
    return null
  }

  return callWhatsAppWorker("/channel-config", {
    method: "POST",
    body: JSON.stringify({
      channelId: channel.id,
      projetoId: channel.projetoId ?? null,
      agenteId: channel.agenteId ?? null,
      numero: channel.number ?? null,
      onlyReplyToUnsavedContacts: channel.onlyReplyToUnsavedContacts === true,
    }),
  })
}

export async function sendWhatsAppTextMessage(input) {
  const channelId = String(input?.channelId || "").trim()
  const to = normalizePhone(input?.to)
  const message = String(input?.message || "").trim()

  if (!channelId || to.length < 12 || !message) {
    return { ok: false, error: "Parametros invalidos para envio de WhatsApp." }
  }

  try {
    const snapshot = await callWhatsAppWorker("/send", {
      method: "POST",
      body: JSON.stringify({
        channelId,
        to,
        message,
      }),
    })

    return {
      ok: true,
      error: null,
      snapshot,
    }
  } catch (error) {
    console.error("[whatsapp] failed to send outbound text", error)
    return {
      ok: false,
      error: error?.message || "Nao foi possivel enviar a mensagem de WhatsApp.",
      snapshot: null,
    }
  }
}
