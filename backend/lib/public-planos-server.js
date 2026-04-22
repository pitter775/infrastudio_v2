import "server-only"

import { listBillingPlans } from "@/lib/billing"
import {
  TOP_UP_OFFER,
  TOP_UP_OFFERS,
  getPlanCheckoutUrl,
  normalizePlanKey,
} from "@/lib/public-planos"

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
        checkoutUrl: getPlanCheckoutUrl(planKey),
      }
    })
}

export function getPublicTopUpOffer() {
  return { ...TOP_UP_OFFER, type: "topup", featured: true }
}

export function getPublicTopUpOffers() {
  return TOP_UP_OFFERS.map((offer, index) => ({
    ...offer,
    type: "topup",
    featured: index === 0,
  }))
}
