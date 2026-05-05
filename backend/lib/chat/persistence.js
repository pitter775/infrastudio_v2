import { appendMessage, listChatRuntimeMessages, updateChatContext, updateChatStats } from "@/lib/chats"

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeUiPayload(value) {
  return isPlainObject(value) && Array.isArray(value.blocks) ? value : null
}

function sanitizeOptionalString(value) {
  const normalized = String(value || "").trim()
  return normalized || null
}

function compactCatalogProduct(value) {
  if (!isPlainObject(value)) {
    return null
  }

  const id = sanitizeOptionalString(value.id ?? value.productId)
  const nome = sanitizeOptionalString(value.nome ?? value.name ?? value.title)
  const preco = value.preco ?? value.price ?? value.priceValue ?? null
  const link = sanitizeOptionalString(value.link ?? value.permalink ?? value.url)

  if (!id && !nome && preco == null && !link) {
    return null
  }

  return {
    ...(id ? { id } : {}),
    ...(nome ? { nome } : {}),
    ...(preco != null ? { preco } : {}),
    ...(link ? { link } : {}),
  }
}

function compactBillingDiagnostics(value) {
  if (!isPlainObject(value)) {
    return null
  }

  return {
    billingIntent: value.billingIntent ?? null,
    targetPlan: value.targetPlan ?? null,
    targetField: value.targetField ?? null,
    targetFields: Array.isArray(value.targetFields) ? value.targetFields.slice(0, 6) : [],
    fieldFound: value.fieldFound ?? null,
    replyStrategy: value.replyStrategy ?? null,
  }
}

function compactBillingContextUpdate(value) {
  if (!isPlainObject(value)) {
    return null
  }

  return {
    planFocus: isPlainObject(value.planFocus)
      ? {
          slug: value.planFocus.slug ?? null,
          name: value.planFocus.name ?? null,
        }
      : null,
    comparisonFocus: isPlainObject(value.comparisonFocus)
      ? {
          plans: Array.isArray(value.comparisonFocus.plans)
            ? value.comparisonFocus.plans.slice(0, 4).map((item) => ({
                slug: item?.slug ?? null,
                name: item?.name ?? null,
              }))
            : [],
          fields: Array.isArray(value.comparisonFocus.fields) ? value.comparisonFocus.fields.slice(0, 6) : [],
        }
      : null,
    lastIntent: value.lastIntent ?? null,
    lastField: value.lastField ?? null,
    lastFields: Array.isArray(value.lastFields) ? value.lastFields.slice(0, 6) : [],
  }
}

function compactSemanticIntent(value) {
  if (!isPlainObject(value)) {
    return null
  }

  return {
    intent: value.intent ?? value.kind ?? null,
    confidence: value.confidence ?? null,
    targetField: value.targetField ?? null,
    targetFields: Array.isArray(value.targetFields) ? value.targetFields.slice(0, 6) : [],
    requestedPlanNames: Array.isArray(value.requestedPlanNames) ? value.requestedPlanNames.slice(0, 6) : [],
  }
}

function compactString(value, max = 0) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return null
  }

  return max > 0 ? normalized.slice(0, max) : normalized
}

function compactNumber(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function compactStringArray(values = [], limit = 0, itemMax = 0) {
  const list = (Array.isArray(values) ? values : [])
    .map((item) => compactString(item, itemMax))
    .filter(Boolean)
  return limit > 0 ? list.slice(0, limit) : list
}

function compactCatalogAttributes(values = [], limit = 0) {
  return (Array.isArray(values) ? values : [])
    .map((attribute) =>
      isPlainObject(attribute)
        ? {
            ...(compactString(attribute.id, 80) ? { id: compactString(attribute.id, 80) } : {}),
            ...(compactString(attribute.nome ?? attribute.name, 80) ? { nome: compactString(attribute.nome ?? attribute.name, 80) } : {}),
            ...(compactString(attribute.valor ?? attribute.valueName ?? attribute.value, 160)
              ? { valor: compactString(attribute.valor ?? attribute.valueName ?? attribute.value, 160) }
              : {}),
          }
        : null
    )
    .filter((attribute) => attribute?.nome && attribute?.valor)
    .slice(0, limit)
}

function compactCatalogFacts(value) {
  if (!isPlainObject(value)) {
    return null
  }

  return {
    price: value.price ?? null,
    material: compactString(value.material, 160),
    color: compactString(value.color, 120),
    warranty: compactString(value.warranty, 180),
    stock: value.stock ?? null,
    shipping: compactString(value.shipping, 180),
    link: compactString(value.link, 500),
    dimensions: isPlainObject(value.dimensions) ? value.dimensions : null,
    details: compactStringArray(value.details, 8, 180),
  }
}

function compactCatalogProductForContext(value, options = {}) {
  if (!isPlainObject(value)) {
    return null
  }

  const focused = options.focused === true
  const id = compactString(value.id, 100)
  const nome = compactString(value.nome ?? value.name ?? value.title, 180)
  if (!id && !nome) {
    return null
  }

  return {
    ...(id ? { id } : {}),
    ...(compactString(value.slug, 180) ? { slug: compactString(value.slug, 180) } : {}),
    ...(nome ? { nome } : {}),
    ...(compactString(value.categoriaLabel, 120) ? { categoriaLabel: compactString(value.categoriaLabel, 120) } : {}),
    ...(compactString(value.descricao, focused ? 360 : 180) ? { descricao: compactString(value.descricao, focused ? 360 : 180) } : {}),
    ...(value.preco != null ? { preco: compactNumber(value.preco, null) } : {}),
    ...(compactString(value.link, 500) ? { link: compactString(value.link, 500) } : {}),
    ...(compactString(value.imagem, 500) ? { imagem: compactString(value.imagem, 500) } : {}),
    ...(focused ? { imagens: compactStringArray(value.imagens, 3, 500) } : {}),
    ...(compactString(value.sellerId, 100) ? { sellerId: compactString(value.sellerId, 100) } : {}),
    ...(compactString(value.sellerName, 160) ? { sellerName: compactString(value.sellerName, 160) } : {}),
    ...(value.availableQuantity != null ? { availableQuantity: compactNumber(value.availableQuantity, 0) } : {}),
    ...(compactString(value.status, 40) ? { status: compactString(value.status, 40) } : {}),
    ...(compactString(value.condition, 80) ? { condition: compactString(value.condition, 80) } : {}),
    ...(compactString(value.warranty, 180) ? { warranty: compactString(value.warranty, 180) } : {}),
    ...(value.freeShipping === true ? { freeShipping: true } : {}),
    ...(compactString(value.material, 160) ? { material: compactString(value.material, 160) } : {}),
    ...(compactString(value.cor, 120) ? { cor: compactString(value.cor, 120) } : {}),
    ...(focused ? { atributos: compactCatalogAttributes(value.atributos, 12) } : {}),
    ...(focused && compactString(value.descricaoLonga, 700) ? { descricaoLonga: compactString(value.descricaoLonga, 700) } : {}),
    ...(focused ? { variacoesResumo: compactStringArray(value.variacoesResumo, 6, 140) } : {}),
    ...(focused && compactCatalogFacts(value.facts) ? { facts: compactCatalogFacts(value.facts) } : {}),
    ...(focused && value.contextoDetalhado === true ? { contextoDetalhado: true } : {}),
    ...(focused && value.contextoCompleto === true ? { contextoCompleto: true } : {}),
  }
}

function compactCatalogContext(value) {
  if (!isPlainObject(value)) {
    return {}
  }

  const produtoAtual = compactCatalogProductForContext(value.produtoAtual, { focused: true })
  const ultimosProdutos = (Array.isArray(value.ultimosProdutos) ? value.ultimosProdutos : [])
    .map((product) =>
      compactCatalogProductForContext(product, {
        focused: produtoAtual?.id && String(product?.id || "") === String(produtoAtual.id),
      })
    )
    .filter(Boolean)
    .slice(0, 10)

  return {
    ...(compactString(value.ultimaBusca, 160) ? { ultimaBusca: compactString(value.ultimaBusca, 160) } : {}),
    ...(produtoAtual ? { produtoAtual } : {}),
    ...(ultimosProdutos.length ? { ultimosProdutos } : {}),
    ...(compactString(value.focusMode, 40) ? { focusMode: compactString(value.focusMode, 40) } : {}),
    ...(compactString(value.catalogState, 60) ? { catalogState: compactString(value.catalogState, 60) } : {}),
    ...(compactString(value.selectedItemId, 100) ? { selectedItemId: compactString(value.selectedItemId, 100) } : {}),
    ...(compactString(value.snapshotId, 160) ? { snapshotId: compactString(value.snapshotId, 160) } : {}),
    ...(compactString(value.snapshotCreatedAt, 40) ? { snapshotCreatedAt: compactString(value.snapshotCreatedAt, 40) } : {}),
    ...(value.snapshotTurnId != null ? { snapshotTurnId: compactNumber(value.snapshotTurnId, 0) } : {}),
    ...(value.paginationOffset != null ? { paginationOffset: compactNumber(value.paginationOffset, 0) } : {}),
    ...(value.paginationNextOffset != null ? { paginationNextOffset: compactNumber(value.paginationNextOffset, 0) } : {}),
    ...(value.paginationPoolLimit != null ? { paginationPoolLimit: compactNumber(value.paginationPoolLimit, 24) } : {}),
    ...(value.paginationHasMore === true ? { paginationHasMore: true } : {}),
    ...(value.paginationTotal != null ? { paginationTotal: compactNumber(value.paginationTotal, 0) } : {}),
    ...(isPlainObject(value.listingSession)
      ? {
          listingSession: {
            id: compactString(value.listingSession.id, 160),
            snapshotId: compactString(value.listingSession.snapshotId, 160),
            searchTerm: compactString(value.listingSession.searchTerm, 160),
            matchedProductIds: compactStringArray(value.listingSession.matchedProductIds, 30, 100),
            offset: compactNumber(value.listingSession.offset, 0),
            nextOffset: compactNumber(value.listingSession.nextOffset, 0),
            poolLimit: compactNumber(value.listingSession.poolLimit, 24),
            hasMore: value.listingSession.hasMore === true,
            total: compactNumber(value.listingSession.total, 0),
            source: compactString(value.listingSession.source, 60) || "storefront_snapshot",
          },
        }
      : {}),
    ...(isPlainObject(value.productFocus)
      ? {
          productFocus: {
            productId: compactString(value.productFocus.productId, 100),
            sourceListingSessionId: compactString(value.productFocus.sourceListingSessionId, 160),
            detailLevel: compactString(value.productFocus.detailLevel, 40) || "focused",
            factualContext: isPlainObject(value.productFocus.factualContext)
              ? {
                  fields: compactStringArray(value.productFocus.factualContext.fields, 8, 60),
                  scope: compactString(value.productFocus.factualContext.scope, 40),
                  productId: compactString(value.productFocus.factualContext.productId, 100),
                  source: compactString(value.productFocus.factualContext.source, 80),
                  updatedAt: compactString(value.productFocus.factualContext.updatedAt, 40),
                }
              : null,
          },
        }
      : {}),
  }
}

export function compactChatContextForPersistence(context) {
  if (!isPlainObject(context)) {
    return {}
  }

  return {
    ...context,
    ...(isPlainObject(context.catalogo) ? { catalogo: compactCatalogContext(context.catalogo) } : {}),
  }
}

function compactAiMetadata(metadata) {
  if (!isPlainObject(metadata)) {
    return {}
  }

  return {
    provider: metadata.provider ?? null,
    model: metadata.model ?? null,
    agenteId: metadata.agenteId ?? null,
    agenteNome: metadata.agenteNome ?? null,
    routeStage: metadata.routeStage ?? null,
    heuristicStage: metadata.heuristicStage ?? null,
    domainStage: metadata.domainStage ?? null,
    catalogoProdutoAtual: compactCatalogProduct(metadata.catalogoProdutoAtual),
    semanticIntent: compactSemanticIntent(metadata.semanticIntent),
    billingDiagnostics: compactBillingDiagnostics(metadata.billingDiagnostics),
    billingContextUpdate: compactBillingContextUpdate(metadata.billingContextUpdate),
    catalogFactContext: isPlainObject(metadata.catalogFactContext) ? metadata.catalogFactContext : null,
  }
}

export function buildUserMessageMetadata(input) {
  return {
    source: input.source?.trim() || (input.channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget"),
    ...(Array.isArray(input.attachments) && input.attachments.length ? { attachments: input.attachments } : {}),
  }
}

export function buildAssistantMessageMetadata(input) {
  return {
    ...compactAiMetadata(input.aiMetadata),
    ...(input.usageTelemetry ? { usageTelemetry: input.usageTelemetry } : {}),
    assets: Array.isArray(input.assets) ? input.assets : [],
    whatsappCta: isPlainObject(input.whatsapp) ? input.whatsapp : null,
    actions: Array.isArray(input.actions) ? input.actions : [],
    ui: normalizeUiPayload(input.ui),
    ...(input.followUpReply ? { followUpReply: true } : {}),
  }
}

export async function persistUserTurn(input, deps = {}) {
  const appendChatMessage = deps.appendMessage ?? appendMessage
  const userMessage = await appendChatMessage({
    chatId: input.chatId,
    role: "user",
    conteudo: input.message || "Mídia recebida pelo WhatsApp.",
    canal: input.channelKind,
    identificadorExterno: input.normalizedExternalIdentifier,
    metadata: buildUserMessageMetadata({
      source: input.source,
      channelKind: input.channelKind,
      attachments: input.attachments,
    }),
  })

  if (!userMessage) {
    throw new Error("Não foi possível gravar a mensagem do cliente. Verifique permissões na tabela `mensagens`.")
  }

  return userMessage
}

export async function loadChatHistory(chatId, deps = {}) {
  const listMessages = deps.listChatMessages ?? deps.listChatRuntimeMessages ?? listChatRuntimeMessages
  const limit = Math.min(Math.max(Number(deps.historyLimit ?? 28) || 28, 6), 60)
  const messages = await listMessages(chatId, { limit, ascending: false })
  return messages.every((message) => message?.createdAt)
    ? [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    : messages
}

export async function persistAssistantTurn(input, deps = {}) {
  const appendChatMessage = deps.appendMessage ?? appendMessage
  const assistantMessage = await appendChatMessage({
    chatId: input.chatId,
    role: "assistant",
    conteudo: input.content,
    canal: input.channelKind,
    identificadorExterno: input.normalizedExternalIdentifier,
    tokensInput: input.tokensInput ?? null,
    tokensOutput: input.tokensOutput ?? null,
    custo: input.custo ?? null,
    metadata: buildAssistantMessageMetadata({
      aiMetadata: input.aiMetadata,
      usageTelemetry: input.usageTelemetry,
      assets: input.assets,
      whatsapp: input.whatsapp,
      actions: input.actions,
      ui: input.ui,
      followUpReply: input.followUpReply,
    }),
  })

  if (!assistantMessage) {
    throw new Error("O modelo respondeu, mas não foi possível salvar a resposta no banco.")
  }

  return assistantMessage
}

export async function persistAssistantState(input, deps = {}) {
  const saveChatContext = deps.updateChatContext ?? updateChatContext
  const saveChatStats = deps.updateChatStats ?? updateChatStats

  await saveChatContext(input.chatId, compactChatContextForPersistence(input.nextContext))
  await saveChatStats({
    chatId: input.chatId,
    totalTokensToAdd: Number(input.totalTokensToAdd ?? 0),
    totalCustoToAdd: Number(input.totalCustoToAdd ?? 0),
    titulo: input.titulo ?? null,
    contexto: input.nextContext,
    identificadorExterno: input.normalizedExternalIdentifier ?? null,
    contatoNome: input.contactSnapshot?.contatoNome ?? null,
    contatoTelefone: input.contactSnapshot?.contatoTelefone ?? null,
    contatoAvatarUrl: input.contactSnapshot?.contatoAvatarUrl ?? null,
  })
}
