import { NextResponse } from "next/server"

import { createLogEntry } from "@/lib/logs"
import { processMercadoPagoWebhook } from "@/lib/mercado-pago-billing"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function resolveNotificationPayload(body, request) {
  const url = request.nextUrl
  const searchParams = url.searchParams

  return {
    id: body?.id || searchParams.get("id") || "",
    type: body?.type || body?.topic || searchParams.get("type") || searchParams.get("topic") || "",
    action: body?.action || searchParams.get("action") || "",
    data: {
      id: body?.data?.id || searchParams.get("data.id") || searchParams.get("resource") || "",
    },
    raw: body || {},
  }
}

export async function GET(request) {
  return NextResponse.json(
    {
      ok: true,
      message: "Webhook Mercado Pago pronto para receber notificacoes.",
      url: request.nextUrl.pathname,
    },
    { status: 200 },
  )
}

export async function POST(request) {
  const supabase = getSupabaseAdminClient()
  const body = await request.json().catch(() => ({}))
  const notification = resolveNotificationPayload(body, request)

  await createLogEntry(
    {
      projectId: null,
      type: "mercado_pago_webhook_received",
      origin: "mercado_pago_webhook",
      level: "info",
      description: "Webhook do Mercado Pago recebido.",
      payload: notification,
    },
    { supabase },
  ).catch(() => null)

  const result = await processMercadoPagoWebhook(notification, { supabase })

  return NextResponse.json(
    {
      ok: Boolean(result?.ok),
      ignored: Boolean(result?.ignored),
      reason: result?.reason || null,
      type: result?.type || null,
      projectId: result?.projectId || null,
    },
    { status: 200 },
  )
}
