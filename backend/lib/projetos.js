import "server-only"

import { createDefaultAgenteForUser, listAgentVersionsForUser } from "@/lib/agentes"
import { listAgentApiIdsForUser } from "@/lib/apis"
import { getProjectBillingSnapshot } from "@/lib/billing"
import { ensureDefaultChatWidgetForAgent, ensureProjectHasDefaultWidget, listChatWidgetsForUser } from "@/lib/chat-widgets"
import { createLogEntry } from "@/lib/logs"
import { getOrCreateDefaultModelId } from "@/lib/modelos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { applyInitialFreePlan } from "@/lib/usuario-project-bootstrap"
import { listWhatsAppChannelsForUser } from "@/lib/whatsapp-channels"

const projetoFields =
  "id, nome, tipo, descricao, status, slug, configuracoes, created_at, updated_at, is_demo, owner_user_id, owner:usuarios!projetos_owner_user_id_fkey(id, nome, email, avatar_url, role)"
const projetoAccessFields =
  "id, nome, tipo, descricao, status, slug, configuracoes, created_at, updated_at, is_demo"

function normalizeProject(row) {
  const slug = row.slug?.trim() || row.id
  const brand =
    row.configuracoes?.brand && typeof row.configuracoes.brand === "object" && !Array.isArray(row.configuracoes.brand)
      ? row.configuracoes.brand
      : {}

  return {
    id: row.id,
    name: row.nome?.trim() || "Projeto sem nome",
    slug,
    routeKey: buildProjectRouteKey({ id: row.id, slug }),
    type: row.tipo?.trim() || "Projeto",
    description: row.descricao?.trim() || "Sem descricao cadastrada.",
    status: row.status?.trim() || "ativo",
    isDemo: Boolean(row.is_demo),
    logoUrl: typeof brand.logoUrl === "string" ? brand.logoUrl.trim() : "",
    siteUrl: typeof brand.siteUrl === "string" ? brand.siteUrl.trim() : "",
    owner: row.owner
      ? {
          id: row.owner.id,
        name: row.owner.nome?.trim() || row.owner.email?.trim() || "Usuario",
        email: row.owner.email?.trim() || "",
        avatarUrl: row.owner.avatar_url || null,
        role: row.owner.role === "admin" ? "admin" : "viewer",
      }
      : null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

function slugifyProjectName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function buildProjectRouteKey(project) {
  const slug = slugifyProjectName(project?.slug || "") || "projeto"
  return `${slug}--${project?.id}`
}

async function buildUniqueProjectSlug(supabase, name, currentProjectId = null) {
  const baseSlug = slugifyProjectName(name) || "projeto"
  let slug = baseSlug
  let index = 2

  while (true) {
    let query = supabase.from("projetos").select("id").eq("slug", slug).limit(1)

    if (currentProjectId) {
      query = query.neq("id", currentProjectId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[projetos] failed to validate slug", error)
      return slug
    }

    if (!data?.length) {
      return slug
    }

    slug = `${baseSlug}-${index}`
    index += 1
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function extractProjectLookup(identifier) {
  const value = String(identifier || "").trim()

  if (!value) {
    return { id: null, slug: null }
  }

  if (isUuid(value)) {
    return { id: value, slug: null }
  }

  const uuidMatch = value.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  )

  if (uuidMatch) {
    return {
      id: uuidMatch[1],
      slug: value.slice(0, uuidMatch.index).replace(/-+$/, "") || null,
    }
  }

  return { id: null, slug: value }
}

function userCanAccessProject(user, projectId) {
  if (user?.role === "admin") {
    return true
  }

  return user?.memberships?.some((item) => item.projetoId === projectId) ?? false
}

async function userCanManageProject(user, projectId, supabase = getSupabaseAdminClient()) {
  if (!user || !projectId) {
    return false
  }

  if (user.role === "admin") {
    return true
  }

  const { data, error } = await supabase
    .from("projetos")
    .select("id, owner_user_id")
    .eq("id", projectId)
    .maybeSingle()

  if (error || !data) {
    if (error) {
      console.error("[projetos] failed to validate project manager", error)
    }
    return false
  }

  return data.owner_user_id === user.id
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
    .select("id, nome, descricao, prompt_base, ativo, slug, configuracoes")
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
    configuracoes: data.configuracoes && typeof data.configuracoes === "object" ? data.configuracoes : {},
    logoUrl:
      data.configuracoes?.brand && typeof data.configuracoes.brand.logoUrl === "string"
        ? data.configuracoes.brand.logoUrl.trim()
        : "",
    siteUrl:
      data.configuracoes?.brand && typeof data.configuracoes.brand.siteUrl === "string"
        ? data.configuracoes.brand.siteUrl.trim()
        : "",
    runtimeConfig:
      data.configuracoes?.runtimeConfig && typeof data.configuracoes.runtimeConfig === "object"
        ? data.configuracoes.runtimeConfig
        : null,
  }
}

async function countAgentScopedRows(supabase, table, projectId, agenteId) {
  if (!projectId || !agenteId) {
    return 0
  }

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projectId)
    .eq("agente_id", agenteId)

  if (error) {
    console.error(`[projetos] failed to count scoped ${table}`, error)
    return 0
  }

  return count ?? 0
}

async function countMercadoLivreConnectors(supabase, projectId, agenteId = null) {
  if (!projectId) {
    return 0
  }

  let query = supabase
    .from("conectores")
    .select("id, slug, tipo, nome, ativo, agente_id")
    .eq("projeto_id", projectId)
    .eq("ativo", true)

  if (agenteId) {
    query = query.or(`agente_id.eq.${agenteId},agente_id.is.null`)
  }

  const { data, error } = await query

  if (error) {
    console.error("[projetos] failed to count mercado livre connectors", error)
    return 0
  }

  const total = (data ?? []).filter((connector) => {
    const value = `${connector.slug || ""} ${connector.tipo || ""} ${connector.nome || ""}`.toLowerCase()
    return value.includes("mercado") || value.includes("ml")
  }).length

  return total > 0 ? 1 : 0
}

async function buildAgentDirectConnections({ supabase, projectId, agent, apiCount, whatsappCount, widgetCount }) {
  if (!agent?.id) {
    return {
      apis: apiCount ?? 0,
      whatsapp: whatsappCount ?? 0,
      chatWidget: widgetCount ?? 0,
      mercadoLivre: 0,
    }
  }

  const [linkedApiIds, scopedWidgetCount, mercadoLivreCount] = await Promise.all([
    listAgentApiIdsForUser(agent.id, projectId, { role: "admin" }),
    countAgentScopedRows(supabase, "chat_widgets", projectId, agent.id),
    countMercadoLivreConnectors(supabase, projectId, agent.id),
  ])

  return {
    apis: linkedApiIds.length,
    whatsapp: whatsappCount ?? 0,
    chatWidget: scopedWidgetCount,
    mercadoLivre: mercadoLivreCount,
  }
}

async function enrichProjectSummary(supabase, project, user) {
  const [agent, apiCount, rawWhatsappCount, rawWidgetCount, billing] = await Promise.all([
    getActiveAgent(supabase, project.id),
    safeCount(supabase, "apis", project.id),
    safeCount(supabase, "canais_whatsapp", project.id),
    safeCount(supabase, "chat_widgets", project.id),
    getProjectBillingSnapshot(project.id, {
      supabase,
      user,
    }),
  ])
  const whatsappCount = rawWhatsappCount > 0 ? 1 : 0
  const widgetCount = rawWidgetCount > 0 ? 1 : 0

  const directConnections = await buildAgentDirectConnections({
    supabase,
    projectId: project.id,
    agent,
    apiCount,
    whatsappCount,
    widgetCount,
  })

  return {
    ...project,
    agent,
    logoUrl: project.logoUrl || agent?.logoUrl || "",
    integrations: {
      apis: apiCount,
      whatsapp: whatsappCount,
      chatWidget: widgetCount,
    },
    directConnections,
    billing,
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

    return Promise.all(data.map((row) => enrichProjectSummary(supabase, normalizeProject(row), user)))
  } catch (error) {
    console.error("[projetos] failed to list projects", error)
    return []
  }
}

function sanitizeProjectPayload(input) {
  return {
    nome: String(input.nome || "").trim(),
    tipo: String(input.tipo || "Projeto").trim() || "Projeto",
    descricao: String(input.descricao || "").trim() || null,
    status: input.status === "inativo" ? "inativo" : "ativo",
    updated_at: new Date().toISOString(),
  }
}

async function createProjectMembership(supabase, { usuarioId, projetoId, papel = "viewer" }) {
  if (!usuarioId || !projetoId) {
    return { ok: false, error: new Error("Usuario e projeto sao obrigatorios.") }
  }

  const { error } = await supabase.from("usuarios_projetos").insert({
    usuario_id: usuarioId,
    projeto_id: projetoId,
    papel: papel === "admin" ? "admin" : "viewer",
    created_at: new Date().toISOString(),
  })

  if (error) {
    return { ok: false, error }
  }

  return { ok: true }
}

async function createInitialProjectBilling(supabase, projectId, user) {
  const now = new Date().toISOString()
  try {
    if (user?.role === "admin") {
      const { error } = await supabase.from("projetos_planos").insert({
        projeto_id: projectId,
        nome_plano: "Admin",
        modelo_referencia: "gpt-4o-mini",
        limite_tokens_input_mensal: null,
        limite_tokens_output_mensal: null,
        limite_tokens_total_mensal: null,
        limite_custo_mensal: null,
        auto_bloquear: false,
        bloqueado: false,
        bloqueado_motivo: null,
        observacoes: "Projeto admin criado com acesso liberado.",
        plano_id: null,
        created_at: now,
        updated_at: now,
      })

      if (error) {
        return { ok: false, error }
      }

      return { ok: true }
    }

    await applyInitialFreePlan({
      supabase,
      projetoId: projectId,
      now,
    })

    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

function buildProjectBootstrapUser(user, projectId) {
  if (user?.role === "admin") {
    return user
  }

  const memberships = Array.isArray(user?.memberships) ? user.memberships : []
  const hasMembership = memberships.some((item) => item.projetoId === projectId)

  return {
    ...user,
    memberships: hasMembership
      ? memberships
      : [
          ...memberships,
          {
            projetoId: projectId,
            papel: "viewer",
          },
        ],
  }
}

async function rollbackNewProjectBootstrap(supabase, projectId) {
  if (!projectId) {
    return
  }

  await supabase.from("chat_widgets").delete().eq("projeto_id", projectId)
  await supabase.from("agentes").delete().eq("projeto_id", projectId)
  await supabase.from("projetos_assinaturas").delete().eq("projeto_id", projectId)
  await supabase.from("projetos_planos").delete().eq("projeto_id", projectId)
  await supabase.from("usuarios_projetos").delete().eq("projeto_id", projectId)
  await supabase.from("projetos").delete().eq("id", projectId)
}

async function createInitialProjectAgentAndWidget(project, user) {
  const bootstrapUser = buildProjectBootstrapUser(user, project.id)
  const agent = await createDefaultAgenteForUser(
    {
      projetoId: project.id,
      projectName: project.name,
      nome: `${project.name} Assistente`,
      descricao: project.description,
      businessContext: project.description,
    },
    bootstrapUser,
  )

  if (!agent) {
    return { ok: false, error: "Nao foi possivel criar o agente padrao." }
  }

  const { widget, error } = await ensureDefaultChatWidgetForAgent({ ...project, agent }, agent, bootstrapUser)

  if (error || !widget) {
    return { ok: false, error: error || "Nao foi possivel criar o chat widget padrao." }
  }

  return { ok: true, agent, widget }
}

export async function createProject(input, user) {
  const payload = sanitizeProjectPayload(input)

  if (!payload.nome) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const defaultModelId = await getOrCreateDefaultModelId({ supabase })
  const slug = await buildUniqueProjectSlug(supabase, input.slug || payload.nome)
  const ownerUserId = user?.id ?? null
  const { data, error } = await supabase
    .from("projetos")
    .insert({
      ...payload,
      slug,
      configuracoes: {},
      modelo_id: defaultModelId,
      owner_user_id: ownerUserId,
      is_demo: false,
      created_at: new Date().toISOString(),
    })
    .select(projetoFields)
    .single()

  if (error || !data) {
    console.error("[projetos] failed to create project", error)
    return null
  }

  const membershipResult = await createProjectMembership(supabase, {
    usuarioId: ownerUserId,
    projetoId: data.id,
    papel: user?.role === "admin" ? "admin" : "viewer",
  })

  if (!membershipResult.ok) {
    console.error("[projetos] failed to create project membership", membershipResult.error)
    await supabase.from("projetos").delete().eq("id", data.id)
    return null
  }

  const billingResult = await createInitialProjectBilling(supabase, data.id, user)

  if (!billingResult.ok) {
    console.error("[projetos] failed to create initial billing", billingResult.error)
    await rollbackNewProjectBootstrap(supabase, data.id)
    return null
  }

  const project = normalizeProject(data)
  const bootstrapResult = await createInitialProjectAgentAndWidget(project, user)

  if (!bootstrapResult.ok) {
    console.error("[projetos] failed to create initial agent/widget", bootstrapResult.error)
    await rollbackNewProjectBootstrap(supabase, data.id)
    return null
  }

  return {
    ...project,
    agent: bootstrapResult.agent,
    chatWidgets: [bootstrapResult.widget],
  }
}

export async function updateProject(input) {
  if (!input.id) {
    return null
  }

  const payload = sanitizeProjectPayload(input)

  if (!payload.nome) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const slug = await buildUniqueProjectSlug(supabase, input.slug || payload.nome, input.id)
  const { data, error } = await supabase
    .from("projetos")
    .update({ ...payload, slug })
    .eq("id", input.id)
    .select(projetoFields)
    .single()

  if (error || !data) {
    console.error("[projetos] failed to update project", error)
    return null
  }

  return normalizeProject(data)
}

export async function transferProjectOwnership({ projectId, targetUserId }) {
  if (!projectId || !targetUserId) {
    return null
  }

  const supabase = getSupabaseAdminClient()
  const [projectResult, targetUserResult, billingResult, membershipResult] = await Promise.all([
    supabase
      .from("projetos")
      .select("id, nome, owner_user_id")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, role")
      .eq("id", targetUserId)
      .maybeSingle(),
    supabase
      .from("projetos_planos")
      .select(
        "id, plano_id, nome_plano, bloqueado, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal",
      )
      .eq("projeto_id", projectId)
      .maybeSingle(),
    supabase
      .from("usuarios_projetos")
      .select("id")
      .eq("usuario_id", targetUserId)
      .eq("projeto_id", projectId)
      .maybeSingle(),
  ])

  if (projectResult.error || !projectResult.data || targetUserResult.error || !targetUserResult.data) {
    return null
  }

  const currentOwnerId = projectResult.data.owner_user_id ?? null
  if (!currentOwnerId || currentOwnerId === targetUserId) {
    return getProjetoById(projectId)
  }

  const currentOwnerResult = await supabase
    .from("usuarios")
    .select("id, role")
    .eq("id", currentOwnerId)
    .maybeSingle()

  const currentOwnerIsAdmin = currentOwnerResult.data?.role === "admin"
  const targetUserIsAdmin = targetUserResult.data.role === "admin"
  const billing = billingResult.data ?? null
  const hasUnlimitedAdminBilling =
    !billing ||
    (billing.plano_id == null &&
      billing.bloqueado !== true &&
      billing.limite_tokens_input_mensal == null &&
      billing.limite_tokens_output_mensal == null &&
      billing.limite_tokens_total_mensal == null &&
      billing.limite_custo_mensal == null)

  const now = new Date().toISOString()

  const ownershipUpdate = await supabase
    .from("projetos")
    .update({
      owner_user_id: targetUserId,
      updated_at: now,
    })
    .eq("id", projectId)

  if (ownershipUpdate.error) {
    return null
  }

  if (!membershipResult.data?.id) {
    const membershipInsert = await supabase.from("usuarios_projetos").insert({
      usuario_id: targetUserId,
      projeto_id: projectId,
      papel: targetUserIsAdmin ? "admin" : "viewer",
      created_at: now,
    })

    if (membershipInsert.error) {
      return null
    }
  }

  if (currentOwnerIsAdmin && !targetUserIsAdmin && hasUnlimitedAdminBilling) {
    await applyInitialFreePlan({
      supabase,
      projetoId: projectId,
      now,
    })
  }

  return getProjetoById(projectId)
}

export async function canManageProject(user, projectId) {
  return userCanManageProject(user, projectId)
}

export async function getProjectDeletePermission(user, projectId) {
  if (!user || !projectId) {
    return { allowed: false, reason: "Acesso negado." }
  }

  if (user.role === "admin") {
    return { allowed: true, reason: null }
  }

  const supabase = getSupabaseAdminClient()
  const canManage = await userCanManageProject(user, projectId, supabase)

  if (!canManage) {
    return { allowed: false, reason: "Acesso negado." }
  }

  const { count, error } = await supabase
    .from("usuarios_projetos")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", user.id)

  if (error) {
    console.error("[projetos] failed to count user projects for delete permission", error)
    return { allowed: false, reason: "Nao foi possivel validar a exclusao do projeto." }
  }

  if ((count ?? 0) <= 1) {
    return { allowed: false, reason: "Voce precisa manter pelo menos um projeto." }
  }

  return { allowed: true, reason: null }
}

async function deleteRowsByProject(supabase, table, projectId) {
  const { error } = await supabase.from(table).delete().eq("projeto_id", projectId)

  if (error) {
    console.error(`[projetos] failed to delete ${table}`, error)
    return { ok: false, error }
  }

  return { ok: true }
}

async function logProjectDeleteFailure({ supabase, projectId, projectName, step, error }) {
  const appErrorCode = `PROJECT_DELETE_${String(step || "UNKNOWN").toUpperCase()}`

  await createLogEntry(
    {
      projectId,
      type: "project_delete_error",
      origin: "admin_projects",
      level: "error",
      description: `[${appErrorCode}] Falha ao excluir projeto: ${step}.`,
      payload: {
        appErrorCode,
        projectId,
        projectName,
        step,
        error: error?.message ?? String(error || ""),
        errorCode: error?.code ?? null,
        errorDetails: error?.details ?? null,
        errorHint: error?.hint ?? null,
      },
    },
    { supabase },
  )
}

async function failProjectDelete(context, userMessage) {
  await logProjectDeleteFailure(context)
  const code = `PROJECT_DELETE_${String(context.step || "UNKNOWN").toUpperCase()}`
  return { ok: false, error: userMessage, code }
}

async function readProjectRelatedIds(supabase, projectId) {
  const [agentsResult, apisResult, chatsResult] = await Promise.all([
    supabase.from("agentes").select("id").eq("projeto_id", projectId),
    supabase.from("apis").select("id").eq("projeto_id", projectId),
    supabase.from("chats").select("id").eq("projeto_id", projectId),
  ])

  return {
    agentIds: (agentsResult.data ?? []).map((item) => item.id),
    apiIds: (apisResult.data ?? []).map((item) => item.id),
    chatIds: (chatsResult.data ?? []).map((item) => item.id),
  }
}

async function deleteFeedbackMessagesForProject(supabase, projectId) {
  const feedbackIds = []

  while (true) {
    const lastId = feedbackIds.at(-1)
    let query = supabase
      .from("feedbacks")
      .select("id")
      .eq("projeto_id", projectId)
      .order("id", { ascending: true })
      .limit(200)

    if (lastId) {
      query = query.gt("id", lastId)
    }

    const { data, error } = await query

    if (error) {
      return { ok: false, error }
    }

    const ids = (data ?? []).map((item) => item.id).filter(Boolean)

    feedbackIds.push(...ids)

    if (ids.length < 200) {
      break
    }
  }

  async function deleteFeedbackMessagesByMessageIds(ids) {
    for (let index = 0; index < ids.length; index += 50) {
      const batchIds = ids.slice(index, index + 50)

      if (!batchIds.length) {
        continue
      }

      const { error } = await supabase.from("feedback_mensagens").delete().in("id", batchIds)

      if (error) {
        return { ok: false, error }
      }
    }

    return { ok: true }
  }

  for (let index = 0; index < feedbackIds.length; index += 50) {
    const ids = feedbackIds.slice(index, index + 50)

    if (!ids.length) {
      continue
    }

    const { error } = await supabase.from("feedback_mensagens").delete().in("feedback_id", ids)

    if (error) {
      const message = String(error?.message || "")
      const missingFeedbackMessagesMetadata =
        (!error?.code && !error?.message && !error?.details && !error?.hint) ||
        error?.code === "PGRST204" ||
        error?.code === "42703" ||
        /feedback_id/i.test(message) && /column|schema cache|not found|could not find/i.test(message)
      const missingFeedbackMessagesTable =
        error?.code === "42P01" ||
        error?.code === "PGRST205" ||
        /feedback_mensagens/i.test(message) && /does not exist|not found|could not find|relation/i.test(message)

      if (missingFeedbackMessagesTable || missingFeedbackMessagesMetadata) {
        return { ok: true }
      }

      const fallbackMessagesResult = await supabase
        .from("feedback_mensagens")
        .select("id")
        .in("feedback_id", ids)
        .limit(1000)

      if (!fallbackMessagesResult.error) {
        const messageIds = (fallbackMessagesResult.data ?? []).map((item) => item.id).filter(Boolean)

        if (!messageIds.length) {
          continue
        }

        const fallbackDeleteResult = await deleteFeedbackMessagesByMessageIds(messageIds)
        if (fallbackDeleteResult.ok) {
          continue
        }

        return {
          ok: false,
          error: {
            ...fallbackDeleteResult.error,
            message: fallbackDeleteResult.error?.message || error?.message || "Fallback delete by message id failed.",
            details: fallbackDeleteResult.error?.details ?? error?.details ?? null,
            hint: fallbackDeleteResult.error?.hint ?? error?.hint ?? null,
            cause: {
              feedbackIdDelete: {
                code: error?.code ?? null,
                message: error?.message ?? null,
                details: error?.details ?? null,
                hint: error?.hint ?? null,
              },
            },
          },
        }
      }

      return {
        ok: false,
        error: {
          ...error,
          cause: {
            feedbackMessagesLookup: {
              code: fallbackMessagesResult.error?.code ?? null,
              message: fallbackMessagesResult.error?.message ?? null,
              details: fallbackMessagesResult.error?.details ?? null,
              hint: fallbackMessagesResult.error?.hint ?? null,
            },
          },
        },
      }
    }
  }

  return { ok: true }
}

export async function deleteProject(projectId, confirmationName) {
  if (!projectId) {
    return { ok: false, error: "Projeto invalido." }
  }

  const supabase = getSupabaseAdminClient()
  const { data: project, error: projectError } = await supabase
    .from("projetos")
    .select("id, nome")
    .eq("id", projectId)
    .maybeSingle()

  if (projectError || !project) {
    if (projectError) {
      console.error("[projetos] failed to read project before delete", projectError)
    }
    return { ok: false, error: "Projeto nao encontrado." }
  }

  if (String(confirmationName || "").trim() !== String(project.nome || "").trim()) {
    return { ok: false, error: "Nome digitado diferente do nome do projeto." }
  }

  const { agentIds, apiIds, chatIds } = await readProjectRelatedIds(supabase, projectId)
  const feedbackMessagesResult = await deleteFeedbackMessagesForProject(supabase, projectId)

  if (!feedbackMessagesResult.ok) {
    console.error("[projetos] failed to delete feedback messages", feedbackMessagesResult.error)
    const errorMessage = feedbackMessagesResult.error?.message?.trim()
    const errorDetails = feedbackMessagesResult.error?.details?.trim()
    const errorHint = feedbackMessagesResult.error?.hint?.trim()
    const suffix = [errorMessage, errorDetails, errorHint].filter(Boolean).join(" | ")
    return failProjectDelete(
      {
        supabase,
        projectId,
        projectName: project.nome,
        step: "feedback_mensagens",
        error: feedbackMessagesResult.error,
      },
      suffix ? `Falha ao limpar mensagens de feedback. ${suffix}` : "Falha ao limpar mensagens de feedback.",
    )
  }

  if (chatIds.length > 0) {
    const { error } = await supabase.from("mensagens").delete().in("chat_id", chatIds)
    if (error) {
      console.error("[projetos] failed to delete messages", error)
      return failProjectDelete(
        { supabase, projectId, projectName: project.nome, step: "mensagens", error },
        "Falha ao limpar mensagens.",
      )
    }
  }

  if (apiIds.length > 0) {
    const { error: fieldsError } = await supabase.from("api_campos").delete().in("api_id", apiIds)
    if (fieldsError) {
      console.error("[projetos] failed to delete api fields", fieldsError)
      return failProjectDelete(
        { supabase, projectId, projectName: project.nome, step: "api_campos", error: fieldsError },
        "Falha ao limpar campos de APIs.",
      )
    }

    const { error: linksError } = await supabase.from("agente_api").delete().in("api_id", apiIds)
    if (linksError) {
      console.error("[projetos] failed to delete agent api links by api", linksError)
      return failProjectDelete(
        { supabase, projectId, projectName: project.nome, step: "agente_api", error: linksError },
        "Falha ao limpar vinculos de APIs.",
      )
    }
  }

  if (agentIds.length > 0) {
    const { error } = await supabase.from("agente_api").delete().in("agente_id", agentIds)
    if (error) {
      console.error("[projetos] failed to delete agent api links by agent", error)
      return failProjectDelete(
        { supabase, projectId, projectName: project.nome, step: "agente_api", error },
        "Falha ao limpar vinculos do agente.",
      )
    }
  }

  const projectTables = [
    "agenda_reservas",
    "agenda_horarios",
    "agente_versoes",
    "api_versoes",
    "chat_handoff_eventos",
    "chat_handoffs",
    "whatsapp_handoff_contatos",
    "chat_widgets",
    "canais_whatsapp",
    "chats",
    "feedbacks",
    "logs",
    "segredos",
    "tokens_avulsos",
    "usuarios_limites_ia",
    "usuarios_projetos",
    "projetos_checkout_intencoes",
    "projetos_planos",
    "projetos_assinaturas",
    "projetos_ciclos_uso",
    "agente_arquivos",
    "conectores",
    "apis",
    "agentes",
  ]

  for (const table of projectTables) {
    const result = await deleteRowsByProject(supabase, table, projectId)
    if (!result.ok) {
      const errorMessage = result.error?.message?.trim()
      const errorDetails = result.error?.details?.trim()
      const errorHint = result.error?.hint?.trim()
      const suffix = [errorMessage, errorDetails, errorHint].filter(Boolean).join(" | ")
      return failProjectDelete(
        { supabase, projectId, projectName: project.nome, step: table, error: result.error },
        suffix ? `Falha ao limpar ${table}. ${suffix}` : `Falha ao limpar ${table}.`,
      )
    }
  }

  const { error: usageError } = await supabase
    .from("consumos")
    .update({ projeto_id: null })
    .eq("projeto_id", projectId)

  if (usageError) {
    console.error("[projetos] failed to detach usage records", usageError)
    return failProjectDelete(
      { supabase, projectId, projectName: project.nome, step: "consumos", error: usageError },
      "Falha ao preservar historico de tokens usados.",
    )
  }

  const { error } = await supabase.from("projetos").delete().eq("id", projectId)

  if (error) {
    console.error("[projetos] failed to delete project", error)
    return failProjectDelete(
      { supabase, projectId, projectName: project.nome, step: "projetos", error },
      "Falha ao excluir o projeto.",
    )
  }

  return { ok: true }
}

export async function getProjectForUser(identifier, user) {
  if (!identifier || !user) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const lookup = extractProjectLookup(identifier)
    let query = supabase.from("projetos").select(projetoFields)

    query = lookup.id ? query.eq("id", lookup.id) : query.eq("slug", lookup.slug)

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error("[projetos] failed to get project", error)
      return null
    }

    if (!data || !userCanAccessProject(user, data.id)) {
      return null
    }

    const project = normalizeProject(data)
    const [agent, apis, whatsappChannels, initialChatWidgets, apiCount, whatsappCount, widgetCount, fileCount, billing] = await Promise.all([
      getActiveAgent(supabase, project.id),
      listProjectApis(supabase, project.id),
      listWhatsAppChannelsForUser(project, user),
      listChatWidgetsForUser(project, user),
      safeCount(supabase, "apis", project.id),
      safeCount(supabase, "canais_whatsapp", project.id),
      safeCount(supabase, "chat_widgets", project.id),
      safeCount(supabase, "agente_arquivos", project.id),
      getProjectBillingSnapshot(project.id, {
        supabase,
        usuarioId: user.role === "admin" ? null : user.id,
      }),
    ])
    const agentVersions = agent?.id ? await listAgentVersionsForUser({ agenteId: agent.id, projetoId: project.id }, user) : []
    let chatWidgets = initialChatWidgets

    if (chatWidgets.length === 0) {
      const widgetBootstrapProject = { ...project, agent }
      const ensuredWidget = await ensureProjectHasDefaultWidget(widgetBootstrapProject, user)

      if (ensuredWidget.widget) {
        chatWidgets = [ensuredWidget.widget]
      }
    }

    const directConnections = await buildAgentDirectConnections({
      supabase,
      projectId: project.id,
      agent,
      apiCount,
      whatsappCount: whatsappChannels.length > 0 ? 1 : 0,
      widgetCount: chatWidgets.length > 0 ? 1 : widgetCount > 0 ? 1 : 0,
    })

    return {
      ...project,
      agent: agent ? { ...agent, versions: agentVersions } : null,
      apis,
      whatsappChannels,
      chatWidgets,
      billing,
      integrations: {
        apis: apiCount,
        whatsapp: whatsappChannels.length > 0 ? 1 : whatsappCount > 0 ? 1 : 0,
        chatWidget: chatWidgets.length > 0 ? 1 : widgetCount > 0 ? 1 : 0,
        files: fileCount,
      },
      directConnections,
    }
  } catch (error) {
    console.error("[projetos] failed to get project details", error)
    return null
  }
}

export async function getProjectAccessForUser(identifier, user) {
  if (!identifier || !user) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const lookup = extractProjectLookup(identifier)
    let query = supabase.from("projetos").select(projetoAccessFields)

    query = lookup.id ? query.eq("id", lookup.id) : query.eq("slug", lookup.slug)

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error("[projetos] failed to get project access", error)
      return null
    }

    if (!data || !userCanAccessProject(user, data.id)) {
      return null
    }

    return normalizeProject(data)
  } catch (error) {
    console.error("[projetos] failed to get project access", error)
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
    routeKey: project.routeKey,
    tipo: project.type,
    descricao: project.description,
    status: project.status,
    isDemo: project.isDemo === true,
    directConnections:
      project.directConnections && typeof project.directConnections === "object" ? { ...project.directConnections } : null,
    integrations: project.integrations && typeof project.integrations === "object" ? { ...project.integrations } : null,
    agent: project.agent ?? null,
    billing: project.billing ?? null,
  }
}

function mapRuntimeProject(row) {
  if (!row) {
    return null
  }

  const slug = row.slug?.trim() || row.id
  return {
    id: row.id,
    nome: row.nome?.trim() || "Projeto sem nome",
    name: row.nome?.trim() || "Projeto sem nome",
    slug,
    routeKey: buildProjectRouteKey({ id: row.id, slug }),
    status: row.status?.trim() || "ativo",
    directConnections: null,
  }
}

async function getProjetoRuntimeByField(field, value) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return null
  }

  try {
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("projetos")
      .select("id, nome, slug, status")
      .eq(field, normalized)
      .maybeSingle()

    if (error || !data) {
      if (error) {
        console.error("[projetos] failed to get runtime project", error)
      }
      return null
    }

    return mapRuntimeProject(data)
  } catch (error) {
    console.error("[projetos] failed to get runtime project", error)
    return null
  }
}

export async function getProjetoRuntimeById(id) {
  return getProjetoRuntimeByField("id", id)
}

export async function getProjetoRuntimeByIdentifier(identifier) {
  const value = String(identifier || "").trim()
  if (!value) {
    return null
  }

  if (isUuid(value)) {
    return getProjetoRuntimeById(value)
  }

  const bySlug = await getProjetoRuntimeByField("slug", value)
  if (bySlug) {
    return bySlug
  }

  return getProjetoRuntimeById(value)
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

    const normalizedProject = normalizeProject(data)
    const enrichedProject = await enrichProjectSummary(supabase, normalizedProject, null)
    return mapLegacyProject(enrichedProject)
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

    const normalizedProject = normalizeProject(data)
    const enrichedProject = await enrichProjectSummary(supabase, normalizedProject, null)
    return mapLegacyProject(enrichedProject)
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
