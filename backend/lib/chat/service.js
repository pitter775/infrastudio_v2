import { getAgenteAtivo, getAgenteById, getAgenteByIdentifier } from "@/lib/agentes"
import { listPublicAgendaAvailability } from "@/lib/agenda"
import { loadAgentRuntimeApis } from "@/lib/apis"
import { getChatAttachmentsMetadata, uploadChatAttachmentPayloads } from "@/lib/chat-attachments"
import {
  formatAgendaSlotForContext,
  resolveAgendaReservationSkill,
} from "@/lib/chat/agenda-skill"
import {
  appendOptionalHumanOffer,
  buildHumanHandoffReply,
  classifyHumanEscalationNeed,
  isHumanHandoffIntent,
} from "@/lib/chat/handoff-policy"
import {
  applyBillingGuardrail,
  applyHandoffGuardrail,
} from "@/lib/chat/guardrails"
import { enrichLeadContext, executeSalesOrchestrator } from "@/lib/chat/orchestrator"
import {
  buildImportedHistorySummary,
  getIdentifiedContactKey,
  getWhatsAppContactNameFromContext,
  resolveCanonicalWhatsAppExternalIdentifier,
  resolveChatContactSnapshot,
} from "@/lib/chat/contact"
import {
  buildBillingBlockedResult,
  buildFinalChatResult,
  buildIsolatedChatResult,
  buildSilentChatResult,
} from "@/lib/chat/result-builders"
import {
  loadChatHistory,
  persistAssistantState,
  persistAssistantTurn,
  persistUserTurn,
} from "@/lib/chat/persistence"
import {
  buildContinuationMessage,
  buildWhatsAppMessageSequence,
  extractRecentMercadoLivreProductsFromAssets,
  formatWhatsAppHumanOutboundText,
  isCatalogLoadMoreMessage,
  isCatalogSearchMessage,
  normalizeStructuredCustomerReply,
  parseAssetPrice,
  sanitizeWhatsAppCustomerFacingReply,
  splitCatalogReplyForWhatsApp,
  stripAssistantMetaReply,
} from "@/lib/chat/reply-formatting"
import { shouldRefreshSummary, summarizeConversation } from "@/lib/chat/summary-stage"
import {
  requestAutoPauseHandoff,
  requestHumanHandoff,
} from "@/lib/chat-handoffs"
import { createChat, findActiveChatByChannel, findActiveWhatsAppChatByPhone, getChatById, listChatMessages, listRecentMessagesByExternalIdentifier } from "@/lib/chats"
import { getChatWidgetById, getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets"
import { createLogEntry } from "@/lib/logs"
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos"
import {
  buildActionSuggestionReply,
  buildChatWidgetActions,
  buildWhatsAppContinuationCta,
  hasConfiguredWhatsAppDestination,
  hasWhatsAppIntentSignal,
  sanitizeReplyForWhatsAppCta,
  sanitizeReplyWithoutWhatsAppCta,
} from "@/lib/chat/whatsapp-cta"
import { resolveHomeCtaPayload } from "@/lib/chat/home-cta"
import {
  buildLoopGuardAiResult,
  detectWhatsAppLoopGuard,
} from "@/lib/chat/whatsapp-loop-guard"
import {
  buildUsagePersistencePayload,
  persistUsageRecord,
} from "@/lib/chat/usage-persistence"
import { listActiveHandoffRecipientsByProjectId } from "@/lib/whatsapp-handoff-contatos"
import { getActiveWhatsAppChannelByProjectAgent, sendWhatsAppTextMessage } from "@/lib/whatsapp-channels"

export {
  applyBillingGuardrail,
  applyHandoffGuardrail,
} from "@/lib/chat/guardrails"

export {
  getWhatsAppContactAvatarFromContext,
  getWhatsAppContactNameFromContext,
  resolveCanonicalWhatsAppExternalIdentifier,
  resolveChatContactSnapshot,
} from "@/lib/chat/contact"

export {
  buildAssistantMessageMetadata,
  buildUserMessageMetadata,
  loadChatHistory,
  persistAssistantState,
  persistAssistantTurn,
  persistUserTurn,
} from "@/lib/chat/persistence"

export {
  buildContinuationMessage,
  buildWhatsAppMessageSequence,
  extractRecentMercadoLivreProductsFromAssets,
  formatWhatsAppHumanOutboundText,
  isCatalogLoadMoreMessage,
  isCatalogSearchMessage,
  normalizeStructuredCustomerReply,
  parseAssetPrice,
  sanitizeWhatsAppCustomerFacingReply,
  splitCatalogReplyForWhatsApp,
  stripAssistantMetaReply,
} from "@/lib/chat/reply-formatting"

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sanitizeCatalogString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function sanitizeCatalogNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sanitizeCatalogStringArray(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => sanitizeCatalogString(item)).filter(Boolean))]
}

function buildCatalogProductFactualContextState(input = {}) {
  const source = input && typeof input === "object" ? input : {}
  const fields = sanitizeCatalogStringArray(source.fields)
  const scope = sanitizeCatalogString(source.scope)
  const productId = sanitizeCatalogString(source.productId)

  if (!fields.length && !scope && !productId) {
    return null
  }

  return {
    fields,
    scope,
    productId,
    source: sanitizeCatalogString(source.source),
    updatedAt: sanitizeCatalogString(source.updatedAt) || new Date().toISOString(),
  }
}

function buildCatalogListingSessionState(input = {}) {
  const searchTerm = sanitizeCatalogString(input.searchTerm)
  const matchedProductIds = sanitizeCatalogStringArray(input.matchedProductIds)
  const sessionId = sanitizeCatalogString(input.id)
  const snapshotId = sanitizeCatalogString(input.snapshotId)
  const hasSession =
    sessionId ||
    searchTerm ||
    matchedProductIds.length ||
    snapshotId ||
    sanitizeCatalogNumber(input.total, 0) > 0 ||
    input.hasMore === true

  if (!hasSession) {
    return null
  }

  return {
    id: sessionId,
    snapshotId,
    searchTerm,
    matchedProductIds,
    offset: sanitizeCatalogNumber(input.offset, 0),
    nextOffset: sanitizeCatalogNumber(input.nextOffset, 0),
    poolLimit: sanitizeCatalogNumber(input.poolLimit, 24),
    hasMore: input.hasMore === true,
    total: sanitizeCatalogNumber(input.total, matchedProductIds.length),
    source: sanitizeCatalogString(input.source) || "storefront_snapshot",
  }
}

function deriveCatalogListingSession(context = {}) {
  if (isPlainObject(context?.catalogo?.listingSession)) {
    return buildCatalogListingSessionState(context.catalogo.listingSession)
  }

  return buildCatalogListingSessionState({
    id: "",
    snapshotId: context?.catalogo?.snapshotId,
    searchTerm: context?.catalogo?.ultimaBusca,
    matchedProductIds: Array.isArray(context?.catalogo?.ultimosProdutos)
      ? context.catalogo.ultimosProdutos.map((item) => item?.id)
      : [],
    offset: context?.catalogo?.paginationOffset,
    nextOffset: context?.catalogo?.paginationNextOffset,
    poolLimit: context?.catalogo?.paginationPoolLimit,
    hasMore: context?.catalogo?.paginationHasMore,
    total: context?.catalogo?.paginationTotal,
    source: "storefront_snapshot",
  })
}

function buildCatalogProductFocusState(input = {}) {
  const productId = sanitizeCatalogString(input.productId)
  if (!productId) {
    return null
  }

  return {
    productId,
    sourceListingSessionId: sanitizeCatalogString(input.sourceListingSessionId),
    detailLevel: sanitizeCatalogString(input.detailLevel) || "focused",
    factualContext: buildCatalogProductFactualContextState(input.factualContext),
  }
}

function decorateCatalogAssetsWithListingSession(assets = [], nextContext = {}) {
  const listingSessionId = sanitizeCatalogString(nextContext?.catalogo?.listingSession?.id)
  if (!listingSessionId || !Array.isArray(assets) || assets.length === 0) {
    return Array.isArray(assets) ? assets : []
  }

  return assets.map((asset) => {
    if (!isPlainObject(asset)) {
      return asset
    }

    const isCatalogAsset =
      asset.kind === "product" ||
      asset.provider === "mercado_livre" ||
      asset.provider === "api_runtime" ||
      /^MLB/i.test(sanitizeCatalogString(asset.id))

    if (!isCatalogAsset) {
      return asset
    }

    return {
      ...asset,
      metadata: {
        ...(isPlainObject(asset.metadata) ? asset.metadata : {}),
        productId:
          sanitizeCatalogString(asset?.metadata?.productId) ||
          sanitizeCatalogString(asset?.id),
        listingSessionId,
      },
    }
  })
}

function normalizeUiBlockItem(value) {
  const text = String(value || "").trim()
  return text || null
}

function countReplyWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length
}

function shouldSuppressWhatsAppCtaForCatalogMicroReply(input = {}) {
  if (input.channelKind === "whatsapp" || input.userAskedForWhatsApp === true) {
    return false
  }

  const metadata = isPlainObject(input.ai?.metadata) ? input.ai.metadata : null
  const catalogFactContext = isPlainObject(metadata?.catalogFactContext) ? metadata.catalogFactContext : null
  const heuristicStage = sanitizeCatalogString(metadata?.heuristicStage).toLowerCase()
  const primaryReply = String(input.primaryReply || "").trim()
  const followUpReply = String(input.followUpReply || "").trim()

  if (!catalogFactContext || !primaryReply || followUpReply) {
    return false
  }

  if (!["mercado_livre_product_fact", "api_runtime", "api_catalog_runtime"].includes(heuristicStage)) {
    return false
  }

  return primaryReply.length <= 140 && countReplyWords(primaryReply) <= 18
}

function shouldSuppressCatalogActionsForMicroReply(input = {}) {
  const metadata = isPlainObject(input.ai?.metadata) ? input.ai.metadata : null
  const catalogFactContext = isPlainObject(metadata?.catalogFactContext) ? metadata.catalogFactContext : null
  const primaryReply = String(input.primaryReply || "").trim()
  const followUpReply = String(input.followUpReply || "").trim()
  const catalogContinuation = input.catalogContinuation === true

  if (!catalogFactContext || !primaryReply || followUpReply || catalogContinuation) {
    return false
  }

  return primaryReply.length <= 140 && countReplyWords(primaryReply) <= 18
}

function normalizeUiActionItem(item) {
  if (!isPlainObject(item)) {
    return null
  }

  const label = String(item.label || "").trim()
  const type = String(item.type || "").trim()
  if (!label || !type) {
    return null
  }

  return {
    label,
    type,
    url: typeof item.url === "string" && item.url.trim() ? item.url.trim() : undefined,
    message: typeof item.message === "string" && item.message.trim() ? item.message.trim() : undefined,
    eventName: typeof item.eventName === "string" && item.eventName.trim() ? item.eventName.trim() : undefined,
  }
}

function normalizeUiCardItem(item) {
  if (!isPlainObject(item)) {
    return null
  }

  const title = String(item.title || "").trim()
  const description = String(item.description || "").trim()
  const meta = String(item.meta || item.value || "").trim()
  const badge = String(item.badge || "").trim()

  if (!title && !description && !meta && !badge) {
    return null
  }

  return {
    title: title || undefined,
    description: description || undefined,
    meta: meta || undefined,
    badge: badge || undefined,
  }
}

function normalizeUiBlock(block) {
  if (!isPlainObject(block)) {
    return null
  }

  const type = String(block.type || "").trim().toLowerCase()
  if (!type) {
    return null
  }

  if (type === "text") {
    const text = String(block.text || "").trim()
    if (!text) {
      return null
    }

    return {
      type,
      variant: String(block.variant || "body").trim().toLowerCase(),
      text,
    }
  }

  if (type === "badges" || type === "list") {
    const items = Array.isArray(block.items) ? block.items.map(normalizeUiBlockItem).filter(Boolean).slice(0, 8) : []
    return items.length ? { type, items } : null
  }

  if (type === "actions") {
    const items = Array.isArray(block.items) ? block.items.map(normalizeUiActionItem).filter(Boolean).slice(0, 4) : []
    return items.length ? { type, items } : null
  }

  if (type === "cards") {
    const items = Array.isArray(block.items) ? block.items.map(normalizeUiCardItem).filter(Boolean).slice(0, 4) : []
    return items.length ? { type, items } : null
  }

  if (type === "notice") {
    const text = String(block.text || "").trim()
    return text
      ? {
          type,
          tone: String(block.tone || "info").trim().toLowerCase(),
          text,
        }
      : null
  }

  return null
}

function normalizeUiPayload(ui) {
  if (!isPlainObject(ui) || !Array.isArray(ui.blocks)) {
    return null
  }

  const blocks = ui.blocks.map(normalizeUiBlock).filter(Boolean)
  return blocks.length ? { blocks } : null
}

function extractStructuredReplyEnvelope(rawReply) {
  const text = String(rawReply || "").trim()
  if (!text || !/^\{[\s\S]*\}$/.test(text)) {
    return null
  }

  try {
    const parsed = JSON.parse(text)
    if (!isPlainObject(parsed)) {
      return null
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : ""
    const followUpReply = typeof parsed.followUpReply === "string" ? parsed.followUpReply.trim() : ""
    const ui = normalizeUiPayload(parsed.ui)

    if (!reply && !followUpReply && !ui) {
      return null
    }

    return { reply, followUpReply, ui }
  } catch {
    return null
  }
}

function hasLockedProductDetailContext(context) {
  return Boolean(
    isPlainObject(context?.catalogo?.produtoAtual) &&
      typeof context.catalogo.produtoAtual.nome === "string" &&
      context.catalogo.produtoAtual.nome.trim() &&
      (String(context?.conversation?.mode || "").trim().toLowerCase() === "product_detail" ||
        context?.ui?.productDetailPreferred === true ||
        context?.storefront?.pageKind === "product_detail")
  )
}

function isExplicitProductDetailExitMessage(message) {
  const normalized = String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return false
  }

  return (
    /\b(outro|outra|outros|outras|parecido|parecidos|similares|opcoes|modelos)\b/.test(normalized) ||
    /\b(me mostra|mostra|mande|manda|envia|traz|buscar|busca|procuro|quero ver)\b[\s\S]{0,30}\b(outro|outra|outros|outras|mais|opcoes|modelos|parecidos)\b/.test(
      normalized
    )
  )
}

export function mergeContext(base, ...extras) {
  return extras.filter(Boolean).reduce(
    (accumulator, extra) => ({
      ...accumulator,
      ...extra,
    }),
    base ?? {}
  )
}

export function normalizeChannelKind(body) {
  if (typeof body?.canal === "string" && body.canal.trim()) {
    return body.canal.trim()
  }

  return isPlainObject(body?.context) &&
    isPlainObject(body.context.channel) &&
    typeof body.context.channel.kind === "string"
    ? body.context.channel.kind.trim()
    : "web"
}

export function getChatWhatsAppChannelId(chat, body) {
  const candidates = [
    body?.whatsappChannelId,
    body?.context?.whatsapp?.channelId,
    chat?.contexto?.whatsapp?.channelId,
    chat?.canalWhatsappId,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function getAppUrl() {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  )
}

function buildHumanHandoffAlertMessage(input) {
  return [
    "Novo pedido de atendimento humano.",
    input.projectName ? `Projeto: ${input.projectName}.` : "",
    input.customerName ? `Cliente: ${input.customerName}.` : "",
    input.customerPhone ? `WhatsApp: ${input.customerPhone}.` : "",
    input.message ? `Ultima mensagem: ${input.message}` : "",
    `Abrir atendimento: ${input.attendanceUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

export function getAdminTestAgentId(body) {
  return isPlainObject(body?.context) &&
    isPlainObject(body.context.admin) &&
    typeof body.context.admin.agenteId === "string" &&
    body.context.admin.agenteId.trim()
    ? body.context.admin.agenteId.trim()
    : null
}

export function getAdminTestProjectId(body) {
  return isPlainObject(body?.context) &&
    isPlainObject(body.context.admin) &&
    typeof body.context.admin.projetoId === "string" &&
    body.context.admin.projetoId.trim()
    ? body.context.admin.projetoId.trim()
    : null
}

export function normalizeInboundAttachments(body) {
  return Array.isArray(body?.attachments)
    ? body.attachments
        .map((attachment) => ({
          name: attachment.name?.trim() || "arquivo",
          type: attachment.type?.trim() || "application/octet-stream",
          dataBase64: attachment.dataBase64?.trim() || "",
        }))
        .filter((attachment) => attachment.dataBase64)
        .slice(0, 5)
    : []
}

export function normalizeInboundMessage(body) {
  return String(body?.message ?? body?.mensagem ?? body?.texto ?? "")
    .trim()
}

export function hasSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  return Boolean(url && key)
}

export function applyAdminTestContextOverrides(body, channelKind) {
  if (channelKind !== "admin_agent_test") {
    return body
  }

  const adminTestAgentId = getAdminTestAgentId(body)
  const adminTestProjectId = getAdminTestProjectId(body)
  if (!adminTestAgentId && !adminTestProjectId) {
    return body
  }

  return {
    ...body,
    agente: adminTestAgentId ?? body.agente,
    projeto: adminTestProjectId ?? body.projeto,
  }
}

export function normalizeExternalIdentifier(body, channelKind) {
  return channelKind === "whatsapp"
    ? resolveCanonicalWhatsAppExternalIdentifier({
        identificadorExterno: body?.identificadorExterno,
        identificador: body?.identificador,
        context: isPlainObject(body?.context) ? body.context : null,
      })
    : body?.identificadorExterno?.trim() || body?.identificador?.trim() || null
}

export function buildNextContext(input) {
  const mergedCurrentContext = mergeContext(input.currentContext, input.extraContext)
  const enrichedContext = input.enrichLeadContext(
    mergedCurrentContext,
    input.history.map((item) => ({ role: item.role, content: item.conteudo })),
    input.message
  )
  const enrichedContextRecord = enrichedContext
  const nextContext = {
    ...mergedCurrentContext,
    ...enrichedContext,
    canal: input.channelKind,
    channel: isPlainObject(enrichedContextRecord.channel)
      ? {
          ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}),
          ...enrichedContextRecord.channel,
          kind: input.channelKind,
          external_id: input.normalizedExternalIdentifier,
        }
      : {
          ...(isPlainObject(mergedCurrentContext.channel) ? mergedCurrentContext.channel : {}),
          kind: input.channelKind,
          external_id: input.normalizedExternalIdentifier,
        },
    ui: {
      ...(isPlainObject(mergedCurrentContext.ui) ? mergedCurrentContext.ui : {}),
      ...(isPlainObject(enrichedContextRecord.ui) ? enrichedContextRecord.ui : {}),
      ...(input.channelKind === "whatsapp"
        ? {
            structured_response: false,
            allow_icons: true,
          }
        : input.channelKind === "external_widget" || enrichedContextRecord.widget || mergedCurrentContext.widget
          ? {
              structured_response: true,
              allow_icons: false,
            }
        : {}),
    },
    sdk: isPlainObject(enrichedContextRecord.sdk)
      ? { ...(isPlainObject(mergedCurrentContext.sdk) ? mergedCurrentContext.sdk : {}), ...enrichedContextRecord.sdk }
      : mergedCurrentContext.sdk,
    widget: isPlainObject(enrichedContextRecord.widget)
      ? {
          ...(isPlainObject(mergedCurrentContext.widget) ? mergedCurrentContext.widget : {}),
          ...enrichedContextRecord.widget,
        }
      : mergedCurrentContext.widget,
    whatsapp: isPlainObject(enrichedContextRecord.whatsapp)
      ? {
          ...(isPlainObject(mergedCurrentContext.whatsapp) ? mergedCurrentContext.whatsapp : {}),
          ...enrichedContextRecord.whatsapp,
        }
      : mergedCurrentContext.whatsapp,
    conversation: isPlainObject(enrichedContextRecord.conversation)
      ? {
          ...(isPlainObject(mergedCurrentContext.conversation) ? mergedCurrentContext.conversation : {}),
          ...enrichedContextRecord.conversation,
        }
      : isPlainObject(mergedCurrentContext.conversation)
        ? { ...mergedCurrentContext.conversation }
        : {},
    catalogo: isPlainObject(mergedCurrentContext.catalogo) ? { ...mergedCurrentContext.catalogo } : {},
  }

  if (!nextContext.lead?.telefone && input.history.length >= 2 && input.history.length < 6) {
    nextContext.qualificacao = {
      ...nextContext.qualificacao,
      pronto_para_whatsapp: false,
    }
  }

  const lockedProductDetailContext = hasLockedProductDetailContext(mergedCurrentContext)
  if (isCatalogSearchMessage(input.message) && (!lockedProductDetailContext || isExplicitProductDetailExitMessage(input.message))) {
    const listingSession = buildCatalogListingSessionState({
      id: "",
      snapshotId: null,
      searchTerm: input.message.trim(),
      matchedProductIds: [],
      offset: 0,
      nextOffset: 0,
      poolLimit: 24,
      hasMore: false,
      total: 0,
      source: "storefront_snapshot",
    })
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: input.message.trim(),
      produtoAtual: null,
      ultimosProdutos: [],
      focusMode: "listing",
      catalogState: "storefront_listing",
      paginationOffset: 0,
      paginationNextOffset: 0,
      paginationPoolLimit: 24,
      paginationHasMore: false,
      paginationTotal: 0,
      snapshotId: null,
      snapshotCreatedAt: null,
      snapshotTurnId: null,
      listingSession,
      productFocus: null,
    }
    nextContext.conversation = {
      ...(isPlainObject(nextContext.conversation) ? nextContext.conversation : {}),
      mode: "listing",
      updatedAt: new Date().toISOString(),
    }
  }

  return nextContext
}

function extractPromisedCatalogSearchTerm(reply) {
  const text = String(reply || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) {
    return ""
  }

  const patterns = [
    /\b(?:vou|irei)\s+buscar\s+(?:as\s+)?opcoes\s+de\s+(.+?)(?:\s+disponiveis|\s+e\s+te\s+trago|\.|$)/i,
    /\b(?:vou|irei)\s+procurar\s+(?:as\s+)?opcoes\s+de\s+(.+?)(?:\s+disponiveis|\s+e\s+te\s+trago|\.|$)/i,
    /\bbuscar\s+(?:as\s+)?opcoes\s+de\s+(.+?)(?:\s+disponiveis|\s+e\s+te\s+trago|\.|$)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const term = String(match?.[1] || "")
      .replace(/\b(?:para voce|pra voce|por favor|em seguida)\b/gi, "")
      .replace(/[.!?]+$/g, "")
      .trim()
    if (term.length >= 3) {
      return term
    }
  }

  return ""
}

export function updateContextFromAiResult(input) {
  const nextContext = {
    ...input.nextContext,
    ui: isPlainObject(input.nextContext?.ui) ? { ...input.nextContext.ui } : input.nextContext?.ui,
    conversation: isPlainObject(input.nextContext?.conversation) ? { ...input.nextContext.conversation } : {},
    catalogo: isPlainObject(input.nextContext?.catalogo) ? { ...input.nextContext.catalogo } : {},
    agenda: isPlainObject(input.nextContext?.agenda) ? { ...input.nextContext.agenda } : {},
    billing: isPlainObject(input.nextContext?.billing) ? { ...input.nextContext.billing } : {},
  }
  if (isPlainObject(nextContext.ui) && "catalogAction" in nextContext.ui) {
    delete nextContext.ui.catalogAction
  }
  if (isPlainObject(nextContext.ui) && "catalogProductId" in nextContext.ui) {
    delete nextContext.ui.catalogProductId
  }
  if (isPlainObject(nextContext.ui) && "listingSessionId" in nextContext.ui) {
    delete nextContext.ui.listingSessionId
  }
  nextContext.catalogo.listingSession = deriveCatalogListingSession(nextContext)
  nextContext.catalogo.productFocus = isPlainObject(nextContext.catalogo?.productFocus)
    ? buildCatalogProductFocusState(nextContext.catalogo.productFocus)
    : null
  const lockedProductDetailContext = hasLockedProductDetailContext(nextContext)

  const metadataFocus = isPlainObject(input.ai?.metadata?.focus) ? input.ai.metadata.focus : null
  if (metadataFocus?.domain) {
    nextContext.focus = {
      domain: typeof metadataFocus.domain === "string" ? metadataFocus.domain : "general",
      source: typeof metadataFocus.source === "string" ? metadataFocus.source : null,
      subject: typeof metadataFocus.subject === "string" ? metadataFocus.subject : null,
      confidence: Number.isFinite(Number(metadataFocus.confidence)) ? Number(metadataFocus.confidence) : null,
      expiresAt: typeof metadataFocus.expiresAt === "string" ? metadataFocus.expiresAt : null,
      updatedAt: new Date().toISOString(),
    }
  } else if (isPlainObject(input.ai?.metadata?.routingDecision) && input.ai.metadata.routingDecision.domain === "general") {
    delete nextContext.focus
  }

  const billingContextUpdate = isPlainObject(input.ai?.metadata?.billingContextUpdate) ? input.ai.metadata.billingContextUpdate : null
  if (billingContextUpdate) {
    const hasPlanFocusUpdate = Object.prototype.hasOwnProperty.call(billingContextUpdate, "planFocus")
    const hasComparisonFocusUpdate = Object.prototype.hasOwnProperty.call(billingContextUpdate, "comparisonFocus")
    nextContext.billing = {
      ...(isPlainObject(nextContext.billing) ? nextContext.billing : {}),
      lastIntent: typeof billingContextUpdate.lastIntent === "string" ? billingContextUpdate.lastIntent : nextContext.billing?.lastIntent ?? null,
      lastField: typeof billingContextUpdate.lastField === "string" ? billingContextUpdate.lastField : nextContext.billing?.lastField ?? null,
      lastFields: Array.isArray(billingContextUpdate.lastFields)
        ? billingContextUpdate.lastFields.filter((item) => typeof item === "string" && item.trim())
        : Array.isArray(nextContext.billing?.lastFields)
          ? nextContext.billing.lastFields
          : [],
      updatedAt: typeof billingContextUpdate.updatedAt === "string" ? billingContextUpdate.updatedAt : new Date().toISOString(),
      planFocus: hasPlanFocusUpdate
        ? isPlainObject(billingContextUpdate.planFocus)
          ? {
              slug: typeof billingContextUpdate.planFocus.slug === "string" ? billingContextUpdate.planFocus.slug : null,
              name: typeof billingContextUpdate.planFocus.name === "string" ? billingContextUpdate.planFocus.name : null,
              updatedAt:
                typeof billingContextUpdate.planFocus.updatedAt === "string"
                  ? billingContextUpdate.planFocus.updatedAt
                  : new Date().toISOString(),
            }
          : null
        : nextContext.billing?.planFocus ?? null,
      comparisonFocus: hasComparisonFocusUpdate
        ? isPlainObject(billingContextUpdate.comparisonFocus)
          ? {
              plans: Array.isArray(billingContextUpdate.comparisonFocus.plans)
                ? billingContextUpdate.comparisonFocus.plans
                    .map((item) =>
                      isPlainObject(item)
                        ? {
                            slug: typeof item.slug === "string" ? item.slug : null,
                            name: typeof item.name === "string" ? item.name : null,
                          }
                        : null
                    )
                    .filter(Boolean)
                : [],
              fields: Array.isArray(billingContextUpdate.comparisonFocus.fields)
                ? billingContextUpdate.comparisonFocus.fields.filter((item) => typeof item === "string" && item.trim())
                : [],
              updatedAt:
                typeof billingContextUpdate.comparisonFocus.updatedAt === "string"
                  ? billingContextUpdate.comparisonFocus.updatedAt
                  : new Date().toISOString(),
            }
          : null
        : nextContext.billing?.comparisonFocus ?? null,
    }
  }

  const recentMercadoLivreProducts = extractRecentMercadoLivreProductsFromAssets(input.ai.assets)
  const promisedCatalogSearchTerm = !recentMercadoLivreProducts.length
    ? extractPromisedCatalogSearchTerm(input.ai.reply)
    : ""

  if (promisedCatalogSearchTerm && !lockedProductDetailContext) {
    nextContext.catalogo.listingSession = buildCatalogListingSessionState({
      ...(nextContext.catalogo.listingSession ?? {}),
      searchTerm: promisedCatalogSearchTerm,
      matchedProductIds: [],
      offset: 0,
      nextOffset: 0,
      poolLimit: 24,
      hasMore: false,
      total: 0,
    })
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: promisedCatalogSearchTerm,
      produtoAtual: null,
      focusMode: "listing",
      catalogState: "storefront_listing",
      paginationOffset: 0,
      paginationNextOffset: 0,
      paginationPoolLimit: 24,
      paginationHasMore: false,
      paginationTotal: 0,
      productFocus: null,
    }
    nextContext.focus = {
      domain: "catalog",
      source: "mercado_livre",
      subject: promisedCatalogSearchTerm,
      confidence: 0.72,
      expiresAt: new Date(Date.now() + 12 * 60_000).toISOString(),
      updatedAt: new Date().toISOString(),
    }
    nextContext.conversation = {
      ...(isPlainObject(nextContext.conversation) ? nextContext.conversation : {}),
      mode: "listing",
      updatedAt: new Date().toISOString(),
    }
  }

  if (recentMercadoLivreProducts.length) {
    const snapshotCreatedAt = new Date().toISOString()
    const snapshotTurnId = Number(input.historyLengthSource ?? 0)
    const snapshotId = `${input.chatId}:${snapshotTurnId}:${snapshotCreatedAt}`
    const listingSession = buildCatalogListingSessionState({
      ...(nextContext.catalogo.listingSession ?? {}),
      id: sanitizeCatalogString(nextContext.catalogo.listingSession?.id) || snapshotId,
      snapshotId,
      searchTerm: nextContext.catalogo?.ultimaBusca ?? nextContext.catalogo?.listingSession?.searchTerm ?? "",
      matchedProductIds: recentMercadoLivreProducts.map((product) => product?.id),
      offset: nextContext.catalogo?.paginationOffset ?? 0,
      nextOffset: nextContext.catalogo?.paginationNextOffset ?? 0,
      poolLimit: nextContext.catalogo?.paginationPoolLimit ?? 24,
      hasMore: nextContext.catalogo?.paginationHasMore === true,
      total: nextContext.catalogo?.paginationTotal ?? recentMercadoLivreProducts.length,
      source: "storefront_snapshot",
    })
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimosProdutos: recentMercadoLivreProducts,
      focusMode: recentMercadoLivreProducts.length === 1 ? "product_focus" : "listing",
      catalogState: recentMercadoLivreProducts.length === 1 ? "product_focus" : "storefront_listing",
      snapshotId,
      snapshotCreatedAt,
      snapshotTurnId,
      listingSession,
    }
  }

  const metadataCatalogProduct =
    isPlainObject(input.ai.metadata) && "catalogoProdutoAtual" in input.ai.metadata
      ? input.ai.metadata.catalogoProdutoAtual
      : null
  const metadataCatalogFactContext =
    isPlainObject(input.ai.metadata) && isPlainObject(input.ai.metadata.catalogFactContext)
      ? input.ai.metadata.catalogFactContext
      : null

  if (isPlainObject(metadataCatalogProduct)) {
    const sourceListingSessionId =
      sanitizeCatalogString(nextContext.catalogo?.listingSession?.id) ||
      sanitizeCatalogString(nextContext.catalogo?.productFocus?.sourceListingSessionId)
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      produtoAtual: metadataCatalogProduct,
      focusMode: "product_focus",
      selectedItemId: typeof metadataCatalogProduct.id === "string" ? metadataCatalogProduct.id : nextContext.catalogo?.selectedItemId ?? null,
      productFocus: buildCatalogProductFocusState({
        productId: metadataCatalogProduct.id,
        sourceListingSessionId,
        detailLevel: "focused",
        factualContext:
          sanitizeCatalogString(metadataCatalogFactContext?.productId) === sanitizeCatalogString(metadataCatalogProduct?.id)
            ? metadataCatalogFactContext
            : null,
      }),
      catalogState:
        String(nextContext?.conversation?.mode || "").trim().toLowerCase() === "product_detail" ? "product_locked" : "product_focus",
    }
    const currentMode = String(nextContext?.conversation?.mode || "").trim().toLowerCase()
    nextContext.conversation = {
      ...(isPlainObject(nextContext.conversation) ? nextContext.conversation : {}),
      mode: currentMode === "product_detail" ? "product_detail" : "product_focus",
      updatedAt: new Date().toISOString(),
    }
  }

  const metadataCatalogSearch =
    isPlainObject(input.ai.metadata) && isPlainObject(input.ai.metadata.catalogoBusca) ? input.ai.metadata.catalogoBusca : null

  if (metadataCatalogSearch) {
    const shouldKeepLockedProduct =
      hasLockedProductDetailContext(nextContext) &&
      !isPlainObject(metadataCatalogSearch.produtoAtual) &&
      Array.isArray(metadataCatalogSearch.ultimosProdutos) &&
      metadataCatalogSearch.ultimosProdutos.length > 1

    const nextListingSession = buildCatalogListingSessionState({
      ...(nextContext.catalogo.listingSession ?? {}),
      ...(isPlainObject(metadataCatalogSearch.listingSession) ? metadataCatalogSearch.listingSession : {}),
      snapshotId: metadataCatalogSearch.snapshotId ?? nextContext.catalogo?.snapshotId ?? nextContext.catalogo?.listingSession?.snapshotId,
      searchTerm:
        typeof metadataCatalogSearch.ultimaBusca === "string" && metadataCatalogSearch.ultimaBusca.trim()
          ? metadataCatalogSearch.ultimaBusca.trim()
          : nextContext.catalogo?.listingSession?.searchTerm ?? nextContext.catalogo?.ultimaBusca ?? null,
      matchedProductIds: Array.isArray(metadataCatalogSearch.ultimosProdutos)
        ? metadataCatalogSearch.ultimosProdutos.map((product) => product?.id)
        : nextContext.catalogo?.listingSession?.matchedProductIds ?? [],
      offset: metadataCatalogSearch.paginationOffset ?? nextContext.catalogo?.paginationOffset ?? 0,
      nextOffset: metadataCatalogSearch.paginationNextOffset ?? nextContext.catalogo?.paginationNextOffset ?? 0,
      poolLimit: metadataCatalogSearch.paginationPoolLimit ?? nextContext.catalogo?.paginationPoolLimit ?? 24,
      hasMore: metadataCatalogSearch.paginationHasMore === true,
      total: metadataCatalogSearch.paginationTotal ?? nextContext.catalogo?.paginationTotal ?? 0,
      source: metadataCatalogSearch.listingSession?.source ?? "storefront_snapshot",
    })

    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca:
        typeof metadataCatalogSearch.ultimaBusca === "string" && metadataCatalogSearch.ultimaBusca.trim()
          ? metadataCatalogSearch.ultimaBusca.trim()
          : nextContext.catalogo?.ultimaBusca ?? null,
      paginationOffset: Number(metadataCatalogSearch.paginationOffset ?? nextContext.catalogo?.paginationOffset ?? 0) || 0,
      paginationNextOffset:
        Number(metadataCatalogSearch.paginationNextOffset ?? nextContext.catalogo?.paginationNextOffset ?? 0) || 0,
      paginationPoolLimit:
        Number(metadataCatalogSearch.paginationPoolLimit ?? nextContext.catalogo?.paginationPoolLimit ?? 24) || 24,
      paginationHasMore: metadataCatalogSearch.paginationHasMore === true,
      paginationTotal: Number(metadataCatalogSearch.paginationTotal ?? nextContext.catalogo?.paginationTotal ?? 0) || 0,
      focusMode: shouldKeepLockedProduct
        ? nextContext.catalogo?.focusMode ?? "product_focus"
        : isPlainObject(metadataCatalogSearch.produtoAtual)
        ? "product_focus"
        : "listing",
      catalogState: shouldKeepLockedProduct
        ? "product_locked"
        : isPlainObject(metadataCatalogSearch.produtoAtual)
        ? "product_focus"
        : "storefront_listing",
      listingSession: nextListingSession,
    }

    if (Array.isArray(metadataCatalogSearch.ultimosProdutos)) {
      nextContext.catalogo.ultimosProdutos = metadataCatalogSearch.ultimosProdutos.filter(
        (product) => isPlainObject(product) && typeof product.nome === "string" && product.nome.trim()
      )

      if (nextContext.catalogo.ultimosProdutos.length > 1 && !shouldKeepLockedProduct) {
        if (!isPlainObject(nextContext.catalogo.productFocus)) {
          nextContext.catalogo.produtoAtual = null
          nextContext.catalogo.focusMode = "listing"
          nextContext.conversation = {
            ...(isPlainObject(nextContext.conversation) ? nextContext.conversation : {}),
            mode: "listing",
            updatedAt: new Date().toISOString(),
          }
        }
      }
    }

    if (isPlainObject(metadataCatalogSearch.produtoAtual)) {
      nextContext.catalogo.produtoAtual = metadataCatalogSearch.produtoAtual
      nextContext.catalogo.productFocus = buildCatalogProductFocusState({
        productId: metadataCatalogSearch.produtoAtual.id,
        sourceListingSessionId: nextListingSession?.id,
        detailLevel: "focused",
        factualContext:
          sanitizeCatalogString(metadataCatalogFactContext?.productId) === sanitizeCatalogString(metadataCatalogSearch.produtoAtual?.id)
            ? metadataCatalogFactContext
            : null,
      })
    }
  }

  if (isPlainObject(nextContext.catalogo?.productFocus) && metadataCatalogFactContext) {
    const focusProductId = sanitizeCatalogString(nextContext.catalogo.productFocus.productId)
    const factProductId = sanitizeCatalogString(metadataCatalogFactContext.productId)
    if (!factProductId || !focusProductId || factProductId === focusProductId) {
      nextContext.catalogo.productFocus = buildCatalogProductFocusState({
        ...nextContext.catalogo.productFocus,
        factualContext: {
          ...(isPlainObject(nextContext.catalogo.productFocus?.factualContext) ? nextContext.catalogo.productFocus.factualContext : {}),
          ...metadataCatalogFactContext,
          productId: focusProductId || factProductId,
        },
      })
    }
  }

  if (isPlainObject(nextContext.catalogo?.produtoAtual) && !String(nextContext.catalogo?.focusMode || "").trim()) {
    nextContext.catalogo.focusMode = "product_focus"
  }

  if (hasLockedProductDetailContext(nextContext)) {
    nextContext.catalogo.focusMode = "product_focus"
    nextContext.catalogo.catalogState = "product_locked"
    nextContext.catalogo.productFocus = buildCatalogProductFocusState({
      productId: nextContext.catalogo?.produtoAtual?.id,
      sourceListingSessionId:
        sanitizeCatalogString(nextContext.catalogo?.productFocus?.sourceListingSessionId) ||
        sanitizeCatalogString(nextContext.catalogo?.listingSession?.id),
      detailLevel: "focused",
      factualContext:
        sanitizeCatalogString(nextContext.catalogo?.productFocus?.factualContext?.productId) ===
        sanitizeCatalogString(nextContext.catalogo?.produtoAtual?.id)
          ? nextContext.catalogo?.productFocus?.factualContext
          : null,
    })
    nextContext.conversation = {
      ...(isPlainObject(nextContext.conversation) ? nextContext.conversation : {}),
      mode: "product_detail",
      updatedAt: new Date().toISOString(),
    }
  }

  if (!isPlainObject(nextContext.catalogo?.produtoAtual)) {
    nextContext.catalogo.productFocus = null
  }

  const agendaReservation = input.ai?.metadata?.agendaReserva
  if (isPlainObject(agendaReservation)) {
    nextContext.agendaReserva = {
      id: agendaReservation.id ?? null,
      horarioId: agendaReservation.horarioId ?? null,
      horarioReservado: agendaReservation.horarioReservado ?? null,
      status: agendaReservation.status ?? null,
      updatedAt: new Date().toISOString(),
    }
  }

  const agendaFlow = isPlainObject(input.ai?.metadata?.agendaFlow) ? input.ai.metadata.agendaFlow : null
  if (agendaFlow?.action === "clear_pending") {
    if (isPlainObject(nextContext.agenda)) {
      delete nextContext.agenda.pendente
    }
  } else if (agendaFlow?.action === "set_pending") {
    nextContext.agenda = {
      ...(isPlainObject(nextContext.agenda) ? nextContext.agenda : {}),
      pendente: {
        status: typeof agendaFlow.status === "string" ? agendaFlow.status : "awaiting_approval",
        horarioId: agendaFlow.horarioId ?? null,
        horarioReservado: agendaFlow.horarioReservado ?? null,
        contato: isPlainObject(agendaFlow.contato) ? agendaFlow.contato : {},
        updatedAt: new Date().toISOString(),
      },
    }
  }

  return nextContext
}

export function prepareAiReplyPayload(input) {
  const isWhatsAppChannel = input.channelKind === "whatsapp"
  const catalogAwareAssets = decorateCatalogAssetsWithListingSession(input.ai.assets ?? [], input.nextContext)
  const structuredEnvelope = input.channelKind === "whatsapp" ? null : extractStructuredReplyEnvelope(input.ai.reply)
  const metadataCatalogSearch =
    isPlainObject(input.ai?.metadata?.catalogoBusca) ? input.ai.metadata.catalogoBusca : null
  const catalogListingSessionId =
    sanitizeCatalogString(metadataCatalogSearch?.listingSession?.id) ||
    sanitizeCatalogString(input.nextContext?.catalogo?.listingSession?.id)
  const catalogConversationMode = sanitizeCatalogString(input.nextContext?.conversation?.mode).toLowerCase()
  const catalogFocusMode = sanitizeCatalogString(input.nextContext?.catalogo?.focusMode).toLowerCase()
  const catalogState = sanitizeCatalogString(input.nextContext?.catalogo?.catalogState).toLowerCase()
  const hasCatalogListingContext =
    catalogConversationMode === "listing" ||
    catalogFocusMode === "listing" ||
    catalogState === "storefront_listing"
  const catalogContinuation =
    input.ai?.metadata?.catalogDiagnostics?.catalogAction === "load_more" ||
    input.ai?.metadata?.catalogDiagnostics?.catalogDecision?.kind === "catalog_load_more"
  const catalogMessageMode =
    (metadataCatalogSearch || hasCatalogListingContext) && Array.isArray(catalogAwareAssets) && catalogAwareAssets.length > 0
      ? (catalogContinuation ? "replace_listing" : "append_listing")
      : null
  const splitReply =
    isWhatsAppChannel
      ? null
      : splitCatalogReplyForWhatsApp(
          structuredEnvelope?.reply || input.ai.reply,
          Array.isArray(catalogAwareAssets) && catalogAwareAssets.length > 0
        )

  const primaryReplyRaw = splitReply?.mainReply || structuredEnvelope?.reply || input.ai.reply
  const followUpReplyRaw =
    isWhatsAppChannel ? "" : splitReply?.followUpReply || structuredEnvelope?.followUpReply || ""
  const primaryReplyBase = stripAssistantMetaReply(primaryReplyRaw, input.channelKind)
  const followUpReplyBase = stripAssistantMetaReply(followUpReplyRaw, input.channelKind)
  const normalizedPrimaryReplyBase = normalizeStructuredCustomerReply(primaryReplyBase)
  const normalizedFollowUpReplyBase = normalizeStructuredCustomerReply(followUpReplyBase)
  const primaryReply =
    isWhatsAppChannel
      ? sanitizeWhatsAppCustomerFacingReply(normalizedPrimaryReplyBase)
      : normalizedPrimaryReplyBase
  const followUpReply =
    isWhatsAppChannel
      ? sanitizeWhatsAppCustomerFacingReply(normalizedFollowUpReplyBase)
      : normalizedFollowUpReplyBase
  const hasWhatsAppDestination = hasConfiguredWhatsAppDestination(input.nextContext)
  const userAskedForWhatsApp = hasWhatsAppIntentSignal(input.userMessage || "")
  const shouldMentionWhatsAppInText =
    userAskedForWhatsApp ||
    input.ai?.handoff?.requested === true
  const suppressWhatsAppCta = shouldSuppressWhatsAppCtaForCatalogMicroReply({
    channelKind: input.channelKind,
    ai: input.ai,
    primaryReply,
    followUpReply,
    userAskedForWhatsApp,
  })
  const rawActions = buildChatWidgetActions({
    channelKind: input.channelKind,
    nextContext: input.nextContext,
    reply: primaryReply,
    followUpReply,
    userMessage: input.userMessage,
    agendaSlots: input.agendaSlots,
    assets: catalogAwareAssets,
  })
  let actions = suppressWhatsAppCta ? rawActions.filter((action) => action?.type !== "whatsapp_link") : rawActions
  if (shouldSuppressCatalogActionsForMicroReply({
    ai: input.ai,
    primaryReply,
    followUpReply,
    catalogContinuation,
  })) {
    actions = actions.filter((action) => action?.type === "message" && action?.extraContext?.ui?.catalogAction === "load_more")
  }
  const whatsappCta = suppressWhatsAppCta
    ? null
    : buildWhatsAppContinuationCta({
      channelKind: input.channelKind,
      nextContext: input.nextContext,
      reply: primaryReply,
      followUpReply,
      userMessage: input.userMessage,
    })
  const normalizedPrimaryReply = whatsappCta
    ? sanitizeReplyForWhatsAppCta(primaryReply, whatsappCta.label)
    : !hasWhatsAppDestination && userAskedForWhatsApp
      ? sanitizeReplyWithoutWhatsAppCta(primaryReply)
      : primaryReply
  const normalizedFollowUpReply = whatsappCta
    ? sanitizeReplyForWhatsAppCta(followUpReply, whatsappCta.label)
    : !hasWhatsAppDestination && userAskedForWhatsApp
      ? sanitizeReplyWithoutWhatsAppCta(followUpReply)
      : followUpReply
  const actionAwareFollowUpReply =
    isWhatsAppChannel
      ? normalizedFollowUpReply
      : buildActionSuggestionReply(actions, normalizedFollowUpReply, {
          forceWhatsAppSuggestion: shouldMentionWhatsAppInText,
        })
  const whatsappEmbeddedSequence =
    isWhatsAppChannel ? buildWhatsAppMessageSequence(normalizedPrimaryReply, catalogAwareAssets, null) : []

  return {
    primaryReply: normalizedPrimaryReply,
    followUpReply: actionAwareFollowUpReply,
    whatsappEmbeddedSequence,
    whatsappEmbeddedMessage: whatsappEmbeddedSequence[0] ?? "",
    whatsappCta,
    assets: catalogAwareAssets,
    actions: isWhatsAppChannel ? [] : actions,
    ui: isWhatsAppChannel ? null : structuredEnvelope?.ui ?? null,
    catalogContinuation,
    catalogMessageMode,
    catalogListingSessionId,
    contactSnapshot: resolveChatContactSnapshot(input.nextContext, input.normalizedExternalIdentifier),
    whatsappContactNameForTitle: getWhatsAppContactNameFromContext(input.nextContext),
    leadNameForTitle:
      typeof input.nextContext?.lead?.nome === "string" && input.nextContext.lead.nome.trim()
        ? input.nextContext.lead.nome.trim()
        : null,
  }
}

export function prepareChatPrelude(body) {
  const message = normalizeInboundMessage(body)
  const inboundAttachments = normalizeInboundAttachments(body)

  if (!message && !inboundAttachments.length) {
    throw new Error("Mensagem obrigatoria.")
  }

  const channelKind = normalizeChannelKind(body)
  const effectiveBody = applyAdminTestContextOverrides(body, channelKind)
  const normalizedExternalIdentifier = normalizeExternalIdentifier(effectiveBody, channelKind)

  if (!hasSupabaseServerEnv()) {
    return {
      status: "isolated",
      message,
      inboundAttachments,
      channelKind,
      effectiveBody,
      normalizedExternalIdentifier,
      result: buildIsolatedChatResult(body, message),
    }
  }

  return {
    status: "ready",
    message,
    inboundAttachments,
    channelKind,
    effectiveBody,
    normalizedExternalIdentifier,
    result: null,
  }
}

export async function resolveChatChannel(body = {}, deps = {}) {
  const channelKind = normalizeChannelKind(body)
  const adminTestAgentId = channelKind === "admin_agent_test" ? getAdminTestAgentId(body) : null
  const adminTestProjectId = channelKind === "admin_agent_test" ? getAdminTestProjectId(body) : null
  const projetoIdentifier = adminTestProjectId ?? (typeof body?.projeto === "string" ? body.projeto.trim() : null)
  const agenteIdentifier = adminTestAgentId ?? (typeof body?.agente === "string" ? body.agente.trim() : null)
  const getProjeto = deps.getProjetoByIdentifier ?? getProjetoByIdentifier
  const getAgente = deps.getAgenteByIdentifier ?? getAgenteByIdentifier
  const getWidgetById = deps.getChatWidgetById ?? getChatWidgetById
  const getWidgetBySlug = deps.getChatWidgetBySlug ?? getChatWidgetBySlug
  const getWidgetByProjetoAgente = deps.getChatWidgetByProjetoAgente ?? getChatWidgetByProjetoAgente
  const getProjetoByIdResolver = deps.getProjetoById ?? getProjetoById
  const getAgenteByIdResolver = deps.getAgenteById ?? getAgenteById
  const getActiveWhatsAppChannel = deps.getActiveWhatsAppChannelByProjectAgent ?? getActiveWhatsAppChannelByProjectAgent

  if (projetoIdentifier) {
    const projeto = await getProjeto(projetoIdentifier)
    let agente = agenteIdentifier ? await getAgente(agenteIdentifier, projeto?.id ?? null) : null

    const agenteAtivo = agente ? agente.active !== false && agente.ativo !== false : false
    const agenteProjetoId = agente?.projectId ?? agente?.projetoId ?? null

    if (agente && (!agenteAtivo || agenteProjetoId !== projeto?.id)) {
      agente = null
    }

    const widget = projeto?.id && agente?.id ? await getWidgetByProjetoAgente({ projetoId: projeto.id, agenteId: agente.id }) : null
    const whatsappChannel =
      projeto?.id && agente?.id ? await getActiveWhatsAppChannel({ projetoId: projeto.id, agenteId: agente.id }) : null

    return {
      projeto,
      agente,
      widget,
      whatsappChannel,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        projeto: projetoIdentifier,
        agente: agenteIdentifier,
        identificador_externo: body?.identificadorExterno?.trim() || null,
      },
    }
  }

  const widgetId = typeof body?.widgetId === "string" && body.widgetId.trim() ? body.widgetId.trim() : null
  const widgetSlug = typeof body?.widgetSlug === "string" && body.widgetSlug.trim() ? body.widgetSlug.trim() : null
  if (!widgetId && !widgetSlug) {
    return {
      projeto: null,
      agente: null,
      widget: null,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        widgetId: null,
        widgetSlug: null,
        identificador_externo: body?.identificadorExterno?.trim() || null,
      },
    }
  }

  const widget = widgetId ? await getWidgetById(widgetId) : await getWidgetBySlug(widgetSlug)

  if (!widget?.projetoId || !widget?.agenteId || widget.ativo === false) {
    return {
      projeto: null,
      agente: null,
      widget: null,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        widgetId,
        widgetSlug,
        identificador_externo: body?.identificadorExterno?.trim() || null,
      },
    }
  }

  const projeto = await getProjetoByIdResolver(widget.projetoId)
  const widgetAgent = projeto ? await getAgenteByIdResolver(widget.agenteId) : null
  const widgetAgentAtivo = widgetAgent ? widgetAgent.active !== false && widgetAgent.ativo !== false : false
  const widgetAgentProjetoId = widgetAgent?.projectId ?? widgetAgent?.projetoId ?? null
  const agente = widgetAgent && widgetAgentAtivo && widgetAgentProjetoId === projeto?.id ? widgetAgent : null
  const whatsappChannel =
    projeto?.id && agente?.id ? await getActiveWhatsAppChannel({ projetoId: projeto.id, agenteId: agente.id }) : null

  return {
    projeto,
    agente,
    widget,
    whatsappChannel,
    lockedToAgent: true,
    channel: {
      kind: channelKind,
      widgetId: widget.id,
      widgetSlug: widget.slug,
      identificador_externo: body?.identificadorExterno?.trim() || null,
    },
  }
}

export async function resolveProjectAgent(input = {}) {
  try {
    const resolved = await resolveChatChannel(input)
    return {
      projeto: resolved.projeto,
      agente: resolved.agente,
    }
  } catch (error) {
    console.error("CHAT PROJECT/AGENT FALLBACK:", error)
  }

  return {
    projeto: null,
    agente: null,
  }
}

export function buildCoreChatRequest(body, resolvedProjectAgent) {
  return {
    ...body,
    ...(resolvedProjectAgent?.projeto?.id ? { projeto: resolvedProjectAgent.projeto.id } : {}),
    ...(resolvedProjectAgent?.agente?.id ? { agente: resolvedProjectAgent.agente.id } : {}),
  }
}

export function buildInitialChatContext(input) {
  const whatsappChannel = isPlainObject(input.resolved?.whatsappChannel) ? input.resolved.whatsappChannel : null
  const baseUi = isPlainObject(input.extraContext?.ui) ? input.extraContext.ui : {}
  const shouldPreferStructuredUi =
    input.channelKind === "external_widget" || input.channelKind === "admin_agent_test" || Boolean(input.resolved?.widget)

  return {
    ...(isPlainObject(input.extraContext) ? input.extraContext : {}),
    projeto: input.resolved?.projeto
      ? {
          id: input.resolved.projeto.id,
          nome: input.resolved.projeto.nome ?? null,
          slug: input.resolved.projeto.slug ?? null,
          directConnections:
            input.resolved.projeto.directConnections && typeof input.resolved.projeto.directConnections === "object"
              ? { ...input.resolved.projeto.directConnections }
              : null,
        }
      : null,
    agente: input.resolved?.agente
      ? {
          id: input.resolved.agente.id,
          nome: input.resolved.agente.nome ?? input.resolved.agente.name ?? null,
          slug: input.resolved.agente.slug ?? null,
          descricao: input.resolved.agente.descricao ?? input.resolved.agente.description ?? null,
          promptBase: input.resolved.agente.promptBase ?? input.resolved.agente.prompt ?? null,
          configuracoes: input.resolved.agente.configuracoes ?? {},
          runtimeConfig: input.resolved.agente.runtimeConfig ?? null,
          locked: Boolean(input.resolved?.lockedToAgent),
        }
      : null,
    widget: input.resolved?.widget
      ? {
          id: input.resolved.widget.id,
          slug: input.resolved.widget.slug,
          whatsapp_celular: input.resolved.widget.whatsappCelular ?? "",
          whatsappEnabled: Boolean(whatsappChannel?.id),
        }
      : null,
    whatsapp: whatsappChannel
      ? {
          channelId: whatsappChannel.id,
          numero: whatsappChannel.number ?? "",
          number: whatsappChannel.number ?? "",
          connectionStatus: whatsappChannel.connectionStatus ?? null,
          ctaEnabled: true,
        }
      : {
          ctaEnabled: false,
        },
    channel: {
      ...(isPlainObject(input.resolved?.channel) ? input.resolved.channel : {}),
      kind: input.channelKind,
      external_id: input.normalizedExternalIdentifier,
    },
    ui: {
      ...baseUi,
      ...(shouldPreferStructuredUi
        ? {
            structured_response: true,
            allow_icons: false,
          }
        : {}),
    },
    canal: input.channelKind,
  }
}

export function buildFallbackChatTitle(input) {
  const previewText = input.message || "Midia recebida"
  const fallbackTitle =
    input.contactSnapshot?.contatoNome ?? (previewText.length > 60 ? `${previewText.slice(0, 57)}...` : previewText)

  return String(fallbackTitle || "Nova conversa").trim() || "Nova conversa"
}

export async function ensureActiveChatSession(input, deps = {}) {
  const loadChatById = deps.getChatById ?? getChatById
  const findChatByChannel = deps.findActiveChatByChannel ?? findActiveChatByChannel
  const findWhatsAppChatByPhone = deps.findActiveWhatsAppChatByPhone ?? findActiveWhatsAppChatByPhone
  const createChatRecord = deps.createChat ?? createChat

  let chat = null
  if (input.chatId) {
    const existingChat = await loadChatById(input.chatId)
    const projectMatches = !input.resolved?.projeto?.id || existingChat?.projetoId === input.resolved.projeto.id
    const agentMatches = !input.resolved?.agente?.id || !existingChat?.agenteId || existingChat.agenteId === input.resolved.agente.id
    if (existingChat?.status === "ativo" && projectMatches && agentMatches) {
      return {
        chat: existingChat,
        created: false,
        initialContext: null,
      }
    }
  }

  if (input.normalizedExternalIdentifier && input.resolved?.projeto?.id) {
    const preferredAgentId = input.resolved?.agente?.id ?? null
    chat = await findChatByChannel({
      projetoId: input.resolved.projeto.id,
      agenteId: preferredAgentId,
      canal: input.channelKind,
      identificadorExterno: input.normalizedExternalIdentifier,
      channelScopeId: input.channelKind === "whatsapp" ? input.whatsappChannelId ?? null : null,
    })

    if (!chat && input.channelKind === "whatsapp") {
      const fallbackPhone = input.contactSnapshot?.contatoTelefone ?? input.normalizedExternalIdentifier
      if (fallbackPhone) {
        chat = await findWhatsAppChatByPhone({
          projetoId: input.resolved.projeto.id,
          agenteId: preferredAgentId,
          phone: fallbackPhone,
          channelScopeId: input.whatsappChannelId ?? null,
        })
      }
    }
  }

  if (chat) {
    return {
      chat,
      created: false,
      initialContext: null,
    }
  }

  const initialContext = buildInitialChatContext({
    resolved: input.resolved,
    extraContext: input.extraContext,
    channelKind: input.channelKind,
    normalizedExternalIdentifier: input.normalizedExternalIdentifier,
  })
  const createdChat = await createChatRecord({
    titulo: buildFallbackChatTitle({
      message: input.message,
      contactSnapshot: input.contactSnapshot,
    }),
    projetoId: input.resolved?.projeto?.id ?? null,
    agenteId: input.resolved?.agente?.id ?? null,
    canal: input.channelKind,
    identificadorExterno: input.normalizedExternalIdentifier,
    contexto: initialContext,
    contatoNome: input.contactSnapshot?.contatoNome ?? null,
    contatoTelefone: input.contactSnapshot?.contatoTelefone ?? null,
    contatoAvatarUrl: input.contactSnapshot?.contatoAvatarUrl ?? null,
  })

  return {
    chat: createdChat,
    created: true,
    initialContext,
  }
}

export async function requestRuntimeHumanHandoff(input, deps = {}) {
  const requestHandoff = deps.requestHumanHandoff ?? requestHumanHandoff
  const listRecipients = deps.listActiveHandoffRecipientsByProjectId ?? listActiveHandoffRecipientsByProjectId
  const sendMessage = deps.sendWhatsAppTextMessage ?? sendWhatsAppTextMessage
  const loadChatById = deps.getChatById ?? getChatById
  const loadChatMessages = deps.listChatMessages ?? listChatMessages
  const getActiveWhatsAppChannel = deps.getActiveWhatsAppChannelByProjectAgent ?? getActiveWhatsAppChannelByProjectAgent
  let alertMessage = input.alertMessage ?? null
  let recipientsCount = 0
  let hasWhatsAppDestination = false
  let resolvedChannelId = input.canalWhatsappId ?? null

  if (!resolvedChannelId && input.projetoId && input.agenteId) {
    try {
      const activeChannel = await getActiveWhatsAppChannel({
        projetoId: input.projetoId,
        agenteId: input.agenteId,
      })
      resolvedChannelId = activeChannel?.id ?? null
      hasWhatsAppDestination = Boolean(resolvedChannelId)
    } catch (error) {}
  }

  if (resolvedChannelId && input.chatId && input.projetoId) {
    try {
      const canLoadChatContext = typeof deps.getChatById === "function" || hasSupabaseServerEnv()
      const chat = canLoadChatContext ? await loadChatById(input.chatId) : null
      const recipients = await listRecipients(input.projetoId, {
        canalWhatsappId: resolvedChannelId,
      })
      recipientsCount = recipients.length
      hasWhatsAppDestination = true

      if (chat && recipients.length > 0) {
        const attendanceUrl = `${getAppUrl().replace(/\/$/, "")}/admin/atendimento?conversa=${encodeURIComponent(input.chatId)}`
        const customerName = chat.contatoNome?.trim() || chat.titulo?.trim() || "Cliente"
        const customerPhone = chat.contatoTelefone?.trim() || chat.identificadorExterno?.trim() || ""
        const lastCustomerMessage = await loadChatMessages(input.chatId)
          .then((messages) =>
            [...messages]
              .reverse()
              .find((message) => message.role === "user" && String(message.conteudo || "").trim())
          )
          .catch(() => null)

        alertMessage = buildHumanHandoffAlertMessage({
          projectName: input.projetoNome || null,
          customerName,
          customerPhone,
          message: String(lastCustomerMessage?.conteudo || "").replace(/\s+/g, " ").trim().slice(0, 280),
          attendanceUrl,
        })

        await Promise.all(
          recipients.map((recipient) =>
            sendMessage({
              channelId: resolvedChannelId,
              to: recipient.numero,
              message: alertMessage,
            })
          )
        )
      }
    } catch (error) {}
  }

  const handoff = await requestHandoff({
    chatId: input.chatId,
    projetoId: input.projetoId,
    canalWhatsappId: resolvedChannelId ?? input.canalWhatsappId ?? null,
    requestedBy: "agent",
    motivo: input.motivo ?? "Cliente pediu atendimento humano.",
    metadata: input.metadata ?? {},
    alertMessage,
  })

  return {
    handoff,
    acknowledgement:
      recipientsCount > 0
        ? input.channelKind === "whatsapp"
          ? "Perfeito. Ja acionei um atendente humano para continuar por aqui. Assim que alguem assumir, seguimos neste mesmo WhatsApp."
          : "Perfeito. Ja acionei um atendente humano para continuar por aqui assim que possivel."
        : hasWhatsAppDestination
          ? input.channelKind === "whatsapp"
            ? "Consigo seguir por aqui no WhatsApp, mas este projeto ainda nao tem um atendente configurado para receber o chamado humano."
            : "Consigo te levar para o WhatsApp, mas este projeto ainda nao tem um atendente configurado para receber o chamado humano."
          : "Este projeto ainda nao tem um atendente configurado para receber o chamado humano.",
    recipientsCount,
    hasWhatsAppDestination,
  }
}

export async function applyWhatsAppLoopGuard(runtimeState, deps = {}) {
  if (runtimeState?.prelude?.channelKind !== "whatsapp") {
    return { action: "none", result: null, handoff: runtimeState?.handoffState?.handoff ?? null, metrics: null }
  }

  const detection = detectWhatsAppLoopGuard(runtimeState.history)
  if (detection.action === "none") {
    return { action: "none", result: null, handoff: runtimeState?.handoffState?.handoff ?? null, metrics: detection.metrics }
  }

  const currentHandoff = runtimeState?.handoffState?.handoff ?? null
  if (currentHandoff?.status === "human") {
    return { action: "none", result: null, handoff: currentHandoff, metrics: detection.metrics }
  }

  if (detection.action === "pause") {
    const handoff = await (deps.requestAutoPauseHandoff ?? requestAutoPauseHandoff)({
      chatId: runtimeState.session.chat.id,
      projetoId: runtimeState.session.chat.projetoId ?? runtimeState.resolved?.projeto?.id ?? null,
      canalWhatsappId: getChatWhatsAppChannelId(runtimeState.session.chat, runtimeState.prelude.effectiveBody),
      motivo: "Conversa pausada automaticamente por suspeita de loop no WhatsApp.",
      reason: detection.reason,
      triggerMessage: runtimeState.prelude.message,
      details: detection.metrics,
    })

    return {
      action: "pause",
      handoff,
      metrics: detection.metrics,
      result: {
        ...buildSilentChatResult(runtimeState.session.chat.id),
        handoff: {
          active: true,
          paused: true,
          requested: false,
          status: "pausado_loop",
          actionLabel: "Atendimento pausado",
          reason: detection.reason,
        },
      },
    }
  }

  return {
    action: "probe",
    handoff: currentHandoff,
    metrics: detection.metrics,
    aiResult: buildLoopGuardAiResult(detection.reason, detection.metrics),
  }
}

function attachRuntimeDiagnostics(result, runtimeState, extra = {}) {
  const runtimeApis = Array.isArray(extra.runtimeApis) ? extra.runtimeApis : []
  const handoffDecision = extra.handoffDecision ?? null

  return {
    ...result,
    diagnostics: {
      stage: runtimeState?.stage ?? null,
      failClosed:
        runtimeState?.stage === "billing_blocked" ||
        runtimeState?.stage === "handoff_paused" ||
        runtimeState?.stage === "whatsapp_loop_paused" ||
        runtimeState?.stage === "isolated",
      projetoId: runtimeState?.resolved?.projeto?.id ?? runtimeState?.session?.chat?.projetoId ?? null,
      agenteId: runtimeState?.resolved?.agente?.id ?? runtimeState?.session?.chat?.agenteId ?? null,
      agenteNome: runtimeState?.resolved?.agente?.nome ?? null,
      widgetId: runtimeState?.resolved?.widget?.id ?? null,
      widgetName: runtimeState?.resolved?.widget?.nome ?? null,
      widgetSlug: runtimeState?.resolved?.widget?.slug ?? null,
      channelKind: runtimeState?.prelude?.channelKind ?? null,
      provider: extra.aiResult?.metadata?.provider ?? null,
      model: extra.aiResult?.metadata?.model ?? null,
      routeStage: extra.aiResult?.metadata?.routeStage ?? null,
      domainStage: extra.aiResult?.metadata?.domainStage ?? null,
      heuristicStage: extra.aiResult?.metadata?.heuristicStage ?? null,
      inputTokens: extra.aiResult?.usage?.inputTokens ?? null,
      outputTokens: extra.aiResult?.usage?.outputTokens ?? null,
      runtimeApiCount: runtimeApis.length,
      runtimeApiCacheHits: runtimeApis.filter((api) => api?.cache?.hit === true).length,
      runtimeApis: runtimeApis.map((api) => ({
        id: api?.id ?? null,
        nome: api?.nome ?? api?.name ?? null,
        metodo: api?.metodo ?? api?.method ?? null,
        cacheHit: api?.cache?.hit === true,
      })),
      handoffDecision: typeof handoffDecision?.decision === "string" ? handoffDecision.decision : null,
      handoffReason: typeof handoffDecision?.reason === "string" ? handoffDecision.reason : null,
      handoffRequested: extra.handoffRequested === true,
    },
  }
}

async function recordChatRuntimeEvent(runtimeState, entry = {}) {
  const payload =
    entry?.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)
      ? entry.payload
      : {}

  return createLogEntry({
    projectId: runtimeState?.resolved?.projeto?.id ?? runtimeState?.session?.chat?.projetoId ?? null,
    type: entry?.type || "chat_runtime_event",
    origin: entry?.origin || "chat_runtime",
    level: entry?.level || "info",
    description: entry?.description || "Evento do runtime do chat.",
    payload: {
      ...payload,
      stage: runtimeState?.stage ?? null,
      projetoId: runtimeState?.resolved?.projeto?.id ?? runtimeState?.session?.chat?.projetoId ?? null,
      agenteId: runtimeState?.resolved?.agente?.id ?? runtimeState?.session?.chat?.agenteId ?? null,
      widgetId: runtimeState?.resolved?.widget?.id ?? null,
      widgetSlug: runtimeState?.resolved?.widget?.slug ?? null,
      channelKind: runtimeState?.prelude?.channelKind ?? null,
      chatId: runtimeState?.session?.chat?.id ?? null,
    },
  })
}

export function isSavedWhatsAppContact(context) {
  if (!isPlainObject(context?.whatsapp)) {
    return false
  }

  const nestedFlags = isPlainObject(context.whatsapp.savedContactFlags) ? context.whatsapp.savedContactFlags : null
  const explicitFlags = [
    nestedFlags?.isSavedContact,
    nestedFlags?.isMyContact,
    nestedFlags?.isSaved,
    context.whatsapp.isSavedContact,
    context.whatsapp.isMyContact,
    context.whatsapp.isSaved,
    context.whatsapp.rawContact?.isSavedContact,
    context.whatsapp.rawContact?.isMyContact,
    context.whatsapp.rawContact?.isSaved,
  ]

  for (const flag of explicitFlags) {
    if (typeof flag === "boolean") {
      return flag
    }
  }

  return false
}

export async function finalizeV2AiTurn(runtimeState, aiResult, options = {}) {
  const persistAssistantTurnStep = options.persistAssistantTurn ?? persistAssistantTurn
  const persistAssistantStateStep = options.persistAssistantState ?? persistAssistantState
  const persistUsageRecordStep = options.persistUsageRecord ?? persistUsageRecord
  const nextContext = buildNextContext({
    currentContext: runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {},
    extraContext: isPlainObject(runtimeState.prelude.effectiveBody.context) ? runtimeState.prelude.effectiveBody.context : null,
    history: runtimeState.history,
    message: runtimeState.prelude.message,
    channelKind: runtimeState.prelude.channelKind,
    normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
    enrichLeadContext,
  })
  const updatedContext = updateContextFromAiResult({
    nextContext,
    ai: aiResult,
    chatId: runtimeState.session.chat.id,
    historyLengthSource: runtimeState.history.length,
  })
  const messageCount = Number(updatedContext?.memoria?.mensagem_count ?? runtimeState.history.length + 1)
  if (shouldRefreshSummary(messageCount)) {
    const historyForSummary = [
      ...runtimeState.history.map((item) => ({
        role: item.role,
        content: item.conteudo,
      })),
      {
        role: "assistant",
        content: String(aiResult?.reply ?? ""),
      },
    ]

    updatedContext.memoria = {
      ...(isPlainObject(updatedContext.memoria) ? updatedContext.memoria : {}),
      mensagem_count: messageCount,
      resumo: await summarizeConversation(
        historyForSummary,
        isPlainObject(updatedContext.memoria) ? updatedContext.memoria.resumo ?? null : null
      ),
    }
  } else {
    updatedContext.memoria = {
      ...(isPlainObject(updatedContext.memoria) ? updatedContext.memoria : {}),
      mensagem_count: messageCount,
    }
  }
  const replyPayload = prepareAiReplyPayload({
    channelKind: runtimeState.prelude.channelKind,
    ai: aiResult,
    nextContext: updatedContext,
    normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
    userMessage: runtimeState.prelude.message,
    agendaSlots: runtimeState.agendaSlots ?? [],
  })
  const usagePayload = buildUsagePersistencePayload({
    projetoId: runtimeState.session.chat.projetoId ?? runtimeState.resolved?.projeto?.id ?? null,
    usuarioId: runtimeState.session.chat.usuarioId ?? null,
    referenciaId: null,
    channelKind: runtimeState.prelude.channelKind,
    inputTokens: aiResult?.usage?.inputTokens ?? 0,
    outputTokens: aiResult?.usage?.outputTokens ?? 0,
    aiMetadata: aiResult?.metadata ?? {},
  })
  const assistantMessage = await persistAssistantTurnStep(
    {
      chatId: runtimeState.session.chat.id,
      content:
        runtimeState.prelude.channelKind === "whatsapp"
          ? replyPayload.whatsappEmbeddedMessage || replyPayload.primaryReply
          : [replyPayload.primaryReply, replyPayload.followUpReply].filter(Boolean).join("\n\n"),
      channelKind: runtimeState.prelude.channelKind,
      normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
      tokensInput: aiResult?.usage?.inputTokens ?? 0,
      tokensOutput: aiResult?.usage?.outputTokens ?? 0,
      custo: usagePayload.estimatedCostUsd,
      aiMetadata: aiResult?.metadata ?? {},
      usageTelemetry: usagePayload.usageTelemetry,
      assets: replyPayload.assets ?? [],
      whatsapp: replyPayload.whatsappCta,
      actions: replyPayload.actions,
      ui: replyPayload.ui,
      catalogContinuation: replyPayload.catalogContinuation === true,
      catalogMessageMode: replyPayload.catalogMessageMode ?? null,
      catalogListingSessionId: replyPayload.catalogListingSessionId ?? null,
      followUpReply: false,
    },
    options
  )
  const usagePayloadWithReference = {
    ...usagePayload,
    usageRecord: {
      ...usagePayload.usageRecord,
      details: {
        ...usagePayload.usageRecord.details,
        referenciaId: assistantMessage.id,
      },
    },
  }
  await persistAssistantStateStep(
    {
      chatId: runtimeState.session.chat.id,
      nextContext: updatedContext,
      totalTokensToAdd: usagePayloadWithReference.usageRecord.tokens,
      totalCustoToAdd: usagePayloadWithReference.estimatedCostUsd,
      titulo: replyPayload.leadNameForTitle ?? replyPayload.whatsappContactNameForTitle ?? runtimeState.session.chat.titulo,
      normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
      contactSnapshot: replyPayload.contactSnapshot,
    },
    options
  )
  await persistUsageRecordStep(usagePayloadWithReference.usageRecord, options)

  return buildFinalChatResult({
    chatId: runtimeState.session.chat.id,
    messageId: assistantMessage.id,
    createdAt: assistantMessage.createdAt ?? null,
    channelKind: runtimeState.prelude.channelKind,
    reply:
      runtimeState.prelude.channelKind === "whatsapp"
        ? replyPayload.whatsappEmbeddedMessage || replyPayload.primaryReply
        : assistantMessage.conteudo ?? replyPayload.primaryReply,
    followUpReply: replyPayload.followUpReply,
    messageSequence: replyPayload.whatsappEmbeddedSequence,
    assets: runtimeState.prelude.channelKind === "whatsapp" ? [] : replyPayload.assets ?? [],
    whatsapp: replyPayload.whatsappCta,
    actions: replyPayload.actions,
    ui: replyPayload.ui,
    catalogContinuation: replyPayload.catalogContinuation === true,
    catalogMessageMode: replyPayload.catalogMessageMode ?? null,
    catalogListingSessionId: replyPayload.catalogListingSessionId ?? null,
    handoff: aiResult?.handoff ?? null,
  })
}

export async function applyAiHumanEscalation(runtimeState, aiResult, options = {}) {
  const explicitHumanHandoffRequested = isHumanHandoffIntent(runtimeState.prelude.message)
  const aiHumanEscalationDecision = explicitHumanHandoffRequested
    ? {
        decision: "request_handoff",
        reason: "Cliente pediu atendimento humano explicitamente.",
      }
    : await classifyHumanEscalationNeed({
        projetoId: runtimeState.session.chat.projetoId ?? runtimeState.resolved?.projeto?.id ?? null,
        channelKind: runtimeState.prelude.channelKind,
        message: runtimeState.prelude.message,
        aiReply: String(aiResult?.reply ?? ""),
        aiMetadata: aiResult?.metadata ?? {},
        context: runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {},
        history: runtimeState.history,
      })

  if (
    aiHumanEscalationDecision?.decision === "offer_handoff" &&
    !explicitHumanHandoffRequested &&
    String(aiResult?.reply ?? "").trim()
  ) {
    return {
      aiResult: {
        ...aiResult,
        reply: appendOptionalHumanOffer(aiResult.reply, runtimeState.prelude.channelKind),
        handoff: {
          offered: true,
          requested: false,
          actionLabel: "Chamar humano",
        },
      },
      handoffDecision: aiHumanEscalationDecision,
      handoffRequested: false,
      handoff: null,
    }
  }

  const shouldRequestHandoff =
    explicitHumanHandoffRequested || aiHumanEscalationDecision?.decision === "request_handoff"

  if (!shouldRequestHandoff || !runtimeState.session.chat.projetoId) {
    return {
      aiResult,
      handoffDecision: aiHumanEscalationDecision,
      handoffRequested: false,
      handoff: null,
    }
  }

  const handoffResponse = await (options.requestRuntimeHumanHandoff ?? requestRuntimeHumanHandoff)(
    {
      chatId: runtimeState.session.chat.id,
      projetoId: runtimeState.session.chat.projetoId,
      agenteId: runtimeState.resolved?.agente?.id ?? runtimeState.session.chat.agenteId ?? null,
      canalWhatsappId: getChatWhatsAppChannelId(runtimeState.session.chat, runtimeState.prelude.effectiveBody),
      channelKind: runtimeState.prelude.channelKind,
      projetoNome: runtimeState.resolved?.projeto?.nome ?? null,
      motivo: explicitHumanHandoffRequested
        ? "Cliente pediu atendimento humano explicitamente."
        : aiHumanEscalationDecision?.reason ?? "Escalada humana solicitada pelo runtime.",
      metadata: {
        trigger: explicitHumanHandoffRequested ? "message_intent" : "classified_runtime",
        escalationDecision: aiHumanEscalationDecision?.decision ?? null,
        escalationReason: aiHumanEscalationDecision?.reason ?? null,
      },
      alertMessage: null,
    },
    options
  )

  return {
    aiResult: {
      ...aiResult,
      reply: buildHumanHandoffReply(runtimeState.prelude.channelKind, {
        hasRecipients: Number(handoffResponse?.recipientsCount ?? 0) > 0,
        hasWhatsAppDestination:
          handoffResponse?.hasWhatsAppDestination === true ||
          runtimeState.session.chat.contexto?.whatsapp?.ctaEnabled === true ||
          runtimeState.session.initialContext?.whatsapp?.ctaEnabled === true,
      }),
      assets: [],
      handoff: {
        offered: true,
        requested: true,
        actionLabel: "Chamar humano",
      },
    },
    handoffDecision: aiHumanEscalationDecision,
    handoffRequested: true,
    handoff: handoffResponse?.handoff ?? null,
  }
}

export async function executeV2RuntimePrelude(body, options = {}) {
  const prelude = prepareChatPrelude(body)
  if (prelude.status === "isolated") {
    return {
      stage: "isolated",
      prelude,
      result: prelude.result,
    }
  }

  const resolved = options.resolveChatChannel
    ? await options.resolveChatChannel(prelude.effectiveBody)
    : options.resolveProjectAgent
      ? await options.resolveProjectAgent(prelude.effectiveBody)
      : await resolveChatChannel(prelude.effectiveBody)

  if (!resolved?.projeto?.id || !resolved?.agente?.id) {
    throw new Error("Chat publico sem projeto/agente valido. Revise a configuracao do widget ou do embed.")
  }

  const extraContext = isPlainObject(prelude.effectiveBody.context) ? prelude.effectiveBody.context : null
  const contactSnapshot = resolveChatContactSnapshot(extraContext, prelude.normalizedExternalIdentifier)
  const ensureChatSession = options.ensureActiveChatSession ?? ensureActiveChatSession
  const uploadAttachmentPayloads = options.uploadChatAttachmentPayloads ?? uploadChatAttachmentPayloads
  const persistUserTurnStep = options.persistUserTurn ?? persistUserTurn
  const loadHistoryStep = options.loadChatHistory ?? loadChatHistory
  const applyHandoffStep = options.applyHandoffGuardrail ?? applyHandoffGuardrail
  const applyBillingStep = options.applyBillingGuardrail ?? applyBillingGuardrail

  const session = await ensureChatSession(
    {
      resolved,
      chatId: prelude.effectiveBody.chatId ?? null,
      channelKind: prelude.channelKind,
      normalizedExternalIdentifier: prelude.normalizedExternalIdentifier,
      whatsappChannelId: prelude.effectiveBody.whatsappChannelId ?? null,
      contactSnapshot,
      message: prelude.message,
      extraContext,
    },
    options
  )

  if (!session.chat?.id) {
    throw new Error("Nao foi possivel iniciar ou localizar a sessao ativa do chat.")
  }

  const uploadedInboundAttachments =
    prelude.inboundAttachments.length && session.chat.id
      ? await uploadAttachmentPayloads({
          projetoId: session.chat.projetoId ?? resolved?.projeto?.id ?? null,
          chatId: session.chat.id,
          attachments: prelude.inboundAttachments,
        })
      : []

  await persistUserTurnStep(
    {
      chatId: session.chat.id,
      message: prelude.message,
      channelKind: prelude.channelKind,
      normalizedExternalIdentifier: prelude.normalizedExternalIdentifier,
      source: prelude.effectiveBody.source,
      attachments: getChatAttachmentsMetadata(uploadedInboundAttachments),
    },
    options
  )

  const handoffState = await applyHandoffStep(
    {
      chatId: session.chat.id,
    },
    options
  )
  if (handoffState.paused) {
    await recordChatRuntimeEvent(
      {
        stage: "handoff_paused",
        prelude,
        resolved,
        session,
      },
      {
        type: "chat_handoff_event",
        origin: "chat_runtime",
        level: "warn",
        description: "Assistente pausado por handoff humano ativo.",
        payload: {
          handoffStatus: handoffState.handoff?.status ?? null,
        },
      },
    )
    const autoPauseActive = handoffState.handoff?.metadata?.autoPause?.active === true

    return {
      stage: "handoff_paused",
      prelude,
      resolved,
      session,
      contactSnapshot,
      uploadedInboundAttachments,
      handoffState,
      result: {
        ...handoffState.result,
        handoff: {
          active: true,
          paused: true,
          requested: true,
          status: autoPauseActive ? "pausado_loop" : handoffState.handoff?.status ?? "active_human",
          actionLabel: autoPauseActive ? "Atendimento pausado" : "Atendimento humano",
          reason: autoPauseActive ? handoffState.handoff?.metadata?.autoPause?.reason ?? "loop_detected" : null,
        },
      },
    }
  }

  const history = await loadHistoryStep(session.chat.id, options)
  const billingState = await applyBillingStep(
    {
      projetoId: session.chat.projetoId ?? resolved?.projeto?.id ?? null,
      chatId: session.chat.id,
    },
    options
  )
  if (billingState.blocked) {
    await recordChatRuntimeEvent(
      {
        stage: "billing_blocked",
        prelude,
        resolved,
        session,
      },
      {
        type: "billing_event",
        origin: "chat_runtime",
        level: "warn",
        description: "Atendimento bloqueado por limite do projeto.",
        payload: {
          billingAllowed: false,
          billingCode: billingState.billingAccess?.code ?? null,
        },
      },
    )
    return {
      stage: "billing_blocked",
      prelude,
      resolved,
      session,
      contactSnapshot,
      uploadedInboundAttachments,
      handoffState,
      history,
      billingState,
      result: billingState.result,
    }
  }

  return {
    stage: "ready_for_ai",
    prelude,
    resolved,
    session,
    contactSnapshot,
    uploadedInboundAttachments,
    handoffState,
    history,
    billingState,
    result: null,
  }
}

async function finalizeScriptedAssistantTurn(runtimeState, scriptedPayload, options = {}) {
  const persistAssistantTurnStep = options.persistAssistantTurn ?? persistAssistantTurn
  const persistAssistantStateStep = options.persistAssistantState ?? persistAssistantState
  const currentContext = runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {}
  const nextContext = mergeContext(currentContext, {
    ui: {
      ...(isPlainObject(currentContext?.ui) ? currentContext.ui : {}),
      lastHomeCta: scriptedPayload.key ?? null,
      homeCta: scriptedPayload.key ?? null,
      homeCtaTopic: scriptedPayload.topicLabel ?? null,
      homeCtaSummary: scriptedPayload.contextSummary ?? null,
    },
  })
  const content = [scriptedPayload.reply, scriptedPayload.followUpReply].filter(Boolean).join("\n\n")
  const assistantMessage = await persistAssistantTurnStep(
    {
      chatId: runtimeState.session.chat.id,
      content,
      channelKind: runtimeState.prelude.channelKind,
      normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
      tokensInput: 0,
      tokensOutput: 0,
      custo: 0,
      aiMetadata: {
        provider: "scripted_home_cta",
        routeStage: "home_cta",
      },
      assets: [],
      whatsapp: null,
      actions: Array.isArray(scriptedPayload.actions) ? scriptedPayload.actions : [],
      ui: null,
      followUpReply: false,
    },
    options
  )

  await persistAssistantStateStep(
    {
      chatId: runtimeState.session.chat.id,
      nextContext,
      totalTokensToAdd: 0,
      totalCustoToAdd: 0,
      titulo: runtimeState.session.chat.titulo,
      normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
      contactSnapshot: runtimeState.contactSnapshot,
    },
    options
  )

  return buildFinalChatResult({
    chatId: runtimeState.session.chat.id,
    messageId: assistantMessage.id,
    createdAt: assistantMessage.createdAt ?? null,
    channelKind: runtimeState.prelude.channelKind,
    reply: scriptedPayload.reply,
    followUpReply: scriptedPayload.followUpReply,
    messageSequence: [],
    assets: [],
    whatsapp: null,
    actions: scriptedPayload.actions,
    ui: null,
    handoff: null,
  })
}

export async function processChatRequest(body, options = {}) {
  const runtimeState = await executeV2RuntimePrelude(body, options)
  if (runtimeState.result) {
    return attachRuntimeDiagnostics(runtimeState.result, runtimeState)
  }

  if (typeof options.executeCore === "function") {
    return options.executeCore(
      buildCoreChatRequest(runtimeState.prelude.effectiveBody, runtimeState.resolved),
      runtimeState
    )
  }

  try {
    const currentContext = runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {}
    const scriptedHomeCta = resolveHomeCtaPayload({
      source: runtimeState.prelude.effectiveBody.source,
      widgetSlug: runtimeState.resolved?.widget?.slug ?? null,
      channelKind: runtimeState.prelude.channelKind,
      homeCta: runtimeState.prelude.effectiveBody?.context?.ui?.homeCta ?? currentContext?.ui?.homeCta ?? null,
      runtimeConfig: runtimeState.resolved?.agente?.runtimeConfig ?? null,
    })

    if (scriptedHomeCta) {
      await recordChatRuntimeEvent(runtimeState, {
        type: "chat_runtime_event",
        origin: "chat_runtime",
        level: "info",
        description: "CTA guiado da home respondido sem acionar IA.",
        payload: {
          scriptedFlow: "home_cta",
          homeCta: scriptedHomeCta.key,
        },
      })

      const scriptedResult = await finalizeScriptedAssistantTurn(runtimeState, scriptedHomeCta, options)
      return attachRuntimeDiagnostics(scriptedResult, runtimeState, {
        handoffDecision: {
          decision: "scripted_home_cta",
          reason: `CTA guiado da home: ${scriptedHomeCta.key}.`,
        },
        handoffRequested: false,
      })
    }

    const loopGuardState = await applyWhatsAppLoopGuard(runtimeState, options)
    if (loopGuardState.action === "pause") {
      runtimeState.stage = "whatsapp_loop_paused"

      await recordChatRuntimeEvent(runtimeState, {
        type: "chat_loop_guard_event",
        origin: "chat_runtime",
        level: "warn",
        description: "Conversa pausada automaticamente por suspeita de loop no WhatsApp.",
        payload: {
          loopGuardAction: "pause",
          loopGuardMetrics: loopGuardState.metrics,
        },
      })

      return attachRuntimeDiagnostics(loopGuardState.result, runtimeState, {
        handoffDecision: {
          decision: "whatsapp_loop_pause",
          reason: "Conversa pausada automaticamente por suspeita de loop.",
        },
        handoffRequested: false,
      })
    }

    if (loopGuardState.action === "probe" && loopGuardState.aiResult) {
      runtimeState.stage = "whatsapp_loop_probe"

      await recordChatRuntimeEvent(runtimeState, {
        type: "chat_loop_guard_event",
        origin: "chat_runtime",
        level: "warn",
        description: "Loop guard enviou pergunta de confirmacao no WhatsApp.",
        payload: {
          loopGuardAction: "probe",
          loopGuardMetrics: loopGuardState.metrics,
        },
      })

      const finalProbeResult = await finalizeV2AiTurn(runtimeState, loopGuardState.aiResult, options)
      return attachRuntimeDiagnostics(finalProbeResult, runtimeState, {
        aiResult: loopGuardState.aiResult,
        handoffDecision: {
          decision: "whatsapp_loop_probe",
          reason: "Suspeita de loop. Pergunta de confirmacao enviada.",
        },
        handoffRequested: false,
      })
    }

    const runtimeApis =
      runtimeState.resolved?.agente?.id && runtimeState.resolved?.projeto?.id
        ? await (options.loadAgentRuntimeApis ?? loadAgentRuntimeApis)({
            agenteId: runtimeState.resolved.agente.id,
            projetoId: runtimeState.resolved.projeto.id,
            context: runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {},
          })
        : []

    if (runtimeState.resolved?.agente?.id || runtimeState.resolved?.projeto?.id) {
      await recordChatRuntimeEvent(runtimeState, {
        type: "api_runtime_event",
        origin: "chat_runtime",
        level: "info",
        description: "APIs do agente carregadas para o runtime.",
        payload: {
          apiCount: Array.isArray(runtimeApis) ? runtimeApis.length : 0,
        },
      })
    }

    const identifiedContactKey = getIdentifiedContactKey(
      currentContext,
      runtimeState.prelude.normalizedExternalIdentifier,
    )
    const importedHistory =
      identifiedContactKey
        ? await (options.listRecentMessagesByExternalIdentifier ?? listRecentMessagesByExternalIdentifier)({
            identificadorExterno: identifiedContactKey,
            projetoId: runtimeState.resolved?.projeto?.id ?? null,
            agenteId: runtimeState.resolved?.agente?.id ?? null,
            excludeChatId: runtimeState.session.chat.id,
            limit: 18,
          })
        : []
    const importedHistorySummary = buildImportedHistorySummary(importedHistory)
    let agendaSlots = []
    try {
      agendaSlots =
        runtimeState.resolved?.projeto?.id
          ? await (options.listPublicAgendaAvailability ?? listPublicAgendaAvailability)({
              projetoId: runtimeState.resolved.projeto.id,
              agenteId: runtimeState.resolved?.agente?.id ?? null,
            })
          : []
    } catch {}
    const aiContext = mergeContext(
      currentContext,
      isPlainObject(runtimeState.prelude.effectiveBody.context) ? runtimeState.prelude.effectiveBody.context : null,
      runtimeApis.length ? { runtimeApis } : null,
      agendaSlots.length
        ? {
            agenda: {
              horariosDisponiveis: agendaSlots.slice(0, 12).map(formatAgendaSlotForContext),
              reservaApi: "POST /api/agenda",
              exigeContato: true,
            },
          }
        : null,
      importedHistorySummary
        ? {
            memoria: {
              ...(isPlainObject(currentContext?.memoria) ? currentContext.memoria : {}),
              historicoIdentificado: importedHistorySummary,
            },
            usuarioIdentificado: {
              chave: identifiedContactKey,
              historicoImportado: true,
              mensagensImportadas: importedHistory.length,
            },
          }
        : null,
    )
    runtimeState.agendaSlots = agendaSlots

    const agendaSkillResult = await resolveAgendaReservationSkill({
      message: runtimeState.prelude.message,
      aiContext,
      agendaSlots,
      runtimeState,
      options,
    })

    const aiResult =
      agendaSkillResult ??
      (await executeSalesOrchestrator(
        runtimeState.history.map((item) => ({
          role: item.role,
          content: item.conteudo,
        })),
        aiContext,
        options
      ))

    const escalationState = await applyAiHumanEscalation(runtimeState, aiResult, options)
    const effectiveAiResult = escalationState.aiResult ?? aiResult

    await recordChatRuntimeEvent(runtimeState, {
      type: effectiveAiResult?.metadata?.provider === "openai" ? "openai_event" : "chat_runtime_event",
      origin: effectiveAiResult?.metadata?.provider === "openai" ? "openai" : "chat_runtime",
      level: "info",
      description:
        effectiveAiResult?.metadata?.provider === "openai"
          ? "Resposta gerada via OpenAI."
          : "Resposta gerada pelo runtime local.",
      payload: {
        provider: effectiveAiResult?.metadata?.provider ?? null,
        model: effectiveAiResult?.metadata?.model ?? null,
        routeStage: effectiveAiResult?.metadata?.routeStage ?? null,
        heuristicStage: effectiveAiResult?.metadata?.heuristicStage ?? null,
        domainStage: effectiveAiResult?.metadata?.domainStage ?? null,
        catalogDiagnostics: effectiveAiResult?.metadata?.catalogDiagnostics ?? null,
        inputTokens: effectiveAiResult?.usage?.inputTokens ?? 0,
        outputTokens: effectiveAiResult?.usage?.outputTokens ?? 0,
        handoffDecision: escalationState?.handoffDecision?.decision ?? null,
        handoffRequested: escalationState?.handoffRequested ?? false,
      },
    })

    const finalResult = await finalizeV2AiTurn(runtimeState, effectiveAiResult, options)

    await recordChatRuntimeEvent(runtimeState, {
      type: "chat_runtime_event",
      origin: "chat_runtime",
      level: "info",
      description: "Turno da assistente persistido com sucesso.",
      payload: {
        finalReplyHasAssets: Array.isArray(finalResult.assets) && finalResult.assets.length > 0,
        messageSequenceCount: Array.isArray(finalResult.messageSequence) ? finalResult.messageSequence.length : 0,
      },
    })

    return attachRuntimeDiagnostics(finalResult, runtimeState, {
      aiResult: escalationState.aiResult,
      runtimeApis,
      handoffDecision: escalationState?.handoffDecision ?? null,
      handoffRequested: escalationState?.handoffRequested === true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna no runtime do chat."
    const lowered = message.toLowerCase()

    await recordChatRuntimeEvent(runtimeState, {
      type:
        lowered.includes("openai")
          ? "openai_error"
          : lowered.includes("api")
            ? "api_runtime_error"
            : "chat_runtime_error",
      origin: lowered.includes("openai") ? "openai" : "chat_runtime",
      level: "error",
      description: message,
      payload: {
        errorSource: lowered.includes("openai")
          ? "openai"
          : lowered.includes("api")
            ? "api_runtime"
            : "runtime",
      },
    })

    throw error
  }
}

export async function processAdminConversationChat(input) {
  return processChatRequest({
    message: input.texto,
    canal: "web",
    identificadorExterno: input.conversationId,
    source: "admin_attendance_v2",
  })
}
