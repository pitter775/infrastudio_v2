import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { deleteProject, getProjectDeletePermission } from "@/lib/projetos"

export async function DELETE(_request, context) {
  const user = await getSessionUser()
  const { id } = await context.params

  const permission = await getProjectDeletePermission(user, id)

  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason ?? "Acesso negado." }, { status: 403 })
  }

  const body = await _request.json().catch(() => ({}))
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
