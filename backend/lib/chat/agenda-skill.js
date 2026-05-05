import { createAgendaReservation } from "@/lib/agenda"

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "")
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function formatAgendaSlotForContext(slot) {
  const dayLabel = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][Number(slot?.diaSemana)] || "data especifica"
  const dateLabel = slot?.dataInicio ? String(slot.dataInicio).slice(0, 10) : null
  return {
    id: slot.id,
    titulo: slot.titulo,
    dia: dateLabel || (slot.diaSemana === null || typeof slot.diaSemana === "undefined" ? "data especifica" : dayLabel),
    data: dateLabel,
    horaInicio: String(slot.horaInicio || "").slice(0, 5),
    horaFim: String(slot.horaFim || "").slice(0, 5),
    timezone: slot.timezone || "America/Sao_Paulo",
  }
}

function normalizeSimpleText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function extractLeadContact(context, fallbackExternalIdentifier) {
  const lead = isPlainObject(context?.lead) ? context.lead : {}
  const email = typeof lead.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())
    ? lead.email.trim().toLowerCase()
    : ""
  const phone = sanitizePhone(lead.telefone || lead.phone || "")
  const fallback = String(fallbackExternalIdentifier || "").trim()
  const fallbackPhone = sanitizePhone(fallback)

  return {
    nome: typeof lead.nome === "string" ? lead.nome.trim() : "",
    email: email || (fallback.includes("@") ? fallback.toLowerCase() : ""),
    phone: phone.length >= 10 ? phone : fallbackPhone.length >= 10 ? fallbackPhone : "",
  }
}

function parseRequestedTime(message) {
  const match = String(message || "").match(/\b([01]?\d|2[0-3])(?:[:hH]([0-5]\d))?\b/)
  if (!match) return null
  return `${String(match[1]).padStart(2, "0")}:${String(match[2] || "00").padStart(2, "0")}`
}

function parseRequestedDate(message) {
  const normalized = String(message || "").trim()
  const isoMatch = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (isoMatch) {
    return isoMatch[1]
  }

  const brMatch = normalized.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/)
  if (!brMatch) {
    return null
  }

  const day = String(brMatch[1]).padStart(2, "0")
  const month = String(brMatch[2]).padStart(2, "0")
  const currentYear = new Date().getFullYear()
  let year = brMatch[3] ? Number(brMatch[3]) : currentYear
  if (year < 100) {
    year += 2000
  }

  if (month === "00" || Number(month) > 12 || day === "00" || Number(day) > 31) {
    return null
  }

  return `${year}-${month}-${day}`
}

function isAgendaReservationIntent(message) {
  const normalized = normalizeSimpleText(message)
  return /\b(agendar|agenda|reservar|reserva|marcar|confirmar|horario|visita|reuniao)\b/.test(normalized)
}

function isNegativeMessage(message) {
  return /\b(nao|outro|mudar|trocar|alterar|cancelar)\b/i.test(String(message || ""))
}

function selectAgendaSlot(message, slots, options = {}) {
  const requestedTime = parseRequestedTime(message)
  const requestedDate = parseRequestedDate(message)
  if ((!requestedTime && !requestedDate) || !Array.isArray(slots)) return null

  const preferredSlotId = typeof options?.preferredSlotId === "string" ? options.preferredSlotId : null
  const matches = slots.filter((slot) => {
    const slotTime = String(slot?.horaInicio || "").slice(0, 5)
    const slotDate = String(slot?.dataInicio || slot?.data || "").slice(0, 10)

    if (requestedTime && slotTime !== requestedTime) {
      return false
    }

    if (requestedDate && slotDate !== requestedDate) {
      return false
    }

    return true
  })

  if (!matches.length) {
    return null
  }

  if (preferredSlotId) {
    return matches.find((slot) => slot?.id === preferredSlotId) ?? matches[0]
  }

  return matches[0]
}

function nextDateForAgendaSlot(slot, now = new Date()) {
  const time = String(slot?.horaInicio || "").slice(0, 5)
  if (!time) return null

  const dateStart = String(slot?.dataInicio || "").slice(0, 10)
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStart) ? new Date(`${dateStart}T${time}:00`) : new Date(now)
  if (Number.isNaN(baseDate.getTime())) return null

  if (Number.isInteger(slot?.diaSemana)) {
    const currentDay = baseDate.getDay()
    const targetDay = Number(slot.diaSemana)
    const diff = (targetDay - currentDay + 7) % 7
    const candidate = new Date(baseDate)
    candidate.setDate(candidate.getDate() + diff)
    const [hours, minutes] = time.split(":").map(Number)
    candidate.setHours(hours, minutes, 0, 0)
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7)
    }
    return candidate.toISOString()
  }

  const [hours, minutes] = time.split(":").map(Number)
  baseDate.setHours(hours, minutes, 0, 0)
  return baseDate.toISOString()
}

function formatAgendaOptions(slots) {
  return slots
    .slice(0, 6)
    .map((slot) => `- ${slot.data || slot.dia}, das ${slot.horaInicio} as ${slot.horaFim}`)
    .join("\n")
}

function formatAgendaDateDisplay(value) {
  const normalized = String(value || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return String(value || "").trim()
  }

  const [year, month, day] = normalized.split("-")
  return `${day}/${month}/${year}`
}

function formatAgendaSlotLabel(slot) {
  const slotDate = String(slot?.dataInicio || slot?.data || "").slice(0, 10)
  const displayDate = formatAgendaDateDisplay(slotDate || slot?.dia || "")
  const start = String(slot?.horaInicio || "").slice(0, 5)
  const end = String(slot?.horaFim || "").slice(0, 5)
  return `${displayDate}, das ${start} as ${end}`
}

function buildAgendaContactSnapshot(contact) {
  return {
    nome: typeof contact?.nome === "string" ? contact.nome.trim() : "",
    email: typeof contact?.email === "string" ? contact.email.trim().toLowerCase() : "",
    phone: sanitizePhone(contact?.phone || contact?.telefone || ""),
  }
}

function buildAgendaHeuristicReply(reply, metadata = {}) {
  return {
    reply,
    assets: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
    metadata: {
      provider: "local_heuristic",
      model: "agenda_skill",
      routeStage: "sales",
      heuristicStage: "agenda_reservation",
      domainStage: "agenda",
      ...metadata,
    },
  }
}

function buildAgendaDayBuckets(slots) {
  const buckets = []
  const bucketIndex = new Map()

  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!slot?.id || !slot?.horaInicio) {
      continue
    }

    const key = String(slot.data || slot.dia || slot.id)
    if (!bucketIndex.has(key)) {
      bucketIndex.set(key, buckets.length)
      buckets.push({
        key,
        label: formatAgendaDateDisplay(slot.data || slot.dia || ""),
        date: slot.data || null,
        weekdayLabel: slot.dia || null,
        slots: [],
      })
    }

    const bucket = buckets[bucketIndex.get(key)]
    bucket.slots.push({
      id: slot.id,
      label: String(slot.horaInicio || "").slice(0, 5),
      time: String(slot.horaInicio || "").slice(0, 5),
      date: slot.data || null,
      weekdayLabel: slot.dia || null,
    })
  }

  return buckets
    .map((bucket) => ({
      ...bucket,
      slots: bucket.slots.slice(0, 6),
    }))
    .filter((bucket) => bucket.slots.length > 0)
    .slice(0, 5)
}

export function buildAgendaActionPayload(agendaSlots) {
  const dayBuckets = buildAgendaDayBuckets(
    (Array.isArray(agendaSlots) ? agendaSlots : []).map(formatAgendaSlotForContext)
  )

  if (!dayBuckets.length) {
    return null
  }

  return {
    type: "agenda_schedule",
    label: "Agendar horario",
    icon: "calendar",
    summary: "Escolha um dia e depois o horario.",
    days: dayBuckets,
  }
}

export function hasConfirmedAgendaReservation(context) {
  const reservation = isPlainObject(context?.agendaReserva) ? context.agendaReserva : null
  const status = String(reservation?.status || "").trim().toLowerCase()
  return ["reservado", "confirmado", "concluido"].includes(status)
}

export async function resolveAgendaReservationSkill(input) {
  const { message, aiContext, agendaSlots, runtimeState, options } = input
  if (!Array.isArray(agendaSlots) || agendaSlots.length === 0) {
    return null
  }

  const currentContext = runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {}
  const pendingAgenda = isPlainObject(currentContext?.agenda?.pendente) ? currentContext.agenda.pendente : null
  const hasAgendaIntent = isAgendaReservationIntent(message)
  if (!hasAgendaIntent && !pendingAgenda) {
    return null
  }

  const formattedSlots = aiContext?.agenda?.horariosDisponiveis ?? agendaSlots.slice(0, 12).map(formatAgendaSlotForContext)
  const contactFromContext = buildAgendaContactSnapshot(
    extractLeadContact(aiContext, runtimeState.prelude.normalizedExternalIdentifier)
  )
  const pendingContact = buildAgendaContactSnapshot(pendingAgenda?.contato)
  const contact = {
    nome: contactFromContext.nome || pendingContact.nome || "",
    email: contactFromContext.email || pendingContact.email || "",
    phone: contactFromContext.phone || pendingContact.phone || "",
  }
  const preferredAgendaSelection = isPlainObject(aiContext?.agendaSelection) ? aiContext.agendaSelection : null
  const selectedSlot = selectAgendaSlot(message, agendaSlots, {
    preferredSlotId: pendingAgenda?.horarioId ?? preferredAgendaSelection?.slotId ?? null,
  })
  const activeSlot =
    selectedSlot ??
    (
      pendingAgenda?.horarioId || preferredAgendaSelection?.slotId
        ? agendaSlots.find((slot) => slot?.id === (pendingAgenda?.horarioId ?? preferredAgendaSelection?.slotId)) ?? null
        : null
    )

  if (pendingAgenda && isNegativeMessage(message)) {
    return buildAgendaHeuristicReply(
      `Sem problema. Me diga outro horário e, se quiser, já envie email ou celular.\n\nHorários disponíveis:\n${formatAgendaOptions(formattedSlots)}`,
      {
        agenteId: runtimeState.resolved?.agente?.id ?? null,
        agenteNome: runtimeState.resolved?.agente?.nome ?? null,
        agendaFlow: {
          action: "clear_pending",
        },
      }
    )
  }

  if (!activeSlot) {
    return buildAgendaHeuristicReply(
      `Posso seguir com o agendamento. Me diga o melhor horário e envie email ou celular para contato.\n\nHorários disponíveis:\n${formatAgendaOptions(formattedSlots)}`,
      {
        agenteId: runtimeState.resolved?.agente?.id ?? null,
        agenteNome: runtimeState.resolved?.agente?.nome ?? null,
      }
    )
  }

  const horarioReservado = nextDateForAgendaSlot(activeSlot)
  if (!horarioReservado) {
    return buildAgendaHeuristicReply("Encontrei o horário, mas não consegui montar a data da reserva. Me envie o dia e horário desejado.", {
      agenteId: runtimeState.resolved?.agente?.id ?? null,
      agenteNome: runtimeState.resolved?.agente?.nome ?? null,
      agendaFlow: {
        action: "clear_pending",
      },
    })
  }

  if (!contact.email && !contact.phone) {
    return buildAgendaHeuristicReply(
      `Encontrei este horário: ${formatAgendaSlotLabel(activeSlot)}.\n\nAgora me envie email ou celular para eu preparar a confirmação final.`,
      {
        agenteId: runtimeState.resolved?.agente?.id ?? null,
        agenteNome: runtimeState.resolved?.agente?.nome ?? null,
        agendaFlow: {
          action: "set_pending",
          status: "awaiting_contact",
          horarioId: activeSlot.id,
          horarioReservado,
          contato: contact,
        },
      }
    )
  }

  const summary = runtimeState.history
    .slice(-6)
    .map((item) => `${item.role === "assistant" ? "Assistente" : "Cliente"}: ${String(item.conteudo || "").slice(0, 180)}`)
    .join("\n")

  const { reservation, error } = await (options.createAgendaReservation ?? createAgendaReservation)({
    projetoId: runtimeState.resolved?.projeto?.id ?? runtimeState.session.chat.projetoId,
    agenteId: runtimeState.resolved?.agente?.id ?? runtimeState.session.chat.agenteId,
    horarioId: activeSlot.id,
    chatId: runtimeState.session.chat.id,
    contatoNome: contact.nome || null,
    contatoEmail: contact.email || null,
    contatoTelefone: contact.phone || null,
    resumoConversa: summary || message,
    dadosContato: {
      email: contact.email || null,
      telefone: contact.phone || null,
    },
    origem: "chat",
    canal: runtimeState.prelude.channelKind,
    horarioReservado,
    timezone: activeSlot.timezone || "America/Sao_Paulo",
    metadata: {
      source: "chat_agenda_skill",
      rawMessage: message,
    },
  })

  if (error || !reservation) {
    return buildAgendaHeuristicReply(error || "Não consegui confirmar a reserva agora. Tente novamente em instantes.", {
      agenteId: runtimeState.resolved?.agente?.id ?? null,
      agenteNome: runtimeState.resolved?.agente?.nome ?? null,
      agendaFlow: {
        action: "set_pending",
        status: "awaiting_approval",
        horarioId: activeSlot.id,
        horarioReservado,
        contato: contact,
      },
    })
  }

  const reservedAt = new Date(reservation.horarioReservado).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: reservation.timezone || "America/Sao_Paulo",
  })

  return buildAgendaHeuristicReply(
    `Agendamento confirmado para ${reservedAt}. Seus dados ja foram registrados para o retorno.`,
    {
      agenteId: runtimeState.resolved?.agente?.id ?? null,
      agenteNome: runtimeState.resolved?.agente?.nome ?? null,
      agendaReserva: {
        id: reservation.id,
        horarioId: reservation.horarioId,
        horarioReservado: reservation.horarioReservado,
        status: reservation.status,
      },
      agendaFlow: {
        action: "clear_pending",
      },
    }
  )
}
