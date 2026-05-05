import { NextResponse } from "next/server"

import { atualizarStatusFeedback, marcarFeedbackComoLido } from "@/lib/feedbacks"
import { getSessionUser } from "@/lib/session"

export async function GET(_request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params
  const feedback = await marcarFeedbackComoLido(user, id)

  if (!feedback) {
    return NextResponse.json({ error: "Feedback não encontrado." }, { status: 404 })
  }

  if (feedback === false) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  return NextResponse.json({ feedback }, { status: 200 })
}

export async function PATCH(request, { params }) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const feedback = await atualizarStatusFeedback({
    user,
    feedbackId: id,
    status: body.status,
    acao: body.acao,
  })

  if (feedback === false) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  if (!feedback) {
    return NextResponse.json({ error: "Não foi possível atualizar o feedback." }, { status: 400 })
  }

  return NextResponse.json({ feedback }, { status: 200 })
}
