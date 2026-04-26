import { getSupabaseAdminClient } from "@/lib/supabase-admin"

import { isStoreProductAvailable, normalizeSnapshotProduct, sanitizeText } from "./sanitize"

const SNAPSHOT_SELECT_WITH_IMAGES =
  "id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, imagens_json, permalink, status, estoque, categoria_id, categoria_nome, descricao_curta, descricao_longa, atributos_json, updated_at"
const SNAPSHOT_SELECT_LEGACY =
  "id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, permalink, status, estoque, categoria_id, updated_at"

function isMissingSnapshotFieldError(error) {
  const message = String(error?.message || error || "")
  return /imagens_json/i.test(message) || /categoria_nome/i.test(message) || /descricao_curta/i.test(message) || /descricao_longa/i.test(message) || /atributos_json/i.test(message)
}

function applySnapshotSort(query, sort) {
  if (sort === "price_asc") {
    return query
      .order("preco", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
  }

  if (sort === "price_desc") {
    return query
      .order("preco", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
  }

  if (sort === "title") {
    return query
      .order("titulo", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
  }

  return query.order("updated_at", { ascending: false, nullsFirst: false })
}

function applySnapshotAvailabilityFilters(query) {
  return query.eq("status", "active").gt("estoque", 0)
}

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

  let query = applySnapshotSort(
    applySnapshotAvailabilityFilters(
      supabase
        .from("mercadolivre_produtos_snapshot")
        .select(SNAPSHOT_SELECT_WITH_IMAGES, {
          count: "exact",
        })
        .eq("projeto_id", projectId)
    ),
    sort
  )

  if (excludeSlug) {
    query = query.neq("slug", excludeSlug)
  }

  if (searchTerm) {
    query = query.ilike("titulo", `%${searchTerm}%`)
  }

  if (categoryId) {
    query = query.eq("categoria_id", categoryId)
  }

  query = query.range(offset, offset + limit - 1)

  let { data, error, count } = await query
  if (error && isMissingSnapshotFieldError(error)) {
    let fallbackQuery = applySnapshotSort(
      applySnapshotAvailabilityFilters(
        supabase
          .from("mercadolivre_produtos_snapshot")
          .select(SNAPSHOT_SELECT_LEGACY, {
            count: "exact",
          })
          .eq("projeto_id", projectId)
      ),
      sort
    )

    if (excludeSlug) {
      fallbackQuery = fallbackQuery.neq("slug", excludeSlug)
    }

    if (searchTerm) {
      fallbackQuery = fallbackQuery.ilike("titulo", `%${searchTerm}%`)
    }

    if (categoryId) {
      fallbackQuery = fallbackQuery.eq("categoria_id", categoryId)
    }

    fallbackQuery = fallbackQuery.range(offset, offset + limit - 1)

    const fallbackResult = await fallbackQuery
    data = fallbackResult.data
    error = fallbackResult.error
    count = fallbackResult.count
  }

  if (error) {
    console.error("[mercado-livre-store] failed to list snapshot products", error)
    return { items: [], hasMore: false }
  }

  const items = Array.isArray(data) ? data.map(normalizeSnapshotProduct).filter(isStoreProductAvailable) : []
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
  let { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select(SNAPSHOT_SELECT_WITH_IMAGES)
    .eq("projeto_id", projectId)
    .eq("slug", normalizedSlug)
    .eq("status", "active")
    .gt("estoque", 0)
    .maybeSingle()

  if (error && isMissingSnapshotFieldError(error)) {
    const fallbackResult = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select(SNAPSHOT_SELECT_LEGACY)
      .eq("projeto_id", projectId)
      .eq("slug", normalizedSlug)
      .eq("status", "active")
      .gt("estoque", 0)
      .maybeSingle()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    console.error("[mercado-livre-store] failed to load snapshot product by slug", error)
    return null
  }

  const product = normalizeSnapshotProduct(data)
  return isStoreProductAvailable(product) ? product : null
}

async function listSnapshotCategoryFacetsByProjectId(projectId, options = {}) {
  if (!projectId) {
    return []
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  let { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("categoria_id, categoria_nome")
    .eq("projeto_id", projectId)
    .eq("status", "active")
    .gt("estoque", 0)
    .limit(200)

  if (error && isMissingSnapshotFieldError(error)) {
    const fallbackResult = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select("categoria_id")
      .eq("projeto_id", projectId)
      .eq("status", "active")
      .gt("estoque", 0)
      .limit(200)

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    console.error("[mercado-livre-store] failed to list snapshot categories", error)
    return []
  }

  const unique = new Set()
  return (Array.isArray(data) ? data : [])
    .map((row) => ({
      id: sanitizeText(row.categoria_id, 80),
      label: sanitizeText(row.categoria_nome, 160) || sanitizeText(row.categoria_id, 80),
    }))
    .filter((item) => {
      if (!item.id || unique.has(item.id)) {
        return false
      }
      unique.add(item.id)
      return true
    })
    .slice(0, 12)
    .map((item) => item)
}

export { getSnapshotProductBySlug, listSnapshotCategoryFacetsByProjectId, listSnapshotProductsByProjectId }
