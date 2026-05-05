export function isHumanHandoffIntent(message) {
  return /\b(atendente|humano|pessoa|falar com alguem|suporte)\b/i.test(String(message || ""))
}

export function buildHumanHandoffReply(channelKind = "web", options = {}) {
  const hasRecipients = options.hasRecipients === true
  const hasWhatsAppDestination =
    options.hasWhatsAppDestination === true || (options.hasWhatsAppDestination == null && channelKind === "whatsapp")

  if (hasRecipients) {
    return channelKind === "whatsapp"
      ? "Perfeito. Ja acionei um atendente humano para continuar por aqui no WhatsApp."
      : "Perfeito. Ja acionei um atendente humano para continuar por aqui."
  }

  if (hasWhatsAppDestination) {
    return channelKind === "whatsapp"
      ? "Consigo continuar por aqui no WhatsApp, mas este projeto ainda não tem um atendente configurado para receber o chamado humano."
      : "Consigo te direcionar para o WhatsApp, mas este projeto ainda não tem um atendente configurado para receber o chamado humano."
  }

  return "Este projeto ainda não tem um atendente configurado para receber o chamado humano."
}

export function appendOptionalHumanOffer(reply, channelKind = "web") {
  const base = String(reply || "").trim()
  const offer = channelKind === "whatsapp" ? "Se preferir, posso chamar um atendente humano no WhatsApp." : "Se preferir, posso chamar um atendente humano."
  return base && !/atendente humano/i.test(base) ? `${base} ${offer}` : base || offer
}

function looksOutOfDomainReply(aiReply) {
  const normalized = String(aiReply || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return [
    /\bnao consigo te ajudar com isso\b/,
    /\bnao tenho como te ajudar\b/,
    /\bnao tenho essa informacao\b/,
    /\bnao consigo confirmar\b/,
    /\bnao consigo responder\b/,
    /\bisso foge do escopo\b/,
    /\bfora do escopo\b/,
    /\bnao encontrei essa informacao\b/,
    /\bpreciso que um atendente\b/,
  ].some((pattern) => pattern.test(normalized))
}

export async function classifyHumanEscalationNeed(input) {
  if (isHumanHandoffIntent(input?.message)) {
    return {
      decision: "request_handoff",
      reason: "Cliente pediu atendimento humano.",
    }
  }

  if (looksOutOfDomainReply(input?.aiReply)) {
    return {
      decision: "offer_handoff",
      reason: "Resposta indica que a pergunta fugiu do dominio atual do agente.",
    }
  }

  return {
    decision: "none",
    reason: "Sem sinal suficiente para handoff.",
  }
}
