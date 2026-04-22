import { buildBillingBlockedResult, buildSilentChatResult } from "@/lib/chat/result-builders"
import {
  getChatHandoffByChatId,
  isHumanHandoffExpired,
  releaseHumanHandoff,
  shouldPauseAssistantForHandoff,
} from "@/lib/chat-handoffs"

export async function applyBillingGuardrail(input, deps = {}) {
  const verifyBilling = deps.verificarLimite ?? (async () => null)
  const billingAccess = input.projetoId ? await verifyBilling(input.projetoId) : null

  if (billingAccess && billingAccess.allowed === false) {
    return {
      blocked: true,
      billingAccess,
      result: buildBillingBlockedResult(
        input.chatId,
        billingAccess.message ??
          "O limite mensal deste projeto foi atingido. Fale com o administrador para liberar novo ciclo ou ajustar o plano."
      ),
    }
  }

  return {
    blocked: false,
    billingAccess,
    result: null,
  }
}

export async function applyHandoffGuardrail(input, deps = {}) {
  const loadChatHandoff = deps.getChatHandoffByChatId ?? getChatHandoffByChatId
  const releaseHandoff = deps.releaseHumanHandoff ?? releaseHumanHandoff
  const currentHandoff = await loadChatHandoff(input.chatId)

  if (isHumanHandoffExpired(currentHandoff)) {
    const releasedHandoff = await releaseHandoff({
      chatId: input.chatId,
      usuarioId: null,
      autoReleased: true,
    })

    return {
      paused: false,
      handoff: releasedHandoff ?? currentHandoff,
      result: null,
    }
  }

  if (shouldPauseAssistantForHandoff(currentHandoff)) {
    return {
      paused: true,
      handoff: currentHandoff,
      result: buildSilentChatResult(input.chatId),
    }
  }

  return {
    paused: false,
    handoff: currentHandoff,
    result: null,
  }
}
