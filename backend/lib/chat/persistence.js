import { appendMessage, listChatMessages, updateChatContext, updateChatStats } from "@/lib/chats"

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeUiPayload(value) {
  return isPlainObject(value) && Array.isArray(value.blocks) ? value : null
}

export function buildUserMessageMetadata(input) {
  return {
    source: input.source?.trim() || (input.channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget"),
    ...(Array.isArray(input.attachments) && input.attachments.length ? { attachments: input.attachments } : {}),
  }
}

export function buildAssistantMessageMetadata(input) {
  return {
    ...(isPlainObject(input.aiMetadata) ? input.aiMetadata : {}),
    ...(input.usageTelemetry ? { usageTelemetry: input.usageTelemetry } : {}),
    assets: Array.isArray(input.assets) ? input.assets : [],
    whatsappCta: isPlainObject(input.whatsapp) ? input.whatsapp : null,
    actions: Array.isArray(input.actions) ? input.actions : [],
    ui: normalizeUiPayload(input.ui),
    ...(input.followUpReply ? { followUpReply: true } : {}),
  }
}

export async function persistUserTurn(input, deps = {}) {
  const appendChatMessage = deps.appendMessage ?? appendMessage
  const userMessage = await appendChatMessage({
    chatId: input.chatId,
    role: "user",
    conteudo: input.message || "Midia recebida pelo WhatsApp.",
    canal: input.channelKind,
    identificadorExterno: input.normalizedExternalIdentifier,
    metadata: buildUserMessageMetadata({
      source: input.source,
      channelKind: input.channelKind,
      attachments: input.attachments,
    }),
  })

  if (!userMessage) {
    throw new Error("Nao foi possivel gravar a mensagem do cliente. Verifique permissoes na tabela `mensagens`.")
  }

  return userMessage
}

export async function loadChatHistory(chatId, deps = {}) {
  const listMessages = deps.listChatMessages ?? listChatMessages
  return listMessages(chatId)
}

export async function persistAssistantTurn(input, deps = {}) {
  const appendChatMessage = deps.appendMessage ?? appendMessage
  const assistantMessage = await appendChatMessage({
    chatId: input.chatId,
    role: "assistant",
    conteudo: input.content,
    canal: input.channelKind,
    identificadorExterno: input.normalizedExternalIdentifier,
    tokensInput: input.tokensInput ?? null,
    tokensOutput: input.tokensOutput ?? null,
    custo: input.custo ?? null,
    metadata: buildAssistantMessageMetadata({
      aiMetadata: input.aiMetadata,
      usageTelemetry: input.usageTelemetry,
      assets: input.assets,
      whatsapp: input.whatsapp,
      actions: input.actions,
      ui: input.ui,
      followUpReply: input.followUpReply,
    }),
  })

  if (!assistantMessage) {
    throw new Error("O modelo respondeu, mas nao foi possivel salvar a resposta no banco.")
  }

  return assistantMessage
}

export async function persistAssistantState(input, deps = {}) {
  const saveChatContext = deps.updateChatContext ?? updateChatContext
  const saveChatStats = deps.updateChatStats ?? updateChatStats

  await saveChatContext(input.chatId, input.nextContext)
  await saveChatStats({
    chatId: input.chatId,
    totalTokensToAdd: Number(input.totalTokensToAdd ?? 0),
    totalCustoToAdd: Number(input.totalCustoToAdd ?? 0),
    titulo: input.titulo ?? null,
    contexto: input.nextContext,
    identificadorExterno: input.normalizedExternalIdentifier ?? null,
    contatoNome: input.contactSnapshot?.contatoNome ?? null,
    contatoTelefone: input.contactSnapshot?.contatoTelefone ?? null,
    contatoAvatarUrl: input.contactSnapshot?.contatoAvatarUrl ?? null,
  })
}
