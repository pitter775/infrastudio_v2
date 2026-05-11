import { NextResponse } from "next/server"

import { getMercadoLivreSalesDashboardForUser } from "@/lib/mercado-livre-sales-dashboard"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const url = new URL(request.url)
  const { dashboard, error } = await getMercadoLivreSalesDashboardForUser(project, user, {
    period: url.searchParams.get("period") || "30d",
    from: url.searchParams.get("from") || "",
    to: url.searchParams.get("to") || "",
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ dashboard }, { status: 200 })
}
