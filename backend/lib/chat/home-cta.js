function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

const HOME_CTA_COPY = {
  whatsapp: {
    topicLabel: "WhatsApp",
    contextSummary:
      "O visitante demonstrou interesse em automacao e atendimento via WhatsApp, com foco em conectar numero, agente, fluxo inicial e handoff humano.",
    reply:
      "Sim. No WhatsApp voce pode conectar um numero ao projeto, publicar um agente e automatizar triagem, qualificacao, respostas iniciais e handoff para atendimento humano quando precisar.",
    followUpReply:
      "Se fizer sentido para voce, da para comecar no plano free e montar o primeiro projeto para validar o fluxo.",
  },
  mercado_livre: {
    topicLabel: "Mercado Livre",
    contextSummary:
      "O visitante demonstrou interesse em usar o agente com operacao e contexto comercial ligados ao Mercado Livre.",
    reply:
      "No Mercado Livre voce pode conectar a loja ao projeto e usar um agente para apoiar operacao, contexto comercial e evolucoes ligadas a catalogo, perguntas e rotinas da conta.",
    followUpReply:
      "O melhor caminho e ativar o plano free, criar o projeto e depois conectar a estrutura para validar esse fluxo no seu ambiente.",
  },
  apis: {
    topicLabel: "APIs",
    contextSummary:
      "O visitante demonstrou interesse em integrar o agente aos sistemas e APIs da operacao.",
    reply:
      "Nas APIs voce pode ligar o agente aos seus sistemas para consultar, validar ou acionar dados do seu processo sem depender de resposta manual a cada etapa.",
    followUpReply:
      "Voce pode testar isso no plano free criando o projeto e cadastrando as primeiras integracoes do agente.",
  },
  chat_widget: {
    topicLabel: "Chat widget",
    contextSummary:
      "O visitante demonstrou interesse em colocar o agente no site com captura de leads e continuidade da conversa.",
    reply:
      "No chat widget voce pode colocar o atendimento no seu site, capturar leads, responder com contexto e levar a conversa para humano ou outros canais quando fizer sentido.",
    followUpReply:
      "Se quiser validar rapido, o plano free ja serve para subir o primeiro projeto e testar esse fluxo no site.",
  },
}

export function normalizeHomeCtaKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

  if (normalized === "mercadolivre") {
    return "mercado_livre"
  }

  if (normalized === "chatwidget") {
    return "chat_widget"
  }

  return normalized
}

export function resolveHomeCtaPayload(input = {}) {
  const source = String(input.source || "").trim().toLowerCase()
  const widgetSlug = String(input.widgetSlug || "").trim()
  const channelKind = String(input.channelKind || "").trim().toLowerCase()
  const key = normalizeHomeCtaKey(input.homeCta)

  if (source !== "public_home_cta" || !widgetSlug || channelKind === "whatsapp" || !key) {
    return null
  }

  const runtimeConfig = isPlainObject(input.runtimeConfig) ? input.runtimeConfig : {}
  const configuredHomeCtas = isPlainObject(runtimeConfig.homeCtas) ? runtimeConfig.homeCtas : {}
  const configuredEntry = isPlainObject(configuredHomeCtas[key]) ? configuredHomeCtas[key] : {}
  const fallbackEntry = HOME_CTA_COPY[key]

  if (!fallbackEntry && !configuredEntry.reply) {
    return null
  }

  return {
    key,
    topicLabel: String(configuredEntry.topicLabel || fallbackEntry?.topicLabel || key).trim(),
    contextSummary: String(configuredEntry.contextSummary || fallbackEntry?.contextSummary || "").trim(),
    reply: String(configuredEntry.reply || fallbackEntry?.reply || "").trim(),
    followUpReply: String(configuredEntry.followUpReply || fallbackEntry?.followUpReply || "").trim(),
    actions: [
      {
        type: "event",
        eventName: "infrastudio-home:open-free-plan",
        label: String(configuredEntry.actionLabel || "Ativar plano free").trim(),
        icon: "sparkles",
      },
    ],
  }
}
