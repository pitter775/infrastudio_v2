import { claimHumanHandoff, releaseHumanHandoff, touchHumanHandoff } from "@/lib/chat-handoffs"
import { userCanAccessAdminConversation } from "@/lib/admin-conversations"
import { getChatById } from "@/lib/chats"
import { getSessionUser } from "@/lib/session"

export async function PATCH(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const chat = await getChatById(id)

  if (!chat) {
    return Response.json({ error: "Conversa não encontrada." }, { status: 404 })
  }

  if (!userCanAccessAdminConversation(user, chat)) {
    return Response.json({ error: "Acesso negado." }, { status: 403 })
  }

  const handoff =
    body.action === "touch"
      ? await touchHumanHandoff({
          chatId: chat.id,
        })
      : body.status === "human"
      ? await claimHumanHandoff({
          chatId: chat.id,
          projetoId: chat.projetoId,
          usuarioId: user.id,
          canalWhatsappId: chat.contexto?.whatsapp?.channelId ?? null,
        })
      : await releaseHumanHandoff({
          chatId: chat.id,
          usuarioId: user.id,
        })

  if (!handoff) {
    return Response.json({ error: "Não foi possível atualizar handoff." }, { status: 500 })
  }

  return Response.json({ handoff }, { status: 200 })
}
