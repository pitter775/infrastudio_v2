import "server-only"

import { SignJWT, jwtVerify } from "jose"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const CONNECTOR_FIELDS =
  "id, projeto_id, agente_id, slug, nome, tipo, descricao, endpoint_base, metodo_auth, configuracoes, ativo, created_at, updated_at"

const MERCADO_LIVRE_SLUG = "mercado-livre"
const MERCADO_LIVRE_TYPE = "mercado_livre"
const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com"
const MERCADO_LIVRE_AUTH_BASE = "https://auth.mercadolivre.com.br"
const MERCADO_LIVRE_RESOLVE_MAX_ATTEMPTS = 4
const MERCADO_LIVRE_RESOLVE_DELAY_MS = 1500

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractMercadoLivreProductId(value) {
  const normalized = sanitizeString(value)
  const match = normalized.match(/MLB-?(\d+)/i)
  return match ? `MLB${match[1]}` : ""
}

function detectMercadoLivreSourceType(value) {
  const normalized = sanitizeString(value).toLowerCase()
  if (normalized.includes("/pagina/")) {
    return "store_page"
  }
  if (extractMercadoLivreProductId(normalized)) {
    return "product_page"
  }
  return "unknown"
}

function extractMercadoLivreSellerId(value) {
  const normalized = sanitizeString(value)
  const patterns = [
    /(?:seller_id|sellerId|official_store_id)=([^&]+)/i,
    /"seller_id"\s*:\s*"?(?<value>\d+)"?/i,
    /"sellerId"\s*:\s*"?(?<value>\d+)"?/i,
    /"official_store_id"\s*:\s*"?(?<value>\d+)"?/i,
    /seller_id["'\s:=]+(\d+)/i,
    /sellerId["'\s:=]+(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = sanitizeString(match?.groups?.value || match?.[1])
    if (candidate) {
      return candidate
    }
  }

  return ""
}

function extractMercadoLivreStoreName(value) {
  const normalized = sanitizeString(value)
  const patterns = [
    /"shop_name"\s*:\s*"(?<value>[^"]+)"/i,
    /"seller_name"\s*:\s*"(?<value>[^"]+)"/i,
    /<meta\s+name="title"\s+content="(?<value>[^"]+?)\s+em\s+Mercado\s+Livre"/i,
    /<meta\s+property="og:title"\s+content="(?<value>[^"]+?)\s+em\s+Mercado\s+Livre"/i,
    /<title[^>]*>(?<value>[^<|]+?)\s+\|\s+P[aá]gina do vendedor<\/title>/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const candidate = sanitizeString(match?.groups?.value || match?.[1])
    if (candidate) {
      return candidate
    }
  }

  return ""
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

  if (accessToken && expiresAt) {
    const expiresMs = new Date(expiresAt).getTime()
    if (Number.isFinite(expiresMs) && expiresMs - Date.now() > 60_000) {
      return { connector, accessToken }
    }
  }

  if (accessToken && !expiresAt) {
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

function mapMercadoLivreItem(payload) {
  return {
    id: sanitizeString(payload?.id),
    title: sanitizeString(payload?.title),
    price: Number(payload?.price ?? 0),
    currencyId: sanitizeString(payload?.currency_id),
    availableQuantity: Number(payload?.available_quantity ?? 0),
    status: sanitizeString(payload?.status),
    permalink: sanitizeString(payload?.permalink),
    thumbnail: sanitizeString(payload?.thumbnail),
  }
}

function mapMercadoLivreResolvedProduct(payload, fallback = {}) {
  return {
    seedId: sanitizeString(payload?.seller_id || payload?.sellerId || payload?.official_store_id || fallback.seedId),
    productId: sanitizeString(payload?.id || fallback.productId),
    storeName: sanitizeString(payload?.seller_custom_field || payload?.seller_name || payload?.nickname || fallback.storeName),
    title: sanitizeString(payload?.title || fallback.title),
    permalink: sanitizeString(payload?.permalink || fallback.permalink),
    sourceType: sanitizeString(fallback.sourceType || "unknown"),
    source: sanitizeString(fallback.source || "api"),
  }
}

async function fetchMercadoLivrePublicItem(itemId, fetchImpl = fetch) {
  const response = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/items/${encodeURIComponent(itemId)}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.id) {
    return null
  }

  return payload
}

async function fetchMercadoLivrePageSource(productUrl, fetchImpl = fetch) {
  const response = await fetchImpl(productUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return ""
  }

  return response.text().catch(() => "")
}

async function resolveMercadoLivreProductInternal(productUrl, deps = {}) {
  const normalizedUrl = sanitizeString(productUrl)
  if (!normalizedUrl) {
    return { product: null, error: "Cole a URL de um produto da loja." }
  }

  const fetchImpl = deps.fetchImpl ?? fetch
  const sellerIdFromUrl = extractMercadoLivreSellerId(normalizedUrl)
  const productId = extractMercadoLivreProductId(normalizedUrl)
  const sourceType = detectMercadoLivreSourceType(normalizedUrl)
  let pageSource = ""

  async function getPageSource() {
    if (!pageSource) {
      pageSource = await fetchMercadoLivrePageSource(normalizedUrl, fetchImpl)
    }
    return pageSource
  }

  if (productId) {
    const itemPayload = await fetchMercadoLivrePublicItem(productId, fetchImpl)
    const initialStoreName = extractMercadoLivreStoreName(await getPageSource())
    const resolvedFromApi = mapMercadoLivreResolvedProduct(itemPayload, {
      seedId: sellerIdFromUrl,
      productId,
      storeName: initialStoreName,
      permalink: normalizedUrl,
      sourceType,
      source: initialStoreName ? "api_html" : "api",
    })

    if (resolvedFromApi.seedId) {
      return { product: resolvedFromApi, error: null }
    }
  }

  if (sellerIdFromUrl) {
    const storeName = extractMercadoLivreStoreName(await getPageSource())
    return {
      product: {
        seedId: sellerIdFromUrl,
        productId,
        storeName,
        title: "",
        permalink: normalizedUrl,
        sourceType,
        source: storeName ? "url_html" : "url",
      },
      error: null,
    }
  }

  for (let attempt = 0; attempt < MERCADO_LIVRE_RESOLVE_MAX_ATTEMPTS; attempt += 1) {
    const source =
      attempt === 0 && pageSource
        ? pageSource
        : await fetchMercadoLivrePageSource(normalizedUrl, fetchImpl)
    if (!pageSource && source) {
      pageSource = source
    }
    const sellerId = extractMercadoLivreSellerId(source)
    const storeName = extractMercadoLivreStoreName(source)

    if (sellerId || storeName) {
      return {
        product: {
          seedId: sellerId,
          productId: extractMercadoLivreProductId(source) || productId,
          storeName,
          title: "",
          permalink: normalizedUrl,
          sourceType,
          source: attempt === 0 ? "html" : "html_retry",
        },
        error: null,
      }
    }

    if (attempt < MERCADO_LIVRE_RESOLVE_MAX_ATTEMPTS - 1) {
      await sleep(MERCADO_LIVRE_RESOLVE_DELAY_MS)
    }
  }

  return {
    product: {
      seedId: "",
      productId,
      storeName: "",
      title: "",
      permalink: normalizedUrl,
      sourceType,
      source: "",
    },
    error: "Nao foi possivel localizar o seller_id automaticamente. Preencha manualmente.",
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

    const { connector: resolvedConnector, accessToken } = await ensureMercadoLivreAccessToken(connector, deps)
    const config = getConnectorConfig(resolvedConnector)
    const userId = sanitizeString(config.oauthUserId)

    if (!userId) {
      return { items: [], connector: resolvedConnector, error: "Conta do Mercado Livre ainda nao autorizada." }
    }

    const limit = Math.min(Math.max(Number(options.limit ?? 8) || 8, 1), 12)
    const fetchImpl = deps.fetchImpl ?? fetch
    const searchResponse = await fetchImpl(`${MERCADO_LIVRE_API_BASE}/users/${encodeURIComponent(userId)}/items/search?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    })

    const searchPayload = await searchResponse.json().catch(() => ({}))
    if (!searchResponse.ok) {
      return {
        items: [],
        connector: resolvedConnector,
        error: searchPayload?.message || "Nao foi possivel listar os itens da loja no Mercado Livre.",
      }
    }

    const itemIds = Array.isArray(searchPayload.results) ? searchPayload.results.slice(0, limit) : []
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
      }),
    )

    return {
      items: items.filter(Boolean),
      connector: resolvedConnector,
      error: null,
    }
  } catch (error) {
    console.error("[mercado-livre] failed to list test items", error)
    return {
      items: [],
      connector: null,
      error: error instanceof Error ? error.message : "Nao foi possivel listar os itens da loja.",
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
