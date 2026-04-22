function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function parseAssetPrice(value) {
  if (typeof value !== "string") {
    return null
  }

  const numeric = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")
  const parsed = Number(numeric)
  return Number.isFinite(parsed) ? parsed : null
}

export function extractRecentMercadoLivreProductsFromAssets(assets) {
  if (!Array.isArray(assets)) {
    return []
  }

  return assets
    .filter(
      (asset) =>
        isPlainObject(asset) &&
        typeof asset.id === "string" &&
        (asset.id.startsWith("mercado-livre-") || /^MLB\d+$/i.test(asset.id))
    )
    .map((asset, index) => ({
      id: typeof asset.id === "string" ? asset.id : null,
      nome: typeof asset.nome === "string" ? asset.nome : null,
      descricao: typeof asset.descricao === "string" ? asset.descricao : null,
      preco: parseAssetPrice(asset.priceLabel || asset.descricao),
      link: typeof asset.targetUrl === "string" ? asset.targetUrl : null,
      imagem: typeof asset.publicUrl === "string" ? asset.publicUrl : null,
      sellerId: typeof asset.metadata?.sellerId === "string" ? asset.metadata.sellerId : null,
      sellerName: typeof asset.metadata?.sellerName === "string" ? asset.metadata.sellerName : null,
      availableQuantity:
        Number.isFinite(Number(asset.metadata?.availableQuantity)) ? Number(asset.metadata.availableQuantity) : 0,
      status: typeof asset.metadata?.status === "string" ? asset.metadata.status : null,
      cardIndex: index,
    }))
    .filter((asset) => asset.nome)
}

function formatWhatsAppOutboundTextSafe(reply) {
  return String(reply || "")
    .replace(/\r\n/g, "\n")
    .replace(/([.!?])\s+(?=[A-Z0-9*])/g, "$1\n\n")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/^[\-\*]\s+/gm, "- ")
    .replace(/^(\d+)\)\s+/gm, "$1. ")
    .replace(/^([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF0-9\s]{1,28}):\s*/gm, (match, label) => {
      const normalizedLabel = String(label || "").trim().toLowerCase()
      if (["http", "https", "www"].includes(normalizedLabel)) {
        return match
      }

      return `*${String(label || "").trim()}:* `
    })
    .replace(/:\s+(?=(?:\d+\.|\*[A-Z0-9]))/g, ":\n")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripAssistantMetaArtifacts(reply) {
  let sanitized = String(reply || "")

  const forbiddenPatterns = [
    /Seu atendimento acontece exclusivamente via WhatsApp[^\n]*?/gi,
    /Seu atendimento ocorre exclusivamente via WhatsApp[^\n]*?/gi,
    /de forma natural,\s*simp(?:a|\u00E1)t(?:i|\u00ED)ca e acolhedora[^\n]*?/gi,
    /de forma natural,\s*simpat(?:i|\u00ED)ca e acolhedora[^\n]*?/gi,
    /de forma natural[^\n]*?acolhedora[^\n]*?/gi,
    /como se fosse uma pessoa real atendendo[^\n]*?/gi,
    /voce esta falando com (uma )?ia[^\n]*?/gi,
    /minha funcao aqui e te atender[^\n]*?/gi,
  ]

  for (const pattern of forbiddenPatterns) {
    sanitized = sanitized.replace(pattern, "")
  }

  return sanitized
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([.!?])\s+(?=[A-Z0-9*])/g, "$1\n\n")
    .replace(/^([A-Za-z0-9][A-Za-z0-9\s]{1,28}):\s*/gm, "$1:\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function stripAssistantMetaReply(reply, channelKind) {
  const sanitized = stripAssistantMetaArtifacts(reply)
  return channelKind === "whatsapp" ? formatWhatsAppOutboundTextSafe(sanitized) : sanitized
}

function preserveStructuredWhitespace(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/\s+\./g, ".").replace(/\s+,/g, ",").replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
}

export function normalizeStructuredCustomerReply(reply) {
  const lines = preserveStructuredWhitespace(reply)
    .replace(/(^|\n)\s*(\d+)\.\s*\n+(?=\S)/g, "$1$2. ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")

  return lines
    .map((rawLine) => {
      const line = String(rawLine || "").trim()
      if (!line) {
        return ""
      }

      if (/^(https?:\/\/|www\.)/i.test(line)) {
        return line
      }

      const bareLabelMatch = line.match(/^([A-Za-z\u00C0-\u00FF$][A-Za-z\u00C0-\u00FF0-9\s/_-]{1,40}:)\s*$/)
      if (bareLabelMatch) {
        return `**${bareLabelMatch[1]}**`
      }

      const inlineLabelMatch = line.match(/^([A-Za-z\u00C0-\u00FF$][A-Za-z\u00C0-\u00FF0-9\s/_-]{1,40}:)\s+(.+)$/)
      if (inlineLabelMatch) {
        return `**${inlineLabelMatch[1]}** ${inlineLabelMatch[2].trim()}`
      }

      const numberedLabelMatch = line.match(/^(\d+\.)\s+([A-Za-z\u00C0-\u00FF$][A-Za-z\u00C0-\u00FF0-9\s/_-]{1,40}:)\s+(.+)$/)
      if (numberedLabelMatch) {
        return `${numberedLabelMatch[1]} **${numberedLabelMatch[2]}** ${numberedLabelMatch[3].trim()}`
      }

      return line
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatContinuationSummary(rawSummary) {
  const summaryText = String(rawSummary || "").trim()
  if (!summaryText) {
    return ""
  }

  try {
    const parsed = JSON.parse(summaryText)
    const snippets = []
    const objetivo = typeof parsed.objetivo === "string" ? parsed.objetivo.trim() : ""
    const proximoPasso = typeof parsed.proximo_passo === "string" ? parsed.proximo_passo.trim() : ""
    const restricoes = typeof parsed.restricoes === "string" ? parsed.restricoes.trim() : ""
    const dorPrincipal = typeof parsed.dor_principal === "string" ? parsed.dor_principal.trim() : ""

    if (objetivo) snippets.push(`objetivo: ${objetivo}`)
    if (dorPrincipal) snippets.push(`dor: ${dorPrincipal}`)
    if (restricoes) snippets.push(`pontos de atencao: ${restricoes}`)
    if (proximoPasso) snippets.push(`proximo passo: ${proximoPasso}`)

    const compact = snippets.join(" | ").trim()
    if (compact) {
      return compact.slice(0, 280)
    }
  } catch {
    // fallback para texto livre
  }

  return summaryText.replace(/\s+/g, " ").trim().slice(0, 280)
}

export function formatWhatsAppHumanOutboundText(reply) {
  return formatWhatsAppOutboundTextSafe(reply)
}

export function sanitizeWhatsAppCustomerFacingReply(reply) {
  let sanitized = stripAssistantMetaArtifacts(reply)

  const promisePatterns = [
    /\b(?:deixa|deixe)\s+eu\s+(?:ver|verificar|consultar|olhar)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:eu\s+)?vou\s+(?:ver|verificar|consultar|olhar)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:eu\s+)?ja\s+(?:vejo|verifico|consulto|olho)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:posso|consigo)\s+(?:ver|verificar|consultar|olhar)\s+(?:o\s+)?status\b[^.!?\n]*[.!?]?/gi,
  ]

  for (const pattern of promisePatterns) {
    sanitized = sanitized.replace(pattern, " ")
  }

  return preserveStructuredWhitespace(sanitized)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function buildWhatsAppMessageSequence(reply, assets, followUpReply) {
  const messages = []
  const intro = formatWhatsAppOutboundTextSafe(reply)
  if (intro) {
    messages.push(intro)
  }

  const assetMessages = Array.isArray(assets)
    ? assets
        .slice(0, 3)
        .map((asset, index) => {
          if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
            return ""
          }

          const nome = "nome" in asset ? String(asset.nome || "").trim() : ""
          const targetUrl = "targetUrl" in asset ? String(asset.targetUrl || "").trim() : ""
          const whatsappText = "whatsappText" in asset ? String(asset.whatsappText || "").trim() : ""
          const descricao = "descricao" in asset ? String(asset.descricao || "").trim() : ""
          const supportText = whatsappText || descricao

          if (!targetUrl && !supportText) {
            return ""
          }

          const parts = [formatWhatsAppOutboundTextSafe(`*${index + 1}. ${nome || "Produto"}*`)]
          if (supportText) {
            parts.push(formatWhatsAppOutboundTextSafe(supportText))
          }
          if (targetUrl) {
            parts.push(targetUrl)
          }

          return parts.join("\n").trim()
        })
        .filter(Boolean)
    : []

  if (followUpReply && String(followUpReply).trim()) {
    messages.push(formatWhatsAppOutboundTextSafe(followUpReply))
  }

  return [...messages, ...assetMessages]
}

export function isCatalogSearchMessage(message) {
  const latestNormalizedMessage = String(message || "").toLowerCase()
  const catalogSignals = ["tem ", "produto", "produtos", "catalogo", "loja", "vende", "procuro", "estou procurando"]

  return catalogSignals.some((signal) => latestNormalizedMessage.includes(signal)) || /^\s*e\s+\S+/i.test(message)
}

export function isCatalogLoadMoreMessage(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return false
  }

  if (["mais", "outras", "outros", "mais opcoes", "outras opcoes", "mais modelos", "outros modelos"].includes(normalized)) {
    return true
  }

  return [
    /\btem mais\b/,
    /\bquero mais\b/,
    /\bme mostra mais\b/,
    /\bmostra mais\b/,
    /\btraz mais\b/,
    /\bmanda mais\b/,
    /\bver mais\b/,
    /\boutras opcoes\b/,
    /\boutros modelos\b/,
    /\bmais modelos\b/,
    /\bmais opcoes\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function splitCatalogReplyForWhatsApp(reply, hasAssets) {
  const normalizedReply = String(reply || "").trim()
  if (!hasAssets || !normalizedReply) {
    return {
      mainReply: normalizedReply,
      followUpReply: "",
    }
  }

  const followUpPatterns = [
    /Me diga se gostou de algum ou se quer que eu traga mais opcoes parecidas\.?/i,
    /Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo\.?/i,
    /Se gostar desse estilo, eu posso te mostrar outras opcoes parecidas tambem\.?/i,
    /Se gostar desse estilo, eu posso te trazer outras opcoes parecidas tambem\.?/i,
    /Se quiser, eu tambem posso buscar outras opcoes parecidas ou seguir com este item por aqui\.?/i,
  ]

  const matchedPattern = followUpPatterns.find((pattern) => pattern.test(normalizedReply))
  if (!matchedPattern) {
    return {
      mainReply: normalizedReply,
      followUpReply: "",
    }
  }

  const followUpReply = normalizedReply.match(matchedPattern)?.[0]?.trim() ?? ""
  const mainReply = normalizedReply.replace(matchedPattern, "").replace(/\n{3,}/g, "\n\n").trim()

  return {
    mainReply: mainReply || normalizedReply,
    followUpReply,
  }
}

export function buildContinuationMessage(input) {
  const resumoLimpo = formatContinuationSummary(input.resumo)
  const produtoAtual = String(input.produtoAtual || "").trim()
  const ultimaMensagem = String(input.ultimaMensagem || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220)

  return [
    `Ola! Vim do chat do site${input.projetoNome ? ` do projeto ${input.projetoNome}` : ""}.`,
    input.agenteNome ? `Agente de referencia: ${input.agenteNome}.` : "",
    produtoAtual ? `Produto em foco: ${produtoAtual}.` : "",
    resumoLimpo ? `Resumo para continuidade: ${resumoLimpo}` : "",
    ultimaMensagem ? `Ultima mensagem do cliente: ${ultimaMensagem}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim()
}
