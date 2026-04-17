import { appendAdminConversationMessage } from "@/lib/admin-conversations"
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

export async function POST(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ success: false, error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const texto = String(body.texto ?? "").trim()
  const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0
  const chat = await getChatById(id)

  if (!chat) {
    return Response.json({ success: false, error: "Conversa nao encontrada" }, { status: 404 })
  }

  if (!texto && !hasAttachments) {
    return Response.json(
      { success: false, error: "Mensagem vazia" },
      { status: 400 }
    )
  }

  const handoff = await claimHumanHandoff({
    chatId: chat.id,
    projetoId: chat.projetoId,
    usuarioId: user.id,
    canalWhatsappId: chat.contexto?.whatsapp?.channelId ?? null,
  })
  await touchHumanHandoff({ chatId: chat.id })

  const message = await appendAdminConversationMessage(id, texto, body.attachments, user)

  if (message === false) {
    return Response.json({ success: false, error: "Acesso negado" }, { status: 403 })
  }

  if (!message) {
    return Response.json({ success: false, error: "Conversa nao encontrada" }, { status: 404 })
  }

  const whatsappTarget = chat.canal === "whatsapp" ? getWhatsAppReplyTarget(chat) : null
  const whatsappDelivery =
    whatsappTarget && texto
      ? await sendWhatsAppTextMessage({
          channelId: whatsappTarget.channelId,
          to: whatsappTarget.to,
          message: texto,
        })
      : null

  return Response.json({
    success: true,
    message,
    handoff,
    status: handoff?.status === "human" ? "humano" : "ia",
    whatsappDelivery,
  })
}
