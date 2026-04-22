import "server-only"

import { SignJWT, jwtVerify } from "jose"

import {
  mapMercadoLivreItem,
  mapMercadoLivreOrder,
  mapMercadoLivreQuestion,
  scoreMercadoLivreItem,
} from "@/lib/mercado-livre/mappers"
import { resolveMercadoLivreProductInternal } from "@/lib/mercado-livre/resolve-product"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const CONNECTOR_FIELDS =
  "id, projeto_id, agente_id, slug, nome, tipo, descricao, endpoint_base, metodo_auth, configuracoes, ativo, created_at, updated_at"

const MERCADO_LIVRE_SLUG = "mercado-livre"
const MERCADO_LIVRE_TYPE = "mercado_livre"
const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com"
const MERCADO_LIVRE_AUTH_BASE = "https://auth.mercadolivre.com.br"

function getAppAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("APP_AUTH_SECRET nao configurado.")
  }

  return new TextEncoder().encode(secret)
}

function getAppUrl(origin) {
  return (
    origin?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  )
}

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function mapConnector(row) {
  return {
    id: row.id,
    projetoId: row.projeto_id,
    agenteId: row.agente_id,
    slug: row.slug || "",
    name: row.nome || "Conector sem nome",
    type: row.tipo || "custom",
    description: row.descricao || "",
    endpointBase: row.endpoint_base || "",
    authMethod: row.metodo_auth || "",
    config: row.configuracoes ?? {},
    active: row.ativo !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getConnectorConfig(connector) {
  return connector?.config && typeof connector.config === "object" && !Array.isArray(connector.config) ? connector.config : {}
}

function normalizeMercadoLivreConnector(connector) {
  if (!connector) {
    return null
  }

  const config = getConnectorConfig(connector)
  const oauthExpiresAt = sanitizeString(config.oauthExpiresAt)
  const oauthConnected = Boolean(sanitizeString(config.oauthAccessToken) && sanitizeString(config.oauthUserId))

  return {
    ...connector,
    config: {
      ...config,
      appId: sanitizeString(config.appId || config.app_id || config.clientId || config.client_id),
      clientSecret: sanitizeString(config.clientSecret || config.client_secret || config.secret),
      seedId: sanitizeString(config.seedId || config.seed_id || config.sellerId || config.seller_id),
      oauthAccessToken: sanitizeString(config.oauthAccessToken || config.access_token),
      oauthRefreshToken: sanitizeString(config.oauthRefreshToken || config.refresh_token),
      oauthUserId: sanitizeString(config.oauthUserId || config.user_id || config.sellerUserId),
      oauthNickname: sanitizeString(config.oauthNickname || config.nickname),
      oauthExpiresAt,
    },
    oauthConnected,
  }
}

async function signMercadoLivreOAuthState(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAppAuthSecret())
}

async function verifyMercadoLivreOAuthState(token) {
  const { payload } = await jwtVerify(token, getAppAuthSecret())
  return {
    projectId: sanitizeString(payload.projectId),
    connectorId: sanitizeString(payload.connectorId),
  }
}

async function getMercadoLivreConnectorByProjectId(projectId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("conectores")
    .select(CONNECTOR_FIELDS)
    .eq("projeto_id", projectId)
    .order("updated_at", { ascending: false, nullsFirst: false })

  if (error) {
    console.error("[mercado-livre] failed to load project connectors", error)
    return null
  }

  const row = (data ?? []).find((item) => {
    const haystack = `${item.slug || ""} ${item.tipo || ""} ${item.nome || ""}`.toLowerCase()
    return haystack.includes("mercado") || haystack.includes("ml")
  })

  return normalizeMercadoLivreConnector(row ? mapConnector(row) : null)
}

async function getMercadoLivreConnectorById(connectorId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("conectores")
    .select(CONNECTOR_FIELDS)
    .eq("id", connectorId)
    .maybeSingle()

  if (error) {
    console.error("[mercado-livre] failed to load connector by id", error)
    return null
  }

  return normalizeMercadoLivreConnector(data ? mapConnector(data) : null)
}

async function updateMercadoLivreConnectorConfig(connectorId, nextConfig, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("conectores")
    .update({
      configuracoes: nextConfig,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectorId)
    .select(CONNECTOR_FIELDS)
    .maybeSingle()

  if (error || !data) {
    console.error("[mercado-livre] failed to update connector config", error)
    return null
  }

  return normalizeMercadoLivreConnector(mapConnector(data))
}

export async function upsertMercadoLivreConnectorForUser(project, input, user, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { connector: null, error: "Projeto nao encontrado." }
  }

  const storeName = sanitizeString(input?.storeName)
  const appId = sanitizeString(input?.appId)
  const clientSecret = sanitizeString(input?.clientSecret)
  const seedId = sanitizeString(input?.seedId)

  if (!storeName || !appId || !clientSecret) {
    return { connector: null, error: "Preencha nome da loja, App ID e Client Secret." }
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const current = await getMercadoLivreConnectorByProjectId(project.id, { supabase })
    const currentConfig = getConnectorConfig(current)
    const nextConfig = {
      ...currentConfig,
      appId,
      clientSecret,
      seedId,
    }

    const payload = {
      projeto_id: project.id,
      agente_id: project.agent?.id ?? current?.agenteId ?? null,
      slug: MERCADO_LIVRE_SLUG,
      nome: storeName,
      tipo: MERCADO_LIVRE_TYPE,
      descricao: "Conector Mercado Livre",
      endpoint_base: MERCADO_LIVRE_API_BASE,
      metodo_auth: "oauth2",
      configuracoes: nextConfig,
      ativo: true,
      updated_at: new Date().toISOString(),
    }

    const query = current?.id
      ? supabase.from("conectores").update(payload).eq("id", current.id)
      : supabase.from("conectores").insert({
          ...payload,
          created_at: new Date().toISOString(),
        })

    const { data, error } = await query.select(CONNECTOR_FIELDS).maybeSingle()

    if (error || !data) {
      console.error("[mercado-livre] failed to upsert connector", error)
      return { connector: null, error: "Nao foi possivel salvar a conexao do Mercado Livre." }
    }

    return {
      connector: normalizeMercadoLivreConnector(mapConnector(data)),
      error: null,
    }
  } catch (error) {
    console.error("[mercado-livre] failed to upsert connector", error)
    return { connector: null, error: "Nao foi possivel salvar a conexao do Mercado Livre." }
  }
}

export async function buildMercadoLivreAuthorizationUrl(project, user, origin, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    throw new Error("Projeto nao encontrado.")
  }

  const connector = await getMercadoLivreConnectorByProjectId(project.id, deps)
  if (!connector?.id) {
    throw new Error("Salve a conexao do Mercado Livre antes de autorizar a conta.")
  }

  const config = getConnectorConfig(connector)
  const appId = sanitizeString(config.appId)
  const clientSecret = sanitizeString(config.clientSecret)

  if (!appId || !clientSecret) {
    throw new Error("App ID e Client Secret sao obrigatorios para iniciar o OAuth do Mercado Livre.")
  }

  const state = await signMercadoLivreOAuthState({
    projectId: project.id,
    connectorId: connector.id,
  })

  const redirectUri = `${getAppUrl(origin).replace(/\/$/, "")}/api/admin/conectores/mercado-livre/callback`
  const url = new URL(`${MERCADO_LIVRE_AUTH_BASE}/authorization`)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", appId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("state", state)

  return url.toString()
}

function buildMercadoLivreOAuthRedirectPath(projectId, status) {
  const target = new URL(`/admin/projetos/${encodeURIComponent(projectId)}`, getAppUrl())
  target.searchParams.set("panel", "mercado-livre")
  target.searchParams.set("tab", "test")
  target.searchParams.set("ml_notice", status)
  return target.toString()
}

async function exchangeMercadoLivreCode(code, connector, origin, fetchImpl = fetch) {
  const config = getConnectorConfig(connector)
  const response = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: sanitizeString(config.appId),
      client_secret: sanitizeString(config.clientSecret),
      code,
      redirect_uri: `${getAppUrl(origin).replace(/\/$/, "")}/api/admin/conectores/mercado-livre/callback`,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    throw new Error("Falha ao trocar o codigo do Mercado Livre.")
  }

  return payload
}

async function refreshMercadoLivreToken(connector, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const config = getConnectorConfig(connector)
  const refreshToken = sanitizeString(config.oauthRefreshToken)

  if (!refreshToken) {
    return null
  }

  const response = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: sanitizeString(config.appId),
      client_secret: sanitizeString(config.clientSecret),
      refresh_token: refreshToken,
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    return null
  }

  const nextConfig = {
    ...config,
    oauthAccessToken: sanitizeString(payload.access_token),
    oauthRefreshToken: sanitizeString(payload.refresh_token || refreshToken),
    oauthUserId: sanitizeString(payload.user_id || config.oauthUserId),
    oauthExpiresAt: payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : config.oauthExpiresAt,
  }

  return updateMercadoLivreConnectorConfig(connector.id, nextConfig, deps)
}

async function fetchMercadoLivreProfile(accessToken, fetchImpl = fetch) {
  const response = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.id) {
    throw new Error("Falha ao carregar o perfil autorizado do Mercado Livre.")
  }

  return payload
}

export async function completeMercadoLivreOAuthCallback(searchParams, origin, deps = {}) {
  const code = searchParams.get("code")?.trim() || ""
  const state = searchParams.get("state")?.trim() || ""
  const providerError = searchParams.get("error_description")?.trim() || searchParams.get("error")?.trim() || ""

  if (providerError) {
    throw new Error(providerError)
  }

  if (!code || !state) {
    throw new Error("Retorno do OAuth do Mercado Livre incompleto.")
  }

  const parsedState = await verifyMercadoLivreOAuthState(state)
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const fetchImpl = deps.fetchImpl ?? fetch
  const connector = await getMercadoLivreConnectorById(parsedState.connectorId, { supabase })

  if (!connector?.id || connector.projetoId !== parsedState.projectId) {
    throw new Error("Conector do Mercado Livre nao encontrado.")
  }

  const tokenPayload = await exchangeMercadoLivreCode(code, connector, origin, fetchImpl)
  const profile = await fetchMercadoLivreProfile(tokenPayload.access_token, fetchImpl)
  const currentConfig = getConnectorConfig(connector)
  const nextConfig = {
    ...currentConfig,
    oauthAccessToken: sanitizeString(tokenPayload.access_token),
    oauthRefreshToken: sanitizeString(tokenPayload.refresh_token),
    oauthUserId: sanitizeString(profile.id),
    oauthNickname: sanitizeString(profile.nickname),
    oauthExpiresAt: tokenPayload.expires_in ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString() : "",
  }

  await updateMercadoLivreConnectorConfig(connector.id, nextConfig, { supabase })

  return {
    redirectUrl: buildMercadoLivreOAuthRedirectPath(parsedState.projectId, "oauth_ok"),
    projectId: parsedState.projectId,
  }
}

async function ensureMercadoLivreAccessToken(connector, deps = {}) {
  const config = getConnectorConfig(connector)
  const accessToken = sanitizeString(config.oauthAccessToken)
  const expiresAt = sanitizeString(config.oauthExpiresAt)
  const refreshToken = sanitizeString(config.oauthRefreshToken)

  if (accessToken && expiresAt) {
    const expiresMs = new Date(expiresAt).getTime()
    if (Number.isFinite(expiresMs) && expiresMs - Date.now() > 60_000) {
      return { connector, accessToken }
    }
  }

  if (accessToken && !expiresAt && !refreshToken) {
    return { connector, accessToken }
  }

  const refreshedConnector = await refreshMercadoLivreToken(connector, deps)
  const refreshedConfig = getConnectorConfig(refreshedConnector)
  const refreshedAccessToken = sanitizeString(refreshedConfig.oauthAccessToken)

  if (!refreshedConnector?.id || !refreshedAccessToken) {
    throw new Error("Conecte a conta do Mercado Livre para listar os produtos da loja.")
  }

  return {
    connector: refreshedConnector,
    accessToken: refreshedAccessToken,
  }
}

function isMercadoLivreInvalidTokenError(value) {
  const normalized = sanitizeString(
    typeof value === "string"
      ? value
      : value?.message || value?.error || value?.cause || value?.error_description || value?.status
  ).toLowerCase()

  return Boolean(
    normalized &&
      (normalized.includes("invalid access token") ||
        normalized.includes("invalid_token") ||
        normalized.includes("expired_token") ||
        normalized.includes("token expired") ||
        normalized.includes("not valid access token"))
  )
}

async function withMercadoLivreAuthorizedOperation(connector, deps = {}, operation) {
  const runOperation = async (activeConnector) => {
    const { connector: resolvedConnector, accessToken } = await ensureMercadoLivreAccessToken(activeConnector, deps)
    const result = await operation({
      connector: resolvedConnector,
      accessToken,
    })

    return {
      ...result,
      connector: result?.connector ?? resolvedConnector,
    }
  }

  const firstAttempt = await runOperation(connector)
  if (!isMercadoLivreInvalidTokenError(firstAttempt?.error)) {
    return firstAttempt
  }

  const refreshedConnector = await refreshMercadoLivreToken(firstAttempt.connector ?? connector, deps)
  if (!refreshedConnector?.id) {
    return firstAttempt
  }

  return runOperation(refreshedConnector)
}

async function listMercadoLivreUserItemIds(userId, accessToken, options = {}, deps = {}) {
  const limit = Math.min(Math.max(Number(options.limit ?? 24) || 24, 1), 50)
  const offset = Math.max(Number(options.offset ?? 0) || 0, 0)
  const fetchImpl = deps.fetchImpl ?? fetch
  const searchResponse = await fetchImpl(
    `${MERCADO_LIVRE_API_BASE}/users/${encodeURIComponent(userId)}/items/search?limit=${limit}&offset=${offset}&orders=last_updated_desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  )

  const searchPayload = await searchResponse.json().catch(() => ({}))
  if (!searchResponse.ok) {
    return {
      itemIds: [],
      error: searchPayload?.message || "Nao foi possivel listar os itens da loja no Mercado Livre.",
    }
  }

  return {
    itemIds: Array.isArray(searchPayload.results) ? searchPayload.results : [],
    paging: {
      total: Number(searchPayload?.paging?.total ?? 0) || 0,
      limit,
      offset,
    },
    error: null,
  }
}

async function loadMercadoLivreItems(itemIds, accessToken, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const items = await Promise.all(
    itemIds.map(async (itemId) => {
      const itemResponse = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/items/${encodeURIComponent(itemId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      })
      const itemPayload = await itemResponse.json().catch(() => ({}))
      return itemResponse.ok ? mapMercadoLivreItem(itemPayload) : null
    })
  )

  return items.filter(Boolean)
}

async function listMercadoLivreOrders(userId, accessToken, options = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const limit = Math.min(Math.max(Number(options.limit ?? 10) || 10, 1), 20)
  const offset = Math.max(Number(options.offset ?? 0) || 0, 0)
  const url = new URL(`${MERCADO_LIVRE_API_BASE}/orders/search`)
  url.searchParams.set("seller", userId)
  url.searchParams.set("sort", "date_desc")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))

  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      orders: [],
      paging: null,
      error: payload?.message || "Nao foi possivel listar os pedidos da loja no Mercado Livre.",
    }
  }

  return {
    orders: Array.isArray(payload.results) ? payload.results.map(mapMercadoLivreOrder) : [],
    paging: {
      total: Number(payload?.paging?.total ?? 0) || 0,
      limit,
      offset,
    },
    error: null,
  }
}

async function listMercadoLivreQuestions(userId, accessToken, options = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const limit = Math.min(Math.max(Number(options.limit ?? 10) || 10, 1), 20)
  const offset = Math.max(Number(options.offset ?? 0) || 0, 0)
  const url = new URL(`${MERCADO_LIVRE_API_BASE}/questions/search`)
  url.searchParams.set("seller_id", userId)
  url.searchParams.set("api_version", "4")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  url.searchParams.set("sort_fields", "date_created")
  url.searchParams.set("sort_types", "DESC")

  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      questions: [],
      paging: null,
      error: payload?.message || "Nao foi possivel listar as perguntas da loja no Mercado Livre.",
    }
  }

  return {
    questions: Array.isArray(payload.questions) ? payload.questions.map(mapMercadoLivreQuestion) : [],
    paging: {
      total: Number(payload?.total ?? 0) || 0,
      limit,
      offset,
    },
    error: null,
  }
}

export async function listMercadoLivreTestItemsForUser(project, user, options = {}, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { items: [], connector: null, error: "Projeto nao encontrado." }
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const connector = await getMercadoLivreConnectorByProjectId(project.id, { supabase })
    if (!connector?.id) {
      return { items: [], connector: null, error: "Salve a conexao do Mercado Livre primeiro." }
    }

    const limit = Math.min(Math.max(Number(options.limit ?? 8) || 8, 1), 12)
    return withMercadoLivreAuthorizedOperation(connector, deps, async ({ connector: resolvedConnector, accessToken }) => {
      const config = getConnectorConfig(resolvedConnector)
      const userId = sanitizeString(config.oauthUserId)

      if (!userId) {
        return { items: [], connector: resolvedConnector, error: "Conta do Mercado Livre ainda nao autorizada." }
      }

      const { itemIds, error: searchError } = await listMercadoLivreUserItemIds(userId, accessToken, { limit }, deps)
      if (searchError) {
        return {
          items: [],
          connector: resolvedConnector,
          error: searchError,
        }
      }

      const items = await loadMercadoLivreItems(itemIds.slice(0, limit), accessToken, deps)

      return {
        items,
        connector: resolvedConnector,
        error: null,
      }
    })
  } catch (error) {
    console.error("[mercado-livre] failed to list test items", error)
    return {
      items: [],
      connector: null,
      error: error instanceof Error ? error.message : "Nao foi possivel listar os itens da loja.",
    }
  }
}

export async function listMercadoLivreOrdersForUser(project, user, options = {}, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { orders: [], paging: null, connector: null, error: "Projeto nao encontrado." }
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const connector = await getMercadoLivreConnectorByProjectId(project.id, { supabase })
    if (!connector?.id) {
      return { orders: [], paging: null, connector: null, error: "Salve a conexao do Mercado Livre primeiro." }
    }

    return withMercadoLivreAuthorizedOperation(connector, deps, async ({ connector: resolvedConnector, accessToken }) => {
      const config = getConnectorConfig(resolvedConnector)
      const userId = sanitizeString(config.oauthUserId)

      if (!userId) {
        return { orders: [], paging: null, connector: resolvedConnector, error: "Conta do Mercado Livre ainda nao autorizada." }
      }

      const { orders, paging, error } = await listMercadoLivreOrders(userId, accessToken, options, deps)

      return {
        orders,
        paging,
        connector: resolvedConnector,
        error,
      }
    })
  } catch (error) {
    console.error("[mercado-livre] failed to list orders", error)
    return {
      orders: [],
      paging: null,
      connector: null,
      error: error instanceof Error ? error.message : "Nao foi possivel listar os pedidos da loja.",
    }
  }
}

export async function listMercadoLivreQuestionsForUser(project, user, options = {}, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { questions: [], paging: null, connector: null, error: "Projeto nao encontrado." }
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const connector = await getMercadoLivreConnectorByProjectId(project.id, { supabase })
    if (!connector?.id) {
      return { questions: [], paging: null, connector: null, error: "Salve a conexao do Mercado Livre primeiro." }
    }

    return withMercadoLivreAuthorizedOperation(connector, deps, async ({ connector: resolvedConnector, accessToken }) => {
      const config = getConnectorConfig(resolvedConnector)
      const userId = sanitizeString(config.oauthUserId)

      if (!userId) {
        return { questions: [], paging: null, connector: resolvedConnector, error: "Conta do Mercado Livre ainda nao autorizada." }
      }

      const { questions, paging, error } = await listMercadoLivreQuestions(userId, accessToken, options, deps)

      return {
        questions,
        paging,
        connector: resolvedConnector,
        error,
      }
    })
  } catch (error) {
    console.error("[mercado-livre] failed to list questions", error)
    return {
      questions: [],
      paging: null,
      connector: null,
      error: error instanceof Error ? error.message : "Nao foi possivel listar as perguntas da loja.",
    }
  }
}

export async function answerMercadoLivreQuestionForUser(project, user, input = {}, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { question: null, connector: null, error: "Projeto nao encontrado." }
  }

  const questionId = String(input.questionId || "").trim()
  const text = sanitizeString(input.text)

  if (!questionId || !text) {
    return { question: null, connector: null, error: "Pergunta e resposta sao obrigatorias." }
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const connector = await getMercadoLivreConnectorByProjectId(project.id, { supabase })
    if (!connector?.id) {
      return { question: null, connector: null, error: "Salve a conexao do Mercado Livre primeiro." }
    }

    return withMercadoLivreAuthorizedOperation(connector, deps, async ({ connector: resolvedConnector, accessToken }) => {
      const fetchImpl = deps.fetchImpl ?? fetch
      const response = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/answers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question_id: Number(questionId),
          text,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return {
          question: null,
          connector: resolvedConnector,
          error: payload?.message || payload?.error || "Nao foi possivel responder a pergunta no Mercado Livre.",
        }
      }

      return {
        question: mapMercadoLivreQuestion(payload),
        connector: resolvedConnector,
        error: null,
      }
    })
  } catch (error) {
    console.error("[mercado-livre] failed to answer question", error)
    return {
      question: null,
      connector: null,
      error: error instanceof Error ? error.message : "Nao foi possivel responder a pergunta da loja.",
    }
  }
}

export async function resolveMercadoLivreProductForUser(project, productUrl, user, deps = {}) {
  if (!project?.id || !userCanAccessProject(user, project.id)) {
    return { product: null, error: "Projeto nao encontrado." }
  }

  try {
    return await resolveMercadoLivreProductInternal(productUrl, deps)
  } catch (error) {
    console.error("[mercado-livre] failed to resolve product", error)
    return {
      product: null,
      error: error instanceof Error ? error.message : "Nao foi possivel resolver o produto da loja.",
    }
  }
}

export async function searchMercadoLivreProductsForProject(project, options = {}, deps = {}) {
  if (!project?.id) {
    return { items: [], connector: null, error: "Projeto nao encontrado." }
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const connector = await getMercadoLivreConnectorByProjectId(project.id, { supabase })
    if (!connector?.id) {
      return { items: [], connector: null, error: "Conector do Mercado Livre nao encontrado para este projeto." }
    }

    const requestedLimit = Math.min(Math.max(Number(options.limit ?? 3) || 3, 1), 6)
    const poolLimit = Math.min(Math.max(Number(options.poolLimit ?? 24) || 24, requestedLimit), 50)
    const offset = Math.max(Number(options.offset ?? 0) || 0, 0)
    const searchTerm = sanitizeString(options.searchTerm)
    return withMercadoLivreAuthorizedOperation(connector, deps, async ({ connector: resolvedConnector, accessToken }) => {
      const config = getConnectorConfig(resolvedConnector)
      const userId = sanitizeString(config.oauthUserId)
      if (!userId) {
        return { items: [], connector: resolvedConnector, error: "Conta do Mercado Livre ainda nao autorizada." }
      }

      const { itemIds, paging, error: searchError } = await listMercadoLivreUserItemIds(
        userId,
        accessToken,
        {
          limit: poolLimit,
          offset,
        },
        deps
      )

      if (searchError) {
        return { items: [], connector: resolvedConnector, error: searchError }
      }

      const loadedItems = await loadMercadoLivreItems(itemIds, accessToken, deps)
      const rankedItems = loadedItems
        .map((item) => ({
          ...item,
          _score: searchTerm ? scoreMercadoLivreItem(item, searchTerm) : 0,
        }))
        .filter((item) => !searchTerm || item._score > 0)
        .sort((left, right) => {
          if (right._score !== left._score) {
            return right._score - left._score
          }
          return String(left.title || "").localeCompare(String(right.title || ""), "pt-BR")
        })
        .slice(0, requestedLimit)
        .map(({ _score, ...item }) => item)

      return {
        items: rankedItems,
        connector: resolvedConnector,
        paging: {
          total: Number(paging?.total ?? 0) || 0,
          offset,
          poolLimit,
          requestedLimit,
          nextOffset: offset + poolLimit,
          hasMore: Number(paging?.total ?? 0) > offset + poolLimit,
        },
        error: null,
      }
    })
  } catch (error) {
    console.error("[mercado-livre] failed to search products", error)
    return {
      items: [],
      connector: null,
      paging: null,
      error: error instanceof Error ? error.message : "Nao foi possivel buscar produtos da loja.",
    }
  }
}
