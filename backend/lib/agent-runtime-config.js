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
        marketplaceProductLimit:
          typeof item.marketplaceProductLimit === "number" || item.marketplaceProductLimit === "unlimited"
            ? item.marketplaceProductLimit
            : null,
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
    integrations: compactObject({
      googleAgenda:
        input.integrations?.googleAgenda && typeof input.integrations.googleAgenda === "object"
          ? compactObject({
              enabled: typeof input.integrations.googleAgenda.enabled === "boolean" ? input.integrations.googleAgenda.enabled : null,
              requiresConnection:
                typeof input.integrations.googleAgenda.requiresConnection === "boolean"
                  ? input.integrations.googleAgenda.requiresConnection
                  : null,
              canCheckAvailability:
                typeof input.integrations.googleAgenda.canCheckAvailability === "boolean"
                  ? input.integrations.googleAgenda.canCheckAvailability
                  : null,
              canCreateEvents:
                typeof input.integrations.googleAgenda.canCreateEvents === "boolean"
                  ? input.integrations.googleAgenda.canCreateEvents
                  : null,
              canRescheduleEvents:
                typeof input.integrations.googleAgenda.canRescheduleEvents === "boolean"
                  ? input.integrations.googleAgenda.canRescheduleEvents
                  : null,
              canCancelEvents:
                typeof input.integrations.googleAgenda.canCancelEvents === "boolean"
                  ? input.integrations.googleAgenda.canCancelEvents
                  : null,
              requiredFields: normalizeStringArray(input.integrations.googleAgenda.requiredFields),
              fallbackWhenDisconnected: normalizeString(input.integrations.googleAgenda.fallbackWhenDisconnected),
            })
          : null,
      apis:
        input.integrations?.apis && typeof input.integrations.apis === "object"
          ? compactObject({
              enabled: typeof input.integrations.apis.enabled === "boolean" ? input.integrations.apis.enabled : null,
              purpose: normalizeString(input.integrations.apis.purpose),
              expectedContent: normalizeStringArray(input.integrations.apis.expectedContent),
              runtimePolicy: normalizeString(input.integrations.apis.runtimePolicy),
              endpoints: Array.isArray(input.integrations.apis.endpoints)
                ? input.integrations.apis.endpoints
                    .map((item) =>
                      compactObject({
                        url: normalizeString(item?.url),
                        method: normalizeString(item?.method),
                        description: normalizeString(item?.description),
                        expectedContent: normalizeStringArray(item?.expectedContent),
                      })
                    )
                    .filter((item) => Object.keys(item).length > 0)
                    .slice(0, 8)
                : [],
            })
          : null,
    }),
  })

  return Object.keys(normalized).length ? normalized : null
}

export function buildAgentRuntimeConfigTemplate() {
  return {
    business: {
      summary: "Resumo curto do negócio e do perfil de atendimento.",
      services: ["Serviço 1", "Serviço 2"],
    },
    sales: {
      priorityRules: ["Responda a pergunta principal antes de qualificar.", "Não invente dados factuais."],
      cta: "Se fizer sentido, convide o cliente para continuar no WhatsApp.",
    },
    leadCapture: {
      policy: "Qualifique sem pedir nome cedo demais.",
      deferOnQuestions: true,
      respectCatalogBoundary: true,
      promptWeb: "Antes de eu te orientar melhor, como posso te chamar?",
      promptWhatsApp: "Perfeito. Antes de seguir, qual é o seu nome?",
      promptQualified: "Se quiser continuar no WhatsApp com contexto, me envie seu nome e telefone com DDD.",
    },
    pricingCatalog: {
      enabled: false,
      ctaSingle: "Se quiser, eu sigo com você por aqui e detalho o melhor encaixe.",
      ctaMultiple: "Se quiser, eu comparo as opções e te digo qual faz mais sentido.",
      items: [
        {
          slug: "servico-principal",
          name: "Serviço principal",
          matchAny: ["site", "landing page"],
          priceLabel: "R$ 300 a R$ 1.000",
          attendanceLimit: 100,
          agentLimit: 1,
          creditLimit: 200000,
          marketplaceProductLimit: 50,
          whatsappIncluded: true,
          supportLevel: "padrao",
          features: ["recurso 1", "recurso 2"],
          channels: ["web", "whatsapp"],
        },
      ],
    },
    integrations: {
      googleAgenda: {
        enabled: false,
        requiresConnection: true,
        canCheckAvailability: true,
        canCreateEvents: true,
        canRescheduleEvents: true,
        canCancelEvents: true,
        requiredFields: ["nome", "contato", "data", "horario", "servico"],
        fallbackWhenDisconnected: "Conecte o Google Agenda no painel do projeto para confirmar horarios.",
      },
      apis: {
        enabled: false,
        purpose: "Consultar dados externos quando o cliente pedir informacao que depende de outro sistema.",
        expectedContent: ["produtos", "pedidos", "status", "precos"],
        runtimePolicy: "Use APIs cadastradas e vinculadas ao agente. Nao invente dados que deveriam vir da API.",
        endpoints: [],
      },
    },
  }
}
