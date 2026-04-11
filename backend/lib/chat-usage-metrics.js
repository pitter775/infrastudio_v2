import "server-only"

function sanitizeOriginPart(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalized || fallback
}

export function buildChatUsageOrigin(input) {
  const channelKind = sanitizeOriginPart(input.channelKind, "unknown_channel")
  const provider = sanitizeOriginPart(input.provider, "unknown_provider")
  const routeStage = sanitizeOriginPart(input.routeStage, "unknown_route")
  const domainStage = sanitizeOriginPart(input.domainStage, "unknown_domain")
  return `chat:${channelKind}:${provider}:${routeStage}:${domainStage}`
}

export function buildChatUsageTelemetry(input) {
  const inputTokens = Math.max(0, Number(input.inputTokens ?? 0))
  const outputTokens = Math.max(0, Number(input.outputTokens ?? 0))
  const estimatedCostUsd = Math.max(0, Number(input.estimatedCostUsd ?? 0))

  return {
    channelKind: sanitizeOriginPart(input.channelKind, "unknown_channel"),
    provider: sanitizeOriginPart(input.provider, "unknown_provider"),
    model: String(input.model ?? "").trim() || "unknown_model",
    routeStage: input.routeStage ?? null,
    heuristicStage: input.heuristicStage ?? null,
    domainStage: input.domainStage ?? null,
    billingOrigin: buildChatUsageOrigin(input),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCostUsd,
  }
}
