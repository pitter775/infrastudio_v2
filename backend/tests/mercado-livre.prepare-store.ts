import fs from "node:fs"
import path from "node:path"

import { getMercadoLivreStoreByProjectId, getPublicMercadoLivreStoreBySlug } from "@/lib/mercado-livre-store"
import { syncMercadoLivreSnapshotForProject, getMercadoLivreSnapshotStatus } from "@/lib/mercado-livre-store-sync"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

type ProjectRow = {
  id: string
  nome: string | null
  slug: string | null
}

type AgentRow = {
  id: string
  nome: string | null
  slug: string | null
  ativo: boolean | null
}

type WidgetRow = {
  id: string
  nome: string | null
  slug: string | null
  agente_id: string | null
  ativo: boolean | null
}

function loadLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) {
    return
  }

  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) {
      continue
    }

    let value = trimmed.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function parseArg(name: string, fallback = "") {
  const flag = `--${name}`
  const index = process.argv.findIndex((item) => item === flag)
  if (index === -1) {
    return fallback
  }

  return String(process.argv[index + 1] || "").trim() || fallback
}

function parseIntArg(name: string, fallback: number) {
  const value = Number(parseArg(name, String(fallback)))
  return Number.isFinite(value) ? value : fallback
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function normalizeLookup(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

async function buildUniqueWidgetSlug(supabase: ReturnType<typeof getSupabaseAdminClient>, value: string, currentId: string | null = null) {
  const baseSlug = slugify(value) || "chat"
  let nextSlug = baseSlug
  let index = 2

  while (true) {
    let query = supabase.from("chat_widgets").select("id").eq("slug", nextSlug).limit(1)
    if (currentId) {
      query = query.neq("id", currentId)
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Falha ao validar slug do widget: ${error.message}`)
    }

    if (!data?.length) {
      return nextSlug
    }

    nextSlug = `${baseSlug}-${index}`
    index += 1
  }
}

async function findProjectByQuery(supabase: ReturnType<typeof getSupabaseAdminClient>, query: string) {
  const normalized = query.trim()
  const normalizedLookup = normalizeLookup(query)
  if (!normalized) {
    throw new Error("Informe um nome ou slug para localizar a loja de teste.")
  }

  const storeLookup = await supabase
    .from("mercadolivre_lojas")
    .select("projeto_id, nome, slug, updated_at")
    .or(`nome.ilike.%${normalized}%,slug.ilike.%${normalized}%`)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(5)

  if (storeLookup.error) {
    throw new Error(`Falha ao localizar loja: ${storeLookup.error.message}`)
  }

  const storeProjects = Array.isArray(storeLookup.data)
    ? storeLookup.data.map((item) => item.projeto_id).filter(Boolean)
    : []

  if (storeProjects.length) {
    const { data: projectsByStore, error: projectsByStoreError } = await supabase
      .from("projetos")
      .select("id, nome, slug")
      .in("id", storeProjects)
      .limit(5)

    if (projectsByStoreError) {
      throw new Error(`Falha ao carregar projeto da loja: ${projectsByStoreError.message}`)
    }

    const projects = Array.isArray(projectsByStore) ? (projectsByStore as ProjectRow[]) : []
    if (projects.length) {
      return projects[0]
    }
  }

  if (normalizedLookup) {
    const { data: fallbackStores, error: fallbackStoresError } = await supabase
      .from("mercadolivre_lojas")
      .select("projeto_id, nome, slug, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(200)

    if (fallbackStoresError) {
      throw new Error(`Falha ao localizar loja por busca ampla: ${fallbackStoresError.message}`)
    }

    const matchedStoreProjectIds = (Array.isArray(fallbackStores) ? fallbackStores : [])
      .filter((item) => {
        const haystack = normalizeLookup(`${item.nome || ""} ${item.slug || ""}`)
        return haystack.includes(normalizedLookup)
      })
      .map((item) => item.projeto_id)
      .filter(Boolean)

    if (matchedStoreProjectIds.length) {
      const { data: matchedProjects, error: matchedProjectsError } = await supabase
        .from("projetos")
        .select("id, nome, slug")
        .in("id", matchedStoreProjectIds)
        .limit(5)

      if (matchedProjectsError) {
        throw new Error(`Falha ao carregar projeto por busca ampla da loja: ${matchedProjectsError.message}`)
      }

      const projects = Array.isArray(matchedProjects) ? (matchedProjects as ProjectRow[]) : []
      if (projects.length) {
        return projects[0]
      }
    }
  }

  const { data, error } = await supabase
    .from("projetos")
    .select("id, nome, slug")
    .or(`nome.ilike.%${normalized}%,slug.ilike.%${normalized}%`)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(5)

  if (error) {
    throw new Error(`Falha ao localizar projeto: ${error.message}`)
  }

  const projects = Array.isArray(data) ? (data as ProjectRow[]) : []
  if (!projects.length) {
    const { data: fallbackProjects, error: fallbackProjectsError } = await supabase
      .from("projetos")
      .select("id, nome, slug")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(200)

    if (fallbackProjectsError) {
      throw new Error(`Falha ao localizar projeto por busca ampla: ${fallbackProjectsError.message}`)
    }

    const matchedProject = (Array.isArray(fallbackProjects) ? (fallbackProjects as ProjectRow[]) : []).find((item) => {
      const haystack = normalizeLookup(`${item.nome || ""} ${item.slug || ""}`)
      return haystack.includes(normalizedLookup)
    })

    if (matchedProject) {
      return matchedProject
    }

    throw new Error(`Nenhum projeto encontrado para "${normalized}".`)
  }

  return projects[0]
}

async function getActiveAgent(supabase: ReturnType<typeof getSupabaseAdminClient>, projectId: string) {
  const { data, error } = await supabase
    .from("agentes")
    .select("id, nome, slug, ativo")
    .eq("projeto_id", projectId)
    .order("updated_at", { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Falha ao carregar agente: ${error.message}`)
  }

  const agents = Array.isArray(data) ? (data as AgentRow[]) : []
  return agents.find((item) => item.ativo !== false) || agents[0] || null
}

async function getOrCreateWidgetForProject(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  project: ProjectRow,
  agent: AgentRow | null,
) {
  const { data, error } = await supabase
    .from("chat_widgets")
    .select("id, nome, slug, agente_id, ativo")
    .eq("projeto_id", project.id)
    .order("updated_at", { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Falha ao carregar widget: ${error.message}`)
  }

  const widgets = Array.isArray(data) ? (data as WidgetRow[]) : []
  const preferred =
    widgets.find((item) => item.ativo !== false && agent?.id && item.agente_id === agent.id) ||
    widgets.find((item) => item.ativo !== false) ||
    widgets[0] ||
    null

  if (preferred) {
    const normalizedSlug = preferred.slug?.trim() || (await buildUniqueWidgetSlug(supabase, `${project.slug || project.nome || project.id}-chat`, preferred.id))
    const needsUpdate = preferred.ativo === false || !preferred.slug?.trim()

    if (needsUpdate) {
      const { data: updated, error: updateError } = await supabase
        .from("chat_widgets")
        .update({
          slug: normalizedSlug,
          ativo: true,
          agente_id: preferred.agente_id || agent?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", preferred.id)
        .select("id, nome, slug, agente_id, ativo")
        .maybeSingle()

      if (updateError || !updated) {
        throw new Error(`Falha ao normalizar widget: ${updateError?.message || "sem retorno"}`)
      }

      return updated as WidgetRow
    }

    return preferred
  }

  const slug = await buildUniqueWidgetSlug(supabase, `${project.slug || project.nome || project.id}-chat`)
  const { data: created, error: createError } = await supabase
    .from("chat_widgets")
    .insert({
      nome: `${project.nome || "Projeto"} Chat`,
      slug,
      projeto_id: project.id,
      agente_id: agent?.id || null,
      dominio: "",
      whatsapp_celular: "",
      tema: "dark",
      cor_primaria: "#2563eb",
      fundo_transparente: true,
      ativo: true,
      updated_at: new Date().toISOString(),
    })
    .select("id, nome, slug, agente_id, ativo")
    .maybeSingle()

  if (createError || !created) {
    throw new Error(`Falha ao criar widget padrao: ${createError?.message || "sem retorno"}`)
  }

  return created as WidgetRow
}

async function ensureStorePrepared(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  project: ProjectRow,
  widget: WidgetRow,
) {
  const currentStore = await getMercadoLivreStoreByProjectId(project.id, { supabase })
  if (!currentStore?.id) {
    throw new Error("A loja do Mercado Livre nao existe para este projeto.")
  }

  const fallbackSlug = `${slugify(project.slug || project.nome || "loja")}-ml`
  const nextSlug = String(currentStore.slug || "").trim() || fallbackSlug
  const needsUpdate =
    currentStore.ativo !== true ||
    currentStore.chat_widget_ativo !== true ||
    currentStore.chat_widget_id !== widget.id ||
    !String(currentStore.slug || "").trim()

  if (!needsUpdate) {
    return currentStore
  }

  const { data: updatedStore, error: updateError } = await supabase
    .from("mercadolivre_lojas")
    .update({
      slug: nextSlug,
      ativo: true,
      chat_widget_ativo: true,
      chat_widget_id: widget.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentStore.id)
    .select("*")
    .maybeSingle()

  if (updateError || !updatedStore) {
    throw new Error(`Falha ao preparar loja: ${updateError?.message || "sem retorno"}`)
  }

  return updatedStore
}

async function syncSnapshotPages(project: ProjectRow, pages: number, limit: number) {
  let synced = 0
  let lastError = ""

  for (let page = 0; page < pages; page += 1) {
    const offset = page * limit
    const result = await syncMercadoLivreSnapshotForProject(
      {
        id: project.id,
        slug: project.slug,
        name: project.nome,
      },
      { limit, offset },
    )

    if (result.error) {
      lastError = result.error
      break
    }

    synced += Number(result.synced || 0)

    if (!result.paging?.hasMore) {
      break
    }
  }

  return { synced, lastError }
}

async function main() {
  loadLocalEnvFile()
  const supabase = getSupabaseAdminClient()
  const query = parseArg("query", "Reliquia de familia")
  const syncPages = Math.max(parseIntArg("sync-pages", 3), 1)
  const syncLimit = Math.min(Math.max(parseIntArg("sync-limit", 20), 1), 20)

  const project = await findProjectByQuery(supabase, query)
  const agent = await getActiveAgent(supabase, project.id)
  const widget = await getOrCreateWidgetForProject(supabase, project, agent)
  const storeRow = await ensureStorePrepared(supabase, project, widget)
  const syncResult = await syncSnapshotPages(project, syncPages, syncLimit)
  const snapshot = await getMercadoLivreSnapshotStatus(project.id, { supabase })
  const publicStore = await getPublicMercadoLivreStoreBySlug(String(storeRow.slug || "").trim(), { supabase })

  const output = {
    query,
    project: {
      id: project.id,
      nome: project.nome,
      slug: project.slug,
    },
    agent: agent
      ? {
          id: agent.id,
          nome: agent.nome,
          slug: agent.slug,
        }
      : null,
    widget: {
      id: widget.id,
      nome: widget.nome,
      slug: widget.slug,
    },
    store: {
      id: storeRow.id,
      nome: storeRow.nome,
      slug: storeRow.slug,
      chatWidgetId: storeRow.chat_widget_id,
      chatWidgetActive: storeRow.chat_widget_ativo,
      active: storeRow.ativo,
    },
    snapshot: {
      total: snapshot.total,
      lastSyncAt: snapshot.lastSyncAt,
      syncedNow: syncResult.synced,
      syncError: syncResult.lastError || null,
    },
    publicCheck: {
      ok: Boolean(publicStore?.store?.slug && publicStore?.store?.widget?.slug),
      storeSlug: publicStore?.store?.slug || null,
      widgetSlug: publicStore?.store?.widget?.slug || null,
      error: publicStore?.error || null,
      diagnostic: publicStore?.diagnostic || null,
    },
    urls: {
      storefront: storeRow.slug ? `https://www.infrastudio.pro/loja/${storeRow.slug}` : null,
      productExample:
        storeRow.slug && Array.isArray(publicStore?.products) && publicStore.products[0]?.slug
          ? `https://www.infrastudio.pro/loja/${storeRow.slug}/produto/${publicStore.products[0].slug}`
          : null,
      widgetContract:
        widget.slug && project.slug && (agent?.slug || agent?.id)
          ? `https://www.infrastudio.pro/widget-contract-test?projeto=${encodeURIComponent(project.slug)}&agente=${encodeURIComponent(agent?.slug || agent?.id || "")}&widget=${encodeURIComponent(widget.slug || "")}`
          : null,
    },
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
