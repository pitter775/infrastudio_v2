import { buildChatUsageTelemetry } from "@/lib/chat-usage-metrics"
import { estimateOpenAICostUsd } from "@/lib/openai-pricing"

export function buildUsagePersistencePayload(input) {
  const provider = typeof input.aiMetadata?.provider === "string" ? input.aiMetadata.provider : null
  const model = typeof input.aiMetadata?.model === "string" ? input.aiMetadata.model : null
  const estimatedCostUsd =
    provider === "openai"
      ? estimateOpenAICostUsd(input.inputTokens, input.outputTokens, model)
      : 0
  const usageTelemetry = buildChatUsageTelemetry({
    channelKind: input.channelKind,
    provider,
    model,
    routeStage: typeof input.aiMetadata?.routeStage === "string" ? input.aiMetadata.routeStage : null,
    heuristicStage: typeof input.aiMetadata?.heuristicStage === "string" ? input.aiMetadata.heuristicStage : null,
    domainStage:
      typeof input.aiMetadata?.domainStage === "string"
        ? input.aiMetadata.domainStage
        : typeof input.aiMetadata?.debugRequest?.domainStage === "string"
          ? input.aiMetadata.debugRequest.domainStage
          : null,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd,
  })

  return {
    estimatedCostUsd,
    usageTelemetry,
    usageRecord: {
      projetoId: input.projetoId,
      tokens: Number(input.inputTokens ?? 0) + Number(input.outputTokens ?? 0),
      custo: estimatedCostUsd,
      details: {
        tokensInput: Number(input.inputTokens ?? 0),
        tokensOutput: Number(input.outputTokens ?? 0),
        usuarioId: input.usuarioId ?? null,
        origem: usageTelemetry.billingOrigin,
        referenciaId: input.referenciaId ?? null,
      },
    },
  }
}

export async function persistUsageRecord(input, deps = {}) {
  const registerUsage = deps.registrarUso ?? (async () => null)
  if (!input?.projetoId) {
    return null
  }

  return registerUsage(input.projetoId, input.tokens, input.custo, input.details)
}
