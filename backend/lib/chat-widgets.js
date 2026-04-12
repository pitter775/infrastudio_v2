import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

export const PUBLIC_WIDGET_DOMAIN = "https://www.infrastudio.pro"

function mapChatWidget(row) {
  return {
    id: row.id,
    nome: row.nome?.trim() || "Widget sem nome",
    slug: row.slug?.trim() || row.id,
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

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function normalizeWidgetInput(input, project) {
  const nome = String(input.nome || input.name || "").trim()
  const slug = slugify(input.slug || nome)

  if (!nome || !slug) {
    return { error: "Nome e slug sao obrigatorios." }
  }

  return {
    payload: {
      nome,
      slug,
      projeto_id: project.id,
      agente_id: input.agenteId === null ? null : input.agenteId || project.agent?.id || null,
      dominio: String(input.dominio || input.domain || "").trim(),
      whatsapp_celular: String(input.whatsappCelular || input.whatsapp || "").trim(),
      tema: input.tema === "light" || input.theme === "light" ? "light" : "dark",
      cor_primaria: String(input.corPrimaria || input.accent || "#2563eb").trim() || "#2563eb",
      fundo_transparente: input.fundoTransparente === false || input.transparent === false ? false : true,
      ativo: input.ativo === false || input.active === false ? false : true,
      updated_at: new Date().toISOString(),
    },
  }
}

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

export async function listChatWidgetsForUser(project, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", project.id)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("[chat-widgets] failed to list widgets", error)
      return []
    }

    return data.map(mapChatWidget)
  } catch (error) {
    console.error("[chat-widgets] failed to list widgets", error)
    return []
  }
}

export async function createChatWidgetForUser(project, input, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { widget: null, error: "Acesso negado." }
  }

  const normalized = normalizeWidgetInput(input, project)
  if (normalized.error) {
    return { widget: null, error: normalized.error }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("chat_widgets")
      .insert(normalized.payload)
      .select(selectFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to create widget", error)
      }
      return { widget: null, error: "Nao foi possivel criar o widget." }
    }

    return { widget: mapChatWidget(data), error: null }
  } catch (error) {
    console.error("[chat-widgets] failed to create widget", error)
    return { widget: null, error: "Nao foi possivel criar o widget." }
  }
}

export async function updateChatWidgetForUser(widgetId, project, input, user) {
  if (!widgetId || !project?.id || !userCanAccessProject(user, project.id)) {
    return { widget: null, error: "Acesso negado." }
  }

  const normalized = normalizeWidgetInput(input, project)
  if (normalized.error) {
    return { widget: null, error: normalized.error }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("chat_widgets")
      .update(normalized.payload)
      .eq("id", widgetId)
      .eq("projeto_id", project.id)
      .select(selectFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to update widget", error)
      }
      return { widget: null, error: "Nao foi possivel atualizar o widget." }
    }

    return { widget: mapChatWidget(data), error: null }
  } catch (error) {
    console.error("[chat-widgets] failed to update widget", error)
    return { widget: null, error: "Nao foi possivel atualizar o widget." }
  }
}
