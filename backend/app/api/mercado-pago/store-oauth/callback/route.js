import { NextResponse } from "next/server"

import { createLogEntry } from "@/lib/logs"
import { completeMercadoPagoStoreOAuthCallback } from "@/lib/mercado-pago-store"

export async function GET(request) {
  const url = new URL(request.url)

  try {
    const result = await completeMercadoPagoStoreOAuthCallback(url.searchParams, url.origin)
    return NextResponse.redirect(new URL(result.redirectUrl, url.origin))
  } catch (error) {
    await createLogEntry({
      type: "store_mercado_pago_oauth_error",
      origin: "mercado_pago_store_oauth",
      level: "error",
      description: "Callback OAuth Mercado Pago da loja terminou em fallback.",
      payload: {
        codePresent: url.searchParams.has("code"),
        statePresent: url.searchParams.has("state"),
        providerError: url.searchParams.get("error_description")?.trim() || url.searchParams.get("error")?.trim() || null,
        error: error instanceof Error ? error.message : "Falha no callback OAuth Mercado Pago da loja.",
        forcePersist: true,
      },
    })

    const fallback = new URL("/app/projetos", url.origin)
    fallback.searchParams.set("mp_store_notice", "oauth_error")
    return NextResponse.redirect(fallback)
  }
}
