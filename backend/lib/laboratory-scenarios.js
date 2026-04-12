import { getAgenteById } from "@/lib/agentes"
import { buildAiObservability } from "@/lib/admin-conversations"
import { processChatRequest } from "@/lib/chat/service"
import { getChatWidgetBySlug } from "@/lib/chat-widgets"
import { createLogEntry } from "@/lib/logs"

export const LABORATORY_CHAT_SCENARIOS = {
  infrastudioHomeBaseline: {
    id: "infrastudio-home-baseline",
    name: "InfraStudio Home Baseline",
    widgetSlug: "infrastudio-home",
    projectId: "7d965fd5-2487-4efc-b3df-1d28fa3d5377",
    agentId: "e0c00703-726d-477e-926d-9e9986a67db0",
    cases: [
      {
        id: "home-site-offer",
        message: "oi, voce faz site?",
        notes: "Entrada comercial curta na home.",
        expectedReplyPatterns: ["site"],
      },
      {
        id: "home-ia-system",
        message: "voces fazem sistemas com IA?",
        notes: "Oferta consultiva para sistema sob medida.",
        expectedReplyPatterns: ["sistema", "ia|inteligencia"],
      },
      {
        id: "home-how-it-works",
        message: "como funciona o atendimento de voces?",
        notes: "Explicacao do produto antes do CTA.",
        expectedReplyPatterns: ["atendimento", "agente|painel|whatsapp"],
      },
      {
        id: "home-site-price",
        message: "quanto custa um site com chat?",
        notes: "Preco inicial sem pedir nome cedo.",
        expectedReplyPatterns: ["R\\$", "site|chat"],
      },
      {
        id: "home-objection-price",
        message: "achei caro, vale a pena?",
        notes: "Objecao comercial com resposta consultiva.",
        expectedReplyPatterns: ["valor|investimento|retorno|vendas|tempo|atendimento"],
      },
      {
        id: "home-whatsapp-transition",
        message: "quero falar no whatsapp",
        notes: "Transicao para WhatsApp sem perder contexto.",
        expectedReplyPatterns: ["WhatsApp|whatsapp"],
      },
    ],
  },
}

export async function resolveLaboratoryScenarioContext(scenario) {
  const widget = await getChatWidgetBySlug(scenario.widgetSlug)
  const agente = widget?.agenteId ? await getAgenteById(widget.agenteId) : null

  return {
    widget,
    agente,
  }
}

export async function runLaboratoryChatScenario(scenario, testCase) {
  const { widget, agente } = await resolveLaboratoryScenarioContext(scenario)
  const runId = `${scenario.id}:${testCase.id}:${Date.now()}`

  const result = await processChatRequest({
    message: testCase.message,
    widgetSlug: scenario.widgetSlug,
    canal: "web",
    identificadorExterno: `laboratorio-${runId}`,
    context: {
      route: { path: "/" },
      ui: {
        title: "InfraStudio Home",
        theme: "dark",
        accent: "#2563eb",
        transparent: true,
      },
      laboratory: {
        scenarioId: scenario.id,
        caseId: testCase.id,
      },
    },
  })

  return {
    runId,
    widget,
    agente,
    testCase,
    result,
  }
}

export async function recordLaboratoryChatScenarioRun(scenario, execution) {
  const promptBasePreview = String(execution.agente?.promptBase || "").slice(0, 400)
  const reply = String(execution.result?.reply || "").trim()
  const level = execution.result?.diagnostics?.agenteId === scenario.agentId ? "info" : "warn"
  const observability = buildAiObservability(execution.result?.diagnostics ?? {}, {})

  return createLogEntry({
    projectId: scenario.projectId,
    type: "lab_chat_scenario",
    origin: "laboratorio",
    level,
    description: `${scenario.name} / ${execution.testCase.id}`,
    payload: {
      event: "laboratory_chat_scenario_run",
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      caseId: execution.testCase.id,
      notes: execution.testCase.notes ?? null,
      widgetSlug: execution.widget?.slug ?? scenario.widgetSlug,
      widgetId: execution.widget?.id ?? null,
      agenteId: execution.agente?.id ?? null,
      agenteNome: execution.agente?.nome ?? null,
      expectedAgentId: scenario.agentId,
      expectedProjectId: scenario.projectId,
      promptBasePreview,
      inputMessage: execution.testCase.message,
      outputReply: reply,
      chatId: execution.result?.chatId ?? null,
      diagnostics: execution.result?.diagnostics ?? null,
      observability,
      matchedExpectedAgent: execution.result?.diagnostics?.agenteId === scenario.agentId,
      matchedExpectedProject: execution.result?.diagnostics?.projetoId === scenario.projectId,
    },
  })
}
