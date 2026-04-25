import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const ALLOWED_EVENT_TYPES = new Set([
  "product_open",
  "product_buy_click",
  "product_chat_click",
])

function sanitizeText(value, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength)
}

export async function POST(request, { params }) {
  try {
    const { slug } = await params
    const storeSlug = sanitizeText(slug, 80)
    if (!storeSlug) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const payload = await request.json().catch(() => ({}))
    const type = sanitizeText(payload?.type, 40)
    if (!ALLOWED_EVENT_TYPES.has(type)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    const { data: storeRow, error: storeError } = await supabase
      .from("mercadolivre_lojas")
      .select("id, projeto_id, slug, ativo")
      .eq("slug", storeSlug)
      .eq("ativo", true)
      .maybeSingle()

    if (storeError || !storeRow?.id || !storeRow?.projeto_id) {
      return NextResponse.json({ ok: false }, { status: 404 })
    }

    const { error: insertError } = await supabase
      .from("mercadolivre_loja_eventos")
      .insert({
        projeto_id: storeRow.projeto_id,
        loja_id: storeRow.id,
        loja_slug: storeRow.slug,
        tipo: type,
        origem: sanitizeText(payload?.source, 40) || null,
        produto_slug: sanitizeText(payload?.productSlug, 180) || null,
        ml_item_id: sanitizeText(payload?.mlItemId, 60) || null,
        sessao_id: sanitizeText(payload?.sessionId, 120) || null,
      })

    if (insertError) {
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
