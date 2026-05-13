import { NextResponse } from "next/server"

import { completeGoogleCalendarOAuthCallback } from "@/lib/google-calendar"
import { createLogEntry } from "@/lib/logs"

export async function GET(request) {
  const url = new URL(request.url)

  try {
    const result = await completeGoogleCalendarOAuthCallback(url.searchParams, url.origin)
    return NextResponse.redirect(result.redirectUrl)
  } catch (error) {
    await createLogEntry({
      type: "google_calendar_oauth",
      origin: "google_calendar",
      level: "error",
      description: "Callback do OAuth do Google Agenda falhou.",
      payload: {
        callbackOrigin: url.origin,
        codePresent: url.searchParams.has("code"),
        statePresent: url.searchParams.has("state"),
        error: error instanceof Error ? error.message : "Falha no OAuth do Google Agenda.",
      },
    })
    const fallback = new URL("/admin/projetos", url.origin)
    fallback.searchParams.set("panel", "google-calendar")
    fallback.searchParams.set("google_calendar_notice", "oauth_error")
    return NextResponse.redirect(fallback)
  }
}
