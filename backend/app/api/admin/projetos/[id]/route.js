import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { deleteProject } from "@/lib/projetos"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

export async function DELETE(_request, context) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await _request.json().catch(() => ({}))
  const { id } = await context.params
  const result = await deleteProject(id, body.confirmationName)

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error ?? "Nao foi possivel excluir o projeto.",
        code: result.code ?? null,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
