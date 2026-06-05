import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const SITE_URL = "https://www.infrastudio.pro"

function getStoreBaseUrl(store) {
  const customDomain = String(store?.dominio_personalizado || "").trim()
  const customDomainActive = store?.dominio_ativo === true && String(store?.dominio_status || "").trim() === "active"
  return customDomainActive && customDomain ? `https://${customDomain}` : `${SITE_URL}/loja/${store.slug}`
}

export async function GET(_request, { params }) {
  const { slug } = await params
  const normalizedSlug = String(slug || "").trim()
  const supabase = getSupabaseAdminClient()

  const { data: store, error } = await supabase
    .from("mercadolivre_lojas")
    .select("slug, dominio_personalizado, dominio_ativo, dominio_status")
    .eq("slug", normalizedSlug)
    .eq("ativo", true)
    .maybeSingle()

  if (error || !store?.slug) {
    return new NextResponse("User-agent: *\nDisallow: /\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  const baseUrl = getStoreBaseUrl(store)
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /app",
    "Disallow: /api",
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
  ].join("\n")

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  })
}
