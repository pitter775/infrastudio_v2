import { getAgenteAtivo } from "@/lib/agentes"
import { getChatWidgetByProjetoAgente } from "@/lib/chat-widgets"
import { getMercadoLivreLiveProductByProjectId, searchMercadoLivreProductsForProject } from "@/lib/mercado-livre-connector"
import { getSupabaseAdminClient, getSupabaseAdminEnv } from "@/lib/supabase-admin"

import { isMissingStoreDomainColumnError, STORE_FIELDS, STORE_FIELDS_LEGACY } from "./constants"
import { getSnapshotProductBySlug, listSnapshotCategoryFacetsByProjectId, listSnapshotProductsByProjectId } from "./snapshot"
import { buildStoreProductRef, isStoreProductAvailable, normalizeSnapshotProduct, normalizeStore, parseStoreProductRef, sanitizeText, slugifyProduct } from "./sanitize"

function isMissingSnapshotFieldError(error) {
  const message = String(error?.message || error || "")
  return /imagens_json/i.test(message) || /categoria_nome/i.test(message) || /descricao_curta/i.test(message) || /descricao_longa/i.test(message) || /atributos_json/i.test(message)
}

function productNeedsLiveDetails(product) {
  if (!product) {
    return false
  }

  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : []
  const attributes = Array.isArray(product.attributes) ? product.attributes : []
  const description = String(product.descriptionLong || product.shortDescription || "").trim()

  return images.length <= 1 || !attributes.length || !description
}

function mergeMercadoLivreProductDetails(snapshotProduct, liveProduct) {
  if (!snapshotProduct) {
    return liveProduct
  }

  if (!liveProduct) {
    return snapshotProduct
  }

  return {
    ...snapshotProduct,
    ...liveProduct,
    id: snapshotProduct.id || liveProduct.id,
    itemId: snapshotProduct.itemId || liveProduct.itemId || liveProduct.id,
    slug: snapshotProduct.slug || liveProduct.slug || slugifyProduct(snapshotProduct.title || liveProduct.title),
    title: snapshotProduct.title || liveProduct.title,
    price: snapshotProduct.price || liveProduct.price,
    currencyId: snapshotProduct.currencyId || liveProduct.currencyId || "BRL",
    originalPrice: snapshotProduct.originalPrice || liveProduct.originalPrice || 0,
    installmentQuantity: snapshotProduct.installmentQuantity || liveProduct.installmentQuantity || 0,
    installmentAmount: snapshotProduct.installmentAmount || liveProduct.installmentAmount || 0,
    installmentRate: snapshotProduct.installmentRate || liveProduct.installmentRate || 0,
    unitPrice: snapshotProduct.unitPrice || liveProduct.unitPrice || 0,
    thumbnail: snapshotProduct.thumbnail || liveProduct.thumbnail,
    images:
      (Array.isArray(liveProduct.images) && liveProduct.images.filter(Boolean).length
        ? liveProduct.images.filter(Boolean)
        : Array.isArray(snapshotProduct.images)
          ? snapshotProduct.images.filter(Boolean)
          : []),
    permalink: snapshotProduct.permalink || liveProduct.permalink,
    status: snapshotProduct.status || liveProduct.status,
    stock: snapshotProduct.stock || liveProduct.stock || 0,
    categoryId: snapshotProduct.categoryId || liveProduct.categoryId,
    categoryLabel: snapshotProduct.categoryLabel || liveProduct.categoryLabel || liveProduct.categoryName,
    shortDescription: snapshotProduct.shortDescription || liveProduct.shortDescription || "",
    descriptionLong: snapshotProduct.descriptionLong || liveProduct.descriptionPlain || liveProduct.descriptionLong || "",
    attributes:
      (Array.isArray(liveProduct.attributes) && liveProduct.attributes.length
        ? liveProduct.attributes
        : Array.isArray(snapshotProduct.attributes)
          ? snapshotProduct.attributes
          : []),
  }
}

function buildFeaturedFallbackProduct(featuredProduct = null) {
  if (!featuredProduct?.id || !featuredProduct?.title) {
    return null
  }

  return {
    id: featuredProduct.id,
    itemId: featuredProduct.id,
    title: featuredProduct.title,
    slug: featuredProduct.slug || slugifyProduct(featuredProduct.title),
    price: Number(featuredProduct.price ?? 0) || 0,
    currencyId: featuredProduct.currencyId || "BRL",
    originalPrice: 0,
    installmentQuantity: 0,
    installmentAmount: 0,
    installmentRate: 0,
    unitPrice: 0,
    thumbnail: featuredProduct.thumbnail || "",
    images: featuredProduct.thumbnail ? [featuredProduct.thumbnail] : [],
    permalink: featuredProduct.permalink || "",
    status: "active",
    stock: 1,
    categoryId: "",
    categoryLabel: "",
    shortDescription: "",
    descriptionLong: "",
    attributes: [],
  }
}

function normalizeProductSlugSearchTerm(productSlug = "") {
  const parsedRef = parseStoreProductRef(productSlug)
  return sanitizeText(parsedRef.slug || parsedRef.raw, 180)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function resolveLiveProductBySlug(projectId, productSlug, options = {}) {
  const parsedRef = parseStoreProductRef(productSlug)
  const normalizedSlug = sanitizeText(parsedRef.slug || parsedRef.raw, 180)
  const normalizedItemId = sanitizeText(parsedRef.itemId, 80)
  const searchTerm = normalizeProductSlugSearchTerm(normalizedSlug)
  if (!projectId || (!normalizedSlug && !normalizedItemId)) {
    return null
  }

  if (normalizedItemId) {
    return getMercadoLivreLiveProductByProjectId(projectId, normalizedItemId, { supabase: options.supabase })
  }

  const liveSearch = await searchMercadoLivreProductsForProject(
    { id: projectId },
    {
      searchTerm,
      limit: 6,
      poolLimit: 24,
      offset: 0,
    },
    { supabase: options.supabase }
  )

  const matchedLiveItem = (Array.isArray(liveSearch?.items) ? liveSearch.items : []).find(
    (item) => slugifyProduct(item?.title) === normalizedSlug
  )

  if (!matchedLiveItem?.id) {
    return null
  }

  return getMercadoLivreLiveProductByProjectId(projectId, matchedLiveItem.id, { supabase: options.supabase })
}

async function resolveFeaturedProducts(project, store, options = {}) {
  const featured = Array.isArray(store?.featuredProducts) ? store.featuredProducts : []
  if (!featured.length) {
    return []
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const itemIds = featured.map((item) => sanitizeText(item.id, 80)).filter(Boolean)
  if (!itemIds.length) {
    return featured.slice(0, 6).map((item, index) => ({ ...item, slug: item.slug || slugifyProduct(item.title), order: index }))
  }

  let { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, imagens_json, permalink, status, estoque, categoria_id, categoria_nome, descricao_curta, descricao_longa, atributos_json, updated_at")
    .eq("projeto_id", project.id)
    .in("ml_item_id", itemIds)
    .eq("status", "active")
    .gt("estoque", 0)

  if (error && isMissingSnapshotFieldError(error)) {
    const fallbackResult = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select("id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, permalink, status, estoque, categoria_id, updated_at")
      .eq("projeto_id", project.id)
      .in("ml_item_id", itemIds)
      .eq("status", "active")
      .gt("estoque", 0)

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    console.error("[mercado-livre-store] failed to resolve featured snapshot products", error)
    return featured.slice(0, 6).map((item, index) => ({ ...item, slug: item.slug || slugifyProduct(item.title), order: index }))
  }

  const snapshotMap = new Map(
    (Array.isArray(data) ? data : [])
      .map((row) => normalizeSnapshotProduct(row))
      .filter(isStoreProductAvailable)
      .map((item) => [sanitizeText(item.itemId, 80), item])
  )

  return featured.slice(0, 6).flatMap((item, index) => {
    const snapshot = snapshotMap.get(sanitizeText(item.id, 80))
    if (snapshot) {
      return [{
        ...snapshot,
        currencyId: item.currencyId || "BRL",
        order: index,
      }]
    }

    return itemIds.length
      ? []
      : [{
          ...item,
          slug: item.slug || slugifyProduct(item.title),
          order: index,
        }]
  })
}

async function resolvePublicWidget(supabase, projectId, store) {
  if (!store.chatWidgetActive) {
    return null
  }

  const activeAgent = await getAgenteAtivo(projectId)
  if (!activeAgent?.id) {
    return null
  }

  if (store.chatWidgetId) {
    const { data: widgetRow } = await supabase
      .from("chat_widgets")
      .select("id, slug, projeto_id, agente_id, nome, tema, cor_primaria, fundo_transparente, ativo")
      .eq("id", store.chatWidgetId)
      .eq("ativo", true)
      .maybeSingle()

    if (widgetRow) {
      return {
        id: widgetRow.id,
        slug: widgetRow.slug,
        projetoId: widgetRow.projeto_id,
        agenteId: widgetRow.agente_id || activeAgent.id,
        agentId: widgetRow.agente_id || activeAgent.id,
        nome: widgetRow.nome,
        tema: widgetRow.tema,
        corPrimaria: widgetRow.cor_primaria,
        fundoTransparente: widgetRow.fundo_transparente,
      }
    }
  }

  const fallbackWidget = await getChatWidgetByProjetoAgente({
    projetoId,
    agenteId: activeAgent.id,
  })

  if (!fallbackWidget?.slug) {
    return null
  }

  return {
    ...fallbackWidget,
    agentId: fallbackWidget.agenteId || activeAgent.id,
  }
}

async function getPublicMercadoLivreStoreBySlug(slug, options = {}) {
  const normalizedSlug = sanitizeText(slug, 80)
  if (!normalizedSlug) {
    return {
      store: null,
      products: [],
      featuredProducts: [],
      paging: null,
      error: "Loja nao encontrada.",
      diagnostic: { reason: "invalid_slug", slug: normalizedSlug },
    }
  }

  let supabase = options.supabase
  try {
    if (!supabase) {
      const env = getSupabaseAdminEnv()
      supabase = getSupabaseAdminClient()
      if (!env.usingServiceRole) {
        console.warn("[mercado-livre-store] public store lookup running without service role key", {
          slug: normalizedSlug,
        })
      }
    }
  } catch (error) {
    console.error("[mercado-livre-store] missing Supabase env for public store lookup", {
      slug: normalizedSlug,
      message: String(error?.message || error || ""),
    })
    return {
      store: null,
      products: [],
      featuredProducts: [],
      paging: null,
      error: "Loja indisponivel.",
      diagnostic: { reason: "missing_supabase_env", slug: normalizedSlug },
    }
  }

  let { data, error } = await supabase
    .from("mercadolivre_lojas")
    .select(STORE_FIELDS)
    .eq("slug", normalizedSlug)
    .eq("ativo", true)
    .maybeSingle()

  if (error && isMissingStoreDomainColumnError(error)) {
    const fallbackResult = await supabase
      .from("mercadolivre_lojas")
      .select(STORE_FIELDS_LEGACY)
      .eq("slug", normalizedSlug)
      .eq("ativo", true)
      .maybeSingle()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error || !data) {
    if (error) {
      console.error("[mercado-livre-store] failed to load public store", {
        slug: normalizedSlug,
        message: error.message,
        code: error.code,
      })
    } else {
      console.warn("[mercado-livre-store] public store not found or inactive", {
        slug: normalizedSlug,
      })
    }
    return {
      store: null,
      products: [],
      featuredProducts: [],
      paging: null,
      error: "Loja nao encontrada.",
      diagnostic: { reason: error ? "store_lookup_failed" : "store_not_found_or_inactive", slug: normalizedSlug },
    }
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("projetos")
    .select("id, nome, slug")
    .eq("id", data.projeto_id)
    .maybeSingle()

  if (projectError || !projectRow) {
    if (projectError) {
      console.error("[mercado-livre-store] failed to load project for public store", {
        slug: normalizedSlug,
        projectId: data.projeto_id,
        message: projectError.message,
        code: projectError.code,
      })
    } else {
      console.warn("[mercado-livre-store] public store project missing", {
        slug: normalizedSlug,
        projectId: data.projeto_id,
      })
    }
    return {
      store: null,
      products: [],
      featuredProducts: [],
      paging: null,
      error: "Projeto da loja nao encontrado.",
      diagnostic: { reason: projectError ? "project_lookup_failed" : "project_missing", slug: normalizedSlug, projectId: data.projeto_id },
    }
  }

  const normalizedStore = normalizeStore(data, projectRow)
  const widget = await resolvePublicWidget(supabase, projectRow.id, normalizedStore)

  const searchTerm = sanitizeText(options.searchTerm, 120)
  const page = Math.max(Number(options.page ?? 1) || 1, 1)
  const limit = Math.min(Math.max(Number(options.limit ?? 10) || 10, 1), 120)
  const categoryId = sanitizeText(options.categoryId, 80)
  const sort = sanitizeText(options.sort, 32) || "recent"
  const listing = await listSnapshotProductsByProjectId(projectRow.id, {
    supabase,
    searchTerm,
    page,
    limit,
    categoryId,
    sort,
  })
  const featuredProducts = await resolveFeaturedProducts(
    {
      id: projectRow.id,
      slug: projectRow.slug,
      name: projectRow.nome,
    },
    normalizedStore,
    { supabase }
  )
  const categories = await listSnapshotCategoryFacetsByProjectId(projectRow.id, { supabase })

  return {
    store: {
      ...normalizedStore,
      projectName: sanitizeText(projectRow.nome, 120),
      widget: widget
        ? {
            id: widget.id,
            slug: widget.slug,
            projectId: widget.projetoId,
            agentId: widget.agenteId ?? widget.agentId ?? null,
            title: widget.nome,
            theme: widget.tema,
            accent: widget.corPrimaria,
            transparent: widget.fundoTransparente,
          }
        : null,
    },
    products: Array.isArray(listing?.items) ? listing.items : [],
    featuredProducts,
    paging: {
      page,
      hasMore: listing?.hasMore === true,
    },
    filters: {
      categoryId,
      sort,
      categories,
    },
    error: null,
    diagnostic: {
      reason: "ok",
      slug: normalizedSlug,
      projectId: projectRow.id,
      active: data.ativo === true,
    },
  }
}

async function getPublicMercadoLivreProductPage(storeSlug, productSlug, options = {}) {
  const storeResult = await getPublicMercadoLivreStoreBySlug(storeSlug, { page: 1, ...options })
  if (!storeResult.store?.projectId) {
    return { store: null, product: null, relatedProducts: [] }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const snapshotProduct = await getSnapshotProductBySlug(storeResult.store.projectId, productSlug, { supabase })
  let product =
    snapshotProduct && productNeedsLiveDetails(snapshotProduct)
      ? mergeMercadoLivreProductDetails(
          snapshotProduct,
          await getMercadoLivreLiveProductByProjectId(storeResult.store.projectId, snapshotProduct.itemId || snapshotProduct.id, { supabase })
        )
      : snapshotProduct

  if (!product) {
    const featuredMatch = (Array.isArray(storeResult.featuredProducts) ? storeResult.featuredProducts : []).find(
      (item) => sanitizeText(item?.slug, 180) === sanitizeText(productSlug, 180)
    )

    if (featuredMatch?.id) {
      const liveProduct = await getMercadoLivreLiveProductByProjectId(storeResult.store.projectId, featuredMatch.id, { supabase })
      product = mergeMercadoLivreProductDetails(buildFeaturedFallbackProduct(featuredMatch), liveProduct)
    }
  }

  if (!product) {
    const liveProduct = await resolveLiveProductBySlug(storeResult.store.projectId, productSlug, { supabase })
    if (liveProduct) {
      product = mergeMercadoLivreProductDetails(
        {
          id: liveProduct.id,
          itemId: liveProduct.id,
          title: liveProduct.title,
          slug: sanitizeText(productSlug, 180) || slugifyProduct(liveProduct.title),
          price: Number(liveProduct.price ?? 0) || 0,
          currencyId: liveProduct.currencyId || "BRL",
          originalPrice: 0,
          installmentQuantity: 0,
          installmentAmount: 0,
          installmentRate: 0,
          unitPrice: 0,
          thumbnail: liveProduct.thumbnail || "",
          images: Array.isArray(liveProduct.pictures) ? liveProduct.pictures.filter(Boolean) : [],
          permalink: liveProduct.permalink || "",
          status: liveProduct.status || "active",
          stock: Number(liveProduct.availableQuantity ?? 0) || 0,
          categoryId: liveProduct.categoryId || "",
          categoryLabel: liveProduct.categoryName || "",
          shortDescription: liveProduct.shortDescription || "",
          descriptionLong: liveProduct.descriptionPlain || "",
          attributes: Array.isArray(liveProduct.attributes) ? liveProduct.attributes : [],
        },
        liveProduct
      )
    }
  }

  if (!product) {
    return {
      store: storeResult.store,
      product: null,
      relatedProducts: [],
    }
  }

  const related = await listSnapshotProductsByProjectId(storeResult.store.projectId, {
    supabase,
    page: 1,
    limit: 10,
    excludeSlug: product.slug,
    categoryId: product.categoryId || "",
  })

  let fallbackRelated = Array.isArray(related.items) ? related.items : []
  if (fallbackRelated.length < 10) {
    const latestRelated = await listSnapshotProductsByProjectId(storeResult.store.projectId, {
      supabase,
      page: 1,
      limit: 10,
      excludeSlug: product.slug,
    })
    const seenIds = new Set(fallbackRelated.map((item) => sanitizeText(item?.itemId || item?.id || item?.slug, 180)).filter(Boolean))
    const extraItems = (Array.isArray(latestRelated.items) ? latestRelated.items : []).filter((item) => {
      const itemKey = sanitizeText(item?.itemId || item?.id || item?.slug, 180)
      if (!itemKey || seenIds.has(itemKey)) {
        return false
      }
      seenIds.add(itemKey)
      return true
    })
    fallbackRelated = [...fallbackRelated, ...extraItems].slice(0, 10)
  }

  return {
    store: storeResult.store,
    product,
    relatedProducts: fallbackRelated,
  }
}

export { getPublicMercadoLivreProductPage, getPublicMercadoLivreStoreBySlug }
