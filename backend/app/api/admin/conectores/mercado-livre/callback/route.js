import { NextResponse } from "next/server"

import { completeMercadoLivreOAuthCallback } from "@/lib/mercado-livre-connector"

export async function GET(request) {
  const url = new URL(request.url)

  try {
    const result = await completeMercadoLivreOAuthCallback(url.searchParams, url.origin)
    return NextResponse.redirect(result.redirectUrl)
  } catch (error) {
    const fallback = new URL("/admin/projetos", url.origin)
    fallback.searchParams.set("panel", "mercado-livre")
    fallback.searchParams.set("ml_notice", "oauth_error")
    return NextResponse.redirect(fallback)
  }
}
