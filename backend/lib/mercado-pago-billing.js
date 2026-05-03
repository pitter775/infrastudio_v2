import "server-only"

import crypto from "node:crypto"

import { createLogEntry } from "@/lib/logs"
import {
  listBillingPlans,
  refreshProjectBillingState,
  restartProjectBillingCycle,
  updateProjectBillingSettings,
} from "@/lib/billing"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase()
}

function toNumberOrNull(value) {
  if (value == null || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeWebhookTopic(value) {
  const normalized = String(value || "").trim().toLowerCase()

  if (normalized.includes("payment")) {
    return "payment"
  }

  if (normalized.includes("preapproval") || normalized.includes("subscription")) {
    return "preapproval"
  }

  return normalized
}

function extractMercadoPagoPlanReference(checkoutUrl) {
  try {
    const url = new URL(String(checkoutUrl || ""))
    return url.searchParams.get("preapproval_plan_id") || ""
  } catch {
    return ""
  }
}

function resolveMercadoPagoApiBaseUrl() {
  return process.env.MERCADO_PAGO_API_BASE_URL?.trim() || "https://api.mercadopago.com"
}

function resolveAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ""
  )
}

function buildIntentExternalReference(intentId, type) {
  return `infrastudio:${type}:${intentId}`
}

function parseIntentExternalReference(value) {
  const normalized = String(value || "").trim()
  const parts = normalized.split(":")

  if (parts.length !== 3 || parts[0] !== "infrastudio") {
    return null
  }

  return {
    type: parts[1],
    intentId: parts[2],
  }
}

function parseSignatureHeader(value) {
  const entries = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  const parsed = {}

  for (const entry of entries) {
    const [key, rawValue] = entry.split("=")
    if (key && rawValue) {
      parsed[key] = rawValue
    }
  }

  return {
    ts: parsed.ts || "",
    v1: parsed.v1 || "",
  }
}

function buildWebhookManifest({ dataId, xRequestId, ts }) {
  const parts = []

  if (dataId) {
    parts.push(`id:${String(dataId).toLowerCase()};`)
  }

  if (xRequestId) {
    parts.push(`request-id:${xRequestId};`)
  }

  if (ts) {
    parts.push(`ts:${ts};`)
  }

  return parts.join("")
}

async function fetchMercadoPagoResource({ type, resourceId, accessToken }) {
  if (!type || !resourceId || !accessToken) {
    return null
  }

  const path = type === "payment" ? `/v1/payments/${resourceId}` : `/preapproval/${resourceId}`
  const response = await fetch(`${resolveMercadoPagoApiBaseUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  }).catch(() => null)

  if (!response?.ok) {
    return null
  }

  return response.json().catch(() => null)
}

async function createMercadoPagoPreference({ title, quantity = 1, unitPrice, externalReference, payerEmail }) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || ""
  const appBaseUrl = resolveAppBaseUrl()

  if (!accessToken || !appBaseUrl) {
    return { ok: false, error: new Error("mercado_pago_env_missing") }
  }

  const successUrl = `${appBaseUrl}/pagamento/sucesso`
  const notificationUrl = `${appBaseUrl}/api/mercado-pago/webhook`

  const response = await fetch(`${resolveMercadoPagoApiBaseUrl()}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title,
          quantity,
          currency_id: "BRL",
          unit_price: Number(unitPrice || 0),
        },
      ],
      payer: payerEmail ? { email: payerEmail } : undefined,
      back_urls: {
        success: successUrl,
        pending: successUrl,
        failure: successUrl,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
      external_reference: externalReference,
    }),
    cache: "no-store",
  }).catch(() => null)

  const payload = await response?.json().catch(() => ({}))

  if (!response?.ok || !payload?.init_point) {
    return { ok: false, error: payload || new Error("mercado_pago_preference_failed") }
  }

  return {
    ok: true,
    preferenceId: payload.id || "",
    checkoutUrl: payload.init_point || payload.sandbox_init_point || "",
    payload,
  }
}

async function upsertPendingSubscription({ supabase, projectId, planId }) {
  const now = new Date().toISOString()
  const existing = await supabase
    .from("projetos_assinaturas")
    .select("id, status")
    .eq("projeto_id", projectId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (existing.error && existing.error.code !== "PGRST116") {
    return { ok: false, error: existing.error }
  }

  const payload = {
    projeto_id: projectId,
    plano_id: planId,
    status: "aguardando_confirmacao",
    data_inicio: now,
    data_fim: null,
    renovar_automatico: true,
    updated_at: now,
  }

  if (existing.data?.id) {
    const { error } = await supabase.from("projetos_assinaturas").update(payload).eq("id", existing.data.id)
    return error ? { ok: false, error } : { ok: true }
  }

  const { error } = await supabase.from("projetos_assinaturas").insert({
    ...payload,
    created_at: now,
  })

  return error ? { ok: false, error } : { ok: true }
}

async function confirmProjectPlan({ supabase, intent, plan, resourceId, resourcePayload }) {
  const now = new Date().toISOString()

  await updateProjectBillingSettings(
    {
      projectId: intent.projeto_id,
      planId: plan.id,
      planName: plan.name,
      referenceModel: "gpt-4o-mini",
      autoBlock: true,
      blocked: false,
      blockedReason: "",
      notes: "Plano confirmado via webhook Mercado Pago.",
      limits: {
        inputTokens: plan.limits?.inputTokens ?? null,
        outputTokens: plan.limits?.outputTokens ?? null,
        totalTokens: plan.limits?.totalTokens ?? null,
        monthlyCost: plan.limits?.monthlyCost ?? null,
      },
    },
    { supabase },
  )

  const subscription = await supabase
    .from("projetos_assinaturas")
    .select("id")
    .eq("projeto_id", intent.projeto_id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const subscriptionPayload = {
    projeto_id: intent.projeto_id,
    plano_id: plan.id,
    status: "ativo",
    data_inicio: now,
    data_fim: null,
    renovar_automatico: true,
    updated_at: now,
  }

  if (subscription.data?.id) {
    await supabase.from("projetos_assinaturas").update(subscriptionPayload).eq("id", subscription.data.id)
  } else {
    await supabase.from("projetos_assinaturas").insert({
      ...subscriptionPayload,
      created_at: now,
    })
  }

  await restartProjectBillingCycle(
    intent.projeto_id,
    {
      planId: plan.id,
      limits: {
        inputTokens: plan.limits?.inputTokens ?? null,
        outputTokens: plan.limits?.outputTokens ?? null,
        totalTokens: plan.limits?.totalTokens ?? null,
        monthlyCost: plan.limits?.monthlyCost ?? null,
      },
      allowOverage: plan.allowOverage === true,
      overageTokenCost: plan.overageTokenCost ?? 0,
    },
    { supabase },
  )

  await supabase
    .from("projetos_checkout_intencoes")
    .update({
      status: "confirmado",
      confirmado_at: now,
      updated_at: now,
      mercado_pago_recurso_tipo: "preapproval",
      mercado_pago_recurso_id: String(resourceId || ""),
      metadata: {
        ...((intent.metadata && typeof intent.metadata === "object") ? intent.metadata : {}),
        webhookPayload: resourcePayload,
      },
    })
    .eq("id", intent.id)

  await createLogEntry(
    {
      projectId: intent.projeto_id,
      type: "billing_plan_confirmed",
      origin: "mercado_pago_webhook",
      level: "info",
      description: `Plano ${plan.name} confirmado via webhook.`,
      payload: {
        planId: plan.id,
        planName: plan.name,
        mercadoPagoResourceId: String(resourceId || ""),
      },
    },
    { supabase },
  )
}

async function confirmProjectTopUp({ supabase, intent, resourceId, resourcePayload }) {
  const now = new Date().toISOString()
  const tokens = Number(intent.tokens || 0)
  const cost = toNumberOrNull(intent.valor) ?? 0

  await supabase.from("tokens_avulsos").insert({
    projeto_id: intent.projeto_id,
    tokens,
    custo: cost,
    origem: "mercado_pago",
    utilizado: false,
    tokens_utilizados: 0,
    created_at: now,
  })

  await supabase
    .from("projetos_checkout_intencoes")
    .update({
      status: "confirmado",
      confirmado_at: now,
      updated_at: now,
      mercado_pago_recurso_tipo: "payment",
      mercado_pago_recurso_id: String(resourceId || ""),
      metadata: {
        ...((intent.metadata && typeof intent.metadata === "object") ? intent.metadata : {}),
        webhookPayload: resourcePayload,
      },
    })
    .eq("id", intent.id)

  const billingState = await refreshProjectBillingState(intent.projeto_id, { supabase })

  await createLogEntry(
    {
      projectId: intent.projeto_id,
      type: "billing_topup_confirmed",
      origin: "mercado_pago_webhook",
      level: "info",
      description: `Recarga de ${tokens} tokens confirmada via webhook.`,
      payload: {
        tokens,
        cost,
        billingState,
        intentId: intent.id,
        mercadoPagoResourceId: String(resourceId || ""),
      },
    },
    { supabase },
  )
}

export async function createCheckoutIntent(input, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const now = new Date().toISOString()
  const payload = {
    projeto_id: input.projectId,
    usuario_id: input.userId || null,
    usuario_email: normalizeEmail(input.userEmail),
    tipo: input.type === "topup" ? "topup" : "plan",
    status: "pendente",
    plano_id: input.planId || null,
    plano_nome: input.planName || null,
    plano_key: input.planKey || null,
    valor: toNumberOrNull(input.price),
    tokens: input.tokens == null ? null : Number(input.tokens || 0),
    checkout_url: input.checkoutUrl || null,
    origem: input.origin || "mercado_pago",
    metadata: {
      source: input.source || "app_checkout",
      mercadoPagoPlanReference: extractMercadoPagoPlanReference(input.checkoutUrl),
    },
    updated_at: now,
  }

  const existing = await supabase
    .from("projetos_checkout_intencoes")
    .select("id")
    .eq("projeto_id", input.projectId)
    .eq("tipo", payload.tipo)
    .eq("status", "pendente")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (existing.error && existing.error.code !== "PGRST116") {
    return { ok: false, error: existing.error }
  }

  let intentId = existing.data?.id || null

  if (intentId) {
    const { error } = await supabase.from("projetos_checkout_intencoes").update(payload).eq("id", intentId)
    if (error) {
      return { ok: false, error }
    }
  } else {
    const created = await supabase
      .from("projetos_checkout_intencoes")
      .insert({
        ...payload,
        created_at: now,
      })
      .select("id")
      .maybeSingle()

    if (created.error || !created.data?.id) {
      return { ok: false, error: created.error || new Error("intent_not_created") }
    }

    intentId = created.data.id
  }

  if (payload.tipo === "plan" && input.planId) {
    const subscriptionResult = await upsertPendingSubscription({
      supabase,
      projectId: input.projectId,
      planId: input.planId,
    })

    if (!subscriptionResult.ok) {
      return { ok: false, error: subscriptionResult.error }
    }
  }

  return { ok: true, intentId }
}

export async function createTopUpCheckoutPreference(input, deps = {}) {
  const intentResult = await createCheckoutIntent(input, deps)

  if (!intentResult.ok || !intentResult.intentId) {
    return intentResult
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const externalReference = buildIntentExternalReference(intentResult.intentId, "topup")
  const preferenceResult = await createMercadoPagoPreference({
    title: input.title || "Recarga de creditos InfraStudio",
    quantity: 1,
    unitPrice: input.price,
    externalReference,
    payerEmail: normalizeEmail(input.userEmail),
  })

  if (!preferenceResult.ok) {
    await supabase
      .from("projetos_checkout_intencoes")
      .update({
        status: "falhou",
        updated_at: new Date().toISOString(),
        metadata: {
          source: input.source || "app_checkout",
          mercadoPagoPreferenceError: preferenceResult.error,
        },
      })
      .eq("id", intentResult.intentId)

    return { ok: false, error: preferenceResult.error }
  }

  await supabase
    .from("projetos_checkout_intencoes")
    .update({
      checkout_url: preferenceResult.checkoutUrl,
      updated_at: new Date().toISOString(),
      metadata: {
        source: input.source || "app_checkout",
        mercadoPagoPreferenceId: preferenceResult.preferenceId,
        externalReference,
      },
    })
    .eq("id", intentResult.intentId)

  return {
    ok: true,
    intentId: intentResult.intentId,
    checkoutUrl: preferenceResult.checkoutUrl,
    externalReference,
  }
}

export function validateMercadoPagoWebhookSignature(input) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() || ""

  if (!secret) {
    return { valid: true, skipped: true, reason: "secret_not_configured" }
  }

  const { ts, v1 } = parseSignatureHeader(input.xSignature)
  if (!ts || !v1) {
    return { valid: false, reason: "missing_x_signature" }
  }

  const manifest = buildWebhookManifest({
    dataId: input.dataId,
    xRequestId: input.xRequestId,
    ts,
  })

  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(String(v1))
  const valid =
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)

  return {
    valid,
    skipped: false,
    reason: valid ? null : "invalid_signature",
    manifest,
  }
}

export async function processMercadoPagoWebhook(notification, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || ""
  const topic = normalizeWebhookTopic(notification.topic || notification.type || notification.action)
  const resourceId = String(notification.resourceId || notification.data?.id || notification.id || "").trim()

  if (!topic || !resourceId || !accessToken) {
    return { ok: false, reason: "missing_topic_resource_or_token" }
  }

  const resource = await fetchMercadoPagoResource({
    type: topic,
    resourceId,
    accessToken,
  })

  if (!resource) {
    return { ok: false, reason: "resource_not_found" }
  }

  const payerEmail = normalizeEmail(
    resource.payer?.email ||
      resource.external_reference ||
      resource.reason ||
      resource.metadata?.payer_email,
  )

  if (topic === "preapproval") {
    const externalStatus = String(resource.status || "").toLowerCase()
    if (!["authorized", "active"].includes(externalStatus)) {
      return { ok: true, ignored: true, reason: "preapproval_not_authorized" }
    }

    const planId = resource.preapproval_plan_id || null
    let query = supabase
      .from("projetos_checkout_intencoes")
      .select("id, projeto_id, usuario_email, plano_id, plano_nome, plano_key, tipo, metadata")
      .eq("tipo", "plan")
      .eq("status", "pendente")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(10)

    if (payerEmail) {
      query = query.eq("usuario_email", payerEmail)
    }

    const intentsResult = await query
    const intents = intentsResult.data ?? []
    const intent =
      intents.find((item) => !planId || item.metadata?.mercadoPagoPlanReference === planId) ||
      intents.find((item) => !planId || String(item.plano_key || "").length > 0) ||
      null

    if (!intent?.id || !intent.projeto_id || !intent.plano_id) {
      return { ok: true, ignored: true, reason: "pending_plan_intent_not_found" }
    }

    const plans = await listBillingPlans({ supabase })
    const plan = plans.find((item) => item.id === intent.plano_id)

    if (!plan) {
      return { ok: false, reason: "plan_not_found" }
    }

    await confirmProjectPlan({
      supabase,
      intent,
      plan,
      resourceId,
      resourcePayload: resource,
    })

    return { ok: true, type: "plan", projectId: intent.projeto_id }
  }

  if (topic === "payment") {
    const paymentStatus = String(resource.status || "").toLowerCase()
    if (paymentStatus !== "approved") {
      return { ok: true, ignored: true, reason: "payment_not_approved" }
    }

    const externalReference = parseIntentExternalReference(resource.external_reference)

    if (externalReference?.type === "topup" && externalReference.intentId) {
      const intentResult = await supabase
        .from("projetos_checkout_intencoes")
        .select("id, projeto_id, usuario_email, valor, tokens, tipo, metadata")
        .eq("id", externalReference.intentId)
        .eq("tipo", "topup")
        .eq("status", "pendente")
        .maybeSingle()

      if (intentResult.data?.id && intentResult.data?.projeto_id) {
        await confirmProjectTopUp({
          supabase,
          intent: intentResult.data,
          resourceId,
          resourcePayload: resource,
        })

        return { ok: true, type: "topup", projectId: intentResult.data.projeto_id }
      }
    }

    let query = supabase
      .from("projetos_checkout_intencoes")
      .select("id, projeto_id, usuario_email, valor, tokens, tipo, metadata")
      .eq("tipo", "topup")
      .eq("status", "pendente")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(10)

    if (payerEmail) {
      query = query.eq("usuario_email", payerEmail)
    }

    const intentsResult = await query
    const intents = intentsResult.data ?? []
    const totalPaid = toNumberOrNull(resource.transaction_amount)
    const intent =
      intents.find((item) => totalPaid == null || toNumberOrNull(item.valor) === totalPaid) ||
      intents[0] ||
      null

    if (!intent?.id || !intent.projeto_id) {
      return { ok: true, ignored: true, reason: "pending_topup_intent_not_found" }
    }

    await confirmProjectTopUp({
      supabase,
      intent,
      resourceId,
      resourcePayload: resource,
    })

    return { ok: true, type: "topup", projectId: intent.projeto_id }
  }

  return { ok: true, ignored: true, reason: "unsupported_topic" }
}
