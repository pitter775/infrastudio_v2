import "server-only"

import { randomUUID } from "node:crypto"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { deleteUsuario, getUsuarioById } from "@/lib/usuarios"

const DEFAULT_TEMPLATE_PROJECT_ID =
  process.env.DEMO_TEMPLATE_PROJECT_ID?.trim() || "5da7e3e5-f5fb-449d-b135-c78a19daaf5b"

function slugify(value) {
  return String(value || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "projeto"
}

async function getFreeBillingPlan(supabase) {
  const { data, error } = await supabase
    .from("planos")
    .select(
      "id, nome, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, ativo, is_free",
    )
    .eq("ativo", true)
    .eq("is_free", true)
    .order("preco_mensal", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[usuario-project-bootstrap] failed to load free billing plan", error)
    return null
  }

  return data ?? null
}

async function applyInitialFreePlan({ supabase, projetoId, now }) {
  const freePlan = await getFreeBillingPlan(supabase)

  if (!freePlan?.id) {
    return
  }

  const planPayload = {
    projeto_id: projetoId,
    nome_plano: freePlan.nome || "Free",
    modelo_referencia: "gpt-4o-mini",
    limite_tokens_input_mensal: freePlan.limite_tokens_input_mensal ?? null,
    limite_tokens_output_mensal: freePlan.limite_tokens_output_mensal ?? null,
    limite_tokens_total_mensal: freePlan.limite_tokens_total_mensal ?? null,
    limite_custo_mensal: freePlan.limite_custo_mensal ?? null,
    auto_bloquear: true,
    bloqueado: false,
    bloqueado_motivo: null,
    observacoes: "Plano inicial aplicado automaticamente no cadastro.",
    plano_id: freePlan.id,
    updated_at: now,
  }

  const existingProjectPlan = await supabase
    .from("projetos_planos")
    .select("id")
    .eq("projeto_id", projetoId)
    .maybeSingle()

  if (existingProjectPlan.error && existingProjectPlan.error.code !== "PGRST116") {
    throw existingProjectPlan.error
  }

  if (existingProjectPlan.data?.id) {
    const { error } = await supabase.from("projetos_planos").update(planPayload).eq("id", existingProjectPlan.data.id)
    if (error) {
      throw error
    }
  } else {
    const { error } = await supabase.from("projetos_planos").insert({
      id: randomUUID(),
      ...planPayload,
      created_at: now,
    })
    if (error) {
      throw error
    }
  }

  const existingSubscription = await supabase
    .from("projetos_assinaturas")
    .select("id")
    .eq("projeto_id", projetoId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (existingSubscription.error && existingSubscription.error.code !== "PGRST116") {
    throw existingSubscription.error
  }

  const subscriptionPayload = {
    projeto_id: projetoId,
    plano_id: freePlan.id,
    status: "ativo",
    data_inicio: now,
    data_fim: null,
    renovar_automatico: true,
    updated_at: now,
  }

  if (existingSubscription.data?.id) {
    const { error } = await supabase
      .from("projetos_assinaturas")
      .update(subscriptionPayload)
      .eq("id", existingSubscription.data.id)
    if (error) {
      throw error
    }
  } else {
    const { error } = await supabase.from("projetos_assinaturas").insert({
      id: randomUUID(),
      ...subscriptionPayload,
      created_at: now,
    })
    if (error) {
      throw error
    }
  }
}

async function cloneTemplateProjectData({ supabase, templateProjectId, projetoId, now }) {
  const [templateAgentsResult, templateApisResult, templateWidgetsResult, templateConnectorsResult, templateSecretsResult, templatePlanResult] =
    await Promise.all([
      supabase
        .from("agentes")
        .select("id, slug, nome, descricao, modelo_id, prompt_base, configuracoes, ativo")
        .eq("projeto_id", templateProjectId),
      supabase
        .from("apis")
        .select("id, nome, url, metodo, descricao, ativo, configuracoes")
        .eq("projeto_id", templateProjectId),
      supabase
        .from("chat_widgets")
        .select("id, nome, slug, agente_id, dominio, ativo, tema, cor_primaria, fundo_transparente, whatsapp_celular")
        .eq("projeto_id", templateProjectId),
      supabase
        .from("conectores")
        .select("id, agente_id, slug, nome, tipo, descricao, endpoint_base, metodo_auth, configuracoes, ativo")
        .eq("projeto_id", templateProjectId),
      supabase
        .from("segredos")
        .select("nome, tipo, valor")
        .eq("projeto_id", templateProjectId),
      supabase
        .from("projetos_planos")
        .select("nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes, plano_id")
        .eq("projeto_id", templateProjectId)
        .maybeSingle(),
    ])

  const templateAgents = templateAgentsResult.data ?? []
  const templateApis = templateApisResult.data ?? []
  const templateWidgets = templateWidgetsResult.data ?? []
  const templateConnectors = templateConnectorsResult.data ?? []
  const templateSecrets = templateSecretsResult.data ?? []
  const templatePlan = templatePlanResult.data ?? null

  const oldToNewAgentId = new Map()
  const oldToNewApiId = new Map()

  if (templateAgents.length) {
    const agentRows = templateAgents.map((agent) => {
      const nextId = randomUUID()
      oldToNewAgentId.set(agent.id, nextId)
      return {
        id: nextId,
        projeto_id: projetoId,
        slug: agent.slug,
        nome: agent.nome,
        descricao: agent.descricao,
        modelo_id: agent.modelo_id,
        prompt_base: agent.prompt_base,
        configuracoes: agent.configuracoes ?? {},
        ativo: agent.ativo !== false,
        created_at: now,
        updated_at: now,
      }
    })

    const { error } = await supabase.from("agentes").insert(agentRows)
    if (error) throw error
  }

  if (templateApis.length) {
    const apiRows = templateApis.map((api) => {
      const nextId = randomUUID()
      oldToNewApiId.set(api.id, nextId)
      return {
        id: nextId,
        projeto_id: projetoId,
        nome: api.nome,
        url: api.url,
        metodo: api.metodo,
        descricao: api.descricao,
        ativo: api.ativo !== false,
        configuracoes: api.configuracoes ?? {},
        created_at: now,
        updated_at: now,
      }
    })

    const { error } = await supabase.from("apis").insert(apiRows)
    if (error) throw error

    const templateFieldsResult = await supabase
      .from("api_campos")
      .select("api_id, nome, tipo, descricao")
      .in("api_id", templateApis.map((item) => item.id))

    if (templateFieldsResult.error) throw templateFieldsResult.error

    const apiFieldRows = (templateFieldsResult.data ?? [])
      .map((field) => ({
        id: randomUUID(),
        api_id: oldToNewApiId.get(field.api_id),
        nome: field.nome,
        tipo: field.tipo,
        descricao: field.descricao,
        created_at: now,
      }))
      .filter((item) => item.api_id)

    if (apiFieldRows.length) {
      const { error } = await supabase.from("api_campos").insert(apiFieldRows)
      if (error) throw error
    }
  }

  if (templateAgents.length && templateApis.length) {
    const templateAgentApiLinksResult = await supabase
      .from("agente_api")
      .select("agente_id, api_id")
      .in("agente_id", templateAgents.map((item) => item.id))

    if (templateAgentApiLinksResult.error) throw templateAgentApiLinksResult.error

    const agentApiRows = (templateAgentApiLinksResult.data ?? [])
      .map((link) => ({
        id: randomUUID(),
        agente_id: oldToNewAgentId.get(link.agente_id),
        api_id: oldToNewApiId.get(link.api_id),
        created_at: now,
      }))
      .filter((item) => item.agente_id && item.api_id)

    if (agentApiRows.length) {
      const { error } = await supabase.from("agente_api").insert(agentApiRows)
      if (error) throw error
    }
  }

  if (templateWidgets.length) {
    const widgetRows = templateWidgets.map((widget) => ({
      id: randomUUID(),
      nome: widget.nome,
      slug: `${widget.slug}-${Date.now().toString(36).slice(-4)}`,
      projeto_id: projetoId,
      agente_id: widget.agente_id ? oldToNewAgentId.get(widget.agente_id) ?? null : null,
      dominio: widget.dominio,
      ativo: widget.ativo !== false,
      tema: widget.tema,
      cor_primaria: widget.cor_primaria,
      fundo_transparente: widget.fundo_transparente !== false,
      whatsapp_celular: widget.whatsapp_celular,
      created_at: now,
      updated_at: now,
    }))

    const { error } = await supabase.from("chat_widgets").insert(widgetRows)
    if (error) throw error
  }

  if (templateConnectors.length) {
    const connectorRows = templateConnectors.map((connector) => ({
      id: randomUUID(),
      projeto_id: projetoId,
      agente_id: connector.agente_id ? oldToNewAgentId.get(connector.agente_id) ?? null : null,
      slug: connector.slug,
      nome: connector.nome,
      tipo: connector.tipo,
      descricao: connector.descricao,
      endpoint_base: connector.endpoint_base,
      metodo_auth: connector.metodo_auth,
      configuracoes: connector.configuracoes ?? {},
      ativo: connector.ativo !== false,
      created_at: now,
      updated_at: now,
    }))

    const { error } = await supabase.from("conectores").insert(connectorRows)
    if (error) throw error
  }

  if (templateSecrets.length) {
    const secretRows = templateSecrets.map((secret) => ({
      id: randomUUID(),
      projeto_id: projetoId,
      nome: secret.nome,
      tipo: secret.tipo,
      valor: secret.valor,
      created_at: now,
    }))

    const { error } = await supabase.from("segredos").insert(secretRows)
    if (error) throw error
  }

  if (templatePlan) {
    const { error } = await supabase.from("projetos_planos").insert({
      id: randomUUID(),
      projeto_id: projetoId,
      nome_plano: templatePlan.nome_plano,
      modelo_referencia: templatePlan.modelo_referencia,
      limite_tokens_input_mensal: templatePlan.limite_tokens_input_mensal,
      limite_tokens_output_mensal: templatePlan.limite_tokens_output_mensal,
      limite_tokens_total_mensal: templatePlan.limite_tokens_total_mensal,
      limite_custo_mensal: templatePlan.limite_custo_mensal,
      auto_bloquear: templatePlan.auto_bloquear !== false,
      bloqueado: templatePlan.bloqueado === true,
      bloqueado_motivo: templatePlan.bloqueado_motivo,
      observacoes: templatePlan.observacoes,
      plano_id: templatePlan.plano_id,
      created_at: now,
      updated_at: now,
    })

    if (error) throw error
  }
}

export async function createInitialProjectForUsuario({ usuarioId, nome }) {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const baseName = String(nome || "Usuario").trim() || "Usuario"
  const templateProjectId = DEFAULT_TEMPLATE_PROJECT_ID
  const templateQuery = templateProjectId
    ? await supabase
        .from("projetos")
        .select("id, nome, tipo, descricao, status, configuracoes, modo_cobranca, modelo_id")
        .eq("id", templateProjectId)
        .maybeSingle()
    : { data: null }

  const templateProject = templateQuery.data ?? null
  const { data: project, error: projectError } = await supabase
    .from("projetos")
    .insert({
      nome: `Projeto ${baseName}`,
      slug: `${slugify(baseName)}-${Date.now().toString(36)}`,
      tipo: templateProject?.tipo || "Geral",
      descricao: templateProject?.descricao || "Projeto criado no cadastro.",
      status: templateProject?.status || "ativo",
      modo_cobranca: templateProject?.modo_cobranca || "plano",
      modelo_id: templateProject?.modelo_id ?? null,
      owner_user_id: usuarioId,
      configuracoes: templateProject?.configuracoes ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()

  if (projectError || !project?.id) {
    console.error("[usuario-project-bootstrap] failed to create initial project", projectError)
    return null
  }

  const { error: membershipError } = await supabase.from("usuarios_projetos").insert({
    usuario_id: usuarioId,
    projeto_id: project.id,
    papel: "viewer",
    created_at: now,
  })

  if (membershipError) {
    console.error("[usuario-project-bootstrap] failed to create initial membership", membershipError)
    await supabase.from("projetos").delete().eq("id", project.id)
    return null
  }

  if (templateProject?.id) {
    try {
      await cloneTemplateProjectData({
        supabase,
        templateProjectId: templateProject.id,
        projetoId: project.id,
        now,
      })
    } catch (error) {
      console.error("[usuario-project-bootstrap] failed to clone template project data", error)
      await supabase.from("usuarios_projetos").delete().eq("projeto_id", project.id)
      await supabase.from("projetos").delete().eq("id", project.id)
      return null
    }
  }

  try {
    await applyInitialFreePlan({
      supabase,
      projetoId: project.id,
      now,
    })
  } catch (error) {
    console.error("[usuario-project-bootstrap] failed to apply initial free plan", error)
    await supabase.from("projetos_assinaturas").delete().eq("projeto_id", project.id)
    await supabase.from("projetos_planos").delete().eq("projeto_id", project.id)
    await supabase.from("usuarios_projetos").delete().eq("projeto_id", project.id)
    await supabase.from("projetos").delete().eq("id", project.id)
    return null
  }

  return project.id
}

export async function ensureUsuarioHasProjeto(usuario) {
  if (!usuario?.id) {
    return null
  }

  const persistedUser = await getUsuarioById(usuario.id)
  if (!persistedUser) {
    return usuario
  }

  if (Array.isArray(persistedUser.memberships) && persistedUser.memberships.length > 0) {
    return persistedUser
  }

  const projetoId = await createInitialProjectForUsuario({
    usuarioId: usuario.id,
    nome: persistedUser.name || usuario.name || usuario.nome || "Usuario",
  })

  if (!projetoId) {
    return persistedUser
  }

  return getUsuarioById(usuario.id)
}

export async function rollbackProvisionedUsuario(usuarioId, projetoId) {
  if (projetoId) {
    const supabase = getSupabaseAdminClient()
    await supabase.from("usuarios_projetos").delete().eq("projeto_id", projetoId)
    await supabase.from("projetos").delete().eq("id", projetoId)
  }

  if (usuarioId) {
    await deleteUsuario(usuarioId)
  }
}
