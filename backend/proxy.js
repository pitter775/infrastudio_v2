import { NextResponse } from "next/server"

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token"

const PAGE_PROTECTED_PREFIXES = ["/admin"]
const API_PROTECTED_PREFIXES = ["/api/admin"]

function isProtectedPath(pathname, prefixes) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function buildLoginRedirect(request) {
  const redirectUrl = new URL("/", request.url)
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  redirectUrl.searchParams.set("returnTo", returnTo)
  return NextResponse.redirect(redirectUrl)
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isProtectedPage = isProtectedPath(pathname, PAGE_PROTECTED_PREFIXES)
  const isProtectedApi = isProtectedPath(pathname, API_PROTECTED_PREFIXES)

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    if (isProtectedApi) {
      return Response.json({ error: "Nao autenticado." }, { status: 401 })
    }

    return buildLoginRedirect(request)
  }

  try {
    const user = await verifySessionToken(token)

    if (user.status !== "ativo") {
      if (isProtectedApi) {
        return Response.json({ error: "Sessao invalida." }, { status: 401 })
      }

      return buildLoginRedirect(request)
    }

    return NextResponse.next()
  } catch {
    if (isProtectedApi) {
      return Response.json({ error: "Sessao invalida." }, { status: 401 })
    }

    return buildLoginRedirect(request)
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
