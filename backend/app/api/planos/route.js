import { NextResponse } from "next/server"

import { getPublicTopUpOffer, getPublicTopUpOffers, listPublicPlans } from "@/lib/public-planos-server"
import { getSessionUser } from "@/lib/session"

export async function GET() {
  const user = await getSessionUser()
  const isAdmin = user?.role === "admin"
  const [plans, topUpOffer, topUpOffers] = await Promise.all([
    listPublicPlans(),
    getPublicTopUpOffer(),
    getPublicTopUpOffers(),
  ])
  return NextResponse.json(
    {
      plans,
      topUpOffer,
      topUpOffers: isAdmin ? topUpOffers : topUpOffers.filter((offer) => offer?.id !== "topup-test-200k"),
      isAdmin,
    },
    { status: 200 },
  )
}
