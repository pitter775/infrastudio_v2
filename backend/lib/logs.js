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

function toOptionalNumber(value) {
  if (value == null || value === "") {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toOptionalBoolean(value) {
  if (typeof value === "boolean") {
    return value
  }

  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "true") {
    return true
  }

  if (normalized === "false") {
    return false
  }

  return null
}

function toOptionalArray(value) {
  return Array.isArray(value) ? value : []
}

function buildCompactLogSelect() {
  return [
    "id",
    "projeto_id",
    "tipo",
    "origem",
    "descricao",
    "created_at",
    "payload_level:payload->>level",
    "payload_event:payload->>event",
    "payload_error:payload->>error",
    "payload_app_error_code:payload->>appErrorCode",
    "payload_error_code:payload->>errorCode",
    "payload_status:payload->>status",
    "payload_tokens:payload->>tokens",
    "payload_cost:payload->>cost",
    "payload_mercado_pago_resource_id:payload->>mercadoPagoResourceId",
    "payload_intent_id:payload->>intentId",
    "payload_widget_slug:payload->>widgetSlug",
    "payload_agente:payload->>agente",
    "payload_chat_id:payload->>chatId",
    "payload_case_id:payload->>caseId",
    "payload_human_score:payload->>humanScore",
    "payload_human_notes:payload->>humanNotes",
    "payload_matched_expected_agent:payload->>matchedExpectedAgent",
    "payload_matched_expected_project:payload->>matchedExpectedProject",
    "payload_error_source:payload->>errorSource",
    "payload_elapsed_ms:payload->>elapsedMs",
    "payload_scenario_id:payload->>scenarioId",
    "payload_baseline_log_id:payload->>baselineLogId",
    "payload_billing_blocked:payload->billingState->>blocked",
    "payload_billing_available_credit_tokens:payload->billingState->>availableCreditTokens",
    "payload_observability_provider:payload->observability->>provider",
    "payload_observability_model:payload->observability->>model",
    "payload_observability_domain_stage:payload->observability->>domainStage",
    "payload_observability_heuristic_stage:payload->observability->>heuristicStage",
    "payload_observability_route_stage:payload->observability->>routeStage",
    "payload_observability_input_tokens:payload->observability->usage->>inputTokens",
    "payload_observability_output_tokens:payload->observability->usage->>outputTokens",
    "payload_observability_estimated_cost_usd:payload->observability->usage->>estimatedCostUsd",
    "payload_diagnostics_provider:payload->diagnostics->>provider",
    "payload_diagnostics_model:payload->diagnostics->>model",
    "payload_diagnostics_domain_stage:payload->diagnostics->>domainStage",
    "payload_diagnostics_heuristic_stage:payload->diagnostics->>heuristicStage",
    "payload_diagnostics_route_stage:payload->diagnostics->>routeStage",
    "payload_diagnostics_input_tokens:payload->diagnostics->>inputTokens",
    "payload_diagnostics_output_tokens:payload->diagnostics->>outputTokens",
    "payload_diagnostics_custo:payload->diagnostics->>custo",
    "payload_diff_similarity:payload->diff->>similarity",
    "payload_diff_changed:payload->diff->>changed",
    "payload_diff_added:payload->diff->added",
    "payload_diff_removed:payload->diff->removed",
  ].join(", ")
}

function buildCompactLogPayload(row) {
  const observability = {
    provider: row?.payload_observability_provider || null,
    model: row?.payload_observability_model || null,
    domainStage: row?.payload_observability_domain_stage || null,
    heuristicStage: row?.payload_observability_heuristic_stage || null,
    routeStage: row?.payload_observability_route_stage || null,
    usage: {
      inputTokens: toOptionalNumber(row?.payload_observability_input_tokens),
      outputTokens: toOptionalNumber(row?.payload_observability_output_tokens),
      estimatedCostUsd: toOptionalNumber(row?.payload_observability_estimated_cost_usd),
    },
  }
  const diagnostics = {
    provider: row?.payload_diagnostics_provider || null,
    model: row?.payload_diagnostics_model || null,
    domainStage: row?.payload_diagnostics_domain_stage || null,
    heuristicStage: row?.payload_diagnostics_heuristic_stage || null,
    routeStage: row?.payload_diagnostics_route_stage || null,
    inputTokens: toOptionalNumber(row?.payload_diagnostics_input_tokens),
    outputTokens: toOptionalNumber(row?.payload_diagnostics_output_tokens),
    custo: toOptionalNumber(row?.payload_diagnostics_custo),
  }
  const payload = {
    level: row?.payload_level || null,
    event: row?.payload_event || null,
    error: row?.payload_error || null,
    appErrorCode: row?.payload_app_error_code || null,
    errorCode: row?.payload_error_code || null,
    status: row?.payload_status || null,
    tokens: toOptionalNumber(row?.payload_tokens),
    cost: toOptionalNumber(row?.payload_cost),
    mercadoPagoResourceId: row?.payload_mercado_pago_resource_id || null,
    intentId: row?.payload_intent_id || null,
    widgetSlug: row?.payload_widget_slug || null,
    agente: row?.payload_agente || null,
    chatId: row?.payload_chat_id || null,
    caseId: row?.payload_case_id || null,
    humanScore: toOptionalNumber(row?.payload_human_score),
    humanNotes: row?.payload_human_notes || null,
    matchedExpectedAgent: toOptionalBoolean(row?.payload_matched_expected_agent),
    matchedExpectedProject: toOptionalBoolean(row?.payload_matched_expected_project),
    errorSource: row?.payload_error_source || null,
    elapsedMs: toOptionalNumber(row?.payload_elapsed_ms),
    scenarioId: row?.payload_scenario_id || null,
    baselineLogId: row?.payload_baseline_log_id || null,
    baselineReplyAvailable: Boolean(row?.payload_baseline_log_id),
    billingState: {
      blocked: toOptionalBoolean(row?.payload_billing_blocked),
      availableCreditTokens: toOptionalNumber(row?.payload_billing_available_credit_tokens),
    },
    observability,
    diagnostics,
    diff: {
      similarity: toOptionalNumber(row?.payload_diff_similarity),
      changed: toOptionalBoolean(row?.payload_diff_changed),
      added: toOptionalArray(row?.payload_diff_added),
      removed: toOptionalArray(row?.payload_diff_removed),
    },
  }

  if (!payload.billingState.blocked && payload.billingState.availableCreditTokens == null) {
    delete payload.billingState
  }

  if (
    !payload.observability.provider &&
    !payload.observability.model &&
    !payload.observability.domainStage &&
    !payload.observability.heuristicStage &&
    !payload.observability.routeStage &&
    payload.observability.usage.inputTokens == null &&
    payload.observability.usage.outputTokens == null &&
    payload.observability.usage.estimatedCostUsd == null
  ) {
    delete payload.observability
  }

  if (
    !payload.diagnostics.provider &&
    !payload.diagnostics.model &&
    !payload.diagnostics.domainStage &&
    !payload.diagnostics.heuristicStage &&
    !payload.diagnostics.routeStage &&
    payload.diagnostics.inputTokens == null &&
    payload.diagnostics.outputTokens == null &&
    payload.diagnostics.custo == null
  ) {
    delete payload.diagnostics
  }

  if (!payload.diff.changed && payload.diff.similarity == null && !payload.diff.added.length && !payload.diff.removed.length) {
    delete payload.diff
  }

  return payload
}

const SUPPRESSED_LOG_TYPES = [
  "chat_runtime_event",
  "openai_event",
  "api_runtime_event",
  "whatsapp_event",
  "whatsapp_worker_trace",
]

const SUPPRESSED_LOG_ORIGINS = ["chat_runtime", "openai", "whatsapp_worker", "whatsapp-session"]

const LOG_RETENTION_POLICIES = [
  {
    id: "lab_scenarios",
    label: "Laboratório",
    olderThanDays: 30,
    types: ["lab_chat_scenario"],
    origins: ["laboratorio"],
  },
  {
    id: "billing_info",
    label: "Billing",
    olderThanDays: 90,
    types: [
      "billing_event",
      "billing_checkout_expired",
      "billing_project_unblocked",
      "billing_plan_confirmed",
      "billing_topup_confirmed",
      "billing_whatsapp_alert",
      "billing_email_alert",
      "mercado_pago_webhook_received",
    ],
    origins: ["billing_runtime", "mercado_pago_webhook"],
  },
  {
    id: "maintenance",
    label: "Manutencao",
    olderThanDays: 15,
    types: ["logs_cleanup"],
    origins: ["laboratorio"],
  },
  {
    id: "default_info",
    label: "Info geral",
    olderThanDays: 14,
  },
]

function formatSupabaseInList(values) {
  return `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(",")})`
}

function applySuppressedLogFilters(query, filters = {}) {
  const type = String(filters.type || "").trim().toLowerCase()
  const origin = String(filters.origin || "").trim().toLowerCase()

  let nextQuery = query

  if (!type) {
    nextQuery = nextQuery.not("tipo", "in", formatSupabaseInList(SUPPRESSED_LOG_TYPES))
  }

  if (!origin) {
    nextQuery = nextQuery.not("origem", "in", formatSupabaseInList(SUPPRESSED_LOG_ORIGINS))
  }

  return nextQuery
}

function isProtectedLogPayload(payload) {
  return payload?.pinned === true || payload?.keep === true
}

function isRetainedLogLevel(level) {
  return level === "error" || level === "warn"
}

function logMatchesRetentionPolicy(row, policy) {
  const type = String(row?.tipo || "").trim().toLowerCase()
  const origin = String(row?.origem || "").trim().toLowerCase()
  const policyTypes = Array.isArray(policy?.types) ? policy.types.map((item) => String(item).trim().toLowerCase()) : []
  const policyOrigins = Array.isArray(policy?.origins) ? policy.origins.map((item) => String(item).trim().toLowerCase()) : []

  if (!policyTypes.length && !policyOrigins.length) {
    return true
  }

  return policyTypes.includes(type) || policyOrigins.includes(origin)
}

function shouldDeleteByRetentionPolicy(row, policy) {
  const payload = row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {}
  const level = normalizeLogLevel(payload.level)

  if (isRetainedLogLevel(level) || isProtectedLogPayload(payload)) {
    return false
  }

  return logMatchesRetentionPolicy(row, policy)
}

async function cleanupLogsByPolicy(policy, filters = {}, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const limit = Math.min(Math.max(Number(filters.limit ?? 500) || 500, 1), 2000)
  const olderThanDays = Math.max(1, Number(policy?.olderThanDays ?? filters.olderThanDays ?? 30) || 30)
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from("logs")
    .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit)

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
    console.error("[logs] failed to list cleanup candidates", error)
    return null
  }

  const candidates = (data ?? []).filter((row) => shouldDeleteByRetentionPolicy(row, policy))
  const ids = candidates.map((row) => row.id).filter(Boolean)
  const protectedCount = (data ?? []).filter((row) => !shouldDeleteByRetentionPolicy(row, policy) && logMatchesRetentionPolicy(row, policy)).length
  const matchedCount = (data ?? []).filter((row) => logMatchesRetentionPolicy(row, policy)).length

  if (filters.dryRun === true || !ids.length) {
    return {
      id: policy?.id || "default",
      label: policy?.label || "Sem nome",
      olderThanDays,
      cutoff,
      matched: matchedCount,
      protected: protectedCount,
      deleted: 0,
      candidateIds: ids,
    }
  }

  const { error: deleteError } = await supabase.from("logs").delete().in("id", ids)
  if (deleteError) {
    console.error("[logs] failed to cleanup logs", deleteError)
    return null
  }

  return {
    id: policy?.id || "default",
    label: policy?.label || "Sem nome",
    olderThanDays,
    cutoff,
    matched: matchedCount,
    protected: protectedCount,
    deleted: ids.length,
    candidateIds: ids,
  }
}

function shouldPersistLogEntry(input, level, payload) {
  if (payload?.forcePersist === true || payload?.keep === true || payload?.pinned === true) {
    return true
  }

  if (level === "error") {
    return true
  }

  return false
}

export function normalizeLogLevel(value) {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "warning") {
    return "warn"
  }

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
  const payload =
    row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : buildCompactLogPayload(row)
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

    const level = normalizeLogLevel(input?.level ?? input?.payload?.level)
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const payload =
      input?.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {}

    if (!shouldPersistLogEntry(input, level, payload)) {
      return null
    }

    const record = {
      projeto_id: input?.projectId ?? payload.projetoId ?? null,
      tipo: String(input?.type || "system").trim() || "system",
      origem: String(input?.origin || "system").trim() || "system",
      descricao: truncateText(input?.description || payload.error || payload.event || "Evento operacional"),
      payload: {
        ...payload,
        level,
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
    const compact = filters.compact === true

    let query = applySuppressedLogFilters(
      supabase
      .from("logs")
      .select(compact ? buildCompactLogSelect() : "id, projeto_id, tipo, origem, descricao, payload, created_at")
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(safeLimit),
      filters,
    )

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

export async function cleanupAdminLogs(filters = {}, deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const retentionMode = filters.mode === "retention"

    if (retentionMode) {
      const policies = LOG_RETENTION_POLICIES
      const runs = []

      for (const policy of policies) {
        const result = await cleanupLogsByPolicy(policy, filters, { supabase })
        if (!result) {
          return null
        }
        runs.push(result)
      }

      const summary = runs.reduce(
        (accumulator, current) => {
          accumulator.matched += current.matched
          accumulator.protected += current.protected
          accumulator.deleted += current.deleted
          accumulator.candidateIds.push(...current.candidateIds)
          return accumulator
        },
        { matched: 0, protected: 0, deleted: 0, candidateIds: [] },
      )

      if (filters.dryRun !== true && summary.deleted > 0) {
        await createLogEntry({
          type: "logs_cleanup",
          origin: "laboratorio",
          level: "info",
          description: "Limpeza automatica de logs executada por politica de retencao.",
          payload: {
            mode: "retention",
            deleted: summary.deleted,
            protected: summary.protected,
            runs: runs.map((run) => ({
              id: run.id,
              label: run.label,
              olderThanDays: run.olderThanDays,
              matched: run.matched,
              protected: run.protected,
              deleted: run.deleted,
            })),
          },
        })
      }

      return {
        dryRun: filters.dryRun === true,
        mode: "retention",
        matched: summary.matched,
        protected: summary.protected,
        deleted: summary.deleted,
        candidateIds: summary.candidateIds,
        policies: runs,
      }
    }

    const olderThanDays = Math.max(1, Number(filters.olderThanDays ?? 30) || 30)
    const limit = Math.min(Math.max(Number(filters.limit ?? 500) || 500, 1), 2000)
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from("logs")
      .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(limit)

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
      console.error("[logs] failed to list cleanup candidates", error)
      return null
    }

    const candidates = (data ?? []).filter((row) => {
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {}
      return !isProtectedLogPayload(payload)
    })
    const ids = candidates.map((row) => row.id).filter(Boolean)

    if (filters.dryRun === true || !ids.length) {
      return {
        dryRun: filters.dryRun === true,
        cutoff,
        matched: data?.length ?? 0,
        protected: (data?.length ?? 0) - ids.length,
        deleted: 0,
        candidateIds: ids,
      }
    }

    const { error: deleteError } = await supabase.from("logs").delete().in("id", ids)
    if (deleteError) {
      console.error("[logs] failed to cleanup logs", deleteError)
      return null
    }

    await createLogEntry({
      type: "logs_cleanup",
      origin: "laboratorio",
      level: "info",
      description: "Limpeza operacional de logs executada.",
      payload: {
        olderThanDays,
        cutoff,
        deleted: ids.length,
        protected: (data?.length ?? 0) - ids.length,
      },
    })

    return {
      dryRun: false,
      cutoff,
      matched: data?.length ?? 0,
      protected: (data?.length ?? 0) - ids.length,
      deleted: ids.length,
      candidateIds: ids,
    }
  } catch (error) {
    console.error("[logs] failed to cleanup logs", error)
    return null
  }
}

export async function updateAdminLogPayload(logId, updater, deps = {}) {
  try {
    if (!logId) {
      return null
    }

    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data: current, error: currentError } = await supabase
      .from("logs")
      .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
      .eq("id", logId)
      .maybeSingle()

    if (currentError || !current) {
      if (currentError) {
        console.error("[logs] failed to load log for update", currentError)
      }
      return null
    }

    const currentPayload =
      current.payload && typeof current.payload === "object" && !Array.isArray(current.payload) ? current.payload : {}
    const nextPayload =
      typeof updater === "function" ? updater(currentPayload) : updater && typeof updater === "object" ? updater : null

    if (!nextPayload || typeof nextPayload !== "object" || Array.isArray(nextPayload)) {
      return null
    }

    const normalizedPayload = {
      ...nextPayload,
      level: normalizeLogLevel(nextPayload.level ?? currentPayload.level),
    }

    const { data, error } = await supabase
      .from("logs")
      .update({
        payload: normalizedPayload,
        descricao: truncateText(current.descricao || normalizedPayload.error || normalizedPayload.event || "Evento operacional"),
      })
      .eq("id", logId)
      .select("id, projeto_id, tipo, origem, descricao, payload, created_at")
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[logs] failed to update log payload", error)
      }
      return null
    }

    const projectMap = await loadProjectsMap(supabase, [data.projeto_id])
    return mapLogRow(data, projectMap)
  } catch (error) {
    console.error("[logs] failed to update log payload", error)
    return null
  }
}
