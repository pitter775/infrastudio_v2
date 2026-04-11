import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const DEFAULT_HOME_WIDGET_SLUG = "infrastudio-home"

function mapChatWidget(row) {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Widget sem nome",
    slug: row.slug?.trim() || DEFAULT_HOME_WIDGET_SLUG,
    projetoId: row.projeto_id ?? null,
    agenteId: row.agente_id ?? null,
    dominio: row.dominio?.trim() || "",
    whatsappCelular: row.whatsapp_celular?.trim() || "",
    tema: row.tema === "light" ? "light" : "dark",
    corPrimaria: row.cor_primaria?.trim() || "#2563eb",
    fundoTransparente: Boolean(row.fundo_transparente),
    ativo: row.ativo !== false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

const selectFields =
  "id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, ativo, created_at, updated_at"

export async function getChatWidgetBySlug(slug) {
  const value = String(slug || "").trim()
  if (!value) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("slug", value)
      .eq("ativo", true)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to load widget by slug", error)
      }
      return null
    }

    return mapChatWidget(data)
  } catch (error) {
    console.error("[chat-widgets] failed to load widget by slug", error)
    return null
  }
}

export async function getChatWidgetByProjetoAgente(input) {
  if (!input?.projetoId) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()

    if (input.agenteId) {
      const { data, error } = await supabase
        .from("chat_widgets")
        .select(selectFields)
        .eq("projeto_id", input.projetoId)
        .eq("agente_id", input.agenteId)
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (data) {
        return mapChatWidget(data)
      }

      if (error) {
        console.error("[chat-widgets] failed to load widget by projeto/agente", error)
      }
    }

    const { data, error } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", input.projetoId)
      .is("agente_id", null)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to load fallback widget by projeto", error)
      }
      return null
    }

    return mapChatWidget(data)
  } catch (error) {
    console.error("[chat-widgets] failed to load widget by projeto/agente", error)
    return null
  }
}
