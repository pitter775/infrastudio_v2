import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { saveWhatsAppHandoffContactForUser } from "@/lib/whatsapp-handoff-contatos"

const channelFields =
  "id, projeto_id, agente_id, numero, session_data, status, created_at, updated_at"
const TRANSIENT_CONNECTION_STATUSES = new Set(["connecting", "aguardando_qr", "reconnecting"])
const TRANSIENT_SESSION_FIELDS = new Set([
  "connectionStatus",
  "status",
  "clientStatus",
  "currentClientState",
  "clientState",
  "state",
  "notes",
  "lastError",
  "autoReconnectScheduled",
  "lastReconnectRequestAt",
  "reconnectAttempt",
  "workerUpdatedAt",
])
const AUTO_RECONNECT_REQUEST_INTERVAL_MS = 180_000
const WHATSAPP_SESSION_SYNC_MIN_INTERVAL_MS = 5_000

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
  const resolvedConnectionStatus = resolveWorkerSnapshotStatus(safePatch)
  const nestedFlags = resolveSavedContactFlags({
    ...safePatch,
    ...(rawContact ? { rawContact } : {}),
  })

  const nextPatch = {
    ...safePatch,
    ...(resolvedConnectionStatus ? { connectionStatus: resolvedConnectionStatus } : {}),
  }

  if (!nestedFlags) {
    return nextPatch
  }

  nextPatch.savedContactFlags = {
    ...(isPlainObject(safePatch.savedContactFlags) ? safePatch.savedContactFlags : {}),
    ...nestedFlags,
  }
  Object.assign(nextPatch, nestedFlags)

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

function sanitizeWorkerMessage(value) {
  const message = String(value || "").trim()
  if (!message) {
    return ""
  }

  const normalized = message.toLowerCase()

  if (
    normalized.includes("failed to launch the browser process") ||
    normalized.includes("zygote could not fork") ||
    normalized.includes("resource temporarily unavailable") ||
    normalized.includes("failed to connect to the bus") ||
    normalized.includes("pthread_create") ||
    normalized.includes("crashpad") ||
    normalized.includes("/sys/devices/system/cpu")
  ) {
    return "O worker do WhatsApp ficou sem recursos para abrir a sessão. Tente conectar novamente em alguns instantes."
  }

  if (normalized.includes("profile appears to be in use") || normalized.includes("chromium has locked the profile")) {
    return "A sessão do WhatsApp está temporariamente bloqueada por outro processo. Tente novamente em alguns instantes."
  }

  return message
}

function mapChannel(row) {
  const session = row.session_data && typeof row.session_data === "object" ? row.session_data : {}
  const savedContactFlags = resolveSavedContactFlags(session)
  const resolvedConnectionStatus = resolveWorkerSnapshotStatus(session) || "desconectado"

  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    number: row.numero || "",
    status: row.status || "ativo",
    connectionStatus: resolvedConnectionStatus,
    qrCodeDataUrl: session.qrCodeDataUrl || null,
    qrCodeText: session.qrCodeText || null,
    notes: sanitizeWorkerMessage(session.notes || ""),
    lastError: sanitizeWorkerMessage(session.lastError || ""),
    lastInboundAt: session.lastInboundAt || null,
    lastOutboundAt: session.lastOutboundAt || null,
    onlyReplyToUnsavedContacts:
      session.responseOnlyUnsavedContacts === true || session.onlyReplyToUnsavedContacts === true,
    manualDisconnect: session.manualDisconnect === true,
    autoReconnectScheduled: session.autoReconnectScheduled === true,
    reconnectAttempt: Number(session.reconnectAttempt || 0),
    terminalDisconnect: session.terminalDisconnect === true,
    savedContactFlags,
    sessionData: session,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sanitizeSessionForPersistence(sessionData) {
  if (!isPlainObject(sessionData)) {
    return {}
  }

  const nextSession = { ...sessionData }
  delete nextSession.qrCodeDataUrl
  delete nextSession.qrCodeText
  delete nextSession.reconnectDelayMs
  delete nextSession.updatedAt
  delete nextSession.status
  delete nextSession.resetSession

  const normalizedConnectionStatus = String(nextSession.connectionStatus || "")
    .trim()
    .toLowerCase()

  if (!normalizedConnectionStatus || TRANSIENT_CONNECTION_STATUSES.has(normalizedConnectionStatus)) {
    delete nextSession.connectionStatus
  }

  return nextSession
}

function buildStableSessionFingerprint(sessionData) {
  if (!isPlainObject(sessionData)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(sanitizeSessionForPersistence(sessionData))
      .filter(([key]) => !TRANSIENT_SESSION_FIELDS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
  )
}

function shouldPersistTransientSessionPatch(currentSession, normalizedPatch) {
  const nextConnectionStatus = String(normalizedPatch.connectionStatus || "").trim().toLowerCase()

  if (normalizedPatch.manualDisconnect === true || normalizedPatch.terminalDisconnect === true) {
    return true
  }

  if (isConnectedConnectionStatus(nextConnectionStatus) || isDisconnectedConnectionStatus(nextConnectionStatus)) {
    const currentConnectionStatus = String(currentSession?.connectionStatus || "").trim().toLowerCase()
    if (nextConnectionStatus && nextConnectionStatus !== currentConnectionStatus) {
      return true
    }
  }

  if (typeof normalizedPatch.lastError === "string" && normalizedPatch.lastError.trim()) {
    const currentLastError = String(currentSession?.lastError || "").trim()
    if (sanitizeWorkerMessage(normalizedPatch.lastError) !== sanitizeWorkerMessage(currentLastError)) {
      return true
    }
  }

  if (typeof normalizedPatch.notes === "string" && normalizedPatch.notes.trim()) {
    const currentNotes = String(currentSession?.notes || "").trim()
    if (sanitizeWorkerMessage(normalizedPatch.notes) !== sanitizeWorkerMessage(currentNotes)) {
      return true
    }
  }

  return false
}

export function shouldThrottleSessionSync(currentSession, normalizedPatch) {
  if (!isPlainObject(currentSession) || !isPlainObject(normalizedPatch)) {
    return false
  }

  if (shouldPersistTransientSessionPatch(currentSession, normalizedPatch)) {
    return false
  }

  const lastSyncAt = Date.parse(String(currentSession.workerUpdatedAt || currentSession.updatedAt || ""))
  if (!Number.isFinite(lastSyncAt)) {
    return false
  }

  return Date.now() - lastSyncAt < WHATSAPP_SESSION_SYNC_MIN_INTERVAL_MS
}

function resolveWorkerSnapshotStatus(snapshot) {
  if (!isPlainObject(snapshot)) {
    return ""
  }

  const candidates = [
    snapshot.connectionStatus,
    snapshot.status,
    snapshot.clientStatus,
    snapshot.currentClientState,
    snapshot.clientState,
    snapshot.state,
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim()
    if (normalized) {
      return normalized
    }
  }

  const notes = String(snapshot.notes || snapshot.message || "").trim()
  const statusMatch = notes.match(/estado atual do cliente:\s*([A-Z_]+)/i)
  return statusMatch?.[1] || ""
}

function areJsonObjectsEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function hasConnectedSessionEvidence(channel) {
  const sessionData = isPlainObject(channel?.sessionData) ? channel.sessionData : {}
  const notes = String(sessionData.notes || channel?.notes || "").trim().toLowerCase()

  if (isConnectedConnectionStatus(sessionData.connectionStatus || sessionData.status || channel?.connectionStatus)) {
    return true
  }

  if (sessionData.lastInboundAt || sessionData.lastOutboundAt) {
    return true
  }

  return ["connected", "conectado", "ready", "online"].some((token) => notes.includes(token))
}

function shouldAttemptAutoReconnect(channel, snapshot) {
  if (!channel?.id || !channel?.number || channel?.status !== "ativo") {
    return false
  }

  if (channel.manualDisconnect === true || channel.terminalDisconnect === true) {
    return false
  }

  if (!hasConnectedSessionEvidence(channel)) {
    return false
  }

  const runtimeStatus = resolveWorkerSnapshotStatus(snapshot)
  if (isConnectedConnectionStatus(runtimeStatus || channel.connectionStatus)) {
    return false
  }

  if (snapshot?.qrCodeDataUrl || snapshot?.qrCodeText) {
    return false
  }

  const lastReconnectRequestAt = Date.parse(String(channel.sessionData?.lastReconnectRequestAt || ""))
  if (Number.isFinite(lastReconnectRequestAt) && Date.now() - lastReconnectRequestAt < AUTO_RECONNECT_REQUEST_INTERVAL_MS) {
    return false
  }

  const normalizedRuntimeStatus = String(runtimeStatus || "").trim().toLowerCase()
  return ["", "connecting", "reconnecting", "offline", "desconectado"].includes(normalizedRuntimeStatus)
}

function mergeRuntimeSnapshotIntoChannel(channel, snapshot) {
  if (!channel || !isPlainObject(snapshot)) {
    return channel
  }

  const runtimeStatus = resolveWorkerSnapshotStatus(snapshot)

  return {
    ...channel,
    connectionStatus: runtimeStatus || channel.connectionStatus,
    qrCodeDataUrl: snapshot.qrCodeDataUrl || channel.qrCodeDataUrl || null,
    qrCodeText: snapshot.qrCodeText || channel.qrCodeText || null,
    notes: sanitizeWorkerMessage(snapshot.notes || channel.notes || ""),
    lastError: sanitizeWorkerMessage(snapshot.lastError || channel.lastError || ""),
  }
}

function shouldPersistWorkerNotes(snapshot, connectionStatus) {
  const notes = String(snapshot?.notes || "").trim()
  if (!notes) {
    return false
  }

  if (isConnectedConnectionStatus(connectionStatus) || isDisconnectedConnectionStatus(connectionStatus)) {
    return true
  }

  const normalized = notes.toLowerCase()
  return (
    normalized.includes("auth") ||
    normalized.includes("falha") ||
    normalized.includes("erro") ||
    normalized.includes("disconnect") ||
    normalized.includes("desconect")
  )
}

async function loadWorkerSnapshot(channelId) {
  if (!channelId) {
    return null
  }

  try {
    const data = await callWhatsAppWorker(`/status?channelId=${encodeURIComponent(channelId)}`)
    return isPlainObject(data)
      ? {
          ...data,
          status: resolveWorkerSnapshotStatus(data) || data.status || "",
        }
      : null
  } catch {
    return null
  }
}

function shouldLoadRuntimeSnapshot(channel, options = {}) {
  if (options.includeRuntimeSnapshot !== true) {
    return false
  }

  return Boolean(channel?.id)
}

function buildPersistableSnapshotPatch(snapshot) {
  if (!isPlainObject(snapshot)) {
    return null
  }

  const patch = {}
  const connectionStatus = resolveWorkerSnapshotStatus(snapshot)

  if (isConnectedConnectionStatus(connectionStatus) || isDisconnectedConnectionStatus(connectionStatus)) {
    patch.connectionStatus = connectionStatus
  }

  if (shouldPersistWorkerNotes(snapshot, connectionStatus)) {
    patch.notes = snapshot.notes
  }

  if (typeof snapshot.lastError === "string" && snapshot.lastError.trim()) {
    patch.lastError = snapshot.lastError
  }

  return Object.keys(patch).length ? patch : null
}

function buildRuntimeVerificationFallback(channel) {
  if (!channel?.id) {
    return null
  }

  return {
    status: "desconectado",
    notes: "Não foi possível confirmar uma sessão ativa do WhatsApp no worker nesta verificação.",
  }
}

async function reconcileChannelWithWorkerSnapshot(channel, snapshot) {
  if (shouldAttemptAutoReconnect(channel, snapshot)) {
    const reconnectAttempt = Number(channel.reconnectAttempt || channel.sessionData?.reconnectAttempt || 0) + 1
    const requestedAt = new Date().toISOString()

    try {
      const reconnectSnapshot = await callWhatsAppWorker("/connect", {
        method: "POST",
        body: JSON.stringify({
          channelId: channel.id,
          projetoId: channel.projetoId ?? null,
          agenteId: channel.agenteId ?? null,
          numero: channel.number ?? null,
          onlyReplyToUnsavedContacts: channel.onlyReplyToUnsavedContacts === true,
        }),
      })
      const reconnectPatch = {
        ...(buildPersistableSnapshotPatch(reconnectSnapshot) ?? {}),
        autoReconnectScheduled: !isConnectedConnectionStatus(resolveWorkerSnapshotStatus(reconnectSnapshot)),
        reconnectAttempt,
        lastReconnectRequestAt: requestedAt,
        ...((shouldPersistWorkerNotes(reconnectSnapshot, resolveWorkerSnapshotStatus(reconnectSnapshot)) ||
          !isConnectedConnectionStatus(resolveWorkerSnapshotStatus(reconnectSnapshot)))
          ? { notes: "Reconexao automatica solicitada ao worker." }
          : {}),
      }
      const reconnectedChannel = await updateWhatsAppChannelSession(channel.id, reconnectPatch)
      return mergeRuntimeSnapshotIntoChannel(reconnectedChannel ?? channel, reconnectSnapshot)
    } catch (error) {
      const failedChannel = await updateWhatsAppChannelSession(channel.id, {
        autoReconnectScheduled: false,
        reconnectAttempt,
        lastReconnectRequestAt: requestedAt,
        lastError: error?.message || "Não foi possível solicitar a reconexão automática do WhatsApp.",
      })
      return mergeRuntimeSnapshotIntoChannel(failedChannel ?? channel, {
        status: snapshot?.status || channel.connectionStatus,
        lastError: error?.message || "Não foi possível solicitar a reconexão automática do WhatsApp.",
      })
    }
  }

  const mergedChannel = mergeRuntimeSnapshotIntoChannel(channel, snapshot)
  const patch = buildPersistableSnapshotPatch(snapshot)

  if (!channel?.id || !patch) {
    return mergedChannel
  }

  return (await updateWhatsAppChannelSession(channel.id, patch)) ?? mergedChannel
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "")
}

function pickPrimaryChannelRow(rows, preferredAgentId = null) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) {
    return null
  }

  if (preferredAgentId) {
    const agentChannel = list.find((item) => item.agente_id === preferredAgentId)
    if (agentChannel) {
      return agentChannel
    }
  }

  return list[0]
}

async function cleanupExtraChannelsForProject(supabase, projectId, keepChannelId) {
  if (!projectId || !keepChannelId) {
    return
  }

  const { data, error } = await supabase.from("canais_whatsapp").select("id").eq("projeto_id", projectId)

  if (error || !data?.length) {
    if (error) {
      console.error("[whatsapp] failed to load channels for singleton cleanup", error)
    }
    return
  }

  const duplicateIds = data.map((item) => item.id).filter((id) => id && id !== keepChannelId)
  if (!duplicateIds.length) {
    return
  }

  const { error: contactsError } = await supabase
    .from("whatsapp_handoff_contatos")
    .update({ canal_whatsapp_id: keepChannelId, updated_at: new Date().toISOString() })
    .in("canal_whatsapp_id", duplicateIds)

  if (contactsError) {
    console.error("[whatsapp] failed to rebind attendant contacts during cleanup", contactsError)
  }

  const { error: deleteError } = await supabase.from("canais_whatsapp").delete().in("id", duplicateIds)

  if (deleteError) {
    console.error("[whatsapp] failed to delete extra channels", deleteError)
  }
}

export function getWhatsAppWorkerBaseUrl() {
  return (
    process.env.WHATSAPP_WORKER_URL?.trim() ||
    process.env.WHATSAPP_SERVICE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL?.trim() ||
    ""
  )
}

export async function listWhatsAppChannelsForUser(project, user, options = {}) {
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

    const primaryChannel = pickPrimaryChannelRow(data, project.agent?.id || null)
    if (!primaryChannel) {
      return []
    }

    await cleanupExtraChannelsForProject(supabase, project.id, primaryChannel.id)
    const mappedChannel = mapChannel(primaryChannel)
    if (!shouldLoadRuntimeSnapshot(mappedChannel, options)) {
      return [mappedChannel]
    }

    const workerSnapshot = await loadWorkerSnapshot(mappedChannel.id)
    if (!workerSnapshot) {
      const fallbackSnapshot = buildRuntimeVerificationFallback(mappedChannel)
      if (!fallbackSnapshot) {
        return [mappedChannel]
      }

      const refreshedChannel = await updateWhatsAppChannelSession(mappedChannel.id, fallbackSnapshot)
      return [refreshedChannel ?? mergeRuntimeSnapshotIntoChannel(mappedChannel, fallbackSnapshot)]
    }

    return [await reconcileChannelWithWorkerSnapshot(mappedChannel, workerSnapshot)]
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
    return { channel: null, error: "Número de WhatsApp inválido." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const agenteId = input.agenteId === null ? null : input.agenteId || project.agent?.id || null
    const { data: existingRows, error: existingError } = await supabase
      .from("canais_whatsapp")
      .select(channelFields)
      .eq("projeto_id", project.id)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (existingError) {
      console.error("[whatsapp] failed to load existing channels before save", existingError)
      return { channel: null, error: "Não foi possível salvar o canal." }
    }

    const primaryChannel = pickPrimaryChannelRow(existingRows, agenteId)
    const payload = {
      projeto_id: project.id,
      agente_id: agenteId,
      numero: number,
      status: input.status === "inativo" ? "inativo" : "ativo",
      session_data: {
        ...(primaryChannel?.session_data && typeof primaryChannel.session_data === "object" ? primaryChannel.session_data : {}),
        connectionStatus: primaryChannel?.session_data?.connectionStatus || "desconectado",
        notes: primaryChannel?.session_data?.notes || "Canal criado no v2.",
      },
      updated_at: new Date().toISOString(),
    }

    const query = primaryChannel?.id
      ? supabase.from("canais_whatsapp").update(payload).eq("id", primaryChannel.id).eq("projeto_id", project.id)
      : supabase.from("canais_whatsapp").insert(payload)

    const { data, error } = await query.select(channelFields).maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[whatsapp] failed to create channel", error)
      }
      return { channel: null, error: "Não foi possível criar o canal." }
    }

    const channel = mapChannel(data)
    await cleanupExtraChannelsForProject(supabase, project.id, channel.id)
    const existingContact = await supabase
      .from("whatsapp_handoff_contatos")
      .select("id")
      .eq("projeto_id", project.id)
      .eq("numero", number)
      .limit(1)
      .maybeSingle()

    let contact = null

    if (!existingContact.data?.id) {
      const preferredAttendantName =
        project.agent?.name?.trim() ||
        project.agent?.nome?.trim() ||
        `Atendente ${project.name?.trim() || "WhatsApp"}`
      const createdContact = await saveWhatsAppHandoffContactForUser(
        project,
        {
          nome: preferredAttendantName,
          numero: number,
          papel: "Atendimento",
          observacoes: "Criado automaticamente junto com o canal do WhatsApp.",
          ativo: true,
          receberAlertas: true,
          canalWhatsappId: channel.id,
        },
        user,
      )

      contact = createdContact.contact ?? null
    }

    return { channel, contact, error: null }
  } catch (error) {
    console.error("[whatsapp] failed to create channel", error)
    return { channel: null, error: "Não foi possível criar o canal." }
  }
}

export async function getWhatsAppChannelForUser(channelId, project, user, options = {}) {
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

    const mappedChannel = mapChannel(data)
    if (!shouldLoadRuntimeSnapshot(mappedChannel, options)) {
      return mappedChannel
    }

    const workerSnapshot = await loadWorkerSnapshot(mappedChannel.id)
    return await reconcileChannelWithWorkerSnapshot(mappedChannel, workerSnapshot)
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

    await cleanupExtraChannelsForProject(supabase, projectId, data.id)
    const mappedChannel = mapChannel(data)
    if (!shouldLoadRuntimeSnapshot(mappedChannel, deps)) {
      return mappedChannel
    }

    const workerSnapshot = await loadWorkerSnapshot(mappedChannel.id)
    return await reconcileChannelWithWorkerSnapshot(mappedChannel, workerSnapshot)
  } catch (error) {
    console.error("[whatsapp] failed to load primary project channel", error)
    return null
  }
}

function isConnectedConnectionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return ["online", "connected", "conectado", "ready", "ativo"].includes(normalized)
}

function isDisconnectedConnectionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return ["offline", "desconectado"].includes(normalized)
}

function shouldKeepChannelActive(sessionData) {
  if (!isPlainObject(sessionData)) {
    return true
  }

  const connectionStatus = String(sessionData.connectionStatus || sessionData.status || "").trim().toLowerCase()

  if (isConnectedConnectionStatus(connectionStatus)) {
    return true
  }

  if (["connecting", "aguardando_qr", "reconnecting"].includes(connectionStatus)) {
    return true
  }

  if (isDisconnectedConnectionStatus(connectionStatus)) {
    if (sessionData.manualDisconnect === true || sessionData.terminalDisconnect === true) {
      return false
    }

    return sessionData.autoReconnectScheduled === true
  }

  return true
}

export async function getActiveWhatsAppChannelByProjectAgent(input, deps = {}) {
  if (!input?.projetoId) {
    return null
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const selectFields = "id, projeto_id, agente_id, numero, session_data, status, updated_at"
    let query = supabase
      .from("canais_whatsapp")
      .select(selectFields)
      .eq("projeto_id", input.projetoId)
      .eq("status", "ativo")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(4)

    if (input.agenteId) {
      query = query.or(`agente_id.eq.${input.agenteId},agente_id.is.null`)
    }

    const { data, error } = await query

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
      return { channel: null, error: "Canal não encontrado." }
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
      return { channel: null, error: "Não foi possível atualizar o canal." }
    }

    const channel = mapChannel(data)

    try {
      await syncWhatsAppWorkerChannelConfig(channel)
    } catch (error) {
      console.error("[whatsapp] failed to sync worker channel config", error)
      return { channel: null, error: "Canal atualizado no banco, mas o worker não recebeu a configuração." }
    }

    return { channel, error: null }
  } catch (error) {
    console.error("[whatsapp] failed to update channel", error)
    return { channel: null, error: "Não foi possível atualizar o canal." }
  }
}

export async function deleteWhatsAppChannelForUser(channelId, project, user) {
  if (!channelId || !project?.id || !userCanAccessProject(user, project.id)) {
    return { ok: false, error: "Acesso negado." }
  }

  try {
    try {
      await callWhatsAppWorker("/purge", {
        method: "POST",
        body: JSON.stringify({ channelId }),
      })
    } catch (error) {
      console.error("[whatsapp] failed to purge worker session before delete", error)
    }

    const supabase = getSupabaseAdminClient()
    await supabase
      .from("whatsapp_handoff_contatos")
      .update({ canal_whatsapp_id: null, updated_at: new Date().toISOString() })
      .eq("projeto_id", project.id)
      .eq("canal_whatsapp_id", channelId)
    const { error } = await supabase.from("canais_whatsapp").delete().eq("id", channelId).eq("projeto_id", project.id)

    if (error) {
      console.error("[whatsapp] failed to delete channel", error)
      return { ok: false, error: "Não foi possível remover o WhatsApp." }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error("[whatsapp] failed to delete channel", error)
    return { ok: false, error: "Não foi possível remover o WhatsApp." }
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
    const shouldResetSession = normalizedPatch.resetSession === true

    if (!shouldResetSession && shouldThrottleSessionSync(session, normalizedPatch)) {
      return mergeRuntimeSnapshotIntoChannel(mapChannel(current), normalizedPatch)
    }

    const nextSession = shouldResetSession
      ? {}
      : {
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
        }
    if (!shouldResetSession) {
      nextSession.workerUpdatedAt = new Date().toISOString()
    }
    const nextStatus = shouldKeepChannelActive(nextSession) ? "ativo" : "inativo"
    const persistedSession = sanitizeSessionForPersistence(nextSession)
    const currentPersistedSession = sanitizeSessionForPersistence(session)
    const stableSessionChanged = !areJsonObjectsEqual(
      buildStableSessionFingerprint(persistedSession),
      buildStableSessionFingerprint(currentPersistedSession)
    )
    const shouldPersistTransient = shouldPersistTransientSessionPatch(session, normalizedPatch)

    if (
      nextStatus === current.status &&
      !stableSessionChanged &&
      !shouldPersistTransient &&
      areJsonObjectsEqual(persistedSession, currentPersistedSession)
    ) {
      return mergeRuntimeSnapshotIntoChannel(mapChannel(current), normalizedPatch)
    }

    if (nextStatus === current.status && !stableSessionChanged && !shouldPersistTransient) {
      return mergeRuntimeSnapshotIntoChannel(mapChannel(current), normalizedPatch)
    }

    const { data, error } = await supabase
      .from("canais_whatsapp")
      .update({
        session_data: persistedSession,
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

    return mergeRuntimeSnapshotIntoChannel(mapChannel(data), normalizedPatch)
  } catch (error) {
    console.error("[whatsapp] failed to update channel session", error)
    return null
  }
}

export async function callWhatsAppWorker(path, init = {}) {
  const baseUrl = getWhatsAppWorkerBaseUrl()
  if (!baseUrl) {
    throw new Error("Worker do WhatsApp não configurado.")
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(sanitizeWorkerMessage(data.error || `Worker WhatsApp retornou ${response.status}.`))
  }

  if (isPlainObject(data)) {
    return {
      ...data,
      ...(typeof data.error === "string" ? { error: sanitizeWorkerMessage(data.error) } : {}),
      ...(typeof data.lastError === "string" ? { lastError: sanitizeWorkerMessage(data.lastError) } : {}),
      ...(typeof data.notes === "string" ? { notes: sanitizeWorkerMessage(data.notes) } : {}),
    }
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
    return { ok: false, error: "Parâmetros inválidos para envio de WhatsApp." }
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
      error: error?.message || "Não foi possível enviar a mensagem de WhatsApp.",
      snapshot: null,
    }
  }
}
