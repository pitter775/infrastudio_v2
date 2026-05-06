import { NextResponse } from "next/server"

import { testApiForUser } from "@/lib/apis"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

function buildLockedRuntimeContext(project) {
  return {
    projeto: {
      id: project.id,
      slug: project.slug || project.routeKey || "",
      nome: project.name || "",
    },
    agente: {
      id: project.agent?.id || "",
      nome: project.agent?.name || "",
    },
    lead: {
      nome: "Lead de teste",
      email: "lead.teste@infrastudio.local",
      telefone: "11999999999",
    },
    memoria: {
      resumo: "Teste manual disparado pelo painel do projeto.",
    },
    agenda: {
      horarioId: "",
      horarioReservado: "",
    },
  }
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
}

function mergeContext(base, extra) {
  if (!isPlainObject(extra)) {
    return base
  }

  const next = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeContext(next[key], value)
    } else {
      next[key] = value
    }
  }

  return next
}

export async function POST(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id, apiId } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  let payload = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const { result, error } = await testApiForUser(apiId, project.id, user, {
    runtimeContext: mergeContext(
      buildLockedRuntimeContext(project),
      payload?.testContext && typeof payload.testContext === "object" && !Array.isArray(payload.testContext)
        ? payload.testContext
        : null,
    ),
    testOverrides:
      payload?.testOverrides && typeof payload.testOverrides === "object" && !Array.isArray(payload.testOverrides)
        ? payload.testOverrides
        : {},
  })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ result }, { status: 200 })
}
