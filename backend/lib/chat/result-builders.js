export function buildSilentChatResult(chatId) {
  return {
    chatId: chatId ?? "",
    reply: "",
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
    actions: [],
  }
}

export function buildBillingBlockedResult(chatId, message) {
  return {
    chatId: chatId ?? "",
    reply: String(message || "").trim(),
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
    actions: [],
  }
}

export function buildIsolatedChatResult(body, message) {
  const chatId =
    body?.chatId?.trim() ||
    body?.identificadorExterno?.trim() ||
    body?.identificador?.trim() ||
    "isolated-chat"
  const sanitizedMessage = String(message || "").replace(/\s+/g, " ").trim()
  const reply = sanitizedMessage
    ? `Recebi sua mensagem: "${sanitizedMessage}". O chat esta rodando em modo isolado, sem Supabase, WhatsApp ou handoff.`
    : "O chat esta rodando em modo isolado, sem Supabase, WhatsApp ou handoff."

  return {
    chatId,
    reply,
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
    actions: [],
  }
}

export function buildFinalChatResult(input) {
  return {
    chatId: input.chatId,
    messageId: input.messageId ?? null,
    createdAt: input.createdAt ?? null,
    reply: input.reply,
    followUpReply: input.channelKind === "whatsapp" ? "" : input.followUpReply || "",
    messageSequence: input.channelKind === "whatsapp" ? input.messageSequence ?? [] : [],
    assets: input.channelKind === "whatsapp" ? [] : input.assets ?? [],
    whatsapp: input.whatsapp ?? null,
    actions: input.channelKind === "whatsapp" ? [] : input.actions ?? [],
    handoff: input.handoff ?? null,
  }
}
