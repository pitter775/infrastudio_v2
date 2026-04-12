import { NextResponse } from "next/server"

import { completeSocialOAuthCallback } from "@/lib/social-oauth"

export async function GET(request) {
  const url = new URL(request.url)

  try {
    const user = await completeSocialOAuthCallback(url.searchParams, url.origin)
    return NextResponse.redirect(new URL(user.role === "admin" ? "/admin/dashboard" : "/app/projetos", url.origin))
  } catch (error) {
    console.error("[auth] social oauth callback failed", error)
    const target = new URL("/", url.origin)
    target.searchParams.set("auth_notice", "social_oauth_error")
    return NextResponse.redirect(target)
  }
}
