import {
  buildWhatsAppUnavailableInstruction,
  getConfiguredWhatsAppDestination,
  hasConfiguredWhatsAppDestination,
} from "@/lib/chat/whatsapp-availability"

function buildRuntimeConfigInstructions(context = {}) {
  const runtimeConfig = context?.agente?.runtimeConfig
  const hasWhatsAppDestination = hasConfiguredWhatsAppDestination(context)
  if (!runtimeConfig || typeof runtimeConfig !== "object") {
    return hasWhatsAppDestination ? "" : buildWhatsAppUnavailableInstruction()
  }

  const lines = []
  if (runtimeConfig?.business?.summary) {
    lines.push(`Contexto comercial: ${runtimeConfig.business.summary}`)
  }

  if (Array.isArray(runtimeConfig?.business?.services) && runtimeConfig.business.services.length) {
    lines.push("Servicos principais:")
    lines.push(...runtimeConfig.business.services.map((service) => `- ${service}`))
  }

  if (Array.isArray(runtimeConfig?.sales?.priorityRules) && runtimeConfig.sales.priorityRules.length) {
    lines.push("Prioridades de resposta:")
    lines.push(...runtimeConfig.sales.priorityRules.map((rule) => `- ${rule}`))
  }

  if (runtimeConfig?.sales?.cta && hasWhatsAppDestination) {
    lines.push(`CTA preferido: ${runtimeConfig.sales.cta}`)
  }

  if (!hasWhatsAppDestination) {
    lines.push(buildWhatsAppUnavailableInstruction())
  } else {
    const whatsappDestination = getConfiguredWhatsAppDestination(context)
    if (whatsappDestination && whatsappDestination !== "current_channel") {
      lines.push("WhatsApp cadastrado para continuidade do atendimento.")
      lines.push("Se sugerir continuar no WhatsApp, nao escreva numero, link ou contato em texto.")
      lines.push("Apenas convide de forma curta para continuar no WhatsApp quando fizer sentido.")
    }
  }

  if (runtimeConfig?.leadCapture?.policy) {
    lines.push(`Politica de lead: ${runtimeConfig.leadCapture.policy}`)
  }

  return lines.join("\n")
}

export function buildSystemPrompt(agent = {}, context = {}, structured = false) {
  const name = agent.nome || agent.name || "Assistente"
  const projetoNome = context?.projeto?.nome || context?.projetoNome
  const base = agent.promptBase || agent.prompt || agent.descricao || "Atenda com clareza, objetividade e foco no contexto do cliente."
  const runtimeContext = {
    ...context,
    agente: {
      ...(context?.agente && typeof context.agente === "object" ? context.agente : {}),
      runtimeConfig:
        context?.agente?.runtimeConfig ??
        context?.agente?.configuracoes?.runtimeConfig ??
        agent?.runtimeConfig ??
        agent?.configuracoes?.runtimeConfig ??
        null,
    },
  }
  const apiContext = Array.isArray(context?.runtimeApis) && context.runtimeApis.length
    ? [
        "Dados externos consultados agora:",
        ...context.runtimeApis.map((api) =>
          [
            `API: ${api.nome}`,
            api.descricao ? `Descricao: ${api.descricao}` : "",
            `Status: ${api.status}`,
            `Resposta: ${String(api.preview || "").slice(0, 1200)}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        "Use estes dados quando forem relevantes e diga que nao encontrou informacao se eles nao responderem a pergunta.",
      ].join("\n\n")
    : ""

  return [
    `Voce e ${name}.`,
    projetoNome ? `Projeto: ${projetoNome}.` : "",
    base,
    buildRuntimeConfigInstructions(runtimeContext),
    apiContext,
    structured ? "Responda em formato estruturado quando fizer sentido." : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildRuntimePrompt(agent, context, options = {}) {
  const runtimeContext = {
    ...context,
    agente: {
      ...(context?.agente && typeof context.agente === "object" ? context.agente : {}),
      runtimeConfig:
        context?.agente?.runtimeConfig ??
        context?.agente?.configuracoes?.runtimeConfig ??
        agent?.runtimeConfig ??
        agent?.configuracoes?.runtimeConfig ??
        null,
    },
  }

  return [
    buildRuntimeConfigInstructions(runtimeContext),
    Boolean(options.structuredResponse) ? "Prefira resposta curta, comercial e organizada." : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildLegacyAgentPrompt(agent) {
  return agent?.promptBase || agent?.prompt || ""
}

export function buildAgentAssetInstruction(assets = []) {
  return assets.length ? `Use estes assets quando forem relevantes: ${assets.map((item) => item.nome).join(", ")}.` : ""
}

export function buildAnalyticalReplyInstruction() {
  return "Seja preciso e nao invente dados."
}

export function buildChannelReplyInstruction(channelKind) {
  return channelKind === "whatsapp" ? "Use mensagens curtas e naturais para WhatsApp." : "Responda de forma clara."
}

export function buildStructuredReplyInstruction() {
  return "Organize a resposta em blocos curtos."
}

export function extractTaggedAssets(reply, assets = []) {
  return assets.filter((asset) => String(reply || "").includes(asset.nome))
}

export function formatHeuristicReply(reply) {
  return String(reply || "").trim()
}

export function prefersStructuredReply(context) {
  return Boolean(context?.ui?.structured_response)
}
