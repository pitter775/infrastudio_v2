import { getSupabaseAdminClient } from "@/lib/supabase-admin"

import { isStoreProductAvailable, normalizeSnapshotProduct, parseStoreProductRef, sanitizeText, slugifyProduct } from "./sanitize"

const SNAPSHOT_SELECT_WITH_IMAGES =
  "id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, imagens_json, permalink, status, estoque, categoria_id, categoria_nome, descricao_curta, descricao_longa, atributos_json, updated_at"
const SNAPSHOT_SELECT_LEGACY =
  "id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, permalink, status, estoque, categoria_id, updated_at"
const MERCADO_LIVRE_PUBLIC_API = "https://api.mercadolibre.com"

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

function normalizeSearchTokens(value) {
  return sanitizeText(value, 240)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function getRelevantSearchTokens(value) {
  return normalizeSearchTokens(value).filter((token) => token.length >= 3)
}

function buildSnapshotSearchOrFilter(searchTerm) {
  const tokens = getRelevantSearchTokens(searchTerm)
  if (!tokens.length) {
    return ""
  }

  const fields = ["titulo", "descricao_curta", "descricao_longa", "categoria_nome"]
  return tokens
    .flatMap((token) => fields.map((field) => `${field}.ilike.%${token}%`))
    .join(",")
}

function extractAttributeSearchText(attributes) {
  if (!Array.isArray(attributes)) {
    return ""
  }

  return attributes
    .flatMap((attribute) => {
      if (!attribute || typeof attribute !== "object") {
        return []
      }

      const values = []
      const label = sanitizeText(attribute.name || attribute.label, 160)
      const value = sanitizeText(attribute.valueName || attribute.value_name || attribute.valueLabel || attribute.value, 240)

      if (label) values.push(label)
      if (value) values.push(value)

      if (Array.isArray(attribute.values)) {
        values.push(
          ...attribute.values
            .map((entry) => sanitizeText(entry?.name || entry?.label || entry?.value_name || entry?.valueName || entry?.value, 160))
            .filter(Boolean)
        )
      }

      return values
    })
    .join(" ")
}

function matchesSnapshotSearch(product, searchTerm) {
  const tokens = getRelevantSearchTokens(searchTerm)
  if (!tokens.length) {
    return true
  }

  const haystack = [
    sanitizeText(product?.title, 240),
    sanitizeText(product?.shortDescription, 2000),
    sanitizeText(product?.fullDescription, 6000),
    sanitizeText(product?.categoryName, 160),
    extractAttributeSearchText(product?.attributes),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return tokens.every((token) => haystack.includes(token))
}

async function resolveMercadoLivreCategoryNames(items = []) {
  const categoryIds = Array.from(
    new Set(
      items
        .filter((item) => {
          const id = sanitizeText(item?.id, 80)
          const label = sanitizeText(item?.label, 160)
          return id && /^MLB\d+$/i.test(id) && !label
        })
        .map((item) => sanitizeText(item.id, 80))
    )
  )

  if (!categoryIds.length) {
    return new Map()
  }

  const results = await Promise.all(
    categoryIds.map(async (categoryId) => {
      try {
        const response = await fetch(`${MERCADO_LIVRE_PUBLIC_API}/categories/${encodeURIComponent(categoryId)}`, {
          headers: {
            Accept: "application/json",
          },
          cache: "force-cache",
        })
        const payload = await response.json().catch(() => ({}))
        return [categoryId, sanitizeText(payload?.name, 160)]
      } catch {
        return [categoryId, ""]
      }
    })
  )

  return new Map(results.filter(([, label]) => label))
}

async function listSnapshotProductsByProjectId(projectId, options = {}) {
  if (!projectId) {
    return { items: [], hasMore: false }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const page = Math.max(Number(options.page ?? 1) || 1, 1)
  const limit = Math.min(Math.max(Number(options.limit ?? 10) || 10, 1), 120)
  const offset = (page - 1) * limit
  const searchTerm = sanitizeText(options.searchTerm, 120).toLowerCase()
  const excludeSlug = sanitizeText(options.excludeSlug, 180)
  const categoryId = sanitizeText(options.categoryId, 80)
  const sort = sanitizeText(options.sort, 32) || "recent"
  const priceMaxExclusive = Number(options.priceMaxExclusive)
  const requiresClientSearch = Boolean(searchTerm)
  const searchOrFilter = buildSnapshotSearchOrFilter(searchTerm)
  const fetchLimit = requiresClientSearch ? Math.min(Math.max(limit * 10, 60), 180) : limit
  const fetchOffset = requiresClientSearch ? 0 : offset

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

  if (searchOrFilter) {
    query = query.or(searchOrFilter)
  }

  if (categoryId) {
    query = query.eq("categoria_id", categoryId)
  }

  if (Number.isFinite(priceMaxExclusive) && priceMaxExclusive > 0) {
    query = query.lt("preco", priceMaxExclusive)
  }

  query = query.range(fetchOffset, fetchOffset + fetchLimit - 1)

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

    if (searchOrFilter) {
      fallbackQuery = fallbackQuery.or(searchOrFilter.replace(/descricao_curta\.ilike\.[^,]+,?|descricao_longa\.ilike\.[^,]+,?|categoria_nome\.ilike\.[^,]+,?/g, "").replace(/,+/g, ",").replace(/^,|,$/g, ""))
    }

    if (categoryId) {
      fallbackQuery = fallbackQuery.eq("categoria_id", categoryId)
    }

    if (Number.isFinite(priceMaxExclusive) && priceMaxExclusive > 0) {
      fallbackQuery = fallbackQuery.lt("preco", priceMaxExclusive)
    }

    fallbackQuery = fallbackQuery.range(fetchOffset, fetchOffset + fetchLimit - 1)

    const fallbackResult = await fallbackQuery
    data = fallbackResult.data
    error = fallbackResult.error
    count = fallbackResult.count
  }

  if (error) {
    console.error("[mercado-livre-store] failed to list snapshot products", error)
    return { items: [], hasMore: false }
  }

  const normalizedItems = Array.isArray(data) ? data.map(normalizeSnapshotProduct).filter(isStoreProductAvailable) : []
  const filteredItems = requiresClientSearch ? normalizedItems.filter((item) => matchesSnapshotSearch(item, searchTerm)) : normalizedItems
  const paginatedItems = requiresClientSearch ? filteredItems.slice(offset, offset + limit) : filteredItems
  const totalCount = requiresClientSearch ? filteredItems.length : Number(count || 0)

  return {
    items: paginatedItems,
    hasMore: totalCount > offset + paginatedItems.length,
  }
}

async function getSnapshotProductBySlug(projectId, productSlug, options = {}) {
  if (!projectId || !productSlug) {
    return null
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const parsedRef = parseStoreProductRef(productSlug)
  const normalizedSlug = sanitizeText(parsedRef.slug || parsedRef.raw, 180)
  const normalizedItemId = sanitizeText(parsedRef.itemId, 80)
  let { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select(SNAPSHOT_SELECT_WITH_IMAGES)
    .eq("projeto_id", projectId)
    .eq("status", "active")
    .gt("estoque", 0)
    [normalizedItemId ? "eq" : "eq"](normalizedItemId ? "ml_item_id" : "slug", normalizedItemId || normalizedSlug)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(20)

  if (error && isMissingSnapshotFieldError(error)) {
    const fallbackResult = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select(SNAPSHOT_SELECT_LEGACY)
      .eq("projeto_id", projectId)
      .eq("status", "active")
      .gt("estoque", 0)
      [normalizedItemId ? "eq" : "eq"](normalizedItemId ? "ml_item_id" : "slug", normalizedItemId || normalizedSlug)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(20)

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    console.error("[mercado-livre-store] failed to load snapshot product by slug", error)
    return null
  }

  const directMatches = (Array.isArray(data) ? data : [])
    .map(normalizeSnapshotProduct)
    .filter(isStoreProductAvailable)

  if (directMatches.length) {
    return directMatches[0]
  }

  let fallbackData = null
  let fallbackError = null
  let fallbackRows = null

  const fallbackQuery = () =>
    supabase
      .from("mercadolivre_produtos_snapshot")
      .select(SNAPSHOT_SELECT_WITH_IMAGES)
      .eq("projeto_id", projectId)
      .eq("status", "active")
      .gt("estoque", 0)
      .limit(200)

  ;({ data: fallbackRows, error: fallbackError } = await fallbackQuery())

  if (fallbackError && isMissingSnapshotFieldError(fallbackError)) {
    const fallbackLegacyResult = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select(SNAPSHOT_SELECT_LEGACY)
      .eq("projeto_id", projectId)
      .eq("status", "active")
      .gt("estoque", 0)
      .limit(200)

    fallbackRows = fallbackLegacyResult.data
    fallbackError = fallbackLegacyResult.error
  }

  if (fallbackError) {
    console.error("[mercado-livre-store] failed to resolve fallback snapshot product by slug", fallbackError)
    return null
  }

  fallbackData = (Array.isArray(fallbackRows) ? fallbackRows : []).find((row) => {
    const normalizedProduct = normalizeSnapshotProduct(row)
    if (!isStoreProductAvailable(normalizedProduct)) {
      return false
    }

    const rowSlug = sanitizeText(normalizedProduct?.slug, 180)
    const derivedSlug = slugifyProduct(normalizedProduct?.title)
    return rowSlug === normalizedSlug || derivedSlug === normalizedSlug
  })

  if (!fallbackData) {
    return null
  }

  const fallbackProduct = normalizeSnapshotProduct(fallbackData)
  return isStoreProductAvailable(fallbackProduct) ? fallbackProduct : null
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
  const rawItems = (Array.isArray(data) ? data : [])
    .map((row) => ({
      id: sanitizeText(row.categoria_id, 80),
      label: sanitizeText(row.categoria_nome, 160),
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

  const resolvedNames = await resolveMercadoLivreCategoryNames(rawItems)

  return rawItems.map((item) => ({
    id: item.id,
    label: item.label || resolvedNames.get(item.id) || item.id,
  }))
}

export { getSnapshotProductBySlug, listSnapshotCategoryFacetsByProjectId, listSnapshotProductsByProjectId }
