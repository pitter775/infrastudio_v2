import { getSupabaseAdminClient } from "@/lib/supabase-admin"

import { normalizeSnapshotProduct, sanitizeText, sortSnapshotProducts } from "./sanitize"

async function listSnapshotProductsByProjectId(projectId, options = {}) {
  if (!projectId) {
    return { items: [], hasMore: false }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const page = Math.max(Number(options.page ?? 1) || 1, 1)
  const limit = Math.min(Math.max(Number(options.limit ?? 12) || 12, 1), 24)
  const offset = (page - 1) * limit
  const searchTerm = sanitizeText(options.searchTerm, 120).toLowerCase()
  const excludeSlug = sanitizeText(options.excludeSlug, 180)
  const categoryId = sanitizeText(options.categoryId, 80)
  const sort = sanitizeText(options.sort, 32) || "recent"

  let query = supabase
    .from("mercadolivre_produtos_snapshot")
    .select("id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, permalink, status, estoque, categoria_id, updated_at", {
      count: "exact",
    })
    .eq("projeto_id", projectId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (excludeSlug) {
    query = query.neq("slug", excludeSlug)
  }

  if (searchTerm) {
    query = query.ilike("titulo", `%${searchTerm}%`)
  }

  if (categoryId) {
    query = query.eq("categoria_id", categoryId)
  }

  const { data, error, count } = await query
  if (error) {
    console.error("[mercado-livre-store] failed to list snapshot products", error)
    return { items: [], hasMore: false }
  }

  const items = sortSnapshotProducts(Array.isArray(data) ? data.map(normalizeSnapshotProduct).filter(Boolean) : [], sort)
  return {
    items,
    hasMore: Number(count || 0) > offset + items.length,
  }
}

async function getSnapshotProductBySlug(projectId, productSlug, options = {}) {
  if (!projectId || !productSlug) {
    return null
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const normalizedSlug = sanitizeText(productSlug, 180)
  const { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, permalink, status, estoque, categoria_id, updated_at")
    .eq("projeto_id", projectId)
    .eq("slug", normalizedSlug)
    .maybeSingle()

  if (error) {
    console.error("[mercado-livre-store] failed to load snapshot product by slug", error)
    return null
  }

  return normalizeSnapshotProduct(data)
}

async function listSnapshotCategoryFacetsByProjectId(projectId, options = {}) {
  if (!projectId) {
    return []
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("categoria_id")
    .eq("projeto_id", projectId)
    .limit(200)

  if (error) {
    console.error("[mercado-livre-store] failed to list snapshot categories", error)
    return []
  }

  const unique = new Set()
  return (Array.isArray(data) ? data : [])
    .map((row) => sanitizeText(row.categoria_id, 80))
    .filter((value) => {
      if (!value || unique.has(value)) {
        return false
      }
      unique.add(value)
      return true
    })
    .slice(0, 12)
    .map((value) => ({
      id: value,
      label: value,
    }))
}

export { getSnapshotProductBySlug, listSnapshotCategoryFacetsByProjectId, listSnapshotProductsByProjectId }
