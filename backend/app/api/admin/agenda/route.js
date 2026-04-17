import { NextResponse } from "next/server"

import {
  ensureAgendaApisForProject,
  generateAgendaSlotsForUser,
  listAgendaForUser,
  replicateAgendaToProject,
  reserveAgendaSlotsForUser,
  updateAgendaSlotsStatusForUser,
  updateAgendaReservationForUser,
} from "@/lib/agenda"
import { getSessionUser } from "@/lib/session"

export async function GET(request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const url = new URL(request.url)
  const projetoId = url.searchParams.get("projetoId") || ""

  try {
    const agenda = await listAgendaForUser({ user, projetoId })
    return NextResponse.json(agenda, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar a agenda." },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const body = await request.json()
  const result =
    body.action === "replicate_to_project"
      ? await replicateAgendaToProject({ user, input: body })
      : body.action === "ensure_agenda_apis"
        ? await ensureAgendaApisForProject({ user, projetoId: body.projetoId, agenteId: body.agenteId })
        : await generateAgendaSlotsForUser({ user, input: body })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result, { status: body.id ? 200 : 201 })
}

export async function PATCH(request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const body = await request.json()
  const result =
    body.type === "reservation"
      ? await updateAgendaReservationForUser({ user, input: body })
      : body.type === "reserve_slots"
        ? await reserveAgendaSlotsForUser({ user, input: body })
        : await updateAgendaSlotsStatusForUser({ user, input: body })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result, { status: 200 })
}
