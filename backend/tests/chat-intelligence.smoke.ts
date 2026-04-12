import assert from "node:assert/strict";

import {
  appendOptionalHumanOffer,
  applyAdminTestContextOverrides,
  applyBillingGuardrail,
  applyHandoffGuardrail,
  buildApiFallbackReply,
  buildAiObservability,
  buildAssistantMessageMetadata,
  buildBillingSnapshot,
  buildBillingBlockedResult,
  buildCatalogDecisionFromSemanticIntent,
  buildChatUsageOrigin,
  buildChatUsageTelemetry,
  buildChatConfigDiagnostics,
  buildLogSearchText,
  buildChatCorsHeaders,
  buildContinuationMessage,
  buildFeedbackRecord,
  buildFinalChatResult,
  buildFallbackChatTitle,
  buildInitialChatContext,
  buildIsolatedChatResult,
  buildCoreChatRequest,
  buildUsagePersistencePayload,
  buildUserMessageMetadata,
  buildNextContext,
  buildSilentChatResult,
  buildFocusedApiContext,
  formatPublicChatResult,
  buildHumanHandoffReply,
  buildLeadNameAcknowledgementReply,
  buildProductSearchCandidates,
  buildPublicChatRequestDiagnostics,
  buildSystemPrompt,
  buildWhatsAppMessageSequence,
  getChatAttachmentsMetadata,
  classifyHumanEscalationNeed,
  decideCatalogFollowUpHeuristically,
  enrichLeadContext,
  ensureActiveChatSession,
  executeSalesOrchestrator,
  executeV2RuntimePrelude,
  extractRecentMercadoLivreProductsFromAssets,
  extractChatContactSnapshot,
  finalizeV2AiTurn,
  findChatByChannelScope,
  findChatByWhatsAppPhone,
  filterAdminLogs,
  getAdminTestAgentId,
  getChatContext,
  getAdminTestProjectId,
  getWhatsAppContactAvatarFromContext,
  getWhatsAppContactNameFromContext,
  hasSupabaseServerEnv,
  isCatalogLoadMoreMessage,
  isCatalogSearchMessage,
  isGreetingOrAckMessage,
  isHumanHandoffIntent,
  isLikelyLeadNameReply,
  loadChatHistory,
  mergeContext,
  normalizeExternalIdentifier,
  normalizeInboundAttachments,
  normalizeInboundMessage,
  normalizeChannelKind,
  normalizeLogLevel,
  normalizePublicChatBody,
  normalizeWhatsAppLookupPhone,
  parseAssetPrice,
  persistAssistantTurn,
  persistUsageRecord,
  processChatRequest,
  prepareAiReplyPayload,
  prepareChatPrelude,
  persistUserTurn,
  persistAssistantState,
  resolveCanonicalWhatsAppExternalIdentifier,
  resolveChatChannel,
  resolveChatContactSnapshot,
  resolveConversationPipelineStageState,
  resolveMercadoLivreFlowState,
  resolveMercadoLivreHeuristicState,
  resolveRecentCatalogProductReference,
  sanitizeWhatsAppCustomerFacingReply,
  shouldPauseAssistantForHandoff,
  splitCatalogReplyForWhatsApp,
  shouldContinueProductSearch,
  shouldUseMercadoLivreConnectorFallback,
  updateContextFromAiResult,
  uploadChatAttachmentPayloads,
  mapChat,
  mapBillingPlan,
  mapFeedbackMessageRow,
  mapAdminConversationMessage,
  mapMensagem,
  mapLogRow,
  requestRuntimeHumanHandoff,
  estimateOpenAICostUsd,
  resolvePricingModel,
  sortFeedbacks,
} from "@/tests/chat-source";
import {
  createFixtureSearchDeps,
  loadApiRuntimeFixture,
  loadApiRuntimeRealEstateFixture,
  loadCatalogContextFixture,
  loadHandoffFixture,
  loadLeadContextFixture,
  loadWhatsAppContextFixture,
  normalizeFixtureText,
} from "@/tests/chat-test-fixtures";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const deps = createFixtureSearchDeps();
const catalogContext = loadCatalogContextFixture();
const apiFixture = loadApiRuntimeFixture();
const apiRealEstateFixture = loadApiRuntimeRealEstateFixture();
const leadContextFixture = loadLeadContextFixture();
const handoffFixture = loadHandoffFixture();
const whatsappContextFixture = loadWhatsAppContextFixture();

const tests: TestCase[] = [
  {
    name: "observabilidade de ia resume metadata da mensagem",
    run: () => {
      const metadata = {
        provider: "api_runtime",
        model: "heuristic",
        agenteId: "agent-1",
        agenteNome: "Agente",
        routeStage: "sales",
        heuristicStage: "api_runtime",
        domainStage: "api_runtime",
        usageTelemetry: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          billingOrigin: "chat:web:api_runtime:sales:api_runtime",
        },
        assets: [{ id: "asset-1" }],
      }
      const observability = buildAiObservability(metadata, {
        tokensInput: 3,
        tokensOutput: 5,
        custo: 0.001,
      })
      const mapped = mapAdminConversationMessage({
        id: "msg-ai",
        role: "assistant",
        conteudo: "Status: enviado",
        metadata,
        tokensInput: 3,
        tokensOutput: 5,
        custo: 0.001,
        createdAt: "2026-04-12T12:00:00.000Z",
      })

      assert.equal(observability?.provider, "api_runtime")
      assert.equal(observability?.usage.inputTokens, 3)
      assert.equal(mapped.observability?.heuristicStage, "api_runtime")
      assert.equal(mapped.observability?.assetsCount, 1)
    },
  },
  {
    name: "feedback resume mensagens e prioriza pendencias",
    run: () => {
      const mensagens = [
        mapFeedbackMessageRow({
          id: "msg-1",
          feedback_id: "fb-1",
          usuario_id: "user-1",
          remetente_tipo: "usuario",
          mensagem: "Preciso de ajuda",
          lida_pelo_admin: false,
          lida_pelo_usuario: true,
          created_at: "2026-04-11T09:00:00.000Z",
          updated_at: "2026-04-11T09:00:00.000Z",
        } as never),
      ];

      const aberto = buildFeedbackRecord(
        {
          id: "fb-1",
          usuario_id: "user-1",
          projeto_id: "proj-1",
          assunto: "Dificuldade no widget",
          categoria: "duvida",
          status: "novo",
          admin_visualizado: false,
          usuario_visualizado: true,
          closed_at: null,
          created_at: "2026-04-11T08:00:00.000Z",
          updated_at: "2026-04-11T09:00:00.000Z",
          usuarios: { id: "user-1", nome: "Julia", email: "julia@example.com" },
          projetos: { id: "proj-1", nome: "Nexo" },
        } as never,
        mensagens as never,
      );

      const fechado = buildFeedbackRecord(
        {
          id: "fb-2",
          usuario_id: "user-2",
          projeto_id: null,
          assunto: "Fechado",
          categoria: "sugestao",
          status: "fechado",
          admin_visualizado: true,
          usuario_visualizado: true,
          closed_at: "2026-04-11T07:00:00.000Z",
          created_at: "2026-04-11T06:00:00.000Z",
          updated_at: "2026-04-11T07:00:00.000Z",
          usuarios: { id: "user-2", nome: "Carlos", email: "carlos@example.com" },
          projetos: null,
        } as never,
        [] as never,
      );

      const ordered = sortFeedbacks([fechado, aberto] as never, "pendentes");

      assert.equal(aberto.totalMensagens, 1);
      assert.equal(aberto.possuiMensagemNaoLidaAdmin, true);
      assert.equal(ordered[0]?.id, "fb-1");
    },
  },
  {
    name: "laboratorio normaliza e filtra logs administrativos",
    run: () => {
      const entries = [
        mapLogRow({
          id: "log-1",
          projeto_id: "proj-1",
          tipo: "chat_error",
          origem: "public_chat",
          descricao: "OpenAI retornou 500",
          payload: {
            level: "error",
            projeto: "nexo",
            agente: "agente-imovel",
            widgetSlug: "nexo_leiloes",
            error: "OpenAI retornou 500",
          },
          created_at: "2026-04-11T10:00:00.000Z",
        } as never),
        mapLogRow({
          id: "log-2",
          projeto_id: "proj-2",
          tipo: "whatsapp_event",
          origem: "whatsapp_worker",
          descricao: "Sessao conectada",
          payload: {
            level: "info",
            projeto: "atelier",
            chatId: "chat-2",
          },
          created_at: "2026-04-11T10:01:00.000Z",
        } as never),
      ]

      const filteredByProject = filterAdminLogs(entries as never, { projectId: "proj-1" })
      const filteredBySearch = filterAdminLogs(entries as never, { search: "nexo_leiloes" })
      const searchText = buildLogSearchText(entries[0])

      assert.equal(normalizeLogLevel("ERROR"), "error")
      assert.equal(filteredByProject.length, 1)
      assert.equal(filteredBySearch.length, 1)
      assert.match(searchText, /openai retornou 500/i)
    },
  },
  {
    name: "billing resume plano, ciclo e bloqueio do projeto",
    run: () => {
      const plan = mapBillingPlan({
        id: "plan-1",
        nome: "Profissional",
        descricao: "Plano mensal",
        preco_mensal: 99,
        limite_tokens_input_mensal: 1000,
        limite_tokens_output_mensal: 500,
        limite_tokens_total_mensal: 1500,
        limite_custo_mensal: 25,
        max_agentes: 3,
        max_apis: 10,
        max_whatsapp: 2,
        ativo: true,
        permitir_excedente: true,
        custo_token_excedente: 0.0002,
        is_free: false,
      } as never)

      const snapshot = buildBillingSnapshot({
        project: {
          modo_cobranca: "plano",
        },
        plan,
        projectPlan: {
          id: "cfg-1",
          plano_id: "plan-1",
          nome_plano: "Profissional",
          modelo_referencia: "gpt-4o-mini",
          limite_tokens_total_mensal: 2000,
          limite_custo_mensal: 30,
          auto_bloquear: true,
          bloqueado: false,
          bloqueado_motivo: null,
          observacoes: "ok",
        },
        currentCycle: {
          id: "cycle-1",
          data_inicio: "2026-04-01T00:00:00.000Z",
          data_fim: "2026-04-30T23:59:59.000Z",
          tokens_input: 400,
          tokens_output: 600,
          custo_total: 12,
          fechado: false,
          bloqueado: false,
          alerta_80: false,
          alerta_100: false,
          excedente_tokens: 0,
          excedente_custo: 0,
          limite_tokens_total: 2000,
          limite_custo: 30,
        },
        subscription: {
          id: "sub-1",
          status: "ativo",
          data_inicio: "2026-04-01T00:00:00.000Z",
          data_fim: null,
          renovar_automatico: true,
        },
        topUps: [{ tokens: 300, custo: 5 }],
      })

      assert.equal(plan.name, "Profissional")
      assert.equal(snapshot.projectPlan.planName, "Profissional")
      assert.equal(snapshot.currentCycle.usage.totalTokens, 1000)
      assert.equal(snapshot.currentCycle.usagePercent.totalTokens, 50)
      assert.equal(snapshot.topUps.totalTokens, 300)
      assert.equal(snapshot.status.blocked, false)
    },
  },
  {
    name: "catalogo resolve item recente e segura ambiguidade",
    run: () => {
      const reference = decideCatalogFollowUpHeuristically("gostei da sopeira que mandou", catalogContext as never, deps as never);
      const ambiguous = decideCatalogFollowUpHeuristically("quero o amarelo", catalogContext as never, deps as never);
      const resolved = resolveRecentCatalogProductReference("gostei da dopeira que mandou", catalogContext as never);

      assert.equal(reference?.kind, "recent_product_reference");
      assert.equal(ambiguous?.kind, "recent_product_reference_ambiguous");
      assert.equal(resolved.length, 1);
    },
  },
  {
    name: "catalogo semantico mantem produto em foco",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "product_question",
          confidence: 0.91,
          reason: "pergunta sobre o produto atual",
          usedLlm: true,
        },
        context: catalogContext,
        recentProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
      });

      assert.equal(decision?.kind, "non_catalog_message");
    },
  },
  {
    name: "api runtime encontra contexto e normaliza data",
    run: () => {
      const focused = buildFocusedApiContext("status pedido PED-2026-0042 previsao envio", apiFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value: string) => value,
      });
      const reply = buildApiFallbackReply("me passa a data do leilao", apiRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value: string) => value,
      });

      assert.ok(focused.fields.length > 0);
      assert.match(reply ?? "", /27\/03\/2026/);
    },
  },
  {
    name: "pipeline amplia dominio factual quando ha api focada",
    run: () => {
      const stage = resolveConversationPipelineStageState({
        leadNameAcknowledgementReply: null,
        hasCatalogReferenceHeuristicReply: false,
        hasMercadoLivreHeuristicReply: false,
        catalogPricingReply: null,
        leadIdentificationReply: null,
        hasValidAgent: true,
        hasOpenAiKey: true,
        hasFocusedApiContext: true,
        latestUserMessage: "qual o status do pedido?",
        hasMemorySummary: false,
        hasCurrentCatalogContext: false,
        hasMercadoLivreContext: false,
        hasLeadContext: false,
      });

      assert.equal(stage.conversationDomainStage, "api_runtime");
    },
  },
  {
    name: "mercado livre nao dispara busca solta sem contexto",
    run: () => {
      const continueSearch = shouldContinueProductSearch(
        [
          { role: "assistant", content: "Encontrei algumas opcoes." },
          { role: "user", content: "gostei desse" },
        ],
        "gostei desse",
        { ...catalogContext, catalogo: { ...catalogContext.catalogo, ultimaBusca: "" } },
        {
          normalizeText: normalizeFixtureText,
          isGreetingOrAckMessage: () => false,
          shouldSearchProducts: () => false,
          buildProductSearchCandidates: deps.buildProductSearchCandidates,
        }
      );
      const fallback = shouldUseMercadoLivreConnectorFallback(
        [{ role: "user", content: "gostei desse" }],
        "gostei desse",
        { ...catalogContext, catalogo: { ...catalogContext.catalogo, ultimaBusca: "" } },
        {
          normalizeText: normalizeFixtureText,
          isGreetingOrAckMessage: () => false,
          buildProductSearchCandidates: deps.buildProductSearchCandidates,
          shouldSearchProducts: () => false,
          isLikelyLeadNameReply: () => false,
          extractName: () => null,
        }
      );

      assert.equal(continueSearch, false);
      assert.equal(fallback, false);
    },
  },
  {
    name: "mercado livre mantem fala consultiva no produto em foco",
    run: async () => {
      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "acho que combina comigo",
        context: catalogContext,
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        recentCatalogProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
        catalogFollowUpDecision: {
          kind: "recent_product_reference",
          confidence: 0.94,
          reason: "produto atual em foco",
          matchedProducts: [catalogContext.catalogo?.ultimosProdutos?.[1]].filter(Boolean),
          usedLlm: true,
          shouldBlockNewSearch: true,
        },
        detectProductSearch: () => false,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        resolveRecentCatalogProductReference,
        isRecentCatalogReferenceAttempt: () => true,
        isMercadoLivreListingIntent: () => false,
        shouldUseMercadoLivreConnectorFallback: () => true,
      });

      const state = await resolveMercadoLivreHeuristicState({
        agentId: "agent-1",
        latestUserMessage: "acho que combina comigo",
        context: catalogContext,
        hasMercadoLivreConnector: true,
        leadNameReplyDetected: false,
        hasReferencedCatalogReply: true,
        productSearchRequested: flow.productSearchRequested,
        genericMercadoLivreListingRequested: flow.genericMercadoLivreListingRequested,
        mercadoLivreListingProducts: [],
        mercadoLivreProducts: [],
        resolvedProductSearchTerm: flow.productSearchTerm,
        productSearchTerm: flow.productSearchTerm,
        loadMoreCatalogRequested: flow.loadMoreCatalogRequested,
        referencedCatalogProducts: flow.referencedCatalogProducts,
        currentCatalogProduct: flow.currentCatalogProduct,
        catalogFollowUpDecision: flow.catalogFollowUpDecision ?? null,
        lojaCta: null,
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => true,
        },
      });

      assert.ok(state.selectedProductSalesReply);
    },
  },
  {
    name: "lead capture identifica nome e acknowledgement comercial",
    run: () => {
      const history = [
        { role: "assistant", content: "Como posso te chamar?" },
        { role: "user", content: "Carlos" },
      ];
      const isNameReply = isLikelyLeadNameReply("Carlos", history as never, {
        normalizeText: normalizeFixtureText,
        extractName: (message: string) => {
          const enriched = enrichLeadContext(leadContextFixture as never, history as never, message, {
            normalizeText: normalizeFixtureText,
          });
          return enriched.lead?.nome ?? null;
        },
      });
      const enriched = enrichLeadContext(leadContextFixture as never, history as never, "meu nome e Carlos 11999999999", {
        normalizeText: normalizeFixtureText,
      });
      const ack = buildLeadNameAcknowledgementReply("Carlos", true, leadContextFixture as never, null, () => true);

      assert.equal(isNameReply, true);
      assert.equal(enriched.lead?.nome, "Carlos");
      assert.match(ack, /Carlos/);
    },
  },
  {
    name: "prompt evita identidade forcada da infrastudio",
    run: () => {
      const prompt = buildSystemPrompt(
        {
          id: "agent-real-estate",
          nome: "Nexo Leiloes",
          slug: null,
          projetoId: "proj-real-estate",
          modeloId: null,
          apiIds: [],
          configuracoes: {},
          arquivos: [],
          promptBase: "",
          createdAt: "",
          updatedAt: "",
          ativo: true,
          descricao: "Assistente de leiloes imobiliarios",
        } as never,
        {
          projeto: { nome: "Nexo Leiloes", slug: "nexo-leiloes" },
          channel: { kind: "external_widget" },
        } as never,
        false
      );

      assert.doesNotMatch(prompt, /Voce e o agente comercial inicial da InfraStudio/i);
      assert.doesNotMatch(prompt, /Foque em automacao, IA, integracoes, sistemas sob medida/i);
    },
  },
  {
    name: "prompt bloqueia whatsapp sem numero cadastrado",
    run: () => {
      const prompt = buildSystemPrompt(
        {
          id: "agent-no-whatsapp",
          nome: "Agente Site",
          promptBase: "Leve o cliente para o WhatsApp quando houver interesse.",
        } as never,
        {
          widget: { slug: "site", whatsapp_celular: "" },
          channel: { kind: "web" },
        } as never,
        false
      )

      assert.match(prompt, /WhatsApp nao disponivel/i)
    },
  },
  {
    name: "prompt usa numero cadastrado no cta de whatsapp",
    run: () => {
      const prompt = buildSystemPrompt(
        {
          id: "agent-with-whatsapp",
          nome: "Agente Site",
          promptBase: "Leve o cliente para o WhatsApp quando houver interesse.",
          runtimeConfig: {
            sales: {
              cta: "Chame no WhatsApp para fechar.",
            },
          },
        } as never,
        {
          widget: { slug: "site", whatsapp_celular: "5511999999999" },
          channel: { kind: "web" },
        } as never,
        false
      )

      assert.match(prompt, /5511999999999/)
      assert.match(prompt, /nunca use placeholder/i)
    },
  },
  {
    name: "orquestrador falha fechado sem configuracao valida de agente",
    run: async () => {
      await assert.rejects(
        () =>
          executeSalesOrchestrator(
            [{ role: "user", content: "oi" }] as never,
            {
              agente: {
                id: "agent-closed",
                nome: "Infra",
                promptBase: "",
              },
            } as never
          ),
        /Agente do chat sem configuracao valida de prompt/i
      );
    },
  },
  {
    name: "orquestrador usa api runtime factual antes do modelo",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me passa a data do leilao" }] as never,
        {
          agente: {
            id: "agent-api",
            nome: "Nexo Leiloes",
            promptBase: "Atenda com precisao.",
          },
          runtimeApis: apiRealEstateFixture.apis,
        } as never
      );

      assert.equal(result.metadata.provider, "api_runtime");
      assert.match(result.reply, /27\/03\/2026/);
      assert.equal(result.usage.inputTokens, 0);
    },
  },
  {
    name: "orquestrador respeita produto recente em foco",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "gostei da sopeira que mandou" }] as never,
        {
          agente: {
            id: "agent-catalog",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          catalogo: catalogContext.catalogo,
        } as never
      );

      assert.equal(result.metadata.provider, "local_heuristic");
      assert.match(result.reply, /vamos seguir com/i);
      assert.match(result.reply, /Sopeira/i);
    },
  },
  {
    name: "orquestrador nao captura lead cedo quando pergunta sobre servico",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "oi, voce faz site?" }] as never,
        {
          agente: {
            id: "agent-service",
            nome: "InfraStudio",
            promptBase: "Voce vende sites, sistemas com IA, automacoes, integracoes e atendimento inteligente. Explique de forma objetiva e comercial.",
            runtimeConfig: {
              leadCapture: {
                deferOnQuestions: true,
                respectCatalogBoundary: false,
              },
            },
          },
        } as never,
        {
          generateSalesReply: async () => ({
            reply: "Sim. Criamos sites profissionais e tambem sistemas com IA, automacoes e integracoes sob medida.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-service",
              agenteNome: "InfraStudio",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "general",
            },
          }),
        }
      );

      assert.doesNotMatch(result.reply, /Como posso te chamar/i);
      assert.match(result.reply, /sites profissionais/i);
    },
  },
  {
    name: "orquestrador so direciona para whatsapp quando widget tem numero",
    run: async () => {
      const baseContext = {
        agente: {
          id: "agent-service",
          nome: "InfraStudio",
          promptBase: "Voce vende sites, sistemas com IA, automacoes, integracoes e atendimento inteligente.",
          runtimeConfig: {
            pricingCatalog: {
              enabled: true,
              items: [
                {
                  slug: "site",
                  name: "Criacao de site",
                  matchAny: ["site"],
                  priceLabel: "R$300 a R$1000",
                },
                {
                  slug: "chat",
                  name: "Chat com IA",
                  matchAny: ["chat"],
                  priceLabel: "R$50 de adesao + R$20/mes",
                },
              ],
              ctaMultiple: "Te direciono no WhatsApp para alinharmos os detalhes finais.",
            },
          },
        },
        ui: { structured_response: false },
      }

      const withoutNumber = await executeSalesOrchestrator(
        [{ role: "user", content: "quanto custa um site com chat?" }] as never,
        {
          ...baseContext,
          widget: { slug: "site", whatsapp_celular: "" },
        } as never
      )
      const withNumber = await executeSalesOrchestrator(
        [{ role: "user", content: "quanto custa um site com chat?" }] as never,
        {
          ...baseContext,
          widget: { slug: "site", whatsapp_celular: "5511999999999" },
        } as never
      )

      assert.match(withoutNumber.reply, /R\$300 a R\$1000/i)
      assert.doesNotMatch(withoutNumber.reply, /WhatsApp/i)
      assert.match(withNumber.reply, /WhatsApp/i)
    },
  },
  {
    name: "orquestrador nao aplica heuristica comercial da infrastudio em agente de cliente",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "quanto custa?" }] as never,
        {
          agente: {
            id: "agent-client",
            nome: "Loja Cliente",
            promptBase: "Voce atende uma loja de produtos artesanais.",
          },
          projeto: {
            nome: "Loja Cliente",
            slug: "loja-cliente",
          },
        } as never,
        {
          generateSalesReply: async () => ({
            reply: "Depende do produto que voce quer avaliar.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-client",
              agenteNome: "Loja Cliente",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "general",
            },
          }),
        }
      );

      assert.doesNotMatch(result.reply, /Criacao de site|Sistema com IA|WhatsApp/i);
      assert.match(result.reply, /Depende do produto/i);
    },
  },
  {
    name: "handoff detecta humano e mantem reply controlada",
    run: async () => {
      const explicitIntent = isHumanHandoffIntent(handoffFixture.explicitHumanMessage);
      const offer = appendOptionalHumanOffer(handoffFixture.softOfferReply, "whatsapp");
      const reply = buildHumanHandoffReply("whatsapp");
      const decision = await classifyHumanEscalationNeed({
        projetoId: null,
        channelKind: "web",
        message: "nao entendi",
        aiReply: "Posso tentar de outro jeito.",
        aiMetadata: { provider: "agent_scoped_recovery" },
        context: leadContextFixture,
        history: handoffFixture.recoveryHistory,
      });

      assert.equal(explicitIntent, true);
      assert.match(offer, /atendente humano/i);
      assert.match(reply, /WhatsApp/i);
      assert.equal(decision.decision, "none");
    },
  },
  {
    name: "whatsapp preserva identidade canonica e lista humanizada",
    run: () => {
      const canonical = resolveCanonicalWhatsAppExternalIdentifier({
        identificadorExterno: "270570709065941@lid",
        identificador: "270570709065941@lid",
        context: whatsappContextFixture,
      });
      const sequence = buildWhatsAppMessageSequence(
        "Encontrei algumas opcoes parecidas na loja logo abaixo. Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo.",
        (whatsappContextFixture.catalogo?.ultimosProdutos ?? []).map((item: any) => ({
          nome: item.nome ?? "Produto",
          targetUrl: item.link ?? "",
          descricao: item.descricao ?? "",
          whatsappText: "Se esse estilo fizer sentido para voce, eu posso te explicar melhor este item.",
        }))
      );

      assert.equal(canonical, "5511978510655");
      assert.equal(sequence.length, 4);
    },
  },
  {
    name: "whatsapp sanitiza meta reply e monta mensagem de continuidade",
    run: () => {
      const sanitized = sanitizeWhatsAppCustomerFacingReply(
        "Vou verificar o status para voce. Encontrei um produto interessante para voce, de forma natural, simpatica e acolhedora, ."
      )
      const continuation = buildContinuationMessage({
        projetoNome: "Reliquia de familia",
        agenteNome: "Agent 17",
        produtoAtual: "Jogo De Jantar",
        resumo:
          '{"objetivo":"avaliar se vale a pena","proximo_passo":"validar frete e material","restricoes":"produto vintage"}',
        ultimaMensagem: "Pelo valor dele sera que vale apena",
      })

      assert.doesNotMatch(sanitized, /vou verificar|status|de forma natural|acolhedora/i)
      assert.match(continuation, /Produto em foco: Jogo De Jantar/i)
      assert.match(continuation, /Resumo para continuidade: objetivo: avaliar se vale a pena/i)
    },
  },
  {
    name: "catalogo detecta busca, load more e separa follow-up da reply",
    run: () => {
      const searchDetected = isCatalogSearchMessage("tem jogo de jantar floral?")
      const loadMoreDetected = isCatalogLoadMoreMessage("quero mais")
      const splitReply = splitCatalogReplyForWhatsApp(
        "Encontrei algumas opcoes para voce. Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo.",
        true
      )

      assert.equal(searchDetected, true)
      assert.equal(loadMoreDetected, true)
      assert.match(splitReply.mainReply, /Encontrei algumas opcoes/i)
      assert.match(splitReply.followUpReply, /me diga se gostou de algum/i)
    },
  },
  {
    name: "service monta resultados silencioso e isolado e normaliza canal",
    run: () => {
      const silent = buildSilentChatResult("chat-123")
      const isolated = buildIsolatedChatResult(
        {
          identificadorExterno: "lead-42",
          context: {
            channel: {
              kind: "whatsapp",
            },
          },
        },
        "oi preciso de ajuda"
      )
      const channelKind = normalizeChannelKind({
        context: {
          channel: {
            kind: "admin_agent_test",
          },
        },
      })

      assert.equal(silent.chatId, "chat-123")
      assert.equal(silent.reply, "")
      assert.equal(isolated.chatId, "lead-42")
      assert.match(isolated.reply, /modo isolado/i)
      assert.equal(channelKind, "admin_agent_test")
    },
  },
  {
    name: "service resolve snapshot de contato e mergeia contexto",
    run: () => {
      const merged = mergeContext(
        {
          channel: { kind: "web" },
          lead: { identificado: false },
        },
        {
          whatsapp: {
            contactName: "Julia Rodrigues",
            profilePicUrl: "https://example.com/julia.jpg",
          },
        }
      )
      const snapshot = resolveChatContactSnapshot(merged, "5511999999999")
      const contactName = getWhatsAppContactNameFromContext(merged)
      const avatar = getWhatsAppContactAvatarFromContext(merged)

      assert.equal(contactName, "Julia Rodrigues")
      assert.equal(avatar, "https://example.com/julia.jpg")
      assert.equal(snapshot.contatoNome, "Julia Rodrigues")
      assert.equal(snapshot.contatoTelefone, "5511999999999")
    },
  },
  {
    name: "service extrai produtos recentes de assets do mercado livre",
    run: () => {
      const parsedPrice = parseAssetPrice("R$ 2.990,00")
      const products = extractRecentMercadoLivreProductsFromAssets([
        {
          id: "MLB1",
          nome: "Jogo de Jantar Porcelana",
          descricao: "R$ 2.990,00",
          targetUrl: "https://example.com/jantar",
          publicUrl: "https://example.com/jantar.jpg",
        },
        {
          id: "mercado-livre-2",
          nome: "Jogo de Sopeira Completo",
          descricao: "R$ 250,00",
          targetUrl: "https://example.com/sopeira",
          publicUrl: "https://example.com/sopeira.jpg",
        },
        {
          id: "asset-generic",
          nome: "Arquivo",
          descricao: "sem preco",
        },
      ])

      assert.equal(parsedPrice, 2990)
      assert.equal(products.length, 2)
      assert.equal(products[0]?.preco, 2990)
      assert.equal(products[1]?.preco, 250)
    },
  },
  {
    name: "service normaliza input inicial e overrides de admin test",
    run: () => {
      const body = {
        message: "  oi preciso de ajuda  ",
        identificadorExterno: "  abc-123  ",
        attachments: [
          { name: " foto ", type: " image/png ", dataBase64: " xxx " },
          { name: "vazio", type: "text/plain", dataBase64: "" },
        ],
        context: {
          admin: {
            agenteId: " agent-1 ",
            projetoId: " proj-1 ",
          },
          channel: {
            kind: "admin_agent_test",
          },
        },
      }

      const message = normalizeInboundMessage(body)
      const attachments = normalizeInboundAttachments(body)
      const channelKind = normalizeChannelKind(body)
      const agentId = getAdminTestAgentId(body)
      const projectId = getAdminTestProjectId(body)
      const overridden = applyAdminTestContextOverrides(body, channelKind)
      const externalIdentifier = normalizeExternalIdentifier(
        {
          ...body,
          identificadorExterno: "  abc-123  ",
        },
        "web"
      )

      assert.equal(message, "oi preciso de ajuda")
      assert.equal(attachments.length, 1)
      assert.equal(channelKind, "admin_agent_test")
      assert.equal(agentId, "agent-1")
      assert.equal(projectId, "proj-1")
      assert.equal(overridden.agente, "agent-1")
      assert.equal(overridden.projeto, "proj-1")
      assert.equal(externalIdentifier, "abc-123")
    },
  },
  {
    name: "service monta nextContext com enrich e reset de catalogo",
    run: () => {
      const nextContext = buildNextContext({
        currentContext: {
          channel: { kind: "web" },
          ui: { compact: true },
          catalogo: {
            ultimaBusca: "busca antiga",
            produtoAtual: { id: "MLB1" },
            ultimosProdutos: [{ id: "MLB1" }],
          },
        },
        extraContext: {
          sdk: { host: "site" },
        },
        history: [
          { role: "assistant", conteudo: "ola" },
          { role: "user", conteudo: "tem jogo de jantar?" },
        ],
        message: "tem jogo de jantar?",
        channelKind: "whatsapp",
        normalizedExternalIdentifier: "5511999999999",
        enrichLeadContext: (context) => ({
          ...context,
          lead: { telefone: null },
          widget: { slug: "main" },
        }),
      })

      assert.equal(nextContext.channel.kind, "whatsapp")
      assert.equal(nextContext.channel.external_id, "5511999999999")
      assert.equal(nextContext.ui.allow_icons, true)
      assert.equal(nextContext.qualificacao.pronto_para_whatsapp, false)
      assert.equal(nextContext.catalogo.ultimaBusca, "tem jogo de jantar?")
      assert.equal(Array.isArray(nextContext.catalogo.ultimosProdutos), true)
      assert.equal(nextContext.widget.slug, "main")
    },
  },
  {
    name: "service detecta env do supabase como opcional de runtime",
    run: () => {
      const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      process.env.NEXT_PUBLIC_SUPABASE_URL = ""
      process.env.SUPABASE_SERVICE_ROLE_KEY = ""
      const missing = hasSupabaseServerEnv()

      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
      const present = hasSupabaseServerEnv()

      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey

      assert.equal(missing, false)
      assert.equal(present, true)
    },
  },
  {
    name: "service prepara prelude do chat para runtime ou modo isolado",
    run: () => {
      const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      process.env.NEXT_PUBLIC_SUPABASE_URL = ""
      process.env.SUPABASE_SERVICE_ROLE_KEY = ""
      const isolatedPrelude = prepareChatPrelude({
        message: "oi",
        identificadorExterno: "lead-1",
        canal: "web",
      })

      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
      const readyPrelude = prepareChatPrelude({
        message: "oi",
        identificadorExterno: "lead-2",
        context: {
          admin: {
            agenteId: "agent-2",
          },
          channel: {
            kind: "admin_agent_test",
          },
        },
      })

      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey

      assert.equal(isolatedPrelude.status, "isolated")
      assert.equal(isolatedPrelude.result.chatId, "lead-1")
      assert.equal(readyPrelude.status, "ready")
      assert.equal(readyPrelude.channelKind, "admin_agent_test")
      assert.equal(readyPrelude.effectiveBody.agente, "agent-2")
      assert.equal(readyPrelude.normalizedExternalIdentifier, "lead-2")
    },
  },
  {
    name: "widget publico normaliza contratos e CORS",
    run: () => {
      const modernPayload = normalizePublicChatBody({
        chatId: "chat-1",
        message: "oi",
        projeto: "proj",
        agente: "agent",
        context: {
          channel: {
            kind: "external_widget",
          },
        },
      })
      const legacyPayload = normalizePublicChatBody({
        chatId: "chat-2",
        message: "oi",
        widgetSlug: "widget-1",
      })
      const adminPayload = normalizePublicChatBody({
        conversationId: "conv-1",
        texto: "oi",
      })
      const headers = buildChatCorsHeaders("https://cliente.example")
      const result = formatPublicChatResult({
        chatId: "chat-1",
        reply: "ola",
        assets: [{ id: "asset-1" }],
        whatsapp: { url: "https://wa.me/5511999999999", label: "WhatsApp" },
      })

      assert.equal(modernPayload.canal, "external_widget")
      assert.equal(modernPayload.source, "site_widget")
      assert.equal(legacyPayload.canal, "external_widget")
      assert.equal(adminPayload.message, "oi")
      assert.equal(adminPayload.identificadorExterno, "conv-1")
      assert.equal(headers["Access-Control-Allow-Origin"], "https://cliente.example")
      assert.equal(result.chatId, "chat-1")
      assert.equal(result.assets.length, 1)
      assert.equal(result.whatsapp.url, "https://wa.me/5511999999999")
    },
  },
  {
    name: "widget publico gera diagnostico sem conteudo da mensagem",
    run: () => {
      const diagnostic = buildPublicChatRequestDiagnostics({
        event: "completed",
        origin: "https://cliente.example",
        host: "www.infrastudio.pro",
        method: "POST",
        body: {
          message: "mensagem sensivel",
          widgetSlug: "nexo_leiloes",
          projeto: "nexo",
          agente: "agente-imovel",
          chatId: "chat-1",
        },
        status: 200,
        chatId: "chat-1",
        elapsedMs: 123,
      })
      const configDiagnostic = buildChatConfigDiagnostics({
        event: "completed",
        origin: "https://cliente.example",
        host: "www.infrastudio.pro",
        projeto: "nexo",
        agente: "agente-imovel",
        status: 200,
        elapsedMs: 42,
      })

      assert.equal(diagnostic.widgetSlug, "nexo_leiloes")
      assert.equal(diagnostic.projeto, "nexo")
      assert.equal(diagnostic.hasChatId, true)
      assert.equal("message" in diagnostic, false)
      assert.equal(configDiagnostic.source, "public_chat_config")
      assert.equal(configDiagnostic.status, 200)
    },
  },
  {
    name: "service monta request core e controla esqueleto da execucao",
    run: async () => {
      const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"

      const coreRequest = buildCoreChatRequest(
        {
          message: "oi",
          identificadorExterno: "lead-9",
          canal: "web",
        },
        {
          projeto: { id: "proj-9" },
          agente: { id: "agent-9" },
        }
      )

      const result = await processChatRequest(
        {
          message: "oi",
          identificadorExterno: "lead-10",
          canal: "web",
        },
        {
          resolveChatChannel: async () => ({
            projeto: { id: "proj-10" },
            agente: { id: "agent-10" },
            widget: null,
            lockedToAgent: true,
            channel: { kind: "web" },
          }),
          ensureActiveChatSession: async () => ({
            chat: { id: "chat-10", projetoId: "proj-10" },
            created: false,
            initialContext: null,
          }),
          persistUserTurn: async () => ({ id: "msg-user-10" }),
          applyHandoffGuardrail: async () => ({ paused: false, handoff: null, result: null }),
          loadChatHistory: async () => [{ id: "msg-user-10", role: "user", conteudo: "oi" }],
          applyBillingGuardrail: async () => ({ blocked: false, billingAccess: null, result: null }),
          executeCore: async (request, prelude) => ({
            request,
            prelude,
            reply: "ok",
          }),
        }
      )

      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey

      assert.equal(coreRequest.projeto, "proj-9")
      assert.equal(coreRequest.agente, "agent-9")
      assert.equal(result.reply, "ok")
      assert.equal(result.request.projeto, "proj-10")
      assert.equal(result.request.agente, "agent-10")
      assert.equal(result.prelude.prelude.normalizedExternalIdentifier, "lead-10")
    },
  },
  {
    name: "service reutiliza chatId enviado pelo widget publico",
    run: async () => {
      const result = await processChatRequest(
        {
          chatId: "chat-widget-1",
          message: "oi",
          projeto: "proj-widget",
          agente: "agent-widget",
          canal: "external_widget",
          source: "site_widget",
        },
        {
          resolveChatChannel: async () => ({
            projeto: { id: "proj-widget", nome: "Projeto Widget", slug: "proj-widget" },
            agente: { id: "agent-widget", nome: "Agente Widget" },
            widget: null,
            lockedToAgent: true,
            channel: { kind: "external_widget" },
          }),
          getChatById: async (chatId: string) => ({
            id: chatId,
            status: "ativo",
            projetoId: "proj-widget",
            agenteId: "agent-widget",
            contexto: {},
            titulo: "Chat existente",
          }),
          createChat: async () => {
            throw new Error("createChat should not be called")
          },
          persistUserTurn: async () => ({ id: "msg-user-widget" }),
          applyHandoffGuardrail: async () => ({ paused: false, handoff: null, result: null }),
          loadChatHistory: async () => [{ id: "msg-user-widget", role: "user", conteudo: "oi" }],
          applyBillingGuardrail: async () => ({ blocked: false, billingAccess: null, result: null }),
          generateSalesReply: async () => ({
            reply: "ola pelo widget",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: { provider: "test", model: "test" },
          }),
          appendMessage: async (payload: any) => ({
            id: "msg-assistant-widget",
            role: "assistant",
            conteudo: payload.conteudo,
          }),
          updateChatContext: async () => null,
          updateChatStats: async () => null,
          registrarUso: async () => null,
        }
      )

      assert.equal(result.chatId, "chat-widget-1")
      assert.equal(result.reply, "ola pelo widget")
    },
  },
  {
    name: "service executa prelude runtime do v2 antes do miolo da ia",
    run: async () => {
      const runtime = await executeV2RuntimePrelude(
        {
          message: "oi",
          identificadorExterno: "lead-11",
          canal: "web",
          source: "site_widget",
        },
        {
          resolveChatChannel: async () => ({
            projeto: { id: "proj-11", nome: "Projeto 11", slug: "proj-11" },
            agente: { id: "agent-11", nome: "Agente 11" },
            widget: null,
            lockedToAgent: true,
            channel: { kind: "web" },
          }),
          findActiveChatByChannel: async () => null,
          findActiveWhatsAppChatByPhone: async () => null,
          createChat: async (payload: any) => ({ id: "chat-11", projetoId: "proj-11", ...payload }),
          uploadChatAttachmentPayloads: async () => [],
          appendMessage: async () => ({ id: "msg-user-11" }),
          getChatHandoffByChatId: async () => null,
          listChatMessages: async () => [{ id: "msg-user-11", role: "user", conteudo: "oi" }],
          verificarLimite: async () => ({ allowed: true, code: null, message: null }),
        }
      )

      assert.equal(runtime.stage, "ready_for_ai")
      assert.equal(runtime.session.chat.id, "chat-11")
      assert.equal(runtime.history.length, 1)
      assert.equal(runtime.billingState.blocked, false)
    },
  },
  {
    name: "service upload de anexos entra no prelude do v2",
    run: async () => {
      const uploaded = await uploadChatAttachmentPayloads(
        {
          projetoId: "proj-13",
          chatId: "chat-13",
          attachments: [
            {
              name: "foto.png",
              type: "image/png",
              dataBase64: Buffer.from("abc").toString("base64"),
            },
          ],
        },
        {} as any
      ).catch(() => null)

      const metadata = getChatAttachmentsMetadata([
        {
          name: "foto.png",
          type: "image/png",
          size: 3,
          publicUrl: "https://example.com/foto.png",
          storagePath: "p-proj/c-chat/file.png",
          category: "image",
        },
      ])
      const runtime = await executeV2RuntimePrelude(
        {
          message: "oi",
          identificadorExterno: "lead-13",
          canal: "web",
          attachments: [{ name: "foto.png", type: "image/png", dataBase64: Buffer.from("abc").toString("base64") }],
        },
        {
          resolveChatChannel: async () => ({
            projeto: { id: "proj-13", nome: "Projeto 13", slug: "proj-13" },
            agente: { id: "agent-13", nome: "Agente 13" },
            widget: null,
            lockedToAgent: true,
            channel: { kind: "web" },
          }),
          ensureActiveChatSession: async () => ({
            chat: { id: "chat-13", projetoId: "proj-13", contexto: {} },
            created: false,
            initialContext: null,
          }),
          uploadChatAttachmentPayloads: async () => [
            {
              name: "foto.png",
              type: "image/png",
              size: 3,
              publicUrl: "https://example.com/foto.png",
              storagePath: "p-proj/c-chat/file.png",
              category: "image",
            },
          ],
          persistUserTurn: async (payload: any) => payload,
          getChatHandoffByChatId: async () => null,
          loadChatHistory: async () => [],
          applyBillingGuardrail: async () => ({ blocked: false, billingAccess: null, result: null }),
        }
      )

      assert.equal(Array.isArray(metadata), true)
      assert.equal(metadata[0]?.name, "foto.png")
      assert.equal(runtime.uploadedInboundAttachments.length, 1)
      assert.equal(runtime.uploadedInboundAttachments[0]?.category, "image")
      assert.equal(uploaded === null || Array.isArray(uploaded), true)
    },
  },
  {
    name: "service fecha turno da ia pelo fluxo local do v2",
    run: async () => {
      const runtimeState = {
        prelude: {
          message: "oi",
          channelKind: "web",
          normalizedExternalIdentifier: "lead-12",
          effectiveBody: { context: {} },
        },
        history: [{ role: "user", conteudo: "oi" }],
        session: {
          chat: { id: "chat-12", titulo: "Julia", projetoId: "proj-12", usuarioId: "user-12", contexto: {} },
          initialContext: {},
        },
        resolved: {
          projeto: { id: "proj-12", nome: "Projeto 12", slug: "proj-12" },
        },
      }
      const result = await finalizeV2AiTurn(
        runtimeState as any,
        {
          reply: "Encontrei algumas opcoes para voce.",
          followUpReply: "",
          assets: [{ id: "asset-12" }],
          usage: { inputTokens: 100, outputTokens: 50 },
          metadata: { provider: "openai", model: "gpt-4o-mini", routeStage: "sales", domainStage: "catalog" },
        },
        {
          appendMessage: async (payload: any) => ({ id: "msg-12", conteudo: payload.conteudo, ...payload }),
          updateChatContext: async () => {},
          updateChatStats: async () => {},
          registrarUso: async () => ({ ok: true }),
        }
      )

      assert.equal(result.chatId, "chat-12")
      assert.match(result.reply, /Encontrei algumas opcoes/i)
      assert.equal(result.assets.length, 1)
    },
  },
  {
    name: "service resolve canal local com projeto explicito e sem fallback padrao de widget",
    run: async () => {
      const explicit = await resolveChatChannel(
        {
          projeto: "proj-slug",
          agente: "agent-slug",
          canal: "web",
          identificadorExterno: "lead-11",
        },
        {
          getProjetoByIdentifier: async (identifier: string) => ({
            id: "proj-11",
            nome: "Projeto 11",
            slug: identifier,
          }),
          getAgenteByIdentifier: async (identifier: string, projetoId: string) => ({
            id: "agent-11",
            slug: identifier,
            projetoId,
            ativo: true,
          }),
          getChatWidgetByProjetoAgente: async ({ projetoId, agenteId }: { projetoId: string; agenteId: string }) => ({
            id: "widget-11",
            projetoId,
            agenteId,
          }),
        }
      )

      const fallback = await resolveChatChannel(
        {
          canal: "web",
          identificadorExterno: "lead-12",
        },
        {
          getChatWidgetBySlug: async () => null,
        }
      )

      assert.equal(explicit.projeto.id, "proj-11")
      assert.equal(explicit.agente.id, "agent-11")
      assert.equal(explicit.widget.id, "widget-11")
      assert.equal(explicit.channel.projeto, "proj-slug")
      assert.equal(explicit.lockedToAgent, true)
      assert.equal(fallback.projeto, null)
      assert.equal(fallback.agente, null)
      assert.equal(fallback.channel.widgetSlug, null)
    },
  },
  {
    name: "service atualiza contexto a partir do resultado da ia",
    run: () => {
      const nextContext = updateContextFromAiResult({
        nextContext: {
          catalogo: {
            ultimaBusca: "jogo de jantar",
          },
        },
        ai: {
          assets: [
            {
              id: "MLB1",
              nome: "Jogo de Jantar Porcelana",
              descricao: "R$ 2.990,00",
              targetUrl: "https://example.com/jantar",
              publicUrl: "https://example.com/jantar.jpg",
            },
          ],
          metadata: {
            catalogoProdutoAtual: {
              id: "MLB1",
              nome: "Jogo de Jantar Porcelana",
            },
          },
        },
        chatId: "chat-1",
        historyLengthSource: 7,
      })

      assert.equal(nextContext.catalogo.ultimosProdutos.length, 1)
      assert.equal(nextContext.catalogo.produtoAtual.id, "MLB1")
      assert.equal(nextContext.catalogo.snapshotTurnId, 7)
      assert.match(nextContext.catalogo.snapshotId, /chat-1:7:/)
    },
  },
  {
    name: "service prepara payload final da reply por canal",
    run: () => {
      const webPayload = prepareAiReplyPayload({
        channelKind: "web",
        ai: {
          reply:
            "Encontrei algumas opcoes para voce. Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo.",
          assets: [
            {
              id: "MLB1",
              nome: "Jogo de Jantar Porcelana",
              descricao: "Conjunto floral",
              targetUrl: "https://example.com/jantar",
            },
          ],
        },
        nextContext: {
          lead: { nome: "Julia" },
        },
        normalizedExternalIdentifier: "lead-1",
      })
      const whatsappPayload = prepareAiReplyPayload({
        channelKind: "whatsapp",
        ai: {
          reply:
            "Vou verificar o status para voce. Encontrei um produto interessante para voce, de forma natural, simpatica e acolhedora, .",
          assets: [
            {
              id: "MLB1",
              nome: "Jogo de Jantar Porcelana",
              descricao: "Conjunto floral",
              targetUrl: "https://example.com/jantar",
            },
          ],
        },
        nextContext: {
          whatsapp: {
            contactName: "Julia Rodrigues",
          },
        },
        normalizedExternalIdentifier: "5511999999999",
      })

      assert.match(webPayload.primaryReply, /Encontrei algumas opcoes/i)
      assert.match(webPayload.followUpReply, /me diga se gostou de algum/i)
      assert.equal(webPayload.leadNameForTitle, "Julia")
      assert.doesNotMatch(whatsappPayload.primaryReply, /vou verificar|acolhedora/i)
      assert.equal(whatsappPayload.whatsappEmbeddedSequence.length, 2)
      assert.equal(whatsappPayload.whatsappContactNameForTitle, "Julia Rodrigues")
      assert.equal(whatsappPayload.contactSnapshot.contatoTelefone, "5511999999999")
    },
  },
  {
    name: "service resolve ou cria sessao de chat ativa",
    run: async () => {
      const resolved = {
        projeto: { id: "proj-20", nome: "Projeto 20", slug: "proj-20" },
        agente: { id: "agent-20", nome: "Agente 20" },
        widget: { id: "widget-20", slug: "widget-20", whatsappCelular: "5511999999999" },
        lockedToAgent: true,
        channel: { kind: "whatsapp" },
      }
      const contactSnapshot = {
        contatoNome: "Julia Rodrigues",
        contatoTelefone: "5511999999999",
        contatoAvatarUrl: "https://example.com/julia.jpg",
      }
      const initialContext = buildInitialChatContext({
        resolved,
        extraContext: { lead: { origem: "site" } },
        channelKind: "whatsapp",
        normalizedExternalIdentifier: "5511999999999",
      })
      const fallbackTitle = buildFallbackChatTitle({
        message: "quero saber mais sobre o produto",
        contactSnapshot,
      })

      const reused = await ensureActiveChatSession(
        {
          resolved,
          channelKind: "whatsapp",
          normalizedExternalIdentifier: "5511999999999",
          whatsappChannelId: "wa-20",
          contactSnapshot,
          message: "oi",
          extraContext: { lead: { origem: "site" } },
        },
        {
          findActiveChatByChannel: async () => ({ id: "chat-existing" }),
          findActiveWhatsAppChatByPhone: async () => null,
          createChat: async () => ({ id: "chat-created" }),
        }
      )

      const created = await ensureActiveChatSession(
        {
          resolved,
          channelKind: "whatsapp",
          normalizedExternalIdentifier: "5511999999999",
          whatsappChannelId: "wa-20",
          contactSnapshot,
          message: "oi",
          extraContext: { lead: { origem: "site" } },
        },
        {
          findActiveChatByChannel: async () => null,
          findActiveWhatsAppChatByPhone: async () => null,
          createChat: async (payload: any) => ({
            id: "chat-created",
            ...payload,
          }),
        }
      )

      assert.equal(initialContext.channel.kind, "whatsapp")
      assert.equal(initialContext.agente.locked, true)
      assert.equal(initialContext.widget.slug, "widget-20")
      assert.equal(fallbackTitle, "Julia Rodrigues")
      assert.equal(reused.chat.id, "chat-existing")
      assert.equal(reused.created, false)
      assert.equal(created.chat.id, "chat-created")
      assert.equal(created.created, true)
      assert.equal(created.initialContext.channel.external_id, "5511999999999")
    },
  },
  {
    name: "service persiste turno do usuario e carrega historico",
    run: async () => {
      const metadata = buildUserMessageMetadata({
        source: "admin_attendance_v2",
        channelKind: "web",
        attachments: [{ id: "att-1", name: "arquivo.pdf" }],
      })
      const userMessage = await persistUserTurn(
        {
          chatId: "chat-30",
          message: "oi quero atendimento",
          channelKind: "web",
          normalizedExternalIdentifier: "lead-30",
          source: "admin_attendance_v2",
          attachments: [{ id: "att-1", name: "arquivo.pdf" }],
        },
        {
          appendMessage: async (payload: any) => ({
            id: "msg-30",
            ...payload,
          }),
        }
      )
      const history = await loadChatHistory("chat-30", {
        listChatMessages: async (chatId: string) => [
          {
            id: "msg-1",
            chatId,
            role: "user",
            conteudo: "oi quero atendimento",
          },
          {
            id: "msg-2",
            chatId,
            role: "assistant",
            conteudo: "como posso ajudar?",
          },
        ],
      })

      assert.equal(metadata.source, "admin_attendance_v2")
      assert.equal(Array.isArray(metadata.attachments), true)
      assert.equal(userMessage.id, "msg-30")
      assert.equal(userMessage.role, "user")
      assert.equal(history.length, 2)
      assert.equal(history[1]?.role, "assistant")
    },
  },
  {
    name: "service persiste contexto e stats da assistente",
    run: async () => {
      const calls: Array<{ type: string; payload: any }> = []

      await persistAssistantState(
        {
          chatId: "chat-40",
          nextContext: {
            lead: { nome: "Julia Rodrigues" },
            channel: { kind: "whatsapp", external_id: "5511999999999" },
          },
          totalTokensToAdd: 33,
          totalCustoToAdd: 0.12,
          titulo: "Julia Rodrigues",
          normalizedExternalIdentifier: "5511999999999",
          contactSnapshot: {
            contatoNome: "Julia Rodrigues",
            contatoTelefone: "5511999999999",
            contatoAvatarUrl: "https://example.com/julia.jpg",
          },
        },
        {
          updateChatContext: async (chatId: string, contexto: any) => {
            calls.push({ type: "context", payload: { chatId, contexto } })
          },
          updateChatStats: async (payload: any) => {
            calls.push({ type: "stats", payload })
          },
        }
      )

      assert.equal(calls.length, 2)
      assert.equal(calls[0]?.type, "context")
      assert.equal(calls[1]?.type, "stats")
      assert.equal(calls[1]?.payload.totalTokensToAdd, 33)
      assert.equal(calls[1]?.payload.titulo, "Julia Rodrigues")
      assert.equal(calls[1]?.payload.contatoTelefone, "5511999999999")
    },
  },
  {
    name: "service aplica guardrail de billing quando projeto esta bloqueado",
    run: async () => {
      const blockedResult = buildBillingBlockedResult("chat-50", "Projeto bloqueado por limite.")
      const blocked = await applyBillingGuardrail(
        {
          projetoId: "proj-50",
          chatId: "chat-50",
        },
        {
          verificarLimite: async () => ({
            allowed: false,
            code: "project_blocked",
            message: "Projeto bloqueado por limite.",
          }),
        }
      )
      const allowed = await applyBillingGuardrail(
        {
          projetoId: "proj-51",
          chatId: "chat-51",
        },
        {
          verificarLimite: async () => ({
            allowed: true,
            code: null,
            message: null,
          }),
        }
      )

      assert.equal(blockedResult.chatId, "chat-50")
      assert.equal(blockedResult.reply, "Projeto bloqueado por limite.")
      assert.equal(blocked.blocked, true)
      assert.equal(blocked.result.reply, "Projeto bloqueado por limite.")
      assert.equal(allowed.blocked, false)
      assert.equal(allowed.result, null)
    },
  },
  {
    name: "service aplica pausa por handoff humano e solicita handoff runtime",
    run: async () => {
      const paused = await applyHandoffGuardrail(
        {
          chatId: "chat-60",
        },
        {
          getChatHandoffByChatId: async () => ({
            id: "handoff-60",
            chatId: "chat-60",
            status: "human",
          }),
        }
      )
      const running = await applyHandoffGuardrail(
        {
          chatId: "chat-61",
        },
        {
          getChatHandoffByChatId: async () => ({
            id: "handoff-61",
            chatId: "chat-61",
            status: "bot",
          }),
        }
      )
      const requested = await requestRuntimeHumanHandoff(
        {
          chatId: "chat-62",
          projetoId: "proj-62",
          canalWhatsappId: "wa-62",
          channelKind: "whatsapp",
          motivo: "Cliente pediu atendimento humano.",
          metadata: { trigger: "message_intent" },
        },
        {
          requestHumanHandoff: async (payload: any) => ({
            id: "handoff-62",
            ...payload,
            status: "pending_human",
          }),
        }
      )

      assert.equal(shouldPauseAssistantForHandoff({ status: "human" } as any), true)
      assert.equal(paused.paused, true)
      assert.equal(paused.result.chatId, "chat-60")
      assert.equal(running.paused, false)
      assert.equal(requested.handoff.status, "pending_human")
      assert.match(requested.acknowledgement, /WhatsApp/i)
    },
  },
  {
    name: "service calcula custo, telemetria e persiste uso",
    run: async () => {
      const resolvedModel = resolvePricingModel("gpt4o-mini")
      const estimated = estimateOpenAICostUsd(1000, 500, "gpt-4o-mini")
      const origin = buildChatUsageOrigin({
        channelKind: "whatsapp",
        provider: "openai",
        routeStage: "sales",
        domainStage: "catalog",
      })
      const telemetry = buildChatUsageTelemetry({
        channelKind: "whatsapp",
        provider: "openai",
        model: "gpt-4o-mini",
        routeStage: "sales",
        heuristicStage: "catalog_reference",
        domainStage: "catalog",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostUsd: estimated,
      })
      const payload = buildUsagePersistencePayload({
        projetoId: "proj-70",
        usuarioId: "user-70",
        referenciaId: "msg-70",
        channelKind: "whatsapp",
        inputTokens: 1000,
        outputTokens: 500,
        aiMetadata: {
          provider: "openai",
          model: "gpt-4o-mini",
          routeStage: "sales",
          heuristicStage: "catalog_reference",
          domainStage: "catalog",
        },
      })
      const persisted = await persistUsageRecord(payload.usageRecord, {
        registrarUso: async (...args: any[]) => ({ ok: true, args }),
      })

      assert.equal(resolvedModel, "gpt-4o-mini")
      assert.ok(estimated > 0)
      assert.equal(origin, "chat:whatsapp:openai:sales:catalog")
      assert.equal(telemetry.totalTokens, 1500)
      assert.equal(payload.usageTelemetry.billingOrigin, "chat:whatsapp:openai:sales:catalog")
      assert.equal(payload.usageRecord.tokens, 1500)
      assert.equal(persisted.ok, true)
      assert.equal(persisted.args[0], "proj-70")
    },
  },
  {
    name: "service persiste resposta da assistente e monta retorno final",
    run: async () => {
      const metadata = buildAssistantMessageMetadata({
        aiMetadata: { provider: "openai", model: "gpt-4o-mini" },
        usageTelemetry: {
          billingOrigin: "chat:web:openai:sales:catalog",
        },
        assets: [{ id: "asset-1" }],
      })
      const assistantMessage = await persistAssistantTurn(
        {
          chatId: "chat-80",
          content: "Encontrei algumas opcoes para voce.",
          channelKind: "web",
          normalizedExternalIdentifier: "lead-80",
          tokensInput: 100,
          tokensOutput: 50,
          custo: 0.01,
          aiMetadata: { provider: "openai", model: "gpt-4o-mini" },
          usageTelemetry: { billingOrigin: "chat:web:openai:sales:catalog" },
          assets: [{ id: "asset-1" }],
          followUpReply: false,
        },
        {
          appendMessage: async (payload: any) => ({
            id: "msg-80",
            ...payload,
          }),
        }
      )
      const finalResult = buildFinalChatResult({
        chatId: "chat-80",
        channelKind: "web",
        reply: "Encontrei algumas opcoes para voce.",
        followUpReply: "Se quiser, trago mais.",
        messageSequence: [],
        assets: [{ id: "asset-1" }],
        whatsapp: null,
      })

      assert.equal(metadata.provider, "openai")
      assert.equal(Array.isArray(metadata.assets), true)
      assert.equal(assistantMessage.id, "msg-80")
      assert.equal(assistantMessage.role, "assistant")
      assert.equal(finalResult.chatId, "chat-80")
      assert.equal(finalResult.followUpReply, "Se quiser, trago mais.")
      assert.equal(finalResult.assets.length, 1)
    },
  },
  {
    name: "service propaga falha do orquestrador local",
    run: async () => {
      let failed = false
      try {
        await processChatRequest(
          {
            message: "oi",
            identificadorExterno: "lead-90",
            canal: "web",
          },
          {
            resolveChatChannel: async () => ({
              projeto: { id: "proj-90", nome: "Projeto 90", slug: "proj-90" },
              agente: { id: "agent-90", nome: "Agente 90" },
              widget: null,
              lockedToAgent: true,
              channel: { kind: "web" },
            }),
            ensureActiveChatSession: async () => ({
              chat: { id: "chat-90", projetoId: "proj-90", contexto: {} },
              created: false,
              initialContext: null,
            }),
            persistUserTurn: async () => ({ id: "msg-user-90" }),
            applyHandoffGuardrail: async () => ({ paused: false, handoff: null, result: null }),
            loadChatHistory: async () => [{ id: "msg-user-90", role: "user", conteudo: "oi" }],
            applyBillingGuardrail: async () => ({ blocked: false, billingAccess: null, result: null }),
            generateSalesReply: async () => {
              throw new Error("orchestrator failed")
            },
          }
        )
      } catch (error) {
        failed = /orchestrator failed/i.test(String(error))
      }

      assert.equal(failed, true)
    },
  },
  {
    name: "chats normaliza snapshot, mapeia registros e encontra conversas whatsapp",
    run: () => {
      const mappedChat = mapChat({
        id: "chat-1",
        titulo: "  Julia  ",
        contato_nome: null,
        contato_telefone: null,
        contato_avatar_url: null,
        status: "ativo",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        total_tokens: 5,
        total_custo: 1.23,
        agente_id: "agent-1",
        usuario_id: "user-1",
        projeto_id: "proj-1",
        canal: "whatsapp",
        identificador_externo: "5511999999999",
        contexto: {
          whatsapp: {
            channelId: "wa-1",
            remotePhone: "55 11 99999-9999",
            profilePicUrl: "https://example.com/julia.jpg",
          },
          lead: {
            nome: "Julia Rodrigues",
          },
        },
      })
      const mappedMessage = mapMensagem({
        id: "msg-1",
        chat_id: "chat-1",
        role: "assistant",
        conteudo: "ola",
        canal: "whatsapp",
        identificador_externo: "5511999999999",
        tokens_input: 10,
        tokens_output: 20,
        custo: 0.05,
        metadata: { ok: true },
        created_at: "2026-01-01T00:00:00.000Z",
      })
      const snapshot = extractChatContactSnapshot(mappedChat.contexto, mappedChat.identificadorExterno)
      const byScope = findChatByChannelScope([mappedChat], "wa-1")
      const byPhone = findChatByWhatsAppPhone([mappedChat], {
        phone: "+55 (11) 99999-9999",
        channelScopeId: "wa-1",
      })
      const normalizedPhone = normalizeWhatsAppLookupPhone("55 11 99999-9999")
      const context = getChatContext(mappedChat)

      assert.equal(mappedChat.titulo, "Julia")
      assert.equal(mappedMessage.role, "assistant")
      assert.equal(snapshot.contatoNome, "Julia Rodrigues")
      assert.equal(snapshot.contatoAvatarUrl, "https://example.com/julia.jpg")
      assert.equal(normalizedPhone, "11999999999")
      assert.equal(byScope?.id, "chat-1")
      assert.equal(byPhone?.id, "chat-1")
      assert.equal(context.lead.nome, "Julia Rodrigues")
    },
  },
  {
    name: "heuristicas de busca recuperam typo simples",
    run: () => {
      const isAck = isGreetingOrAckMessage("oi", { normalizeText: normalizeFixtureText });
      const candidates = buildProductSearchCandidates("vc tem soperia", {
        normalizeText: normalizeFixtureText,
        isGreetingOrAckMessage: (message: string) => isGreetingOrAckMessage(message, { normalizeText: normalizeFixtureText }),
      });

      assert.equal(isAck, true);
      assert.ok(candidates.some((item: string) => /sopeira/i.test(item)));
    },
  },
];

async function main() {
  for (const testCase of tests) {
    await testCase.run();
    console.log(`PASS ${testCase.name}`);
  }

  console.log(`\n${tests.length} smoke tests passed.`);
}

main().catch((error) => {
  console.error("Smoke tests failed.");
  console.error(error);
  process.exit(1);
});
