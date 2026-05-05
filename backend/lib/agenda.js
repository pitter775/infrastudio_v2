import "server-only"

import { getChatWidgetByProjetoAgente } from "@/lib/chat-widgets"
import { sendEmail } from "@/lib/email"
import { createLogEntry } from "@/lib/logs"
import { canManageProject, getProjectForUser } from "@/lib/projetos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { listActiveHandoffRecipientsByProjectId } from "@/lib/whatsapp-handoff-contatos"
import { getActiveWhatsAppChannelByProjectAgent, sendWhatsAppTextMessage } from "@/lib/whatsapp-channels"

function normalizeText(value) {
  const normalized = typeof value === "string" ? value.trim() : ""
  return normalized ? normalized : null
}

function normalizeEmail(value) {
  const normalized = normalizeText(value)?.toLowerCase()
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "")
  return digits.length >= 10 ? digits : null
}

function normalizeStatus(value, fallback = "reservado") {
  return ["reservado", "confirmado", "cancelado", "concluido"].includes(value) ? value : fallback
}

function getAppBaseUrl() {
  const value =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://www.infrastudio.pro"

  return value.replace(/\/+$/, "")
}

function buildAgendaListApiConfig(widgetSlug) {
  return {
    parametros: [
      { nome: "widgetSlug", path: "widget.slug" },
      { nome: "date", path: "agenda.dataConsulta" },
    ],
    runtime: {
      factual: true,
      cacheTtlSeconds: 60,
      responsePath: "slots",
      previewPath: "0",
      fields: [
        { nome: "horario_id", tipo: "string", descricao: "ID do horario", path: "0.id" },
        { nome: "data_inicio", tipo: "string", descricao: "Data do horario", path: "0.dataInicio" },
        { nome: "hora_inicio", tipo: "string", descricao: "Hora inicial", path: "0.horaInicio" },
        { nome: "hora_fim", tipo: "string", descricao: "Hora final", path: "0.horaFim" },
      ],
    },
    tags: ["internal", "agenda", "slots"],
    widgetSlug,
  }
}

function buildAgendaReserveApiConfig(widgetSlug) {
  return {
    http: {
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        widgetSlug: "{{widget.slug}}",
        horarioId: "{{agenda.horarioId}}",
        horarioReservado: "{{agenda.horarioReservado}}",
        contatoNome: "{{lead.nome}}",
        contatoEmail: "{{lead.email}}",
        contatoTelefone: "{{lead.telefone}}",
        resumoConversa: "{{memoria.resumo}}",
        origem: "chat",
        canal: "web",
      },
    },
    runtime: {
      factual: false,
      autoExecute: false,
      responsePath: "reservation",
      previewPath: "id",
      fields: [
        { nome: "reserva_id", tipo: "string", descricao: "ID da reserva", path: "id" },
        { nome: "status", tipo: "string", descricao: "Status da reserva", path: "status" },
      ],
    },
    tags: ["internal", "agenda", "reserva"],
    widgetSlug,
  }
}

function mapSlot(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    titulo: row.titulo,
    diaSemana: row.dia_semana,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    horaInicio: row.hora_inicio,
    horaFim: row.hora_fim,
    timezone: row.timezone,
    capacidade: row.capacidade,
    ativo: row.ativo === true,
    configuracoes: row.configuracoes ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapReservation(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    horarioId: row.horario_id,
    chatId: row.chat_id,
    status: row.status,
    contatoNome: row.contato_nome,
    contatoEmail: row.contato_email,
    contatoTelefone: row.contato_telefone,
    resumoConversa: row.resumo_conversa,
    dadosContato: row.dados_contato ?? {},
    origem: row.origem,
    canal: row.canal,
    horarioReservado: row.horario_reservado,
    timezone: row.timezone,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const agendaSlotFields =
  "id, projeto_id, agente_id, titulo, dia_semana, data_inicio, data_fim, hora_inicio, hora_fim, timezone, capacidade, ativo, configuracoes, created_at, updated_at"

const agendaReservationFields =
  "id, projeto_id, agente_id, horario_id, chat_id, status, contato_nome, contato_email, contato_telefone, resumo_conversa, dados_contato, origem, canal, horario_reservado, timezone, metadata, created_at, updated_at"

async function loadNotificationContext(projectId, agentId = null) {
  const supabase = getSupabaseAdminClient()
  const [projectResult, membersResult, recipients, channel] = await Promise.all([
    supabase
      .from("projetos")
      .select("id, nome, slug, owner:usuarios!projetos_owner_user_id_fkey(id, nome, email)")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("usuarios_projetos")
      .select("usuario:usuarios(id, nome, email)")
      .eq("projeto_id", projectId),
    listActiveHandoffRecipientsByProjectId(projectId),
    agentId ? getActiveWhatsAppChannelByProjectAgent({ projetoId: projectId, agenteId: agentId }) : null,
  ])

  const emailRecipients = new Map()
  const ownerEmail = projectResult.data?.owner?.email?.trim()
  if (ownerEmail) {
    emailRecipients.set(ownerEmail, {
      email: ownerEmail,
      name: projectResult.data?.owner?.nome || ownerEmail,
    })
  }

  for (const row of membersResult.data ?? []) {
    const email = row.usuario?.email?.trim()
    if (email) {
      emailRecipients.set(email, {
        email,
        name: row.usuario?.nome || email,
      })
    }
  }

  return {
    project: projectResult.data ?? null,
    emailRecipients: Array.from(emailRecipients.values()),
    whatsappRecipients: recipients,
    whatsappChannel: channel,
  }
}

function buildReservationEmailHtml(reservation, projectName) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a">
      <h1 style="font-size:20px">Nova reserva de horario</h1>
      <p><strong>Projeto:</strong> ${projectName || reservation.projetoId}</p>
      <p><strong>Horario:</strong> ${new Date(reservation.horarioReservado).toLocaleString("pt-BR")}</p>
      <p><strong>Contato:</strong> ${reservation.contatoNome || "Não informado"} - ${reservation.contatoEmail || reservation.contatoTelefone || "sem contato"}</p>
      <p><strong>Resumo:</strong></p>
      <p>${reservation.resumoConversa || "Sem resumo informado."}</p>
    </div>
  `
}

async function notifyReservationCreated(reservation) {
  const context = await loadNotificationContext(reservation.projetoId, reservation.agenteId)
  const projectName = context.project?.nome || context.project?.slug || "Projeto"
  const failures = []

  for (const recipient of context.emailRecipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: `Nova reserva em ${projectName}`,
        html: buildReservationEmailHtml(reservation, projectName),
      })
    } catch (error) {
      failures.push({ channel: "email", to: recipient.email, error: error?.message || "Falha ao enviar email." })
    }
  }

  if (context.whatsappChannel?.id && context.whatsappRecipients.length) {
    const message = [
      `Nova reserva em ${projectName}`,
      `Horario: ${new Date(reservation.horarioReservado).toLocaleString("pt-BR")}`,
      `Contato: ${reservation.contatoNome || reservation.contatoEmail || reservation.contatoTelefone || "não informado"}`,
      reservation.resumoConversa ? `Resumo: ${reservation.resumoConversa}` : null,
    ].filter(Boolean).join("\n")

    for (const recipient of context.whatsappRecipients) {
      const result = await sendWhatsAppTextMessage({
        channelId: context.whatsappChannel.id,
        to: recipient.numero,
        message,
      })

      if (!result.ok) {
        failures.push({ channel: "whatsapp", to: recipient.numero, error: result.error })
      }
    }
  }

  if (context.whatsappChannel?.id && reservation.contatoTelefone) {
    const customerMessage = [
      `Seu horario em ${projectName} foi registrado com sucesso.`,
      `Data: ${new Date(reservation.horarioReservado).toLocaleString("pt-BR")}`,
      reservation.contatoNome ? `Contato informado: ${reservation.contatoNome}` : null,
      "Se precisar alterar, responda nesta conversa ou fale com nossa equipe.",
    ].filter(Boolean).join("\n")

    const customerResult = await sendWhatsAppTextMessage({
      channelId: context.whatsappChannel.id,
      to: reservation.contatoTelefone,
      message: customerMessage,
    })

    if (!customerResult.ok) {
      failures.push({ channel: "whatsapp_customer", to: reservation.contatoTelefone, error: customerResult.error })
    }
  }

  await createLogEntry({
    projectId: reservation.projetoId,
    type: "agenda_reserva",
    origin: "agenda",
    level: failures.length ? "warn" : "info",
    description: failures.length ? "Reserva criada com falhas de notificação." : "Reserva criada e notificações processadas.",
    payload: {
      reservaId: reservation.id,
      failures,
    },
  })

  return { failures }
}

async function getProjectAgentId(projectId) {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from("agentes")
    .select("id")
    .eq("projeto_id", projectId)
    .eq("ativo", true)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}

async function getAgendaWidgetSlug(projetoId, agenteId = null) {
  const widget = await getChatWidgetByProjetoAgente({ projetoId, agenteId })
  return widget?.slug ?? null
}

async function upsertAgendaApiDefinition({ projetoId, agenteId, name, method, url, description, config }) {
  const supabase = getSupabaseAdminClient()
  const { data: existing } = await supabase
    .from("apis")
    .select("id")
    .eq("projeto_id", projetoId)
    .eq("nome", name)
    .limit(1)
    .maybeSingle()

  const payload = {
    projeto_id: projetoId,
    nome: name,
    url,
    metodo: method,
    descricao: description,
    ativo: true,
    configuracoes: config,
    updated_at: new Date().toISOString(),
  }

  const query = existing?.id
    ? supabase.from("apis").update(payload).eq("id", existing.id).eq("projeto_id", projetoId)
    : supabase.from("apis").insert(payload)

  const { data, error } = await query.select("id").maybeSingle()
  if (error || !data) {
    throw new Error(error?.message || "Não foi possível cadastrar a API da agenda.")
  }

  return data.id
}

export async function ensureAgendaApisForProject({ user, projetoId, agenteId = null }) {
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { ok: false, error: "Acesso negado." }
  }

  const resolvedAgentId = agenteId || (await getProjectAgentId(projetoId))
  const baseUrl = getAppBaseUrl()
  const widgetSlug = await getAgendaWidgetSlug(projetoId, resolvedAgentId)

  if (!widgetSlug) {
    return { ok: false, error: "Widget do projeto não encontrado para publicar a agenda." }
  }

  await upsertAgendaApiDefinition({
    projetoId,
    agenteId: resolvedAgentId,
    name: "Agenda - listar horários",
    method: "GET",
    url: `${baseUrl}/api/agenda?widgetSlug={widgetSlug}&date={date}`,
    description: "Lista horários disponíveis da agenda pública via widget.",
    config: buildAgendaListApiConfig(widgetSlug),
  })

  await upsertAgendaApiDefinition({
    projetoId,
    agenteId: resolvedAgentId,
    name: "Agenda - criar reserva",
    method: "POST",
    url: `${baseUrl}/api/agenda`,
    description: "Cria reserva pública na agenda usando o widget do projeto.",
    config: buildAgendaReserveApiConfig(widgetSlug),
  })

  return { ok: true, error: null }
}

export async function listAgendaForUser({ user, projetoId }) {
  const supabase = getSupabaseAdminClient()
  const projects = projetoId
    ? [await getProjectForUser(projetoId, user)].filter(Boolean)
    : []

  const projectIds =
    projetoId
      ? projects.map((project) => project.id)
      : user?.role === "admin"
        ? null
        : user?.memberships?.map((item) => item.projetoId).filter(Boolean) ?? []

  if (Array.isArray(projectIds) && projectIds.length === 0) {
    return { slots: [], reservations: [] }
  }

  let slotsQuery = supabase
    .from("agenda_horarios")
    .select(agendaSlotFields)
    .order("data_inicio", { ascending: true, nullsFirst: false })
    .order("hora_inicio")
  let reservationsQuery = supabase
    .from("agenda_reservas")
    .select(agendaReservationFields)
    .order("horario_reservado", { ascending: false })
    .limit(80)

  if (Array.isArray(projectIds)) {
    slotsQuery = slotsQuery.in("projeto_id", projectIds)
    reservationsQuery = reservationsQuery.in("projeto_id", projectIds)
  }

  const [slotsResult, reservationsResult] = await Promise.all([slotsQuery, reservationsQuery])
  if (slotsResult.error) {
    throw new Error(slotsResult.error.message)
  }
  if (reservationsResult.error) {
    throw new Error(reservationsResult.error.message)
  }

  return {
    slots: (slotsResult.data ?? []).map(mapSlot),
    reservations: (reservationsResult.data ?? []).map(mapReservation),
  }
}

function parseDateOnly(value) {
  const normalized = normalizeText(value)?.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized || "") ? normalized : null
}

function parseTime(value) {
  const normalized = normalizeText(value)?.slice(0, 5)
  return /^\d{2}:\d{2}$/.test(normalized || "") ? normalized : null
}

function addMinutesToTime(time, minutes) {
  const [hours, mins] = time.split(":").map(Number)
  const total = hours * 60 + mins + minutes
  const nextHours = Math.floor(total / 60)
  const nextMinutes = total % 60
  if (nextHours > 23 || nextHours < 0) return null
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`
}

function dateRange(startDate, endDate) {
  const dates = []
  const current = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)

  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

function slotKey(row) {
  return `${String(row.data_inicio ?? row.dataInicio ?? "").slice(0, 10)}|${String(row.hora_inicio ?? row.horaInicio ?? "").slice(0, 5)}`
}

export async function generateAgendaSlotsForUser({ user, input }) {
  const projetoId = normalizeText(input.projetoId)
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { slots: [], created: 0, skipped: 0, error: "Acesso negado." }
  }

  const dataInicio = parseDateOnly(input.dataInicio)
  const dataFim = parseDateOnly(input.dataFim)
  const horaInicio = parseTime(input.horaInicio)
  const horaFim = parseTime(input.horaFim)
  const duracaoMinutos = Math.max(15, Number(input.duracaoMinutos || 60))

  if (!dataInicio || !dataFim || !horaInicio || !horaFim) {
    return { slots: [], created: 0, skipped: 0, error: "Periodo, hora inicial e hora final sao obrigatorios." }
  }

  if (new Date(`${dataFim}T00:00:00.000Z`).getTime() < new Date(`${dataInicio}T00:00:00.000Z`).getTime()) {
    return { slots: [], created: 0, skipped: 0, error: "Data final precisa ser maior ou igual a data inicial." }
  }

  const supabase = getSupabaseAdminClient()
  const agenteId = normalizeText(input.agenteId)
  const capacidade = Math.max(1, Number(input.capacidade || 1))
  const rpcResult = await supabase.rpc("gerar_agenda_slots", {
    p_projeto_id: projetoId,
    p_agente_id: agenteId,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_hora_inicio: horaInicio,
    p_hora_fim: horaFim,
    p_duracao_minutos: duracaoMinutos,
    p_capacidade: capacidade,
  })

  if (!rpcResult.error) {
    await ensureAgendaApisForProject({ user, projetoId, agenteId })
    return { slots: (rpcResult.data ?? []).map(mapSlot), created: rpcResult.data?.length ?? 0, skipped: 0, error: null }
  }

  let existingQuery = supabase
    .from("agenda_horarios")
    .select("id, data_inicio, hora_inicio")
    .eq("projeto_id", projetoId)
    .gte("data_inicio", `${dataInicio}T00:00:00.000Z`)
    .lte("data_inicio", `${dataFim}T23:59:59.999Z`)

  existingQuery = agenteId ? existingQuery.eq("agente_id", agenteId) : existingQuery.is("agente_id", null)

  const { data: existingRows, error: existingError } = await existingQuery
  if (existingError) {
    return { slots: [], created: 0, skipped: 0, error: existingError.message }
  }

  const existingKeys = new Set((existingRows ?? []).map(slotKey))
  const payload = []

  for (const date of dateRange(dataInicio, dataFim)) {
    let current = horaInicio
    while (current && current < horaFim) {
      const next = addMinutesToTime(current, duracaoMinutos)
      if (!next || next > horaFim) break

      const key = `${date}|${current}`
      if (!existingKeys.has(key)) {
        payload.push({
          projeto_id: projetoId,
          agente_id: agenteId,
          titulo: "Horario disponivel",
          dia_semana: null,
          data_inicio: `${date}T00:00:00.000Z`,
          data_fim: `${date}T00:00:00.000Z`,
          hora_inicio: current,
          hora_fim: next,
          timezone: normalizeText(input.timezone) || "America/Sao_Paulo",
          capacidade,
          ativo: true,
        })
      }
      current = next
    }
  }

  if (!payload.length) {
    await ensureAgendaApisForProject({ user, projetoId, agenteId })
    return { slots: [], created: 0, skipped: existingKeys.size, error: null }
  }

  const { data, error } = await supabase.from("agenda_horarios").insert(payload).select(agendaSlotFields)
  if (error) {
    return { slots: [], created: 0, skipped: 0, error: error.message }
  }

  await ensureAgendaApisForProject({ user, projetoId, agenteId })
  return { slots: (data ?? []).map(mapSlot), created: data?.length ?? 0, skipped: existingKeys.size, error: null }
}

export async function replicateAgendaToProject({ user, input }) {
  const sourceProjectId = normalizeText(input.projetoId)
  const targetProjectId = normalizeText(input.targetProjetoId)

  if (!sourceProjectId || !targetProjectId) {
    return { slots: [], created: 0, skipped: 0, error: "Projeto origem e destino sao obrigatorios." }
  }

  if (!(await canManageProject(user, sourceProjectId)) || !(await canManageProject(user, targetProjectId))) {
    return { slots: [], created: 0, skipped: 0, error: "Acesso negado." }
  }

  const targetProject = await getProjectForUser(targetProjectId, user)
  const targetAgentId = targetProject?.agent?.id ?? null
  const supabase = getSupabaseAdminClient()
  const [{ data: sourceRows, error: sourceError }, { data: targetRows, error: targetError }] = await Promise.all([
    supabase
      .from("agenda_horarios")
      .select(agendaSlotFields)
      .eq("projeto_id", sourceProjectId)
      .order("data_inicio", { ascending: true, nullsFirst: false })
      .order("hora_inicio"),
    supabase
      .from("agenda_horarios")
      .select("data_inicio, hora_inicio")
      .eq("projeto_id", targetProjectId),
  ])

  if (sourceError || targetError) {
    return { slots: [], created: 0, skipped: 0, error: sourceError?.message || targetError?.message || "Não foi possível replicar a agenda." }
  }

  const existingKeys = new Set((targetRows ?? []).map(slotKey))
  const payload = (sourceRows ?? [])
    .filter((slot) => !existingKeys.has(slotKey(slot)))
    .map((slot) => ({
      projeto_id: targetProjectId,
      agente_id: targetAgentId,
      titulo: slot.titulo || "Horario disponivel",
      dia_semana: null,
      data_inicio: slot.data_inicio,
      data_fim: slot.data_fim,
      hora_inicio: slot.hora_inicio,
      hora_fim: slot.hora_fim,
      timezone: slot.timezone || "America/Sao_Paulo",
      capacidade: Math.max(1, Number(slot.capacidade || 1)),
      ativo: slot.ativo !== false,
      configuracoes: slot.configuracoes ?? {},
    }))

  let inserted = []
  if (payload.length) {
    const { data, error } = await supabase.from("agenda_horarios").insert(payload).select(agendaSlotFields)
    if (error) {
      return { slots: [], created: 0, skipped: 0, error: error.message }
    }
    inserted = data ?? []
  }

  await ensureAgendaApisForProject({ user, projetoId: targetProjectId, agenteId: targetAgentId })

  return {
    slots: inserted.map(mapSlot),
    created: inserted.length,
    skipped: Math.max(0, (sourceRows ?? []).length - inserted.length),
    error: null,
  }
}

export async function updateAgendaSlotsStatusForUser({ user, input }) {
  const projetoId = normalizeText(input.projetoId)
  const ids = Array.isArray(input.ids) ? input.ids.filter(Boolean) : []
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { slots: [], error: "Acesso negado." }
  }
  if (!ids.length) {
    return { slots: [], error: "Selecione pelo menos um horario." }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("agenda_horarios")
    .update({
      ativo: input.ativo !== false,
      updated_at: new Date().toISOString(),
    })
    .eq("projeto_id", projetoId)
    .in("id", ids)
    .select(agendaSlotFields)

  if (error) {
    return { slots: [], error: error.message }
  }

  return { slots: (data ?? []).map(mapSlot), error: null }
}

export async function reserveAgendaSlotsForUser({ user, input }) {
  const projetoId = normalizeText(input.projetoId)
  const ids = Array.isArray(input.ids) ? input.ids.filter(Boolean) : []
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { reservations: [], error: "Acesso negado." }
  }
  if (!ids.length) {
    return { reservations: [], error: "Selecione pelo menos um horario." }
  }

  const supabase = getSupabaseAdminClient()
  const { data: slots, error: slotsError } = await supabase
    .from("agenda_horarios")
    .select("id, agente_id, data_inicio, hora_inicio, timezone, ativo")
    .eq("projeto_id", projetoId)
    .in("id", ids)

  if (slotsError) {
    return { reservations: [], error: slotsError.message }
  }

  const { data: reservedRows, error: reservedError } = await supabase
    .from("agenda_reservas")
    .select("horario_id")
    .eq("projeto_id", projetoId)
    .in("horario_id", ids)
    .in("status", ["reservado", "confirmado"])

  if (reservedError) {
    return { reservations: [], error: reservedError.message }
  }

  const reservedIds = new Set((reservedRows ?? []).map((row) => row.horario_id))
  const payload = (slots ?? [])
    .filter((slot) => slot.ativo === true && !reservedIds.has(slot.id))
    .map((slot) => ({
      projeto_id: projetoId,
      agente_id: slot.agente_id,
      horario_id: slot.id,
      status: "confirmado",
      contato_nome: "Reserva manual",
      origem: "admin",
      canal: "admin",
      horario_reservado: `${String(slot.data_inicio).slice(0, 10)}T${String(slot.hora_inicio).slice(0, 5)}:00.000Z`,
      timezone: slot.timezone || "America/Sao_Paulo",
      metadata: { source: "admin_agenda" },
    }))

  if (!payload.length) {
    return { reservations: [], error: "Horários selecionados já estão reservados ou bloqueados." }
  }

  const { data, error } = await supabase.from("agenda_reservas").insert(payload).select(agendaReservationFields)
  if (error) {
    return { reservations: [], error: error.message }
  }

  return { reservations: (data ?? []).map(mapReservation), error: null }
}

export async function clearAgendaForUser({ user, projetoId }) {
  const normalizedProjectId = normalizeText(projetoId)
  if (!normalizedProjectId || !(await canManageProject(user, normalizedProjectId))) {
    return { deletedSlots: 0, deletedReservations: 0, deletedApis: 0, error: "Acesso negado." }
  }

  const supabase = getSupabaseAdminClient()
  const [{ data: reservationRows, error: reservationListError }, { data: slotRows, error: slotListError }] = await Promise.all([
    supabase
      .from("agenda_reservas")
      .select("id")
      .eq("projeto_id", normalizedProjectId),
    supabase
      .from("agenda_horarios")
      .select("id")
      .eq("projeto_id", normalizedProjectId),
  ])

  if (reservationListError || slotListError) {
    return {
      deletedSlots: 0,
      deletedReservations: 0,
      deletedApis: 0,
      error: reservationListError?.message || slotListError?.message || "Não foi possível carregar a agenda.",
    }
  }

  let deletedReservations = 0
  if ((reservationRows ?? []).length) {
    const { data, error } = await supabase
      .from("agenda_reservas")
      .delete()
      .eq("projeto_id", normalizedProjectId)
      .select("id")

    if (error) {
      return { deletedSlots: 0, deletedReservations: 0, deletedApis: 0, error: error.message }
    }

    deletedReservations = data?.length ?? reservationRows.length
  }

  let deletedSlots = 0
  if ((slotRows ?? []).length) {
    const { data, error } = await supabase
      .from("agenda_horarios")
      .delete()
      .eq("projeto_id", normalizedProjectId)
      .select("id")

    if (error) {
      return { deletedSlots: 0, deletedReservations, deletedApis: 0, error: error.message }
    }

    deletedSlots = data?.length ?? slotRows.length
  }

  let deletedApis = 0
  const { data: apiRows, error: apiListError } = await supabase
    .from("apis")
    .select("id, nome, configuracoes")
    .eq("projeto_id", normalizedProjectId)

  if (apiListError) {
    return { deletedSlots, deletedReservations, deletedApis: 0, error: apiListError.message }
  }

  const agendaApiIds = (apiRows ?? [])
    .filter((api) => {
      const tags = Array.isArray(api?.configuracoes?.tags)
        ? api.configuracoes.tags.map((item) => String(item || "").toLowerCase())
        : []
      const name = String(api?.nome || "").toLowerCase()
      return tags.includes("agenda") || name.startsWith("agenda - ")
    })
    .map((api) => api.id)

  if (agendaApiIds.length) {
    const { data, error } = await supabase
      .from("apis")
      .delete()
      .eq("projeto_id", normalizedProjectId)
      .in("id", agendaApiIds)
      .select("id")

    if (error) {
      return { deletedSlots, deletedReservations, deletedApis: 0, error: error.message }
    }

    deletedApis = data?.length ?? agendaApiIds.length
  }

  return {
    deletedSlots,
    deletedReservations,
    deletedApis,
    error: null,
  }
}

export async function cleanupExpiredAgendaSlots() {
  const supabase = getSupabaseAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: reservedRows, error: reservedError } = await supabase
    .from("agenda_reservas")
    .select("horario_id")
    .not("horario_id", "is", null)

  if (reservedError) {
    return { deleted: 0, error: reservedError.message }
  }

  const reservedIds = new Set((reservedRows ?? []).map((row) => row.horario_id))
  let query = supabase.from("agenda_horarios").select("id").lt("data_inicio", `${today}T00:00:00.000Z`)
  const { data: expiredRows, error: expiredError } = await query
  if (expiredError) {
    return { deleted: 0, error: expiredError.message }
  }

  const deleteIds = (expiredRows ?? []).map((row) => row.id).filter((id) => !reservedIds.has(id))
  if (!deleteIds.length) {
    return { deleted: 0, error: null }
  }

  const { data, error } = await supabase.from("agenda_horarios").delete().in("id", deleteIds).select("id")
  if (error) {
    return { deleted: 0, error: error.message }
  }

  return { deleted: data?.length ?? 0, error: null }
}

export async function updateAgendaReservationForUser({ user, input }) {
  const projetoId = normalizeText(input.projetoId)
  if (!projetoId || !(await canManageProject(user, projetoId))) {
    return { reservation: null, error: "Acesso negado." }
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("agenda_reservas")
    .update({
      status: normalizeStatus(input.status),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("projeto_id", projetoId)
    .select(agendaReservationFields)
    .single()

  if (error || !data) {
    return { reservation: null, error: error?.message || "Não foi possível atualizar a reserva." }
  }

  return { reservation: mapReservation(data), error: null }
}

export async function listPublicAgendaAvailability({ projetoId, agenteId, date = null }) {
  const supabase = getSupabaseAdminClient()
  const todayStartIso = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
  const normalizedDate = normalizeText(date)?.slice(0, 10)
  let query = supabase
    .from("agenda_horarios")
    .select(agendaSlotFields)
    .eq("projeto_id", projetoId)
    .eq("ativo", true)
    .gte("data_inicio", todayStartIso)
    .order("data_inicio", { ascending: true, nullsFirst: false })
    .order("hora_inicio")

  if (normalizedDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    query = query
      .gte("data_inicio", `${normalizedDate}T00:00:00.000Z`)
      .lte("data_inicio", `${normalizedDate}T23:59:59.999Z`)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const slots = (data ?? [])
    .map(mapSlot)
    .filter((slot) => !agenteId || !slot.agenteId || slot.agenteId === agenteId)
  if (!slots.length) {
    return []
  }

  const { data: reservations, error: reservationsError } = await supabase
    .from("agenda_reservas")
    .select("horario_id")
    .eq("projeto_id", projetoId)
    .in("horario_id", slots.map((slot) => slot.id))
    .in("status", ["reservado", "confirmado"])

  if (reservationsError) {
    throw new Error(reservationsError.message)
  }

  const reservedCount = new Map()
  for (const reservation of reservations ?? []) {
    reservedCount.set(reservation.horario_id, (reservedCount.get(reservation.horario_id) ?? 0) + 1)
  }

  return slots.filter((slot) => (reservedCount.get(slot.id) ?? 0) < Number(slot.capacidade || 1))
}

export async function createAgendaReservation(input) {
  const projetoId = normalizeText(input.projetoId)
  const horarioReservado = normalizeText(input.horarioReservado)
  const contatoEmail = normalizeEmail(input.contatoEmail)
  const contatoTelefone = normalizePhone(input.contatoTelefone)

  if (!projetoId || !horarioReservado) {
    return { reservation: null, error: "Projeto e horario reservado sao obrigatorios." }
  }

  if (!contatoEmail && !contatoTelefone) {
    return { reservation: null, error: "Informe email ou celular para confirmar a reserva." }
  }

  const supabase = getSupabaseAdminClient()
  const horarioId = normalizeText(input.horarioId)
  if (horarioId) {
    const { data: slot, error: slotError } = await supabase
      .from("agenda_horarios")
      .select("id, ativo, capacidade")
      .eq("id", horarioId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (slotError || !slot || slot.ativo === false) {
      return { reservation: null, error: "Horário indisponível." }
    }

    const { count, error: countError } = await supabase
      .from("agenda_reservas")
      .select("id", { count: "exact", head: true })
      .eq("horario_id", horarioId)
      .in("status", ["reservado", "confirmado"])

    if (countError) {
      return { reservation: null, error: countError.message }
    }

    if ((count ?? 0) >= Number(slot.capacidade || 1)) {
      return { reservation: null, error: "Horario ja reservado." }
    }
  }

  const { data, error } = await supabase
    .from("agenda_reservas")
    .insert({
      projeto_id: projetoId,
      agente_id: normalizeText(input.agenteId),
      horario_id: horarioId,
      chat_id: normalizeText(input.chatId),
      status: normalizeStatus(input.status),
      contato_nome: normalizeText(input.contatoNome),
      contato_email: contatoEmail,
      contato_telefone: contatoTelefone,
      resumo_conversa: normalizeText(input.resumoConversa),
      dados_contato: input.dadosContato && typeof input.dadosContato === "object" ? input.dadosContato : {},
      origem: normalizeText(input.origem) || "chat",
      canal: normalizeText(input.canal),
      horario_reservado: horarioReservado,
      timezone: normalizeText(input.timezone) || "America/Sao_Paulo",
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    })
    .select(agendaReservationFields)
    .single()

  if (error || !data) {
    return { reservation: null, error: error?.message || "Não foi possível criar a reserva." }
  }

  const reservation = mapReservation(data)
  const notifications = await notifyReservationCreated(reservation)
  return { reservation, notifications, error: null }
}
