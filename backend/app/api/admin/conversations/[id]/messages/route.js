import { appendAdminConversationMessage } from "@/lib/admin-conversations"
import { getSessionUser } from "@/lib/session"

export async function POST(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return Response.json({ success: false, error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const texto = String(body.texto ?? "").trim()

  if (!texto) {
    return Response.json(
      { success: false, error: "Mensagem vazia" },
      { status: 400 }
    )
  }

  const message = await appendAdminConversationMessage(id, texto, body.attachments)

  if (!message) {
    return Response.json({ success: false, error: "Conversa nao encontrada" }, { status: 404 })
  }

  return Response.json({ success: true, message })
}
