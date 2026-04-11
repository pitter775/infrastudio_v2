import { claimHumanHandoff, releaseHumanHandoff } from "@/lib/chat-handoffs"
import { getChatById } from "@/lib/chats"
import { getSessionUser } from "@/lib/session"

export async function PATCH(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const chat = await getChatById(id)

  if (!chat) {
    return Response.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  const handoff =
    body.status === "human"
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
    return Response.json({ error: "Nao foi possivel atualizar handoff." }, { status: 500 })
  }

  return Response.json({ handoff }, { status: 200 })
}
