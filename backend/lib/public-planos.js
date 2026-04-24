export const BILLING_INTENT_STORAGE_KEY = "infrastudio-billing-intent"

export const TEST_TOP_UP_OFFER = {
  id: "topup-test-200k",
  price: 1,
  tokens: 200000,
}

export const TOP_UP_OFFERS = [
  {
    id: "topup-500k",
    price: 25,
    tokens: 500000,
  },
  {
    id: "topup-1m",
    price: 50,
    tokens: 1000000,
  },
  {
    id: "topup-2-5m",
    price: 100,
    tokens: 2500000,
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

  if (normalized.includes("scale")) {
    return "scale"
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
