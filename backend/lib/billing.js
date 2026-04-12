import "server-only"

import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeNullableNumber(value) {
  return value == null ? null : normalizeNumber(value, 0)
}

function percentage(used, limit) {
  const safeLimit = normalizeNullableNumber(limit)
  if (!safeLimit || safeLimit <= 0) {
    return null
  }

  const safeUsed = Math.max(0, normalizeNumber(used, 0))
  return Math.round((safeUsed / safeLimit) * 10000) / 100
}

function toIsoDate(value) {
  return value ? new Date(value).toISOString() : null
}

function isOptionalMissingRowError(error) {
  if (!error) {
    return false
  }

  if (error.code === "PGRST116") {
    return true
  }

  return !error.message && !error.details && !error.hint
}

function warnOptionalBillingLoad(label, error) {
  if (!error || isOptionalMissingRowError(error)) {
    return
  }

  console.warn(`[billing] failed to load ${label}`, {
    code: error.code ?? null,
    message: error.message ?? String(error),
  })
}

export function mapBillingPlan(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.nome?.trim() || "Plano",
    description: row.descricao?.trim() || "",
    monthlyPrice: normalizeNumber(row.preco_mensal, 0),
    isFree: Boolean(row.is_free),
    active: row.ativo !== false,
    allowOverage: Boolean(row.permitir_excedente),
    overageTokenCost: normalizeNumber(row.custo_token_excedente, 0),
    limits: {
      inputTokens: normalizeNullableNumber(row.limite_tokens_input_mensal),
      outputTokens: normalizeNullableNumber(row.limite_tokens_output_mensal),
      totalTokens: normalizeNullableNumber(row.limite_tokens_total_mensal),
      monthlyCost: normalizeNullableNumber(row.limite_custo_mensal),
    },
    capacities: {
      agents: normalizeNullableNumber(row.max_agentes),
      apis: normalizeNullableNumber(row.max_apis),
      whatsapp: normalizeNullableNumber(row.max_whatsapp),
    },
  }
}

function mapProjectBillingConfig(row, plan) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    planId: row.plano_id ?? plan?.id ?? null,
    planName: row.nome_plano?.trim() || plan?.name || "Plano personalizado",
    referenceModel: row.modelo_referencia?.trim() || "gpt-4o-mini",
    autoBlock: row.auto_bloquear !== false,
    blocked: Boolean(row.bloqueado),
    blockedReason: row.bloqueado_motivo?.trim() || "",
    notes: row.observacoes?.trim() || "",
    limits: {
      inputTokens: normalizeNullableNumber(row.limite_tokens_input_mensal ?? plan?.limits?.inputTokens),
      outputTokens: normalizeNullableNumber(row.limite_tokens_output_mensal ?? plan?.limits?.outputTokens),
      totalTokens: normalizeNullableNumber(row.limite_tokens_total_mensal ?? plan?.limits?.totalTokens),
      monthlyCost: normalizeNullableNumber(row.limite_custo_mensal ?? plan?.limits?.monthlyCost),
    },
    allowOverage: plan?.allowOverage ?? false,
    overageTokenCost: plan?.overageTokenCost ?? 0,
  }
}

function mapBillingCycle(row, config) {
  if (!row) {
    return null
  }

  const totalTokens = normalizeNumber(row.tokens_input, 0) + normalizeNumber(row.tokens_output, 0)
  const totalTokenLimit = normalizeNullableNumber(row.limite_tokens_total ?? config?.limits?.totalTokens)
  const monthlyCostLimit = normalizeNullableNumber(row.limite_custo ?? config?.limits?.monthlyCost)

  return {
    id: row.id,
    startDate: toIsoDate(row.data_inicio),
    endDate: toIsoDate(row.data_fim),
    closed: Boolean(row.fechado),
    blocked: Boolean(row.bloqueado),
    alerts: {
      warning80: Boolean(row.alerta_80),
      warning100: Boolean(row.alerta_100),
    },
    usage: {
      inputTokens: normalizeNumber(row.tokens_input, 0),
      outputTokens: normalizeNumber(row.tokens_output, 0),
      totalTokens,
      totalCost: normalizeNumber(row.custo_total, 0),
    },
    limits: {
      inputTokens: normalizeNullableNumber(row.limite_tokens_input ?? config?.limits?.inputTokens),
      outputTokens: normalizeNullableNumber(row.limite_tokens_output ?? config?.limits?.outputTokens),
      totalTokens: totalTokenLimit,
      monthlyCost: monthlyCostLimit,
    },
    exceeded: {
      tokens: normalizeNumber(row.excedente_tokens, 0),
      cost: normalizeNumber(row.excedente_custo, 0),
    },
    usagePercent: {
      totalTokens: percentage(totalTokens, totalTokenLimit),
      monthlyCost: percentage(row.custo_total, monthlyCostLimit),
    },
  }
}

function mapSubscription(row, plan) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    status: row.status?.trim() || "ativo",
    startDate: toIsoDate(row.data_inicio),
    endDate: toIsoDate(row.data_fim),
    autoRenew: row.renovar_automatico !== false,
    plan: plan ?? null,
  }
}

function mapTopUps(rows) {
  const list = Array.isArray(rows) ? rows : []
  return {
    totalTokens: list.reduce((sum, item) => sum + normalizeNumber(item.tokens, 0), 0),
    totalCost: list.reduce((sum, item) => sum + normalizeNumber(item.custo, 0), 0),
    availableCount: list.length,
  }
}

export function buildBillingSnapshot(input) {
  const plan = input.plan ?? null
  const config = mapProjectBillingConfig(input.projectPlan, plan)
  const cycle = mapBillingCycle(input.currentCycle, config)
  const subscription = mapSubscription(input.subscription, plan)
  const topUps = mapTopUps(input.topUps)

  return {
    mode: input.project?.modo_cobranca?.trim() || "plano",
    projectPlan: config,
    currentCycle: cycle,
    subscription,
    topUps,
    status: {
      blocked: Boolean(config?.blocked || cycle?.blocked),
      autoBlock: config?.autoBlock !== false,
      warning80: Boolean(cycle?.alerts?.warning80),
      warning100: Boolean(cycle?.alerts?.warning100),
    },
  }
}

export async function listBillingPlans(deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("planos")
      .select(
        "id, nome, descricao, preco_mensal, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, max_agentes, max_apis, max_whatsapp, ativo, permitir_excedente, custo_token_excedente, is_free",
      )
      .order("preco_mensal", { ascending: true })

    if (error) {
      console.error("[billing] failed to list plans", error)
      return []
    }

    return (data ?? []).map(mapBillingPlan)
  } catch (error) {
    console.error("[billing] failed to list plans", error)
    return []
  }
}

export async function getProjectBillingSnapshot(projectId, deps = {}) {
  if (!projectId) {
    return null
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const [projectResult, projectPlanResult, subscriptionResult, cycleResult, topUpsResult, plans] =
      await Promise.all([
        supabase.from("projetos").select("id, nome, slug, modo_cobranca").eq("id", projectId).maybeSingle(),
        supabase
          .from("projetos_planos")
          .select(
            "id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes, plano_id",
          )
          .eq("projeto_id", projectId)
          .maybeSingle(),
        supabase
          .from("projetos_assinaturas")
          .select("id, projeto_id, plano_id, status, data_inicio, data_fim, renovar_automatico, updated_at")
          .eq("projeto_id", projectId)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("projetos_ciclos_uso")
          .select(
            "id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, limite_tokens_input, limite_tokens_output, limite_tokens_total, limite_custo, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id",
          )
          .eq("projeto_id", projectId)
          .order("data_inicio", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("tokens_avulsos")
          .select("id, tokens, custo")
          .eq("projeto_id", projectId)
          .eq("utilizado", false)
          .order("created_at", { ascending: false }),
        listBillingPlans({ supabase }),
      ])

    if (projectResult.error || !projectResult.data) {
      if (projectResult.error) {
        console.error("[billing] failed to load project", projectResult.error)
      }
      return null
    }

    warnOptionalBillingLoad("project billing config", projectPlanResult.error)
    warnOptionalBillingLoad("subscription", subscriptionResult.error)
    warnOptionalBillingLoad("usage cycle", cycleResult.error)
    if (topUpsResult.error) {
      console.error("[billing] failed to load top-up tokens", topUpsResult.error)
    }

    const selectedPlanId =
      projectPlanResult.data?.plano_id ?? subscriptionResult.data?.plano_id ?? cycleResult.data?.plano_id ?? null
    const plan = plans.find((item) => item.id === selectedPlanId) ?? null

    return buildBillingSnapshot({
      project: projectResult.data,
      plan,
      projectPlan: projectPlanResult.data ?? null,
      subscription: subscriptionResult.data ?? null,
      currentCycle: cycleResult.data ?? null,
      topUps: topUpsResult.data ?? [],
    })
  } catch (error) {
    console.error("[billing] failed to load project billing snapshot", error)
    return null
  }
}

export async function listAdminBillingProjects(deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const { data, error } = await supabase
      .from("projetos")
      .select("id, nome, slug, status, modo_cobranca, is_demo")
      .order("nome", { ascending: true })

    if (error) {
      console.error("[billing] failed to list projects for billing", error)
      return []
    }

    return Promise.all(
      (data ?? []).map(async (project) => ({
        id: project.id,
        name: project.nome?.trim() || "Projeto",
        slug: project.slug?.trim() || project.id,
        status: project.status?.trim() || "ativo",
        mode: project.modo_cobranca?.trim() || "plano",
        isDemo: Boolean(project.is_demo),
        billing: await getProjectBillingSnapshot(project.id, { supabase }),
      })),
    )
  } catch (error) {
    console.error("[billing] failed to list billing projects", error)
    return []
  }
}

export async function updateProjectBillingSettings(input, deps = {}) {
  if (!input?.projectId) {
    return null
  }

  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    const now = new Date().toISOString()
    const payload = {
      projeto_id: input.projectId,
      nome_plano: String(input.planName || "Plano personalizado").trim() || "Plano personalizado",
      modelo_referencia: String(input.referenceModel || "gpt-4o-mini").trim() || "gpt-4o-mini",
      limite_tokens_input_mensal: input.limits?.inputTokens ?? null,
      limite_tokens_output_mensal: input.limits?.outputTokens ?? null,
      limite_tokens_total_mensal: input.limits?.totalTokens ?? null,
      limite_custo_mensal: input.limits?.monthlyCost ?? null,
      auto_bloquear: input.autoBlock !== false,
      bloqueado: Boolean(input.blocked),
      bloqueado_motivo: String(input.blockedReason || "").trim() || null,
      observacoes: String(input.notes || "").trim() || null,
      plano_id: input.planId || null,
      updated_at: now,
    }

    const existing = await supabase
      .from("projetos_planos")
      .select("id")
      .eq("projeto_id", input.projectId)
      .maybeSingle()

    if (existing.error && existing.error.code !== "PGRST116") {
      console.error("[billing] failed to read current project billing config", existing.error)
      return null
    }

    if (existing.data?.id) {
      const { error } = await supabase.from("projetos_planos").update(payload).eq("id", existing.data.id)
      if (error) {
        console.error("[billing] failed to update project billing config", error)
        return null
      }
    } else {
      const { error } = await supabase.from("projetos_planos").insert({
        ...payload,
        created_at: now,
      })
      if (error) {
        console.error("[billing] failed to create project billing config", error)
        return null
      }
    }

    return getProjectBillingSnapshot(input.projectId, { supabase })
  } catch (error) {
    console.error("[billing] failed to update project billing settings", error)
    return null
  }
}
