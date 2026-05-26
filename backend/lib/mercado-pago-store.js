import "server-only"

import crypto from "node:crypto"
import { SignJWT, jwtVerify } from "jose"

import { createLogEntry } from "@/lib/logs"
import {
  confirmStoreOrderPayment,
  getStoreOrderByExternalReference,
  updateStoreOrderPaymentPreference,
} from "@/lib/store-checkout"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function sanitizeText(value, max = 0) {
  const normalized = String(value || "").trim()
  return max > 0 ? normalized.slice(0, max) : normalized
}

function normalizeEmail(value) {
  return sanitizeText(value, 180).toLowerCase()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

function parseSignatureHeader(value) {
  const parsed = {}
  for (const entry of String(value || "").split(",")) {
    const [key, rawValue] = entry.trim().split("=")
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
  if (dataId) parts.push(`id:${String(dataId).toLowerCase()};`)
  if (xRequestId) parts.push(`request-id:${xRequestId};`)
  if (ts) parts.push(`ts:${ts};`)
  return parts.join("")
}

function getStoreAccessToken() {
  return process.env.MERCADO_PAGO_STORE_ACCESS_TOKEN?.trim() || ""
}

function getAppAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("APP_AUTH_SECRET não configurado.")
  }

  return new TextEncoder().encode(secret)
}

function getEncryptionKey() {
  const secret = process.env.APP_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("APP_AUTH_SECRET não configurado.")
  }

  return crypto.createHash("sha256").update(secret).digest()
}

function encryptSecret(value) {
  const text = String(value || "")
  if (!text) {
    return ""
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `mpstore:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`
}

function decryptSecret(value) {
  const text = String(value || "")
  if (!text.startsWith("mpstore:v1:")) {
    return ""
  }

  const [, , ivValue, tagValue, encryptedValue] = text.split(":")
  if (!ivValue || !tagValue || !encryptedValue) {
    return ""
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"))
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return ""
  }
}

function resolveStoreOAuthConfig(origin) {
  const appBaseUrl = resolveAppBaseUrl() || sanitizeText(origin, 240) || "http://localhost:3000"
  return {
    clientId:
      process.env.MERCADO_PAGO_STORE_CLIENT_ID?.trim() ||
      process.env.MERCADO_PAGO_CLIENT_ID?.trim() ||
      "",
    clientSecret:
      process.env.MERCADO_PAGO_STORE_CLIENT_SECRET?.trim() ||
      process.env.MERCADO_PAGO_CLIENT_SECRET?.trim() ||
      "",
    redirectUri: `${appBaseUrl}/api/mercado-pago/store-oauth/callback`,
  }
}

async function signStoreOAuthState(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAppAuthSecret())
}

async function verifyStoreOAuthState(token) {
  const { payload } = await jwtVerify(token, getAppAuthSecret())
  return {
    projectId: sanitizeText(payload.projectId, 80),
    userId: sanitizeText(payload.userId, 80),
  }
}

function shouldRefreshToken(expiresAt) {
  const expiresTime = Date.parse(String(expiresAt || ""))
  return Number.isFinite(expiresTime) && expiresTime - Date.now() < 10 * 60 * 1000
}

async function refreshStoreAccessToken(row, deps = {}) {
  const refreshToken = decryptSecret(row?.refresh_token_encrypted)
  if (!row?.projeto_id || !refreshToken) {
    return decryptSecret(row?.access_token_encrypted)
  }

  const config = resolveStoreOAuthConfig(deps.origin)
  if (!config.clientId || !config.clientSecret) {
    return decryptSecret(row.access_token_encrypted)
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const response = await fetchImpl(`${resolveMercadoPagoApiBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  }).catch(() => null)
  const payload = await response?.json().catch(() => ({}))

  if (!response?.ok || !payload?.access_token) {
    return decryptSecret(row.access_token_encrypted)
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const now = new Date().toISOString()
  const expiresIn = Number(payload.expires_in || 0)
  const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

  await supabase
    .from("loja_pagamento_config")
    .update({
      status: "conectado",
      access_token_encrypted: encryptSecret(payload.access_token),
      refresh_token_encrypted: encryptSecret(payload.refresh_token || refreshToken),
      token_expires_at: tokenExpiresAt,
      last_validated_at: now,
      last_error_message: null,
      updated_at: now,
    })
    .eq("id", row.id)

  return payload.access_token
}

async function getConnectedStoreAccessToken(projectId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("loja_pagamento_config")
    .select("id, projeto_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, status")
    .eq("projeto_id", projectId)
    .eq("provider", "mercado_pago")
    .eq("status", "conectado")
    .maybeSingle()

  if (error || !data?.access_token_encrypted) {
    return ""
  }

  if (shouldRefreshToken(data.token_expires_at)) {
    return refreshStoreAccessToken(data, deps)
  }

  return decryptSecret(data.access_token_encrypted)
}

async function listConnectedStoreAccessTokens(notification = {}, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const accountId = sanitizeText(notification.userId, 80)
  let query = supabase
    .from("loja_pagamento_config")
    .select("id, projeto_id, account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("provider", "mercado_pago")
    .eq("status", "conectado")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(50)

  if (accountId) {
    query = query.eq("account_id", accountId)
  }

  const { data, error } = await query
  if (error) {
    console.error("[mercado-pago-store] failed to list connected store tokens", error)
    return []
  }

  const tokens = []
  for (const row of data || []) {
    const accessToken = shouldRefreshToken(row.token_expires_at)
      ? await refreshStoreAccessToken(row, deps)
      : decryptSecret(row.access_token_encrypted)

    if (accessToken) {
      tokens.push({
        projectId: row.projeto_id,
        accountId: row.account_id || "",
        accessToken,
      })
    }
  }

  return tokens
}

export async function buildMercadoPagoStoreAuthorizationUrl(project, user, origin) {
  if (!project?.id || !user?.id) {
    throw new Error("Projeto não encontrado.")
  }

  const config = resolveStoreOAuthConfig(origin)
  if (!config.clientId || !config.clientSecret) {
    throw new Error("OAuth Mercado Pago da loja não configurado no servidor.")
  }

  const state = await signStoreOAuthState({ projectId: project.id, userId: user.id })
  const url = new URL("https://auth.mercadopago.com.br/authorization")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("platform_id", "mp")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("scope", "offline_access")
  return url.toString()
}

export async function completeMercadoPagoStoreOAuthCallback(searchParams, origin, deps = {}) {
  const code = searchParams.get("code")?.trim() || ""
  const state = searchParams.get("state")?.trim() || ""
  const providerError = searchParams.get("error_description")?.trim() || searchParams.get("error")?.trim() || ""

  if (providerError) {
    throw new Error(providerError)
  }

  if (!code || !state) {
    throw new Error("Retorno OAuth Mercado Pago incompleto.")
  }

  const parsedState = await verifyStoreOAuthState(state)
  if (!parsedState.projectId) {
    throw new Error("Estado OAuth Mercado Pago inválido.")
  }

  const config = resolveStoreOAuthConfig(origin)
  const fetchImpl = deps.fetchImpl ?? fetch
  const tokenResponse = await fetchImpl(`${resolveMercadoPagoApiBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  })
  const tokenPayload = await tokenResponse.json().catch(() => ({}))

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload?.message || tokenPayload?.error || "Falha ao conectar Mercado Pago da loja.")
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const now = new Date().toISOString()
  const expiresIn = Number(tokenPayload.expires_in || 0)
  const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

  const { data: store } = await supabase
    .from("mercadolivre_lojas")
    .select("id")
    .eq("projeto_id", parsedState.projectId)
    .maybeSingle()

  const { error } = await supabase
    .from("loja_pagamento_config")
    .upsert(
      {
        projeto_id: parsedState.projectId,
        loja_id: store?.id || null,
        provider: "mercado_pago",
        status: "conectado",
        mode: "production",
        access_token_encrypted: encryptSecret(tokenPayload.access_token),
        refresh_token_encrypted: encryptSecret(tokenPayload.refresh_token || ""),
        token_expires_at: tokenExpiresAt,
        connected_at: now,
        last_validated_at: now,
        last_error_message: null,
        account_id: tokenPayload.user_id ? String(tokenPayload.user_id) : null,
        metadata: {
          scope: tokenPayload.scope || null,
          tokenType: tokenPayload.token_type || null,
          publicKey: tokenPayload.public_key || null,
          liveMode: tokenPayload.live_mode ?? null,
        },
        updated_at: now,
      },
      { onConflict: "projeto_id,provider" },
    )

  if (error) {
    throw error
  }

  await createLogEntry(
    {
      projectId: parsedState.projectId,
      type: "store_mercado_pago_connected",
      origin: "mercado_pago_store_oauth",
      level: "info",
      description: "Mercado Pago da loja conectado com sucesso.",
      payload: {
        accountId: tokenPayload.user_id ? String(tokenPayload.user_id) : null,
        forcePersist: true,
      },
    },
    { supabase },
  )

  return {
    projectId: parsedState.projectId,
    redirectUrl: `/app/projetos/${parsedState.projectId}?panel=mercado-livre&section=loja-pagamentos&mp_store_notice=connected`,
  }
}

export function validateMercadoPagoStoreWebhookSignature(input) {
  const secret =
    process.env.MERCADO_PAGO_STORE_WEBHOOK_SECRET?.trim() ||
    process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ||
    ""

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

async function fetchMercadoPagoPayment(paymentId, accessToken, deps = {}) {
  if (!paymentId || !accessToken) {
    return null
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const response = await fetchImpl(`${resolveMercadoPagoApiBaseUrl()}/v1/payments/${encodeURIComponent(paymentId)}`, {
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

export async function createStoreCheckoutPreference({ order, product, store }, deps = {}) {
  const accessToken = await getConnectedStoreAccessToken(order.projectId, deps) || getStoreAccessToken()
  const appBaseUrl = resolveAppBaseUrl()

  if (!accessToken) {
    return { ok: false, error: "Configure MERCADO_PAGO_STORE_ACCESS_TOKEN para o checkout da loja." }
  }

  if (!appBaseUrl) {
    return { ok: false, error: "Configure APP_URL ou NEXT_PUBLIC_APP_URL para gerar o checkout." }
  }

  const successUrl = `${appBaseUrl}/loja/${encodeURIComponent(store.slug)}/pagamento/sucesso?pedido=${encodeURIComponent(order.publicId)}`
  const notificationUrl = `${appBaseUrl}/api/mercado-pago/store-webhook`
  const fetchImpl = deps.fetchImpl ?? fetch
  const response = await fetchImpl(`${resolveMercadoPagoApiBaseUrl()}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id: product.itemId || product.id || product.slug,
          title: product.variationLabel ? `${product.title} - ${product.variationLabel}` : product.title,
          quantity: 1,
          currency_id: order.currencyId || "BRL",
          unit_price: toNumber(product.price),
          picture_url: product.thumbnail || undefined,
        },
      ],
      payer: {
        name: order.buyerName || undefined,
        email: normalizeEmail(order.buyerEmail) || undefined,
        phone: order.buyerPhone ? { number: order.buyerPhone } : undefined,
      },
      shipments: order.shippingZipCode
        ? {
            zip_code: order.shippingZipCode,
            cost: toNumber(order.shippingAmount),
            mode: "not_specified",
          }
        : undefined,
      back_urls: {
        success: successUrl,
        pending: successUrl,
        failure: successUrl,
      },
      auto_return: "approved",
      notification_url: notificationUrl,
      external_reference: order.externalReference,
      metadata: {
        store_slug: store.slug,
        store_id: store.id,
        project_id: store.projeto_id,
        order_public_id: order.publicId,
      },
    }),
    cache: "no-store",
  }).catch(() => null)

  const payload = await response?.json().catch(() => ({}))
  const checkoutUrl = payload?.init_point || payload?.sandbox_init_point || ""

  if (!response?.ok || !checkoutUrl) {
    return { ok: false, error: payload?.message || payload?.error || "Não foi possível criar o checkout da loja." }
  }

  const updatedOrder = await updateStoreOrderPaymentPreference(
    order.id,
    {
      preferenceId: payload.id || "",
      metadata: {
        mercadoPagoPreferenceId: payload.id || "",
        checkoutUrl,
      },
    },
    deps,
  )

  return {
    ok: true,
    order: updatedOrder,
    preferenceId: payload.id || "",
    checkoutUrl,
  }
}

export async function processMercadoPagoStoreWebhook(notification, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const resourceId = sanitizeText(notification.resourceId || notification.data?.id || notification.id, 120)
  const topic = sanitizeText(notification.type || notification.topic || notification.action, 80).toLowerCase()

  if (!resourceId || !topic.includes("payment")) {
    return { ok: true, ignored: true, reason: "missing_resource_or_unsupported_topic" }
  }

  const candidates = []
  const fallbackToken = getStoreAccessToken()
  if (fallbackToken) {
    candidates.push({ projectId: null, accessToken: fallbackToken, source: "env" })
  }

  candidates.push(...(await listConnectedStoreAccessTokens(notification, { ...deps, supabase })))

  let payment = null
  for (const candidate of candidates) {
    payment = await fetchMercadoPagoPayment(resourceId, candidate.accessToken, deps)
    if (payment?.id) {
      break
    }
  }

  if (!payment) {
    return { ok: false, reason: "payment_not_found" }
  }

  const externalReference = sanitizeText(payment.external_reference, 180)
  const order = await getStoreOrderByExternalReference(externalReference, { supabase })
  if (!order?.id) {
    return { ok: true, ignored: true, reason: "store_order_not_found" }
  }

  const updatedOrder = await confirmStoreOrderPayment(
    {
      order,
      payment,
      rawPayload: {
        id: payment.id,
        status: payment.status,
        statusDetail: payment.status_detail,
        transactionAmount: payment.transaction_amount,
        externalReference,
      },
    },
    { supabase },
  )

  await createLogEntry(
    {
      projectId: updatedOrder.projectId,
      type: "store_payment_confirmed",
      origin: "mercado_pago_store_webhook",
      level: "info",
      description: `Pagamento da loja confirmado para o pedido ${updatedOrder.publicId}.`,
      payload: {
        orderId: updatedOrder.id,
        publicId: updatedOrder.publicId,
        paymentId: payment.id,
        status: payment.status,
        forcePersist: true,
      },
    },
    { supabase },
  )

  return {
    ok: true,
    type: "store_order",
    projectId: updatedOrder.projectId,
    orderId: updatedOrder.id,
    publicId: updatedOrder.publicId,
  }
}
