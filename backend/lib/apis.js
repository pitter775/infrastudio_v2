import "server-only"

import { validateJsonObjectConfig } from "@/lib/json-validation"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const apiFields =
  "id, projeto_id, nome, url, metodo, descricao, ativo, configuracoes, created_at, updated_at"
const apiRuntimeFieldSchema = "id, nome, tipo, descricao"
const apiVersionFields =
  "id, api_id, projeto_id, version_number, nome, url, metodo, descricao, configuracoes, ativo, source, note, created_by, created_at"
const runtimeApiCache = new Map()

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function mapApi(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    name: row.nome || "API sem nome",
    url: row.url || "",
    method: row.metodo || "GET",
    description: row.descricao || "",
    active: row.ativo !== false,
    config: row.configuracoes ?? {},
    fieldSchema: Array.isArray(row.api_campos)
      ? row.api_campos.map((field) => ({
          id: field.id,
          nome: field.nome,
          tipo: field.tipo,
          descricao: field.descricao || "",
        }))
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: Array.isArray(row.versions) ? row.versions : [],
  }
}

function mapApiVersion(row) {
  return {
    id: row.id,
    apiId: row.api_id,
    projetoId: row.projeto_id,
    versionNumber: row.version_number,
    name: row.nome || "API sem nome",
    url: row.url || "",
    method: row.metodo || "GET",
    description: row.descricao || "",
    config: row.configuracoes ?? {},
    active: row.ativo !== false,
    source: row.source || "manual_update",
    note: row.note || "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

function isMissingApiVersionTableError(error) {
  const message = String(error?.message || error || "")
  return error?.code === "42P01" || error?.code === "PGRST205" || /api_versoes/i.test(message)
}

function isApiVersionAccessError(error) {
  return error?.code === "42501"
}

function normalizeHeaderConfig(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return {}
  }

  return Object.entries(headers).reduce((acc, [key, value]) => {
    const normalizedKey = String(key || "").trim()
    const normalizedValue = typeof value === "string" ? value.trim() : String(value ?? "").trim()

    if (normalizedKey && normalizedValue) {
      acc[normalizedKey] = normalizedValue
    }

    return acc
  }, {})
}

function getApiRequestHeaders(api) {
  const configuredHeaders = normalizeHeaderConfig(api?.config?.http?.headers)
  return {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    ...configuredHeaders,
  }
}

function tryParseApiPayload(contentType, text) {
  const normalizedType = String(contentType || "").toLowerCase()
  const body = String(text || "")

  if (!body.trim()) {
    return null
  }

  if (normalizedType.includes("json")) {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }

  return null
}

function readPathValue(payload, path) {
  if (!path) {
    return payload
  }

  const segments = String(path)
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

  let current = payload
  for (const segment of segments) {
    if (current == null) {
      return undefined
    }

    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)]
      continue
    }

    if (typeof current !== "object") {
      return undefined
    }

    current = current[segment]
  }

  return current
}

function normalizeFieldValue(value) {
  if (value == null) {
    return ""
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractConfiguredRuntimeFields(api, payload) {
  const runtimeConfig = api?.config?.runtime
  const responseRoot = runtimeConfig?.responsePath ? readPathValue(payload, runtimeConfig.responsePath) : payload
  const configuredFields = Array.isArray(runtimeConfig?.fields) ? runtimeConfig.fields : []
  const schemaFields = Array.isArray(api?.fieldSchema) ? api.fieldSchema : []
  const fieldDefinitions = configuredFields.length
    ? configuredFields
    : schemaFields.map((field) => ({
        nome: field.nome,
        tipo: field.tipo,
        descricao: field.descricao,
        path: field.nome,
      }))

  return fieldDefinitions
    .map((field) => {
      const path = field?.path || field?.nome
      const value = readPathValue(responseRoot, path)

      if (value == null || value === "") {
        return null
      }

      return {
        nome: String(field.nome || path || "campo").trim(),
        tipo: String(field.tipo || "string").trim() || "string",
        descricao: String(field.descricao || "").trim(),
        valor: normalizeFieldValue(value),
      }
    })
    .filter(Boolean)
}

function buildApiPreviewContent(api, payload, rawText) {
  const runtimeConfig = api?.config?.runtime
  const responseRoot = runtimeConfig?.responsePath ? readPathValue(payload, runtimeConfig.responsePath) : payload
  const previewPath = runtimeConfig?.previewPath ? readPathValue(responseRoot, runtimeConfig.previewPath) : responseRoot
  const previewSource = previewPath == null ? payload ?? rawText : previewPath
  const previewText = normalizeFieldValue(previewSource)

  return String(previewText || rawText || "").slice(0, 1200)
}

function hasValidSupabaseRuntimeEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!rawUrl || !key) {
    return false
  }

  try {
    const url = new URL(rawUrl)
    return ["http:", "https:"].includes(url.protocol)
  } catch {
    return false
  }
}

function normalizeApiInput(input) {
  const name = String(input.nome || input.name || "").trim()
  const rawUrl = String(input.url || "").trim()
  const method = String(input.metodo || input.method || "GET").trim().toUpperCase()

  if (!name || !rawUrl) {
    return { error: "Nome e URL sao obrigatorios." }
  }

  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: "URL invalida." }
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "URL precisa usar http ou https." }
  }

  if (method !== "GET") {
    return { error: "O schema atual permite apenas metodo GET." }
  }

  const config = input.configuracoes ?? input.config ?? {}
  const configValidation = validateJsonObjectConfig(config, "configuracoes")
  if (!configValidation.ok) {
    return { error: configValidation.error }
  }

  return {
    payload: {
      nome: name,
      url: url.toString(),
      metodo: method,
      descricao: String(input.descricao || input.description || "").trim(),
      ativo: input.ativo === false || input.active === false ? false : true,
      configuracoes: configValidation.value ?? {},
      updated_at: new Date().toISOString(),
    },
  }
}

async function getNextApiVersionNumber(supabase, apiId) {
  const { data, error } = await supabase
    .from("api_versoes")
    .select("version_number")
    .eq("api_id", apiId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Number(data?.version_number ?? 0) + 1
}

async function createApiVersionSnapshot(supabase, apiRow, input = {}) {
  if (!apiRow?.id || !apiRow?.projeto_id) {
    return null
  }

  const versionNumber = await getNextApiVersionNumber(supabase, apiRow.id)
  const { data, error } = await supabase
    .from("api_versoes")
    .insert({
      api_id: apiRow.id,
      projeto_id: apiRow.projeto_id,
      version_number: versionNumber,
      nome: apiRow.nome ?? null,
      url: apiRow.url ?? null,
      metodo: apiRow.metodo ?? "GET",
      descricao: apiRow.descricao ?? null,
      configuracoes: apiRow.configuracoes ?? {},
      ativo: apiRow.ativo !== false,
      source: input.source || "manual_update",
      note: input.note || null,
      created_by: input.userId ?? null,
    })
    .select(apiVersionFields)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapApiVersion(data) : null
}

export async function listApiVersionsForUser({ apiId, projetoId, limit = 8 }, user) {
  if (!apiId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("api_versoes")
      .select(apiVersionFields)
      .eq("api_id", apiId)
      .eq("projeto_id", projetoId)
      .order("version_number", { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 8, 1), 50))

    if (error) {
      if (isMissingApiVersionTableError(error) || isApiVersionAccessError(error)) {
        return []
      }
      console.error("[apis] failed to list api versions", error)
      return []
    }

    return (data ?? []).map(mapApiVersion)
  } catch (error) {
    console.error("[apis] failed to list api versions", error)
    return []
  }
}

export async function listApisForUser(projetoId, user) {
  if (!projetoId || !userCanAccessProject(user, projetoId)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("apis")
      .select(apiFields)
      .eq("projeto_id", projetoId)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("[apis] failed to list project apis", error)
      return []
    }

    const apis = data.map(mapApi)
    const versionsByApi = await Promise.all(
      apis.map(async (api) => [api.id, await listApiVersionsForUser({ apiId: api.id, projetoId, limit: 6 }, user)]),
    )
    const versionsMap = new Map(versionsByApi)

    return apis.map((api) => ({
      ...api,
      versions: versionsMap.get(api.id) ?? [],
    }))
  } catch (error) {
    console.error("[apis] failed to list project apis", error)
    return []
  }
}

export async function listAgentApiIdsForUser(agenteId, projetoId, user) {
  if (!agenteId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agente_api")
      .select("api_id, apis!inner(projeto_id)")
      .eq("agente_id", agenteId)
      .eq("apis.projeto_id", projetoId)

    if (error) {
      console.error("[apis] failed to list agent api links", error)
      return []
    }

    return data.map((item) => item.api_id).filter(Boolean)
  } catch (error) {
    console.error("[apis] failed to list agent api links", error)
    return []
  }
}

export async function replaceAgentApiLinksForUser({ agenteId, projetoId, apiIds }, user) {
  if (!agenteId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return { apiIds: [], error: "Acesso negado." }
  }

  const nextApiIds = Array.from(
    new Set((Array.isArray(apiIds) ? apiIds : []).filter((value) => typeof value === "string" && value.trim())),
  )

  try {
    const supabase = getSupabaseAdminClient()
    const { data: agent, error: agentError } = await supabase
      .from("agentes")
      .select("id")
      .eq("id", agenteId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (agentError || !agent) {
      return { apiIds: [], error: "Agente nao encontrado." }
    }

    if (nextApiIds.length) {
      const { data: projectApis, error: apiError } = await supabase
        .from("apis")
        .select("id")
        .eq("projeto_id", projetoId)
        .in("id", nextApiIds)

      if (apiError) {
        console.error("[apis] failed to validate api links", apiError)
        return { apiIds: [], error: "Nao foi possivel validar as APIs." }
      }

      if ((projectApis ?? []).length !== nextApiIds.length) {
        return { apiIds: [], error: "Uma ou mais APIs nao pertencem ao projeto." }
      }
    }

    const { error: deleteError } = await supabase.from("agente_api").delete().eq("agente_id", agenteId)

    if (deleteError) {
      console.error("[apis] failed to clear agent api links", deleteError)
      return { apiIds: [], error: "Nao foi possivel atualizar os vinculos." }
    }

    if (nextApiIds.length) {
      const { error: insertError } = await supabase
        .from("agente_api")
        .insert(nextApiIds.map((apiId) => ({ agente_id: agenteId, api_id: apiId })))

      if (insertError) {
        console.error("[apis] failed to insert agent api links", insertError)
        return { apiIds: [], error: "Nao foi possivel salvar os vinculos." }
      }
    }

    return { apiIds: nextApiIds, error: null }
  } catch (error) {
    console.error("[apis] failed to replace agent api links", error)
    return { apiIds: [], error: "Nao foi possivel salvar os vinculos." }
  }
}

export async function createApiForUser(projetoId, input, user) {
  if (!projetoId || !userCanAccessProject(user, projetoId)) {
    return { api: null, error: "Acesso negado." }
  }

  const normalized = normalizeApiInput(input)
  if (normalized.error) {
    return { api: null, error: normalized.error }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("apis")
      .insert({ ...normalized.payload, projeto_id: projetoId })
      .select(apiFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[apis] failed to create api", error)
      }
      return { api: null, error: "Nao foi possivel criar a API." }
    }

    return { api: mapApi(data), error: null }
  } catch (error) {
    console.error("[apis] failed to create api", error)
    return { api: null, error: "Nao foi possivel criar a API." }
  }
}

export async function updateApiForUser(apiId, projetoId, input, user) {
  if (!apiId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return { api: null, error: "Acesso negado." }
  }

  const normalized = normalizeApiInput(input)
  if (normalized.error) {
    return { api: null, error: normalized.error }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: currentApi, error: currentApiError } = await supabase
      .from("apis")
      .select(apiFields)
      .eq("id", apiId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (currentApiError || !currentApi) {
      if (currentApiError) {
        console.error("[apis] failed to read api before update", currentApiError)
      }
      return { api: null, error: "API nao encontrada." }
    }

    try {
      await createApiVersionSnapshot(supabase, currentApi, {
        source: "manual_update",
        note: "Snapshot antes de salvar alteracoes da API.",
        userId: user?.id ?? null,
      })
    } catch (versionError) {
      if (isMissingApiVersionTableError(versionError)) {
        console.warn("[apis] api versioning table not available; update will continue")
      } else if (isApiVersionAccessError(versionError)) {
        console.warn("[apis] api versioning table access denied; update will continue")
      } else {
        console.error("[apis] failed to create api version", versionError)
        return { api: null, error: "Nao foi possivel versionar a API." }
      }
    }

    const { data, error } = await supabase
      .from("apis")
      .update(normalized.payload)
      .eq("id", apiId)
      .eq("projeto_id", projetoId)
      .select(apiFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[apis] failed to update api", error)
      }
      return { api: null, error: "Nao foi possivel atualizar a API." }
    }

    return {
      api: {
        ...mapApi(data),
        versions: await listApiVersionsForUser({ apiId, projetoId, limit: 6 }, user),
      },
      error: null,
    }
  } catch (error) {
    console.error("[apis] failed to update api", error)
    return { api: null, error: "Nao foi possivel atualizar a API." }
  }
}

export async function deleteApiForUser(apiId, projetoId, user) {
  if (!apiId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return { ok: false, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: api, error: apiError } = await supabase
      .from("apis")
      .select("id")
      .eq("id", apiId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (apiError || !api) {
      return { ok: false, error: "API nao encontrada." }
    }

    await supabase.from("agente_api").delete().eq("api_id", apiId)
    await supabase.from("api_campos").delete().eq("api_id", apiId)
    await supabase.from("api_versoes").delete().eq("api_id", apiId)

    const { error } = await supabase.from("apis").delete().eq("id", apiId).eq("projeto_id", projetoId)

    if (error) {
      console.error("[apis] failed to delete api", error)
      return { ok: false, error: "Nao foi possivel deletar a API." }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error("[apis] failed to delete api", error)
    return { ok: false, error: "Nao foi possivel deletar a API." }
  }
}

export async function restoreApiVersionForUser({ apiId, projetoId, versionId }, user) {
  if (!apiId || !projetoId || !versionId || !userCanAccessProject(user, projetoId)) {
    return { api: null, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const [{ data: currentApi, error: currentApiError }, { data: version, error: versionError }] = await Promise.all([
      supabase.from("apis").select(apiFields).eq("id", apiId).eq("projeto_id", projetoId).maybeSingle(),
      supabase
        .from("api_versoes")
        .select(apiVersionFields)
        .eq("id", versionId)
        .eq("api_id", apiId)
        .eq("projeto_id", projetoId)
        .maybeSingle(),
    ])

    if (currentApiError || versionError || !currentApi || !version) {
      if (currentApiError) console.error("[apis] failed to read api before restore", currentApiError)
      if (versionError) console.error("[apis] failed to read api version", versionError)
      return { api: null, error: "Versao de API nao encontrada." }
    }

    try {
      await createApiVersionSnapshot(supabase, currentApi, {
        source: "rollback",
        note: `Snapshot antes de restaurar versao ${version.version_number}.`,
        userId: user?.id ?? null,
      })
    } catch (snapshotError) {
      console.error("[apis] failed to create rollback snapshot", snapshotError)
      return { api: null, error: "Nao foi possivel criar snapshot antes do rollback." }
    }

    const { data, error } = await supabase
      .from("apis")
      .update({
        nome: version.nome,
        url: version.url,
        metodo: version.metodo || "GET",
        descricao: version.descricao,
        configuracoes: version.configuracoes ?? {},
        ativo: version.ativo !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", apiId)
      .eq("projeto_id", projetoId)
      .select(apiFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[apis] failed to restore api version", error)
      }
      return { api: null, error: "Nao foi possivel restaurar a API." }
    }

    return {
      api: {
        ...mapApi(data),
        versions: await listApiVersionsForUser({ apiId, projetoId, limit: 6 }, user),
      },
      error: null,
    }
  } catch (error) {
    console.error("[apis] failed to restore api version", error)
    return { api: null, error: "Nao foi possivel restaurar a API." }
  }
}

export async function testApiForUser(apiId, projetoId, user) {
  if (!apiId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return { result: null, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("apis")
      .select(apiFields)
      .eq("id", apiId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[apis] failed to get api for test", error)
      }
      return { result: null, error: "API nao encontrada." }
    }

    const api = mapApi(data)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const startedAt = Date.now()

    try {
      const response = await fetch(api.url, {
        method: "GET",
        signal: controller.signal,
        headers: getApiRequestHeaders(api),
      })
      const contentType = response.headers.get("content-type") || ""
      const text = await response.text()
      const payload = tryParseApiPayload(contentType, text)
      const fields = extractConfiguredRuntimeFields(api, payload)

      return {
        result: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          durationMs: Date.now() - startedAt,
          contentType,
          preview: text.slice(0, 800),
          fields,
        },
        error: null,
      }
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    return {
      result: {
        ok: false,
        status: 0,
        statusText: error.name === "AbortError" ? "Timeout" : "Erro de conexao",
        durationMs: null,
        contentType: "",
        preview: error.message,
      },
      error: null,
    }
  }
}

async function fetchApiPreview(api, timeoutMs = 5000) {
  const cacheTtlSeconds = Number(api?.config?.runtime?.cacheTtlSeconds ?? 0)
  const safeTtlMs = Number.isFinite(cacheTtlSeconds) ? Math.min(Math.max(cacheTtlSeconds, 0), 3600) * 1000 : 0
  const cacheKey = [
    api.id,
    api.updatedAt,
    api.url,
    JSON.stringify(api.config?.runtime ?? {}),
  ].join(":")

  if (safeTtlMs > 0) {
    const cached = runtimeApiCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.value,
        cache: {
          hit: true,
          ttlSeconds: cacheTtlSeconds,
        },
      }
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(api.url, {
      method: "GET",
      signal: controller.signal,
      headers: getApiRequestHeaders(api),
    })
    const contentType = response.headers.get("content-type") || ""
    const text = await response.text()
    const payload = tryParseApiPayload(contentType, text)
    const campos = extractConfiguredRuntimeFields(api, payload)

    const result = {
      id: api.id,
      apiId: api.id,
      nome: api.name,
      descricao: api.description,
      url: api.url,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      contentType,
      preview: buildApiPreviewContent(api, payload, text),
      campos,
      config: api.config,
      cache: {
        hit: false,
        ttlSeconds: cacheTtlSeconds,
      },
    }

    if (safeTtlMs > 0 && response.ok) {
      runtimeApiCache.set(cacheKey, {
        expiresAt: Date.now() + safeTtlMs,
        value: result,
      })
    }

    return result
  } catch (error) {
    return {
      id: api.id,
      apiId: api.id,
      nome: api.name,
      descricao: api.description,
      url: api.url,
      ok: false,
      status: 0,
      durationMs: null,
      contentType: "",
      preview: error.name === "AbortError" ? "Timeout ao consultar API." : error.message,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function loadAgentRuntimeApis({ agenteId, projetoId, limit = 4 }) {
  if (!agenteId || !projetoId) {
    return []
  }

  if (!hasValidSupabaseRuntimeEnv()) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agente_api")
      .select(`api_id, apis!inner(${apiFields}, api_campos(${apiRuntimeFieldSchema}))`)
      .eq("agente_id", agenteId)
      .eq("apis.projeto_id", projetoId)
      .eq("apis.ativo", true)
      .limit(limit)

    if (error) {
      console.error("[apis] failed to load runtime apis", error)
      return []
    }

    const apis = data.map((item) => mapApi(item.apis)).filter((api) => api.active).slice(0, limit)
    return Promise.all(apis.map((api) => fetchApiPreview(api)))
  } catch (error) {
    console.error("[apis] failed to load runtime apis", error)
    return []
  }
}
