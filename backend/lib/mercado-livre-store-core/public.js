import { getChatWidgetByProjetoAgente } from "@/lib/chat-widgets"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

import { STORE_FIELDS } from "./constants"
import { getSnapshotProductBySlug, listSnapshotCategoryFacetsByProjectId, listSnapshotProductsByProjectId } from "./snapshot"
import { normalizeSnapshotProduct, normalizeStore, sanitizeText, slugifyProduct } from "./sanitize"

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

  const { data, error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("id, ml_item_id, titulo, slug, preco, preco_original, thumbnail_url, permalink, status, estoque, categoria_id, updated_at")
    .eq("projeto_id", project.id)
    .in("ml_item_id", itemIds)

  if (error) {
    console.error("[mercado-livre-store] failed to resolve featured snapshot products", error)
    return featured.slice(0, 6).map((item, index) => ({ ...item, slug: item.slug || slugifyProduct(item.title), order: index }))
  }

  const snapshotMap = new Map((Array.isArray(data) ? data : []).map((row) => [sanitizeText(row.ml_item_id, 80), normalizeSnapshotProduct(row)]))
  return featured.slice(0, 6).map((item, index) => {
    const snapshot = snapshotMap.get(sanitizeText(item.id, 80))
    if (snapshot) {
      return {
        ...snapshot,
        currencyId: item.currencyId || "BRL",
        order: index,
      }
    }

    return {
      ...item,
      slug: item.slug || slugifyProduct(item.title),
      order: index,
    }
  })
}

async function resolvePublicWidget(supabase, projectId, store) {
  if (!store.chatWidgetActive) {
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
        slug: widgetRow.slug,
        projetoId: widgetRow.projeto_id,
        agentId: widgetRow.agente_id,
        nome: widgetRow.nome,
        tema: widgetRow.tema,
        corPrimaria: widgetRow.cor_primaria,
        fundoTransparente: widgetRow.fundo_transparente,
      }
    }
  }

  return getChatWidgetByProjetoAgente({
    projetoId,
    agenteId: null,
  })
}

async function getPublicMercadoLivreStoreBySlug(slug, options = {}) {
  const normalizedSlug = sanitizeText(slug, 80)
  if (!normalizedSlug) {
    return { store: null, products: [], featuredProducts: [], paging: null, error: "Loja nao encontrada." }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("mercadolivre_lojas")
    .select(STORE_FIELDS)
    .eq("slug", normalizedSlug)
    .eq("ativo", true)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.error("[mercado-livre-store] failed to load public store", error)
    }
    return { store: null, products: [], featuredProducts: [], paging: null, error: "Loja nao encontrada." }
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("projetos")
    .select("id, nome, slug")
    .eq("id", data.projeto_id)
    .maybeSingle()

  if (projectError || !projectRow) {
    if (projectError) {
      console.error("[mercado-livre-store] failed to load project for public store", projectError)
    }
    return { store: null, products: [], featuredProducts: [], paging: null, error: "Projeto da loja nao encontrado." }
  }

  const normalizedStore = normalizeStore(data, projectRow)
  const widget = await resolvePublicWidget(supabase, projectRow.id, normalizedStore)

  const searchTerm = sanitizeText(options.searchTerm, 120)
  const page = Math.max(Number(options.page ?? 1) || 1, 1)
  const categoryId = sanitizeText(options.categoryId, 80)
  const sort = sanitizeText(options.sort, 32) || "recent"
  const listing = await listSnapshotProductsByProjectId(projectRow.id, {
    supabase,
    searchTerm,
    page,
    limit: 12,
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
            slug: widget.slug,
            projectId: widget.projetoId,
            agentId: widget.agenteId,
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
  }
}

async function getPublicMercadoLivreProductPage(storeSlug, productSlug, options = {}) {
  const storeResult = await getPublicMercadoLivreStoreBySlug(storeSlug, { page: 1, ...options })
  if (!storeResult.store?.projectId) {
    return { store: null, product: null, relatedProducts: [] }
  }

  const supabase = options.supabase ?? getSupabaseAdminClient()
  const product = await getSnapshotProductBySlug(storeResult.store.projectId, productSlug, { supabase })
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
    limit: 4,
    excludeSlug: product.slug,
    categoryId: product.categoryId || "",
  })

  const fallbackRelated =
    related.items.length >= 4
      ? related.items
      : (
          await listSnapshotProductsByProjectId(storeResult.store.projectId, {
            supabase,
            page: 1,
            limit: 4,
            excludeSlug: product.slug,
          })
        ).items

  return {
    store: storeResult.store,
    product,
    relatedProducts: fallbackRelated,
  }
}

export { getPublicMercadoLivreProductPage, getPublicMercadoLivreStoreBySlug }
