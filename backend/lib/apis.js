import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const apiFields =
  "id, projeto_id, nome, url, metodo, descricao, ativo, configuracoes, created_at, updated_at"

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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

  return {
    payload: {
      nome: name,
      url: url.toString(),
      metodo: method,
      descricao: String(input.descricao || input.description || "").trim(),
      ativo: input.ativo === false || input.active === false ? false : true,
      configuracoes:
        input.configuracoes && typeof input.configuracoes === "object"
          ? input.configuracoes
          : input.config && typeof input.config === "object"
            ? input.config
            : {},
      updated_at: new Date().toISOString(),
    },
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

    return data.map(mapApi)
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

    return { api: mapApi(data), error: null }
  } catch (error) {
    console.error("[apis] failed to update api", error)
    return { api: null, error: "Nao foi possivel atualizar a API." }
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
        headers: {
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        },
      })
      const contentType = response.headers.get("content-type") || ""
      const text = await response.text()

      return {
        result: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          durationMs: Date.now() - startedAt,
          contentType,
          preview: text.slice(0, 800),
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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(api.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
    })
    const contentType = response.headers.get("content-type") || ""
    const text = await response.text()

    return {
      id: api.id,
      nome: api.name,
      descricao: api.description,
      url: api.url,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      contentType,
      preview: text.slice(0, 1200),
    }
  } catch (error) {
    return {
      id: api.id,
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
      .select(`api_id, apis!inner(${apiFields})`)
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
