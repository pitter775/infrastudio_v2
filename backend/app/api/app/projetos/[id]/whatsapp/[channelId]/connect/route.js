import { NextResponse } from "next/server"

import { callWhatsAppWorker, getWhatsAppChannelForUser } from "@/lib/whatsapp-channels"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function POST(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id, channelId } = await context.params
  const project = await getProjectForUser(id, user)
  const channel = await getWhatsAppChannelForUser(channelId, project, user)

  if (!project || !channel) {
    return NextResponse.json({ error: "Canal nao encontrado." }, { status: 404 })
  }

  try {
    const snapshot = await callWhatsAppWorker("/connect", {
      method: "POST",
      body: JSON.stringify({
        channelId: channel.id,
        projetoId: project.id,
        agenteId: channel.agenteId || project.agent?.id || null,
        numero: channel.number,
        onlyReplyToUnsavedContacts: channel.onlyReplyToUnsavedContacts === true,
      }),
    })

    return NextResponse.json({ snapshot }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 502 })
  }
}
