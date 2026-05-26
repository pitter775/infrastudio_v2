import { NextResponse } from "next/server"

import { calculateMercadoLivreShippingOptions } from "@/lib/mercado-livre-shipping"
import { getPublicMercadoLivreProductPage } from "@/lib/mercado-livre-store"

function sanitizeText(value, max = 0) {
  const normalized = String(value || "").trim()
  return max > 0 ? normalized.slice(0, max) : normalized
}

export async function POST(request, { params }) {
  const { slug } = await params
  const body = await request.json().catch(() => ({}))
  const productSlug = sanitizeText(body?.productSlug || body?.produtoSlug, 260)
  const zipCode = sanitizeText(body?.zipCode || body?.cep, 16)

  if (!productSlug) {
    return NextResponse.json({ options: [], error: "Produto não informado." }, { status: 400 })
  }

  const productResult = await getPublicMercadoLivreProductPage(slug, productSlug)
  const itemId = sanitizeText(productResult?.product?.itemId || productResult?.product?.id, 80)

  if (!productResult?.store || !productResult?.product || !itemId) {
    return NextResponse.json({ options: [], error: "Produto não encontrado." }, { status: 404 })
  }

  const result = await calculateMercadoLivreShippingOptions({
    itemId,
    zipCode,
  })

  if (result.error) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result, { status: 200 })
}
