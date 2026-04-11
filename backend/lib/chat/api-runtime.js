import { buildSearchTokens, normalizeText } from "@/lib/chat/text-utils"

function normalizeDateValue(value) {
  const raw = String(value ?? "")
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw
}

function fieldScore(messageTokens, field) {
  const haystack = normalizeText([field?.nome, field?.valor].filter(Boolean).join(" "))
  return messageTokens.filter((token) => haystack.includes(token)).length
}

export function buildFocusedApiContext(message, apis = [], deps = {}) {
  const buildTokens = deps.buildSearchTokens ?? buildSearchTokens
  const tokens = buildTokens(message)
  const fields = []

  for (const api of apis ?? []) {
    for (const field of api.campos ?? []) {
      const score = fieldScore(tokens, field)
      if (score > 0) {
        fields.push({
          apiId: api.apiId,
          apiNome: api.nome,
          nome: field.nome,
          tipo: field.tipo,
          valor: field.valor,
          score,
        })
      }
    }
  }

  return {
    fields,
    apis: fields.length ? apis : [],
  }
}

export function buildApiFallbackReply(message, apis = [], deps = {}) {
  const focused = buildFocusedApiContext(message, apis, deps)
  const fields = focused.fields.length
    ? focused.fields
    : (apis ?? []).flatMap((api) => (api.campos ?? []).map((field) => ({ ...field, apiNome: api.nome })))

  if (!fields.length) {
    return null
  }

  const normalized = normalizeText(message)
  const preferred = fields.find((field) => normalized.includes("data") && normalizeText(field.nome).includes("data")) ?? fields[0]
  return `${preferred.nome}: ${normalizeDateValue(preferred.valor)}`
}

export const API_RUNTIME_FACTUAL_SIGNALS = ["status", "data", "previsao", "pedido", "valor", "estoque"]
