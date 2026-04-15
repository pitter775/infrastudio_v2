import { NextResponse } from "next/server"

import { deleteAdminLogs, listAdminLogs, updateAdminLogPayload } from "@/lib/logs"
import { LABORATORY_CHAT_SCENARIOS, recordLaboratoryChatScenarioRun, runLaboratoryChatScenario } from "@/lib/laboratory-scenarios"
import { getSessionUser } from "@/lib/session"

function canAccessLaboratory(user) {
  return user?.role === "admin"
}

export async function GET(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const logs = await listAdminLogs({
    projectId: searchParams.get("projectId")?.trim() || "",
    type: searchParams.get("type")?.trim() || "",
    origin: searchParams.get("origin")?.trim() || "",
    level: searchParams.get("level")?.trim() || "",
    search: searchParams.get("search")?.trim() || "",
    limit: searchParams.get("limit")?.trim() || "100",
  })

  return NextResponse.json({ logs }, { status: 200 })
}

export async function DELETE(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const deleted = await deleteAdminLogs({
    projectId: String(body.projectId || "").trim(),
    type: String(body.type || "").trim(),
    origin: String(body.origin || "").trim(),
    level: String(body.level || "").trim(),
    search: String(body.search || "").trim(),
  })

  if (deleted == null) {
    return NextResponse.json({ error: "Nao foi possivel limpar os eventos." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted }, { status: 200 })
}

export async function POST(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const scenarioId = String(body.scenarioId || "").trim()
  const caseId = String(body.caseId || "").trim()
  const scenario = Object.values(LABORATORY_CHAT_SCENARIOS).find((item) => item.id === scenarioId)

  if (!scenario) {
    return NextResponse.json({ error: "Cenario nao encontrado." }, { status: 404 })
  }

  const cases = caseId ? scenario.cases.filter((item) => item.id === caseId) : scenario.cases

  if (!cases.length) {
    return NextResponse.json({ error: "Caso do laboratorio nao encontrado." }, { status: 404 })
  }

  try {
    const runs = []

    for (const testCase of cases) {
      const execution = await runLaboratoryChatScenario(scenario, testCase)
      const log = await recordLaboratoryChatScenarioRun(scenario, execution)
      runs.push({
        caseId: testCase.id,
        logId: log?.id ?? null,
        reply: execution.result?.reply ?? "",
        diagnostics: execution.result?.diagnostics ?? null,
      })
    }

    return NextResponse.json({ ok: true, scenarioId: scenario.id, runs }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Nao foi possivel executar o laboratorio." }, { status: 500 })
  }
}

export async function PATCH(request) {
  const user = await getSessionUser()

  if (!canAccessLaboratory(user)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const logId = String(body.logId || "").trim()
  const humanScore = body.humanScore == null ? null : Number(body.humanScore)
  const humanNotes = String(body.humanNotes || "").trim()

  if (!logId) {
    return NextResponse.json({ error: "Log obrigatorio." }, { status: 400 })
  }

  if (humanScore != null && (!Number.isFinite(humanScore) || humanScore < 1 || humanScore > 5)) {
    return NextResponse.json({ error: "Score humano invalido." }, { status: 400 })
  }

  const updated = await updateAdminLogPayload(logId, (payload) => ({
    ...payload,
    humanScore: humanScore ?? null,
    humanNotes: humanNotes || null,
    humanScoredAt: new Date().toISOString(),
    humanScoredBy: user?.email || user?.id || "admin",
  }))

  if (!updated) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o score humano." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, log: updated }, { status: 200 })
}
