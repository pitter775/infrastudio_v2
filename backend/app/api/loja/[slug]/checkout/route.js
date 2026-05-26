import { NextResponse } from "next/server"

import { createStoreCheckoutPreference } from "@/lib/mercado-pago-store"
import { cancelStoreCheckoutOrder, createStoreCheckoutOrder } from "@/lib/store-checkout"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export async function POST(request, { params }) {
  const { slug } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = getSupabaseAdminClient()
  const orderResult = await createStoreCheckoutOrder(
    {
      ...body,
      storeSlug: slug,
    },
    { supabase },
  )

  if (orderResult.error || !orderResult.order) {
    return NextResponse.json(
      {
        ok: false,
        error: orderResult.error || "Não foi possível criar o pedido.",
      },
      { status: 400 },
    )
  }

  const preferenceResult = await createStoreCheckoutPreference(orderResult, { supabase })

  if (!preferenceResult.ok) {
    await cancelStoreCheckoutOrder(orderResult.order.id, { supabase })

    return NextResponse.json(
      {
        ok: false,
        error: preferenceResult.error || "Não foi possível iniciar o pagamento.",
        order: {
          publicId: orderResult.order.publicId,
        },
      },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      checkoutUrl: preferenceResult.checkoutUrl,
      preferenceId: preferenceResult.preferenceId,
      order: {
        id: preferenceResult.order.id,
        publicId: preferenceResult.order.publicId,
        status: preferenceResult.order.status,
        paymentStatus: preferenceResult.order.paymentStatus,
        totalAmount: preferenceResult.order.totalAmount,
        currencyId: preferenceResult.order.currencyId,
      },
    },
    { status: 200 },
  )
}
