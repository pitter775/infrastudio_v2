import {
  buildWhatsAppUnavailableInstruction,
  getConfiguredWhatsAppDestination,
  hasConfiguredWhatsAppDestination,
} from "@/lib/chat/whatsapp-availability"

function agentHasEmbeddedPricingInstructions(agent = {}) {
  const source = String(agent?.promptBase || agent?.prompt || agent?.descricao || "")
  return /\br\$\s*\d/i.test(source) || /\bplanos?\b/i.test(source)
}

function buildRuntimeConfigInstructions(context = {}) {
  const runtimeConfig = context?.agente?.runtimeConfig
  const runtimeConfigMeta =
    context?.agente?.runtimeConfigMeta &&
    typeof context.agente.runtimeConfigMeta === "object" &&
    !Array.isArray(context.agente.runtimeConfigMeta)
      ? context.agente.runtimeConfigMeta
      : null
  const contactProfile =
    context?.agente?.configuracoes?.contactProfile &&
    typeof context.agente.configuracoes.contactProfile === "object" &&
    !Array.isArray(context.agente.configuracoes.contactProfile)
      ? context.agente.configuracoes.contactProfile
      : null
  const hasWhatsAppDestination = hasConfiguredWhatsAppDestination(context)
  if (!runtimeConfig || typeof runtimeConfig !== "object") {
    if (!contactProfile) {
      return hasWhatsAppDestination ? "" : buildWhatsAppUnavailableInstruction()
    }
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

  if (
    (runtimeConfigMeta?.pricingCatalogDerived === true || !agentHasEmbeddedPricingInstructions(context?.agente)) &&
    Array.isArray(runtimeConfig?.pricingCatalog?.items) &&
    runtimeConfig.pricingCatalog.items.length
  ) {
    lines.push("Catalogo de precos estruturado:")
    lines.push(
      ...runtimeConfig.pricingCatalog.items
        .slice(0, 8)
        .map((item) => `- ${item.name}: ${item.priceLabel}`)
    )
  }

  if (Array.isArray(contactProfile?.emails) && contactProfile.emails.length) {
    lines.push(`Emails de contato: ${contactProfile.emails.slice(0, 4).join(", ")}`)
  }

  if (Array.isArray(contactProfile?.phones) && contactProfile.phones.length) {
    lines.push(`Telefones de contato: ${contactProfile.phones.slice(0, 4).join(", ")}`)
  }

  if (Array.isArray(contactProfile?.whatsappLinks) && contactProfile.whatsappLinks.length) {
    lines.push(`Links de WhatsApp: ${contactProfile.whatsappLinks.slice(0, 2).join(", ")}`)
  }

  if (Array.isArray(contactProfile?.addresses) && contactProfile.addresses.length) {
    lines.push("Enderecos informados:")
    lines.push(...contactProfile.addresses.slice(0, 3).map((item) => `- ${item}`))
  }

  return lines.join("\n")
}

function buildHomeCtaInstructions(context = {}) {
  const homeCta = context?.ui?.homeCta
  const homeCtaTopic = context?.ui?.homeCtaTopic
  const homeCtaSummary = context?.ui?.homeCtaSummary

  if (!homeCta && !homeCtaSummary) {
    return ""
  }

  const lines = ["Contexto de entrada da home:"]

  if (homeCtaTopic) {
    lines.push(`- Tema inicial de interesse: ${homeCtaTopic}`)
  } else if (homeCta) {
    lines.push(`- Tema inicial de interesse: ${homeCta}`)
  }

  if (homeCtaSummary) {
    lines.push(`- Resumo do interesse inicial: ${homeCtaSummary}`)
  }

  lines.push("- Continue a conversa priorizando esse tema ate o cliente mudar claramente de assunto.")
  lines.push("- Se o cliente aprofundar a conversa, responda ja assumindo esse contexto inicial, sem recomecar do zero.")

  return lines.join("\n")
}

function buildResponseGuardrailInstructions() {
  return [
    "Regras de resposta:",
    "- Responda primeiro a pergunta principal do cliente.",
    "- Para perguntas comerciais simples, responda em ate 4 frases curtas.",
    "- Nao liste varios planos, varias opcoes ou muito contexto sem o cliente pedir comparacao.",
    "- Quando houver um melhor encaixe inicial, indique primeiro essa opcao e so depois cite alternativa.",
    "- Nunca despeje campo cru, JSON, rotulo tecnico ou lista de atributos sem interpretar.",
    "- Quando a pergunta for factual, responda com o fato mais relevante primeiro e complemente so com contexto util.",
    "- Quando houver mais de um dado importante, organize em blocos curtos ou lista curta.",
    "- Nao repita a mesma informacao com palavras diferentes na mesma resposta.",
    "- Quando houver produto em foco, use so os dados necessarios para responder a pergunta atual.",
    "- Se o cliente citar um produto ou categoria, traga opcoes/conteudo disponivel antes de pedir mais especificacao.",
    "- Se a informacao pedida nao estiver disponivel, diga isso claramente em vez de improvisar.",
    "- Nao invente valor, prazo, disponibilidade, status, documento ou detalhe tecnico.",
  ].join("\n")
}

function hasMercadoLivreConnection(context = {}) {
  const directConnections = context?.projeto?.directConnections ?? context?.directConnections
  return Number(directConnections?.mercadoLivre ?? 0) > 0
}

function getCatalogCurrentProductName(context = {}) {
  const currentProductName = String(context?.catalogo?.produtoAtual?.nome || "").trim()
  if (currentProductName) {
    return currentProductName
  }

  const focusedProductId = String(context?.catalogo?.productFocus?.productId || "").trim()
  if (!focusedProductId) {
    return ""
  }

  const recentProducts = Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos : []
  return String(recentProducts.find((item) => String(item?.id || "").trim() === focusedProductId)?.nome || "").trim()
}

function hasCatalogListingSession(context = {}) {
  return Boolean(String(context?.catalogo?.listingSession?.searchTerm || "").trim())
}

function hasMercadoLivreCatalogContext(context = {}) {
  return Boolean(
    hasMercadoLivreConnection(context) &&
      (context?.catalogo?.productFocus ||
        context?.catalogo?.produtoAtual ||
        hasCatalogListingSession(context) ||
        (Array.isArray(context?.catalogo?.ultimosProdutos) && context.catalogo.ultimosProdutos.length > 0))
  )
}

function buildMercadoLivreSalesTechniqueInstructions(context = {}) {
  if (!hasMercadoLivreCatalogContext(context)) {
    return ""
  }

  const lockedProductDetailContext = Boolean(
    getCatalogCurrentProductName(context) &&
      (String(context?.conversation?.mode || "").trim().toLowerCase() === "product_detail" ||
        context?.ui?.productDetailPreferred === true ||
        context?.storefront?.pageKind === "product_detail")
  )

  return [
    "Tecnica de vendas para produto do Mercado Livre:",
    "- Atue como vendedor consultivo, nao como catalogo neutro.",
    "- Quando o cliente sinalizar preferencia por um item, avance a venda com seguranca.",
    "- Destaque o produto escolhido, preco, disponibilidade e proximo passo de compra quando isso estiver no contexto.",
    "- Use no maximo 1 ou 2 argumentos concretos por resposta. Nao despeje ficha tecnica sem necessidade.",
    "- Mantenha os detalhes completos do produto em memoria para responder qualquer pergunta especifica sobre ele.",
    "- So revele atributo, medida, material, garantia, frete, estoque, descricao ou variacao quando a pergunta do cliente pedir isso direta ou indiretamente.",
    "- Se o cliente fizer pergunta curta como 'tem garantia?', 'qual material?', 'serve?', responda objetivamente com base no produto em foco.",
    lockedProductDetailContext
      ? `- Contexto travado: o cliente esta na pagina de detalhe do produto ${getCatalogCurrentProductName(context)}. Considere este item como produto em foco por padrao.`
      : "",
    lockedProductDetailContext
      ? "- Nunca diga que nao conseguiu identificar o produto e nunca peca para o cliente informar qual item esta vendo, a menos que ele peça explicitamente outra opcao."
      : "",
    "- Evite repetir so o titulo do produto. Sempre acrescente valor comercial.",
    "- Feche com CTA curto: link, comparacao rapida ou confirmacao do interesse.",
  ].join("\n")
}

function hasStructuredAgentData(runtimeContext = {}) {
  const runtimeConfig = runtimeContext?.agente?.runtimeConfig
  const contactProfile = runtimeContext?.agente?.configuracoes?.contactProfile
  const hasPricing = Array.isArray(runtimeConfig?.pricingCatalog?.items) && runtimeConfig.pricingCatalog.items.length > 0
  const hasBusiness = Boolean(runtimeConfig?.business?.summary) || (Array.isArray(runtimeConfig?.business?.services) && runtimeConfig.business.services.length > 0)
  const hasLeadCapture = Boolean(runtimeConfig?.leadCapture?.policy)
  const hasContacts =
    Array.isArray(contactProfile?.emails) ||
    Array.isArray(contactProfile?.phones) ||
    Array.isArray(contactProfile?.whatsappLinks) ||
    Array.isArray(contactProfile?.addresses)

  return Boolean(hasPricing || hasBusiness || hasLeadCapture || hasContacts)
}

function buildCompactAgentBaseInstruction(agent = {}, runtimeContext = {}) {
  const rawBase = agent.promptBase || agent.prompt || agent.descricao || ""
  const normalizedBase = String(rawBase || "").trim()
  if (!normalizedBase) {
    return "Base do agente: atenda com clareza, objetividade e foco no contexto do cliente."
  }

  if (!hasStructuredAgentData(runtimeContext)) {
    return normalizedBase
  }

  const lines = normalizedBase
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const compact = []
  for (const line of lines) {
    compact.push(line)
    if (compact.join(" ").length >= 1400) {
      break
    }
  }

  return compact.join("\n")
}

export function buildSystemPrompt(agent = {}, context = {}, structured = false) {
  const name = agent.nome || agent.name || "Assistente"
  const projetoNome = context?.projeto?.nome || context?.projetoNome
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
  const base = buildCompactAgentBaseInstruction(agent, runtimeContext)
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
    buildMercadoLivreSalesTechniqueInstructions(runtimeContext),
    buildRuntimeConfigInstructions(runtimeContext),
    buildHomeCtaInstructions(runtimeContext),
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
    buildMercadoLivreSalesTechniqueInstructions(runtimeContext),
    buildHomeCtaInstructions(runtimeContext),
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
    : "Responda de forma clara. Priorize leitura rapida, resposta direta e poucos paragrafos."
}

export function buildStructuredReplyInstruction() {
  return [
    "Quando fizer sentido, responda em JSON valido.",
    'Use o formato: {"reply":"texto curto","followUpReply":"","ui":{"blocks":[{"type":"text","variant":"title","text":"titulo discreto"},{"type":"badges","items":["tag 1","tag 2"]},{"type":"list","items":["item 1","item 2"]},{"type":"actions","items":[{"label":"Continuar","type":"message","message":"Quero continuar"}]}]}}.',
    "Se nao precisar de bloco visual, ainda assim mantenha reply curto e organizado.",
    "Nao use markdown, nao use crase e nao devolva texto antes ou depois do JSON.",
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
