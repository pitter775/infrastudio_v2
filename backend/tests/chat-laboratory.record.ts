import { loadEnvConfig } from "@next/env"
import assert from "node:assert/strict"

loadEnvConfig(process.cwd())

import {
  LABORATORY_CHAT_SCENARIOS,
  recordLaboratoryChatScenarioRun,
  runLaboratoryChatScenario,
} from "@/lib/laboratory-scenarios"

function assertLaboratoryCase(scenario, execution) {
  const reply = String(execution.result?.reply || "").trim()
  const diagnostics = execution.result?.diagnostics ?? {}

  assert.equal(diagnostics.agenteId, scenario.agentId, `${execution.testCase.id}: agente inesperado`)
  assert.equal(diagnostics.projetoId, scenario.projectId, `${execution.testCase.id}: projeto inesperado`)
  assert.ok(reply, `${execution.testCase.id}: resposta vazia`)
  assert.doesNotMatch(reply, /modo isolado/i, `${execution.testCase.id}: caiu em modo isolado`)
  assert.doesNotMatch(reply, /Recebi sua mensagem/i, `${execution.testCase.id}: resposta generica de fallback`)
  assert.doesNotMatch(reply, /\[(?:insira|coloque)[^\]]*(?:numero|n[uú]mero|whatsapp)[^\]]*\]/i, `${execution.testCase.id}: placeholder de WhatsApp`)

  for (const pattern of execution.testCase.expectedReplyPatterns ?? []) {
    assert.match(reply, new RegExp(pattern, "i"), `${execution.testCase.id}: resposta nao contem ${pattern}`)
  }
}

async function main() {
  const scenario = LABORATORY_CHAT_SCENARIOS.infrastudioHomeBaseline
  const summary = []

  for (const testCase of scenario.cases) {
    const execution = await runLaboratoryChatScenario(scenario, testCase)
    assertLaboratoryCase(scenario, execution)
    const logEntry = await recordLaboratoryChatScenarioRun(scenario, execution)

    summary.push({
      caseId: testCase.id,
      chatId: execution.result?.chatId ?? null,
      reply: execution.result?.reply ?? null,
      agenteId: execution.result?.diagnostics?.agenteId ?? null,
      projetoId: execution.result?.diagnostics?.projetoId ?? null,
      logId: logEntry?.id ?? null,
    })
  }

  console.log(JSON.stringify({ scenarioId: scenario.id, runs: summary }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
