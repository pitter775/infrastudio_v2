import { NextResponse } from "next/server"

import {
  disconnectGoogleCalendarForUser,
  getGoogleCalendarConnectionForUser,
  listGoogleCalendarCalendarsForUser,
  updateGoogleCalendarConnectionForUser,
} from "@/lib/google-calendar"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

async function loadProject(identifier) {
  const user = await getSessionUser()
  if (!user) {
    return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  }

  const project = await getProjectForUser(identifier, user)
  if (!project) {
    return { response: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) }
  }

  return { user, project }
}

export async function GET(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)
  if (loaded.response) return loaded.response

  const agenteId = request.nextUrl.searchParams.get("agenteId") || loaded.project.agent?.id || null
  const result = await getGoogleCalendarConnectionForUser({
    user: loaded.user,
    projetoId: loaded.project.id,
    agenteId,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  let calendars = []
  if (result.connection?.status === "connected") {
    const calendarsResult = await listGoogleCalendarCalendarsForUser({
      user: loaded.user,
      projetoId: loaded.project.id,
      agenteId,
    }).catch((error) => ({ calendars: [], error: error?.message || "Não foi possível listar calendários." }))
    calendars = calendarsResult.calendars ?? []
  }

  return NextResponse.json({ connection: result.connection, calendars }, { status: 200 })
}

export async function PATCH(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)
  if (loaded.response) return loaded.response

  const body = await request.json().catch(() => ({}))
  const result = await updateGoogleCalendarConnectionForUser({
    user: loaded.user,
    projetoId: loaded.project.id,
    agenteId: body.agenteId || loaded.project.agent?.id || null,
    input: body,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ connection: result.connection }, { status: 200 })
}

export async function DELETE(request, context) {
  const { id } = await context.params
  const loaded = await loadProject(id)
  if (loaded.response) return loaded.response

  const body = await request.json().catch(() => ({}))
  const result = await disconnectGoogleCalendarForUser({
    user: loaded.user,
    projetoId: loaded.project.id,
    agenteId: body.agenteId || loaded.project.agent?.id || null,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
