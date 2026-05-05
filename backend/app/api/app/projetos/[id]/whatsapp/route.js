import { NextResponse } from "next/server"

import { recordJsonApiUsage } from "@/lib/api-usage-metrics"
import { createWhatsAppChannelForUser, listWhatsAppChannelsForUser } from "@/lib/whatsapp-channels"
import { getProjectAccessForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

async function loadProject(identifier) {
  const user = await getSessionUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  }

  const project = await getProjectAccessForUser(identifier, user)

  if (!project) {
    return { response: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) }
  }

  return { user, project }
}

export async function GET(request, context) {
  const startedAt = Date.now()
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    recordJsonApiUsage({
      route: "/api/app/projetos/[id]/whatsapp",
      method: "GET",
      status: loaded.response.status,
      elapsedMs: Date.now() - startedAt,
      projectId: id,
      source: "project_whatsapp_list",
      payload: { error: "Projeto não autenticado ou não encontrado." },
    })
    return loaded.response
  }

  const includeRuntimeSnapshot = request.nextUrl.searchParams.get("refresh") === "1"
  const channels = await listWhatsAppChannelsForUser(loaded.project, loaded.user, { includeRuntimeSnapshot })
  const payload = { channels }
  recordJsonApiUsage({
    route: "/api/app/projetos/[id]/whatsapp",
    method: "GET",
    status: 200,
    elapsedMs: Date.now() - startedAt,
    userId: loaded.user.id,
    projectId: loaded.project.id,
    source: includeRuntimeSnapshot ? "project_whatsapp_refresh" : "project_whatsapp_list",
    payload,
  })
  return NextResponse.json(payload, { status: 200 })
}

export async function POST(request, context) {
  const startedAt = Date.now()
  const { id } = await context.params
  const loaded = await loadProject(id)

  if (loaded.response) {
    recordJsonApiUsage({
      route: "/api/app/projetos/[id]/whatsapp",
      method: "POST",
      status: loaded.response.status,
      elapsedMs: Date.now() - startedAt,
      projectId: id,
      source: "project_whatsapp_create",
      payload: { error: "Projeto não autenticado ou não encontrado." },
    })
    return loaded.response
  }

  const body = await request.json()
  const { channel, contact, error } = await createWhatsAppChannelForUser(loaded.project, body, loaded.user)

  if (error) {
    const payload = { error }
    recordJsonApiUsage({
      route: "/api/app/projetos/[id]/whatsapp",
      method: "POST",
      status: 400,
      elapsedMs: Date.now() - startedAt,
      userId: loaded.user.id,
      projectId: loaded.project.id,
      source: "project_whatsapp_create",
      payload,
    })
    return NextResponse.json(payload, { status: 400 })
  }

  const payload = { channel, contact }
  recordJsonApiUsage({
    route: "/api/app/projetos/[id]/whatsapp",
    method: "POST",
    status: 201,
    elapsedMs: Date.now() - startedAt,
    userId: loaded.user.id,
    projectId: loaded.project.id,
    source: "project_whatsapp_create",
    payload,
  })
  return NextResponse.json(payload, { status: 201 })
}
