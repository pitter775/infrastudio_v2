import { NextResponse } from "next/server"

import { callWhatsAppWorker, getWhatsAppChannelForUser } from "@/lib/whatsapp-channels"
import { getProjectAccessForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id, channelId } = await context.params
  const project = await getProjectAccessForUser(id, user)
  const channel = await getWhatsAppChannelForUser(channelId, project, user)

  if (!project || !channel) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 })
  }

  try {
    const snapshot = await callWhatsAppWorker(`/qr?channelId=${encodeURIComponent(channel.id)}`)
    return NextResponse.json({ snapshot }, { status: 200 })
  } catch {
    return NextResponse.json({
      snapshot: {
        channelId: channel.id,
        status: channel.connectionStatus,
        qrCodeDataUrl: channel.qrCodeDataUrl,
        qrCodeText: channel.qrCodeText,
      },
    })
  }
}
