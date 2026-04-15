import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function hasUsableSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  return Boolean(url && /^https?:\/\//i.test(url) && key)
}

function truncateText(value, max = 240) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  if (!normalized) {
    return ""
  }

  return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized
}

export function normalizeLogLevel(value) {
  const normalized = String(value || "").trim().toLowerCase()
  if (["error", "warn", "info"].includes(normalized)) {
    return normalized
  }

  return "info"
}

export function buildLogSearchText(entry) {
  const payload = entry?.payload && typeof entry.payload === "object" ? entry.payload : {}

  return [
    entry?.type,
    entry?.origin,
    entry?.description,
    entry?.projectName,
    entry?.projectSlug,
    entry?.level,
    payload.event,
    payload.error,
    payload.appErrorCode,
    payload.errorCode,
    payload.widgetSlug,
    payload.projeto,
    payload.agente,
    payload.agenteId,
    payload.chatId,
    payload.channelKind,
    payload.canal,
    payload.sourceHint,
    payload.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

export function isNoisyOperationalLog(entry) {
  const level = normalizeLogLevel(entry?.level ?? entry?.payload?.level)
  if (level === "error") {
    return false
  }

  const haystack = buildLogSearchText(entry)

  return (
    haystack.includes("qr code gerado") ||
    haystack.includes("aguardando leitura") ||
    (haystack.includes("qr code") && haystack.includes("whatsapp"))
  )
}

export function mapLogRow(row, projectMap = new Map()) {
  const payload = row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {}
  const project = projectMap.get(row?.projeto_id) ?? null
  const level = normalizeLogLevel(payload.level)

  return {
    id: row?.id ?? "",
    projectId: row?.projeto_id ?? null,
    projectName: project?.name ?? (typeof payload.projeto === "string" ? payload.projeto : null),
    projectSlug: project?.slug ?? null,
    type: row?.tipo?.trim() || "system",
    origin: row?.origem?.trim() || "system",
    level,
    description:
      truncateText(row?.descricao) ||
      truncateText(payload.error) ||
      truncateText(payload.event) ||
      "Evento operacional",
    createdAt: row?.created_at ?? null,
    payload,
  }
}

export function filterAdminLogs(logs, filters = {}) {
  const projectId = String(filters.projectId || "").trim()
  const type = String(filters.type || "").trim().toLowerCase()
  const origin = String(filters.origin || "").trim().toLowerCase()
  const level = String(filters.level || "").trim().toLowerCase()
  const search = String(filters.search || "").trim().toLowerCase()

  return (Array.isArray(logs) ? logs : []).filter((entry) => {
    if (isNoisyOperationalLog(entry)) {
      return false
    }

    if (projectId) {
      const payloadProjectId = entry?.payload?.projetoId
      const payloadProject = entry?.payload?.projeto
      const matchesProject =
        entry.projectId === projectId || payloadProjectId === projectId || payloadProject === projectId

      if (!matchesProject) {
        return false
      }
    }

    if (type && String(entry.type || "").toLowerCase() !== type) {
      return false
    }

    if (origin && String(entry.origin || "").toLowerCase() !== origin) {
      return false
    }

    if (level && String(entry.level || "").toLowerCase() !== level) {
      return false
    }

    if (search) {
      const haystack = buildLogSearchText(entry)
      if (!haystack.includes(search)) {
        return false
      }
    }

    return true
  })
}

async function loadProjectsMap(supabase, projectIds) {
  const ids = [...new Set((Array.isArray(projectIds) ? projectIds : []).filter(Boolean))]
  if (!ids.length) {
    return new Map()
  }

  const { data, error } = await supabase.from("projetos").select("id, nome, slug").in("id", ids)

  if (error) {
    console.error("[logs] failed to load related projects", error)
    return new Map()
  }

  return new Map(
    (data ?? []).map((project) => [
      project.id,
      {
        id: project.id,
        name: project.nome?.trim() || "Projeto",
        slug: project.slug?.trim() || project.id,
      },
    ]),
  )
}

export async function createLogEntry(input, deps = {}) {
  try {
    if (!deps.supabase && !hasUsableSupabaseEnv()) {
      return null
    }

    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const payload =
      input?.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {}
    const record = {
      projeto_id: input?.projectId ?? payload.projetoId ?? null,
      tipo: String(input?.type || "system").trim() || "system",
      origem: String(input?.origin || "system").trim() || "system",
      descricao: truncateText(input?.description || payload.error || payload.event || "Evento operacional"),
      payload: {
        ...payload,
        level: normalizeLogLevel(input?.level ?? payload.level),
      },
    }

    const { data, error } = await supabase
      .from("logs")
      .insert(record)
      .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
      .maybeSingle()

    if (error) {
      console.error("[logs] failed to create log entry", error)
      return null
    }

    return mapLogRow(data)
  } catch (error) {
    console.error("[logs] failed to bootstrap log entry", error)
    return null
  }
}

export async function listAdminLogs(filters = {}, deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const safeLimit = Math.min(Math.max(Number(filters.limit ?? 100) || 100, 1), 200)

    let query = supabase
      .from("logs")
      .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(safeLimit)

    if (filters.projectId) {
      query = query.eq("projeto_id", filters.projectId)
    }

    if (filters.type) {
      query = query.eq("tipo", filters.type)
    }

    if (filters.origin) {
      query = query.eq("origem", filters.origin)
    }

    const { data, error } = await query

    if (error) {
      console.error("[logs] failed to list logs", error)
      return []
    }

    const projectMap = await loadProjectsMap(
      supabase,
      (data ?? []).map((row) => row.projeto_id),
    )
    const mapped = (data ?? []).map((row) => mapLogRow(row, projectMap))

    return filterAdminLogs(mapped, filters)
  } catch (error) {
    console.error("[logs] failed to list logs", error)
    return []
  }
}

export async function deleteAdminLogs(filters = {}, deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const hasClientOnlyFilter = Boolean(filters.level || filters.search)
    const hasColumnFilter = Boolean(filters.projectId || filters.type || filters.origin)

    if (hasClientOnlyFilter) {
      const logs = await listAdminLogs({ ...filters, limit: 1000 }, { supabase })
      const ids = logs.map((entry) => entry.id).filter(Boolean)

      if (!ids.length) {
        return 0
      }

      const { error } = await supabase.from("logs").delete().in("id", ids)

      if (error) {
        console.error("[logs] failed to delete filtered logs", error)
        return null
      }

      return ids.length
    }

    let query = supabase.from("logs").delete()

    if (filters.projectId) {
      query = query.eq("projeto_id", filters.projectId)
    }

    if (filters.type) {
      query = query.eq("tipo", filters.type)
    }

    if (filters.origin) {
      query = query.eq("origem", filters.origin)
    }

    if (!hasColumnFilter) {
      query = query.not("id", "is", null)
    }

    const { count, error } = await query.select("id", { count: "exact", head: true })

    if (error) {
      console.error("[logs] failed to delete logs", error)
      return null
    }

    return count ?? 0
  } catch (error) {
    console.error("[logs] failed to delete logs", error)
    return null
  }
}
