const conversationMessages = new Map()

export async function POST(request, { params }) {
  const { id } = await params
  const body = await request.json()
  const texto = String(body.texto ?? "").trim()

  if (!texto) {
    return Response.json(
      { success: false, error: "Mensagem vazia" },
      { status: 400 }
    )
  }

  const message = {
    id: `msg-${id}-${Date.now()}`,
    autor: "atendente",
    texto,
    horario: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }

  const messages = conversationMessages.get(id) ?? []
  conversationMessages.set(id, [...messages, message])

  return Response.json({ success: true, message })
}
