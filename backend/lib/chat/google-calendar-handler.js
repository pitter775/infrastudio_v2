import {
  checkGoogleCalendarAvailability,
  cancelGoogleCalendarEvent,
  createGoogleCalendarEvent,
  getGoogleCalendarConnectionForRuntime,
  rescheduleGoogleCalendarEvent,
} from "@/lib/google-calendar"
import { classifySemanticGoogleCalendarIntentStage } from "@/lib/chat/semantic-intent-stage"

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sanitizeText(value) {
  return String(value || "").trim()
}

function sanitizePhone(value) {
  return String(value || "").replace(/\D/g, "")
}

function normalizeEmail(value) {
  const email = sanitizeText(value).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function addMinutesIso(startAt, minutes) {
  const date = new Date(startAt)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  date.setMinutes(date.getMinutes() + Math.max(15, Number(minutes || 60)))
  return date.toISOString()
}

function formatDateTime(value, timezone = "America/Sao_Paulo") {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return sanitizeText(value)
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date)
}

function extractLeadContact(context, decision) {
  const lead = isPlainObject(context?.lead) ? context.lead : {}
  const pending = isPlainObject(context?.googleCalendar?.pending?.contact) ? context.googleCalendar.pending.contact : {}

  return {
    name: sanitizeText(decision?.contactName) || sanitizeText(lead.nome || lead.name) || sanitizeText(pending.name),
    email: normalizeEmail(decision?.contactEmail) || normalizeEmail(lead.email) || normalizeEmail(pending.email),
    phone:
      sanitizePhone(decision?.contactPhone).length >= 10
        ? sanitizePhone(decision.contactPhone)
        : sanitizePhone(lead.telefone || lead.phone).length >= 10
          ? sanitizePhone(lead.telefone || lead.phone)
          : sanitizePhone(pending.phone).length >= 10
            ? sanitizePhone(pending.phone)
            : "",
  }
}

function buildLocalReply(reply, metadata = {}) {
  return {
    reply,
    assets: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    metadata: {
      provider: "local_handler",
      model: "google_calendar_handler",
      routeStage: "google_calendar",
      domainStage: "agenda",
      ...metadata,
    },
  }
}

function mergePending(currentContext, decision, contact, connection) {
  const pending = isPlainObject(currentContext?.googleCalendar?.pending) ? currentContext.googleCalendar.pending : {}
  return {
    action: decision.intent === "reschedule_event" ? "reschedule_event" : "create_event",
    startAt: decision.startAt || pending.startAt || "",
    endAt: decision.endAt || pending.endAt || "",
    durationMinutes: decision.durationMinutes || pending.durationMinutes || connection?.configuracoes?.durationMinutes || 60,
    contact,
    updatedAt: new Date().toISOString(),
  }
}

export async function resolveGoogleCalendarHandler(input = {}) {
  const runtimeState = input.runtimeState
  const message = sanitizeText(input.message)
  const projectId = runtimeState?.resolved?.projeto?.id ?? runtimeState?.session?.chat?.projetoId ?? null
  const agentId = runtimeState?.resolved?.agente?.id ?? runtimeState?.session?.chat?.agenteId ?? null

  if (!message || !projectId) {
    return null
  }

  const connection = await (input.getGoogleCalendarConnectionForRuntime ?? getGoogleCalendarConnectionForRuntime)({
    projetoId: projectId,
    agenteId: agentId,
  }).catch(() => null)
  const currentContext = runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {}
  const hasPending = isPlainObject(currentContext?.googleCalendar?.pending)
  const openAiKey = input.openAiKey ?? process.env.OPENAI_API_KEY?.trim()

  if (!connection && !hasPending) {
    return null
  }

  const decision = await (input.classifySemanticGoogleCalendarIntentStage ?? classifySemanticGoogleCalendarIntentStage)({
    latestUserMessage: message,
    context: currentContext,
    openAiKey,
    model: input.model ?? process.env.OPENAI_CHAT_MODEL?.trim() ?? "gpt-4o-mini",
    timezone: connection?.configuracoes?.timezone || "America/Sao_Paulo",
    defaultDurationMinutes: connection?.configuracoes?.durationMinutes || 60,
    now: new Date().toISOString(),
  }).catch(() => null)

  const confidence = Number(decision?.confidence ?? 0)
  const agendaIntent = ["create_event", "reschedule_event", "cancel_event", "check_availability", "provide_missing_info"].includes(decision?.intent)
  if (!agendaIntent || confidence < 0.72) {
    return null
  }

  if (!connection || connection.status !== "connected") {
    return buildLocalReply("A agenda do Google ainda não está conectada neste agente. Conecte em Google Agenda para eu poder confirmar horários.", {
      googleCalendarDiagnostics: {
        connected: false,
        intent: decision.intent,
      },
    })
  }

  const lastEvent = isPlainObject(currentContext?.googleCalendar?.lastEvent) ? currentContext.googleCalendar.lastEvent : null

  if (decision.intent === "cancel_event") {
    if (!lastEvent?.eventId) {
      return buildLocalReply("Não encontrei um agendamento anterior nesta conversa para cancelar.", {
        googleCalendarDiagnostics: {
          connected: true,
          intent: decision.intent,
          eventFound: false,
        },
      })
    }

    const cancelled = await (input.cancelGoogleCalendarEvent ?? cancelGoogleCalendarEvent)({
      projetoId: projectId,
      agenteId: agentId,
      chatId: runtimeState.session.chat.id,
      calendarId: lastEvent.calendarId || connection.calendarId,
      eventId: lastEvent.eventId,
    }).catch((error) => ({ error: error?.message || "Não foi possível cancelar o evento." }))

    if (cancelled.error) {
      return buildLocalReply("Não consegui cancelar o evento no Google Agenda agora. Tente novamente em instantes.", {
        googleCalendarDiagnostics: {
          connected: true,
          intent: decision.intent,
          error: cancelled.error,
        },
      })
    }

    return buildLocalReply("Agendamento cancelado no Google Agenda.", {
      googleCalendarEvent: {
        eventId: lastEvent.eventId,
        calendarId: lastEvent.calendarId || connection.calendarId,
        startAt: lastEvent.startAt ?? null,
        endAt: lastEvent.endAt ?? null,
        status: "cancelled",
        htmlLink: lastEvent.htmlLink || "",
      },
      googleCalendarFlow: {
        action: "clear_pending",
      },
      googleCalendarDiagnostics: {
        connected: true,
        intent: decision.intent,
        cancelled: true,
      },
    })
  }

  const contact = extractLeadContact(currentContext, decision)
  const pending = mergePending(currentContext, decision, contact, connection)
  const startAt = pending.startAt
  const endAt = pending.endAt || addMinutesIso(startAt, pending.durationMinutes)

  if (!startAt || !endAt) {
    const reply =
      decision.intent === "reschedule_event"
        ? "Consigo remarcar pelo Google Agenda. Me diga o novo dia e horário."
        : "Consigo agendar pelo Google Agenda. Me diga o dia e horário desejado."
    return buildLocalReply(reply, {
      googleCalendarFlow: {
        action: "set_pending",
        pending: {
          ...pending,
          startAt: "",
          endAt: "",
        },
      },
      googleCalendarDiagnostics: {
        connected: true,
        intent: decision.intent,
        missingFields: ["date_time"],
      },
    })
  }

  if (decision.intent === "reschedule_event") {
    if (!lastEvent?.eventId) {
      return buildLocalReply("Não encontrei um agendamento anterior nesta conversa para remarcar. Posso criar um novo agendamento se você preferir.", {
        googleCalendarDiagnostics: {
          connected: true,
          intent: decision.intent,
          eventFound: false,
        },
      })
    }

    const availability = await (input.checkGoogleCalendarAvailability ?? checkGoogleCalendarAvailability)({
      projetoId: projectId,
      agenteId: agentId,
      calendarId: lastEvent.calendarId || connection.calendarId,
      startAt,
      endAt,
    }).catch((error) => ({ available: false, error: error?.message || "Falha ao consultar disponibilidade." }))

    if (!availability.available) {
      return buildLocalReply("Esse novo horário não está livre no Google Agenda. Me envie outra opção para eu verificar.", {
        googleCalendarFlow: {
          action: "set_pending",
          pending: {
            ...pending,
            startAt: "",
            endAt: "",
            contact,
          },
        },
        googleCalendarDiagnostics: {
          connected: true,
          intent: decision.intent,
          available: false,
          error: availability.error || null,
        },
      })
    }

    const event = await (input.rescheduleGoogleCalendarEvent ?? rescheduleGoogleCalendarEvent)({
      projetoId: projectId,
      agenteId: agentId,
      chatId: runtimeState.session.chat.id,
      calendarId: lastEvent.calendarId || connection.calendarId,
      eventId: lastEvent.eventId,
      startAt,
      endAt,
    }).catch((error) => ({ error: error?.message || "Não foi possível remarcar o evento." }))

    if (event.error || !event.id) {
      return buildLocalReply("Não consegui remarcar o evento no Google Agenda agora. Tente novamente em instantes.", {
        googleCalendarFlow: {
          action: "set_pending",
          pending: {
            ...pending,
            startAt,
            endAt,
            contact,
          },
        },
        googleCalendarDiagnostics: {
          connected: true,
          intent: decision.intent,
          available: true,
          error: event.error || null,
        },
      })
    }

    return buildLocalReply(`Agendamento remarcado para ${formatDateTime(startAt, connection.configuracoes.timezone)} no Google Agenda.`, {
      googleCalendarFlow: {
        action: "clear_pending",
      },
      googleCalendarEvent: {
        eventId: event.id,
        calendarId: event.calendarId,
        startAt,
        endAt,
        status: "confirmed",
        htmlLink: event.htmlLink || "",
      },
      googleCalendarDiagnostics: {
        connected: true,
        intent: decision.intent,
        available: true,
        eventRescheduled: true,
      },
    })
  }

  if (!contact.email && !contact.phone) {
    return buildLocalReply(`Encontrei o horário ${formatDateTime(startAt, connection.configuracoes.timezone)}. Me envie email ou celular para confirmar o agendamento.`, {
      googleCalendarFlow: {
        action: "set_pending",
        pending: {
          ...pending,
          startAt,
          endAt,
          contact,
        },
      },
      googleCalendarDiagnostics: {
        connected: true,
        intent: decision.intent,
        missingFields: ["contact"],
      },
    })
  }

  const availability = await (input.checkGoogleCalendarAvailability ?? checkGoogleCalendarAvailability)({
    projetoId: projectId,
    agenteId: agentId,
    calendarId: connection.calendarId,
    startAt,
    endAt,
  }).catch((error) => ({ available: false, error: error?.message || "Falha ao consultar disponibilidade." }))

  if (!availability.available) {
    return buildLocalReply("Esse horário não está livre no Google Agenda. Me envie outro dia ou horário para eu verificar.", {
      googleCalendarFlow: {
        action: "set_pending",
        pending: {
          ...pending,
          startAt: "",
          endAt: "",
          contact,
        },
      },
      googleCalendarDiagnostics: {
        connected: true,
        intent: decision.intent,
        available: false,
        error: availability.error || null,
      },
    })
  }

  const event = await (input.createGoogleCalendarEvent ?? createGoogleCalendarEvent)({
    projetoId: projectId,
    agenteId: agentId,
    chatId: runtimeState.session.chat.id,
    event: {
      startAt,
      endAt,
      calendarId: connection.calendarId,
      attendeeEmail: contact.email,
      summary: connection.configuracoes.eventSummaryTemplate,
      description: connection.configuracoes.eventDescriptionTemplate,
    },
  }).catch((error) => ({ error: error?.message || "Não foi possível criar o evento." }))

  if (event.error || !event.id) {
    return buildLocalReply("Não consegui criar o evento no Google Agenda agora. Tente novamente em instantes.", {
      googleCalendarFlow: {
        action: "set_pending",
        pending: {
          ...pending,
          startAt,
          endAt,
          contact,
        },
      },
      googleCalendarDiagnostics: {
        connected: true,
        intent: decision.intent,
        available: true,
        error: event.error || null,
      },
    })
  }

  return buildLocalReply(`Agendamento confirmado para ${formatDateTime(startAt, connection.configuracoes.timezone)} no Google Agenda.`, {
    googleCalendarFlow: {
      action: "clear_pending",
    },
    googleCalendarEvent: {
      eventId: event.id,
      calendarId: event.calendarId,
      startAt,
      endAt,
      status: "confirmed",
      htmlLink: event.htmlLink || "",
    },
    googleCalendarDiagnostics: {
      connected: true,
      intent: decision.intent,
      available: true,
      eventCreated: true,
    },
  })
}
