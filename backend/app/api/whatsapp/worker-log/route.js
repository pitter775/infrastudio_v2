import { NextResponse } from "next/server"
import { createLogEntry } from "@/lib/logs"

function isAuthorized(request) {
  const expected = process.env.WHATSAPP_BRIDGE_SECRET?.trim()
  const received = request.headers.get("x-whatsapp-bridge-secret")?.trim()
  return Boolean(expected && received && expected === received)
}

function shouldPersistWorkerLog(payload) {
  if (payload.level === "error") {
    return true
  }

  const tipo = String(payload.tipo || "").trim().toLowerCase()
  const origem = String(payload.origem || "").trim().toLowerCase()
  const descricao = String(payload.descricao || "").trim().toLowerCase()

  if (tipo === "trace" && origem === "whatsapp-session") {
    return false
  }

  if (origem === "whatsapp-session" && descricao.includes("qr code gerado")) {
    return false
  }

  return true
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()
  const payload = {
    channelId: body.channelId ?? null,
    projetoId: body.projetoId ?? null,
    tipo: body.tipo ?? null,
    origem: body.origem ?? "whatsapp-worker",
    level: body.level === "error" ? "error" : "info",
    descricao: body.descricao ?? null,
  }

  if (!shouldPersistWorkerLog(payload)) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
  }

  await createLogEntry({
    projectId: payload.projetoId,
    type: payload.level === "error" ? "whatsapp_error" : "whatsapp_event",
    origin: "whatsapp_worker",
    level: payload.level,
    description: payload.descricao || "Evento do worker WhatsApp.",
    payload,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
