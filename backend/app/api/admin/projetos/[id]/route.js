import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { deleteProject, getProjectDeletePermission, transferProjectOwnership } from "@/lib/projetos"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

export async function PATCH(request, context) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json().catch(() => ({}))

  if (!body.targetUserId) {
    return NextResponse.json({ error: "Usuario destino e obrigatorio." }, { status: 400 })
  }

  const project = await transferProjectOwnership({
    projectId: id,
    targetUserId: body.targetUserId,
  })

  if (!project) {
    return NextResponse.json({ error: "Nao foi possivel transferir o projeto." }, { status: 500 })
  }

  return NextResponse.json({ project }, { status: 200 })
}

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
