import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/session"
import { createProject, listProjectsForUser, updateProject } from "@/lib/projetos"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

export async function GET() {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const projects = await listProjectsForUser(user)
  return NextResponse.json({ projects }, { status: 200 })
}

export async function POST(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()

  if (!body.nome) {
    return NextResponse.json({ error: "Nome e obrigatorio." }, { status: 400 })
  }

  const project = await createProject(body, user)

  if (!project) {
    return NextResponse.json({ error: "Nao foi possivel criar o projeto." }, { status: 500 })
  }

  return NextResponse.json({ project }, { status: 201 })
}

export async function PUT(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()

  if (!body.id || !body.nome) {
    return NextResponse.json({ error: "Id e nome sao obrigatorios." }, { status: 400 })
  }

  const project = await updateProject(body)

  if (!project) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o projeto." }, { status: 500 })
  }

  return NextResponse.json({ project }, { status: 200 })
}
