import { NextResponse } from "next/server"

import { createAgendaReservation, listPublicAgendaAvailability } from "@/lib/agenda"
import { resolveProjectAgent } from "@/lib/chat/service"

async function resolveAgendaRequest(input) {
  const resolved = await resolveProjectAgent(input)
  const projetoId = resolved.projeto?.id || input.projetoId || input.projeto
  const agenteId = resolved.agente?.id || input.agenteId || input.agente || null

  if (!projetoId) {
    return { error: "Projeto nao encontrado." }
  }

  return { projetoId, agenteId }
}

export async function GET(request) {
  const url = new URL(request.url)
  const resolved = await resolveAgendaRequest({
    widgetSlug: url.searchParams.get("widgetSlug") || undefined,
    projeto: url.searchParams.get("projeto") || undefined,
    agente: url.searchParams.get("agente") || undefined,
    projetoId: url.searchParams.get("projetoId") || undefined,
    agenteId: url.searchParams.get("agenteId") || undefined,
  })

  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 404 })
  }

  try {
    const slots = await listPublicAgendaAvailability(resolved)
    return NextResponse.json({ slots }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar horarios." },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  const body = await request.json()
  const resolved = await resolveAgendaRequest(body)

  if (resolved.error) {
    return NextResponse.json({ error: resolved.error }, { status: 404 })
  }

  const { reservation, notifications, error } = await createAgendaReservation({
    ...body,
    projetoId: resolved.projetoId,
    agenteId: resolved.agenteId,
    origem: body.origem || "chat",
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ reservation, notifications }, { status: 201 })
}
