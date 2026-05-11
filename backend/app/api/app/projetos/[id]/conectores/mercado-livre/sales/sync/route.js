import { NextResponse } from "next/server"

import { getMercadoLivreSalesDashboardForUser, syncMercadoLivreSalesForUser } from "@/lib/mercado-livre-sales-dashboard"
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
  const result = await syncMercadoLivreSalesForUser(project, user, {
    pages: body?.pages,
    limit: body?.limit,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error, syncedOrders: 0, syncedItems: 0 }, { status: 400 })
  }

  const { dashboard } = await getMercadoLivreSalesDashboardForUser(project, user, {
    period: body?.period || "30d",
  })

  return NextResponse.json(
    {
      syncedOrders: result.syncedOrders,
      syncedItems: result.syncedItems,
      connector: result.connector,
      dashboard,
    },
    { status: 200 },
  )
}
