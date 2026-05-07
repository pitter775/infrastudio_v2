import "server-only"

import { validateJsonObjectConfig } from "@/lib/json-validation"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const apiFields =
  "id, projeto_id, nome, url, metodo, descricao, ativo, configuracoes, created_at, updated_at"
const apiListFields =
  "id, projeto_id, nome, url, metodo, descricao, ativo, configuracoes, created_at, updated_at"
const apiRuntimeFieldSchemaWithApiId = "api_id, id, nome, tipo, descricao"
const apiVersionFields =
  "id, api_id, projeto_id, version_number, nome, url, metodo, descricao, configuracoes, ativo, source, note, created_by, created_at"
const runtimeApiCache = new Map()
const runtimeIntentTypes = new Set(["create_record", "lookup_by_identifier", "knowledge_search", "catalog_search", "generic_fact"])
const runtimeAvailabilityScopes = new Set(["always", "open_search", "context_item"])

function normalizeRuntimeAvailabilityScope(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return runtimeAvailabilityScopes.has(normalized) ? normalized : "always"
}

function hasRuntimeContextItem(context = null) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return false
  }

  return Boolean(
    context.id ||
      context.propertyId ||
      context.resource?.id ||
      context.imovel?.id ||
      context.property?.id ||
      context.catalogo?.produtoAtual?.id
  )
}

function shouldExposeRuntimeApiInContext(api, context = null) {
  const scope = normalizeRuntimeAvailabilityScope(api?.config?.runtime?.availabilityScope)
  if (scope === "always") {
    return true
  }

  const hasContextItem = hasRuntimeContextItem(context)
  if (scope === "context_item") {
    return hasContextItem
  }

  if (scope === "open_search") {
    return !hasContextItem
  }

  return true
}

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

function mapApiSummary(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    name: row.nome || "API sem nome",
    url: row.url || "",
    method: row.metodo || "GET",
    description: row.descricao || "",
    active: row.ativo !== false,
    config: row.configuracoes ?? null,
    fieldSchema: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: [],
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

function getApiRequestHeaders(api, overrideHeaders = null) {
  const configuredHeaders = normalizeHeaderConfig(api?.config?.http?.headers)
  const method = String(api?.method || "GET").toUpperCase()
  return {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
    ...configuredHeaders,
    ...normalizeHeaderConfig(overrideHeaders),
  }
}

function buildApiRequestBody(api, context = null, overrideBody) {
  const method = String(api?.method || "GET").toUpperCase()
  if (method === "GET" || method === "HEAD") {
    return undefined
  }

  if (overrideBody !== undefined) {
    return typeof overrideBody === "string" ? overrideBody : JSON.stringify(overrideBody)
  }

  const configuredBody = api?.config?.http?.body
  if (configuredBody == null) {
    return undefined
  }

  const body = typeof configuredBody === "string" ? configuredBody : JSON.stringify(configuredBody)
  return body.replace(/\{\{([^{}]+)\}\}/g, (_match, path) => {
    const value = getRuntimeContextValue(context, String(path || "").trim())
    return value == null ? "" : String(value)
  })
}

function normalizeRuntimeIntentType(value) {
  const normalized = String(value || "").trim().toLowerCase()
  return runtimeIntentTypes.has(normalized) ? normalized : "generic_fact"
}

function getRuntimeIntentType(api) {
  return normalizeRuntimeIntentType(api?.config?.runtime?.intentType)
}

function getRuntimeRequiredFields(api) {
  const requiredFields = api?.config?.runtime?.requiredFields
  if (!Array.isArray(requiredFields)) {
    return []
  }

  return requiredFields
    .map((field) => {
      if (typeof field === "string") {
        return { name: field, source: field, label: field }
      }

      const name = String(field?.name || field?.nome || field?.param || field?.contextPath || "").trim()
      const source = String(field?.contextPath || field?.path || field?.source || field?.param || name).trim()
      const label = String(field?.label || field?.titulo || field?.nome || name || source).trim()
      return name || source ? { name: name || source, source: source || name, label: label || name || source } : null
    })
    .filter(Boolean)
}

function resolveMissingRuntimeRequiredFields(api, context = null) {
  return getRuntimeRequiredFields(api).filter((field) => {
    const value =
      resolveRuntimeApiParameterValue(api, context, field.name) ??
      getRuntimeContextValue(context, field.source)
    return value == null || !String(value).trim()
  })
}

function isRuntimeApiConfirmedForExecution(api, context = null) {
  const apiRuntime = context?.apiRuntime
  if (!apiRuntime || typeof apiRuntime !== "object" || Array.isArray(apiRuntime)) {
    return false
  }

  const apiId = String(api?.id || api?.apiId || "").trim()
  const confirmedApiId = String(apiRuntime.confirmedApiId || "").trim()
  const confirmedIntentType = normalizeRuntimeIntentType(apiRuntime.confirmedIntentType || apiRuntime.lastIntentType)
  const confirmedAt = String(apiRuntime.confirmedAt || "").trim()

  return Boolean(
    apiId &&
      confirmedApiId === apiId &&
      confirmedIntentType === getRuntimeIntentType(api) &&
      confirmedAt &&
      apiRuntime.pendingConfirmation !== true
  )
}

export function shouldExecuteRuntimeApi(api, context = null) {
  const method = String(api?.method || "GET").toUpperCase()
  if (method === "GET" || method === "HEAD") {
    return true
  }

  const runtimeConfig = api?.config?.runtime ?? {}
  const intentType = getRuntimeIntentType(api)
  const missingRequiredFields = resolveMissingRuntimeRequiredFields(api, context)
  if (missingRequiredFields.length) {
    return false
  }

  if (intentType === "create_record" || runtimeConfig.requiresConfirmation === true) {
    return runtimeConfig.autoExecute === true && isRuntimeApiConfirmedForExecution(api, context)
  }

  return runtimeConfig.autoExecute === true
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

function getRuntimeContextValue(context, path) {
  if (!path) {
    return undefined
  }

  const normalizedPath = String(path).trim()
  if (!normalizedPath) {
    return undefined
  }

  if (normalizedPath === "id") {
    const directCandidates = [
      context?.id,
      context?.resource?.id,
      context?.imovel?.id,
      context?.property?.id,
      context?.propertyId,
    ]

    for (const candidate of directCandidates) {
      if (candidate != null && String(candidate).trim()) {
        return candidate
      }
    }
  }

  return readPathValue(context, normalizedPath)
}

function resolveRuntimeApiParameterValue(api, context, parameterName) {
  const normalizedName = String(parameterName || "").trim()
  if (!normalizedName) {
    return null
  }

  const configuredParameters = Array.isArray(api?.config?.parametros) ? api.config.parametros : []
  const configuredParameter = configuredParameters.find(
    (item) => String(item?.nome || item?.name || "").trim() === normalizedName
  )
  const explicitPaths = [
    configuredParameter?.path,
    configuredParameter?.contextPath,
    configuredParameter?.source,
  ].filter(Boolean)
  const fallbackPaths = [
    normalizedName,
    `resource.${normalizedName}`,
    `imovel.${normalizedName}`,
    `property.${normalizedName}`,
    normalizedName === "id" ? "resource.id" : null,
    normalizedName === "id" ? "id" : null,
    normalizedName === "id" ? "propertyId" : null,
  ].filter(Boolean)

  for (const path of [...explicitPaths, ...fallbackPaths]) {
    const value = getRuntimeContextValue(context, path)
    if (value != null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return null
}

function resolveRuntimeApiUrl(api, context) {
  const rawUrl = String(api?.url || "").trim()
  if (!rawUrl) {
    return { url: "", missingParams: [] }
  }

  const missingParams = []
  const resolvedUrl = rawUrl.replace(/\{([^{}]+)\}/g, (match, paramName) => {
    const value = resolveRuntimeApiParameterValue(api, context, paramName)
    if (value == null) {
      missingParams.push(String(paramName || "").trim())
      return match
    }

    return encodeURIComponent(value)
  })

  return {
    url: resolvedUrl,
    missingParams,
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

  const configuredResult = fieldDefinitions
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

  if (configuredResult.length || getRuntimeIntentType(api) !== "catalog_search") {
    return configuredResult
  }

  const catalogRootCandidates = [
    readPathValue(responseRoot, "imoveis"),
    readPathValue(responseRoot, "items"),
    readPathValue(responseRoot, "results"),
    readPathValue(responseRoot, "data.items"),
    readPathValue(responseRoot, "data.results"),
    readPathValue(responseRoot, "data.imoveis"),
    responseRoot,
  ]
  const catalogItem =
    catalogRootCandidates.find((item) => Array.isArray(item) && item[0] && typeof item[0] === "object")?.[0] ??
    catalogRootCandidates.find((item) => item && typeof item === "object" && !Array.isArray(item)) ??
    null

  if (!catalogItem || typeof catalogItem !== "object" || Array.isArray(catalogItem)) {
    return configuredResult
  }

  return Object.entries(catalogItem)
    .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 40)
    .map(([key, value]) => ({
      nome: key,
      tipo: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
      descricao: "",
      valor: normalizeFieldValue(value),
    }))
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
    const urlForValidation = rawUrl.replace(/\{[^{}]+\}/g, "placeholder")
    url = new URL(urlForValidation)
  } catch {
    return { error: "URL inválida." }
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "URL precisa usar http ou https." }
  }

  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return { error: "Metodo precisa ser GET, POST, PUT, PATCH ou DELETE." }
  }

  const config = input.configuracoes ?? input.config ?? {}
  const configValidation = validateJsonObjectConfig(config, "configuracoes")
  if (!configValidation.ok) {
    return { error: configValidation.error }
  }

  const active = input.ativo === false || input.active === false ? false : true
  if (active && !String(configValidation.value?.runtime?.descriptionForIntent || "").trim()) {
    return { error: "Informe a descrição para decisão da IA. Ela ajuda o agente a escolher esta API corretamente durante a conversa." }
  }

  return {
    payload: {
      nome: name,
      url: rawUrl,
      metodo: method,
      descricao: String(input.descricao || input.description || "").trim(),
      ativo: active,
      configuracoes: configValidation.value ?? {},
      updated_at: new Date().toISOString(),
    },
  }
}

async function executeApiTestRun(api, options = {}) {
  const runtimeContext =
    options?.runtimeContext && typeof options.runtimeContext === "object" && !Array.isArray(options.runtimeContext)
      ? options.runtimeContext
      : null
  const testOverrides =
    options?.testOverrides && typeof options.testOverrides === "object" && !Array.isArray(options.testOverrides)
      ? options.testOverrides
      : {}
  const resolvedRequest = resolveRuntimeApiUrl(api, runtimeContext)
  const requestBody = buildApiRequestBody(api, runtimeContext, testOverrides.body)
  const requestHeaders = getApiRequestHeaders(api, testOverrides.headers)

  if (resolvedRequest.missingParams.length) {
    return {
      result: {
        ok: false,
        status: 0,
        statusText: "Parametros ausentes",
        durationMs: null,
        contentType: "",
        method: api.method || "GET",
        url: resolvedRequest.url,
        missingParams: resolvedRequest.missingParams,
        requestBody,
        requestHeaders,
        preview: `Preencha os parametros obrigatorios: ${resolvedRequest.missingParams.join(", ")}.`,
        fields: [],
      },
      error: null,
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const startedAt = Date.now()

  try {
    const response = await fetch(resolvedRequest.url, {
      method: api.method || "GET",
      signal: controller.signal,
      headers: requestHeaders,
      body: requestBody,
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
        method: api.method || "GET",
        url: resolvedRequest.url,
        missingParams: [],
        requestBody,
        requestHeaders,
        preview: text.slice(0, 800),
        responseBodyText: text,
        responseJson: payload,
        fields,
      },
      error: null,
    }
  } catch (error) {
    return {
      result: {
        ok: false,
        status: 0,
        statusText: error.name === "AbortError" ? "Timeout" : "Erro de conexão",
        durationMs: null,
        contentType: "",
        method: api.method || "GET",
        url: resolvedRequest.url,
        missingParams: [],
        requestBody,
        requestHeaders,
        preview: error.message,
        fields: [],
      },
      error: null,
    }
  } finally {
    clearTimeout(timeout)
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
      .select(apiListFields)
      .eq("projeto_id", projetoId)
      .order("updated_at", { ascending: false, nullsFirst: false })

    if (error) {
      console.error("[apis] failed to list project apis", error)
      return []
    }

    return data.map(mapApiSummary)
  } catch (error) {
    console.error("[apis] failed to list project apis", error)
    return []
  }
}

export async function getApiForUser(apiId, projetoId, user) {
  if (!apiId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return { api: null, error: "Acesso negado." }
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
        console.error("[apis] failed to get api", error)
      }
      return { api: null, error: "API não encontrada." }
    }

    return { api: mapApi(data), error: null }
  } catch (error) {
    console.error("[apis] failed to get api", error)
    return { api: null, error: "Não foi possível carregar a API." }
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
      return { apiIds: [], error: "Agente não encontrado." }
    }

    if (nextApiIds.length) {
      const { data: projectApis, error: apiError } = await supabase
        .from("apis")
        .select("id")
        .eq("projeto_id", projetoId)
        .in("id", nextApiIds)

      if (apiError) {
        console.error("[apis] failed to validate api links", apiError)
        return { apiIds: [], error: "Não foi possível validar as APIs." }
      }

      if ((projectApis ?? []).length !== nextApiIds.length) {
        return { apiIds: [], error: "Uma ou mais APIs não pertencem ao projeto." }
      }
    }

    const { error: deleteError } = await supabase.from("agente_api").delete().eq("agente_id", agenteId)

    if (deleteError) {
      console.error("[apis] failed to clear agent api links", deleteError)
      return { apiIds: [], error: "Não foi possível atualizar os vínculos." }
    }

    if (nextApiIds.length) {
      const { error: insertError } = await supabase
        .from("agente_api")
        .insert(nextApiIds.map((apiId) => ({ agente_id: agenteId, api_id: apiId })))

      if (insertError) {
        console.error("[apis] failed to insert agent api links", insertError)
        return { apiIds: [], error: "Não foi possível salvar os vínculos." }
      }
    }

    return { apiIds: nextApiIds, error: null }
  } catch (error) {
    console.error("[apis] failed to replace agent api links", error)
    return { apiIds: [], error: "Não foi possível salvar os vínculos." }
  }
}

export async function ensureAgentApiLinkForUser({ agenteId, projetoId, apiId }, user) {
  if (!agenteId || !projetoId || !apiId || !userCanAccessProject(user, projetoId)) {
    return { ok: false, error: "Acesso negado." }
  }

  try {
    const supabase = getSupabaseAdminClient()
    const [{ data: agent, error: agentError }, { data: api, error: apiError }] = await Promise.all([
      supabase
        .from("agentes")
        .select("id")
        .eq("id", agenteId)
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase
        .from("apis")
        .select("id")
        .eq("id", apiId)
        .eq("projeto_id", projetoId)
        .maybeSingle(),
    ])

    if (agentError || !agent) {
      return { ok: false, error: "Agente não encontrado." }
    }

    if (apiError || !api) {
      return { ok: false, error: "API não encontrada." }
    }

    const { data: existing, error: existingError } = await supabase
      .from("agente_api")
      .select("api_id")
      .eq("agente_id", agenteId)
      .eq("api_id", apiId)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error("[apis] failed to check agent api link", existingError)
      return { ok: false, error: "Não foi possível validar o vínculo da API." }
    }

    if (existing?.api_id) {
      return { ok: true, error: null }
    }

    const { error: insertError } = await supabase
      .from("agente_api")
      .insert({ agente_id: agenteId, api_id: apiId })

    if (insertError) {
      console.error("[apis] failed to insert agent api link", insertError)
      return { ok: false, error: "Não foi possível vincular a API ao agente." }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error("[apis] failed to ensure agent api link", error)
    return { ok: false, error: "Não foi possível vincular a API ao agente." }
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
      return { api: null, error: "Não foi possível criar a API." }
    }

    return { api: mapApi(data), error: null }
  } catch (error) {
    console.error("[apis] failed to create api", error)
    return { api: null, error: "Não foi possível criar a API." }
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
      return { api: null, error: "API não encontrada." }
    }

    try {
      await createApiVersionSnapshot(supabase, currentApi, {
        source: "manual_update",
        note: "Snapshot antes de salvar alteracoes da API.",
        userId: user?.id ?? null,
      })
    } catch (versionError) {
      if (isMissingApiVersionTableError(versionError)) {
      } else if (isApiVersionAccessError(versionError)) {
      } else {
        console.error("[apis] failed to create api version", versionError)
        return { api: null, error: "Não foi possível versionar a API." }
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
      return { api: null, error: "Não foi possível atualizar a API." }
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
    return { api: null, error: "Não foi possível atualizar a API." }
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
      return { ok: false, error: "API não encontrada." }
    }

    await supabase.from("agente_api").delete().eq("api_id", apiId)
    await supabase.from("api_campos").delete().eq("api_id", apiId)
    await supabase.from("api_versoes").delete().eq("api_id", apiId)

    const { error } = await supabase.from("apis").delete().eq("id", apiId).eq("projeto_id", projetoId)

    if (error) {
      console.error("[apis] failed to delete api", error)
      return { ok: false, error: "Não foi possível deletar a API." }
    }

    return { ok: true, error: null }
  } catch (error) {
    console.error("[apis] failed to delete api", error)
    return { ok: false, error: "Não foi possível deletar a API." }
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
      return { api: null, error: "Versão de API não encontrada." }
    }

    try {
      await createApiVersionSnapshot(supabase, currentApi, {
        source: "rollback",
        note: `Snapshot antes de restaurar versao ${version.version_number}.`,
        userId: user?.id ?? null,
      })
    } catch (snapshotError) {
      console.error("[apis] failed to create rollback snapshot", snapshotError)
      return { api: null, error: "Não foi possível criar snapshot antes do rollback." }
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
      return { api: null, error: "Não foi possível restaurar a API." }
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
    return { api: null, error: "Não foi possível restaurar a API." }
  }
}

export async function testApiForUser(apiId, projetoId, user, options = {}) {
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
      return { result: null, error: "API não encontrada." }
    }

    const api = mapApi(data)
    return executeApiTestRun(api, options)
  } catch (error) {
    console.error("[apis] failed to test api", error)
    return { result: null, error: "Não foi possível testar a API." }
  }
}

export async function testApiDraftForUser(projetoId, input, user, options = {}) {
  if (!projetoId || !userCanAccessProject(user, projetoId)) {
    return { result: null, error: "Acesso negado." }
  }

  const normalized = normalizeApiInput(input)
  if (normalized.error) {
    return { result: null, error: normalized.error }
  }

  const draftApi = {
    id: "__draft__",
    projetoId,
    name: normalized.payload.nome,
    url: normalized.payload.url,
    method: normalized.payload.metodo,
    description: normalized.payload.descricao,
    active: normalized.payload.ativo !== false,
    config: normalized.payload.configuracoes ?? {},
    fieldSchema: [],
    createdAt: null,
    updatedAt: normalized.payload.updated_at,
    versions: [],
  }

  try {
    return await executeApiTestRun(draftApi, options)
  } catch (error) {
    console.error("[apis] failed to test draft api", error)
    return { result: null, error: "Não foi possível testar a API." }
  }
}

async function fetchApiPreview(api, timeoutMs = 5000, runtimeContext = null) {
  const cacheTtlSeconds = Number(api?.config?.runtime?.cacheTtlSeconds ?? 0)
  const safeTtlMs = Number.isFinite(cacheTtlSeconds) ? Math.min(Math.max(cacheTtlSeconds, 0), 3600) * 1000 : 0
  const resolvedRequest = resolveRuntimeApiUrl(api, runtimeContext)
  const cacheKey = [
    api.id,
    api.updatedAt,
    resolvedRequest.url,
    JSON.stringify(api.config?.runtime ?? {}),
  ].join(":")

  if (resolvedRequest.missingParams.length) {
    return {
      id: api.id,
      apiId: api.id,
      nome: api.name,
      descricao: api.description,
      url: rawUrlForDisplay(api, resolvedRequest.url),
      ok: false,
      status: 0,
      durationMs: null,
      contentType: "",
      missingParams: resolvedRequest.missingParams,
      preview: `Parametros ausentes para consultar a API: ${resolvedRequest.missingParams.join(", ")}.`,
      campos: [],
      config: api.config,
      cache: {
        hit: false,
        ttlSeconds: cacheTtlSeconds,
      },
    }
  }

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
    if (!shouldExecuteRuntimeApi(api, runtimeContext)) {
      const missingRequiredFields = resolveMissingRuntimeRequiredFields(api, runtimeContext)
      const intentType = getRuntimeIntentType(api)
      const preview =
        missingRequiredFields.length
          ? `API ${api.method} cadastrada. Faltam dados obrigatórios para executar com segurança: ${missingRequiredFields.map((field) => field.label).join(", ")}.`
          : intentType === "create_record"
            ? `API ${api.method} de cadastro cadastrada. Não foi executada automaticamente no runtime para evitar efeito colateral.`
            : `API ${api.method} cadastrada. Não foi executada automaticamente no runtime para evitar efeito colateral.`
      return {
        id: api.id,
        apiId: api.id,
        nome: api.name,
        descricao: api.description,
        url: rawUrlForDisplay(api, resolvedRequest.url),
        ok: true,
        status: 0,
        durationMs: 0,
        contentType: "",
        preview,
        campos: [],
        config: api.config,
        cache: {
          hit: false,
          ttlSeconds: cacheTtlSeconds,
        },
      }
    }

    const response = await fetch(resolvedRequest.url, {
      method: api.method || "GET",
      signal: controller.signal,
      headers: getApiRequestHeaders(api),
      body: buildApiRequestBody(api, runtimeContext),
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
      url: rawUrlForDisplay(api, resolvedRequest.url),
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
      url: rawUrlForDisplay(api, resolvedRequest.url),
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

function rawUrlForDisplay(api, resolvedUrl) {
  return String(resolvedUrl || api?.url || "")
}

export async function loadAgentRuntimeApis({ agenteId, projetoId, limit = 4, context = null }) {
  if (!agenteId || !projetoId) {
    return []
  }

  if (!hasValidSupabaseRuntimeEnv()) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    let { data, error } = await supabase
      .from("agente_api")
      .select(`api_id, apis!inner(${apiFields})`)
      .eq("agente_id", agenteId)
      .eq("apis.projeto_id", projetoId)
      .eq("apis.ativo", true)
      .limit(limit)

    if (error) {
      console.error("[apis] failed to load runtime apis", error)
      return []
    }

    if (!data?.length) {
      const fallback = await supabase
        .from("apis")
        .select(apiFields)
        .eq("projeto_id", projetoId)
        .eq("ativo", true)
        .order("updated_at", { ascending: false })
        .limit(limit)

      if (fallback.error) {
        console.error("[apis] failed to load project runtime apis fallback", fallback.error)
        return []
      }

      data = (fallback.data ?? []).map((api) => ({ api_id: api.id, apis: api }))
    }

    const apis = data
      .map((item) => mapApi(item.apis))
      .filter((api) => api.active && shouldExposeRuntimeApiInContext(api, context))
      .slice(0, limit)
    const apiIdsNeedingFieldSchema = apis
      .filter((api) => !Array.isArray(api?.config?.runtime?.fields) || api.config.runtime.fields.length === 0)
      .map((api) => api.id)

    if (apiIdsNeedingFieldSchema.length) {
      const { data: fields, error: fieldsError } = await supabase
        .from("api_campos")
        .select(apiRuntimeFieldSchemaWithApiId)
        .in("api_id", apiIdsNeedingFieldSchema)

      if (fieldsError) {
        console.error("[apis] failed to load runtime api fields", fieldsError)
      } else {
        const fieldsByApiId = new Map()
        ;(fields ?? []).forEach((field) => {
          const current = fieldsByApiId.get(field.api_id) ?? []
          current.push({
            id: field.id,
            nome: field.nome,
            tipo: field.tipo,
            descricao: field.descricao || "",
          })
          fieldsByApiId.set(field.api_id, current)
        })

        apis.forEach((api) => {
          if (fieldsByApiId.has(api.id)) {
            api.fieldSchema = fieldsByApiId.get(api.id)
          }
        })
      }
    }

    return Promise.all(apis.map((api) => fetchApiPreview(api, 5000, context)))
  } catch (error) {
    console.error("[apis] failed to load runtime apis", error)
    return []
  }
}
