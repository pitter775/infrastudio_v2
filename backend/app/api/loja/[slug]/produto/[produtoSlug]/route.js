import { NextResponse } from "next/server"

import { getPublicMercadoLivreProductPage } from "@/lib/mercado-livre-store"

export async function GET(request, context) {
  const { slug, produtoSlug } = await context.params
  const url = new URL(request.url)
  const result = await getPublicMercadoLivreProductPage(slug, produtoSlug, {
    forceLiveDetails: url.searchParams.get("forceLiveDetails") === "1",
  })

  if (!result.store || !result.product) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 })
  }

  return NextResponse.json(result, { status: 200 })
}
