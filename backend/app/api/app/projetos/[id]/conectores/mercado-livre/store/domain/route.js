import { NextResponse } from "next/server"

import { getMercadoLivreStoreByProjectId } from "@/lib/mercado-livre-store"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { provisionStoreDomain, verifyStoreDomain } from "@/lib/vercel-project-domains"

async function resolveProjectAndStore(context) {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)
  if (!project) {
    return { error: NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 }) }
  }

  const store = await getMercadoLivreStoreByProjectId(project.id)
  if (!store?.id) {
    return { error: NextResponse.json({ error: "Loja não encontrada." }, { status: 404 }) }
  }

  return { project, store }
}

export async function GET(_request, context) {
  const resolved = await resolveProjectAndStore(context)
  if (resolved.error) {
    return resolved.error
  }

  const result = await verifyStoreDomain(resolved.store)
  return NextResponse.json({ domainAutomation: result }, { status: 200 })
}

export async function POST(request, context) {
  const resolved = await resolveProjectAndStore(context)
  if (resolved.error) {
    return resolved.error
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || "verify").trim()
  const result = action === "provision"
    ? await provisionStoreDomain(resolved.store)
    : await verifyStoreDomain(resolved.store)

  return NextResponse.json({ domainAutomation: result }, { status: 200 })
}
