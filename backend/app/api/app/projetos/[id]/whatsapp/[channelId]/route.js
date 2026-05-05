import { NextResponse } from "next/server"

import { deleteWhatsAppChannelForUser, updateWhatsAppChannelForUser } from "@/lib/whatsapp-channels"
import { getProjectAccessForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function DELETE(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id, channelId } = await context.params
  const project = await getProjectAccessForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const { ok, error } = await deleteWhatsAppChannelForUser(channelId, project, user)

  if (!ok) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function PATCH(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id, channelId } = await context.params
  const project = await getProjectAccessForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { channel, error } = await updateWhatsAppChannelForUser(channelId, project, body, user)

  if (error || !channel) {
    return NextResponse.json({ error: error || "Não foi possível atualizar o canal." }, { status: 400 })
  }

  return NextResponse.json({ channel }, { status: 200 })
}
