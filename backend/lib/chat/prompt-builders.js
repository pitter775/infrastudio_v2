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
      lines.push(`WhatsApp de continuidade: ${whatsappDestination}`)
      lines.push("WhatsApp cadastrado para continuidade do atendimento.")
      lines.push("Nunca use placeholder de WhatsApp. Use somente o numero configurado quando isso for necessario em contexto interno.")
      lines.push("Se sugerir continuar no WhatsApp, nao escreva numero, link ou contato em texto.")
      lines.push("Apenas convide de forma curta para continuar no WhatsApp quando fizer sentido.")
    }
  }

  if (runtimeConfig?.leadCapture?.policy) {
    lines.push(`Politica de lead: ${runtimeConfig.leadCapture.policy}`)
  }

  return lines.join("\n")
}

function buildResponseGuardrailInstructions() {
  return [
    "Regras de resposta:",
    "- Responda primeiro a pergunta principal do cliente.",
    "- Nunca despeje campo cru, JSON, rotulo tecnico ou lista de atributos sem interpretar.",
    "- Quando a pergunta for factual, responda com o fato mais relevante primeiro e complemente so com contexto util.",
    "- Quando houver mais de um dado importante, organize em blocos curtos ou lista curta.",
    "- Se a informacao pedida nao estiver disponivel, diga isso claramente em vez de improvisar.",
    "- Nao invente valor, prazo, disponibilidade, status, documento ou detalhe tecnico.",
  ].join("\n")
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
  const agendaContext = Array.isArray(context?.agenda?.horariosDisponiveis) && context.agenda.horariosDisponiveis.length
    ? [
        "Agenda disponivel:",
        ...context.agenda.horariosDisponiveis.slice(0, 12).map((slot) =>
          [
            `Horario: ${slot.titulo || slot.id}`,
            `Data: ${slot.data || slot.dia}`,
            `Janela: ${slot.horaInicio} ate ${slot.horaFim}`,
            `Timezone: ${slot.timezone || "America/Sao_Paulo"}`,
            `ID: ${slot.id}`,
          ].join(" | ")
        ),
        "Antes de confirmar uma reserva, colete email ou celular do cliente.",
        "Se o cliente aceitar agendar, conduza a coleta do melhor horario e do contato.",
        "Antes de concluir, mostre os dados formatados para aprovacao explicita do cliente.",
        "Depois da aprovacao, confirme o agendamento e continue o atendimento normalmente.",
      ].join("\n")
    : ""

  return [
    `Voce e ${name}.`,
    projetoNome ? `Projeto: ${projetoNome}.` : "",
    base,
    buildResponseGuardrailInstructions(),
    buildRuntimeConfigInstructions(runtimeContext),
    apiContext,
    agendaContext,
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
    "Se a pergunta pedir valor, prazo, status, descricao, risco, disponibilidade ou documento, responda isso primeiro.",
    "Se houver dados factuais no contexto, transforme esses dados em resposta util para o cliente.",
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
  return [
    "Seja preciso e nao invente dados.",
    "Em perguntas analiticas, entregue conclusao, motivos e proximo passo.",
    "Em perguntas objetivas, nao transforme tudo em analise longa.",
  ].join("\n")
}

export function buildChannelReplyInstruction(channelKind) {
  return channelKind === "whatsapp"
    ? "Use mensagens curtas e naturais para WhatsApp. Uma ideia por bloco. Evite resposta longa e robotica."
    : "Responda de forma clara. Priorize leitura rapida e resposta direta."
}

export function buildStructuredReplyInstruction() {
  return [
    "Organize a resposta em blocos curtos.",
    "Quando fizer sentido, use listas curtas ou rotulos simples como Resposta, Motivos e Proximo passo.",
  ].join("\n")
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
