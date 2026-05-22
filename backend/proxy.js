import { NextResponse } from "next/server"

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token"

const PAGE_PROTECTED_PREFIXES = ["/admin"]
const API_PROTECTED_PREFIXES = ["/api/admin"]
const STORE_DOMAIN_CACHE_TTL_MS = 60_000
const storeDomainCache = new Map()

const IGNORED_HOST_SUFFIXES = [
  ".vercel.app",
  ".localhost",
]

const IGNORED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "infrastudio.pro",
  "www.infrastudio.pro",
])

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

function normalizeHost(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

function shouldIgnoreHost(host) {
  if (!host || IGNORED_HOSTS.has(host)) {
    return true
  }

  return IGNORED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

function getDomainCandidates(host) {
  const normalizedHost = normalizeHost(host)
  const candidates = [normalizedHost]

  if (normalizedHost.startsWith("www.")) {
    candidates.push(normalizedHost.slice(4))
  } else if (normalizedHost) {
    candidates.push(`www.${normalizedHost}`)
  }

  return [...new Set(candidates.filter(Boolean))]
}

function buildSupabaseStoreLookupUrl(baseUrl, domain) {
  const url = new URL("/rest/v1/mercadolivre_lojas", baseUrl)
  url.searchParams.set("select", "slug")
  url.searchParams.set("dominio_personalizado", `eq.${domain}`)
  url.searchParams.set("dominio_ativo", "eq.true")
  url.searchParams.set("dominio_status", "eq.active")
  url.searchParams.set("ativo", "eq.true")
  url.searchParams.set("limit", "1")
  return url
}

async function fetchStoreSlugByDomain(domain) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseKey || !domain) {
    return null
  }

  const response = await fetch(buildSupabaseStoreLookupUrl(supabaseUrl, domain), {
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const rows = await response.json()
  const row = Array.isArray(rows) ? rows[0] : null
  return typeof row?.slug === "string" && row.slug.trim() ? row.slug.trim() : null
}

async function resolveStoreSlugByHost(host) {
  const normalizedHost = normalizeHost(host)
  if (shouldIgnoreHost(normalizedHost)) {
    return null
  }

  const cached = storeDomainCache.get(normalizedHost)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug
  }

  for (const domain of getDomainCandidates(normalizedHost)) {
    const slug = await fetchStoreSlugByDomain(domain)
    if (slug) {
      storeDomainCache.set(normalizedHost, {
        slug,
        expiresAt: Date.now() + STORE_DOMAIN_CACHE_TTL_MS,
      })
      return slug
    }
  }

  storeDomainCache.set(normalizedHost, {
    slug: null,
    expiresAt: Date.now() + STORE_DOMAIN_CACHE_TTL_MS,
  })
  return null
}

function buildStoreRewritePath(pathname, storeSlug) {
  if (pathname === "/" || pathname === "") {
    return `/loja/${storeSlug}`
  }

  if (pathname.startsWith("/produto/")) {
    return `/loja/${storeSlug}${pathname}`
  }

  if (pathname === "/opengraph-image") {
    return `/loja/${storeSlug}/opengraph-image`
  }

  return null
}

function buildStoreCanonicalRedirectUrl(request, storeSlug) {
  const pathname = request.nextUrl.pathname
  const storePath = `/loja/${storeSlug}`
  if (pathname === storePath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/"
    return redirectUrl
  }

  if (pathname.startsWith(`${storePath}/produto/`)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/produto/${pathname.slice(`${storePath}/produto/`.length)}`
    return redirectUrl
  }

  if (pathname === `${storePath}/opengraph-image`) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/opengraph-image"
    return redirectUrl
  }

  return null
}

async function handleCustomStoreDomain(request) {
  const storeSlug = await resolveStoreSlugByHost(request.headers.get("host"))
  if (!storeSlug) {
    return null
  }

  const redirectUrl = buildStoreCanonicalRedirectUrl(request, storeSlug)
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl, 308)
  }

  const rewritePath = buildStoreRewritePath(request.nextUrl.pathname, storeSlug)
  if (!rewritePath) {
    return null
  }

  const rewriteUrl = request.nextUrl.clone()
  rewriteUrl.pathname = rewritePath
  return NextResponse.rewrite(rewriteUrl)
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isProtectedPage = isProtectedPath(pathname, PAGE_PROTECTED_PREFIXES)
  const isProtectedApi = isProtectedPath(pathname, API_PROTECTED_PREFIXES)

  if (!isProtectedPage && !isProtectedApi) {
    return (await handleCustomStoreDomain(request)) || NextResponse.next()
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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/", "/loja/:path*", "/produto/:path*", "/opengraph-image"],
}
