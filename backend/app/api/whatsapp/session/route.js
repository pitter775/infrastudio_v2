import { NextResponse } from "next/server"

import { updateWhatsAppChannelSession } from "@/lib/whatsapp-channels"

function isAuthorized(request) {
  const expected = process.env.WHATSAPP_BRIDGE_SECRET?.trim()
  const received = request.headers.get("x-whatsapp-bridge-secret")?.trim()
  return Boolean(expected && received && expected === received)
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()
  const channel = await updateWhatsAppChannelSession(body.channelId, body)

  if (!channel) {
    return NextResponse.json({ error: "Canal nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ channel }, { status: 200 })
}
