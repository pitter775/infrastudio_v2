import { listReadNoticeKeys, markNoticeKeysAsRead } from "@/lib/avisos"
import { listAdminConversations } from "@/lib/admin-conversations"
import { listAdminBillingProjects } from "@/lib/billing"
import { listFeedbacks } from "@/lib/feedbacks"
import { getSessionUser } from "@/lib/session"

function getAttendanceItems(conversations) {
  return conversations
    .filter((conversation) => {
      const lastMessage = conversation.mensagens.at(-1)
      return conversation.status === "pendente_humano" || lastMessage?.autor === "cliente"
    })
    .map((conversation) => {
      const lastMessage = conversation.mensagens.at(-1)
      const updatedAt = lastMessage?.createdAt || conversation.updatedAt || new Date(0).toISOString()

      return {
        id: `attendance-${conversation.id}`,
        kind: "attendance",
        title: conversation.cliente.nome || "Conversa sem nome",
        description: lastMessage?.texto || "Conversa aguardando atendimento humano.",
        href: `/admin/atendimento?conversa=${conversation.id}`,
        readKey: `attendance:${conversation.id}:${updatedAt}`,
        count: 1,
        createdAt: updatedAt,
      }
    })
}

function getFeedbackItems(feedbacks, user) {
  const isAdmin = user?.role === "admin"

  return feedbacks
    .filter((item) =>
      isAdmin ? item.status === "novo" || item.possuiMensagemNaoLidaAdmin : item.possuiMensagemNaoLidaUsuario,
    )
    .map((item) => ({
      id: `feedback-${item.id}`,
      kind: "feedback",
      title: item.assunto || "Solicitação",
      description: item.ultimaMensagem || "Solicitação com atualização pendente.",
      href: `/admin/feedback/${item.id}`,
      readKey: `feedback:${item.id}:${item.ultimaMensagemAt || item.updatedAt || item.createdAt || ""}`,
      count: isAdmin ? item.mensagensNaoLidasAdmin || 1 : item.mensagensNaoLidasUsuario || 1,
      createdAt: item.ultimaMensagemAt || item.updatedAt || item.createdAt || new Date(0).toISOString(),
    }))
}

function getBillingItems(projects) {
  return projects
    .filter((project) => project.billing?.status?.blocked || project.billing?.status?.warning80 || project.billing?.status?.warning100)
    .map((project) => ({
      id: `billing-${project.id}`,
      kind: "billing",
      title: project.name || "Projeto",
      description: project.billing?.status?.blocked
        ? "Projeto bloqueado por billing."
        : project.billing?.status?.warning100
          ? "Limite de billing atingido."
          : "Billing proximo do limite.",
      href: `/admin/billing?projeto=${project.id}`,
      readKey: `billing:${project.id}:${project.billing?.currentCycle?.id || project.billing?.currentCycle?.endDate || ""}:${project.billing?.status?.blocked ? "blocked" : project.billing?.status?.warning100 ? "warning100" : "warning80"}`,
      count: 1,
      createdAt: project.billing?.currentCycle?.endDate || new Date(0).toISOString(),
    }))
}

export async function GET(request) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ error: "Acesso negado." }, { status: 401 })
  }

  const summaryOnly = new URL(request.url).searchParams.get("summary") === "1"
  const [conversations, feedbackResult, billingProjects] = await Promise.all([
    listAdminConversations(user),
    listFeedbacks({ user, ordenacao: "pendentes" }),
    user.role === "admin" ? listAdminBillingProjects() : Promise.resolve([]),
  ])

  const attendanceItems = getAttendanceItems(conversations)
  const feedbackItems = getFeedbackItems(feedbackResult.feedbacks ?? [], user)
  const billingItems = getBillingItems(billingProjects)
  const items = [...attendanceItems, ...feedbackItems, ...billingItems]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 40)
  const readKeys = await listReadNoticeKeys(user.id, items.map((item) => item.readKey))
  const unreadItems = items.filter((item) => !readKeys.has(item.readKey))
  const summary = {
    attendance: unreadItems.filter((item) => item.kind === "attendance").length,
    feedback: unreadItems.filter((item) => item.kind === "feedback").length,
    notifications: unreadItems.length,
  }

  if (summaryOnly) {
    return Response.json({ summary }, { status: 200 })
  }

  return Response.json({ summary, items: unreadItems }, { status: 200 })
}

export async function POST(request) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ error: "Acesso negado." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []
  const ok = await markNoticeKeysAsRead(user.id, items)

  if (!ok) {
    return Response.json({ error: "Nao foi possivel marcar os avisos como lidos." }, { status: 500 })
  }

  return Response.json({ ok: true }, { status: 200 })
}
