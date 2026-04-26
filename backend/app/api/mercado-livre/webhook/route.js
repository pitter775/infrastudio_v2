import { NextResponse } from "next/server"

import { createLogEntry } from "@/lib/logs"

async function readWebhookPayload(request) {
  const contentType = request.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}))
  }

  const text = await request.text().catch(() => "")
  return text ? { raw: text } : {}
}

async function handleWebhook(request) {
  const url = new URL(request.url)
  const projetoId = String(url.searchParams.get("projeto") || "").trim()
  const canal = String(url.searchParams.get("canal") || "").trim()
  const payload = await readWebhookPayload(request)

  await createLogEntry({
    projectId: projetoId || null,
    type: "mercado_livre_webhook",
    origin: "mercado_livre",
    level: "info",
    description: "Webhook do Mercado Livre recebido.",
    payload: {
      projetoId: projetoId || null,
      canal: canal || null,
      method: request.method,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      webhookPayload: payload,
    },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function GET(request) {
  return handleWebhook(request)
}

export async function POST(request) {
  return handleWebhook(request)
}
