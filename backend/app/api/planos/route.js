import { NextResponse } from "next/server"

import { getPublicTopUpOffer, listPublicPlans } from "@/lib/public-planos-server"

export async function GET() {
  const [plans, topUpOffer] = await Promise.all([listPublicPlans(), getPublicTopUpOffer()])
  return NextResponse.json({ plans, topUpOffer }, { status: 200 })
}
