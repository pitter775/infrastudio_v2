import { NextResponse } from "next/server"

import {
  getMercadoLivreStoreSettingsForProject,
  restoreMercadoLivreStoreDefaultsForProject,
  upsertMercadoLivreStoreForProject,
} from "@/lib/mercado-livre-store"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

export async function GET(_request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const store = await getMercadoLivreStoreSettingsForProject(project)
  return NextResponse.json({ store }, { status: 200 })
}

export async function PUT(request, context) {
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
  const { store, error } = await upsertMercadoLivreStoreForProject(project, body)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ store }, { status: 200 })
}

export async function POST(_request, context) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const { store, error } = await restoreMercadoLivreStoreDefaultsForProject(project)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ store }, { status: 200 })
}
