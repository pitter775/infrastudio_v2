import "server-only"

import { randomUUID } from "node:crypto"

import { getBillingCycleWindow } from "@/lib/billing"
import { getOrCreateDefaultModelId } from "@/lib/modelos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { deleteUsuario, getUsuarioById } from "@/lib/usuarios"

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

export async function applyInitialFreePlan({ supabase, projetoId, now }) {
  const freePlan = await getFreeBillingPlan(supabase)
  const { endIso } = getBillingCycleWindow(new Date(now || Date.now()))

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
    data_fim: endIso,
    renovar_automatico: false,
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

export async function createInitialProjectForUsuario({ usuarioId, nome }) {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const baseName = String(nome || "Usuário").trim() || "Usuário"
  const defaultModelId = await getOrCreateDefaultModelId({ supabase })
  const { data: project, error: projectError } = await supabase
    .from("projetos")
    .insert({
      nome: `Projeto ${baseName}`,
      slug: `${slugify(baseName)}-${Date.now().toString(36)}`,
      tipo: "Geral",
      descricao: "Projeto criado no cadastro.",
      status: "ativo",
      modo_cobranca: "plano",
      modelo_id: defaultModelId,
      owner_user_id: usuarioId,
      configuracoes: {},
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
    nome: persistedUser.name || usuario.name || usuario.nome || "Usuário",
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
