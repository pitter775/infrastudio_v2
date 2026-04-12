import { NextResponse } from "next/server"

import { deleteAdminLogs, listAdminLogs } from "@/lib/logs"
import { getSessionUser } from "@/lib/session"

function canAccessLaboratory(user) {
  return user?.role === "admin"
}

export async function GET(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const logs = await listAdminLogs({
    projectId: searchParams.get("projectId")?.trim() || "",
    type: searchParams.get("type")?.trim() || "",
    origin: searchParams.get("origin")?.trim() || "",
    level: searchParams.get("level")?.trim() || "",
    search: searchParams.get("search")?.trim() || "",
    limit: searchParams.get("limit")?.trim() || "100",
  })

  return NextResponse.json({ logs }, { status: 200 })
}

export async function DELETE(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const deleted = await deleteAdminLogs({
    projectId: String(body.projectId || "").trim(),
    type: String(body.type || "").trim(),
    origin: String(body.origin || "").trim(),
    level: String(body.level || "").trim(),
    search: String(body.search || "").trim(),
  })

  if (deleted == null) {
    return NextResponse.json({ error: "Nao foi possivel limpar os eventos." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted }, { status: 200 })
}
