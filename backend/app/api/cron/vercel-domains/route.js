import { NextResponse } from "next/server"

import { verifyStoreDomain } from "@/lib/vercel-project-domains"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const MAX_DOMAINS_PER_RUN = 10

export async function GET(request) {
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabaseAdminClient()
  const { data: stores, error } = await supabase
    .from("mercadolivre_lojas")
    .select("id, projeto_id, slug, dominio_personalizado, dominio_ativo, dominio_status")
    .not("dominio_personalizado", "is", null)
    .neq("dominio_status", "active")
    .order("updated_at", { ascending: true, nullsFirst: false })
    .limit(MAX_DOMAINS_PER_RUN)

  if (error) {
    console.error("[vercel-domains-cron] failed to load stores", error)
    return NextResponse.json({ error: "Não foi possível listar domínios." }, { status: 500 })
  }

  const results = []
  for (const store of stores || []) {
    const result = await verifyStoreDomain(store, { supabase })
    results.push({
      storeId: store.id,
      projectId: store.projeto_id,
      slug: store.slug,
      domain: result.domain || store.dominio_personalizado,
      ok: result.ok,
      status: result.summary?.status || null,
      verified: result.summary?.verified === true,
      error: result.error || null,
    })
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    activated: results.filter((item) => item.verified).length,
    results,
  }, { status: 200 })
}
