import { appendAdminConversationMessage } from "@/lib/admin-conversations"
import { claimHumanHandoff, touchHumanHandoff } from "@/lib/chat-handoffs"
import { getChatById } from "@/lib/chats"
import { getSessionUser } from "@/lib/session"

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

  await claimHumanHandoff({
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

  return Response.json({ success: true, message })
}
