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

function isSnapshotEligibleItem(item) {
  const status = sanitizeText(item?.status, 40).toLowerCase()
  const availableQuantity = Number(item?.availableQuantity ?? 0) || 0
  return status === "active" && availableQuantity > 0
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

function shouldFallbackToReplaceSync(error) {
  const code = String(error?.code || "").trim()
  const message = String(error?.message || "").trim().toLowerCase()

  return (
    code === "42P10" ||
    message.includes("there is no unique or exclusion constraint matching the on conflict specification") ||
    message.includes("no unique or exclusion constraint matching the on conflict specification")
  )
}

function buildSyncError(message, stage, details = {}) {
  return {
    synced: 0,
    paging: details?.paging ?? null,
    stage,
    details,
    error: message,
  }
}

async function replaceSnapshotRowsForProject(supabase, projectId, rows) {
  const deleteResult = await supabase.from("mercadolivre_produtos_snapshot").delete().eq("projeto_id", projectId)

  if (deleteResult.error) {
    console.error("[mercado-livre-store-sync] failed to clear snapshot rows before replace sync", deleteResult.error)
    return {
      ok: false,
      error: "Nao foi possivel limpar os produtos antigos da loja.",
    }
  }

  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100)
    const insertResult = await supabase.from("mercadolivre_produtos_snapshot").insert(batch)

    if (insertResult.error) {
      console.error("[mercado-livre-store-sync] failed to insert snapshot rows in replace sync", insertResult.error)
      return {
        ok: false,
        error: "Nao foi possivel gravar os produtos atualizados da loja.",
      }
    }
  }

  return {
    ok: true,
    error: null,
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
  try {
    if (!project?.id) {
      return buildSyncError("Projeto nao encontrado.", "project_lookup")
    }

    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const limit = Math.min(Math.max(Number(options.limit ?? 20) || 20, 1), 20)
    const fullSync = options.fullSync !== false
    const startOffset = Math.max(Number(options.offset ?? 0) || 0, 0)
    const collectedItems = []
    let currentOffset = startOffset
    let lastPaging = null

    while (true) {
      const result = await listMercadoLivreItemsForProject(
        project,
        { limit, offset: currentOffset, includeDetails: true },
        { supabase }
      )

      if (result.error) {
        return buildSyncError(result.error, "list_items", { paging: result.paging || lastPaging })
      }

      const pageItems = Array.isArray(result.items) ? result.items : []
      collectedItems.push(...pageItems)
      lastPaging = result.paging || lastPaging

      if (!fullSync || result.paging?.hasMore !== true) {
        break
      }

      currentOffset += limit
    }

    const eligibleItems = collectedItems.filter(isSnapshotEligibleItem)
    const rows = eligibleItems.map((item) => buildSnapshotRow(project.id, item)).filter((row) => row.ml_item_id && row.titulo && row.slug)
    const eligibleIds = [...new Set(rows.map((row) => row.ml_item_id).filter(Boolean))]

    const existingResult = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select("ml_item_id")
      .eq("projeto_id", project.id)

    if (existingResult.error) {
      console.error("[mercado-livre-store-sync] failed to load existing snapshot rows", existingResult.error)
      return buildSyncError("Nao foi possivel atualizar o snapshot da loja.", "load_existing_rows", {
        paging: lastPaging,
        error: existingResult.error.message || "unknown_error",
        errorCode: existingResult.error.code || null,
      })
    }

    const existingIds = Array.isArray(existingResult.data)
      ? existingResult.data.map((row) => sanitizeText(row?.ml_item_id, 60)).filter(Boolean)
      : []
    const eligibleIdSet = new Set(eligibleIds)
    const idsToDelete = eligibleIds.length
      ? existingIds.filter((itemId) => !eligibleIdSet.has(itemId))
      : existingIds

    if (rows.length) {
      const { error } = await supabase
        .from("mercadolivre_produtos_snapshot")
        .upsert(rows, { onConflict: "projeto_id,ml_item_id" })

      if (error) {
        if (shouldFallbackToReplaceSync(error)) {
          const replaceResult = await replaceSnapshotRowsForProject(supabase, project.id, rows)
          if (!replaceResult.ok) {
            return buildSyncError(replaceResult.error, "replace_rows", {
              paging: lastPaging,
              rows: rows.length,
            })
          }
        } else {
          console.error("[mercado-livre-store-sync] failed to upsert snapshot rows", error)
          return buildSyncError("Nao foi possivel atualizar o snapshot da loja.", "upsert_rows", {
            paging: lastPaging,
            error: error.message || "unknown_error",
            errorCode: error.code || null,
            rows: rows.length,
          })
        }
      }
    }

    for (let index = 0; index < idsToDelete.length; index += 100) {
      const batch = idsToDelete.slice(index, index + 100)
      const deleteResult = await supabase
        .from("mercadolivre_produtos_snapshot")
        .delete()
        .eq("projeto_id", project.id)
        .in("ml_item_id", batch)

      if (deleteResult.error) {
        console.error("[mercado-livre-store-sync] failed to delete stale snapshot rows", deleteResult.error)
        return {
          synced: rows.length,
          paging: lastPaging,
          stage: "delete_stale_rows",
          details: {
            paging: lastPaging,
            error: deleteResult.error.message || "unknown_error",
            errorCode: deleteResult.error.code || null,
            syncedRows: rows.length,
            staleRows: idsToDelete.length,
          },
          error: "Nao foi possivel limpar produtos inativos do snapshot.",
        }
      }
    }

    return {
      synced: rows.length,
      paging: lastPaging,
      error: null,
    }
  } catch (error) {
    console.error("[mercado-livre-store-sync] unexpected snapshot sync failure", error)
    return buildSyncError("Nao foi possivel atualizar a loja no banco.", "unexpected_failure", {
      error: error instanceof Error ? error.message : "unknown_error",
    })
  }
}
