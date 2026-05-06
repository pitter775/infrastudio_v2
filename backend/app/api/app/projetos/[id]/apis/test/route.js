import { NextResponse } from "next/server"

import { testApiDraftForUser } from "@/lib/apis"
import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"

function buildLockedRuntimeContext(project) {
  const widget = Array.isArray(project?.chatWidgets) ? project.chatWidgets.find((item) => item?.slug) : null

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
    widget: {
      id: widget?.id || "",
      slug: widget?.slug || "",
      nome: widget?.nome || "",
    },
    lead: {
      nome: "Lead de teste",
      email: "lead.teste@infrastudio.local",
      telefone: "11999999999",
    },
    memoria: {
      resumo: "Teste manual disparado pelo novo sheet de API.",
    },
    agenda: {
      horarioId: "",
      horarioReservado: "",
      dataConsulta: "",
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

  const { id } = await context.params
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

  const runtimeContext = mergeContext(
    buildLockedRuntimeContext(project),
    payload?.testContext && typeof payload.testContext === "object" && !Array.isArray(payload.testContext)
      ? payload.testContext
      : null,
  )
  if (payload?.agendaDate) {
    runtimeContext.agenda.dataConsulta = String(payload.agendaDate).slice(0, 10)
  }

  const { result, error } = await testApiDraftForUser(project.id, payload?.api || {}, user, {
    runtimeContext,
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
