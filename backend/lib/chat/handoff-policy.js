export function isHumanHandoffIntent(message) {
  return /\b(atendente|humano|pessoa|falar com alguem|suporte)\b/i.test(String(message || ""))
}

export function buildHumanHandoffReply(channelKind = "web") {
  return channelKind === "whatsapp"
    ? "Perfeito. Ja acionei um atendente humano para continuar por aqui no WhatsApp."
    : "Perfeito. Ja acionei um atendente humano para continuar por aqui."
}

export function appendOptionalHumanOffer(reply, channelKind = "web") {
  const base = String(reply || "").trim()
  const offer = channelKind === "whatsapp" ? "Se preferir, posso chamar um atendente humano no WhatsApp." : "Se preferir, posso chamar um atendente humano."
  return base && !/atendente humano/i.test(base) ? `${base} ${offer}` : base || offer
}

export async function classifyHumanEscalationNeed(input) {
  if (isHumanHandoffIntent(input?.message)) {
    return {
      decision: "request_handoff",
      reason: "Cliente pediu atendimento humano.",
    }
  }

  return {
    decision: "none",
    reason: "Sem sinal suficiente para handoff.",
  }
}
