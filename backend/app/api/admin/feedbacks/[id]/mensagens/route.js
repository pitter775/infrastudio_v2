import { NextResponse } from "next/server"

import { adicionarMensagemFeedback } from "@/lib/feedbacks"
import { getSessionUser } from "@/lib/session"

export async function POST(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  if (!body.mensagem) {
    return NextResponse.json({ error: "Mensagem obrigatoria." }, { status: 400 })
  }

  const feedback = await adicionarMensagemFeedback({
    user,
    feedbackId: id,
    mensagem: body.mensagem,
    statusAdmin: body.statusAdmin,
  })

  if (feedback === false) {
    return NextResponse.json({ error: "Nao foi possivel enviar mensagem para este feedback." }, { status: 403 })
  }

  if (!feedback) {
    return NextResponse.json({ error: "Nao foi possivel enviar a mensagem." }, { status: 400 })
  }

  return NextResponse.json({ feedback }, { status: 201 })
}
