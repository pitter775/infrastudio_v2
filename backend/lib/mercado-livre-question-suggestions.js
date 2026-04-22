import "server-only"

import { buildRuntimePrompt, buildSystemPrompt } from "@/lib/chat/prompt-builders"

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

export async function suggestMercadoLivreQuestionAnswer(project, input = {}, deps = {}) {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openAiKey) {
    return { text: "", error: "OPENAI_API_KEY nao configurada para gerar sugestao." }
  }

  const questionText = sanitizeString(input.questionText)
  const itemId = sanitizeString(input.itemId)
  const itemTitle = sanitizeString(input.itemTitle)

  if (!questionText) {
    return { text: "", error: "Pergunta sem texto para sugestao." }
  }

  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini"
  const agent = project?.agent ?? null
  const context = {
    projeto: {
      id: project?.id ?? null,
      nome: project?.name ?? project?.nome ?? "",
      descricao: project?.description ?? project?.descricao ?? "",
    },
    projetoNome: project?.name ?? project?.nome ?? "",
    agente: {
      id: agent?.id ?? null,
      nome: agent?.name ?? agent?.nome ?? "Assistente",
      runtimeConfig: agent?.runtimeConfig ?? agent?.configuracoes?.runtimeConfig ?? null,
      configuracoes: agent?.configuracoes ?? null,
    },
    ui: {
      structured_response: false,
    },
    channel: {
      kind: "mercado_livre_questions",
    },
  }

  const systemPrompt = [
    buildSystemPrompt(
      {
        nome: agent?.name ?? agent?.nome ?? "Assistente",
        name: agent?.name ?? agent?.nome ?? "Assistente",
        promptBase: agent?.prompt ?? agent?.promptBase ?? "",
        runtimeConfig: agent?.runtimeConfig ?? agent?.configuracoes?.runtimeConfig ?? null,
        configuracoes: agent?.configuracoes ?? null,
      },
      context,
      false,
    ),
    buildRuntimePrompt(
      {
        nome: agent?.name ?? agent?.nome ?? "Assistente",
        name: agent?.name ?? agent?.nome ?? "Assistente",
        promptBase: agent?.prompt ?? agent?.promptBase ?? "",
        runtimeConfig: agent?.runtimeConfig ?? agent?.configuracoes?.runtimeConfig ?? null,
        configuracoes: agent?.configuracoes ?? null,
      },
      context,
      { structuredResponse: false },
    ),
    "Seu trabalho agora e sugerir uma resposta curta para uma pergunta recebida no Mercado Livre.",
    "A resposta deve ser comercial, humana, objetiva e pronta para publicar.",
    "Nao diga que e IA, nao use markdown, nao use listas, nao use emojis.",
    "Se faltar dado factual, responda sem inventar e convide o comprador a confirmar no anuncio ou chamar novamente.",
    "Use no maximo 600 caracteres.",
    "Retorne somente o texto final da resposta.",
  ]
    .filter(Boolean)
    .join("\n\n")

  const userPrompt = [
    itemTitle ? `Produto: ${itemTitle}` : "",
    itemId ? `Item ID: ${itemId}` : "",
    `Pergunta do comprador: ${questionText}`,
    "Gere uma sugestao pronta para envio no Mercado Livre.",
  ]
    .filter(Boolean)
    .join("\n")

  const fetchImpl = deps.fetchImpl ?? fetch
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
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
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_output_tokens: 220,
    }),
  })

  if (!response.ok) {
    return { text: "", error: `OpenAI retornou ${response.status}` }
  }

  const payload = await response.json().catch(() => ({}))
  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? [])?.find((item) => item.type === "output_text")?.text ??
    ""

  const normalizedText = sanitizeString(text).replace(/\s+/g, " ").trim()
  if (!normalizedText) {
    return { text: "", error: "Nao foi possivel gerar sugestao." }
  }

  return {
    text: normalizedText.slice(0, 600),
    error: null,
  }
}
