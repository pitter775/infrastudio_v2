import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const SITE_URL = "https://www.infrastudio.pro"

export const revalidate = 300

function parseDate(value, fallback) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export default async function sitemap() {
  const now = new Date()
  const supabase = getSupabaseAdminClient()

  const [storesResult, productsResult] = await Promise.all([
    supabase
      .from("mercadolivre_lojas")
      .select("slug, projeto_id, updated_at")
      .eq("ativo", true),
    supabase
      .from("mercadolivre_produtos_snapshot")
      .select("projeto_id, slug, updated_at")
      .eq("status", "active")
      .gt("estoque", 0),
  ])

  if (storesResult.error) {
    console.error("[sitemap] failed to load public stores", storesResult.error)
  }

  if (productsResult.error) {
    console.error("[sitemap] failed to load public store products", productsResult.error)
  }

  const stores = Array.isArray(storesResult.data)
    ? storesResult.data.filter((store) => store?.slug && store?.projeto_id)
    : []

  const storeSlugByProjectId = new Map(
    stores.map((store) => [String(store.projeto_id), String(store.slug).trim()])
  )

  const storeEntries = stores.map((store) => ({
    url: `${SITE_URL}/loja/${store.slug}`,
    lastModified: parseDate(store.updated_at, now),
    changeFrequency: "daily",
    priority: 0.8,
  }))

  const productEntries = Array.isArray(productsResult.data)
    ? productsResult.data
        .filter((product) => product?.slug && storeSlugByProjectId.has(String(product.projeto_id)))
        .map((product) => {
          const storeSlug = storeSlugByProjectId.get(String(product.projeto_id))
          return {
            url: `${SITE_URL}/loja/${storeSlug}/produto/${product.slug}`,
            lastModified: parseDate(product.updated_at, now),
            changeFrequency: "daily",
            priority: 0.7,
          }
        })
    : []

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/politica-de-privacidade`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...storeEntries,
    ...productEntries,
  ]
}
