export const BILLING_INTENT_STORAGE_KEY = "infrastudio-billing-intent"

export const PLAN_CHECKOUT_URLS = {
  basic:
    "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=0f2565c2c1f941a6bdc4a992d711c46b",
  plus:
    "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=40b1aca501e241918c5973a77984aefe",
  pro: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=214f913e06ba4a549c98453adbcd6f9c",
}

export const TOP_UP_OFFERS = [
  {
    id: "topup-100k",
    price: 20,
    tokens: 100000,
    checkoutUrl: "https://mpago.la/2sTv19y", //1,00
    // checkoutUrl: "https://mpago.la/33wFqKS", 20,00
  },
  {
    id: "topup-200k",
    price: 40,
    tokens: 200000,
    checkoutUrl: "https://mpago.la/114CqDS",
  },
  {
    id: "topup-300k",
    price: 60,
    tokens: 300000,
    checkoutUrl: "https://mpago.la/2nPcQjp",
  },
]

export const TOP_UP_OFFER = TOP_UP_OFFERS[0]

export function normalizePlanKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (!normalized) {
    return ""
  }

  if (normalized.includes("free") || normalized.includes("gratis") || normalized.includes("grátis")) {
    return "free"
  }

  if (normalized.includes("plus")) {
    return "plus"
  }

  if (normalized.includes("basic") || normalized.includes("starter") || normalized.includes("basico")) {
    return "basic"
  }

  if (normalized.includes("pro")) {
    return "pro"
  }

  return normalized.replace(/[^a-z0-9]+/g, "-")
}

export function formatPlanPrice(value, isFree = false) {
  if (isFree || Number(value || 0) <= 0) {
    return "R$ 0"
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

export function formatCredits(value) {
  if (value == null) {
    return "Créditos sob consulta"
  }

  return `${new Intl.NumberFormat("pt-BR").format(Number(value || 0))} créditos`
}

export function getPlanCheckoutUrl(planKey) {
  return PLAN_CHECKOUT_URLS[planKey] || ""
}

export function getTopUpCheckoutUrl() {
  return process.env.NEXT_PUBLIC_MERCADO_PAGO_TOPUP_URL?.trim() || TOP_UP_OFFER.checkoutUrl
}
