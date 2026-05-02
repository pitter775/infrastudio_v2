import { NextResponse } from "next/server"

import { getPublicMercadoLivreStoreBySlug } from "@/lib/mercado-livre-store"
import { maybeAutoSyncMercadoLivreSnapshotForProject } from "@/lib/mercado-livre-store-sync"

export async function POST(_request, context) {
  try {
    const { slug } = await context.params
    const result = await getPublicMercadoLivreStoreBySlug(slug, { page: 1, limit: 1 })

    if (!result?.store?.projectId) {
      return NextResponse.json({ error: "Loja nao encontrada." }, { status: 404 })
    }

    const syncResult = await maybeAutoSyncMercadoLivreSnapshotForProject(
      {
        id: result.store.projectId,
        slug: result.store.projectSlug,
        name: result.store.projectName || result.store.name,
      },
      {},
    )

    return NextResponse.json(syncResult, {
      status: syncResult.error ? 400 : 200,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[mercado-livre-public-snapshot-refresh] unexpected failure", error)
    return NextResponse.json(
      {
        error: "Nao foi possivel verificar a atualizacao automatica da loja.",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    )
  }
}
