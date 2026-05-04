import "server-only"

import { getProjectBillingSnapshot, listAdminBillingProjects } from "@/lib/billing"
import { listFeedbacks } from "@/lib/feedbacks"
import { isNoisyOperationalLog } from "@/lib/logs"
import { listProjectsForUser } from "@/lib/projetos"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

function formatStatusLabel(value) {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "bloqueado") {
    return "bloqueado"
  }
  if (normalized === "alerta") {
    return "alerta"
  }
  return "ok"
}

function getScopeProjectIds(user, projects) {
  if (user?.role === "admin") {
    return null
  }

  return projects.map((project) => project.id)
}

async function countUsuarios(scopeProjectIds, user) {
  if (user?.role !== "admin") {
    return user?.id ? 1 : 0
  }

  const supabase = getSupabaseAdminClient()

  if (Array.isArray(scopeProjectIds) && scopeProjectIds.length === 0) {
    return 0
  }

  if (!scopeProjectIds) {
    const { count, error } = await supabase.from("usuarios").select("id", { count: "exact", head: true })

    if (error) {
      console.error("[dashboard] failed to count usuarios", error)
      return 0
    }

    return count ?? 0
  }

  const { data, error } = await supabase
    .from("usuarios_projetos")
    .select("usuario_id")
    .in("projeto_id", scopeProjectIds)

  if (error) {
    console.error("[dashboard] failed to count scoped usuarios", error)
    return 0
  }

  return new Set((data ?? []).map((item) => item.usuario_id).filter(Boolean)).size
}

async function listScopedChats(scopeProjectIds, user) {
  if (Array.isArray(scopeProjectIds) && scopeProjectIds.length === 0) {
    return []
  }

  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("chats")
    .select("id, projeto_id, titulo, updated_at, canal, total_tokens, total_custo")
    .neq("canal", "admin_agent_test")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(200)

  if (user?.role !== "admin" && user?.id) {
    query = query.eq("usuario_id", user.id)
  } else if (scopeProjectIds?.length) {
    query = query.in("projeto_id", scopeProjectIds)
  }

  const { data, error } = await query

  if (error) {
    console.error("[dashboard] failed to list chats", error)
    return []
  }

  return (data ?? []).map((chat) => ({
    id: chat.id,
    projectId: chat.projeto_id ?? null,
    title: chat.titulo?.trim() || "Nova conversa",
    updatedAt: chat.updated_at ?? null,
    channel: chat.canal?.trim() || "web",
    totalTokens: Number(chat.total_tokens ?? 0),
    totalCost: Number(chat.total_custo ?? 0),
  }))
}

async function listScopedLogs(scopeProjectIds, user) {
  if (user?.role !== "admin") {
    return []
  }

  if (Array.isArray(scopeProjectIds) && scopeProjectIds.length === 0) {
    return []
  }

  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("logs")
    .select("id, projeto_id, tipo, origem, descricao, created_at, payload")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(100)

  if (scopeProjectIds?.length) {
    query = query.in("projeto_id", scopeProjectIds)
  }

  const { data, error } = await query

  if (error) {
    console.error("[dashboard] failed to list logs", error)
    return []
  }

  return (data ?? [])
    .map((item) => ({
      id: item.id,
      projectId: item.projeto_id ?? null,
      type: item.tipo?.trim() || "system",
      origin: item.origem?.trim() || "system",
      description: item.descricao?.trim() || "Evento operacional",
      createdAt: item.created_at ?? null,
      level: String(item.payload?.level || "").trim().toLowerCase() || "info",
      payload: item.payload ?? {},
    }))
    .filter((item) => !isNoisyOperationalLog(item))
}

async function listScopedFeedbacks(user) {
  const result = await listFeedbacks({
    user,
    ordenacao: user?.role === "admin" ? "pendentes" : "recentes",
  })

  return result.feedbacks ?? []
}

async function listScopedBilling(user, projects) {
  if (user?.role === "admin") {
    return listAdminBillingProjects()
  }

  const snapshots = await Promise.all(
    projects.map(async (project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      billing: await getProjectBillingSnapshot(project.id),
    })),
  )

  return snapshots
}

function buildChannelUsage(chats) {
  const buckets = new Map()

  for (const chat of chats) {
    const key =
      chat.channel === "whatsapp"
        ? "whatsapp"
        : chat.channel.includes("api")
          ? "api"
          : "web"
    const label = key === "whatsapp" ? "WhatsApp" : key === "api" ? "API" : "Web"
    const current = buckets.get(key) ?? { key, label, totalChats: 0, totalTokens: 0 }
    current.totalChats += 1
    current.totalTokens += chat.totalTokens
    buckets.set(key, current)
  }

  return [...buckets.values()].sort((left, right) => right.totalTokens - left.totalTokens)
}

function buildTopProjects(projects, billingProjects) {
  return projects
    .map((project) => {
      const billingProject = billingProjects.find((item) => item.id === project.id)
      const cycle = billingProject?.billing?.currentCycle
      const status = billingProject?.billing?.status

      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        status: formatStatusLabel(status?.blocked ? "bloqueado" : status?.warning100 || status?.warning80 ? "alerta" : "ok"),
        planName: billingProject?.billing?.projectPlan?.planName || "Sem billing",
        totalTokens: Number(cycle?.usage?.totalTokens ?? 0),
        totalCost: Number(cycle?.usage?.totalCost ?? 0),
        percentTokens: Number(cycle?.usagePercent?.totalTokens ?? 0),
      }
    })
    .sort((left, right) => right.totalTokens - left.totalTokens)
    .slice(0, 5)
}

export function buildDashboardOverviewSummary({
  projects,
  usersCount,
  chats,
  feedbacks,
  logs,
  billingProjects,
  isAdmin,
}) {
  const activeProjects = projects.filter((project) => project.status === "ativo").length
  const whatsappChats = chats.filter((chat) => chat.channel === "whatsapp").length
  const siteChats = chats.length - whatsappChats
  const latestChat = chats[0] ?? null
  const pendingFeedbacks = feedbacks.filter((item) => item.possuiMensagemNaoLidaAdmin).length
  const blockedBilling = billingProjects.filter((item) => item.billing?.status?.blocked).length
  const warningBilling = billingProjects.filter(
    (item) => item.billing?.status?.warning80 || item.billing?.status?.warning100,
  ).length
  const recentErrors = logs.filter((item) => item.level === "error").length

  return {
    cards: [
      { label: isAdmin ? "Projetos" : "Meus projetos", value: projects.length, detail: `${activeProjects} ativos` },
      { label: isAdmin ? "Usuarios" : "Perfil", value: usersCount, detail: isAdmin ? "com acesso ao contexto" : "dados da sua conta" },
      { label: isAdmin ? "Chats" : "Meus chats", value: chats.length, detail: `${whatsappChats} WhatsApp / ${siteChats} web` },
      { label: isAdmin ? "Solicitações" : "Minhas solicitações", value: feedbacks.length, detail: `${pendingFeedbacks} pendentes` },
      { label: "Billing", value: blockedBilling, detail: warningBilling ? `${warningBilling} em alerta` : "sem alerta" },
      { label: "Erros", value: recentErrors, detail: isAdmin ? "ultimos eventos do laboratorio" : "restrito ao admin" },
    ],
    practicalSummary:
      projects.length > 0
        ? isAdmin
          ? `Base com ${projects.length} projeto(s), ${chats.length} chat(s) recentes e ${pendingFeedbacks} solicitação(ões) pendente(s) para o admin.`
          : `Seu painel mostra ${projects.length} projeto(s), ${chats.length} chat(s) e ${feedbacks.length} solicitação(ões) ligadas ao seu acesso.`
        : "Ainda nao existem projetos suficientes para consolidar um dashboard operacional.",
    latestChat,
    channelUsage: buildChannelUsage(chats),
    topProjects: buildTopProjects(projects, billingProjects),
    recentLogs: logs.slice(0, 6),
  }
}

export async function getDashboardOverview(user) {
  const projects = await listProjectsForUser(user)
  const scopeProjectIds = getScopeProjectIds(user, projects)
  const [usersCount, chats, feedbacks, logs, billingProjects] = await Promise.all([
    countUsuarios(scopeProjectIds, user),
    listScopedChats(scopeProjectIds, user),
    listScopedFeedbacks(user),
    listScopedLogs(scopeProjectIds, user),
    listScopedBilling(user, projects),
  ])

  return {
    userName: user?.name || "Usuario",
    role: user?.role || "viewer",
    projects,
    usersCount,
    chats,
    feedbacks,
    logs,
    billingProjects,
    summary: buildDashboardOverviewSummary({
      projects,
      usersCount,
      chats,
      feedbacks,
      logs,
      billingProjects,
      isAdmin: user?.role === "admin",
    }),
  }
}
