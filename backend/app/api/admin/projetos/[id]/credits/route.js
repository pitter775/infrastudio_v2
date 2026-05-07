import { NextResponse } from "next/server"

import { getTopUpExpirationDate } from "@/lib/billing"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const ADMIN_CREDIT_TOKENS = 100000

export async function POST(_request, context) {
  const user = await getSessionUser()

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "Projeto obrigatório." }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()
  const { data: project, error: projectError } = await supabase
    .from("projetos")
    .select("id")
    .eq("id", id)
    .maybeSingle()

  if (projectError) {
    console.error("[admin-project-credits] failed to load project", projectError)
    return NextResponse.json({ error: "Não foi possível validar o projeto." }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const now = new Date().toISOString()
  const payload = {
    projeto_id: id,
    tokens: ADMIN_CREDIT_TOKENS,
    custo: 0,
    origem: "admin_credito_manual",
    utilizado: false,
    tokens_utilizados: 0,
    created_at: now,
    expires_at: getTopUpExpirationDate(now),
  }
  const insert = await supabase.from("tokens_avulsos").insert(payload)

  if (insert.error && /expires_at|schema cache|column/i.test(String(insert.error.message || ""))) {
    const { expires_at: _expiresAt, ...fallbackPayload } = payload
    const fallback = await supabase.from("tokens_avulsos").insert(fallbackPayload)

    if (fallback.error) {
      console.error("[admin-project-credits] failed to insert fallback top-up", fallback.error)
      return NextResponse.json({ error: "Não foi possível adicionar os créditos." }, { status: 500 })
    }
  } else if (insert.error) {
    console.error("[admin-project-credits] failed to insert top-up", insert.error)
    return NextResponse.json({ error: "Não foi possível adicionar os créditos." }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: true,
      tokens: ADMIN_CREDIT_TOKENS,
    },
    { status: 200 },
  )
}
