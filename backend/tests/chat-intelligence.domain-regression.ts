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
  resolveCatalogIntentState,
  resolveCatalogDecisionState,
  resolveCatalogExecutionState,
  resolveCatalogComparisonDecisionState,
  buildCatalogDecisionFromSemanticIntent,
  buildBillingReplyResult,
  extractDeterministicPricingCatalogFromAgentText,
  resolveMercadoLivreHeuristicState,
  resolveRecentCatalogReferenceDecision,
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
  const infraStudioAgentPrompt = [
    "Projetos sob medida partem de R$ 300,00, tanto para sites quanto para sistemas.",
    "",
    "Planos mensais da plataforma:",
    "",
    "Free",
    "R$ 0/mês",
    "40.000 créditos por mês para testar a plataforma.",
    "",
    "Basic",
    "R$ 29,90/mês",
    "300.000 créditos por mês para uso leve.",
    "",
    "Plus",
    "R$ 79,90/mês",
    "800.000 créditos por mês com melhor custo-benefício.",
    "",
    "Pro",
    "R$ 149,90/mês",
    "2.000.000 créditos por mês para uso mais pesado.",
    "",
    "Regras importantes sobre os planos:",
  ].join("\n")
  const extractedPricing = extractDeterministicPricingCatalogFromAgentText(infraStudioAgentPrompt)
  assert.equal(extractedPricing?.enabled, true)
  assert.deepEqual(extractedPricing?.items.map((item) => item.name), ["Free", "Basic", "Plus", "Pro"])
  assert.deepEqual(extractedPricing?.items.map((item) => item.creditLimit), [40000, 300000, 800000, 2000000])
  const extractedPricingReply = buildBillingReplyResult(
    { pricingCatalog: extractedPricing },
    { channel: { kind: "web" } },
    { kind: "pricing_overview" }
  )
  assert.match(extractedPricingReply?.reply ?? "", /Basic: R\$ 29,90\/mês/)
  assert.match(extractedPricingReply?.reply ?? "", /Pro: R\$ 149,90\/mês/)
  assert.doesNotMatch(extractedPricingReply?.reply ?? "", /300,00/)

  const compactPromptWithPricing = buildSystemPrompt(
    {
      id: "agent-infrastudio-pricing",
      nome: "InfraStudio",
      promptBase: infraStudioAgentPrompt,
    },
    {
      agente: {
        runtimeConfig: {
          business: {
            summary: "A InfraStudio cria sistemas e automacoes com IA.",
          },
          pricingCatalog: extractedPricing,
        },
      },
    }
  )
  assert.match(compactPromptWithPricing, /Catalogo de precos estruturado:/)
  assert.match(compactPromptWithPricing, /Basic: R\$ 29,90\/mês/)
  assert.match(compactPromptWithPricing, /Pro: R\$ 149,90\/mês/)

  const strongReference = resolveDeterministicCatalogFollowUpDecision("gostei da sopeira que mandou", catalogContext, deps)
  assert.equal(strongReference?.kind, "recent_product_reference")
  const bareTitleReference = resolveRecentCatalogReferenceDecision("floral", catalogContext as never)
  assert.equal(bareTitleReference, null)
  const bareRequestReference = resolveRecentCatalogReferenceDecision("quero", catalogContext as never)
  assert.equal(bareRequestReference, null)

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
  assert.ok(apiFocused.fields.every((field) => field.apiId === "api-pedidos-1"))

  const productPriceReply = buildApiFallbackReply("qual o preco do produto?", apiFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.match(productPriceReply ?? "", /R\$/i)
  assert.match(productPriceReply ?? "", /disponivel/i)
  assert.doesNotMatch(productPriceReply ?? "", /em separacao/i)

  const genericStatusReply = buildApiFallbackReply("qual o status?", apiFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.equal(genericStatusReply, null)

  const realEstateValueReply = buildApiFallbackReply("qual o valor do imovel?", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.match(realEstateValueReply ?? "", /valor/i)
  assert.match(realEstateValueReply ?? "", /R\$/i)
  assert.match(realEstateValueReply ?? "", /Status:/i)
  assert.doesNotMatch(realEstateValueReply ?? "", /^descricao:/i)

  const realEstateDateReply = buildApiFallbackReply("me passa a data do leilao", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value) => value,
  })
  assert.match(realEstateDateReply ?? "", /27\/03\/2026/)
  assert.match(realEstateDateReply ?? "", /Status:/i)

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
  assert.equal(storefrontCatalogRoute.domain, "general")
  assert.equal(storefrontCatalogRoute.source, "agent")
  assert.equal(storefrontCatalogRoute.shouldUseTool, false)

  const staleCatalogFollowUpRoute = resolveChatDomainRoute({
    latestUserMessage: "aquela floral",
    history: [{ role: "assistant", content: "Encontrei alguns produtos para voce." }],
    context: {
      catalogo: {
        ultimosProdutos: [
          { id: "ml-1", nome: "Prato Floral" },
          { id: "ml-2", nome: "Saleiro Floral" },
        ],
        snapshotCreatedAt: "2024-01-01T00:00:00.000Z",
      },
    },
    project: {
      directConnections: {
        mercadoLivre: 1,
      },
    },
    runtimeApis: [],
    focusedApiContext: { fields: [] },
  })
  assert.equal(staleCatalogFollowUpRoute.domain, "general")

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

  const sharedCatalogIntent = resolveCatalogIntentState({
    latestUserMessage: "voce tem outro produto similar a esse?",
    context: {
      catalogo: {
        produtoAtual: {
          id: "MLB-1",
          nome: "Saleiro De Porcelana",
          categoriaLabel: "Saleiros",
          atributos: [{ nome: "Material", valor: "Porcelana" }],
        },
        ultimosProdutos: [],
      },
      conversation: { mode: "product_detail" },
      storefront: { pageKind: "product_detail" },
      ui: { productDetailPreferred: true },
    },
    catalogDecision: {
      kind: "similar_items_search",
      searchCandidates: [],
      excludeCurrentProduct: true,
    },
    detectProductSearch: () => false,
    buildProductSearchCandidates: () => [],
    isCatalogListingIntent: () => false,
  })
  assert.equal(sharedCatalogIntent.forceNewSearch, true)
  assert.equal(sharedCatalogIntent.productSearchRequested, true)
  assert.equal(sharedCatalogIntent.currentCatalogProduct, null)
  assert.equal(sharedCatalogIntent.productSearchTerm, "Saleiros")

  const cheaperAlternativeDecision = buildCatalogDecisionFromSemanticIntent({
    semanticIntent: {
      intent: "catalog_alternative_search",
      confidence: 0.92,
      reason: "Cliente pediu alternativas mais baratas ao produto em foco.",
      targetType: "",
      referencedProductIds: [],
      excludeCurrentProduct: true,
      targetFactHints: [],
      factScope: "",
      adviceType: "",
      relation: "same_type",
      priceConstraint: "below_current",
      usedLlm: true,
    },
    currentCatalogProduct: {
      id: "MLB-1",
      nome: "Saleiro De Porcelana",
    },
    recentProducts: [],
  })
  assert.equal(cheaperAlternativeDecision?.kind, "catalog_alternative_search")
  assert.equal(cheaperAlternativeDecision?.priceConstraint, "below_current")
  assert.equal(cheaperAlternativeDecision?.excludeCurrentProduct, true)

  const cheaperAlternativeIntent = resolveCatalogIntentState({
    latestUserMessage: "tem mais barato?",
    context: {
      catalogo: {
        produtoAtual: {
          id: "MLB-1",
          nome: "Saleiro De Porcelana",
          categoriaLabel: "Saleiros",
          preco: 220,
        },
        ultimosProdutos: [],
      },
      conversation: { mode: "product_detail" },
      storefront: { pageKind: "product_detail" },
      ui: { productDetailPreferred: true },
    },
    catalogDecision: cheaperAlternativeDecision,
    detectProductSearch: () => false,
    buildProductSearchCandidates: () => [],
    isCatalogListingIntent: () => false,
  })
  assert.equal(cheaperAlternativeIntent.forceNewSearch, true)
  assert.equal(cheaperAlternativeIntent.currentCatalogProduct, null)
  assert.equal(cheaperAlternativeIntent.excludeCurrentProductFromSearch, true)
  assert.equal(cheaperAlternativeIntent.priceMaxExclusive, 220)
  assert.equal(cheaperAlternativeIntent.productSearchTerm, "Saleiros")

  let mercadoLivreSearchOptions: any = null
  const cheaperAlternativeState = await resolveMercadoLivreHeuristicState({
    context: {
      catalogo: {
        produtoAtual: {
          id: "MLB-1",
          nome: "Saleiro De Porcelana",
          categoriaLabel: "Saleiros",
          preco: 220,
        },
      },
      conversation: { mode: "product_detail" },
      storefront: { pageKind: "product_detail" },
      ui: { productDetailPreferred: true },
    },
    project: {
      id: "project-1",
      directConnections: {
        mercadoLivre: 1,
      },
    },
    latestUserMessage: "tem mais barato?",
    productSearchRequested: cheaperAlternativeIntent.productSearchRequested,
    genericMercadoLivreListingRequested: false,
    forceNewSearch: cheaperAlternativeIntent.forceNewSearch,
    loadMoreCatalogRequested: false,
    productSearchTerm: cheaperAlternativeIntent.productSearchTerm,
    excludeCurrentProductFromSearch: cheaperAlternativeIntent.excludeCurrentProductFromSearch,
    priceMaxExclusive: cheaperAlternativeIntent.priceMaxExclusive,
    allowEmptyCatalogSearch: cheaperAlternativeIntent.allowEmptyCatalogSearch,
    catalogFollowUpDecision: cheaperAlternativeDecision,
    resolveMercadoLivreStoreSettings: async () => ({ chatContextFull: false }),
    resolveMercadoLivreProductById: async () => null,
    resolveMercadoLivreSearch: async (_project: any, options: any) => {
      mercadoLivreSearchOptions = options
      return {
        items: [
          {
            id: "MLB-2",
            title: "Saleiro Branco",
            price: 120,
            currencyId: "BRL",
            availableQuantity: 1,
            permalink: "https://produto.mercadolivre.com.br/MLB-2",
            thumbnail: "",
          },
        ],
        connector: null,
        paging: {
          total: 1,
          offset: 0,
          nextOffset: 3,
          hasMore: false,
        },
        error: null,
      }
    },
  })
  assert.equal(mercadoLivreSearchOptions?.priceMaxExclusive, 220)
  assert.deepEqual(mercadoLivreSearchOptions?.excludeItemIds, ["MLB-1"])
  assert.equal(mercadoLivreSearchOptions?.sort, "price_asc")
  assert.notEqual(cheaperAlternativeState.selectedCatalogProduct?.id, "MLB-1")

  const sharedCatalogDecision = resolveCatalogDecisionState({
    latestUserMessage: "gostei desse",
    context: {
      catalogo: {
        ultimaBusca: "sopeira",
        ultimosProdutos: [catalogContext.catalogo?.ultimosProdutos?.[0]].filter(Boolean),
      },
    },
    semanticDecision: {
      kind: "recent_product_reference_unresolved",
      confidence: 0.9,
      matchedProducts: [catalogContext.catalogo?.ultimosProdutos?.[0]].filter(Boolean),
    },
    shouldUseCatalog: true,
    buildProductSearchCandidates: deps.buildProductSearchCandidates,
    shouldSearchProducts: deps.shouldSearchProducts,
  })
  assert.equal(sharedCatalogDecision.catalogDecision?.kind, "recent_product_reference")
  assert.equal(sharedCatalogDecision.catalogReferenceReply, null)

  const sharedCatalogExecution = resolveCatalogExecutionState({
    latestUserMessage: "qual vale mais a pena entre o 1 e o 2?",
    context: {
      catalogo: {
        ultimosProdutos: [
          {
            id: "MLB-1",
            nome: "Saleiro Azul",
            preco: 120,
            availableQuantity: 1,
            freeShipping: true,
          },
          {
            id: "MLB-2",
            nome: "Saleiro Branco",
            preco: 180,
            availableQuantity: 1,
            freeShipping: false,
          },
        ],
      },
    },
    products: [
      {
        id: "MLB-1",
        nome: "Saleiro Azul",
        preco: 120,
        availableQuantity: 1,
        freeShipping: true,
      },
      {
        id: "MLB-2",
        nome: "Saleiro Branco",
        preco: 180,
        availableQuantity: 1,
        freeShipping: false,
      },
    ],
    detectProductSearch: () => false,
    buildProductSearchCandidates: () => [],
    isCatalogListingIntent: () => false,
  })
  assert.equal(sharedCatalogExecution.action, "comparison")
  assert.equal(sharedCatalogExecution.comparisonState.comparisonIntent, "best_choice")
  assert.match(sharedCatalogExecution.comparisonState.comparisonReply ?? "", /Entre Saleiro Azul e Saleiro Branco/i)

  const sharedApiComparison = resolveCatalogComparisonDecisionState({
    latestUserMessage: "qual vale mais a pena?",
    products: [
      {
        id: "api-1",
        nome: "Imovel Centro",
        preco: 210000,
        availableQuantity: 1,
        freeShipping: false,
      },
      {
        id: "api-2",
        nome: "Imovel Jardim",
        preco: 195000,
        availableQuantity: 1,
        freeShipping: false,
      },
    ],
    comparisonIntent: "best_choice",
    referencedProductIndexes: [1, 2],
    isSemanticComparison: true,
    hasRecentListContext: true,
  })
  assert.equal(sharedApiComparison.comparisonIntent, "best_choice")
  assert.match(sharedApiComparison.comparisonReply ?? "", /Entre Imovel Centro e Imovel Jardim/i)

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

  console.log("16 domain regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
