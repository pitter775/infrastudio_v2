import { recordJsonApiUsage } from "@/lib/api-usage-metrics"
import {
  appendAdminConversationMessage,
  appendAdminConversationSystemMessage,
  deleteAdminConversation,
  getAdminConversationDetail,
  resolveAdminReplyChannel,
} from "@/lib/admin-conversations"
import { claimHumanHandoff, touchHumanHandoff } from "@/lib/chat-handoffs"
import { getChatById } from "@/lib/chats"
import { getSessionUser } from "@/lib/session"
import { sendWhatsAppTextMessage } from "@/lib/whatsapp-channels"

function getWhatsAppReplyTarget(chat) {
  const whatsapp = chat?.contexto?.whatsapp
  if (!whatsapp || typeof whatsapp !== "object" || Array.isArray(whatsapp)) {
    return null
  }

  const channelId = String(whatsapp.channelId || "").trim()
  const to = String(
    whatsapp.remotePhone ||
      whatsapp.remetente ||
      whatsapp.from ||
      whatsapp.phone ||
      chat.identificadorExterno ||
      ""
  ).trim()

  return channelId && to ? { channelId, to } : null
}

export async function GET(request, { params }) {
  const startedAt = Date.now()
  const user = await getSessionUser()

  if (!user) {
    const payload = { success: false, error: "Não autenticado." }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "GET",
      status: 401,
      elapsedMs: Date.now() - startedAt,
      source: "admin_attendance_detail",
      payload,
    })
    return Response.json(payload, { status: 401 })
  }

  const { id } = await params
  const url = new URL(request.url)
  const chatIds = String(url.searchParams.get("chatIds") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const limit = Number(url.searchParams.get("limit") || 30)
  const before = String(url.searchParams.get("before") || "").trim()

  const conversation = await getAdminConversationDetail({ chatId: id, chatIds, limit, before }, user)
  if (!conversation) {
    const payload = { success: false, error: "Conversa não encontrada" }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "GET",
      status: 404,
      elapsedMs: Date.now() - startedAt,
      userId: user.id,
      source: "admin_attendance_detail",
      payload,
    })
    return Response.json(payload, { status: 404 })
  }

  const payload = { success: true, conversation }
  recordJsonApiUsage({
    route: "/api/admin/conversations/[id]/messages",
    method: "GET",
    status: 200,
    elapsedMs: Date.now() - startedAt,
    userId: user.id,
    projectId: conversation?.projectId || conversation?.projetoId || null,
    source: "admin_attendance_detail",
    payload,
  })
  return Response.json(payload)
}

export async function POST(request, { params }) {
  const startedAt = Date.now()
  const user = await getSessionUser()

  if (!user) {
    const payload = { success: false, error: "Não autenticado." }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "POST",
      status: 401,
      elapsedMs: Date.now() - startedAt,
      source: "admin_attendance_send",
      payload,
    })
    return Response.json(payload, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const texto = String(body.texto ?? "").trim()
  const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0
  const chat = await getChatById(id)

  if (!chat) {
    const payload = { success: false, error: "Conversa não encontrada" }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "POST",
      status: 404,
      elapsedMs: Date.now() - startedAt,
      userId: user.id,
      source: "admin_attendance_send",
      payload,
    })
    return Response.json(payload, { status: 404 })
  }

  if (!texto && !hasAttachments) {
    const payload = { success: false, error: "Mensagem vazia" }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "POST",
      status: 400,
      elapsedMs: Date.now() - startedAt,
      userId: user.id,
      projectId: chat.projetoId,
      source: "admin_attendance_send",
      payload,
    })
    return Response.json(payload, { status: 400 })
  }

  const handoff = await claimHumanHandoff({
    chatId: chat.id,
    projetoId: chat.projetoId,
    usuarioId: user.id,
    canalWhatsappId: chat.contexto?.whatsapp?.channelId ?? null,
  })
  await touchHumanHandoff({ chatId: chat.id })

  const replyChannel = await resolveAdminReplyChannel(chat)
  const message = await appendAdminConversationMessage(id, texto, body.attachments, user, { canal: replyChannel })

  if (message === false) {
    const payload = { success: false, error: "Acesso negado" }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "POST",
      status: 403,
      elapsedMs: Date.now() - startedAt,
      userId: user.id,
      projectId: chat.projetoId,
      source: "admin_attendance_send",
      payload,
    })
    return Response.json(payload, { status: 403 })
  }

  if (!message) {
    const payload = { success: false, error: "Conversa não encontrada" }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "POST",
      status: 404,
      elapsedMs: Date.now() - startedAt,
      userId: user.id,
      projectId: chat.projetoId,
      source: "admin_attendance_send",
      payload,
    })
    return Response.json(payload, { status: 404 })
  }

  const whatsappTarget = replyChannel === "whatsapp" ? getWhatsAppReplyTarget(chat) : null
  const whatsappDelivery =
    whatsappTarget && texto
      ? await sendWhatsAppTextMessage({
          channelId: whatsappTarget.channelId,
          to: whatsappTarget.to,
          message: texto,
        })
      : null
  const deliveryFailureMessage =
    whatsappDelivery?.ok === false
      ? await appendAdminConversationSystemMessage(
          id,
          `Falha ao enviar mensagem manual no WhatsApp: ${whatsappDelivery.error || "erro desconhecido"}`,
          {
            whatsappDelivery: {
              ok: false,
              error: whatsappDelivery.error || "erro desconhecido",
              channelId: whatsappTarget?.channelId ?? null,
              to: whatsappTarget?.to ?? null,
            },
          },
        )
      : null

  const payload = {
    success: true,
    message,
    deliveryFailureMessage,
    handoff,
    status: handoff?.status === "human" ? "humano" : "ia",
    whatsappDelivery,
  }
  recordJsonApiUsage({
    route: "/api/admin/conversations/[id]/messages",
    method: "POST",
    status: 200,
    elapsedMs: Date.now() - startedAt,
    userId: user.id,
    projectId: chat.projetoId,
    source: "admin_attendance_send",
    payload,
  })
  return Response.json(payload)
}

export async function DELETE(request, { params }) {
  const startedAt = Date.now()
  const user = await getSessionUser()

  if (!user) {
    const payload = { success: false, error: "Não autenticado." }
    recordJsonApiUsage({
      route: "/api/admin/conversations/[id]/messages",
      method: "DELETE",
      status: 401,
      elapsedMs: Date.now() - startedAt,
      source: "admin_attendance_clear",
      payload,
    })
    return Response.json(payload, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const chatIds = Array.isArray(body.chatIds) ? body.chatIds : []
  const result = await deleteAdminConversation(
    {
      chatId: id,
      chatIds,
      confirmation: body.confirmation,
    },
    user,
  )

  const payload = result.ok
    ? { success: true, deleted: result.deleted }
    : { success: false, error: result.error || "Não foi possível excluir a conversa." }

  recordJsonApiUsage({
    route: "/api/admin/conversations/[id]/messages",
    method: "DELETE",
    status: result.status,
    elapsedMs: Date.now() - startedAt,
    userId: user.id,
    source: "admin_attendance_clear",
    payload,
  })

  return Response.json(payload, { status: result.status })
}
