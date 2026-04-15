import "server-only"

import { sendEmail } from "@/lib/email"
import { createLogEntry } from "@/lib/logs"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"
import { listBillingAlertRecipientsByProjectId } from "@/lib/whatsapp-handoff-contatos"
import { getPrimaryWhatsAppChannelByProjectId } from "@/lib/whatsapp-channels"

const INFRASTUDIO_BILLING_ALERT_PROJECT_ID =
  process.env.INFRASTUDIO_HOME_PROJECT_ID?.trim() || "7d965fd5-2487-4efc-b3df-1d28fa3d5377"

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeNullableNumber(value) {
  return value == null ? null : normalizeNumber(value, 0)
}

function firstDayOfCurrentMonth() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

function firstDayOfNextMonth() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
}

function getCurrentCycleWindow() {
  const start = firstDayOfCurrentMonth()
  const end = new Date(firstDayOfNextMonth().getTime() - 1)
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
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
    usedTokens: list.reduce((sum, item) => sum + normalizeNumber(item.tokens_utilizados, 0), 0),
    availableTokens: list.reduce((sum, item) => {
      const total = normalizeNumber(item.tokens, 0)
      const used = Math.min(total, normalizeNumber(item.tokens_utilizados, 0))
      return sum + Math.max(0, total - used)
    }, 0),
    availableCount: list.filter((item) => {
      const total = normalizeNumber(item.tokens, 0)
      const used = Math.min(total, normalizeNumber(item.tokens_utilizados, 0))
      return Math.max(0, total - used) > 0
    }).length,
  }
}

async function listTopUpsWithFallback(projectId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const primary = await supabase
    .from("tokens_avulsos")
    .select("id, tokens, custo, origem, utilizado, tokens_utilizados, created_at")
    .eq("projeto_id", projectId)
    .order("created_at", { ascending: true })

  const hasSchemaError =
    primary.error &&
    /tokens_utilizados|schema cache|column/i.test(String(primary.error.message || ""))

  if (!hasSchemaError) {
    return {
      data: (primary.data ?? []).map((item) => ({
        ...item,
        tokens_utilizados: normalizeNumber(item.tokens_utilizados, item.utilizado ? item.tokens : 0),
      })),
      supportsPartialTracking: true,
      error: primary.error,
    }
  }

  const fallback = await supabase
    .from("tokens_avulsos")
    .select("id, tokens, custo, origem, utilizado, created_at")
    .eq("projeto_id", projectId)
    .order("created_at", { ascending: true })

  return {
    data: (fallback.data ?? []).map((item) => ({
      ...item,
      tokens_utilizados: item.utilizado ? normalizeNumber(item.tokens, 0) : 0,
    })),
    supportsPartialTracking: false,
    error: fallback.error,
  }
}

function buildEffectiveLimits(config, topUps) {
  return {
    inputTokens: config?.limits?.inputTokens ?? null,
    outputTokens: config?.limits?.outputTokens ?? null,
    totalTokens:
      config?.limits?.totalTokens == null
        ? topUps.availableTokens > 0
          ? topUps.availableTokens
          : null
        : config.limits.totalTokens + normalizeNumber(topUps.availableTokens, 0),
    monthlyCost: config?.limits?.monthlyCost ?? null,
  }
}

function computeCycleStatus({ config, cycleRow, topUps, nextUsage, nextCost }) {
  const effectiveLimits = buildEffectiveLimits(config, topUps)
  const percentTokens = percentage(nextUsage.totalTokens, effectiveLimits.totalTokens)
  const percentCost = percentage(nextCost, effectiveLimits.monthlyCost)
  const warning80 = (percentTokens != null && percentTokens >= 80) || (percentCost != null && percentCost >= 80)
  const warning100 = (percentTokens != null && percentTokens >= 100) || (percentCost != null && percentCost >= 100)
  const exceededTokens =
    effectiveLimits.totalTokens == null ? 0 : Math.max(0, nextUsage.totalTokens - effectiveLimits.totalTokens)
  const exceededCost =
    effectiveLimits.monthlyCost == null ? 0 : Math.max(0, nextCost - effectiveLimits.monthlyCost)
  const shouldBlock =
    config?.blocked === true ||
    (config?.autoBlock !== false &&
      !config?.allowOverage &&
      ((effectiveLimits.totalTokens != null && nextUsage.totalTokens >= effectiveLimits.totalTokens) ||
        (effectiveLimits.monthlyCost != null && nextCost >= effectiveLimits.monthlyCost)))

  return {
    effectiveLimits,
    warning80,
    warning100,
    blocked: shouldBlock,
    exceededTokens,
    exceededCost,
    previousBlocked: Boolean(cycleRow?.bloqueado),
    previousWarning80: Boolean(cycleRow?.alerta_80),
    previousWarning100: Boolean(cycleRow?.alerta_100),
  }
}

async function loadProjectBillingRuntime(projectId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const [projectPlanResult, cycleResult, plans, topUpsResult] = await Promise.all([
    supabase
      .from("projetos_planos")
      .select(
        "id, projeto_id, nome_plano, modelo_referencia, limite_tokens_input_mensal, limite_tokens_output_mensal, limite_tokens_total_mensal, limite_custo_mensal, auto_bloquear, bloqueado, bloqueado_motivo, observacoes, plano_id",
      )
      .eq("projeto_id", projectId)
      .maybeSingle(),
    supabase
      .from("projetos_ciclos_uso")
      .select(
        "id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, limite_tokens_input, limite_tokens_output, limite_tokens_total, limite_custo, custo_token_excedente, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id",
      )
      .eq("projeto_id", projectId)
      .eq("fechado", false)
      .order("data_inicio", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    listBillingPlans({ supabase }),
    listTopUpsWithFallback(projectId, { supabase }),
  ])

  const selectedPlanId = projectPlanResult.data?.plano_id ?? cycleResult.data?.plano_id ?? null
  const plan = plans.find((item) => item.id === selectedPlanId) ?? null
  const config = mapProjectBillingConfig(projectPlanResult.data ?? null, plan)

  return {
    supabase,
    plan,
    config,
    cycleRow: cycleResult.data ?? null,
    topUpRows: topUpsResult.data ?? [],
    topUps: mapTopUps(topUpsResult.data ?? []),
    supportsPartialTopUps: topUpsResult.supportsPartialTracking !== false,
  }
}

async function ensureOpenBillingCycle(projectId, deps = {}) {
  const runtime = await loadProjectBillingRuntime(projectId, deps)
  const { startIso, endIso } = getCurrentCycleWindow()

  if (runtime.cycleRow?.id) {
    const cycleStart = runtime.cycleRow.data_inicio ? new Date(runtime.cycleRow.data_inicio).toISOString() : ""
    const cycleEnd = runtime.cycleRow.data_fim ? new Date(runtime.cycleRow.data_fim).toISOString() : ""
    const startsInsideWindow = cycleStart >= startIso
    const endsInsideWindow = cycleEnd <= endIso

    if (startsInsideWindow && endsInsideWindow) {
      return runtime
    }
  }

  const payload = {
    projeto_id: projectId,
    data_inicio: startIso,
    data_fim: endIso,
    tokens_input: 0,
    tokens_output: 0,
    custo_total: 0,
    fechado: false,
    limite_tokens_input: runtime.config?.limits?.inputTokens ?? null,
    limite_tokens_output: runtime.config?.limits?.outputTokens ?? null,
    limite_tokens_total: runtime.config?.limits?.totalTokens ?? null,
    limite_custo: runtime.config?.limits?.monthlyCost ?? null,
    custo_token_excedente: runtime.config?.overageTokenCost ?? 0,
    permitir_excedente: runtime.config?.allowOverage === true,
    alerta_80: false,
    alerta_100: false,
    bloqueado: runtime.config?.blocked === true,
    excedente_tokens: 0,
    excedente_custo: 0,
    plano_id: runtime.config?.planId ?? runtime.plan?.id ?? null,
  }

  const { data, error } = await runtime.supabase
    .from("projetos_ciclos_uso")
    .insert(payload)
    .select(
      "id, projeto_id, data_inicio, data_fim, tokens_input, tokens_output, custo_total, fechado, limite_tokens_input, limite_tokens_output, limite_tokens_total, limite_custo, custo_token_excedente, permitir_excedente, alerta_80, alerta_100, bloqueado, excedente_tokens, excedente_custo, plano_id",
    )
    .maybeSingle()

  if (error || !data) {
    console.error("[billing] failed to ensure open billing cycle", error)
    return runtime
  }

  return {
    ...runtime,
    cycleRow: data,
  }
}

async function applyTopUpConsumption({ projectId, exceededTokens, topUpRows, supportsPartialTopUps, supabase }) {
  if (!projectId || exceededTokens <= 0 || !Array.isArray(topUpRows) || topUpRows.length === 0) {
    return
  }

  if (!supportsPartialTopUps) {
    return
  }

  let remainingToConsume = exceededTokens

  for (const row of topUpRows) {
    if (remainingToConsume <= 0) {
      break
    }

    const totalTokens = normalizeNumber(row.tokens, 0)
    const usedTokens = Math.min(totalTokens, normalizeNumber(row.tokens_utilizados, 0))
    const availableTokens = Math.max(0, totalTokens - usedTokens)

    if (!availableTokens) {
      continue
    }

    const consumeNow = Math.min(availableTokens, remainingToConsume)
    const nextUsedTokens = usedTokens + consumeNow

    const { error } = await supabase
      .from("tokens_avulsos")
      .update({
        tokens_utilizados: nextUsedTokens,
        utilizado: nextUsedTokens >= totalTokens,
      })
      .eq("id", row.id)

    if (error) {
      console.error("[billing] failed to consume top-up tokens", error)
      break
    }

    remainingToConsume -= consumeNow
  }
}

function buildBillingStatusLabel(status) {
  return status === "blocked" ? "bloqueio" : status === "warning100" ? "limite atingido" : "alerta preventivo"
}

function buildBillingEmailSubject({ projectName, status }) {
  const statusLabel = buildBillingStatusLabel(status)
  return `[InfraStudio] Billing ${statusLabel} - ${projectName || "Projeto"}`
}

function buildBillingEmailHtml({ recipientName, projectName, projectSlug, status, summary }) {
  const statusLabel = buildBillingStatusLabel(status)
  const totalTokens = new Intl.NumberFormat("pt-BR").format(Number(summary.totalTokens || 0))
  const totalCost = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(summary.totalCost || 0))
  const tokenLimit =
    summary.effectiveTokenLimit == null
      ? "sem limite"
      : new Intl.NumberFormat("pt-BR").format(Number(summary.effectiveTokenLimit || 0))
  const costLimit =
    summary.effectiveCostLimit == null
      ? "sem limite"
      : new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(Number(summary.effectiveCostLimit || 0))

  return `
    <div style="font-family:Arial,sans-serif;background:#08111f;color:#e2e8f0;padding:24px">
      <div style="max-width:640px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:24px">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7dd3fc">Billing InfraStudio</p>
        <h1 style="margin:0 0 16px;font-size:24px;color:#fff">Aviso de cobranca do projeto ${projectName || "Projeto"}</h1>
        <p style="margin:0 0 16px;line-height:1.7">Ola ${recipientName || "time"}, o projeto <strong>${projectName || "Projeto"}</strong>${projectSlug ? ` (${projectSlug})` : ""} entrou em estado de <strong>${statusLabel}</strong>.</p>
        <div style="margin:0 0 20px;padding:16px;border-radius:12px;background:#111827;border:1px solid rgba(148,163,184,.14)">
          <p style="margin:0 0 8px">Tokens consumidos: <strong>${totalTokens}</strong></p>
          <p style="margin:0 0 8px">Limite efetivo de tokens: <strong>${tokenLimit}</strong></p>
          <p style="margin:0 0 8px">Custo acumulado: <strong>${totalCost}</strong></p>
          <p style="margin:0">Limite efetivo de custo: <strong>${costLimit}</strong></p>
        </div>
        <p style="margin:0;line-height:1.7;color:#94a3b8">Se precisar, ajuste o plano ou libere novo ciclo no painel de billing da InfraStudio.</p>
      </div>
    </div>
  `
}

async function listBillingEmailRecipientsByProjectId(projectId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const recipients = new Map()

  const [projectResult, membershipsResult] = await Promise.all([
    supabase
      .from("projetos")
      .select("id, nome, slug, owner_user_id")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("usuarios_projetos")
      .select("usuario_id, usuario:usuarios(nome, email)")
      .eq("projeto_id", projectId),
  ])

  if (projectResult.error) {
    console.error("[billing] failed to load project for email recipients", projectResult.error)
  }

  if (membershipsResult.error) {
    console.error("[billing] failed to load billing email recipients", membershipsResult.error)
  }

  for (const row of membershipsResult.data ?? []) {
    const email = row.usuario?.email?.trim().toLowerCase()
    if (!email) {
      continue
    }

    recipients.set(email, {
      email,
      nome: row.usuario?.nome?.trim() || "Usuario",
    })
  }

  const ownerUserId = projectResult.data?.owner_user_id ?? null
  if (ownerUserId) {
    const ownerResult = await supabase.from("usuarios").select("nome, email").eq("id", ownerUserId).maybeSingle()
    if (ownerResult.error) {
      console.error("[billing] failed to load project owner for email recipients", ownerResult.error)
    } else {
      const ownerEmail = ownerResult.data?.email?.trim().toLowerCase()
      if (ownerEmail) {
        recipients.set(ownerEmail, {
          email: ownerEmail,
          nome: ownerResult.data?.nome?.trim() || "Responsavel",
        })
      }
    }
  }

  return {
    projectName: projectResult.data?.nome?.trim() || "Projeto",
    projectSlug: projectResult.data?.slug?.trim() || "",
    recipients: Array.from(recipients.values()),
  }
}

async function sendBillingEmailTransition({ status, summary, projectName, projectSlug, recipients }) {
  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: buildBillingEmailSubject({ projectName, status }),
        html: buildBillingEmailHtml({
          recipientName: recipient.nome,
          projectName,
          projectSlug,
          status,
          summary,
        }),
      })
    } catch (error) {
      console.error("[billing] failed to send billing alert email", {
        email: recipient.email,
        status,
        error,
      })
    }
  }
}

async function logBillingTransition({ projectId, status, summary, recipients, senderChannel, deps = {} }) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const recipientNumbers = (recipients ?? []).map((item) => item.numero).filter(Boolean)
  const emailTargets = deps.emailRecipients ?? []
  const projectName = deps.projectName ?? "Projeto"
  const projectSlug = deps.projectSlug ?? ""
  const logPayload = {
    event: status,
    projetoId: projectId,
    senderChannelId: senderChannel?.id ?? null,
    senderChannelNumber: senderChannel?.number ?? null,
    recipients: recipientNumbers,
    totalTokens: summary.totalTokens,
    totalCost: summary.totalCost,
    availableCreditTokens: summary.availableCreditTokens,
    effectiveTokenLimit: summary.effectiveTokenLimit,
    effectiveCostLimit: summary.effectiveCostLimit,
    emailRecipients: emailTargets.map((item) => item.email),
  }

  await createLogEntry(
    {
      projectId,
      type: "billing_event",
      origin: "billing_runtime",
      level: status === "blocked" ? "warn" : "info",
      description:
        status === "blocked"
          ? "Projeto bloqueado pelo billing."
          : status === "warning100"
            ? "Billing atingiu 100% do limite."
            : "Billing atingiu 80% do limite.",
      payload: logPayload,
    },
    { supabase },
  )

  if (recipientNumbers.length > 0) {
    await createLogEntry(
      {
        projectId,
        type: "billing_whatsapp_alert",
        origin: "billing_runtime",
        level: "info",
      description: `Alerta de billing preparado para ${recipientNumbers.length} contato(s) do WhatsApp pelo canal central da InfraStudio.`,
      payload: logPayload,
    },
    { supabase },
  )

  if (emailTargets.length > 0) {
    await sendBillingEmailTransition({
      status,
      summary,
      projectName,
      projectSlug,
      recipients: emailTargets,
    })

    await createLogEntry(
      {
        projectId,
        type: "billing_email_alert",
        origin: "billing_runtime",
        level: "info",
        description: `Alerta de billing enviado por email para ${emailTargets.length} destinatario(s).`,
        payload: logPayload,
      },
      { supabase },
    )
  }
}
}

function buildUsageWindow(currentCycle) {
  const start = currentCycle?.data_inicio ? new Date(currentCycle.data_inicio).toISOString() : null
  const end = currentCycle?.data_fim ? new Date(currentCycle.data_fim).toISOString() : null

  return { start, end }
}

async function listUsageByUser({ supabase, projectId, currentCycle, usuarioId = null, userEmail = "" }) {
  if (!projectId) {
    return []
  }

  const window = buildUsageWindow(currentCycle)
  let query = supabase
    .from("consumos")
    .select("usuario_id, tokens_input, tokens_output, custo_total, created_at, usuario:usuarios(nome, email)")
    .eq("projeto_id", projectId)
    .order("created_at", { ascending: false })

  if (usuarioId) {
    query = query.eq("usuario_id", usuarioId)
  }

  if (window.start) {
    query = query.gte("created_at", window.start)
  }

  if (window.end) {
    query = query.lte("created_at", window.end)
  }

  const { data, error } = await query

  if (error) {
    console.error("[billing] failed to list usage by user", error)
    return []
  }

  const normalizedEmailFilter = String(userEmail || "").trim().toLowerCase()
  const aggregated = new Map()

  for (const row of data ?? []) {
    const email = row.usuario?.email?.trim().toLowerCase() || ""
    if (normalizedEmailFilter && email !== normalizedEmailFilter) {
      continue
    }

    const key = row.usuario_id || email || "desconhecido"
    const current = aggregated.get(key) ?? {
      usuarioId: row.usuario_id ?? null,
      email,
      name: row.usuario?.nome?.trim() || email || "Usuario",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    }

    current.inputTokens += normalizeNumber(row.tokens_input, 0)
    current.outputTokens += normalizeNumber(row.tokens_output, 0)
    current.totalTokens += normalizeNumber(row.tokens_input, 0) + normalizeNumber(row.tokens_output, 0)
    current.totalCost += normalizeNumber(row.custo_total, 0)

    aggregated.set(key, current)
  }

  return Array.from(aggregated.values()).sort((a, b) => b.totalTokens - a.totalTokens)
}

function sumUsageEntries(entries) {
  return (entries ?? []).reduce(
    (accumulator, item) => ({
      inputTokens: accumulator.inputTokens + normalizeNumber(item.inputTokens, 0),
      outputTokens: accumulator.outputTokens + normalizeNumber(item.outputTokens, 0),
      totalTokens: accumulator.totalTokens + normalizeNumber(item.totalTokens, 0),
      totalCost: accumulator.totalCost + normalizeNumber(item.totalCost, 0),
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
    },
  )
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
    whatsappAlerts: input.whatsappAlerts ?? {
      enabledCount: 0,
      recipients: [],
    },
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
    const [projectResult, projectPlanResult, subscriptionResult, cycleResult, topUpsResult, plans, whatsappAlertRecipients, alertSenderChannel] =
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
        listTopUpsWithFallback(projectId, { supabase }),
        listBillingPlans({ supabase }),
        listBillingAlertRecipientsByProjectId(projectId, { supabase }),
        getPrimaryWhatsAppChannelByProjectId(INFRASTUDIO_BILLING_ALERT_PROJECT_ID, { supabase }),
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
    warnOptionalBillingLoad("top-up tokens", topUpsResult.error)

    const selectedPlanId =
      projectPlanResult.data?.plano_id ?? subscriptionResult.data?.plano_id ?? cycleResult.data?.plano_id ?? null
    const plan = plans.find((item) => item.id === selectedPlanId) ?? null
    const usageByUser =
      deps.includeUsageByUser || deps.usuarioId || deps.userEmail
        ? await listUsageByUser({
            supabase,
            projectId,
            currentCycle: cycleResult.data ?? null,
            usuarioId: deps.usuarioId ?? null,
            userEmail: deps.userEmail ?? "",
          })
        : []

    const snapshot = buildBillingSnapshot({
      project: projectResult.data,
      plan,
      projectPlan: projectPlanResult.data ?? null,
      subscription: subscriptionResult.data ?? null,
      currentCycle: cycleResult.data ?? null,
      topUps: topUpsResult.data ?? [],
      whatsappAlerts: {
        senderChannelId: alertSenderChannel?.id ?? null,
        senderChannelNumber: alertSenderChannel?.number ?? null,
        enabledCount: whatsappAlertRecipients.length,
        recipients: whatsappAlertRecipients.map((item) => ({
          id: item.id,
          nome: item.nome,
          numero: item.numero,
          canalWhatsappId: item.canalWhatsappId ?? null,
        })),
      },
    })

    if (deps.usuarioId || deps.userEmail) {
      const scopedUsage = sumUsageEntries(usageByUser)

      return {
        ...snapshot,
        scope: {
          kind: "user",
          usuarioId: deps.usuarioId ?? null,
          email: usageByUser[0]?.email || String(deps.userEmail || "").trim().toLowerCase() || "",
        },
        currentCycle: snapshot.currentCycle
          ? {
              ...snapshot.currentCycle,
              usage: {
                inputTokens: scopedUsage.inputTokens,
                outputTokens: scopedUsage.outputTokens,
                totalTokens: scopedUsage.totalTokens,
                totalCost: scopedUsage.totalCost,
              },
              usagePercent: {
                totalTokens: percentage(scopedUsage.totalTokens, snapshot.currentCycle.limits?.totalTokens),
                monthlyCost: percentage(scopedUsage.totalCost, snapshot.currentCycle.limits?.monthlyCost),
              },
            }
          : snapshot.currentCycle,
        topUps: {
          totalTokens: 0,
          totalCost: 0,
          availableCount: 0,
        },
      }
    }

    return {
      ...snapshot,
      scope: {
        kind: "project",
      },
      usageByUser,
    }
  } catch (error) {
    console.error("[billing] failed to load project billing snapshot", error)
    return null
  }
}

export async function listAdminBillingProjects(deps = {}) {
  try {
    const supabase = deps.supabase ?? getSupabaseAdminClient()
    let query = supabase
      .from("projetos")
      .select("id, nome, slug, status, modo_cobranca, is_demo")
      .order("nome", { ascending: true })

    if (deps.projectId) {
      query = query.eq("id", deps.projectId)
    }

    const { data, error } = await query

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
        billing: await getProjectBillingSnapshot(project.id, {
          supabase,
          includeUsageByUser: true,
          userEmail: deps.userEmail ?? "",
        }),
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

export async function verifyProjectBillingAccess(projectId, deps = {}) {
  if (!projectId) {
    return null
  }

  const runtime = await ensureOpenBillingCycle(projectId, deps)
  const cycleUsage = {
    inputTokens: normalizeNumber(runtime.cycleRow?.tokens_input, 0),
    outputTokens: normalizeNumber(runtime.cycleRow?.tokens_output, 0),
    totalTokens: normalizeNumber(runtime.cycleRow?.tokens_input, 0) + normalizeNumber(runtime.cycleRow?.tokens_output, 0),
  }
  const totalCost = normalizeNumber(runtime.cycleRow?.custo_total, 0)
  const status = computeCycleStatus({
    config: runtime.config,
    cycleRow: runtime.cycleRow,
    topUps: runtime.topUps,
    nextUsage: cycleUsage,
    nextCost: totalCost,
  })

  if (!status.blocked) {
    return {
      allowed: true,
      code: null,
      message: null,
      summary: {
        totalTokens: cycleUsage.totalTokens,
        totalCost,
        availableCreditTokens: runtime.topUps.availableTokens,
      },
    }
  }

  return {
    allowed: false,
    code: runtime.config?.blocked ? "manual_block" : "limit_reached",
    message:
      runtime.config?.blockedReason ||
      "O limite mensal deste projeto foi atingido. Fale com o administrador para liberar novo ciclo ou ajustar o plano.",
    summary: {
      totalTokens: cycleUsage.totalTokens,
      totalCost,
      availableCreditTokens: runtime.topUps.availableTokens,
    },
  }
}

export async function registerProjectBillingUsage(projectId, tokens, cost, details = {}, deps = {}) {
  if (!projectId) {
    return null
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const runtime = await ensureOpenBillingCycle(projectId, { supabase })
  const inputTokens = normalizeNumber(details.tokensInput, 0)
  const outputTokens = normalizeNumber(details.tokensOutput, 0)
  const totalTokensToAdd = normalizeNumber(tokens, inputTokens + outputTokens)
  const costToAdd = normalizeNumber(cost, 0)

  const { error: usageError } = await supabase.from("consumos").insert({
    projeto_id: projectId,
    usuario_id: details.usuarioId ?? null,
    origem: details.origem ?? "chat:web:unknown_provider:unknown_route:unknown_domain",
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    custo_total: costToAdd,
    referencia_id: details.referenciaId ?? null,
  })

  if (usageError) {
    console.error("[billing] failed to insert usage record", usageError)
    return null
  }

  const nextUsage = {
    inputTokens: normalizeNumber(runtime.cycleRow?.tokens_input, 0) + inputTokens,
    outputTokens: normalizeNumber(runtime.cycleRow?.tokens_output, 0) + outputTokens,
    totalTokens:
      normalizeNumber(runtime.cycleRow?.tokens_input, 0) +
      normalizeNumber(runtime.cycleRow?.tokens_output, 0) +
      totalTokensToAdd,
  }
  const nextCost = normalizeNumber(runtime.cycleRow?.custo_total, 0) + costToAdd
  const status = computeCycleStatus({
    config: runtime.config,
    cycleRow: runtime.cycleRow,
    topUps: runtime.topUps,
    nextUsage,
    nextCost,
  })

  await applyTopUpConsumption({
    projectId,
    exceededTokens: status.exceededTokens,
    topUpRows: runtime.topUpRows,
    supportsPartialTopUps: runtime.supportsPartialTopUps,
    supabase,
  })

  const refreshedTopUpsResult = await listTopUpsWithFallback(projectId, { supabase })
  const refreshedTopUps = mapTopUps(refreshedTopUpsResult.data ?? [])

  const { error: cycleUpdateError } = await supabase
    .from("projetos_ciclos_uso")
    .update({
      tokens_input: nextUsage.inputTokens,
      tokens_output: nextUsage.outputTokens,
      custo_total: nextCost,
      alerta_80: status.warning80,
      alerta_100: status.warning100,
      bloqueado: status.blocked,
      excedente_tokens: status.exceededTokens,
      excedente_custo: status.exceededCost,
    })
    .eq("id", runtime.cycleRow?.id)

  if (cycleUpdateError) {
    console.error("[billing] failed to update billing cycle", cycleUpdateError)
    return null
  }

  const [recipients, senderChannel, emailContext] = await Promise.all([
    listBillingAlertRecipientsByProjectId(projectId, { supabase }),
    getPrimaryWhatsAppChannelByProjectId(INFRASTUDIO_BILLING_ALERT_PROJECT_ID, { supabase }),
    listBillingEmailRecipientsByProjectId(projectId, { supabase }),
  ])
  const summary = {
    totalTokens: nextUsage.totalTokens,
    totalCost: nextCost,
    availableCreditTokens: refreshedTopUps.availableTokens,
    effectiveTokenLimit: status.effectiveLimits.totalTokens,
    effectiveCostLimit: status.effectiveLimits.monthlyCost,
  }

  if (!status.previousWarning80 && status.warning80) {
    await logBillingTransition({
      projectId,
      status: "warning80",
      summary,
      recipients,
      senderChannel,
      deps: {
        supabase,
        emailRecipients: emailContext.recipients,
        projectName: emailContext.projectName,
        projectSlug: emailContext.projectSlug,
      },
    })
  }

  if (!status.previousWarning100 && status.warning100) {
    await logBillingTransition({
      projectId,
      status: "warning100",
      summary,
      recipients,
      senderChannel,
      deps: {
        supabase,
        emailRecipients: emailContext.recipients,
        projectName: emailContext.projectName,
        projectSlug: emailContext.projectSlug,
      },
    })
  }

  if (!status.previousBlocked && status.blocked) {
    await logBillingTransition({
      projectId,
      status: "blocked",
      summary,
      recipients,
      senderChannel,
      deps: {
        supabase,
        emailRecipients: emailContext.recipients,
        projectName: emailContext.projectName,
        projectSlug: emailContext.projectSlug,
      },
    })
  }

  return {
    ok: true,
    totalTokens: nextUsage.totalTokens,
    totalCost: nextCost,
    blocked: status.blocked,
  }
}
