export function shouldRefreshSummary(messageCount) {
  return Number(messageCount) > 0 && Number(messageCount) % 4 === 0
}

function sanitizeSummaryText(value, maxLength = 420) {
  const sanitized = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()

  if (!sanitized) {
    return ""
  }

  if (sanitized.length <= maxLength) {
    return sanitized
  }

  return `${sanitized.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function normalizeHistoryItem(item) {
  const role = item?.role === "assistant" || item?.papel === "assistant" ? "assistente" : "cliente"
  const content = String(item?.content ?? item?.conteudo ?? "")
    .replace(/\s+/g, " ")
    .trim()

  return content ? { role, content } : null
}

function buildTranscriptForWhatsAppSummary(history = [], options = {}) {
  const items = [
    ...(Array.isArray(history) ? history : []),
    options.currentUserMessage
      ? {
          role: "user",
          content: options.currentUserMessage,
        }
      : null,
    options.assistantReply
      ? {
          role: "assistant",
          content: [options.assistantReply, options.followUpReply].filter(Boolean).join("\n"),
        }
      : null,
  ]
    .map(normalizeHistoryItem)
    .filter(Boolean)

  const lines = items.map((item, index) => `${index + 1}. ${item.role}: ${item.content}`)
  const maxChars = 5200
  const transcript = lines.join("\n")
  if (transcript.length <= maxChars) {
    return transcript
  }

  const head = lines.slice(0, 8).join("\n")
  const tail = lines.slice(-18).join("\n")
  return `${head}\n...\n${tail}`.slice(0, maxChars)
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text
  }

  if (Array.isArray(data?.output)) {
    return data.output
      .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
      .map((content) => content?.text || "")
      .join(" ")
  }

  return ""
}

function buildFallbackWhatsAppTransferSummary(history = [], options = {}) {
  const transcript = buildTranscriptForWhatsAppSummary(history, options)
  const customerLines = transcript
    .split("\n")
    .filter((line) => /\bcliente:/i.test(line))
    .map((line) => line.replace(/^\d+\.\s*cliente:\s*/i, "").trim())
    .filter(Boolean)

  return sanitizeSummaryText(customerLines.join(" "), 360)
}

export async function generateWhatsAppTransferSummary(input = {}) {
  const openAiKey = String(input.openAiKey || "").trim()
  const transcript = buildTranscriptForWhatsAppSummary(input.history, {
    currentUserMessage: input.currentUserMessage,
    assistantReply: input.assistantReply,
    followUpReply: input.followUpReply,
  })

  if (!transcript) {
    return ""
  }

  if (!openAiKey) {
    return buildFallbackWhatsAppTransferSummary(input.history, {
      currentUserMessage: input.currentUserMessage,
      assistantReply: input.assistantReply,
      followUpReply: input.followUpReply,
    })
  }

  try {
    const fetchImpl = input.fetchImpl ?? fetch
    const model = String(input.model || "").trim() || "gpt-4o-mini"
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
            content:
              "Resuma uma conversa para continuar no WhatsApp. Escreva em português do Brasil, em uma única frase curta. Preserve o objetivo do cliente, produto/serviço citado, contexto relevante, restrições, dúvidas abertas e próximo passo. Não foque apenas nas últimas mensagens. Não invente dados.",
          },
          {
            role: "user",
            content: `Conversa:\n${transcript}\n\nResumo curto para atendente/cliente:`,
          },
        ],
        max_output_tokens: 120,
      }),
    })

    if (!response.ok) {
      return buildFallbackWhatsAppTransferSummary(input.history, {
        currentUserMessage: input.currentUserMessage,
        assistantReply: input.assistantReply,
        followUpReply: input.followUpReply,
      })
    }

    const data = await response.json()
    const summary = sanitizeSummaryText(extractResponseText(data), 420)
    return summary || buildFallbackWhatsAppTransferSummary(input.history, {
      currentUserMessage: input.currentUserMessage,
      assistantReply: input.assistantReply,
      followUpReply: input.followUpReply,
    })
  } catch {
    return buildFallbackWhatsAppTransferSummary(input.history, {
      currentUserMessage: input.currentUserMessage,
      assistantReply: input.assistantReply,
      followUpReply: input.followUpReply,
    })
  }
}

export async function summarizeConversation(history = [], currentSummary = null) {
  const recent = Array.isArray(history) ? history.slice(-6) : []
  const compact = recent
    .map((item) => {
      const role = item?.role === "assistant" ? "assistente" : "cliente"
      const content = String(item?.content ?? item?.conteudo ?? "").replace(/\s+/g, " ").trim()
      return content ? `${role}:${content}` : ""
    })
    .filter(Boolean)
    .join(" | ")
    .slice(0, 320)

  return JSON.stringify({
    objetivo: null,
    lead: null,
    restricoes: compact || null,
    proximo_passo: currentSummary ? String(currentSummary).slice(0, 180) : null,
  })
}
