import { NextResponse } from "next/server"

import { completeMercadoLivreOAuthCallback } from "@/lib/mercado-livre-connector"
import { createLogEntry } from "@/lib/logs"

export async function GET(request) {
  const url = new URL(request.url)

  try {
    const result = await completeMercadoLivreOAuthCallback(url.searchParams, url.origin)
    return NextResponse.redirect(result.redirectUrl)
  } catch (error) {
    await createLogEntry({
      type: "mercado_livre_oauth",
      origin: "laboratorio",
      level: "error",
      description: "Callback do OAuth do Mercado Livre terminou em fallback.",
      payload: {
        event: "oauth_callback_route_error",
        callbackOrigin: url.origin,
        codePresent: url.searchParams.has("code"),
        statePresent: url.searchParams.has("state"),
        providerError:
          url.searchParams.get("error_description")?.trim() || url.searchParams.get("error")?.trim() || null,
        error: error instanceof Error ? error.message : "Falha no callback OAuth do Mercado Livre.",
        forcePersist: true,
        keep: true,
        sourceHint: "mercado_livre_oauth",
      },
    })
    const fallback = new URL("/admin/projetos", url.origin)
    fallback.searchParams.set("panel", "mercado-livre")
    fallback.searchParams.set("ml_notice", "oauth_error")
    return NextResponse.redirect(fallback)
  }
}
