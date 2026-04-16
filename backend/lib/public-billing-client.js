"use client"

import { BILLING_INTENT_STORAGE_KEY } from "@/lib/public-planos"

export function buildBillingIntentPayload(item, projectId) {
  if (!item?.checkoutUrl || !projectId) {
    return null
  }

  if (item.type === "topup") {
    return {
      type: "topup",
      projectId,
      price: item.price,
      tokens: item.tokens,
      checkoutUrl: item.checkoutUrl,
      createdAt: new Date().toISOString(),
    }
  }

  return {
    type: "plan",
    projectId,
    planId: item.id,
    planKey: item.key,
    planName: item.name,
    price: item.monthlyPrice,
    checkoutUrl: item.checkoutUrl,
    createdAt: new Date().toISOString(),
  }
}

export async function startBillingCheckout(intent, options = {}) {
  if (typeof window === "undefined" || !intent?.projectId || !intent?.checkoutUrl) {
    return { ok: false, error: "Checkout invalido." }
  }

  const response = await fetch(`/api/app/projetos/${intent.projectId}/billing/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...intent,
      source: options.source || "app_checkout",
    }),
  }).catch(() => null)

  const payload = await response?.json().catch(() => ({}))

  if (!response?.ok) {
    return { ok: false, error: payload?.error || "Nao foi possivel registrar o checkout." }
  }

  const persistedIntent = {
    ...intent,
    intentId: payload?.intentId || null,
    registeredAt: new Date().toISOString(),
  }

  window.localStorage.setItem(BILLING_INTENT_STORAGE_KEY, JSON.stringify(persistedIntent))
  window.open(intent.checkoutUrl, "_blank", "noopener,noreferrer")

  return { ok: true, intentId: persistedIntent.intentId }
}
