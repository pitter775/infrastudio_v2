export function isPlainJsonObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function validateJsonValue(value, path, depth, maxDepth) {
  if (depth > maxDepth) {
    return `${path} excede a profundidade maxima de ${maxDepth}.`
  }

  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return `${path} contem numero invalido.`
    }
    return null
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const error = validateJsonValue(value[index], `${path}[${index}]`, depth + 1, maxDepth)
      if (error) {
        return error
      }
    }
    return null
  }

  if (!isPlainJsonObject(value)) {
    return `${path} deve conter apenas JSON simples.`
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (!key || key.length > 120) {
      return `${path} contem chave invalida.`
    }

    const error = validateJsonValue(childValue, `${path}.${key}`, depth + 1, maxDepth)
    if (error) {
      return error
    }
  }

  return null
}

export function validateJsonObjectConfig(value, label = "Configuracao JSON", options = {}) {
  if (value == null) {
    return { ok: true, value: null }
  }

  if (!isPlainJsonObject(value)) {
    return { ok: false, error: `${label} deve ser um objeto JSON.` }
  }

  const error = validateJsonValue(value, label, 1, options.maxDepth ?? 10)
  if (error) {
    return { ok: false, error }
  }

  return { ok: true, value }
}
