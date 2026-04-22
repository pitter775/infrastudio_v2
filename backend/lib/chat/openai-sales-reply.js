import {
  buildAgentAssetInstruction,
  buildAnalyticalReplyInstruction,
  buildChannelReplyInstruction,
  buildRuntimePrompt,
  buildStructuredReplyInstruction,
  buildSystemPrompt,
} from "@/lib/chat/prompt-builders"

function buildConversationMemory(context = {}) {
  const snippets = []
  const resumo = String(context?.memoria?.resumo || "").trim()
  const historicoIdentificado = String(context?.memoria?.historicoIdentificado || "").trim()
  const currentProduct = context?.catalogo?.produtoAtual?.nome
  const latestSearch = context?.catalogo?.ultimaBusca

  if (resumo) snippets.push(`Resumo de continuidade: ${resumo}`)
  if (historicoIdentificado) snippets.push(`Historico importado do usuario identificado:\n${historicoIdentificado}`)
  if (currentProduct) snippets.push(`Produto em foco: ${currentProduct}`)
  if (latestSearch) snippets.push(`Busca recente do cliente: ${latestSearch}`)

  return snippets.join("\n")
}

function buildFocusedApiInstructions(focusedApiContext) {
  if (!focusedApiContext?.fields?.length) {
    return ""
  }

  return [
    "Campos de API diretamente relacionados ao pedido atual:",
    ...focusedApiContext.fields.slice(0, 8).map((field) => `${field.apiNome} > ${field.nome}: ${field.valor}`),
  ].join("\n")
}

function buildSelectedProductInstructions(product) {
  if (!product?.nome) {
    return ""
  }

  return [
    `Produto atualmente em foco: ${product.nome}.`,
    product.descricao ? `Contexto do produto: ${product.descricao}` : "",
    product.preco != null ? `Preco conhecido: ${product.preco}.` : "",
    product.link ? `Link conhecido: ${product.link}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function extractOpenAiText(payload) {
  return (
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? [])?.find((item) => item.type === "output_text")?.text ??
    ""
  )
}

export async function generateOpenAiSalesReply(input = {}) {
  const {
    openAiKey,
    model,
    agentName,
    agentPromptBase,
    context,
    structuredResponse,
    focusedApiContext,
    currentCatalogProduct,
    history,
    simpleCommercialQuestion,
    metadata,
  } = input

  if (!openAiKey) {
    throw new Error("OPENAI_API_KEY nao configurada para executar o agente do chat.")
  }

  const systemPrompt = [
    buildSystemPrompt(
      {
        nome: agentName,
        promptBase: agentPromptBase,
      },
      context,
      structuredResponse
    ),
    buildRuntimePrompt(
      {
        nome: agentName,
        promptBase: agentPromptBase,
      },
      context,
      { structuredResponse }
    ),
    buildChannelReplyInstruction(context?.channel?.kind ?? context?.canal ?? "web"),
    buildAnalyticalReplyInstruction(),
    structuredResponse ? buildStructuredReplyInstruction() : "",
    buildAgentAssetInstruction(Array.isArray(context?.agente?.arquivos) ? context.agente.arquivos : []),
    buildConversationMemory(context),
    buildFocusedApiInstructions(focusedApiContext),
    buildSelectedProductInstructions(currentCatalogProduct),
  ]
    .filter(Boolean)
    .join("\n\n")

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
          content: systemPrompt,
        },
        ...(history ?? []).slice(simpleCommercialQuestion ? -6 : -10).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        })),
      ],
      max_output_tokens: simpleCommercialQuestion ? 260 : 420,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI retornou ${response.status}`)
  }

  const payload = await response.json()
  const reply = extractOpenAiText(payload)

  if (!String(reply || "").trim()) {
    throw new Error("OpenAI nao retornou texto util para o agente do chat.")
  }

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
      ...metadata,
    },
  }
}
