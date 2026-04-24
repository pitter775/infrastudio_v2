"use client"

import { BILLING_INTENT_STORAGE_KEY } from "@/lib/public-planos"

export function buildBillingIntentPayload(item, projectId) {
  if (!projectId || !item) {
    return null
  }

  if (item.type === "topup") {
    return {
      type: "topup",
      projectId,
      price: item.price,
      tokens: item.tokens,
      createdAt: new Date().toISOString(),
    }
  }

  return {
    type: "plan",
    projectId,
    planId: item.id,
    planKey: item.key,
    planName: item.name,
    price: item.checkoutPrice ?? item.monthlyPrice,
    testMode: item.testMode || "",
    createdAt: new Date().toISOString(),
  }
}

export async function startBillingCheckout(intent, options = {}) {
  if (typeof window === "undefined" || !intent?.projectId) {
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
    checkoutUrl: payload?.checkoutUrl || "",
    registeredAt: new Date().toISOString(),
  }

  window.localStorage.setItem(BILLING_INTENT_STORAGE_KEY, JSON.stringify(persistedIntent))
  const resolvedCheckoutUrl = payload?.checkoutUrl || ""
  if (!resolvedCheckoutUrl) {
    return { ok: false, error: "Checkout indisponivel." }
  }

  window.open(resolvedCheckoutUrl, "_blank", "noopener,noreferrer")

  return { ok: true, intentId: persistedIntent.intentId }
}
