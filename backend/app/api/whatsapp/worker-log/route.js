import { NextResponse } from "next/server"

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
  console.log("[whatsapp-worker]", {
    channelId: body.channelId ?? null,
    projetoId: body.projetoId ?? null,
    tipo: body.tipo ?? null,
    origem: body.origem ?? "whatsapp-worker",
    level: body.level === "error" ? "error" : "info",
    descricao: body.descricao ?? null,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
