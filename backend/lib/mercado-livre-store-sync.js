import "server-only"

import { listMercadoLivreItemsForProject } from "@/lib/mercado-livre-connector"
import { slugifyProduct } from "@/lib/mercado-livre-store"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function sanitizeText(value, max = 0) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return ""
  }

  return max > 0 ? normalized.slice(0, max) : normalized
}

function sanitizeImageList(value) {
  const list = Array.isArray(value) ? value : []
  return list.map((item) => sanitizeText(item, 500)).filter(Boolean).slice(0, 8)
}

function buildSnapshotRow(projectId, item) {
  const now = new Date().toISOString()
  const images = sanitizeImageList(item?.pictures)
  const thumbnail = sanitizeText(images[0], 500) || sanitizeText(item?.thumbnail, 500)
  return {
    projeto_id: projectId,
    ml_item_id: sanitizeText(item?.id, 60),
    titulo: sanitizeText(item?.title, 180),
    slug: sanitizeText(slugifyProduct(item?.title), 180),
    preco: Number(item?.price ?? 0) || 0,
    preco_original: 0,
    thumbnail_url: thumbnail,
    imagens_json: images,
    permalink: sanitizeText(item?.permalink, 500),
    status: sanitizeText(item?.status, 40),
    estoque: Number(item?.availableQuantity ?? 0) || 0,
    categoria_id: sanitizeText(item?.categoryId, 80),
    categoria_nome: sanitizeText(item?.categoryName, 160),
    descricao_curta: sanitizeText(item?.shortDescription, 2000),
    descricao_longa: sanitizeText(item?.descriptionPlain, 12000),
    atributos_json: Array.isArray(item?.attributes) ? item.attributes : [],
    ultima_sincronizacao_em: now,
    updated_at: now,
  }
}

export async function getMercadoLivreSnapshotStatus(projectId, deps = {}) {
  if (!projectId) {
    return {
      total: 0,
      lastSyncAt: null,
      latestProducts: [],
    }
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const [{ count }, latestResult] = await Promise.all([
    supabase.from("mercadolivre_produtos_snapshot").select("id", { count: "exact", head: true }).eq("projeto_id", projectId),
    supabase
      .from("mercadolivre_produtos_snapshot")
      .select("ml_item_id, titulo, slug, updated_at")
      .eq("projeto_id", projectId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(5),
  ])

  const latestProducts = Array.isArray(latestResult.data) ? latestResult.data : []
  return {
    total: Number(count || 0) || 0,
    lastSyncAt: latestProducts[0]?.updated_at || null,
    latestProducts,
  }
}

export async function syncMercadoLivreSnapshotForProject(project, options = {}, deps = {}) {
  if (!project?.id) {
    return { synced: 0, paging: null, error: "Projeto nao encontrado." }
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const limit = Math.min(Math.max(Number(options.limit ?? 20) || 20, 1), 20)
  const offset = Math.max(Number(options.offset ?? 0) || 0, 0)
  const result = await listMercadoLivreItemsForProject(project, { limit, offset, includeDetails: true }, { supabase })

  if (result.error) {
    return { synced: 0, paging: result.paging || null, error: result.error }
  }

  const rows = (Array.isArray(result.items) ? result.items : [])
    .map((item) => buildSnapshotRow(project.id, item))
    .filter((row) => row.ml_item_id && row.titulo && row.slug)

  if (!rows.length) {
    return { synced: 0, paging: result.paging || null, error: null }
  }

  const { error } = await supabase
    .from("mercadolivre_produtos_snapshot")
    .upsert(rows, { onConflict: "projeto_id,ml_item_id" })

  if (error) {
    console.error("[mercado-livre-store-sync] failed to upsert snapshot rows", error)
    return {
      synced: 0,
      paging: result.paging || null,
      error: "Nao foi possivel atualizar o snapshot da loja.",
    }
  }

  return {
    synced: rows.length,
    paging: result.paging || null,
    error: null,
  }
}
