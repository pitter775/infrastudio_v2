import { NextResponse } from "next/server"

import { createLogEntry } from "@/lib/logs"
import { syncMercadoLivreSnapshotForProject } from "@/lib/mercado-livre-store-sync"

function extractWebhookTopic(payload) {
  return String(payload?.topic || payload?.type || "").trim().toLowerCase()
}

function extractWebhookResource(payload) {
  return String(payload?.resource || payload?.data?.resource || payload?.data?.id || "").trim()
}

function shouldSyncStoreSnapshotFromWebhook(payload) {
  const topic = extractWebhookTopic(payload)
  const resource = extractWebhookResource(payload).toLowerCase()

  return topic === "items" || topic === "item" || resource.includes("/items/")
}

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
  let snapshotSync = null

  if (projetoId && shouldSyncStoreSnapshotFromWebhook(payload)) {
    snapshotSync = await syncMercadoLivreSnapshotForProject(
      { id: projetoId },
      { fullSync: false, limit: 20, offset: 0 },
    )
  }

  await createLogEntry({
    projectId: projetoId || null,
    type: "mercado_livre_webhook",
    origin: "mercado_livre",
    level: snapshotSync?.error ? "warn" : "info",
    description: "Webhook do Mercado Livre recebido.",
    payload: {
      projetoId: projetoId || null,
      canal: canal || null,
      method: request.method,
      searchParams: Object.fromEntries(url.searchParams.entries()),
      webhookPayload: payload,
      snapshotSync: snapshotSync
        ? {
            synced: Number(snapshotSync.synced || 0),
            deleted: Number(snapshotSync.deleted || 0),
            changed: snapshotSync.changed === true,
            error: snapshotSync.error || null,
            stage: snapshotSync.stage || null,
          }
        : null,
    },
  })

  return NextResponse.json(
    {
      ok: true,
      snapshotSync: snapshotSync
        ? {
            synced: Number(snapshotSync.synced || 0),
            deleted: Number(snapshotSync.deleted || 0),
            changed: snapshotSync.changed === true,
            error: snapshotSync.error || null,
            stage: snapshotSync.stage || null,
          }
        : null,
    },
    { status: 200 },
  )
}

export async function GET(request) {
  return handleWebhook(request)
}

export async function POST(request) {
  return handleWebhook(request)
}
