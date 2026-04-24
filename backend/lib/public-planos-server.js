import "server-only"

import { listBillingPlans } from "@/lib/billing"
import { TEST_TOP_UP_OFFER, TOP_UP_OFFERS, normalizePlanKey } from "@/lib/public-planos"

const PLAN_CHECKOUT_URLS_BY_KEY = {
  basic:
    "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=0f2565c2c1f941a6bdc4a992d711c46b",
  plus:
    "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=40b1aca501e241918c5973a77984aefe",
  pro: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=214f913e06ba4a549c98453adbcd6f9c",
  scale: "",
}

export const TEST_BASIC_PLAN_CHECKOUT_URL = "https://mpago.la/2sTv19y"

export function getServerPlanCheckoutUrl(planKey) {
  return PLAN_CHECKOUT_URLS_BY_KEY[String(planKey || "").trim().toLowerCase()] || ""
}

export async function listPublicPlans() {
  const plans = await listBillingPlans()

  return plans
    .filter((plan) => plan?.active)
    .sort((first, second) => Number(first?.monthlyPrice || 0) - Number(second?.monthlyPrice || 0))
    .map((plan) => {
      const planKey = normalizePlanKey(plan.name)

      return {
        id: plan.id,
        key: planKey,
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        totalTokens: plan.limits?.totalTokens ?? null,
        isFree: plan.isFree,
        featured: planKey === "plus",
      }
    })
}

export function getPublicTopUpOffer() {
  return { ...TOP_UP_OFFERS[0], type: "topup", featured: true }
}

export function getPublicTopUpOffers() {
  return [TEST_TOP_UP_OFFER, ...TOP_UP_OFFERS].map((offer, index) => ({
    ...offer,
    type: "topup",
    featured: index === 0,
  }))
}
