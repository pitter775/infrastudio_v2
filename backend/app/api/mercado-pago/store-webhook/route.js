import { NextResponse } from "next/server"

import { createLogEntry } from "@/lib/logs"
import {
  processMercadoPagoStoreWebhook,
  validateMercadoPagoStoreWebhookSignature,
} from "@/lib/mercado-pago-store"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function resolveNotificationPayload(body, request) {
  const searchParams = request.nextUrl.searchParams

  return {
    id: body?.id || searchParams.get("id") || "",
    type: body?.type || body?.topic || searchParams.get("type") || searchParams.get("topic") || "",
    action: body?.action || searchParams.get("action") || "",
    userId: body?.user_id || body?.userId || searchParams.get("user_id") || searchParams.get("userId") || "",
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
      message: "Webhook Mercado Pago da loja pronto para receber notificações.",
      url: request.nextUrl.pathname,
    },
    { status: 200 },
  )
}

export async function POST(request) {
  const supabase = getSupabaseAdminClient()
  const body = await request.json().catch(() => ({}))
  const notification = resolveNotificationPayload(body, request)
  const signatureResult = validateMercadoPagoStoreWebhookSignature({
    xSignature: request.headers.get("x-signature") || "",
    xRequestId: request.headers.get("x-request-id") || "",
    dataId: notification.data?.id || notification.id || "",
  })

  if (!signatureResult.valid) {
    await createLogEntry(
      {
        projectId: null,
        type: "store_mercado_pago_webhook_rejected",
        origin: "mercado_pago_store_webhook",
        level: "warning",
        description: "Webhook do Mercado Pago da loja rejeitado por assinatura inválida.",
        payload: {
          notification,
          reason: signatureResult.reason || "invalid_signature",
          forcePersist: true,
        },
      },
      { supabase },
    ).catch(() => null)

    return NextResponse.json(
      {
        ok: false,
        ignored: true,
        reason: signatureResult.reason || "invalid_signature",
      },
      { status: 401 },
    )
  }

  const result = await processMercadoPagoStoreWebhook(notification, { supabase })

  await createLogEntry(
    {
      projectId: result?.projectId || null,
      type: result?.ok ? (result?.ignored ? "store_mercado_pago_webhook_ignored" : "store_mercado_pago_webhook_processed") : "store_mercado_pago_webhook_error",
      origin: "mercado_pago_store_webhook",
      level: result?.ok ? (result?.ignored ? "warn" : "info") : "error",
      description: result?.ok
        ? result?.ignored
          ? `Webhook do Mercado Pago da loja ignorado: ${result?.reason || "sem_motivo"}.`
          : "Webhook do Mercado Pago da loja processado com sucesso."
        : `Falha ao processar webhook do Mercado Pago da loja: ${result?.reason || "sem_motivo"}.`,
      payload: {
        notification,
        result,
        forcePersist: !result?.ok,
      },
    },
    { supabase },
  ).catch(() => null)

  return NextResponse.json(
    {
      ok: Boolean(result?.ok),
      ignored: Boolean(result?.ignored),
      reason: result?.reason || null,
      type: result?.type || null,
      projectId: result?.projectId || null,
      orderId: result?.orderId || null,
      publicId: result?.publicId || null,
    },
    { status: 200 },
  )
}
