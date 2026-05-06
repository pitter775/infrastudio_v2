import { NextResponse } from "next/server"

import { deleteProjectsOwnedByUsuario } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { deleteUsuario, setUsuarioAtivo } from "@/lib/usuarios"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

export async function PATCH(request, context) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()

  if (typeof body.ativo !== "boolean") {
    return NextResponse.json({ error: "O campo ativo é obrigatório." }, { status: 400 })
  }

  const updated = await setUsuarioAtivo(id, body.ativo)

  if (!updated) {
    return NextResponse.json({ error: "Não foi possível atualizar o status." }, { status: 500 })
  }

  return NextResponse.json({ user: updated }, { status: 200 })
}

export async function DELETE(_request, context) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const { id } = await context.params

  if (id === user.id) {
    return NextResponse.json({ error: "Você não pode excluir o próprio usuário logado." }, { status: 400 })
  }

  const projectsResult = await deleteProjectsOwnedByUsuario(id)
  if (!projectsResult.ok) {
    return NextResponse.json(
      { error: projectsResult.error ?? "Não foi possível excluir os projetos do usuário.", code: projectsResult.code ?? null },
      { status: 500 },
    )
  }

  const deleted = await deleteUsuario(id)

  if (!deleted) {
    return NextResponse.json({ error: "Não foi possível excluir o usuário." }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
