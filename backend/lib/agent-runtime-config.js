function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))]
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item == null) return false
      if (Array.isArray(item)) return item.length > 0
      if (typeof item === "object") return Object.keys(item).length > 0
      return true
    })
  )
}

function normalizePricingCatalogItems(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!isPlainObject(item)) {
        return null
      }

      return compactObject({
        slug: normalizeString(item.slug),
        name: normalizeString(item.name),
        matchAny: normalizeStringArray(item.matchAny),
        priceLabel: normalizeString(item.priceLabel),
        attendanceLimit: typeof item.attendanceLimit === "number" ? item.attendanceLimit : null,
        agentLimit: typeof item.agentLimit === "number" ? item.agentLimit : null,
        creditLimit: typeof item.creditLimit === "number" ? item.creditLimit : null,
        whatsappIncluded: typeof item.whatsappIncluded === "boolean" ? item.whatsappIncluded : null,
        supportLevel: normalizeString(item.supportLevel),
        features: normalizeStringArray(item.features),
        channels: normalizeStringArray(item.channels),
      })
    })
    .filter((item) => item && Object.keys(item).length > 0)
}

export function normalizeAgentRuntimeConfig(input) {
  if (!isPlainObject(input)) {
    return null
  }

  const normalized = compactObject({
    business: compactObject({
      summary: normalizeString(input.business?.summary),
      services: normalizeStringArray(input.business?.services),
    }),
    sales: compactObject({
      priorityRules: normalizeStringArray(input.sales?.priorityRules),
      cta: normalizeString(input.sales?.cta),
    }),
    leadCapture: compactObject({
      policy: normalizeString(input.leadCapture?.policy),
      deferOnQuestions: typeof input.leadCapture?.deferOnQuestions === "boolean" ? input.leadCapture.deferOnQuestions : null,
      respectCatalogBoundary:
        typeof input.leadCapture?.respectCatalogBoundary === "boolean" ? input.leadCapture.respectCatalogBoundary : null,
      promptWeb: normalizeString(input.leadCapture?.promptWeb),
      promptWhatsApp: normalizeString(input.leadCapture?.promptWhatsApp),
      promptQualified: normalizeString(input.leadCapture?.promptQualified),
    }),
    pricingCatalog: compactObject({
      enabled: typeof input.pricingCatalog?.enabled === "boolean" ? input.pricingCatalog.enabled : null,
      ctaSingle: normalizeString(input.pricingCatalog?.ctaSingle),
      ctaMultiple: normalizeString(input.pricingCatalog?.ctaMultiple),
      items: normalizePricingCatalogItems(input.pricingCatalog?.items),
    }),
  })

  return Object.keys(normalized).length ? normalized : null
}

export function buildAgentRuntimeConfigTemplate() {
  return {
    business: {
      summary: "Resumo curto do negocio e do perfil de atendimento.",
      services: ["Servico 1", "Servico 2"],
    },
    sales: {
      priorityRules: ["Responda a pergunta principal antes de qualificar.", "Nao invente dados factuais."],
      cta: "Se fizer sentido, convide o cliente para continuar no WhatsApp.",
    },
    leadCapture: {
      policy: "Qualifique sem pedir nome cedo demais.",
      deferOnQuestions: true,
      respectCatalogBoundary: true,
      promptWeb: "Antes de eu te orientar melhor, como posso te chamar?",
      promptWhatsApp: "Perfeito. Antes de seguir, qual e o seu nome?",
      promptQualified: "Se quiser continuar no WhatsApp com contexto, me envie seu nome e telefone com DDD.",
    },
    pricingCatalog: {
      enabled: false,
      ctaSingle: "Se quiser, eu sigo com voce por aqui e detalho o melhor encaixe.",
      ctaMultiple: "Se quiser, eu comparo as opcoes e te digo qual faz mais sentido.",
      items: [
        {
          slug: "servico-principal",
          name: "Servico principal",
          matchAny: ["site", "landing page"],
          priceLabel: "R$ 300 a R$ 1.000",
          attendanceLimit: 100,
          agentLimit: 1,
          creditLimit: 200000,
          whatsappIncluded: true,
          supportLevel: "padrao",
          features: ["recurso 1", "recurso 2"],
          channels: ["web", "whatsapp"],
        },
      ],
    },
  }
}
