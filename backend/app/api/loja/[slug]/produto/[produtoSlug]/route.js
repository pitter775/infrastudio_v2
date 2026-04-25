import { NextResponse } from "next/server"

import { getPublicMercadoLivreProductPage } from "@/lib/mercado-livre-store"

export async function GET(_request, context) {
  const { slug, produtoSlug } = await context.params
  const result = await getPublicMercadoLivreProductPage(slug, produtoSlug)

  if (!result.store || !result.product) {
    return NextResponse.json({ error: "Produto nao encontrado." }, { status: 404 })
  }

  return NextResponse.json(result, { status: 200 })
}
