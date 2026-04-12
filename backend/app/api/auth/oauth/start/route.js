import { NextResponse } from "next/server"

import { buildSocialAuthorizationUrl } from "@/lib/social-oauth"

export async function GET(request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const provider = searchParams.get("provider")?.trim() || ""
    const url = await buildSocialAuthorizationUrl(provider, origin)

    return NextResponse.redirect(url)
  } catch (error) {
    console.error("[auth] social oauth start failed", error)
    const target = new URL("/", request.url)
    target.searchParams.set("auth_notice", "social_oauth_error")
    return NextResponse.redirect(target)
  }
}
