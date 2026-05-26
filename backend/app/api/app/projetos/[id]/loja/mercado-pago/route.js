import { NextResponse } from "next/server"

import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const PAYMENT_SELECT = "status, mode, account_email, account_id, token_expires_at, connected_at, last_validated_at, last_error_message, updated_at"

export async function GET(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("loja_pagamento_config")
    .select(PAYMENT_SELECT)
    .eq("projeto_id", project.id)
    .eq("provider", "mercado_pago")
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Não foi possível carregar o pagamento da loja." }, { status: 500 })
  }

  const envFallbackEnabled = Boolean(process.env.MERCADO_PAGO_STORE_ACCESS_TOKEN?.trim())

  return NextResponse.json(
    {
      payment: data
        ? {
            provider: "mercado_pago",
            status: data.status || "desconectado",
            mode: data.mode || "test",
            accountEmail: data.account_email || "",
            accountId: data.account_id || "",
            tokenExpiresAt: data.token_expires_at || null,
            connectedAt: data.connected_at || null,
            lastValidatedAt: data.last_validated_at || null,
            lastErrorMessage: data.last_error_message || "",
            updatedAt: data.updated_at || null,
            envFallbackEnabled,
          }
        : {
            provider: "mercado_pago",
            status: envFallbackEnabled ? "env_test" : "desconectado",
            mode: envFallbackEnabled ? "test" : "unconfigured",
            accountEmail: "",
            accountId: "",
            tokenExpiresAt: null,
            connectedAt: null,
            lastValidatedAt: null,
            lastErrorMessage: "",
            updatedAt: null,
            envFallbackEnabled,
          },
    },
    { status: 200 },
  )
}

export async function DELETE(_request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from("loja_pagamento_config")
    .update({
      status: "desconectado",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      last_error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("projeto_id", project.id)
    .eq("provider", "mercado_pago")

  if (error) {
    return NextResponse.json({ error: "Não foi possível desconectar o Mercado Pago." }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
