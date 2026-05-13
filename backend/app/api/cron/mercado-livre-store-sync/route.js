import { NextResponse } from "next/server"

import { syncMercadoLivreSnapshotForProject } from "@/lib/mercado-livre-store-sync"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const SYNC_INTERVAL_MS = 30 * 60 * 1000
const MAX_STORES_PER_RUN = 3

function parseTime(value) {
  const parsed = Date.parse(String(value || ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function isDueForSync(state, now = Date.now()) {
  if (state?.sync_in_progress === true) {
    return false
  }

  const lastSyncAt = parseTime(state?.last_sync_at)
  return !lastSyncAt || lastSyncAt <= now - SYNC_INTERVAL_MS
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdminClient()
  const { data: stores, error: storesError } = await supabase
    .from("mercadolivre_lojas")
    .select("projeto_id, slug, nome")
    .eq("ativo", true)
    .not("projeto_id", "is", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(25)

  if (storesError) {
    console.error("[mercado-livre-store-cron] failed to load stores", storesError)
    return NextResponse.json({ error: "Nao foi possivel listar lojas do Mercado Livre." }, { status: 500 })
  }

  const projectIds = [...new Set((stores || []).map((store) => store.projeto_id).filter(Boolean))]
  if (!projectIds.length) {
    return NextResponse.json({ ok: true, checked: 0, synced: 0, results: [] }, { status: 200 })
  }

  const { data: states, error: statesError } = await supabase
    .from("mercadolivre_lojas_sync")
    .select("project_id, sync_in_progress, last_sync_at")
    .in("project_id", projectIds)

  if (statesError) {
    console.error("[mercado-livre-store-cron] failed to load sync states", statesError)
    return NextResponse.json({ error: "Nao foi possivel validar status de sincronizacao." }, { status: 500 })
  }

  const stateByProject = new Map((states || []).map((state) => [state.project_id, state]))
  const dueStores = (stores || [])
    .filter((store) => isDueForSync(stateByProject.get(store.projeto_id)))
    .slice(0, MAX_STORES_PER_RUN)

  const results = []
  for (const store of dueStores) {
    const result = await syncMercadoLivreSnapshotForProject(
      {
        id: store.projeto_id,
        slug: store.slug,
        name: store.nome,
      },
      { fullSync: false, limit: 20, offset: 0 },
      { supabase },
    )

    results.push({
      projectId: store.projeto_id,
      storeSlug: store.slug,
      synced: Number(result.synced || 0),
      deleted: Number(result.deleted || 0),
      changed: result.changed === true,
      error: result.error || null,
      stage: result.stage || null,
    })
  }

  return NextResponse.json(
    {
      ok: true,
      checked: projectIds.length,
      due: dueStores.length,
      synced: results.filter((item) => !item.error).length,
      results,
    },
    { status: 200 },
  )
}
