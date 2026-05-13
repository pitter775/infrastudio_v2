import { NextResponse } from "next/server"

import { buildGoogleCalendarAuthorizationUrl } from "@/lib/google-calendar"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  try {
    const authorizationUrl = await buildGoogleCalendarAuthorizationUrl({
      project,
      user,
      origin: new URL(request.url).origin,
    })
    return NextResponse.json({ authorizationUrl }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível iniciar o OAuth do Google Agenda." },
      { status: 400 },
    )
  }
}
