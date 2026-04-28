import { buildSearchTokens, normalizeText } from "@/lib/chat/text-utils"
import { hasConfiguredWhatsAppDestination } from "@/lib/chat/whatsapp-availability"

const PRODUCT_SEARCH_STOPWORDS = new Set([
  "vc",
  "voce",
  "oq",
  "oque",
  "que",
  "qual",
  "quais",
  "como",
  "tem",
  "tenho",
  "teria",
  "mostrar",
  "mostre",
  "esse",
  "essa",
  "esses",
  "essas",
  "bem",
  "muito",
  "mais",
  "menos",
  "para",
  "pra",
  "com",
  "sem",
  "que",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "na",
  "no",
  "nas",
  "nos",
  "um",
  "uma",
  "uns",
  "umas",
  "e",
  "gostei",
  "quero",
  "procuro",
  "buscar",
  "busca",
  "produto",
  "produtos",
  "item",
  "itens",
  "desse",
  "deste",
  "desta",
  "dele",
  "dela",
  "alem",
  "alemd",
  "outro",
  "outra",
  "outros",
  "outras",
])

function getRuntimeConfig(context) {
  const runtimeConfig = context?.agente?.runtimeConfig ?? context?.agente?.configuracoes?.runtimeConfig ?? null
  return runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig) ? runtimeConfig : null
}

function normalizeConversationHistory(history = [], deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  return history
    .filter((item) => item?.role === "user")
    .map((item) => normalize(item?.content ?? item?.conteudo ?? ""))
    .join(" ")
}

export function isGreetingOrAckMessage(message, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(message)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  return [
    "oi",
    "ola",
    "ok",
    "obrigado",
    "obrigada",
    "bom dia",
    "boa tarde",
    "boa noite",
    "sim",
    "nao",
    "perfeito",
    "show",
  ].includes(normalized)
}

export function buildProductSearchCandidates(message, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(message)
  if (!normalized || isGreetingOrAckMessage(normalized, deps)) {
    return []
  }

  const tokens = normalized
    .replace(/\bsoperia\b/g, "sopeira")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !PRODUCT_SEARCH_STOPWORDS.has(token))

  if (!tokens.length) {
    return []
  }

  const candidates = new Set([tokens.join(" ").trim()])
  if (tokens.length >= 2) {
    candidates.add(tokens.slice(0, 2).join(" "))
    candidates.add(tokens.slice(-2).join(" "))
  }

  return [...candidates].filter(Boolean)
}

export function shouldSearchProducts(message, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(message)
  const commercialServiceSignals = [
    /\bpreco\b/,
    /\bvalor\b/,
    /\borcamento\b/,
    /\bquanto\b/,
    /\bestimativa\b/,
    /\bsistema\b/,
    /\bsite\b/,
    /\bchat\b/,
    /\bagente\b/,
    /\bautomac(?:ao|a)o\b/,
    /\bintegrac(?:ao|a)o\b/,
    /\bwhatsapp\b/,
  ]

  if (commercialServiceSignals.some((pattern) => pattern.test(normalized))) {
    const explicitCatalogSignals = [
      /\bproduto\b/,
      /\bprodutos\b/,
      /\bitem\b/,
      /\bitens\b/,
      /\bcatalogo\b/,
      /\bloja\b/,
      /\bmercado livre\b/,
      /\bml\b/,
      /\bsku\b/,
      /\bmodelo\b/,
      /\bcor\b/,
      /\btamanho\b/,
    ]

    if (!explicitCatalogSignals.some((pattern) => pattern.test(normalized))) {
      return false
    }
  }

  return /\b(tem|produto|produtos|procuro|buscar|busca|mostra|mostrar|vende|loja|catalogo|mercado livre|ml|preciso|quero|busco|procurando)\b/.test(
    normalized
  )
}

export function shouldContinueProductSearch(history, latestUserMessage, context, deps = {}) {
  const normalize = deps.normalizeText ?? normalizeText
  const normalized = normalize(latestUserMessage)
  if (!normalized || deps.isGreetingOrAckMessage?.(latestUserMessage)) {
    return false
  }

  if (/\b(preco|valor|orcamento|quanto|media de valor|estimativa|sistema|site|chat|agente|automac(?:ao|a)o|integrac(?:ao|a)o|whatsapp)\b/.test(normalized)) {
    return false
  }

  const hasCatalogSearch = Boolean(context?.catalogo?.ultimaBusca)
  const wantsMore =
    /\b(mais|outras|outros|modelos|opcoes)\b/.test(normalized) ||
    /\b(manda|mande|envia|envie|mostra|mostre|traz|traga)\b[\s\S]{0,40}\btiver(?:em)?\b/.test(normalized) ||
    /\b(o que tiver|oq tiver|q tiver|qualquer um|qualquer coisa)\b/.test(normalized)
  return Boolean(hasCatalogSearch && wantsMore)
}

export function shouldUseMercadoLivreConnectorFallback(history, latestUserMessage, context, deps = {}) {
  const normalized = (deps.normalizeText ?? normalizeText)(latestUserMessage).trim()
  if (!normalized) {
    return false
  }

  if (deps.isLikelyLeadNameReply?.(latestUserMessage, history)) {
    return false
  }

  if (deps.isGreetingOrAckMessage?.(latestUserMessage)) {
    return false
  }

  if (!context?.catalogo?.ultimaBusca && /\b(gostei|esse|essa|desse|dessa)\b/.test(normalized)) {
    return false
  }

  if (/\b(preco|valor|orcamento|quanto|site|chat|agente|automac(?:ao|a)o|integrac(?:ao|a)o|whatsapp|api|status|codigo|consulta)\b/.test(normalized)) {
    return false
  }

  return shouldSearchProducts(latestUserMessage, deps) || shouldContinueProductSearch(history, latestUserMessage, context, deps)
}

export function isMercadoLivreListingIntent(message, deps = {}) {
  const normalized = (deps.normalizeText ?? normalizeText)(message)
  return /\b(lista|listar|opcoes|modelos|produtos|mais|preciso|quero|procuro|busco|procurando|manda|mande|envia|envie|mostra|mostre|traz|traga)\b/.test(
    normalized
  ) || /\b(o que tiver|oq tiver|q tiver|qualquer um|qualquer coisa)\b/.test(normalized)
}

export function detectCatalogItems(history = [], deps = {}) {
  const runtimeConfig = deps.runtimeConfig ?? null
  const userText = normalizeConversationHistory(history, deps)
  const configuredItems = Array.isArray(runtimeConfig?.pricingCatalog?.items) ? runtimeConfig.pricingCatalog.items : null
  if (!configuredItems?.length) {
    return []
  }

  return configuredItems
    .filter((item) => Array.isArray(item?.matchAny) && item.matchAny.some((token) => userText.includes(normalizeText(token))))
    .map((item) => ({
      slug: item.slug,
      nome: item.name,
      precoLabel: item.priceLabel,
    }))
}

export function isOutOfScopeForCatalog(historyOrMessage, deps = {}) {
  if (typeof historyOrMessage === "string") {
    return /\b(politica|religiao|codigo|programar)\b/i.test(String(historyOrMessage || ""))
  }

  const userText = normalizeConversationHistory(historyOrMessage, deps)
  const asksForChat =
    /\bchat\b|\bwidget\b|\bia no site\b|\bagente no site\b|\batendimento com ia\b|\bchat no site\b|\bchat no sistema\b|\badicionar o chat\b|\bcolocar o chat\b|\bimplantar o chat\b/.test(
      userText
    )
  const complexSignals = [
    /\berp\b/,
    /\bintegrac(?:ao|a)o(?:es)?\b/,
    /\bmuitas regras\b/,
    /\bfluxos\b/,
    /\bprocessos\b/,
    /\bsistema interno\b/,
    /\bsob medida\b/,
    /\bvarios\b/,
    /\bcomplex[oa]\b/,
    /\bmais de um\b/,
  ]

  const catalogItems = detectCatalogItems(historyOrMessage, deps)
  return catalogItems.length === 0 || (!asksForChat && complexSignals.some((pattern) => pattern.test(userText)))
}

export function buildCatalogPricingReply(productOrHistory, context, deps = {}) {
  if (Array.isArray(productOrHistory)) {
    const history = productOrHistory
    const runtimeConfig = deps.runtimeConfig ?? getRuntimeConfig(context)
    const catalogItems = detectCatalogItems(history, { ...deps, runtimeConfig })
    if (catalogItems.length === 0 || isOutOfScopeForCatalog(history, deps)) {
      return null
    }

    const labels = catalogItems.map((item) => `${item.nome}: ${item.precoLabel}`)
    const joinedLabels = labels.join(" + ")
    const structured = deps.prefersStructuredReply?.(context) ?? true
    const hasWhatsAppDestination = hasConfiguredWhatsAppDestination(context)
    const singleCta = hasWhatsAppDestination
      ? runtimeConfig?.pricingCatalog?.ctaSingle ||
        "Se quiser, eu sigo com voce por aqui e ja te explico como isso entra no seu caso, ou te encaminho no WhatsApp para fecharmos mais rapido."
      : "Se quiser, eu sigo com voce por aqui e ja te explico como isso entra no seu caso."
    const multiCta = hasWhatsAppDestination
      ? runtimeConfig?.pricingCatalog?.ctaMultiple ||
        "Se quiser, eu posso te dizer qual combinacao faz mais sentido para o seu caso e te direcionar no WhatsApp para alinharmos os detalhes finais."
      : "Se quiser, eu posso te dizer qual combinacao faz mais sentido para o seu caso por aqui."

    if (catalogItems.length === 1) {
      return structured
        ? ["**Melhor encaixe inicial**", labels[0], "", singleCta].join("\n")
        : `Pelo que voce descreveu, isso encaixa em ${joinedLabels}. ${singleCta}`
    }

    return structured
      ? ["**Melhor encaixe inicial**", ...labels.map((label) => `- ${label}`), "", multiCta].join("\n")
      : `Pelo que voce descreveu, isso encaixa no nosso catalogo como ${joinedLabels}. ${multiCta}`
  }

  const product = productOrHistory
  if (!product?.nome || product?.preco == null) {
    return null
  }

  return `${product.nome} esta por R$ ${Number(product.preco).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}.`
}

export function maybeAskForLeadIdentification(context = {}, history = [], latestUserMessage = "", deps = {}) {
  const runtimeConfig = deps.runtimeConfig ?? getRuntimeConfig(context)
  const count = Number(context?.memoria?.mensagem_count ?? 0)
  const hasName = Boolean(context?.lead?.nome?.trim())
  const identified = Boolean(context?.lead?.identificado)
  const ready = Boolean(context?.qualificacao?.pronto_para_whatsapp)
  const normalized = (deps.normalizeText ?? normalizeText)(latestUserMessage)

  if (hasName || identified) {
    return null
  }

  if (!deps.isOutOfScopeForCatalog?.(history)) {
    return null
  }

  const webPrompt = runtimeConfig?.leadCapture?.promptWeb || "Antes de eu te orientar melhor, como posso te chamar?"
  const whatsappPrompt = runtimeConfig?.leadCapture?.promptWhatsApp || "Perfeito. Antes de seguir, qual e o seu nome?"
  const handoffPrompt =
    runtimeConfig?.leadCapture?.promptQualified ||
    "Consigo seguir com voce por aqui, mas para te direcionar melhor no WhatsApp me envie seu nome e telefone com DDD."

  if (count <= 2) {
    if (!deps.isGreetingOrAckMessage?.(latestUserMessage)) {
      return null
    }

    return deps.isWhatsAppChannel?.(context)
      ? whatsappPrompt
      : webPrompt
  }

  if (ready || count >= 4 || normalized.includes("orcamento") || normalized.includes("whatsapp")) {
    return handoffPrompt
  }

  return null
}

export { buildSearchTokens }
