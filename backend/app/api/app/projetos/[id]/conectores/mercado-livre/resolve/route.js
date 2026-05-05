import { NextResponse } from "next/server"

import { resolveMercadoLivreProductForUser } from "@/lib/mercado-livre-connector"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function POST(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const { product, error } = await resolveMercadoLivreProductForUser(project, body?.productUrl, user)

  if (error) {
    return NextResponse.json({ error, product }, { status: 400 })
  }

  return NextResponse.json({ product }, { status: 200 })
}
