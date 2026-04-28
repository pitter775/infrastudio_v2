import { NextResponse } from "next/server"

import { getMercadoLivreSnapshotStatus, syncMercadoLivreSnapshotForProject } from "@/lib/mercado-livre-store-sync"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(_request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const snapshot = await getMercadoLivreSnapshotStatus(project.id)
  return NextResponse.json({ snapshot }, { status: 200 })
}

export async function POST(request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body.limit ?? 20) || 20, 1), 20)
  const offset = Math.max(Number(body.offset ?? 0) || 0, 0)
  const fullSync = body?.fullSync !== false

  const result = await syncMercadoLivreSnapshotForProject(project, { limit, offset, fullSync })
  if (result.error) {
    return NextResponse.json(
      { error: result.error, paging: result.paging, stage: result.stage || null, details: result.details || null },
      { status: 400 }
    )
  }

  const snapshot = await getMercadoLivreSnapshotStatus(project.id)
  return NextResponse.json({ synced: result.synced, paging: result.paging, snapshot }, { status: 200 })
}
