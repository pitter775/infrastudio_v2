import "server-only"

import { normalizeAgentRuntimeConfig } from "@/lib/agent-runtime-config"
import { extractDeterministicPricingCatalogFromAgentText } from "@/lib/chat/semantic-intent-stage"
import { getOrCreateDefaultModelId } from "@/lib/modelos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const agenteFields =
  "id, slug, nome, descricao, prompt_base, configuracoes, ativo, projeto_id, modelo_id, created_at"

const agenteVersionFields =
  "id, agente_id, projeto_id, version_number, nome, descricao, prompt_base, configuracoes, ativo, source, note, created_by, created_at"

function normalizeAgentConfigurations(configuracoes) {
  return configuracoes && typeof configuracoes === "object" && !Array.isArray(configuracoes) ? { ...configuracoes } : {}
}

function pickTextField(input, primaryKey, fallbackKey = null) {
  const primaryValue = input?.[primaryKey]
  if (typeof primaryValue === "string" && primaryValue.trim()) {
    return primaryValue.trim()
  }

  if (fallbackKey) {
    const fallbackValue = input?.[fallbackKey]
    if (typeof fallbackValue === "string" && fallbackValue.trim()) {
      return fallbackValue.trim()
    }
  }

  return ""
}

function pickBooleanField(input, primaryKey, fallbackKey = null, defaultValue = true) {
  if (typeof input?.[primaryKey] === "boolean") {
    return input[primaryKey]
  }

  if (fallbackKey && typeof input?.[fallbackKey] === "boolean") {
    return input[fallbackKey]
  }

  return defaultValue
}

function mapAgent(row) {
  const configuracoes = normalizeAgentConfigurations(row.configuracoes)
  const brand = configuracoes.brand && typeof configuracoes.brand === "object" && !Array.isArray(configuracoes.brand)
    ? configuracoes.brand
    : {}
  return {
    id: row.id,
    name: row.nome?.trim() || "Agente sem nome",
    slug: row.slug?.trim() || null,
    description: row.descricao?.trim() || "",
    prompt: row.prompt_base?.trim() || "",
    configuracoes,
    logoUrl: typeof brand.logoUrl === "string" ? brand.logoUrl.trim() : "",
    siteUrl: typeof brand.siteUrl === "string" ? brand.siteUrl.trim() : "",
    runtimeConfig:
      configuracoes.runtimeConfig && typeof configuracoes.runtimeConfig === "object" && !Array.isArray(configuracoes.runtimeConfig)
        ? normalizeAgentRuntimeConfig(configuracoes.runtimeConfig)
        : null,
    active: row.ativo !== false,
    projectId: row.projeto_id ?? null,
    modelId: row.modelo_id ?? null,
    apiIds: [],
    arquivos: [],
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

function mapAgentVersion(row) {
  const configuracoes = normalizeAgentConfigurations(row.configuracoes)
  const brand = configuracoes.brand && typeof configuracoes.brand === "object" && !Array.isArray(configuracoes.brand)
    ? configuracoes.brand
    : {}
  return {
    id: row.id,
    agentId: row.agente_id,
    projectId: row.projeto_id,
    versionNumber: row.version_number,
    name: row.nome?.trim() || "Agente sem nome",
    description: row.descricao?.trim() || "",
    prompt: row.prompt_base || "",
    configuracoes,
    logoUrl: typeof brand.logoUrl === "string" ? brand.logoUrl.trim() : "",
    siteUrl: typeof brand.siteUrl === "string" ? brand.siteUrl.trim() : "",
    runtimeConfig:
      configuracoes.runtimeConfig && typeof configuracoes.runtimeConfig === "object" && !Array.isArray(configuracoes.runtimeConfig)
        ? normalizeAgentRuntimeConfig(configuracoes.runtimeConfig)
        : null,
    active: row.ativo !== false,
    source: row.source || "manual_update",
    note: row.note || "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

function isMissingAgentVersionTableError(error) {
  const message = String(error?.message || error || "")
  return error?.code === "42P01" || error?.code === "PGRST205" || /agente_versoes/i.test(message)
}

function isAgentVersionAccessError(error) {
  return error?.code === "42501"
}

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

function mergePromptPricingCatalog(runtimeConfig = null, promptBase = "") {
  const extractedPricingCatalog = extractDeterministicPricingCatalogFromAgentText(promptBase)
  if (!extractedPricingCatalog?.enabled || !Array.isArray(extractedPricingCatalog.items) || extractedPricingCatalog.items.length < 2) {
    return runtimeConfig
  }

  return {
    ...(runtimeConfig ?? {}),
    pricingCatalog: {
      ...(runtimeConfig?.pricingCatalog ?? {}),
      ...extractedPricingCatalog,
      ctaSingle: runtimeConfig?.pricingCatalog?.ctaSingle ?? extractedPricingCatalog.ctaSingle,
      ctaMultiple: runtimeConfig?.pricingCatalog?.ctaMultiple ?? extractedPricingCatalog.ctaMultiple,
    },
  }
}

function normalizeAgentUpdate(input, currentConfiguracoes = {}) {
  const hasExplicitConfiguracoes = Object.prototype.hasOwnProperty.call(input, "configuracoes")
  const configuracoes = hasExplicitConfiguracoes
    ? normalizeAgentConfigurations(input.configuracoes)
    : normalizeAgentConfigurations(currentConfiguracoes)
  const promptBase = pickTextField(input, "prompt", "promptBase")

  if (Object.prototype.hasOwnProperty.call(input, "runtimeConfig")) {
    const normalizedRuntimeConfig = normalizeAgentRuntimeConfig(input.runtimeConfig)
    if (normalizedRuntimeConfig) {
      configuracoes.runtimeConfig = mergePromptPricingCatalog(normalizedRuntimeConfig, promptBase)
    } else {
      delete configuracoes.runtimeConfig
    }
  } else if (configuracoes.runtimeConfig) {
    configuracoes.runtimeConfig = mergePromptPricingCatalog(configuracoes.runtimeConfig, promptBase)
  }

  return {
    nome: pickTextField(input, "name", "nome"),
    descricao: pickTextField(input, "description", "descricao"),
    prompt_base: promptBase,
    configuracoes,
    ativo: pickBooleanField(input, "active", "ativo", true),
    updated_at: new Date().toISOString(),
  }
}

function slugifyAgent(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

async function buildUniqueAgentSlug(supabase, name, projectId) {
  const baseSlug = slugifyAgent(name) || "agente"
  let slug = baseSlug
  let index = 2

  while (true) {
    const { data, error } = await supabase
      .from("agentes")
      .select("id")
      .eq("projeto_id", projectId)
      .eq("slug", slug)
      .limit(1)

    if (error) {
      console.error("[agentes] failed to validate slug", error)
      return slug
    }

    if (!data?.length) {
      return slug
    }

    slug = `${baseSlug}-${index}`
    index += 1
  }
}

function buildDefaultPrompt({ projectName, businessContext }) {
  const context = String(businessContext || "").trim()

  return [
    `Voce e o agente de atendimento comercial de ${projectName || "este projeto"}.`,
    "",
    "Objetivo:",
    "- entender a necessidade do visitante",
    "- responder com clareza e objetividade",
    "- qualificar o lead sem pedir dados cedo demais",
    "- conduzir para o proximo passo quando fizer sentido",
    "",
    "Regras:",
    "- nao invente informacoes",
    "- se faltar dado importante, diga que precisa confirmar",
    "- mantenha tom consultivo, direto e humano",
    "- evite prometer preco, prazo ou disponibilidade sem fonte confiavel",
    context ? `\nContexto informado pelo usuario:\n${context}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

async function getNextAgentVersionNumber(supabase, agenteId) {
  const { data, error } = await supabase
    .from("agente_versoes")
    .select("version_number")
    .eq("agente_id", agenteId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Number(data?.version_number ?? 0) + 1
}

async function createAgentVersionSnapshot(supabase, agentRow, input = {}) {
  if (!agentRow?.id || !agentRow?.projeto_id) {
    return null
  }

  const versionNumber = await getNextAgentVersionNumber(supabase, agentRow.id)
  const { data, error } = await supabase
    .from("agente_versoes")
    .insert({
      agente_id: agentRow.id,
      projeto_id: agentRow.projeto_id,
      version_number: versionNumber,
      nome: agentRow.nome ?? null,
      descricao: agentRow.descricao ?? null,
      prompt_base: agentRow.prompt_base ?? null,
      configuracoes: normalizeAgentConfigurations(agentRow.configuracoes),
      ativo: agentRow.ativo !== false,
      source: input.source || "manual_update",
      note: input.note || null,
      created_by: input.userId ?? null,
    })
    .select(agenteVersionFields)
    .maybeSingle()

  if (error) {
    throw error
  }

  try {
    await pruneAgentVersionSnapshots(supabase, agentRow.id, agentRow.projeto_id, 3)
  } catch (pruneError) {
    console.error("[agentes] failed to prune agent versions", pruneError)
  }

  return data ? mapAgentVersion(data) : null
}

async function pruneAgentVersionSnapshots(supabase, agenteId, projetoId, keep = 3) {
  if (!agenteId || !projetoId || keep < 1) {
    return
  }

  const { data, error } = await supabase
    .from("agente_versoes")
    .select("id")
    .eq("agente_id", agenteId)
    .eq("projeto_id", projetoId)
    .order("version_number", { ascending: false })

  if (error) {
    throw error
  }

  const removableIds = (data ?? []).slice(keep).map((item) => item?.id).filter(Boolean)
  if (!removableIds.length) {
    return
  }

  const { error: deleteError } = await supabase
    .from("agente_versoes")
    .delete()
    .in("id", removableIds)

  if (deleteError) {
    throw deleteError
  }
}

export async function listAgentVersionsForUser({ agenteId, projetoId, limit = 12 }, user) {
  if (!agenteId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return []
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agente_versoes")
      .select(agenteVersionFields)
      .eq("agente_id", agenteId)
      .eq("projeto_id", projetoId)
      .order("version_number", { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 12, 1), 50))

    if (error) {
      if (isMissingAgentVersionTableError(error) || isAgentVersionAccessError(error)) {
        return []
      }
      console.error("[agentes] failed to list agent versions", error)
      return []
    }

    return (data ?? []).map(mapAgentVersion)
  } catch (error) {
    console.error("[agentes] failed to list agent versions", error)
    return []
  }
}

export async function getAgenteAtivo(projetoId) {
  if (!projetoId) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agentes")
      .select(agenteFields)
      .eq("projeto_id", projetoId)
      .eq("ativo", true)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to get active agent", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to get active agent", error)
    return null
  }
}

export async function getAgenteById(id) {
  if (!id) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("agentes")
      .select(agenteFields)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to get agent by id", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to get agent by id", error)
    return null
  }
}

export async function getAgenteByIdentifier(identifier, projetoId) {
  const value = String(identifier || "").trim()
  if (!value) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    let slugQuery = supabase
      .from("agentes")
      .select(agenteFields)
      .eq("slug", value)
      .limit(1)

    if (projetoId) {
      slugQuery = slugQuery.eq("projeto_id", projetoId)
    }

    const { data: slugData, error: slugError } = await slugQuery.maybeSingle()
    if (slugData) {
      return mapAgent(slugData)
    }
    if (slugError) {
      console.error("[agentes] failed to get agent by slug", slugError)
    }

    const byId = await getAgenteById(value)
    if (!byId) {
      return null
    }

    if (projetoId && byId.projectId !== projetoId) {
      return null
    }

    return byId
  } catch (error) {
    console.error("[agentes] failed to get agent by identifier", error)
    return null
  }
}

export async function createDefaultAgenteForUser({ projetoId, projectName, nome, descricao, businessContext }, user) {
  if (!projetoId || !userCanAccessProject(user, projetoId)) {
    return null
  }

  const agentName = String(nome || projectName || "Agente comercial").trim()
  const promptBase = buildDefaultPrompt({
    projectName: projectName || agentName,
    businessContext: businessContext || descricao,
  })

  try {
    const supabase = getSupabaseAdminClient()
    const slug = await buildUniqueAgentSlug(supabase, agentName, projetoId)
    const now = new Date().toISOString()
    const defaultModelId = await getOrCreateDefaultModelId({ supabase })

    const { data: existingAgent, error: existingAgentError } = await supabase
      .from("agentes")
      .select("id")
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (existingAgentError) {
      console.error("[agentes] failed to read project agent before create", existingAgentError)
      return null
    }

    const payload = {
      projeto_id: projetoId,
      nome: agentName,
      slug,
      descricao: String(descricao || businessContext || "").trim(),
      modelo_id: defaultModelId,
      prompt_base: promptBase,
      configuracoes: {},
      ativo: true,
      updated_at: now,
    }

    const query = existingAgent?.id
      ? supabase.from("agentes").update(payload).eq("id", existingAgent.id)
      : supabase.from("agentes").insert({ ...payload, created_at: now })

    const { data, error } = await query.select(agenteFields).maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to save default agent", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to create default agent", error)
    return null
  }
}

export async function updateAgenteForUser(input, user) {
  const {
    agenteId,
    projetoId,
    nome,
    name,
    descricao,
    description,
    promptBase,
    prompt,
    ativo,
    active,
    runtimeConfig,
    configuracoes,
  } = input || {}

  if (!agenteId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: currentAgent, error: currentAgentError } = await supabase
      .from("agentes")
      .select(agenteFields)
      .eq("id", agenteId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (currentAgentError || !currentAgent) {
      if (currentAgentError) {
        console.error("[agentes] failed to read agent before update", currentAgentError)
      }
      return null
    }

    const payload = normalizeAgentUpdate(
      { nome, name, descricao, description, promptBase, prompt, ativo, active, runtimeConfig, configuracoes },
      currentAgent.configuracoes,
    )

    if (!payload.nome || !payload.prompt_base) {
      return null
    }

    try {
      await createAgentVersionSnapshot(supabase, currentAgent, {
        source: "manual_update",
        note: "Snapshot antes de salvar alteracoes do agente.",
        userId: user?.id ?? null,
      })
    } catch (versionError) {
      if (isMissingAgentVersionTableError(versionError)) {
      } else if (isAgentVersionAccessError(versionError)) {
      } else {
        console.error("[agentes] failed to create agent version", versionError)
        return null
      }
    }

    if (payload.ativo) {
      const { error: deactivateError } = await supabase
        .from("agentes")
        .update({ ativo: false, updated_at: payload.updated_at })
        .eq("projeto_id", projetoId)
        .neq("id", agenteId)

      if (deactivateError) {
        console.error("[agentes] failed to deactivate sibling agents", deactivateError)
        return null
      }
    }

    const { data, error } = await supabase
      .from("agentes")
      .update(payload)
      .eq("id", agenteId)
      .eq("projeto_id", projetoId)
      .select(agenteFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to update agent", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to update agent", error)
    return null
  }
}

export async function restoreAgentVersionForUser({ agenteId, projetoId, versionId }, user) {
  if (!agenteId || !projetoId || !versionId || !userCanAccessProject(user, projetoId)) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const [{ data: currentAgent, error: currentAgentError }, { data: version, error: versionError }] = await Promise.all([
      supabase.from("agentes").select(agenteFields).eq("id", agenteId).eq("projeto_id", projetoId).maybeSingle(),
      supabase
        .from("agente_versoes")
        .select(agenteVersionFields)
        .eq("id", versionId)
        .eq("agente_id", agenteId)
        .eq("projeto_id", projetoId)
        .maybeSingle(),
    ])

    if (currentAgentError || versionError || !currentAgent || !version) {
      if (currentAgentError) console.error("[agentes] failed to read agent before restore", currentAgentError)
      if (versionError) console.error("[agentes] failed to read agent version", versionError)
      return null
    }

    try {
      await createAgentVersionSnapshot(supabase, currentAgent, {
        source: "rollback",
        note: `Snapshot antes de restaurar versao ${version.version_number}.`,
        userId: user?.id ?? null,
      })
    } catch (snapshotError) {
      console.error("[agentes] failed to create rollback snapshot", snapshotError)
      return null
    }

    const { data, error } = await supabase
      .from("agentes")
      .update({
        nome: version.nome,
        descricao: version.descricao,
        prompt_base: version.prompt_base,
        configuracoes: normalizeAgentConfigurations(version.configuracoes),
        ativo: version.ativo !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agenteId)
      .eq("projeto_id", projetoId)
      .select(agenteFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to restore agent version", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to restore agent version", error)
    return null
  }
}

export async function updateAgentBrandingForUser({ agenteId, projetoId, siteUrl, logoUrl }, user) {
  if (!agenteId || !projetoId || !userCanAccessProject(user, projetoId)) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data: currentAgent, error: currentAgentError } = await supabase
      .from("agentes")
      .select(agenteFields)
      .eq("id", agenteId)
      .eq("projeto_id", projetoId)
      .maybeSingle()

    if (currentAgentError || !currentAgent) {
      if (currentAgentError) {
        console.error("[agentes] failed to read agent before branding update", currentAgentError)
      }
      return null
    }

    const currentConfig = normalizeAgentConfigurations(currentAgent.configuracoes)
    const currentBrand =
      currentConfig.brand && typeof currentConfig.brand === "object" && !Array.isArray(currentConfig.brand)
        ? currentConfig.brand
        : {}

    const nextConfig = {
      ...currentConfig,
      brand: {
        ...currentBrand,
        siteUrl: String(siteUrl || "").trim(),
        logoUrl: String(logoUrl || "").trim(),
      },
    }

    const { data, error } = await supabase
      .from("agentes")
      .update({
        configuracoes: nextConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agenteId)
      .eq("projeto_id", projetoId)
      .select(agenteFields)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[agentes] failed to update agent branding", error)
      }
      return null
    }

    return mapAgent(data)
  } catch (error) {
    console.error("[agentes] failed to update agent branding", error)
    return null
  }
}
