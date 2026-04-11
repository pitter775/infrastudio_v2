import "server-only"

const DEFAULT_MODEL = "gpt-4o-mini"

const MODEL_PRICING = {
  "gpt-4o-mini": {
    label: "GPT-4o Mini",
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.6,
  },
  "gpt-4o": {
    label: "GPT-4o",
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10,
  },
  "gpt-4.1-mini": {
    label: "GPT-4.1 Mini",
    inputPerMillionUsd: 0.4,
    outputPerMillionUsd: 1.6,
  },
  "gpt-4.1": {
    label: "GPT-4.1",
    inputPerMillionUsd: 2,
    outputPerMillionUsd: 8,
  },
}

function normalizeModel(model) {
  const normalized = String(model ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^gpt4o-mini$/, "gpt-4o-mini")
    .replace(/^gpt-4omini$/, "gpt-4o-mini")
    .replace(/^gpt4o$/, "gpt-4o")
    .replace(/^gpt41mini$/, "gpt-4.1-mini")
    .replace(/^gpt-41-mini$/, "gpt-4.1-mini")
    .replace(/^gpt41$/, "gpt-4.1")
    .replace(/^gpt-41$/, "gpt-4.1")

  return normalized || DEFAULT_MODEL
}

export function resolvePricingModel(model) {
  const normalized = normalizeModel(model)
  return MODEL_PRICING[normalized] ? normalized : DEFAULT_MODEL
}

export function estimateOpenAICostUsd(inputTokens, outputTokens, model) {
  const resolvedModel = resolvePricingModel(model)
  const pricing = MODEL_PRICING[resolvedModel]
  const safeInput = Math.max(0, Number(inputTokens) || 0)
  const safeOutput = Math.max(0, Number(outputTokens) || 0)

  const total =
    (safeInput / 1_000_000) * pricing.inputPerMillionUsd +
    (safeOutput / 1_000_000) * pricing.outputPerMillionUsd

  return Number(total.toFixed(8))
}
