import { NextResponse } from "next/server"

import { listSnapshotProductsByProjectId } from "@/lib/mercado-livre-store"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const searchTerm = String(searchParams.get("q") || "").trim()
  const limit = Number(searchParams.get("limit") || 6) || 6
  const page = Math.max(Number(searchParams.get("page") || 1) || 1, 1)

  const result = await listSnapshotProductsByProjectId(project.id, {
    searchTerm,
    page,
    limit,
  })
  return NextResponse.json({ items: result.items, page, hasMore: result.hasMore }, { status: 200 })
}
