import { getAgenteAtivo, getAgenteById, getAgenteByIdentifier } from "@/lib/agentes"
import { loadAgentRuntimeApis } from "@/lib/apis"
import { getChatAttachmentsMetadata, uploadChatAttachmentPayloads } from "@/lib/chat-attachments"
import { buildChatUsageTelemetry } from "@/lib/chat-usage-metrics"
import {
  appendOptionalHumanOffer,
  buildHumanHandoffReply,
  classifyHumanEscalationNeed,
  isHumanHandoffIntent,
} from "@/lib/chat/handoff-policy"
import { enrichLeadContext, executeSalesOrchestrator } from "@/lib/chat/orchestrator"
import { shouldRefreshSummary, summarizeConversation } from "@/lib/chat/summary-stage"
import {
  getChatHandoffByChatId,
  isHumanHandoffExpired,
  releaseHumanHandoff,
  requestHumanHandoff,
  shouldPauseAssistantForHandoff,
} from "@/lib/chat-handoffs"
import { appendMessage, createChat, findActiveChatByChannel, findActiveWhatsAppChatByPhone, getChatById, listChatMessages, updateChatContext, updateChatStats } from "@/lib/chats"
import { getChatWidgetByProjetoAgente, getChatWidgetBySlug } from "@/lib/chat-widgets"
import { createLogEntry } from "@/lib/logs"
import { estimateOpenAICostUsd } from "@/lib/openai-pricing"
import { getProjetoById, getProjetoByIdentifier } from "@/lib/projetos"
import { getConfiguredWhatsAppDestination } from "@/lib/chat/whatsapp-availability"
import { listActiveHandoffRecipientsByProjectId } from "@/lib/whatsapp-handoff-contatos"
import { getActiveWhatsAppChannelByProjectAgent, sendWhatsAppTextMessage } from "@/lib/whatsapp-channels"

function sanitizePhone(phone) {
  return String(phone || "").replace(/\D/g, "")
}

function normalizeInboundPhoneCandidate(value) {
  const raw = String(value || "").trim()
  if (!raw || raw.includes("@")) {
    return null
  }

  const digits = raw.replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 13) {
    return null
  }

  return digits
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function buildRuntimeLogContext(runtimeState, extra = {}) {
  return {
    projetoId: runtimeState?.resolved?.projeto?.id ?? runtimeState?.session?.chat?.projetoId ?? null,
    agenteId: runtimeState?.resolved?.agente?.id ?? runtimeState?.session?.chat?.agenteId ?? null,
    projectSlug: runtimeState?.resolved?.projeto?.slug ?? null,
    agentName: runtimeState?.resolved?.agente?.nome ?? null,
    widgetSlug: runtimeState?.resolved?.widget?.slug ?? null,
    channelKind: runtimeState?.prelude?.channelKind ?? null,
    chatId: runtimeState?.session?.chat?.id ?? null,
    stage: runtimeState?.stage ?? null,
    ...extra,
  }
}

async function recordChatRuntimeEvent(runtimeState, input = {}) {
  const payload = buildRuntimeLogContext(runtimeState, input.payload ?? {})
  return createLogEntry({
    projectId: payload.projetoId,
    type: input.type ?? "chat_runtime_event",
    origin: input.origin ?? "chat_runtime",
    level: input.level ?? "info",
    description: input.description ?? "Evento interno do runtime do chat.",
    payload,
  })
}

export function getWhatsAppContactNameFromContext(context) {
  if (!isPlainObject(context?.whatsapp)) {
    return null
  }

  const value = context.whatsapp.contactName
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getWhatsAppContactPhoneFromContext(context) {
  if (!isPlainObject(context?.lead) && !isPlainObject(context?.whatsapp)) {
    return null
  }

  const leadPhone = isPlainObject(context?.lead) ? context.lead.telefone : null
  const normalizedLeadPhone = normalizeInboundPhoneCandidate(typeof leadPhone === "string" ? leadPhone : null)
  if (normalizedLeadPhone) {
    return normalizedLeadPhone
  }

  if (!isPlainObject(context?.whatsapp)) {
    return null
  }

  const remotePhone = context.whatsapp.remotePhone
  const normalizedRemotePhone = normalizeInboundPhoneCandidate(typeof remotePhone === "string" ? remotePhone : null)
  if (normalizedRemotePhone) {
    return normalizedRemotePhone
  }

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null
  const rawContactNumber = rawContact?.number
  const normalizedRawContactNumber = normalizeInboundPhoneCandidate(
    typeof rawContactNumber === "string" ? rawContactNumber : null
  )
  if (normalizedRawContactNumber) {
    return normalizedRawContactNumber
  }

  const senderPhone = context.whatsapp.remetente
  return normalizeInboundPhoneCandidate(typeof senderPhone === "string" ? senderPhone : null)
}

export function getWhatsAppContactAvatarFromContext(context) {
  if (!isPlainObject(context?.whatsapp)) {
    return null
  }

  const value = context.whatsapp.profilePicUrl
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null
  const fallbackValue = rawContact?.profilePicUrl
  return typeof fallbackValue === "string" && fallbackValue.trim() ? fallbackValue.trim() : null
}

export function resolveChatContactSnapshot(context, fallbackExternalIdentifier) {
  return {
    contatoNome: getWhatsAppContactNameFromContext(context),
    contatoTelefone: getWhatsAppContactPhoneFromContext(context) ?? normalizeInboundPhoneCandidate(fallbackExternalIdentifier),
    contatoAvatarUrl: getWhatsAppContactAvatarFromContext(context),
  }
}

export function mergeContext(base, extra) {
  if (!extra) {
    return base
  }

  return {
    ...base,
    ...extra,
  }
}

export function parseAssetPrice(value) {
  if (typeof value !== "string") {
    return null
  }

  const numeric = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")
  const parsed = Number(numeric)
  return Number.isFinite(parsed) ? parsed : null
}

export function extractRecentMercadoLivreProductsFromAssets(assets) {
  if (!Array.isArray(assets)) {
    return []
  }

  return assets
    .filter(
      (asset) =>
        isPlainObject(asset) &&
        typeof asset.id === "string" &&
        (asset.id.startsWith("mercado-livre-") || /^MLB\d+$/i.test(asset.id))
    )
    .map((asset, index) => ({
      id: typeof asset.id === "string" ? asset.id : null,
      nome: typeof asset.nome === "string" ? asset.nome : null,
      descricao: typeof asset.descricao === "string" ? asset.descricao : null,
      preco: parseAssetPrice(asset.descricao),
      link: typeof asset.targetUrl === "string" ? asset.targetUrl : null,
      imagem: typeof asset.publicUrl === "string" ? asset.publicUrl : null,
      cardIndex: index,
    }))
    .filter((asset) => asset.nome)
}

function formatWhatsAppOutboundTextSafe(reply) {
  return String(reply || "")
    .replace(/\r\n/g, "\n")
    .replace(/([.!?])\s+(?=[A-Z0-9*])/g, "$1\n\n")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/^[\-\*]\s+/gm, "- ")
    .replace(/^(\d+)\)\s+/gm, "$1. ")
    .replace(/^([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF0-9\s]{1,28}):\s*/gm, (match, label) => {
      const normalizedLabel = String(label || "").trim().toLowerCase()
      if (["http", "https", "www"].includes(normalizedLabel)) {
        return match
      }

      return `*${String(label || "").trim()}:* `
    })
    .replace(/:\s+(?=(?:\d+\.|\*[A-Z0-9]))/g, ":\n")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripAssistantMetaArtifacts(reply) {
  let sanitized = String(reply || "")

  const forbiddenPatterns = [
    /Seu atendimento acontece exclusivamente via WhatsApp[^\n]*?/gi,
    /Seu atendimento ocorre exclusivamente via WhatsApp[^\n]*?/gi,
    /de forma natural,\s*simp(?:a|\u00E1)t(?:i|\u00ED)ca e acolhedora[^\n]*?/gi,
    /de forma natural,\s*simpat(?:i|\u00ED)ca e acolhedora[^\n]*?/gi,
    /de forma natural[^\n]*?acolhedora[^\n]*?/gi,
    /como se fosse uma pessoa real atendendo[^\n]*?/gi,
    /voce esta falando com (uma )?ia[^\n]*?/gi,
    /minha funcao aqui e te atender[^\n]*?/gi,
  ]

  for (const pattern of forbiddenPatterns) {
    sanitized = sanitized.replace(pattern, "")
  }

  return sanitized
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([.!?])\s+(?=[A-Z0-9*])/g, "$1\n\n")
    .replace(/^([A-Za-z0-9][A-Za-z0-9\s]{1,28}):\s*/gm, "$1:\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripAssistantMetaReply(reply, channelKind) {
  const sanitized = stripAssistantMetaArtifacts(reply)
  return channelKind === "whatsapp" ? formatWhatsAppOutboundTextSafe(sanitized) : sanitized
}

function preserveStructuredWhitespace(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/\s+\./g, ".").replace(/\s+,/g, ",").replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
}

function normalizeStructuredCustomerReply(reply) {
  const lines = preserveStructuredWhitespace(reply)
    .replace(/(^|\n)\s*(\d+)\.\s*\n+(?=\S)/g, "$1$2. ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")

  return lines
    .map((rawLine) => {
      const line = String(rawLine || "").trim()
      if (!line) {
        return ""
      }

      if (/^(https?:\/\/|www\.)/i.test(line)) {
        return line
      }

      const bareLabelMatch = line.match(/^([A-Za-z\u00C0-\u00FF$][A-Za-z\u00C0-\u00FF0-9\s/_-]{1,40}:)\s*$/)
      if (bareLabelMatch) {
        return `**${bareLabelMatch[1]}**`
      }

      const inlineLabelMatch = line.match(/^([A-Za-z\u00C0-\u00FF$][A-Za-z\u00C0-\u00FF0-9\s/_-]{1,40}:)\s+(.+)$/)
      if (inlineLabelMatch) {
        return `**${inlineLabelMatch[1]}** ${inlineLabelMatch[2].trim()}`
      }

      const numberedLabelMatch = line.match(/^(\d+\.)\s+([A-Za-z\u00C0-\u00FF$][A-Za-z\u00C0-\u00FF0-9\s/_-]{1,40}:)\s+(.+)$/)
      if (numberedLabelMatch) {
        return `${numberedLabelMatch[1]} **${numberedLabelMatch[2]}** ${numberedLabelMatch[3].trim()}`
      }

      return line
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatContinuationSummary(rawSummary) {
  const summaryText = String(rawSummary || "").trim()
  if (!summaryText) {
    return ""
  }

  try {
    const parsed = JSON.parse(summaryText)
    const snippets = []
    const objetivo = typeof parsed.objetivo === "string" ? parsed.objetivo.trim() : ""
    const proximoPasso = typeof parsed.proximo_passo === "string" ? parsed.proximo_passo.trim() : ""
    const restricoes = typeof parsed.restricoes === "string" ? parsed.restricoes.trim() : ""
    const dorPrincipal = typeof parsed.dor_principal === "string" ? parsed.dor_principal.trim() : ""

    if (objetivo) snippets.push(`objetivo: ${objetivo}`)
    if (dorPrincipal) snippets.push(`dor: ${dorPrincipal}`)
    if (restricoes) snippets.push(`pontos de atencao: ${restricoes}`)
    if (proximoPasso) snippets.push(`proximo passo: ${proximoPasso}`)

    const compact = snippets.join(" | ").trim()
    if (compact) {
      return compact.slice(0, 280)
    }
  } catch {
    // fallback para texto livre
  }

  return summaryText.replace(/\s+/g, " ").trim().slice(0, 280)
}

export function resolveCanonicalWhatsAppExternalIdentifier(input) {
  const contextPhone = getWhatsAppContactPhoneFromContext(input.context)
  if (contextPhone) {
    return contextPhone
  }

  const normalizedExternal = normalizeInboundPhoneCandidate(input.identificadorExterno)
  if (normalizedExternal) {
    return normalizedExternal
  }

  const normalizedFallback = normalizeInboundPhoneCandidate(input.identificador)
  if (normalizedFallback) {
    return normalizedFallback
  }

  return sanitizePhone(input.identificadorExterno ?? input.identificador)
}

export function formatWhatsAppHumanOutboundText(reply) {
  return formatWhatsAppOutboundTextSafe(reply)
}

export function sanitizeWhatsAppCustomerFacingReply(reply) {
  let sanitized = stripAssistantMetaArtifacts(reply)

  const promisePatterns = [
    /\b(?:deixa|deixe)\s+eu\s+(?:ver|verificar|consultar|olhar)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:eu\s+)?vou\s+(?:ver|verificar|consultar|olhar)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:eu\s+)?ja\s+(?:vejo|verifico|consulto|olho)\b[^.!?\n]*[.!?]?/gi,
    /\b(?:posso|consigo)\s+(?:ver|verificar|consultar|olhar)\s+(?:o\s+)?status\b[^.!?\n]*[.!?]?/gi,
  ]

  for (const pattern of promisePatterns) {
    sanitized = sanitized.replace(pattern, " ")
  }

  return preserveStructuredWhitespace(sanitized)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function buildWhatsAppMessageSequence(reply, assets, followUpReply) {
  const messages = []
  const intro = formatWhatsAppOutboundTextSafe(reply)
  if (intro) {
    messages.push(intro)
  }

  const assetMessages = Array.isArray(assets)
    ? assets
        .slice(0, 3)
        .map((asset, index) => {
          if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
            return ""
          }

          const nome = "nome" in asset ? String(asset.nome || "").trim() : ""
          const targetUrl = "targetUrl" in asset ? String(asset.targetUrl || "").trim() : ""
          const whatsappText = "whatsappText" in asset ? String(asset.whatsappText || "").trim() : ""
          const descricao = "descricao" in asset ? String(asset.descricao || "").trim() : ""
          const supportText = whatsappText || descricao

          if (!targetUrl && !supportText) {
            return ""
          }

          const parts = [formatWhatsAppOutboundTextSafe(`*${index + 1}. ${nome || "Produto"}*`)]
          if (supportText) {
            parts.push(formatWhatsAppOutboundTextSafe(supportText))
          }
          if (targetUrl) {
            parts.push(targetUrl)
          }

          return parts.join("\n").trim()
        })
        .filter(Boolean)
    : []

  if (followUpReply && String(followUpReply).trim()) {
    messages.push(formatWhatsAppOutboundTextSafe(followUpReply))
  }

  return [...messages, ...assetMessages]
}

export function buildSilentChatResult(chatId) {
  return {
    chatId: chatId ?? "",
    reply: "",
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
  }
}

export function buildBillingBlockedResult(chatId, message) {
  return {
    chatId: chatId ?? "",
    reply: String(message || "").trim(),
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
  }
}

export function buildIsolatedChatResult(body, message) {
  const chatId =
    body?.chatId?.trim() ||
    body?.identificadorExterno?.trim() ||
    body?.identificador?.trim() ||
    "isolated-chat"
  const sanitizedMessage = String(message || "").replace(/\s+/g, " ").trim()
  const reply = sanitizedMessage
    ? `Recebi sua mensagem: "${sanitizedMessage}". O chat esta rodando em modo isolado, sem Supabase, WhatsApp ou handoff.`
    : "O chat esta rodando em modo isolado, sem Supabase, WhatsApp ou handoff."

  return {
    chatId,
    reply,
    followUpReply: "",
    messageSequence: [],
    assets: [],
    whatsapp: null,
  }
}

export function isCatalogSearchMessage(message) {
  const latestNormalizedMessage = String(message || "").toLowerCase()
  const catalogSignals = ["tem ", "produto", "produtos", "catalogo", "loja", "vende", "procuro", "estou procurando"]

  return catalogSignals.some((signal) => latestNormalizedMessage.includes(signal)) || /^\s*e\s+\S+/i.test(message)
}

export function isCatalogLoadMoreMessage(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return false
  }

  if (["mais", "outras", "outros", "mais opcoes", "outras opcoes", "mais modelos", "outros modelos"].includes(normalized)) {
    return true
  }

  return [
    /\btem mais\b/,
    /\bquero mais\b/,
    /\bme mostra mais\b/,
    /\bmostra mais\b/,
    /\btraz mais\b/,
    /\bmanda mais\b/,
    /\bver mais\b/,
    /\boutras opcoes\b/,
    /\boutros modelos\b/,
    /\bmais modelos\b/,
    /\bmais opcoes\b/,
  ].some((pattern) => pattern.test(normalized))
}

export function splitCatalogReplyForWhatsApp(reply, hasAssets) {
  const normalizedReply = String(reply || "").trim()
  if (!hasAssets || !normalizedReply) {
    return {
      mainReply: normalizedReply,
      followUpReply: "",
    }
  }

  const followUpPatterns = [
    /Me diga se gostou de algum ou se quer que eu traga mais opcoes parecidas\.?/i,
    /Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo\.?/i,
    /Se gostar desse estilo, eu posso te mostrar outras opcoes parecidas tambem\.?/i,
    /Se gostar desse estilo, eu posso te trazer outras opcoes parecidas tambem\.?/i,
    /Se quiser, eu tambem posso buscar outras opcoes parecidas ou seguir com este item por aqui\.?/i,
  ]

  const matchedPattern = followUpPatterns.find((pattern) => pattern.test(normalizedReply))
  if (!matchedPattern) {
    return {
      mainReply: normalizedReply,
      followUpReply: "",
    }
  }

  const followUpReply = normalizedReply.match(matchedPattern)?.[0]?.trim() ?? ""
  const mainReply = normalizedReply.replace(matchedPattern, "").replace(/\n{3,}/g, "\n\n").trim()

  return {
    mainReply: mainReply || normalizedReply,
    followUpReply,
  }
}

export function buildContinuationMessage(input) {
  const resumoLimpo = formatContinuationSummary(input.resumo)
  const produtoAtual = String(input.produtoAtual || "").trim()
  const ultimaMensagem = String(input.ultimaMensagem || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220)

  return [
    `Ola! Vim do chat do site${input.projetoNome ? ` do projeto ${input.projetoNome}` : ""}.`,
    input.agenteNome ? `Agente de referencia: ${input.agenteNome}.` : "",
    produtoAtual ? `Produto em foco: ${produtoAtual}.` : "",
    resumoLimpo ? `Resumo para continuidade: ${resumoLimpo}` : "",
    ultimaMensagem ? `Ultima mensagem do cliente: ${ultimaMensagem}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim()
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
    catalogo: isPlainObject(mergedCurrentContext.catalogo) ? { ...mergedCurrentContext.catalogo } : {},
  }

  if (!nextContext.lead?.telefone && input.history.length >= 2 && input.history.length < 6) {
    nextContext.qualificacao = {
      ...nextContext.qualificacao,
      pronto_para_whatsapp: false,
    }
  }

  if (isCatalogSearchMessage(input.message)) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimaBusca: input.message.trim(),
      produtoAtual: null,
      ultimosProdutos: [],
      snapshotId: null,
      snapshotCreatedAt: null,
      snapshotTurnId: null,
    }
  }

  return nextContext
}

export function updateContextFromAiResult(input) {
  const nextContext = {
    ...input.nextContext,
    catalogo: isPlainObject(input.nextContext?.catalogo) ? { ...input.nextContext.catalogo } : {},
  }

  const recentMercadoLivreProducts = extractRecentMercadoLivreProductsFromAssets(input.ai.assets)
  if (recentMercadoLivreProducts.length) {
    const snapshotCreatedAt = new Date().toISOString()
    const snapshotTurnId = Number(input.historyLengthSource ?? 0)
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      ultimosProdutos: recentMercadoLivreProducts,
      snapshotId: `${input.chatId}:${snapshotTurnId}:${snapshotCreatedAt}`,
      snapshotCreatedAt,
      snapshotTurnId,
    }
  }

  const metadataCatalogProduct =
    isPlainObject(input.ai.metadata) && "catalogoProdutoAtual" in input.ai.metadata
      ? input.ai.metadata.catalogoProdutoAtual
      : null

  if (isPlainObject(metadataCatalogProduct)) {
    nextContext.catalogo = {
      ...(isPlainObject(nextContext.catalogo) ? nextContext.catalogo : {}),
      produtoAtual: metadataCatalogProduct,
    }
  }

  return nextContext
}

function normalizeWhatsAppDestination(value) {
  const digits = sanitizePhone(value)
  if (!digits) {
    return null
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return digits
  }

  if (digits.length === 11) {
    return `55${digits}`
  }

  return digits.length >= 10 ? digits : null
}

function shouldAttachWhatsAppCta(reply) {
  const normalized = String(reply || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  return (
    /\bwhatsapp\b/.test(normalized) ||
    /wa\.me|api\.whatsapp\.com/i.test(normalized) ||
    /\bmeu numero\b|\bmeu telefone\b|\bchama\b|\bfalar por la\b|\bcontinuar por la\b/i.test(normalized) ||
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(String(reply || ""))
  )
}

function buildWhatsAppContinuationCta(input = {}) {
  if (input.nextContext?.whatsapp?.ctaEnabled !== true) {
    return null
  }

  const destination = normalizeWhatsAppDestination(getConfiguredWhatsAppDestination(input.nextContext))
  if (!destination || !shouldAttachWhatsAppCta(`${input.reply || ""}\n${input.followUpReply || ""}`)) {
    return null
  }

  return {
    label: "Continuar no WhatsApp",
    url: `https://wa.me/${destination}`,
  }
}

function sanitizeReplyForWhatsAppCta(reply, label = "Continuar no WhatsApp") {
  const sanitized = String(reply || "")
    .replace(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^\s)]+/gi, "")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
    .replace(/(?:meu|nosso)\s+(?:numero|telefone)\s+(?:e|é)\s*[:\-]?\s*/gi, "")
    .replace(/(?:me chama|pode me chamar|pode falar comigo)\s+no\s+whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/(?:se quiser|se preferir)\s+mais\s+detalhes[^.!?\n]*whatsapp[^.!?\n]*[.!?]?/gi, "")
    .replace(/\s+\./g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!sanitized) {
    return `Se preferir, clique em "${label}".`
  }

  return sanitized
}

export function prepareAiReplyPayload(input) {
  const splitReply =
    input.channelKind === "whatsapp"
      ? null
      : splitCatalogReplyForWhatsApp(input.ai.reply, Array.isArray(input.ai.assets) && input.ai.assets.length > 0)

  const primaryReplyRaw = splitReply?.mainReply || input.ai.reply
  const followUpReplyRaw = input.channelKind === "whatsapp" ? "" : splitReply?.followUpReply || ""
  const primaryReplyBase = stripAssistantMetaReply(primaryReplyRaw, input.channelKind)
  const followUpReplyBase = stripAssistantMetaReply(followUpReplyRaw, input.channelKind)
  const normalizedPrimaryReplyBase = normalizeStructuredCustomerReply(primaryReplyBase)
  const normalizedFollowUpReplyBase = normalizeStructuredCustomerReply(followUpReplyBase)
  const primaryReply =
    input.channelKind === "whatsapp"
      ? sanitizeWhatsAppCustomerFacingReply(normalizedPrimaryReplyBase)
      : normalizedPrimaryReplyBase
  const followUpReply =
    input.channelKind === "whatsapp"
      ? sanitizeWhatsAppCustomerFacingReply(normalizedFollowUpReplyBase)
      : normalizedFollowUpReplyBase
  const whatsappCta =
    input.channelKind === "whatsapp"
      ? null
      : buildWhatsAppContinuationCta({
          nextContext: input.nextContext,
          reply: primaryReply,
          followUpReply,
        })
  const normalizedPrimaryReply =
    whatsappCta ? sanitizeReplyForWhatsAppCta(primaryReply, whatsappCta.label) : primaryReply
  const normalizedFollowUpReply =
    whatsappCta ? sanitizeReplyForWhatsAppCta(followUpReply, whatsappCta.label) : followUpReply
  const whatsappEmbeddedSequence =
    input.channelKind === "whatsapp" ? buildWhatsAppMessageSequence(normalizedPrimaryReply, input.ai.assets ?? [], null) : []

  return {
    primaryReply: normalizedPrimaryReply,
    followUpReply: normalizedFollowUpReply,
    whatsappEmbeddedSequence,
    whatsappEmbeddedMessage: whatsappEmbeddedSequence[0] ?? "",
    whatsappCta,
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
  const getWidgetBySlug = deps.getChatWidgetBySlug ?? getChatWidgetBySlug
  const getWidgetByProjetoAgente = deps.getChatWidgetByProjetoAgente ?? getChatWidgetByProjetoAgente
  const getProjetoByIdResolver = deps.getProjetoById ?? getProjetoById
  const getAgenteByIdResolver = deps.getAgenteById ?? getAgenteById
  const getActiveWhatsAppChannel = deps.getActiveWhatsAppChannelByProjectAgent ?? getActiveWhatsAppChannelByProjectAgent

  if (projetoIdentifier) {
    const projeto = await getProjeto(projetoIdentifier)
    let agente = agenteIdentifier ? await getAgente(agenteIdentifier, projeto?.id ?? null) : null

    if (agente && (!agente.ativo || agente.projetoId !== projeto?.id)) {
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

  const widgetSlug = typeof body?.widgetSlug === "string" && body.widgetSlug.trim() ? body.widgetSlug.trim() : null
  if (!widgetSlug) {
    return {
      projeto: null,
      agente: null,
      widget: null,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        widgetSlug: null,
        identificador_externo: body?.identificadorExterno?.trim() || null,
      },
    }
  }

  const widget = await getWidgetBySlug(widgetSlug)

  if (!widget?.projetoId || !widget?.agenteId || widget.ativo === false) {
    return {
      projeto: null,
      agente: null,
      widget: null,
      lockedToAgent: true,
      channel: {
        kind: channelKind,
        widgetSlug,
        identificador_externo: body?.identificadorExterno?.trim() || null,
      },
    }
  }

  const projeto = await getProjetoByIdResolver(widget.projetoId)
  const widgetAgent = projeto ? await getAgenteByIdResolver(widget.agenteId) : null
  const agente = widgetAgent && widgetAgent.ativo && widgetAgent.projetoId === projeto?.id ? widgetAgent : null
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
      widgetSlug,
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

  return {
    ...(isPlainObject(input.extraContext) ? input.extraContext : {}),
    projeto: input.resolved?.projeto
      ? {
          id: input.resolved.projeto.id,
          nome: input.resolved.projeto.nome ?? null,
          slug: input.resolved.projeto.slug ?? null,
        }
      : null,
    agente: input.resolved?.agente
      ? {
          id: input.resolved.agente.id,
          nome: input.resolved.agente.nome ?? null,
          slug: input.resolved.agente.slug ?? null,
          descricao: input.resolved.agente.descricao ?? null,
          promptBase: input.resolved.agente.promptBase ?? null,
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

export function buildUserMessageMetadata(input) {
  return {
    source: input.source?.trim() || (input.channelKind === "whatsapp" ? "whatsapp_bridge" : "site_widget"),
    ...(Array.isArray(input.attachments) && input.attachments.length ? { attachments: input.attachments } : {}),
  }
}

export function buildAssistantMessageMetadata(input) {
  return {
    ...(isPlainObject(input.aiMetadata) ? input.aiMetadata : {}),
    ...(input.usageTelemetry ? { usageTelemetry: input.usageTelemetry } : {}),
    assets: Array.isArray(input.assets) ? input.assets : [],
    ...(input.followUpReply ? { followUpReply: true } : {}),
  }
}

export async function persistUserTurn(input, deps = {}) {
  const appendChatMessage = deps.appendMessage ?? appendMessage
  const userMessage = await appendChatMessage({
    chatId: input.chatId,
    role: "user",
    conteudo: input.message || "Midia recebida pelo WhatsApp.",
    canal: input.channelKind,
    identificadorExterno: input.normalizedExternalIdentifier,
    metadata: buildUserMessageMetadata({
      source: input.source,
      channelKind: input.channelKind,
      attachments: input.attachments,
    }),
  })

  if (!userMessage) {
    throw new Error("Nao foi possivel gravar a mensagem do cliente. Verifique permissoes na tabela `mensagens`.")
  }

  return userMessage
}

export async function loadChatHistory(chatId, deps = {}) {
  const listMessages = deps.listChatMessages ?? listChatMessages
  return listMessages(chatId)
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
      followUpReply: input.followUpReply,
    }),
  })

  if (!assistantMessage) {
    throw new Error("O modelo respondeu, mas nao foi possivel salvar a resposta no banco.")
  }

  return assistantMessage
}

export async function persistAssistantState(input, deps = {}) {
  const saveChatContext = deps.updateChatContext ?? updateChatContext
  const saveChatStats = deps.updateChatStats ?? updateChatStats

  await saveChatContext(input.chatId, input.nextContext)
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

export async function applyBillingGuardrail(input, deps = {}) {
  const verifyBilling = deps.verificarLimite ?? (async () => null)
  const billingAccess = input.projetoId ? await verifyBilling(input.projetoId) : null

  if (billingAccess && billingAccess.allowed === false) {
    return {
      blocked: true,
      billingAccess,
      result: buildBillingBlockedResult(
        input.chatId,
        billingAccess.message ??
          "O limite mensal deste projeto foi atingido. Fale com o administrador para liberar novo ciclo ou ajustar o plano."
      ),
    }
  }

  return {
    blocked: false,
    billingAccess,
    result: null,
  }
}

export async function applyHandoffGuardrail(input, deps = {}) {
  const loadChatHandoff = deps.getChatHandoffByChatId ?? getChatHandoffByChatId
  const releaseHandoff = deps.releaseHumanHandoff ?? releaseHumanHandoff
  const currentHandoff = await loadChatHandoff(input.chatId)

  if (isHumanHandoffExpired(currentHandoff)) {
    const releasedHandoff = await releaseHandoff({
      chatId: input.chatId,
      usuarioId: null,
      autoReleased: true,
    })

    return {
      paused: false,
      handoff: releasedHandoff ?? currentHandoff,
      result: null,
    }
  }

  if (shouldPauseAssistantForHandoff(currentHandoff)) {
    return {
      paused: true,
      handoff: currentHandoff,
      result: buildSilentChatResult(input.chatId),
    }
  }

  return {
    paused: false,
    handoff: currentHandoff,
    result: null,
  }
}

export async function requestRuntimeHumanHandoff(input, deps = {}) {
  const requestHandoff = deps.requestHumanHandoff ?? requestHumanHandoff
  const listRecipients = deps.listActiveHandoffRecipientsByProjectId ?? listActiveHandoffRecipientsByProjectId
  const sendMessage = deps.sendWhatsAppTextMessage ?? sendWhatsAppTextMessage
  const loadChatById = deps.getChatById ?? getChatById
  const loadChatMessages = deps.listChatMessages ?? listChatMessages
  const acknowledgement = input.channelKind === "whatsapp"
    ? "Perfeito. Ja acionei um atendente humano para continuar por aqui. Assim que alguem assumir, seguimos neste mesmo WhatsApp."
    : "Perfeito. Ja acionei um atendente humano para continuar por aqui assim que possivel."

  let alertMessage = input.alertMessage ?? null

  if (input.channelKind === "whatsapp" && input.chatId && input.projetoId && input.canalWhatsappId) {
    try {
      const canLoadChatContext = typeof deps.getChatById === "function" || hasSupabaseServerEnv()
      const chat = canLoadChatContext ? await loadChatById(input.chatId) : null
      const recipients = await listRecipients(input.projetoId, {
        canalWhatsappId: input.canalWhatsappId,
      })

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
              channelId: input.canalWhatsappId,
              to: recipient.numero,
              message: alertMessage,
            })
          )
        )
      }
    } catch (error) {
      console.warn("[chat-runtime] failed to build handoff alert context", error)
    }
  }

  const handoff = await requestHandoff({
    chatId: input.chatId,
    projetoId: input.projetoId,
    canalWhatsappId: input.canalWhatsappId ?? null,
    requestedBy: "agent",
    motivo: input.motivo ?? "Cliente pediu atendimento humano.",
    metadata: input.metadata ?? {},
    alertMessage,
  })

  return {
    handoff,
    acknowledgement,
  }
}

export function buildUsagePersistencePayload(input) {
  const provider = typeof input.aiMetadata?.provider === "string" ? input.aiMetadata.provider : null
  const model = typeof input.aiMetadata?.model === "string" ? input.aiMetadata.model : null
  const estimatedCostUsd =
    provider === "openai"
      ? estimateOpenAICostUsd(input.inputTokens, input.outputTokens, model)
      : 0
  const usageTelemetry = buildChatUsageTelemetry({
    channelKind: input.channelKind,
    provider,
    model,
    routeStage: typeof input.aiMetadata?.routeStage === "string" ? input.aiMetadata.routeStage : null,
    heuristicStage: typeof input.aiMetadata?.heuristicStage === "string" ? input.aiMetadata.heuristicStage : null,
    domainStage:
      typeof input.aiMetadata?.domainStage === "string"
        ? input.aiMetadata.domainStage
        : typeof input.aiMetadata?.debugRequest?.domainStage === "string"
          ? input.aiMetadata.debugRequest.domainStage
          : null,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd,
  })

  return {
    estimatedCostUsd,
    usageTelemetry,
    usageRecord: {
      projetoId: input.projetoId,
      tokens: Number(input.inputTokens ?? 0) + Number(input.outputTokens ?? 0),
      custo: estimatedCostUsd,
      details: {
        tokensInput: Number(input.inputTokens ?? 0),
        tokensOutput: Number(input.outputTokens ?? 0),
        usuarioId: input.usuarioId ?? null,
        origem: usageTelemetry.billingOrigin,
        referenciaId: input.referenciaId ?? null,
      },
    },
  }
}

export async function persistUsageRecord(input, deps = {}) {
  const registerUsage = deps.registrarUso ?? (async () => null)
  if (!input?.projetoId) {
    return null
  }

  return registerUsage(input.projetoId, input.tokens, input.custo, input.details)
}

export function buildFinalChatResult(input) {
  return {
    chatId: input.chatId,
    reply: input.reply,
    followUpReply: input.channelKind === "whatsapp" ? "" : input.followUpReply || "",
    messageSequence: input.channelKind === "whatsapp" ? input.messageSequence ?? [] : [],
    assets: input.channelKind === "whatsapp" ? [] : input.assets ?? [],
    whatsapp: input.whatsapp ?? null,
    handoff: input.handoff ?? null,
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

export function isSavedWhatsAppContact(context) {
  if (!isPlainObject(context?.whatsapp)) {
    return false
  }

  const explicitFlags = [
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

  const rawContact = isPlainObject(context.whatsapp.rawContact) ? context.whatsapp.rawContact : null
  const contactPhone = normalizeInboundPhoneCandidate(getWhatsAppContactPhoneFromContext(context))
  const pushName = typeof context.whatsapp.pushName === "string" ? context.whatsapp.pushName.trim() : ""
  const candidateNames = [
    rawContact?.name,
    rawContact?.shortName,
    rawContact?.verifiedName,
    context.whatsapp.contactName,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)

  if (!candidateNames.length) {
    return false
  }

  const normalizedPhone = contactPhone ? contactPhone.replace(/\D/g, "") : ""
  const loweredPushName = pushName.toLowerCase()

  return candidateNames.some((name) => {
    const loweredName = name.toLowerCase()
    const normalizedNameDigits = name.replace(/\D/g, "")

    if (!loweredName) {
      return false
    }

    if (normalizedPhone && normalizedNameDigits === normalizedPhone) {
      return false
    }

    if (loweredPushName && loweredName === loweredPushName && normalizedNameDigits) {
      return false
    }

    return true
  })
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
          : replyPayload.primaryReply,
      channelKind: runtimeState.prelude.channelKind,
      normalizedExternalIdentifier: runtimeState.prelude.normalizedExternalIdentifier,
      tokensInput: aiResult?.usage?.inputTokens ?? 0,
      tokensOutput: aiResult?.usage?.outputTokens ?? 0,
      custo: usagePayload.estimatedCostUsd,
      aiMetadata: aiResult?.metadata ?? {},
      usageTelemetry: usagePayload.usageTelemetry,
      assets: aiResult?.assets ?? [],
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
    channelKind: runtimeState.prelude.channelKind,
    reply:
      runtimeState.prelude.channelKind === "whatsapp"
        ? replyPayload.whatsappEmbeddedMessage || replyPayload.primaryReply
        : assistantMessage.conteudo ?? replyPayload.primaryReply,
    followUpReply: replyPayload.followUpReply,
    messageSequence: replyPayload.whatsappEmbeddedSequence,
    assets: aiResult?.assets ?? [],
    whatsapp: replyPayload.whatsappCta,
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
      reply: buildHumanHandoffReply(runtimeState.prelude.channelKind),
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
          status: handoffState.handoff?.status ?? "active_human",
          actionLabel: "Atendimento humano",
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

    const aiContext = mergeContext(
      runtimeState.session.chat.contexto ?? runtimeState.session.initialContext ?? {},
      runtimeApis.length ? { runtimeApis } : null,
    )

    const aiResult = await executeSalesOrchestrator(
      runtimeState.history.map((item) => ({
        role: item.role,
        content: item.conteudo,
      })),
      aiContext,
      options
    )

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
