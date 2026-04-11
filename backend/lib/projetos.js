import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const projetoFields =
  "id, nome, tipo, descricao, status, slug, configuracoes, created_at, updated_at, is_demo"

function normalizeProject(row) {
  return {
    id: row.id,
    name: row.nome?.trim() || "Projeto sem nome",
    slug: row.slug?.trim() || row.id,
    type: row.tipo?.trim() || "Projeto",
    description: row.descricao?.trim() || "Sem descricao cadastrada.",
    status: row.status?.trim() || "ativo",
    isDemo: Boolean(row.is_demo),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

async function safeCount(supabase, table, projectId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projectId)

  if (error) {
    console.error(`[projetos] failed to count ${table}`, error)
    return 0
  }

  return count ?? 0
}

async function listProjectApis(supabase, projectId) {
  const { data, error } = await supabase
    .from("apis")
    .select("id, nome, url, metodo, ativo")
    .eq("projeto_id", projectId)
    .order("created_at", { ascending: false })
    .limit(6)

  if (error) {
    console.error("[projetos] failed to list project apis", error)
    return []
  }

  return data.map((api) => ({
    id: api.id,
    name: api.nome || "API sem nome",
    url: api.url || "",
    method: api.metodo || "GET",
    active: api.ativo !== false,
  }))
}

async function getActiveAgent(supabase, projectId) {
  const { data, error } = await supabase
    .from("agentes")
    .select("id, nome, descricao, prompt_base, ativo, slug")
    .eq("projeto_id", projectId)
    .eq("ativo", true)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[projetos] failed to get active agent", error)
    return null
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    name: data.nome || "Agente sem nome",
    description: data.descricao || "Sem descricao cadastrada.",
    prompt: data.prompt_base || "",
    active: data.ativo !== false,
    slug: data.slug || data.id,
  }
}

export async function listProjectsForUser(user) {
  if (!user) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    let query = supabase
      .from("projetos")
      .select(projetoFields)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (user.role !== "admin") {
      const projectIds = user.memberships?.map((item) => item.projetoId).filter(Boolean) ?? []

      if (projectIds.length === 0) {
        return []
      }

      query = query.in("id", projectIds)
    }

    const { data, error } = await query

    if (error) {
      console.error("[projetos] failed to list projects", error)
      return []
    }

    return data.map(normalizeProject)
  } catch (error) {
    console.error("[projetos] failed to list projects", error)
    return []
  }
}

export async function getProjectForUser(identifier, user) {
  if (!identifier || !user) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    let query = supabase.from("projetos").select(projetoFields)

    query = isUuid(identifier) ? query.eq("id", identifier) : query.eq("slug", identifier)

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error("[projetos] failed to get project", error)
      return null
    }

    if (!data || !userCanAccessProject(user, data.id)) {
      return null
    }

    const project = normalizeProject(data)
    const [agent, apis, apiCount, whatsappCount, widgetCount, fileCount] = await Promise.all([
      getActiveAgent(supabase, project.id),
      listProjectApis(supabase, project.id),
      safeCount(supabase, "apis", project.id),
      safeCount(supabase, "canais_whatsapp", project.id),
      safeCount(supabase, "chat_widgets", project.id),
      safeCount(supabase, "agente_arquivos", project.id),
    ])

    return {
      ...project,
      agent,
      apis,
      integrations: {
        apis: apiCount,
        whatsapp: whatsappCount,
        chatWidget: widgetCount,
        files: fileCount,
      },
    }
  } catch (error) {
    console.error("[projetos] failed to get project details", error)
    return null
  }
}

function mapLegacyProject(project) {
  if (!project) {
    return null
  }

  return {
    id: project.id,
    nome: project.name,
    slug: project.slug,
    tipo: project.type,
    descricao: project.description,
    status: project.status,
    isDemo: project.isDemo === true,
  }
}

export async function getProjetoById(id) {
  if (!id) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("projetos")
      .select(projetoFields)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[projetos] failed to get projeto by id", error)
      }
      return null
    }

    return mapLegacyProject(normalizeProject(data))
  } catch (error) {
    console.error("[projetos] failed to get projeto by id", error)
    return null
  }
}

export async function getProjetoBySlug(slug) {
  const value = String(slug || "").trim()
  if (!value) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("projetos")
      .select(projetoFields)
      .eq("slug", value)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[projetos] failed to get projeto by slug", error)
      }
      return null
    }

    return mapLegacyProject(normalizeProject(data))
  } catch (error) {
    console.error("[projetos] failed to get projeto by slug", error)
    return null
  }
}

export async function getProjetoByIdentifier(identifier) {
  const value = String(identifier || "").trim()
  if (!value) {
    return null
  }

  const bySlug = await getProjetoBySlug(value)
  if (bySlug) {
    return bySlug
  }

  return getProjetoById(value)
}
