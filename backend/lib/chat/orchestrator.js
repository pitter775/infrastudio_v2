import { enrichLeadContext } from "@/lib/chat/lead-stage"
import { buildSystemPrompt } from "@/lib/chat/prompt-builders"

const simulatedAgent = {
  name: "Assistente InfraStudio",
  prompt:
    "Voce e um assistente de vendas simpatico, direto e util. Sempre responda o usuario de forma clara e objetiva.",
}

export const USE_ORCHESTRATOR = false

function mapMessageRole(autor) {
  return autor === "atendente" ? "assistant" : "user"
}

export function buildConversationHistory(conversation, texto) {
  const messages = conversation?.mensagens ?? []
  const history = messages.map((message) => ({
    role: mapMessageRole(message.autor),
    content: message.texto,
  }))

  return [
    {
      role: "system",
      content: simulatedAgent.prompt,
    },
    ...history,
    {
      role: "user",
      content: texto,
    },
  ]
}

export async function executeSalesOrchestrator(history, context, options = {}) {
  if (typeof options.generateSalesReply === "function") {
    return options.generateSalesReply(history, context)
  }

  const latestUserMessage = [...(history ?? [])].reverse().find((item) => item.role === "user")?.content ?? ""
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"

  if (!openAiKey) {
    return {
      reply: latestUserMessage
        ? `Recebi sua mensagem: "${latestUserMessage}". Como posso te ajudar com isso?`
        : "Como posso te ajudar?",
      assets: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
      metadata: {
        provider: "local_fallback",
        model: "local",
        agenteId: context?.agente?.id ?? null,
        agenteNome: context?.agente?.nome ?? null,
        routeStage: "local",
        heuristicStage: "fallback",
        domainStage: "general",
      },
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(
            {
              nome: context?.agente?.nome ?? simulatedAgent.name,
              promptBase: simulatedAgent.prompt,
            },
            context
          ),
        },
        ...(history ?? []).slice(-12).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        })),
      ],
      max_output_tokens: 700,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI retornou ${response.status}`)
  }

  const payload = await response.json()
  const reply =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? [])?.find((item) => item.type === "output_text")?.text ??
    "Nao consegui gerar uma resposta agora."

  return {
    reply,
    assets: [],
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
    },
    metadata: {
      provider: "openai",
      model,
      agenteId: context?.agente?.id ?? null,
      agenteNome: context?.agente?.nome ?? null,
      routeStage: "sales",
      heuristicStage: null,
      domainStage: "general",
    },
  }
}

export { enrichLeadContext }
