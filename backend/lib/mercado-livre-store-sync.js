import "server-only"

import { getMercadoLivreProductByIdForProject, listMercadoLivreItemsForProject } from "@/lib/mercado-livre-connector"
import { slugifyProduct } from "@/lib/mercado-livre-store"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000
const AUTO_SYNC_STALE_LOCK_MS = 15 * 60 * 1000
const SYNC_STATE_TABLE = "mercadolivre_lojas_sync"

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

function isMissingSyncStateTableError(error) {
  const message = String(error?.message || error || "").toLowerCase()
  const code = String(error?.code || "").trim()
  return code === "42P01" || message.includes(SYNC_STATE_TABLE) || message.includes("does not exist")
}

function toIsoString(value) {
  const normalized = sanitizeText(value, 64)
  return normalized || null
}

function parseTime(value) {
  const normalized = toIsoString(value)
  if (!normalized) {
    return 0
  }

  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeSyncState(row) {
  return {
    syncInProgress: row?.sync_in_progress === true,
    syncMode: sanitizeText(row?.sync_mode, 24) || "manual_full",
    lastSyncAt: toIsoString(row?.last_sync_at),
    lastSyncStartedAt: toIsoString(row?.last_sync_started_at),
    lastSyncFinishedAt: toIsoString(row?.last_sync_finished_at),
    lastSyncError: sanitizeText(row?.last_sync_error, 500),
  }
}

function buildIncrementalSnapshotPatch(projectId, item, previousRow = null) {
  const now = new Date().toISOString()
  return {
    projeto_id: projectId,
    ml_item_id: sanitizeText(item?.id, 60),
    titulo: sanitizeText(item?.title || previousRow?.titulo, 180),
    slug: sanitizeText(slugifyProduct(item?.title || previousRow?.titulo), 180),
    preco: Number(item?.price ?? previousRow?.preco ?? 0) || 0,
    thumbnail_url: sanitizeText(item?.thumbnail || item?.pictures?.[0] || previousRow?.thumbnail_url, 500),
    permalink: sanitizeText(item?.permalink || previousRow?.permalink, 500),
    status: sanitizeText(item?.status || previousRow?.status, 40),
    estoque: Number(item?.availableQuantity ?? previousRow?.estoque ?? 0) || 0,
    categoria_id: sanitizeText(item?.categoryId || previousRow?.categoria_id, 80),
    categoria_nome: sanitizeText(item?.categoryName || previousRow?.categoria_nome, 160),
    ml_date_created: toIsoString(item?.dateCreated || previousRow?.ml_date_created),
    ml_last_updated: toIsoString(item?.lastUpdated || previousRow?.ml_last_updated),
    ultima_sincronizacao_em: now,
    updated_at: now,
  }
}

function hasIncrementalRowChanged(nextRow, previousRow = null) {
  if (!previousRow) {
    return true
  }

  return (
    sanitizeText(nextRow?.titulo, 180) !== sanitizeText(previousRow?.titulo, 180) ||
    sanitizeText(nextRow?.slug, 180) !== sanitizeText(previousRow?.slug, 180) ||
    Number(nextRow?.preco ?? 0) !== Number(previousRow?.preco ?? 0) ||
    sanitizeText(nextRow?.thumbnail_url, 500) !== sanitizeText(previousRow?.thumbnail_url, 500) ||
    sanitizeText(nextRow?.permalink, 500) !== sanitizeText(previousRow?.permalink, 500) ||
    sanitizeText(nextRow?.status, 40) !== sanitizeText(previousRow?.status, 40) ||
    Number(nextRow?.estoque ?? 0) !== Number(previousRow?.estoque ?? 0) ||
    sanitizeText(nextRow?.categoria_id, 80) !== sanitizeText(previousRow?.categoria_id, 80) ||
    sanitizeText(nextRow?.categoria_nome, 160) !== sanitizeText(previousRow?.categoria_nome, 160) ||
    toIsoString(nextRow?.ml_date_created) !== toIsoString(previousRow?.ml_date_created) ||
    toIsoString(nextRow?.ml_last_updated) !== toIsoString(previousRow?.ml_last_updated)
  )
}

async function getMercadoLivreSyncState(projectId, deps = {}) {
  if (!projectId) {
    return { state: normalizeSyncState(null), available: false }
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from(SYNC_STATE_TABLE)
    .select("project_id, sync_in_progress, sync_mode, last_sync_at, last_sync_started_at, last_sync_finished_at, last_sync_error")
    .eq("project_id", projectId)
    .maybeSingle()

  if (error) {
    if (isMissingSyncStateTableError(error)) {
      return { state: normalizeSyncState(null), available: false }
    }
    console.error("[mercado-livre-store-sync] failed to load sync state", error)
    return { state: normalizeSyncState(null), available: true }
  }

  return { state: normalizeSyncState(data), available: true }
}

async function patchMercadoLivreSyncState(projectId, patch, deps = {}) {
  if (!projectId) {
    return { ok: false, available: false }
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const payload = {
    project_id: projectId,
    updated_at: new Date().toISOString(),
    ...patch,
  }

  const { error } = await supabase.from(SYNC_STATE_TABLE).upsert(payload, { onConflict: "project_id" })

  if (error) {
    if (isMissingSyncStateTableError(error)) {
      return { ok: false, available: false }
    }
    console.error("[mercado-livre-store-sync] failed to patch sync state", error)
    return { ok: false, available: true }
  }

  return { ok: true, available: true }
}

async function releaseMercadoLivreSyncStateOnError(projectId, mode, message, deps = {}) {
  if (!projectId) {
    return
  }

  await patchMercadoLivreSyncState(
    projectId,
    {
      sync_in_progress: false,
      sync_mode: sanitizeText(mode, 24) || "manual_full",
      last_sync_finished_at: new Date().toISOString(),
      last_sync_error: sanitizeText(message, 500),
    },
    deps,
  )
}

async function acquireMercadoLivreSyncLock(projectId, mode, deps = {}) {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - AUTO_SYNC_STALE_LOCK_MS).toISOString()
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const seedResult = await patchMercadoLivreSyncState(projectId, {}, { supabase })
  if (seedResult.available === false) {
    return { acquired: true, available: false }
  }

  const { data, error } = await supabase
    .from(SYNC_STATE_TABLE)
    .update({
      sync_in_progress: true,
      sync_mode: sanitizeText(mode, 24) || "manual_full",
      last_sync_started_at: now.toISOString(),
      last_sync_error: "",
      updated_at: now.toISOString(),
    })
    .eq("project_id", projectId)
    .or(`sync_in_progress.is.false,last_sync_started_at.lt.${staleCutoff},last_sync_started_at.is.null`)
    .select("project_id")
    .maybeSingle()

  if (error) {
    if (isMissingSyncStateTableError(error)) {
      return { acquired: true, available: false }
    }
    console.error("[mercado-livre-store-sync] failed to acquire sync lock", error)
    return { acquired: false, available: true }
  }

  return { acquired: Boolean(data?.project_id), available: true }
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
    ml_date_created: toIsoString(item?.dateCreated),
    ml_last_updated: toIsoString(item?.lastUpdated),
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
      .select("ml_item_id, titulo, slug, ml_date_created, updated_at")
      .eq("projeto_id", projectId)
      .order("ml_date_created", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(5),
  ])

  const latestProducts = Array.isArray(latestResult.data) ? latestResult.data : []
  const syncStateResult = await getMercadoLivreSyncState(projectId, { supabase })
  return {
    total: Number(count || 0) || 0,
    lastSyncAt: latestProducts[0]?.updated_at || null,
    latestProducts,
    syncState: syncStateResult.state,
  }
}

async function syncMercadoLivreSnapshotIncrementalForProject(project, options = {}, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const limit = Math.min(Math.max(Number(options.limit ?? 20) || 20, 1), 20)
  const startOffset = Math.max(Number(options.offset ?? 0) || 0, 0)
  const collectedItems = []
  let currentOffset = startOffset
  let lastPaging = null

  while (true) {
    const result = await listMercadoLivreItemsForProject(
      project,
      { limit, offset: currentOffset, includeDetails: false },
      { supabase }
    )

    if (result.error) {
      return buildSyncError(result.error, "list_items_incremental", { paging: result.paging || lastPaging })
    }

    const pageItems = Array.isArray(result.items) ? result.items : []
    collectedItems.push(...pageItems)
    lastPaging = result.paging || lastPaging

    if (result.paging?.hasMore !== true) {
      break
    }

    currentOffset += Number(result.paging?.limit || limit) || limit
  }

  const existingResult = await supabase
    .from("mercadolivre_produtos_snapshot")
    .select("ml_item_id, titulo, slug, preco, thumbnail_url, permalink, status, estoque, categoria_id, categoria_nome, ml_date_created, ml_last_updated")
    .eq("projeto_id", project.id)

  if (existingResult.error) {
    console.error("[mercado-livre-store-sync] failed to load snapshot rows for incremental sync", existingResult.error)
    return buildSyncError("Nao foi possivel atualizar o snapshot incremental.", "load_existing_rows_incremental", {
      paging: lastPaging,
      error: existingResult.error.message || "unknown_error",
      errorCode: existingResult.error.code || null,
    })
  }

  const existingRows = Array.isArray(existingResult.data) ? existingResult.data : []
  const existingMap = new Map(existingRows.map((row) => [sanitizeText(row?.ml_item_id, 60), row]))
  const eligibleItems = collectedItems.filter(isSnapshotEligibleItem)
  const eligibleIdSet = new Set(eligibleItems.map((item) => sanitizeText(item?.id, 60)).filter(Boolean))
  const rowsToPatch = []
  const rowsToInsert = []
  const newItemIds = []

  for (const item of eligibleItems) {
    const itemId = sanitizeText(item?.id, 60)
    if (!itemId) {
      continue
    }

    const previousRow = existingMap.get(itemId)
    if (!previousRow) {
      newItemIds.push(itemId)
      continue
    }

    const nextRow = buildIncrementalSnapshotPatch(project.id, item, previousRow)
    if (hasIncrementalRowChanged(nextRow, previousRow)) {
      rowsToPatch.push(nextRow)
    }
  }

  for (let index = 0; index < newItemIds.length; index += 5) {
    const batch = newItemIds.slice(index, index + 5)
    const detailedResults = await Promise.allSettled(
      batch.map(async (itemId) => {
        const result = await getMercadoLivreProductByIdForProject(project, itemId, { supabase })
        return result?.item || null
      })
    )

    for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
      const itemId = batch[batchIndex]
      const entry = detailedResults[batchIndex]
      const detailedItem = entry?.status === "fulfilled" ? entry.value : null
      const basicItem = eligibleItems.find((item) => sanitizeText(item?.id, 60) === itemId)
      const row = buildSnapshotRow(project.id, detailedItem || basicItem)
      if (row.ml_item_id && row.titulo && row.slug) {
        rowsToInsert.push(row)
      }
    }
  }

  const idsToDelete = existingRows
    .map((row) => sanitizeText(row?.ml_item_id, 60))
    .filter((itemId) => itemId && !eligibleIdSet.has(itemId))

  if (rowsToPatch.length) {
    const { error } = await supabase
      .from("mercadolivre_produtos_snapshot")
      .upsert(rowsToPatch, { onConflict: "projeto_id,ml_item_id" })

    if (error) {
      console.error("[mercado-livre-store-sync] failed to upsert incremental snapshot rows", error)
      return buildSyncError("Nao foi possivel atualizar o snapshot incremental.", "upsert_incremental_rows", {
        paging: lastPaging,
        rows: rowsToPatch.length,
        error: error.message || "unknown_error",
        errorCode: error.code || null,
      })
    }
  }

  if (rowsToInsert.length) {
    const { error } = await supabase
      .from("mercadolivre_produtos_snapshot")
      .upsert(rowsToInsert, { onConflict: "projeto_id,ml_item_id" })

    if (error) {
      console.error("[mercado-livre-store-sync] failed to upsert new snapshot rows", error)
      return buildSyncError("Nao foi possivel adicionar produtos novos ao snapshot.", "upsert_new_rows_incremental", {
        paging: lastPaging,
        rows: rowsToInsert.length,
        error: error.message || "unknown_error",
        errorCode: error.code || null,
      })
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
      console.error("[mercado-livre-store-sync] failed to delete stale rows during incremental sync", deleteResult.error)
      return buildSyncError("Nao foi possivel limpar produtos inativos do snapshot.", "delete_stale_rows_incremental", {
        paging: lastPaging,
        staleRows: idsToDelete.length,
        error: deleteResult.error.message || "unknown_error",
        errorCode: deleteResult.error.code || null,
      })
    }
  }

  return {
    synced: rowsToPatch.length + rowsToInsert.length,
    deleted: idsToDelete.length,
    changed: rowsToPatch.length > 0 || rowsToInsert.length > 0 || idsToDelete.length > 0,
    paging: lastPaging,
    error: null,
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
    const syncMode = fullSync ? "manual_full" : "auto_incremental"
    const startOffset = Math.max(Number(options.offset ?? 0) || 0, 0)
    const lockResult = await acquireMercadoLivreSyncLock(project.id, syncMode, { supabase })
    if (!lockResult.acquired) {
      return buildSyncError("Ja existe uma sincronizacao em andamento para esta loja.", "sync_locked")
    }

    if (!fullSync) {
      const incrementalResult = await syncMercadoLivreSnapshotIncrementalForProject(project, { limit, offset: startOffset }, { supabase })
      const finishedAt = new Date().toISOString()
      if (incrementalResult.error) {
        await patchMercadoLivreSyncState(
          project.id,
          {
            sync_in_progress: false,
            sync_mode: syncMode,
            last_sync_finished_at: finishedAt,
            last_sync_error: sanitizeText(incrementalResult.error, 500),
          },
          { supabase },
        )
        return incrementalResult
      }

      await patchMercadoLivreSyncState(
        project.id,
        {
          sync_in_progress: false,
          sync_mode: syncMode,
          last_sync_at: finishedAt,
          last_sync_finished_at: finishedAt,
          last_sync_error: "",
        },
        { supabase },
      )

      return incrementalResult
    }

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
        await releaseMercadoLivreSyncStateOnError(project.id, syncMode, result.error, { supabase })
        return buildSyncError(result.error, "list_items", { paging: result.paging || lastPaging })
      }

      const pageItems = Array.isArray(result.items) ? result.items : []
      collectedItems.push(...pageItems)
      lastPaging = result.paging || lastPaging

      if (!fullSync || result.paging?.hasMore !== true) {
        break
      }

      currentOffset += Number(result.paging?.limit || limit) || limit
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
      await releaseMercadoLivreSyncStateOnError(project.id, syncMode, "Nao foi possivel atualizar o snapshot da loja.", { supabase })
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
            await releaseMercadoLivreSyncStateOnError(project.id, syncMode, replaceResult.error, { supabase })
            return buildSyncError(replaceResult.error, "replace_rows", {
              paging: lastPaging,
              rows: rows.length,
            })
          }
        } else {
          console.error("[mercado-livre-store-sync] failed to upsert snapshot rows", error)
          await releaseMercadoLivreSyncStateOnError(project.id, syncMode, "Nao foi possivel atualizar o snapshot da loja.", { supabase })
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
        await releaseMercadoLivreSyncStateOnError(project.id, syncMode, "Nao foi possivel limpar produtos inativos do snapshot.", { supabase })
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

    const finishedAt = new Date().toISOString()
    await patchMercadoLivreSyncState(
      project.id,
      {
        sync_in_progress: false,
        sync_mode: syncMode,
        last_sync_at: finishedAt,
        last_sync_finished_at: finishedAt,
        last_sync_error: "",
      },
      { supabase },
    )

    return {
      synced: rows.length,
      paging: lastPaging,
      changed: rows.length > 0 || idsToDelete.length > 0,
      error: null,
    }
  } catch (error) {
    console.error("[mercado-livre-store-sync] unexpected snapshot sync failure", error)
    if (project?.id) {
      await patchMercadoLivreSyncState(
        project.id,
        {
          sync_in_progress: false,
          last_sync_finished_at: new Date().toISOString(),
          last_sync_error: sanitizeText(error instanceof Error ? error.message : "unknown_error", 500),
        },
        deps,
      )
    }
    return buildSyncError("Nao foi possivel atualizar a loja no banco.", "unexpected_failure", {
      error: error instanceof Error ? error.message : "unknown_error",
    })
  }
}

export async function maybeAutoSyncMercadoLivreSnapshotForProject(project, deps = {}) {
  if (!project?.id) {
    return { triggered: false, changed: false, reason: "project_missing" }
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const syncStateResult = await getMercadoLivreSyncState(project.id, { supabase })
  const state = syncStateResult.state
  const now = Date.now()
  const lastSyncAt = parseTime(state.lastSyncAt)
  const lastStartedAt = parseTime(state.lastSyncStartedAt)

  if (state.syncInProgress && lastStartedAt > now - AUTO_SYNC_STALE_LOCK_MS) {
    return { triggered: false, changed: false, reason: "sync_in_progress", state }
  }

  if (lastSyncAt && lastSyncAt > now - AUTO_SYNC_INTERVAL_MS) {
    return { triggered: false, changed: false, reason: "rate_limited", state }
  }

  const result = await syncMercadoLivreSnapshotForProject(project, { fullSync: false, limit: 20, offset: 0 }, { supabase })
  return {
    triggered: !result.error,
    changed: result.changed === true,
    reason: result.error ? "sync_error" : "synced",
    error: result.error || null,
    state,
  }
}
