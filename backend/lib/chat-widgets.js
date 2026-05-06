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
    identificacaoContatoAtiva: row.identificacao_contato_ativa === true,
    ativo: row.ativo !== false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

const selectFields =
  "id, nome, slug, projeto_id, agente_id, dominio, whatsapp_celular, tema, cor_primaria, fundo_transparente, identificacao_contato_ativa, ativo, created_at, updated_at"

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

function buildDefaultWidgetNames(project) {
  const projectName = String(project?.name || "Projeto").trim() || "Projeto"
  const baseSlug = slugify(project?.slug || project?.name || "chat")

  return {
    defaultName: `${projectName} Chat`,
    defaultSlug: `${baseSlug || "chat"}-chat`,
  }
}

function pickPrimaryWidgetRow(rows, preferredAgentId = null) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) {
    return null
  }

  if (preferredAgentId) {
    const agentWidget = list.find((item) => item.agente_id === preferredAgentId && item.ativo !== false)
    if (agentWidget) {
      return agentWidget
    }
  }

  return list.find((item) => item.ativo !== false) ?? list[0]
}

async function cleanupExtraWidgetsForProject(supabase, projectId, keepWidgetId) {
  if (!projectId || !keepWidgetId) {
    return
  }

  const { data, error } = await supabase
    .from("chat_widgets")
    .select("id")
    .eq("projeto_id", projectId)

  if (error || !data?.length) {
    if (error) {
      console.error("[chat-widgets] failed to load widgets for singleton cleanup", error)
    }
    return
  }

  const duplicateIds = data.map((item) => item.id).filter((id) => id && id !== keepWidgetId)
  if (!duplicateIds.length) {
    return
  }

  const { error: deleteError } = await supabase.from("chat_widgets").delete().in("id", duplicateIds)

  if (deleteError) {
    console.error("[chat-widgets] failed to delete extra widgets", deleteError)
  }
}

function isLikelyAutoCreatedProjectWidget(widget, project) {
  if (!widget) {
    return false
  }

  const { defaultName, defaultSlug } = buildDefaultWidgetNames(project)
  const widgetName = String(widget.nome || "").trim()
  const widgetSlug = String(widget.slug || "").trim()

  return widgetName === defaultName || widgetSlug === defaultSlug
}

async function removeProjectLevelWidgetDuplicates(supabase, project, agentId, keepWidgetId) {
  if (!project?.id || !agentId) {
    return
  }

  const { data, error } = await supabase
    .from("chat_widgets")
    .select(selectFields)
    .eq("projeto_id", project.id)
    .eq("ativo", true)

  if (error || !data?.length) {
    if (error) {
      console.error("[chat-widgets] failed to load widgets for duplicate cleanup", error)
    }
    return
  }

  const hasAgentWidget = data.some((item) => item.agente_id === agentId && item.id !== keepWidgetId)
  if (!hasAgentWidget && !keepWidgetId) {
    return
  }

  const duplicateIds = data
    .filter((item) => item.id !== keepWidgetId)
    .filter((item) => item.agente_id == null)
    .filter((item) => isLikelyAutoCreatedProjectWidget(item, project))
    .map((item) => item.id)

  if (!duplicateIds.length) {
    return
  }

  const { error: deleteError } = await supabase.from("chat_widgets").delete().in("id", duplicateIds)

  if (deleteError) {
    console.error("[chat-widgets] failed to delete duplicate project widgets", deleteError)
  }
}

async function buildUniqueWidgetSlug(supabase, value) {
  const baseSlug = slugify(value) || "chat"
  let slug = baseSlug
  let index = 2

  while (true) {
    const { data, error } = await supabase.from("chat_widgets").select("id").eq("slug", slug).limit(1)

    if (error) {
      console.error("[chat-widgets] failed to validate slug", error)
      return slug
    }

    if (!data?.length) {
      return slug
    }

    slug = `${baseSlug}-${index}`
    index += 1
  }
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
      identificacao_contato_ativa:
        input.identificacaoContatoAtiva === true || input.identificationBoxEnabled === true ? true : false,
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

export async function getChatWidgetById(widgetId) {
  const value = String(widgetId || "").trim()
  if (!value) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("id", value)
      .eq("ativo", true)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to load widget by id", error)
      }
      return null
    }

    return mapChatWidget(data)
  } catch (error) {
    console.error("[chat-widgets] failed to load widget by id", error)
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
    if (project.agent?.id) {
      await removeProjectLevelWidgetDuplicates(supabase, project, project.agent.id)
    }

    const { data, error } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", project.id)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("[chat-widgets] failed to list widgets", error)
      return []
    }

    const primaryWidget = pickPrimaryWidgetRow(data, project.agent?.id || null)

    if (!primaryWidget) {
      return []
    }

    await cleanupExtraWidgetsForProject(supabase, project.id, primaryWidget.id)
    return [mapChatWidget(primaryWidget)]
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
    const { data: existingRows, error: existingError } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", project.id)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (existingError) {
      console.error("[chat-widgets] failed to load existing widget before save", existingError)
      return { widget: null, error: "Não foi possível salvar o widget." }
    }

    const primaryWidget = pickPrimaryWidgetRow(existingRows, project.agent?.id || null)
    const query = primaryWidget?.id
      ? supabase
          .from("chat_widgets")
          .update(normalized.payload)
          .eq("id", primaryWidget.id)
          .eq("projeto_id", project.id)
      : supabase.from("chat_widgets").insert(normalized.payload)

    const { data, error } = await query.select(selectFields).maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to create widget", error)
      }
      return { widget: null, error: "Não foi possível criar o widget." }
    }

    await cleanupExtraWidgetsForProject(supabase, project.id, data.id)
    return { widget: mapChatWidget(data), error: null }
  } catch (error) {
    console.error("[chat-widgets] failed to create widget", error)
    return { widget: null, error: "Não foi possível criar o widget." }
  }
}

export async function ensureDefaultChatWidgetForAgent(project, agent, user) {
  if (!project?.id || !agent?.id || !userCanAccessProject(user, project.id)) {
    return { widget: null, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: existing, error: existingError } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", project.id)
      .eq("agente_id", agent.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      await cleanupExtraWidgetsForProject(supabase, project.id, existing.id)
      await removeProjectLevelWidgetDuplicates(supabase, project, agent.id, existing.id)
      return { widget: mapChatWidget(existing), error: null }
    }

    if (existingError) {
      console.error("[chat-widgets] failed to load default widget", existingError)
    }

    const { data: projectLevelWidget, error: projectLevelWidgetError } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", project.id)
      .is("agente_id", null)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (projectLevelWidget?.id) {
      const { data: reboundWidget, error: reboundWidgetError } = await supabase
        .from("chat_widgets")
        .update({
          agente_id: agent.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectLevelWidget.id)
        .eq("projeto_id", project.id)
        .select(selectFields)
        .maybeSingle()

      if (reboundWidgetError) {
        console.error("[chat-widgets] failed to bind existing project widget to agent", reboundWidgetError)
      } else if (reboundWidget) {
        await cleanupExtraWidgetsForProject(supabase, project.id, reboundWidget.id)
        await removeProjectLevelWidgetDuplicates(supabase, project, agent.id, reboundWidget.id)
        return { widget: mapChatWidget(reboundWidget), error: null }
      }
    } else if (projectLevelWidgetError) {
      console.error("[chat-widgets] failed to load project-level widget for agent binding", projectLevelWidgetError)
    }

    const slug = await buildUniqueWidgetSlug(supabase, `${project.slug || project.name}-chat`)
    const { data, error } = await supabase
      .from("chat_widgets")
      .insert({
        nome: `${project.name || "Projeto"} Chat`,
        slug,
        projeto_id: project.id,
        agente_id: agent.id,
        dominio: "",
        whatsapp_celular: "",
        tema: "dark",
        cor_primaria: "#2563eb",
        fundo_transparente: true,
        identificacao_contato_ativa: false,
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .select(selectFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to create default widget", error)
      }
      return { widget: null, error: "Não foi possível criar o widget padrão." }
    }

    await cleanupExtraWidgetsForProject(supabase, project.id, data.id)
    await removeProjectLevelWidgetDuplicates(supabase, project, agent.id, data.id)
    return { widget: mapChatWidget(data), error: null }
  } catch (error) {
    console.error("[chat-widgets] failed to ensure default widget", error)
    return { widget: null, error: "Não foi possível criar o widget padrão." }
  }
}

export async function ensureProjectHasDefaultWidget(project, user) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { widget: null, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: existing, error: existingError } = await supabase
      .from("chat_widgets")
      .select(selectFields)
      .eq("projeto_id", project.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      await cleanupExtraWidgetsForProject(supabase, project.id, existing.id)
      return { widget: mapChatWidget(existing), error: null }
    }

    if (existingError) {
      console.error("[chat-widgets] failed to load project widget", existingError)
    }

    const slug = await buildUniqueWidgetSlug(supabase, `${project.slug || project.name}-chat`)
    const { data, error } = await supabase
      .from("chat_widgets")
      .insert({
        nome: `${project.name || "Projeto"} Chat`,
        slug,
        projeto_id: project.id,
        agente_id: project.agent?.id || null,
        dominio: "",
        whatsapp_celular: "",
        tema: "dark",
        cor_primaria: "#2563eb",
        fundo_transparente: true,
        identificacao_contato_ativa: false,
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .select(selectFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[chat-widgets] failed to create project default widget", error)
      }
      return { widget: null, error: "Não foi possível criar o widget padrão." }
    }

    await cleanupExtraWidgetsForProject(supabase, project.id, data.id)
    return { widget: mapChatWidget(data), error: null }
  } catch (error) {
    console.error("[chat-widgets] failed to ensure project default widget", error)
    return { widget: null, error: "Não foi possível criar o widget padrão." }
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
      return { widget: null, error: "Não foi possível atualizar o widget." }
    }

    return { widget: mapChatWidget(data), error: null }
  } catch (error) {
    console.error("[chat-widgets] failed to update widget", error)
    return { widget: null, error: "Não foi possível atualizar o widget." }
  }
}
