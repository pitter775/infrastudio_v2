import { NextResponse } from "next/server"

import { createSession } from "@/lib/session"
import { getSessionUser } from "@/lib/session"
import { getUsuarioById, updateOwnUsuarioProfile } from "@/lib/usuarios"

export async function GET() {
  const user = await getSessionUser()

  if (!user?.id) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const profile = await getUsuarioById(user.id)
  if (!profile) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ user: profile }, { status: 200 })
}

export async function PATCH(request) {
  const user = await getSessionUser()

  if (!user?.id) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const body = await request.json()

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome e obrigatorio." }, { status: 400 })
  }

  if (body.senha && String(body.senha).trim().length < 6) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 })
  }

  const updated = await updateOwnUsuarioProfile({
    id: user.id,
    nome: body.nome,
    telefone: body.telefone,
    senha: body.senha,
  })

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o perfil." }, { status: 500 })
  }

  await createSession(updated)

  return NextResponse.json({ user: updated }, { status: 200 })
}
