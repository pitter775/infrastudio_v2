import { NextResponse } from "next/server"

import { deleteWhatsAppChannelForUser } from "@/lib/whatsapp-channels"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function DELETE(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id, channelId } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 })
  }

  const { ok, error } = await deleteWhatsAppChannelForUser(channelId, project, user)

  if (!ok) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
