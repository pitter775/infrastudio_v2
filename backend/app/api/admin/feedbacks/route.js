import { NextResponse } from "next/server"

import {
  createFeedback,
  FEEDBACK_CATEGORIAS,
  FEEDBACK_ORDENACOES,
  FEEDBACK_STATUSES,
  listFeedbacks,
} from "@/lib/feedbacks"
import { getSessionUser } from "@/lib/session"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

export async function GET(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const result = await listFeedbacks({
    user,
    status: searchParams.get("status"),
    categoria: searchParams.get("categoria"),
    usuarioId: searchParams.get("usuarioId"),
    ordenacao: searchParams.get("ordenacao"),
    busca: searchParams.get("busca"),
  })

  return NextResponse.json(
    {
      feedbacks: result.feedbacks,
      filtros: result.filtros,
      statuses: FEEDBACK_STATUSES,
      categorias: FEEDBACK_CATEGORIAS,
      ordenacoes: FEEDBACK_ORDENACOES,
    },
    { status: 200 },
  )
}

export async function POST(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()

  if (!body.assunto || !body.mensagemInicial) {
    return NextResponse.json({ error: "Assunto e mensagem inicial sao obrigatorios." }, { status: 400 })
  }

  const feedback = await createFeedback({
    user,
    projetoId: body.projetoId,
    assunto: body.assunto,
    categoria: body.categoria,
    mensagemInicial: body.mensagemInicial,
  })

  if (feedback === false) {
    return NextResponse.json({ error: "Projeto invalido para este usuario." }, { status: 403 })
  }

  if (!feedback) {
    return NextResponse.json({ error: "Nao foi possivel criar o feedback." }, { status: 500 })
  }

  return NextResponse.json({ feedback }, { status: 201 })
}
