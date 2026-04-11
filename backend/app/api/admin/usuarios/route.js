import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { createUsuario, listUsuarios, updateUsuario } from "@/lib/usuarios"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

function normalizeProjetoIds(body) {
  return Array.from(
    new Set(
      [...(Array.isArray(body.projetoIds) ? body.projetoIds : []), body.projetoId ?? null]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim())
    )
  )
}

export async function GET() {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const users = await listUsuarios()
  return NextResponse.json({ users }, { status: 200 })
}

export async function POST(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()

  if (!body.nome || !body.email) {
    return NextResponse.json({ error: "Nome e email sao obrigatorios." }, { status: 400 })
  }

  const created = await createUsuario({
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
    papel: body.papel === "admin" ? "admin" : "viewer",
    projetoIds: normalizeProjetoIds(body),
  })

  if (!created) {
    return NextResponse.json({ error: "Nao foi possivel criar o usuario." }, { status: 500 })
  }

  return NextResponse.json({ user: created }, { status: 201 })
}

export async function PUT(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()

  if (!body.id || !body.nome || !body.email) {
    return NextResponse.json({ error: "Id, nome e email sao obrigatorios." }, { status: 400 })
  }

  const updated = await updateUsuario({
    id: body.id,
    nome: body.nome,
    email: body.email,
    senha: body.senha,
    ativo: body.ativo,
    papel: body.papel === "admin" ? "admin" : "viewer",
    projetoIds: normalizeProjetoIds(body),
  })

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o usuario." }, { status: 500 })
  }

  return NextResponse.json({ user: updated }, { status: 200 })
}
