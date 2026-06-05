import { NextResponse } from "next/server"

import { buildStoreProductRef } from "@/lib/mercado-livre-store-core/sanitize"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const SITE_URL = "https://www.infrastudio.pro"

function parseDate(value, fallback) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function getStoreBaseUrl(store) {
  const customDomain = String(store?.dominio_personalizado || "").trim()
  const customDomainActive = store?.dominio_ativo === true && String(store?.dominio_status || "").trim() === "active"
  return customDomainActive && customDomain ? `https://${customDomain}` : `${SITE_URL}/loja/${store.slug}`
}

function buildStoreUrl(store, pathname = "") {
  const baseUrl = getStoreBaseUrl(store)
  const normalizedPath = String(pathname || "").trim()
  if (!normalizedPath) {
    return baseUrl
  }

  return `${baseUrl}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`
}

function buildSitemap(entries) {
  const urls = entries
    .map((entry) => {
      const lastModified = entry.lastModified instanceof Date ? entry.lastModified.toISOString() : new Date().toISOString()
      return [
        "  <url>",
        `    <loc>${escapeXml(entry.url)}</loc>`,
        `    <lastmod>${lastModified}</lastmod>`,
        `    <changefreq>${entry.changeFrequency}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>",
      ].join("\n")
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export async function GET(_request, { params }) {
  const { slug } = await params
  const normalizedSlug = String(slug || "").trim()
  const now = new Date()
  const supabase = getSupabaseAdminClient()

  const { data: store, error: storeError } = await supabase
    .from("mercadolivre_lojas")
    .select("slug, projeto_id, updated_at, dominio_personalizado, dominio_ativo, dominio_status")
    .eq("slug", normalizedSlug)
    .eq("ativo", true)
    .maybeSingle()

  if (storeError || !store?.slug || !store?.projeto_id) {
    return new NextResponse("Not found", { status: 404 })
  }

  const { data: products, error: productsError } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("ml_item_id, slug, titulo, updated_at")
    .eq("projeto_id", store.projeto_id)
    .eq("status", "active")
    .gt("estoque", 0)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(500)

  if (productsError) {
    console.error("[store-sitemap] failed to load products", productsError)
  }

  const entries = [
    {
      url: buildStoreUrl(store),
      lastModified: parseDate(store.updated_at, now),
      changeFrequency: "daily",
      priority: "1.0",
    },
  ]

  for (const product of Array.isArray(products) ? products : []) {
    const productRef = buildStoreProductRef(product?.ml_item_id, product?.slug || product?.titulo)
    if (!productRef) {
      continue
    }

    entries.push({
      url: buildStoreUrl(store, `/produto/${productRef}`),
      lastModified: parseDate(product.updated_at, now),
      changeFrequency: "daily",
      priority: "0.8",
    })
  }

  return new NextResponse(buildSitemap(entries), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  })
}
