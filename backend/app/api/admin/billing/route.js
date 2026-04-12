import { NextResponse } from "next/server"

import {
  listAdminBillingProjects,
  listBillingPlans,
  updateProjectBillingSettings,
} from "@/lib/billing"
import { getSessionUser } from "@/lib/session"

function canAccessGlobalAdmin(user) {
  return user?.role === "admin"
}

export async function GET() {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const [plans, projects] = await Promise.all([listBillingPlans(), listAdminBillingProjects()])
  return NextResponse.json({ plans, projects }, { status: 200 })
}

export async function PATCH(request) {
  const user = await getSessionUser()

  if (!canAccessGlobalAdmin(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json()

  if (!body.projectId) {
    return NextResponse.json({ error: "Projeto e obrigatorio." }, { status: 400 })
  }

  const billing = await updateProjectBillingSettings({
    projectId: body.projectId,
    planId: body.planId ?? null,
    planName: body.planName ?? "",
    referenceModel: body.referenceModel ?? "gpt-4o-mini",
    autoBlock: body.autoBlock,
    blocked: body.blocked,
    blockedReason: body.blockedReason ?? "",
    notes: body.notes ?? "",
    limits: {
      inputTokens: body.limits?.inputTokens ?? null,
      outputTokens: body.limits?.outputTokens ?? null,
      totalTokens: body.limits?.totalTokens ?? null,
      monthlyCost: body.limits?.monthlyCost ?? null,
    },
  })

  if (!billing) {
    return NextResponse.json({ error: "Nao foi possivel salvar o billing do projeto." }, { status: 500 })
  }

  return NextResponse.json({ billing }, { status: 200 })
}
