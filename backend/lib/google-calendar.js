import "server-only"

import crypto from "crypto"
import { SignJWT, jwtVerify } from "jose"

import { createLogEntry } from "@/lib/logs"
import { canManageProject } from "@/lib/projetos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const CONNECTION_FIELDS =
  "id, projeto_id, agente_id, google_account_email, calendar_id, calendar_name, access_token, refresh_token, expires_at, status, configuracoes, created_at, updated_at"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]

function normalizeText(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function getAppAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("APP_AUTH_SECRET não configurado.")
  }

  return new TextEncoder().encode(secret)
}

function getOAuthConfig(origin) {
  const appUrl =
    origin?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${appUrl.replace(/\/+$/, "")}/api/google-calendar/oauth/callback`

  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || "",
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || "",
    redirectUri,
  }
}

function getEncryptionKey() {
  const secret = process.env.APP_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("APP_AUTH_SECRET não configurado.")
  }

  return crypto.createHash("sha256").update(secret).digest()
}

function encryptSecret(value) {
  const text = normalizeText(value)
  if (!text) return ""
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `gcal:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`
}

function decryptSecret(value) {
  const text = normalizeText(value)
  if (!text) return ""
  if (!text.startsWith("gcal:v1:")) return text

  const [, , ivValue, tagValue, encryptedValue] = text.split(":")
  if (!ivValue || !tagValue || !encryptedValue) return ""

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"))
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

function normalizeConfig(input = {}) {
  const durationMinutes = Math.max(15, Math.min(480, Number(input.durationMinutes || input.duracaoMinutos || 60)))
  const minimumNoticeMinutes = Math.max(0, Math.min(10080, Number(input.minimumNoticeMinutes || 60)))
  const timezone = normalizeText(input.timezone) || "America/Sao_Paulo"
  const allowedDays = Array.isArray(input.allowedDays)
    ? input.allowedDays.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
    : [1, 2, 3, 4, 5]

  return {
    durationMinutes,
    minimumNoticeMinutes,
    timezone,
    allowedDays,
    allowedStartTime: normalizeText(input.allowedStartTime) || "09:00",
    allowedEndTime: normalizeText(input.allowedEndTime) || "18:00",
    sendInvite: input.sendInvite !== false,
    eventSummaryTemplate: normalizeText(input.eventSummaryTemplate) || "Atendimento via InfraStudio",
    eventDescriptionTemplate:
      normalizeText(input.eventDescriptionTemplate) ||
      "Evento criado automaticamente pelo agente da InfraStudio.",
  }
}

function mapConnection(row, { includeTokens = false } = {}) {
  if (!row) return null

  const mapped = {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    googleAccountEmail: row.google_account_email || "",
    calendarId: row.calendar_id || "",
    calendarName: row.calendar_name || "",
    status: row.status || "disconnected",
    configuracoes: normalizeConfig(row.configuracoes || {}),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  if (includeTokens) {
    mapped.accessToken = decryptSecret(row.access_token)
    mapped.refreshToken = decryptSecret(row.refresh_token)
  }

  return mapped
}

async function signOAuthState(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAppAuthSecret())
}

async function verifyOAuthState(token) {
  const { payload } = await jwtVerify(token, getAppAuthSecret())
  return {
    projetoId: normalizeText(payload.projetoId),
    agenteId: normalizeText(payload.agenteId) || null,
    userId: normalizeText(payload.userId) || null,
    returnPath: normalizeText(payload.returnPath) || "",
  }
}

async function loadConnectionRow({ projetoId, agenteId = null, supabase = getSupabaseAdminClient() }) {
  let query = supabase
    .from("google_calendar_connections")
    .select(CONNECTION_FIELDS)
    .eq("projeto_id", projetoId)
    .limit(1)

  query = agenteId ? query.eq("agente_id", agenteId) : query.is("agente_id", null)

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export async function getGoogleCalendarConnectionForUser({ user, projetoId, agenteId = null }) {
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { connection: null, error: "Acesso negado." }
  }

  const row = await loadConnectionRow({ projetoId, agenteId })
  return { connection: mapConnection(row), error: null }
}

export async function getGoogleCalendarConnectionForRuntime({ projetoId, agenteId = null }) {
  if (!projetoId) {
    return null
  }

  const row = await loadConnectionRow({ projetoId, agenteId })
  return mapConnection(row)
}

export async function buildGoogleCalendarAuthorizationUrl({ project, user, origin }) {
  if (!project?.id || !user?.id) {
    throw new Error("Projeto e usuário são obrigatórios.")
  }

  const config = getOAuthConfig(origin)
  if (!config.clientId || !config.clientSecret) {
    throw new Error("OAuth do Google Agenda não configurado no servidor.")
  }

  const state = await signOAuthState({
    projetoId: project.id,
    agenteId: project.agent?.id || null,
    userId: user.id,
    returnPath: `/admin/projetos/${project.routeKey || project.slug || project.id}?panel=google-calendar`,
  })

  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "))
  url.searchParams.set("state", state)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("prompt", "consent select_account")

  return url.toString()
}

async function exchangeCodeForTokens(code, origin, fetchImpl = fetch) {
  const config = getOAuthConfig(origin)
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Falha ao conectar Google Agenda.")
  }

  return payload
}

async function fetchGoogleUserInfo(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return null
  }

  return payload
}

async function refreshGoogleCalendarToken(row, fetchImpl = fetch) {
  const refreshToken = decryptSecret(row.refresh_token)
  if (!refreshToken) {
    throw new Error("Conexão Google Agenda sem refresh token.")
  }

  const config = getOAuthConfig()
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Falha ao renovar token do Google Agenda.")
  }

  const expiresAt = payload.expires_in
    ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString()
    : row.expires_at

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .update({
      access_token: encryptSecret(payload.access_token),
      expires_at: expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select(CONNECTION_FIELDS)
    .single()

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível atualizar token do Google Agenda.")
  }

  return data
}

async function getValidConnectionRow({ projetoId, agenteId = null, fetchImpl = fetch }) {
  let row = await loadConnectionRow({ projetoId, agenteId })
  if (!row || row.status !== "connected") {
    throw new Error("Google Agenda não conectado.")
  }

  const expiresAt = Date.parse(row.expires_at || "")
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() < 60_000) {
    row = await refreshGoogleCalendarToken(row, fetchImpl)
  }

  return row
}

async function fetchGoogleCalendarApi(row, path, init = {}, fetchImpl = fetch) {
  const accessToken = decryptSecret(row.access_token)
  const response = await fetchImpl(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error?.message || "Falha ao consultar Google Agenda.")
  }

  return payload
}

export async function listGoogleCalendarCalendarsForUser({ user, projetoId, agenteId = null }) {
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { calendars: [], error: "Acesso negado." }
  }

  const row = await getValidConnectionRow({ projetoId, agenteId })
  const payload = await fetchGoogleCalendarApi(row, "/users/me/calendarList?minAccessRole=writer")
  const calendars = (payload.items ?? []).map((item) => ({
    id: item.id,
    name: item.summary || item.id,
    primary: item.primary === true,
    accessRole: item.accessRole || "",
    timezone: item.timeZone || "",
  }))

  return { calendars, error: null }
}

export async function completeGoogleCalendarOAuthCallback(searchParams, origin, deps = {}) {
  const code = normalizeText(searchParams.get("code"))
  const state = normalizeText(searchParams.get("state"))
  const providerError = normalizeText(searchParams.get("error_description") || searchParams.get("error"))

  if (providerError) {
    throw new Error(providerError)
  }
  if (!code || !state) {
    throw new Error("Retorno do OAuth do Google Agenda incompleto.")
  }

  const parsedState = await verifyOAuthState(state)
  const fetchImpl = deps.fetchImpl ?? fetch
  const tokenPayload = await exchangeCodeForTokens(code, origin, fetchImpl)
  const profile = await fetchGoogleUserInfo(tokenPayload.access_token, fetchImpl)
  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
    : null

  const supabase = getSupabaseAdminClient()
  const existing = await loadConnectionRow({
    projetoId: parsedState.projetoId,
    agenteId: parsedState.agenteId,
    supabase,
  })
  const refreshToken = tokenPayload.refresh_token || (existing ? decryptSecret(existing.refresh_token) : "")

  const payload = {
    projeto_id: parsedState.projetoId,
    agente_id: parsedState.agenteId,
    google_account_email: normalizeText(profile?.email),
    access_token: encryptSecret(tokenPayload.access_token),
    refresh_token: encryptSecret(refreshToken),
    expires_at: expiresAt,
    status: "connected",
    configuracoes: normalizeConfig(existing?.configuracoes || {}),
    updated_at: new Date().toISOString(),
  }

  const query = existing?.id
    ? supabase.from("google_calendar_connections").update(payload).eq("id", existing.id)
    : supabase.from("google_calendar_connections").insert(payload)

  const { data, error } = await query.select(CONNECTION_FIELDS).single()
  if (error || !data) {
    throw new Error(error?.message || "Não foi possível salvar conexão Google Agenda.")
  }

  let calendarId = data.calendar_id
  let calendarName = data.calendar_name
  try {
    const calendarsPayload = await fetchGoogleCalendarApi(data, "/users/me/calendarList?minAccessRole=writer", {}, fetchImpl)
    const primary = (calendarsPayload.items ?? []).find((item) => item.primary) ?? calendarsPayload.items?.[0]
    if (primary?.id && !calendarId) {
      calendarId = primary.id
      calendarName = primary.summary || primary.id
      await supabase
        .from("google_calendar_connections")
        .update({
          calendar_id: calendarId,
          calendar_name: calendarName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
    }
  } catch (error) {
    console.error("[google-calendar] failed to select primary calendar", error)
  }

  await createLogEntry({
    projectId: parsedState.projetoId,
    type: "google_calendar_oauth",
    origin: "google_calendar",
    level: "info",
    description: "Google Agenda conectado.",
    payload: {
      connectionId: data.id,
      agenteId: parsedState.agenteId,
      email: normalizeText(profile?.email),
    },
  })

  const redirectUrl = new URL(parsedState.returnPath || `/admin/projetos/${parsedState.projetoId}`, origin)
  redirectUrl.searchParams.set("panel", "google-calendar")
  redirectUrl.searchParams.set("google_calendar_notice", "oauth_ok")
  return { connection: mapConnection({ ...data, calendar_id: calendarId, calendar_name: calendarName }), redirectUrl: redirectUrl.toString() }
}

export async function updateGoogleCalendarConnectionForUser({ user, projetoId, agenteId = null, input }) {
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { connection: null, error: "Acesso negado." }
  }

  const row = await loadConnectionRow({ projetoId, agenteId })
  if (!row) {
    return { connection: null, error: "Google Agenda não conectado." }
  }

  const config = normalizeConfig(input?.configuracoes || input || {})
  const calendarId = normalizeText(input?.calendarId) || row.calendar_id
  const calendarName = normalizeText(input?.calendarName) || row.calendar_name
  const { data, error } = await getSupabaseAdminClient()
    .from("google_calendar_connections")
    .update({
      calendar_id: calendarId,
      calendar_name: calendarName,
      configuracoes: config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("projeto_id", projetoId)
    .select(CONNECTION_FIELDS)
    .single()

  if (error || !data) {
    return { connection: null, error: error?.message || "Não foi possível salvar Google Agenda." }
  }

  return { connection: mapConnection(data), error: null }
}

export async function disconnectGoogleCalendarForUser({ user, projetoId, agenteId = null }) {
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { ok: false, error: "Acesso negado." }
  }

  const row = await loadConnectionRow({ projetoId, agenteId })
  if (!row) {
    return { ok: true, error: null }
  }

  const { error } = await getSupabaseAdminClient()
    .from("google_calendar_connections")
    .update({
      access_token: null,
      refresh_token: null,
      status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("projeto_id", projetoId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, error: null }
}

export async function createGoogleCalendarEvent({ projetoId, agenteId = null, chatId = null, event }) {
  const row = await getValidConnectionRow({ projetoId, agenteId })
  const connection = mapConnection(row)
  const calendarId = normalizeText(event?.calendarId) || connection.calendarId || "primary"
  const summary = normalizeText(event?.summary) || connection.configuracoes.eventSummaryTemplate
  const description = normalizeText(event?.description) || connection.configuracoes.eventDescriptionTemplate
  const attendeeEmail = normalizeText(event?.attendeeEmail)
  const body = {
    summary,
    description,
    start: {
      dateTime: event.startAt,
      timeZone: connection.configuracoes.timezone,
    },
    end: {
      dateTime: event.endAt,
      timeZone: connection.configuracoes.timezone,
    },
    attendees: attendeeEmail && connection.configuracoes.sendInvite ? [{ email: attendeeEmail }] : undefined,
  }

  const payload = await fetchGoogleCalendarApi(
    row,
    `/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${attendeeEmail ? "all" : "none"}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  )

  await getSupabaseAdminClient().from("google_calendar_events").insert({
    connection_id: row.id,
    projeto_id: projetoId,
    agente_id: agenteId,
    chat_id: chatId,
    google_event_id: payload.id || null,
    calendar_id: calendarId,
    status: "created",
    start_at: event.startAt,
    end_at: event.endAt,
    summary,
    attendee_email: attendeeEmail || null,
    metadata: {
      htmlLink: payload.htmlLink || null,
      source: "agent_google_calendar",
    },
  })

  return {
    id: payload.id,
    htmlLink: payload.htmlLink || "",
    calendarId,
    startAt: event.startAt,
    endAt: event.endAt,
  }
}

export async function cancelGoogleCalendarEvent({ projetoId, agenteId = null, chatId = null, calendarId, eventId }) {
  const row = await getValidConnectionRow({ projetoId, agenteId })
  const connection = mapConnection(row)
  const targetCalendarId = normalizeText(calendarId) || connection.calendarId || "primary"
  const targetEventId = normalizeText(eventId)

  if (!targetEventId) {
    throw new Error("Evento do Google Agenda não informado.")
  }

  await fetchGoogleCalendarApi(
    row,
    `/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(targetEventId)}?sendUpdates=all`,
    {
      method: "DELETE",
    },
  )

  await getSupabaseAdminClient().from("google_calendar_events").insert({
    connection_id: row.id,
    projeto_id: projetoId,
    agente_id: agenteId,
    chat_id: chatId,
    google_event_id: targetEventId,
    calendar_id: targetCalendarId,
    status: "cancelled",
    metadata: {
      source: "agent_google_calendar",
    },
  })

  return {
    id: targetEventId,
    calendarId: targetCalendarId,
    status: "cancelled",
  }
}

export async function rescheduleGoogleCalendarEvent({
  projetoId,
  agenteId = null,
  chatId = null,
  calendarId,
  eventId,
  startAt,
  endAt,
}) {
  const row = await getValidConnectionRow({ projetoId, agenteId })
  const connection = mapConnection(row)
  const targetCalendarId = normalizeText(calendarId) || connection.calendarId || "primary"
  const targetEventId = normalizeText(eventId)

  if (!targetEventId || !startAt || !endAt) {
    throw new Error("Evento, data inicial e data final são obrigatórios para remarcar.")
  }

  const payload = await fetchGoogleCalendarApi(
    row,
    `/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(targetEventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      body: JSON.stringify({
        start: {
          dateTime: startAt,
          timeZone: connection.configuracoes.timezone,
        },
        end: {
          dateTime: endAt,
          timeZone: connection.configuracoes.timezone,
        },
      }),
    },
  )

  await getSupabaseAdminClient().from("google_calendar_events").insert({
    connection_id: row.id,
    projeto_id: projetoId,
    agente_id: agenteId,
    chat_id: chatId,
    google_event_id: targetEventId,
    calendar_id: targetCalendarId,
    status: "rescheduled",
    start_at: startAt,
    end_at: endAt,
    summary: payload.summary || null,
    metadata: {
      htmlLink: payload.htmlLink || null,
      source: "agent_google_calendar",
    },
  })

  return {
    id: targetEventId,
    htmlLink: payload.htmlLink || "",
    calendarId: targetCalendarId,
    startAt,
    endAt,
    status: "confirmed",
  }
}

export async function checkGoogleCalendarAvailability({ projetoId, agenteId = null, startAt, endAt, calendarId = null }) {
  const row = await getValidConnectionRow({ projetoId, agenteId })
  const connection = mapConnection(row)
  const targetCalendarId = normalizeText(calendarId) || connection.calendarId || "primary"
  const payload = await fetchGoogleCalendarApi(
    row,
    "/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin: startAt,
        timeMax: endAt,
        timeZone: connection.configuracoes.timezone,
        items: [{ id: targetCalendarId }],
      }),
    },
  )
  const busy = payload.calendars?.[targetCalendarId]?.busy ?? []

  return {
    available: busy.length === 0,
    busy,
    calendarId: targetCalendarId,
  }
}
