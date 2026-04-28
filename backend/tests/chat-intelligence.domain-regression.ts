import { loadEnvConfig } from "@next/env"
import assert from "node:assert/strict"

loadEnvConfig(process.cwd())

import {
  buildApiFallbackReply,
  buildFocusedApiContext,
  buildHumanHandoffReply,
  buildLeadNameAcknowledgementReply,
  buildSystemPrompt,
  buildWhatsAppMessageSequence,
  classifyHumanEscalationNeed,
  resolveDeterministicCatalogFollowUpDecision,
  enrichLeadContext,
  isHumanHandoffIntent,
  isLikelyLeadNameReply,
  resolveCanonicalWhatsAppExternalIdentifier,
  resolveChatDomainRoute,
  resolveConversationPipelineStageState,
  resolveRecentCatalogProductReference,
} from "@/tests/chat-source"
import {
  createFixtureSearchDeps,
  loadApiRuntimeFixture,
  loadApiRuntimeRealEstateFixture,
  loadCatalogContextFixture,
  loadHandoffFixture,
  loadLeadContextFixture,
  loadWhatsAppContextFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures"

const deps = createFixtureSearchDeps()
const catalogContext = loadCatalogContextFixture()
const apiFixture = loadApiRuntimeFixture()
const apiRealEstateFixture = loadApiRuntimeRealEstateFixture()
const leadContextFixture = loadLeadContextFixture()
const handoffFixture = loadHandoffFixture()
const whatsappContextFixture = loadWhatsAppContextFixture()

async function main() {
  const strongReference = resolveDeterministicCatalogFollowUpDecision("gostei da sopeira que mandou", catalogContext, deps)
  assert.equal(strongReference?.kind, "recent_product_reference")

  const staleResolved = resolveRecentCatalogProductReference(
    "gostei da sopeira",
    {
      ...catalogContext,
      catalogo: {
        ...catalogContext.catalogo,
        snapshotTurnId: 1,
        snapshotCreatedAt: "2024-01-01T00:00:00.000Z",
      },
    }
  )
  assert.equal(staleResolved.length, 0)

  const apiFocused = buildFocusedApiContext("qual o status do pedido PED-2026-0042", apiFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.ok(apiFocused.fields.length > 0)

  const realEstateValueReply = buildApiFallbackReply("qual o valor do imovel?", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.match(realEstateValueReply ?? "", /valor/i)
  assert.match(realEstateValueReply ?? "", /R\$/i)
  assert.match(realEstateValueReply ?? "", /Contexto util:/i)
  assert.doesNotMatch(realEstateValueReply ?? "", /^descricao:/i)

  const realEstateDateReply = buildApiFallbackReply("me passa a data do leilao", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.match(realEstateDateReply ?? "", /27\/03\/2026/)
  assert.match(realEstateDateReply ?? "", /Contexto util:/i)

  const analyticalReply = buildApiFallbackReply("vale a pena esse imovel?", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.match(analyticalReply ?? "", /Conclusao:/)
  assert.match(analyticalReply ?? "", /Motivos:/)
  assert.match(analyticalReply ?? "", /Proximo passo:/)

  const stage = resolveConversationPipelineStageState({
    leadNameAcknowledgementReply: null,
    hasCatalogReferenceHeuristicReply: false,
    hasMercadoLivreHeuristicReply: false,
    catalogPricingReply: null,
    leadIdentificationReply: null,
    hasValidAgent: true,
    hasOpenAiKey: true,
    hasFocusedApiContext: true,
    latestUserMessage: "qual o valor do imovel?",
    hasMemorySummary: true,
    hasCurrentCatalogContext: false,
    hasMercadoLivreContext: false,
    hasLeadContext: false,
  })
  assert.equal(stage.conversationDomainStage, "api_runtime")
  assert.equal(stage.shouldCallModel, true)

  const storefrontCatalogRoute = resolveChatDomainRoute({
    latestUserMessage: "saleiro",
    context: {
      ...catalogContext,
      ui: {
        catalogPreferred: true,
      },
      conversation: {
        mode: "listing",
      },
      storefront: {
        kind: "mercado_livre",
        pageKind: "storefront",
        storeSlug: "vitoria-rocha-moepftn8-chat",
      },
      projeto: {
        directConnections: {
          mercadoLivre: 1,
        },
      },
    },
    project: {
      directConnections: {
        mercadoLivre: 1,
      },
    },
    history: [],
    runtimeApis: [],
    focusedApiContext: { fields: [] },
  })
  assert.equal(storefrontCatalogRoute.domain, "catalog")
  assert.equal(storefrontCatalogRoute.source, "mercado_livre")
  assert.equal(storefrontCatalogRoute.shouldUseTool, true)

  const productDetailRoute = resolveChatDomainRoute({
    latestUserMessage: "esse tem garantia?",
    context: {
      ...catalogContext,
      ui: {
        catalogPreferred: true,
        productDetailPreferred: true,
      },
      conversation: {
        mode: "product_detail",
      },
      storefront: {
        kind: "mercado_livre",
        pageKind: "product_detail",
        storeSlug: "vitoria-rocha-moepftn8-chat",
        productSlug: "saleiro-de-porcelana",
      },
      catalogo: {
        ...catalogContext.catalogo,
        produtoAtual: {
          id: "MLB9",
          nome: "Saleiro de Porcelana",
          descricao: "Saleiro vintage",
          preco: 180,
          link: "https://example.com/saleiro",
          imagem: "https://example.com/saleiro.jpg",
        },
        ultimosProdutos: [
          {
            id: "MLB9",
            nome: "Saleiro de Porcelana",
            descricao: "Saleiro vintage",
            preco: 180,
            link: "https://example.com/saleiro",
            imagem: "https://example.com/saleiro.jpg",
          },
        ],
      },
      projeto: {
        directConnections: {
          mercadoLivre: 1,
        },
      },
    },
    project: {
      directConnections: {
        mercadoLivre: 1,
      },
    },
    history: [],
    runtimeApis: [],
    focusedApiContext: { fields: [] },
  })
  assert.equal(productDetailRoute.domain, "catalog")
  assert.equal(productDetailRoute.reason, "catalog_product_detail_focus")

  const prompt = buildSystemPrompt(
    {
      id: "agent-1",
      nome: "Assistente de Operacoes",
      promptBase: "Atenda com contexto real do cliente.",
    },
    {
      projeto: { nome: "Projeto Teste" },
      widget: { slug: "teste", whatsapp_celular: "" },
      whatsapp: { numero: "5511999999999", ctaEnabled: true },
      channel: { kind: "web" },
      runtimeApis: apiRealEstateFixture.apis,
    },
    true
  )
  assert.match(prompt, /Responda primeiro a pergunta principal/i)
  assert.match(prompt, /Nunca despeje campo cru/i)

  const history = [
    { role: "assistant", content: "Como posso te chamar?" },
    { role: "user", content: "Carlos" },
  ]
  const isNameReply = isLikelyLeadNameReply("Carlos", history, {
    normalizeText: normalizeFixtureText,
    extractName: (message) => {
      const enriched = enrichLeadContext(leadContextFixture, history, message, {
        normalizeText: normalizeFixtureText,
      })
      return enriched.lead?.nome ?? null
    },
  })
  assert.equal(isNameReply, true)

  const ackReply = buildLeadNameAcknowledgementReply("Carlos", true, leadContextFixture, null, () => true)
  assert.match(ackReply, /Carlos/)

  const explicitIntent = isHumanHandoffIntent(handoffFixture.explicitHumanMessage)
  assert.equal(explicitIntent, true)

  const handoffReply = buildHumanHandoffReply("whatsapp")
  assert.match(handoffReply, /WhatsApp/i)

  const handoffDecision = await classifyHumanEscalationNeed({
    projetoId: null,
    channelKind: "web",
    message: "nao entendi",
    aiReply: "Posso explicar de outro jeito.",
    aiMetadata: { provider: "agent_scoped_recovery" },
    context: leadContextFixture,
    history: handoffFixture.recoveryHistory,
  })
  assert.equal(handoffDecision.decision, "none")

  const canonicalId = resolveCanonicalWhatsAppExternalIdentifier({
    identificadorExterno: "270570709065941@lid",
    identificador: "270570709065941@lid",
    context: whatsappContextFixture,
  })
  assert.equal(canonicalId, "5511978510655")

  const sequence = buildWhatsAppMessageSequence(
    "Encontrei algumas opcoes parecidas. Me diga se gostou de algum ou se quer mais opcoes.",
    (whatsappContextFixture.catalogo?.ultimosProdutos ?? []).map((item) => ({
      nome: item.nome ?? "Produto",
      targetUrl: item.link ?? "",
      descricao: item.descricao ?? "",
      whatsappText: "Se esse estilo fizer sentido para voce, eu explico melhor este item.",
    }))
  )
  assert.equal(sequence.length, 4)
  assert.match(sequence[0] ?? "", /mais opcoes/i)

  console.log("14 domain regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
