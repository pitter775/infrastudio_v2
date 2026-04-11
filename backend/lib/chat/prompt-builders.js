export function buildSystemPrompt(agent = {}, context = {}, structured = false) {
  const name = agent.nome || agent.name || "Assistente"
  const projetoNome = context?.projeto?.nome || context?.projetoNome
  const base = agent.promptBase || agent.prompt || agent.descricao || "Atenda com clareza, objetividade e foco no contexto do cliente."
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
    apiContext,
    structured ? "Responda em formato estruturado quando fizer sentido." : "",
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildRuntimePrompt(agent, context, options = {}) {
  return buildSystemPrompt(agent, context, Boolean(options.structuredResponse))
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
