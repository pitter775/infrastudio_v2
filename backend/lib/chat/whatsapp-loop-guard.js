const WHATSAPP_LOOP_WINDOW_MS = 3 * 60 * 1000
const WHATSAPP_LOOP_RAPID_GAP_MS = 25 * 1000
const WHATSAPP_LOOP_TAIL_GAP_MS = 45 * 1000
const WHATSAPP_LOOP_PROBE_TEXT = "Voce e humano?"

function normalizeLoopGuardText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function getLoopGuardMessageTimestamp(message) {
  const timestamp = new Date(message?.createdAt ?? 0).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function isManualAssistantMessage(message) {
  return message?.role === "assistant" && message?.metadata?.manual === true
}

function isAutomatedAssistantMessage(message) {
  return message?.role === "assistant" && !isManualAssistantMessage(message)
}

function isPositiveHumanConfirmation(message) {
  const normalized = normalizeLoopGuardText(message)
  return /^(sim|sou humano|sim sou humano|sou uma pessoa|sou atendente|sim sou uma pessoa|sim, sou humano)\b/.test(normalized)
}

function isLoopGuardProbeMessage(message) {
  return normalizeLoopGuardText(message) === normalizeLoopGuardText(WHATSAPP_LOOP_PROBE_TEXT)
}

export function detectWhatsAppLoopGuard(history = []) {
  const messages = Array.isArray(history) ? history.filter(Boolean) : []
  if (!messages.length) {
    return { action: "none", metrics: null }
  }

  const latestMessage = messages[messages.length - 1]
  const latestTimestamp = getLoopGuardMessageTimestamp(latestMessage) || Date.now()
  const recent = messages.filter((message) => latestTimestamp - getLoopGuardMessageTimestamp(message) <= WHATSAPP_LOOP_WINDOW_MS)
  if (recent.length < 2) {
    return { action: "none", metrics: null }
  }

  const recentUserCount = recent.filter((message) => message.role === "user").length
  const recentAutoAssistantCount = recent.filter(isAutomatedAssistantMessage).length
  const recentManualAssistantCount = recent.filter(isManualAssistantMessage).length
  const recentRapidTransitions = recent.slice(1).reduce((count, message, index) => {
    const previous = recent[index]
    const delta = getLoopGuardMessageTimestamp(message) - getLoopGuardMessageTimestamp(previous)
    return delta > 0 && delta <= WHATSAPP_LOOP_RAPID_GAP_MS ? count + 1 : count
  }, 0)

  let tailAlternatingCount = 1
  for (let index = recent.length - 1; index > 0; index -= 1) {
    const current = recent[index]
    const previous = recent[index - 1]
    const delta = getLoopGuardMessageTimestamp(current) - getLoopGuardMessageTimestamp(previous)

    if (delta <= 0 || delta > WHATSAPP_LOOP_TAIL_GAP_MS) {
      break
    }
    if (current.role === previous.role) {
      break
    }
    if (isManualAssistantMessage(current) || isManualAssistantMessage(previous)) {
      break
    }

    tailAlternatingCount += 1
  }

  const previousAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null
  const latestUserText = latestMessage?.role === "user" ? latestMessage?.conteudo ?? "" : ""
  const previousAssistantWasProbe = isLoopGuardProbeMessage(previousAssistantMessage?.conteudo ?? "")
  const recentProbeAlreadySent = recent.some(
    (message) => message.role === "assistant" && isLoopGuardProbeMessage(message?.conteudo ?? "")
  )

  const metrics = {
    recentCount: recent.length,
    recentUserCount,
    recentAutoAssistantCount,
    recentManualAssistantCount,
    recentRapidTransitions,
    tailAlternatingCount,
    previousAssistantWasProbe,
  }

  if (recentManualAssistantCount > 0) {
    return { action: "none", metrics }
  }

  if (previousAssistantWasProbe && isPositiveHumanConfirmation(latestUserText)) {
    return {
      action: "pause",
      reason: "probe_confirmed_human_claim",
      metrics,
    }
  }

  if (
    recent.length >= 12 &&
    recentUserCount >= 5 &&
    recentAutoAssistantCount >= 5 &&
    recentRapidTransitions >= 7 &&
    tailAlternatingCount >= 8
  ) {
    return {
      action: "pause",
      reason: "rapid_bidirectional_loop",
      metrics,
    }
  }

  if (
    !recentProbeAlreadySent &&
    recent.length >= 8 &&
    recentUserCount >= 3 &&
    recentAutoAssistantCount >= 3 &&
    recentRapidTransitions >= 5 &&
    tailAlternatingCount >= 6
  ) {
    return {
      action: "probe",
      reason: "suspected_automation_loop",
      metrics,
    }
  }

  return { action: "none", metrics }
}

export function buildLoopGuardAiResult(reason, metrics = {}) {
  return {
    reply: WHATSAPP_LOOP_PROBE_TEXT,
    assets: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
    metadata: {
      provider: "local_guardrail",
      model: "whatsapp_loop_guard",
      routeStage: "guardrail",
      heuristicStage: reason,
      domainStage: "whatsapp",
      loopGuard: metrics,
    },
  }
}
