import { NextResponse } from "next/server"

import { getPublicTopUpOffer, getPublicTopUpOffers, listPublicPlans } from "@/lib/public-planos-server"

export async function GET() {
  const [plans, topUpOffer, topUpOffers] = await Promise.all([
    listPublicPlans(),
    getPublicTopUpOffer(),
    getPublicTopUpOffers(),
  ])
  return NextResponse.json({ plans, topUpOffer, topUpOffers }, { status: 200 })
}
