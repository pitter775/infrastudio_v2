import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";

loadEnvConfig(process.cwd());

import { normalizeAgentRuntimeConfig } from "@/lib/agent-runtime-config";
import { scoreMercadoLivreItem } from "@/lib/mercado-livre/mappers";
import {
  appendOptionalHumanOffer,
  applyAdminTestContextOverrides,
  applyBillingGuardrail,
  applyHandoffGuardrail,
  buildApiFallbackReply,
  buildApiDecisionFromSemanticIntent,
  buildAiObservability,
  buildAssistantMessageMetadata,
  buildBillingContextUpdate,
  buildBillingDecisionFromSemanticIntent,
  buildBillingReplyResult,
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
  buildFocusedProductFactualReply,
  enforceMercadoLivreSearchReplyCoherence,
  buildInitialChatContext,
  buildIsolatedChatResult,
  buildCoreChatRequest,
  buildUsagePersistencePayload,
  buildUserMessageMetadata,
  buildNextContext,
  buildSilentChatResult,
  buildFocusedApiContext,
  resolveApiCatalogReply,
  formatPublicChatResult,
  buildHumanHandoffReply,
  buildLeadNameAcknowledgementReply,
  buildProductSearchCandidates,
  buildPublicChatRequestDiagnostics,
  buildSystemPrompt,
  buildWhatsAppMessageSequence,
  getChatAttachmentsMetadata,
  classifyHumanEscalationNeed,
  resolveCatalogLoadMoreDecision,
  resolveRecentCatalogReferenceDecision,
  resolveDeterministicCatalogFollowUpDecision,
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
  prepareAiReplyPayload,
  processChatRequest,
  prepareChatPrelude,
  persistUserTurn,
  persistAssistantState,
  resolveCanonicalWhatsAppExternalIdentifier,
  resolveChatChannel,
  resolveChatContactSnapshot,
  resolveChatDomainRoute,
  resolveConversationPipelineStageState,
  resolveCatalogDecisionState,
  resolveCatalogIntentState,
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
    name: "runtime config do agente normaliza para chaves realmente usadas",
    run: () => {
      const normalized = normalizeAgentRuntimeConfig({
        business: {
          summary: "  Atendimento consultivo  ",
          services: ["Site", "Site", "  Chat IA  ", ""],
        },
        leadCapture: {
          deferOnQuestions: true,
          promptWeb: " Como posso te chamar? ",
        },
        pricingCatalog: {
          enabled: true,
          items: [
            {
              slug: "site",
              name: "Criacao de site",
              matchAny: ["site", " site ", ""],
              priceLabel: "R$300 a R$1000",
              ignored: "x",
            },
          ],
        },
        extra: {
          noise: true,
        },
      });

      assert.deepEqual(normalized, {
        business: {
          summary: "Atendimento consultivo",
          services: ["Site", "Chat IA"],
        },
        leadCapture: {
          deferOnQuestions: true,
          promptWeb: "Como posso te chamar?",
        },
        pricingCatalog: {
          enabled: true,
          items: [
            {
              slug: "site",
              name: "Criacao de site",
              matchAny: ["site"],
              priceLabel: "R$300 a R$1000",
            },
          ],
        },
      });
    },
  },
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
    name: "billing estruturado responde campo factual e persiste foco do plano",
    run: () => {
      const runtimeConfig = {
        pricingCatalog: {
          enabled: true,
          items: [
            {
              slug: "plus",
              name: "Plano Plus",
              matchAny: ["plus", "plano plus"],
              priceLabel: "R$ 79,90/mes",
              attendanceLimit: 250,
              agentLimit: 2,
              creditLimit: 400000,
              whatsappIncluded: true,
              supportLevel: "prioritario",
              features: ["chat widget", "faq"],
              channels: ["web", "whatsapp"],
            },
          ],
        },
      }

      const decision = buildBillingDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "plan_limit_question",
          confidence: 0.95,
          reason: "cliente pediu capacidade do plano",
          requestedPlanNames: ["Plano Plus"],
          targetField: "attendance_limit",
          usedLlm: true,
        },
      })

      const reply = buildBillingReplyResult(runtimeConfig, { channel: { kind: "web" } }, decision)
      const contextUpdate = buildBillingContextUpdate(decision, runtimeConfig, { billing: {} })

      assert.equal(decision?.kind, "plan_limit_question")
      assert.equal(decision?.targetField, "attendance_limit")
      assert.match(reply?.reply ?? "", /Plano Plus comporta 250 atendimentos/i)
      assert.equal(reply?.metadata?.fieldFound, true)
      assert.equal(contextUpdate?.planFocus?.slug, "plus")
      assert.equal(contextUpdate?.lastField, "attendance_limit")
    },
  },
  {
    name: "billing estruturado falha fechado sem campo factual no catalogo",
    run: () => {
      const runtimeConfig = {
        pricingCatalog: {
          enabled: true,
          items: [
            {
              slug: "plus",
              name: "Plano Plus",
              matchAny: ["plus", "plano plus"],
              priceLabel: "R$ 79,90/mes",
            },
          ],
        },
      }

      const reply = buildBillingReplyResult(
        runtimeConfig,
        {
          channel: { kind: "web" },
          billing: {
            planFocus: {
              slug: "plus",
              name: "Plano Plus",
            },
          },
        },
        {
          kind: "plan_limit_question",
          targetField: "attendance_limit",
          requestedPlanNames: [],
        }
      )

      assert.match(reply?.reply ?? "", /Nao encontrei no catalogo limite estruturado de atendimentos/i)
      assert.equal(reply?.metadata?.fieldFound, false)
    },
  },
  {
    name: "service propaga billingContextUpdate para o contexto da conversa",
    run: () => {
      const updatedContext = updateContextFromAiResult({
        nextContext: {
          billing: {},
        },
        historyLengthSource: 1,
        chatId: "chat-billing-1",
        ai: {
          reply: "O plano Plus comporta 250 atendimentos.",
          assets: [],
          metadata: {
            billingContextUpdate: {
              planFocus: {
                slug: "plus",
                name: "Plano Plus",
                updatedAt: "2026-04-29T12:00:00.000Z",
              },
              lastIntent: "plan_limit_question",
              lastField: "attendance_limit",
              updatedAt: "2026-04-29T12:00:00.000Z",
            },
          },
        },
      })

      assert.equal(updatedContext.billing?.planFocus?.slug, "plus")
      assert.equal(updatedContext.billing?.lastIntent, "plan_limit_question")
      assert.equal(updatedContext.billing?.lastField, "attendance_limit")
    },
  },
  {
    name: "service preserva planFocus anterior quando billingContextUpdate nao troca o foco",
    run: () => {
      const updatedContext = updateContextFromAiResult({
        nextContext: {
          billing: {
            planFocus: {
              slug: "plus",
              name: "Plano Plus",
              updatedAt: "2026-04-29T12:00:00.000Z",
            },
          },
        },
        historyLengthSource: 1,
        chatId: "chat-billing-2",
        ai: {
          reply: "Estes sao os valores disponiveis.",
          assets: [],
          metadata: {
            billingContextUpdate: {
              lastIntent: "pricing_overview",
              lastField: "price",
              updatedAt: "2026-04-29T12:01:00.000Z",
            },
          },
        },
      })

      assert.equal(updatedContext.billing?.planFocus?.slug, "plus")
      assert.equal(updatedContext.billing?.lastIntent, "pricing_overview")
    },
  },
  {
    name: "service propaga comparisonFocus e lastFields de billing",
    run: () => {
      const updatedContext = updateContextFromAiResult({
        nextContext: {
          billing: {},
        },
        historyLengthSource: 1,
        chatId: "chat-billing-3",
        ai: {
          reply: "Comparacao pronta.",
          assets: [],
          metadata: {
            billingContextUpdate: {
              lastIntent: "plan_comparison",
              lastField: "attendance_limit",
              lastFields: ["attendance_limit", "agent_limit"],
              comparisonFocus: {
                plans: [
                  { slug: "plus", name: "Plus" },
                  { slug: "pro", name: "Pro" },
                ],
                fields: ["attendance_limit", "agent_limit"],
                updatedAt: "2026-04-29T12:02:00.000Z",
              },
              updatedAt: "2026-04-29T12:02:00.000Z",
            },
          },
        },
      })

      assert.deepEqual(updatedContext.billing?.lastFields, ["attendance_limit", "agent_limit"])
      assert.equal(updatedContext.billing?.comparisonFocus?.plans?.[0]?.slug, "plus")
      assert.equal(updatedContext.billing?.comparisonFocus?.fields?.[1], "agent_limit")
    },
  },
  {
    name: "billing comparacao estruturada inclui capacidade e canais quando existirem",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "basic",
                name: "Basic",
                matchAny: ["basic"],
                priceLabel: "R$ 29,90/mes",
                attendanceLimit: 100,
                agentLimit: 1,
                whatsappIncluded: false,
              },
              {
                slug: "pro",
                name: "Pro",
                matchAny: ["pro"],
                priceLabel: "R$ 149,90/mes",
                attendanceLimit: 500,
                agentLimit: 5,
                whatsappIncluded: true,
                supportLevel: "prioritario",
              },
            ],
          },
        },
        { channel: { kind: "web" } },
        {
          kind: "plan_comparison",
          requestedPlanNames: ["basic", "pro"],
        }
      )

      assert.match(reply?.reply ?? "", /Basic: R\$ 29,90\/mes \| Atendimentos: 100 atendimentos \| Agentes: 1 agente \| WhatsApp: Nao/i)
      assert.match(reply?.reply ?? "", /Pro: R\$ 149,90\/mes \| Atendimentos: 500 atendimentos \| Agentes: 5 agentes \| WhatsApp: Sim \| Suporte: prioritario/i)
    },
  },
  {
    name: "billing estruturado responde pergunta composta com mais de um slot",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "plus",
                name: "Plano Plus",
                matchAny: ["plus", "plano plus"],
                priceLabel: "R$ 79,90/mes",
                attendanceLimit: 250,
                whatsappIncluded: true,
              },
            ],
          },
        },
        {
          channel: { kind: "web" },
        },
        {
          kind: "plan_feature_question",
          requestedPlanNames: ["Plano Plus"],
          targetField: "whatsapp_included",
          targetFields: ["whatsapp_included", "attendance_limit"],
        }
      )

      assert.match(reply?.reply ?? "", /No plano Plano Plus, WhatsApp: Sim\./i)
      assert.match(reply?.reply ?? "", /O plano Plano Plus comporta 250 atendimentos\./i)
      assert.equal(reply?.metadata?.replyStrategy, "structured_plan_fact_multi")
    },
  },
  {
    name: "billing estruturado recomenda upgrade por capacidade usando foco atual",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "basic",
                name: "Basic",
                matchAny: ["basic"],
                priceLabel: "R$ 29,90/mes",
                attendanceLimit: 100,
              },
              {
                slug: "plus",
                name: "Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
                attendanceLimit: 250,
              },
              {
                slug: "pro",
                name: "Pro",
                matchAny: ["pro"],
                priceLabel: "R$ 149,90/mes",
                attendanceLimit: 500,
              },
            ],
          },
        },
        {
          channel: { kind: "web" },
          billing: {
            planFocus: {
              slug: "basic",
              name: "Basic",
            },
          },
        },
        {
          kind: "plan_recommendation",
          targetField: "attendance_limit",
          requestedPlanNames: [],
        }
      )

      assert.match(reply?.reply ?? "", /melhor proximo encaixe e o Plus/i)
      assert.match(reply?.reply ?? "", /O plano Plus comporta 250 atendimentos\./i)
    },
  },
  {
    name: "billing estruturado recomenda por multiplos criterios",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "basic",
                name: "Basic",
                matchAny: ["basic"],
                priceLabel: "R$ 29,90/mes",
                attendanceLimit: 100,
                agentLimit: 1,
                whatsappIncluded: false,
              },
              {
                slug: "plus",
                name: "Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
                attendanceLimit: 250,
                agentLimit: 2,
                whatsappIncluded: true,
              },
              {
                slug: "pro",
                name: "Pro",
                matchAny: ["pro"],
                priceLabel: "R$ 149,90/mes",
                attendanceLimit: 500,
                agentLimit: 5,
                whatsappIncluded: true,
              },
            ],
          },
        },
        { channel: { kind: "web" } },
        {
          kind: "plan_recommendation",
          targetField: "attendance_limit",
          targetFields: ["attendance_limit", "agent_limit", "whatsapp_included"],
          requestedPlanNames: [],
        }
      )

      assert.equal(reply?.metadata?.replyStrategy, "structured_plan_recommendation_multi")
      assert.match(reply?.reply ?? "", /Pro/i)
      assert.match(reply?.reply ?? "", /500 atendimentos/i)
      assert.match(reply?.reply ?? "", /5 agentes/i)
      assert.match(reply?.reply ?? "", /WhatsApp: Sim/i)
    },
  },
  {
    name: "billing recommendation aberta pede criterio de forma deterministica",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "basic",
                name: "Basic",
                matchAny: ["basic"],
                priceLabel: "R$ 29,90/mes",
                attendanceLimit: 100,
                agentLimit: 1,
                whatsappIncluded: false,
              },
              {
                slug: "plus",
                name: "Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
                attendanceLimit: 250,
                agentLimit: 2,
                whatsappIncluded: true,
              },
            ],
          },
        },
        { channel: { kind: "web" } },
        {
          kind: "plan_recommendation",
          targetField: "",
          targetFields: [],
          requestedPlanNames: [],
        }
      )

      assert.equal(reply?.metadata?.replyStrategy, "missing_recommendation_criterion")
      assert.match(reply?.reply ?? "", /preciso que voce priorize um criterio/i)
      assert.match(reply?.reply ?? "", /preco, atendimentos, agentes, WhatsApp ou suporte/i)
    },
  },
  {
    name: "billing follow-up consultivo apos comparacao usa comparisonFocus",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "plus",
                name: "Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
                attendanceLimit: 250,
                agentLimit: 2,
              },
              {
                slug: "pro",
                name: "Pro",
                matchAny: ["pro"],
                priceLabel: "R$ 149,90/mes",
                attendanceLimit: 500,
                agentLimit: 5,
              },
            ],
          },
        },
        {
          channel: { kind: "web" },
          billing: {
            comparisonFocus: {
              plans: [
                { slug: "plus", name: "Plus" },
                { slug: "pro", name: "Pro" },
              ],
              fields: ["attendance_limit", "agent_limit"],
            },
          },
        },
        {
          kind: "plan_recommendation",
          targetField: "",
          targetFields: [],
          requestedPlanNames: [],
        }
      )

      assert.equal(reply?.metadata?.replyStrategy, "structured_plan_recommendation_multi")
      assert.match(reply?.reply ?? "", /plano que mais faz sentido no catalogo hoje e o Pro/i)
      assert.match(reply?.reply ?? "", /500 atendimentos/i)
      assert.match(reply?.reply ?? "", /5 agentes/i)
    },
  },
  {
    name: "billing fail-closed com catalogo incompleto mostra campos disponiveis",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "plus",
                name: "Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
                whatsappIncluded: true,
              },
            ],
          },
        },
        {
          channel: { kind: "web" },
          billing: {
            planFocus: {
              slug: "plus",
              name: "Plus",
            },
          },
        },
        {
          kind: "plan_limit_question",
          targetField: "attendance_limit",
          targetFields: ["attendance_limit"],
          requestedPlanNames: [],
        }
      )

      assert.match(reply?.reply ?? "", /Nao encontrei no catalogo limite estruturado de atendimentos/i)
      assert.match(reply?.reply ?? "", /Hoje eu tenho estruturado: preco, whatsapp\./i)
    },
  },
  {
    name: "billing comparacao multi-slot usa campos pedidos e define comparisonFocus",
    run: () => {
      const runtimeConfig = {
        pricingCatalog: {
          enabled: true,
          items: [
            {
              slug: "plus",
              name: "Plus",
              matchAny: ["plus"],
              priceLabel: "R$ 79,90/mes",
              attendanceLimit: 250,
              agentLimit: 2,
            },
            {
              slug: "pro",
              name: "Pro",
              matchAny: ["pro"],
              priceLabel: "R$ 149,90/mes",
              attendanceLimit: 500,
              agentLimit: 5,
            },
          ],
        },
      }

      const reply = buildBillingReplyResult(
        runtimeConfig,
        { channel: { kind: "web" } },
        {
          kind: "plan_comparison",
          requestedPlanNames: ["plus", "pro"],
          targetField: "attendance_limit",
          targetFields: ["attendance_limit", "agent_limit"],
        }
      )
      const update = buildBillingContextUpdate(
        {
          kind: "plan_comparison",
          requestedPlanNames: ["plus", "pro"],
          targetField: "attendance_limit",
          targetFields: ["attendance_limit", "agent_limit"],
        },
        runtimeConfig,
        { billing: {} }
      )

      assert.equal(reply?.metadata?.replyStrategy, "structured_plan_comparison_multi")
      assert.match(reply?.reply ?? "", /Atendimentos: Plus 250 atendimentos \| Pro 500 atendimentos\./i)
      assert.match(reply?.reply ?? "", /Agentes: Plus 2 agentes \| Pro 5 agentes\./i)
      assert.equal(update?.comparisonFocus?.plans?.[0]?.slug, "plus")
      assert.deepEqual(update?.lastFields, ["attendance_limit", "agent_limit"])
    },
  },
  {
    name: "billing comparacao usa comparisonFocus do contexto em follow-up sem repetir planos",
    run: () => {
      const reply = buildBillingReplyResult(
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "plus",
                name: "Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
                agentLimit: 2,
              },
              {
                slug: "pro",
                name: "Pro",
                matchAny: ["pro"],
                priceLabel: "R$ 149,90/mes",
                agentLimit: 5,
              },
            ],
          },
        },
        {
          channel: { kind: "web" },
          billing: {
            comparisonFocus: {
              plans: [
                { slug: "plus", name: "Plus" },
                { slug: "pro", name: "Pro" },
              ],
              fields: ["attendance_limit", "agent_limit"],
            },
          },
        },
        {
          kind: "plan_comparison",
          requestedPlanNames: [],
          targetField: "agent_limit",
          targetFields: ["agent_limit"],
        }
      )

      assert.match(reply?.reply ?? "", /Agentes: Plus 2 agentes \| Pro 5 agentes\./i)
      assert.match(reply?.reply ?? "", /Pro lidera em agentes\./i)
    },
  },
  {
    name: "catalogo resolve item recente e segura ambiguidade",
    run: () => {
      const loadMore = resolveCatalogLoadMoreDecision("manda o q tiver");
      const broadLoadMoreWithoutList = resolveCatalogLoadMoreDecision("outras", { catalogo: { ultimaBusca: "" } } as never);
      const broadLoadMoreWithList = resolveCatalogLoadMoreDecision("outras", catalogContext as never);
      const notLoadMore = resolveCatalogLoadMoreDecision("me fala mais dele");
      const reference = resolveDeterministicCatalogFollowUpDecision("gostei da sopeira que mandou", catalogContext as never, deps as never);
      const ambiguous = resolveDeterministicCatalogFollowUpDecision("gostei desse", catalogContext as never, deps as never);
      const directReference = resolveRecentCatalogReferenceDecision("gostei desse", catalogContext as never);
      const weakReference = resolveRecentCatalogReferenceDecision("quero bonito", catalogContext as never);
      const bareRequestReference = resolveRecentCatalogReferenceDecision("quero", catalogContext as never);
      const shortSearch = resolveRecentCatalogReferenceDecision("saleiro azul", catalogContext as never);
      const weakRefinement = resolveDeterministicCatalogFollowUpDecision("quero bonito", catalogContext as never, deps as never);
      const vagueSearch = resolveDeterministicCatalogFollowUpDecision("saleiro", catalogContext as never, deps as never);
      const singleRecentReference = resolveRecentCatalogReferenceDecision(
        "gostei desse",
        { catalogo: { ultimosProdutos: [catalogContext.catalogo?.ultimosProdutos?.[0]] } } as never
      );
      const resolved = resolveRecentCatalogProductReference("gostei da dopeira que mandou", catalogContext as never);
      const resolvedByOrder = resolveRecentCatalogProductReference("quero o segundo", catalogContext as never);
      const resolvedUniqueAmongMany = resolveRecentCatalogProductReference("quero o floral", catalogContext as never);

      assert.equal(loadMore?.kind, "catalog_load_more");
      assert.equal(broadLoadMoreWithoutList, null);
      assert.equal(broadLoadMoreWithList?.kind, "catalog_load_more");
      assert.equal(notLoadMore, null);
      assert.equal(reference?.kind, "recent_product_reference");
      assert.equal(ambiguous?.kind, "recent_product_reference_unresolved");
      assert.equal(directReference?.kind, "recent_product_reference_unresolved");
      assert.equal(weakReference, null);
      assert.equal(bareRequestReference, null);
      assert.equal(shortSearch, null);
      assert.equal(weakRefinement, null);
      assert.equal(vagueSearch, null);
      assert.equal(singleRecentReference?.kind, "recent_product_reference");
      assert.equal(resolved.length, 1);
      assert.equal(resolvedByOrder.length, 1);
      assert.equal(resolvedByOrder[0]?.id, "MLB2");
      assert.equal(resolvedUniqueAmongMany.length, 1);
      assert.equal(resolvedUniqueAmongMany[0]?.id, "MLB3");
    },
  },
  {
    name: "catalogo explicito falha fechado sem listingSession valida",
    run: () => {
      const decision = resolveCatalogDecisionState({
        latestUserMessage: "Ver mais opcoes",
        context: {
          ui: {
            catalogAction: "load_more",
            listingSessionId: "sessao-antiga",
          },
          catalogo: {
            ultimaBusca: "",
            ultimosProdutos: [],
          },
        },
        semanticDecision: null,
        shouldUseCatalog: true,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        shouldSearchProducts: deps.shouldSearchProducts,
      })

      assert.equal(decision.catalogDecision?.kind, "explicit_cannot_continue_listing")
      assert.equal(decision.catalogReferenceReply, null)
    },
  },
  {
    name: "service propaga listingSession e productFocus no contexto e nos assets",
    run: () => {
      const updatedContext = updateContextFromAiResult({
        nextContext: {
          conversation: {
            mode: "listing",
          },
          catalogo: {
            ultimaBusca: "inox",
            paginationOffset: 0,
            paginationNextOffset: 3,
            paginationPoolLimit: 24,
            paginationHasMore: true,
            paginationTotal: 6,
          },
        },
        chatId: "chat-1",
        historyLengthSource: 4,
        ai: {
          reply: "Encontrei 6 opcoes. Vou te mostrar 3 agora.",
          assets: [
            {
              id: "MLB1",
              kind: "product",
              provider: "mercado_livre",
              nome: "Balde Inox",
            },
          ],
          metadata: {
            catalogoBusca: {
              ultimaBusca: "inox",
              paginationOffset: 0,
              paginationNextOffset: 3,
              paginationPoolLimit: 24,
              paginationHasMore: true,
              paginationTotal: 6,
              ultimosProdutos: [
                { id: "MLB1", nome: "Balde Inox" },
                { id: "MLB2", nome: "Saleiro Inox" },
                { id: "MLB3", nome: "Conjunto Inox" },
              ],
            },
            catalogoProdutoAtual: {
              id: "MLB1",
              nome: "Balde Inox",
            },
          },
        },
      })

      const payload = prepareAiReplyPayload({
        channelKind: "web",
        ai: {
          reply: "Encontrei 6 opcoes. Vou te mostrar 3 agora.",
          assets: [
            {
              id: "MLB1",
              kind: "product",
              provider: "mercado_livre",
              nome: "Balde Inox",
            },
          ],
        },
        nextContext: updatedContext,
        normalizedExternalIdentifier: "lead-1",
        userMessage: "tem inox?",
        agendaSlots: [],
      })

      assert.equal(updatedContext.catalogo?.listingSession?.searchTerm, "inox")
      assert.equal(updatedContext.catalogo?.listingSession?.nextOffset, 3)
      assert.deepEqual(updatedContext.catalogo?.listingSession?.matchedProductIds, ["MLB1", "MLB2", "MLB3"])
      assert.equal(updatedContext.catalogo?.productFocus?.productId, "MLB1")
      assert.equal(payload.assets[0]?.metadata?.listingSessionId, updatedContext.catalogo?.listingSession?.id)
      assert.equal(payload.catalogMessageMode, "append_listing")
      assert.equal(payload.catalogListingSessionId, updatedContext.catalogo?.listingSession?.id)
      assert.equal(
        payload.actions.find((action: any) => action?.extraContext?.ui?.catalogAction === "load_more")?.extraContext?.ui?.listingSessionId,
        updatedContext.catalogo?.listingSession?.id
      )
    },
  },
  {
    name: "orquestrador responde explicitamente quando load_more chega sem sessao valida",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "Ver mais opcoes" }] as never,
        {
          agente: {
            id: "agent-catalog-explicit-load-more",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-explicit-load-more",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          ui: {
            catalogAction: "load_more",
            listingSessionId: "sessao-expirada",
          },
          catalogo: {
            ultimaBusca: "",
            ultimosProdutos: [],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar sem sessao valida")
          },
        }
      )

      assert.match(result.reply, /nao consegui continuar essa lista agora/i)
      assert.equal(result.assets.length, 0)
    },
  },
  {
    name: "catalogo bloqueia nova busca quando follow-up recente ficou ambiguo sem match textual",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "gostei desse" }] as never,
        {
          agente: {
            id: "agent-catalog-2",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-2",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimosProdutos: [
              {
                id: "MLB6540079826",
                nome: "Aparelho De Jantar Oxford Ceramica",
                descricao: "R$ 358,00 - 1 em estoque",
              },
              {
                id: "MLB6540148274",
                nome: "Aparelho De Jantar Oxford Ceramica Folk 20 Pecas",
                descricao: "R$ 730,00 - 1 em estoque",
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
        }
      );

      assert.ok(["local_heuristic", "mercado_livre_runtime"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /quero confirmar qual voce quis dizer/i);
      assert.match(result.reply, /1\. Aparelho De Jantar Oxford Ceramica/i);
      assert.match(result.reply, /2\. Aparelho De Jantar Oxford Ceramica Folk 20 Pecas/i);
      assert.match(result.reply, /me responde com 1, 2 ou 3/i);
    },
  },
  {
    name: "catalogo nao abre busca nova quando lista ativa recebe pergunta factual sem item em foco",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "tem garantia?" }] as never,
        {
          agente: {
            id: "agent-catalog-list-fact-question",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-list-fact-question",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          conversation: { mode: "listing" },
          storefront: { kind: "mercado_livre", pageKind: "storefront" },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimaBusca: "inox",
            listingSession: {
              id: "sessao-inox-garantia",
              snapshotId: "snapshot-inox-garantia",
              searchTerm: "inox",
              matchedProductIds: ["MLB1", "MLB2", "MLB3"],
              offset: 0,
              nextOffset: 3,
              poolLimit: 24,
              hasMore: true,
              total: 3,
              source: "storefront_snapshot",
            },
            ultimosProdutos: [
              {
                id: "MLB1",
                nome: "Conjunto Bules Inox",
                descricao: "R$ 287,10 - 1 em estoque",
              },
              {
                id: "MLB2",
                nome: "Conjunto 2 Baldes de Gelo Inox",
                descricao: "R$ 150,00 - 1 em estoque",
              },
              {
                id: "MLB3",
                nome: "Conjunto Cha Cafe Inox",
                descricao: "R$ 630,00 - 1 em estoque",
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria abrir busca nova para pergunta factual sobre lista ativa");
          },
        }
      );

      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /quero confirmar qual voce quis dizer/i);
      assert.match(result.reply, /1\. Conjunto Bules Inox/i);
      assert.match(result.reply, /2\. Conjunto 2 Baldes de Gelo Inox/i);
      assert.match(result.reply, /3\. Conjunto Cha Cafe Inox/i);
      assert.doesNotMatch(result.reply, /nao achei itens da loja com esse perfil/i);
    },
  },
  {
    name: "catalogo libera nova busca quando o usuario refina a lista com atributo novo",
    run: async () => {
      let receivedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "quero um jogo de jantar de inox" }] as never,
        {
          agente: {
            id: "agent-catalog-refinement",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-refinement",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimaBusca: "jogo de jantar",
            ultimosProdutos: [
              {
                id: "MLB-A",
                nome: "Jogo de jantar porcelana azul",
                descricao: "porcelana azul 20 pecas",
              },
              {
                id: "MLB-B",
                nome: "Jogo de jantar ceramica branco",
                descricao: "ceramica branca 30 pecas",
              },
              {
                id: "MLB-C",
                nome: "Jogo de jantar vidro transparente",
                descricao: "vidro transparente 18 pecas",
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "");
            return {
              items: [
                {
                  id: "MLB-INOX-1",
                  title: "Jogo de jantar em inox 24 pecas",
                  price: 890,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/inox",
                  thumbnail: "https://example.com/inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                  freeShipping: true,
                },
              ],
              connector: {
                config: {
                  oauthNickname: "Mesa Posta",
                },
              },
              paging: {
                total: 1,
                offset: 0,
                nextOffset: 24,
                poolLimit: 24,
                hasMore: false,
              },
              error: null,
            };
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.doesNotMatch(result.reply, /quero confirmar qual voce quis dizer/i);
      assert.match(result.reply, /encontrei 1 produto/i);
      assert.doesNotMatch(result.reply, /loja Mesa Posta/i);
      assert.match(receivedSearchTerm, /inox/i);
    },
  },
  {
    name: "catalogo responde produto mais caro com base nos itens recentes ja mostrados",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual o produto mais caro?" }] as never,
        {
          agente: {
            id: "agent-catalog-price",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-price",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimosProdutos: [
              {
                id: "MLB6540079826",
                nome: "Aparelho De Jantar Oxford Ceramica",
                descricao: "R$ 358,00 - 1 em estoque",
                preco: 358,
              },
              {
                id: "MLB6540148274",
                nome: "Aparelho De Jantar Oxford Ceramica Folk 20 Pecas",
                descricao: "R$ 730,00 - 1 em estoque",
                preco: 730,
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /dos itens que te mostrei, o mais caro e/i);
      assert.match(result.reply, /Aparelho De Jantar Oxford Ceramica Folk 20 Pecas/i);
      assert.match(result.reply, /R\$\s*730,00/i);
      assert.doesNotMatch(result.reply, /nao encontrei mais itens nessa faixa/i);
    },
  },
  {
    name: "catalogo compara dois itens recentes e recomenda um deles sem nova busca",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual vale mais a pena entre o 1 e o 2?" }] as never,
        {
          agente: {
            id: "agent-catalog-compare",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-compare",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimosProdutos: [
              {
                id: "MLB1",
                nome: "Jogo de Jantar Porcelana",
                preco: 2990,
                availableQuantity: 1,
                freeShipping: false,
                material: "Porcelana",
                warranty: "",
              },
              {
                id: "MLB2",
                nome: "Jogo de Sopeira Completo",
                preco: 250,
                availableQuantity: 2,
                freeShipping: true,
                material: "Ceramica",
                warranty: "30 dias",
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /eu iria em Jogo de Sopeira Completo/i);
      assert.match(result.reply, /frete gratis/i);
      assert.match(result.reply, /garantia 30 dias/i);
      assert.match(result.reply, /faixa de preco/i);
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
          targetFactHints: ["peso"],
          factScope: "product",
          usedLlm: true,
        },
        context: catalogContext,
        recentProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
        currentCatalogProduct: catalogContext.catalogo?.produtoAtual ?? null,
      });

      assert.equal(decision?.kind, "non_catalog_message");
      assert.deepEqual(decision?.targetFactHints, ["peso"]);
      assert.equal(decision?.factScope, "product");
    },
  },
  {
    name: "catalogo semantico transforma pergunta factual sobre lista ativa em desambiguacao sem busca nova",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "current_product_question",
          confidence: 0.91,
          reason: "Cliente perguntou um atributo factual sem indicar qual item da lista.",
          usedLlm: true,
        },
        recentProducts: [
          { id: "MLB1", nome: "Conjunto Bules Inox" },
          { id: "MLB2", nome: "Conjunto 2 Baldes de Gelo Inox" },
          { id: "MLB3", nome: "Conjunto Cha Cafe Inox" },
        ],
        currentCatalogProduct: null,
      });

      assert.equal(decision?.kind, "recent_product_reference_unresolved");
      assert.equal(decision?.matchedProducts?.length, 3);
    },
  },
  {
    name: "catalogo semantico resolve item recente especifico",
    run: () => {
      const recentProducts = catalogContext.catalogo?.ultimosProdutos ?? [];
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "recent_product_reference",
          confidence: 0.9,
          reason: "Cliente referenciou a opcao floral.",
          referencedProductIds: ["MLB3"],
          usedLlm: true,
        },
        recentProducts,
      });

      assert.equal(decision?.kind, "recent_product_reference");
      assert.equal(decision?.matchedProducts?.length, 1);
      assert.equal(decision?.matchedProducts?.[0]?.id, "MLB3");
    },
  },
  {
    name: "catalogo semantico reconhece ambiguidade entre itens recentes",
    run: () => {
      const recentProducts = catalogContext.catalogo?.ultimosProdutos ?? [];
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "recent_product_reference_ambiguous",
          confidence: 0.86,
          reason: "Cliente referenciou duas opcoes recentes.",
          referencedProductIds: ["MLB1", "MLB2"],
          usedLlm: true,
        },
        recentProducts,
      });

      assert.equal(decision?.kind, "recent_product_reference_ambiguous");
      assert.equal(decision?.matchedProducts?.length, 2);
      assert.equal(decision?.matchedProducts?.[0]?.id, "MLB1");
      assert.equal(decision?.matchedProducts?.[1]?.id, "MLB2");
    },
  },
  {
    name: "catalogo semantico mapeia refinamento explicito para busca nova",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "catalog_search_refinement",
          confidence: 0.88,
          reason: "Cliente refinou a lista com material novo.",
          targetType: "inox",
          excludeCurrentProduct: false,
          usedLlm: true,
        },
        recentProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
      });

      assert.equal(decision?.kind, "catalog_search_refinement");
      assert.equal(decision?.searchCandidates?.[0], "inox");
      assert.equal(decision?.uncoveredTokens?.[0], "inox");
    },
  },
  {
    name: "catalogo semantico mapeia nova busca de vitrine",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "new_catalog_search",
          confidence: 0.9,
          reason: "Cliente iniciou nova busca curta na vitrine.",
          targetType: "saleiro azul",
          excludeCurrentProduct: false,
          usedLlm: true,
        },
        recentProducts: [],
      });

      assert.equal(decision?.kind, "catalog_search_refinement");
      assert.equal(decision?.searchCandidates?.[0], "saleiro azul");
      assert.equal(decision?.uncoveredTokens?.[0], "saleiro azul");
    },
  },
  {
    name: "catalogo semantico mapeia pedido de mais opcoes para load more",
    run: () => {
      const decision = buildCatalogDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "catalog_load_more",
          confidence: 0.84,
          reason: "Cliente pediu mais opcoes da lista.",
          usedLlm: true,
        },
        recentProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
      });

      assert.equal(decision?.kind, "catalog_load_more");
      assert.equal(decision?.shouldBlockNewSearch, false);
    },
  },
  {
    name: "catalogo load more semantico sai do produto atual e continua a lista recente",
    run: () => {
      const state = resolveCatalogIntentState({
        latestUserMessage: "tem mais ou so esses?",
        context: {
          conversation: { mode: "listing" },
          catalogo: {
            produtoAtual: {
              id: "MLB-STALE-1",
              nome: "Bule De Porcelana",
            },
            ultimaBusca: "bule porcelana",
            ultimosProdutos: [
              { id: "MLB-1", nome: "Bule 1" },
              { id: "MLB-2", nome: "Bule 2" },
            ],
          },
        },
        catalogDecision: {
          kind: "catalog_load_more",
          confidence: 0.92,
        },
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.currentCatalogProduct, null);
      assert.equal(state.stayOnCurrentProduct, false);
      assert.equal(state.loadMoreCatalogRequested, true);
      assert.equal(state.productSearchRequested, false);
    },
  },
  {
    name: "catalogo load more sai de product detail quando o usuario pergunta se tem mais itens",
    run: () => {
      const state = resolveCatalogIntentState({
        latestUserMessage: "tem mais ou so esses?",
        context: {
          conversation: { mode: "product_detail" },
          storefront: { pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
          catalogo: {
            produtoAtual: {
              id: "MLB-FOCUS-1",
              nome: "Bule De Porcelana Renner",
            },
            ultimaBusca: "bule porcelana",
            ultimosProdutos: [
              { id: "MLB-1", nome: "Bule 1" },
              { id: "MLB-2", nome: "Bule 2" },
            ],
            focusMode: "product_focus",
          },
        },
        catalogDecision: {
          kind: "catalog_load_more",
          confidence: 0.92,
        },
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.currentCatalogProduct, null);
      assert.equal(state.stayOnCurrentProduct, false);
      assert.equal(state.forceNewSearch, false);
      assert.equal(state.loadMoreCatalogRequested, true);
      assert.equal(state.productSearchRequested, false);
    },
  },
  {
    name: "catalogo load more semantico sai de product detail com ancora de ultimaBusca mesmo sem lista recente",
    run: () => {
      const state = resolveCatalogIntentState({
        latestUserMessage: "tem mais ou so esses?",
        context: {
          conversation: { mode: "product_detail" },
          storefront: { pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
          catalogo: {
            produtoAtual: {
              id: "MLB-FOCUS-1",
              nome: "Bule De Porcelana Renner",
            },
            ultimaBusca: "bule porcelana",
            ultimosProdutos: [],
            focusMode: "product_focus",
            paginationHasMore: true,
            paginationNextOffset: 3,
          },
        },
        catalogDecision: {
          kind: "catalog_load_more",
          confidence: 0.92,
        },
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.currentCatalogProduct, null);
      assert.equal(state.stayOnCurrentProduct, false);
      assert.equal(state.forceNewSearch, false);
      assert.equal(state.loadMoreCatalogRequested, true);
      assert.equal(state.paginationOffset, 3);
    },
  },
  {
    name: "catalogo aceita acao explicita do widget para ver mais opcoes",
    run: () => {
      const context = {
        conversation: { mode: "product_detail" },
        storefront: { pageKind: "product_detail" },
        ui: {
          productDetailPreferred: true,
          catalogAction: "load_more",
        },
        catalogo: {
          produtoAtual: {
            id: "MLB-FOCUS-1",
            nome: "Bule De Porcelana Renner",
          },
          ultimaBusca: "bule porcelana",
          ultimosProdutos: [],
          focusMode: "product_focus",
          paginationHasMore: true,
          paginationNextOffset: 3,
        },
      };

      const decisionState = resolveCatalogDecisionState({
        latestUserMessage: "Ver mais opcoes",
        context,
        shouldUseCatalog: true,
      });
      const state = resolveCatalogIntentState({
        latestUserMessage: "Ver mais opcoes",
        context,
        catalogDecision: decisionState.catalogDecision,
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.catalogDecision?.kind, "catalog_load_more");
      assert.equal(state.catalogDecision?.reason, "explicit_catalog_load_more_action");
      assert.equal(state.stayOnCurrentProduct, false);
      assert.equal(state.loadMoreCatalogRequested, true);
    },
  },
  {
    name: "catalogo aceita acao explicita do widget para detalhe do produto sem texto livre",
    run: () => {
      const context = {
        conversation: { mode: "listing" },
        ui: {
          catalogAction: "product_detail",
          catalogProductId: "MLB-2",
        },
        catalogo: {
          ultimosProdutos: [
            { id: "MLB-1", nome: "Bule 1" },
            { id: "MLB-2", nome: "Bule 2", preco: 120 },
          ],
        },
      };

      const decisionState = resolveCatalogDecisionState({
        latestUserMessage: "Saber mais",
        context,
        shouldUseCatalog: true,
      });
      const state = resolveCatalogIntentState({
        latestUserMessage: "Saber mais",
        context,
        catalogDecision: decisionState.catalogDecision,
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.catalogDecision?.kind, "recent_product_reference");
      assert.equal(state.catalogDecision?.reason, "explicit_catalog_product_detail_action");
      assert.equal(state.currentCatalogProduct?.id, "MLB-2");
      assert.equal(state.stayOnCurrentProduct, true);
      assert.equal(state.loadMoreCatalogRequested, false);
    },
  },
  {
    name: "catalogo aceita comando explicito MAIS no whatsapp para continuar listagem",
    run: () => {
      const context = {
        channel: { kind: "whatsapp" },
        conversation: { mode: "listing" },
        catalogo: {
          ultimaBusca: "bule porcelana",
          ultimosProdutos: [{ id: "MLB-1", nome: "Bule 1" }],
          paginationHasMore: true,
          paginationNextOffset: 3,
        },
      };

      const decisionState = resolveCatalogDecisionState({
        latestUserMessage: "MAIS",
        context,
        shouldUseCatalog: true,
      });
      const state = resolveCatalogIntentState({
        latestUserMessage: "MAIS",
        context,
        catalogDecision: decisionState.catalogDecision,
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.catalogDecision?.kind, "catalog_load_more");
      assert.equal(state.catalogDecision?.reason, "explicit_catalog_load_more_command");
      assert.equal(state.loadMoreCatalogRequested, true);
    },
  },
  {
    name: "mercado livre responde medidas do produto atual de forma deterministica",
    run: () => {
      const reply = buildFocusedProductFactualReply(
        {
          id: "MLB-77",
          nome: "Balde Inox",
          atributos: [
            { nome: "Altura", valor: "21 cm" },
            { nome: "Largura", valor: "18 cm" },
          ],
        },
        "vc tem as dimensoes dele?"
      );

      assert.match(String(reply || ""), /Altura: 21 cm/i);
      assert.match(String(reply || ""), /Largura: 18 cm/i);
    },
  },
  {
    name: "mercado livre responde peso sem misturar altura quando a pergunta e factual e curta",
    run: () => {
      const reply = buildFocusedProductFactualReply(
        {
          id: "MLB-78",
          nome: "Quadro Decorativo",
          atributos: [
            { nome: "Altura", valor: "81 cm" },
            { nome: "Peso da embalagem do vendedor", valor: "6500 g" },
          ],
        },
        "tem peso?"
      );

      assert.match(String(reply || ""), /Peso da embalagem: 6500 g/i);
      assert.doesNotMatch(String(reply || ""), /Altura: 81 cm/i);
    },
  },
  {
    name: "mercado livre informa quando so existem medidas de embalagem no anuncio",
    run: () => {
      const reply = buildFocusedProductFactualReply(
        {
          id: "MLB-79",
          nome: "Quadro Decorativo",
          atributos: [
            { nome: "Altura da embalagem do vendedor", valor: "75 cm" },
            { nome: "Largura da embalagem do vendedor", valor: "95 cm" },
          ],
        },
        "qual tamanho?"
      );

      assert.match(String(reply || ""), /Nao encontrei medidas do produto/i);
      assert.match(String(reply || ""), /medidas da embalagem/i);
    },
  },
  {
    name: "mercado livre reutiliza escopo de embalagem em follow-up factual curto",
    run: () => {
      const reply = buildFocusedProductFactualReply(
        {
          id: "MLB-80",
          nome: "Quadro Decorativo",
          atributos: [
            { nome: "Altura da embalagem do vendedor", valor: "75 cm" },
            { nome: "Peso da embalagem do vendedor", valor: "6500 g" },
          ],
        },
        "e o peso?",
        {
          previousFactContext: {
            fields: ["dimensions"],
            scope: "package",
            productId: "MLB-80",
          },
        }
      );

      assert.match(String(reply || ""), /Peso da embalagem: 6500 g/i);
      assert.doesNotMatch(String(reply || ""), /Nao encontrei o peso do produto/i);
    },
  },
  {
    name: "mercado livre compacta follow-up curto quando repete a mesma familia factual",
    run: () => {
      const reply = buildFocusedProductFactualReply(
        {
          id: "MLB-81",
          nome: "Balde Inox",
          atributos: [
            { nome: "Altura", valor: "21 cm" },
            { nome: "Largura", valor: "18 cm" },
          ],
        },
        "qual tamanho?",
        {
          previousFactContext: {
            fields: ["dimensions"],
            scope: "product",
            productId: "MLB-81",
          },
        }
      );

      assert.equal(String(reply || ""), "Altura: 21 cm, Largura: 18 cm.");
    },
  },
  {
    name: "catalogo aceita comando explicito numerico no whatsapp para selecionar item recente",
    run: () => {
      const context = {
        channel: { kind: "whatsapp" },
        conversation: { mode: "listing" },
        catalogo: {
          ultimaBusca: "bule porcelana",
          ultimosProdutos: [
            { id: "MLB-1", nome: "Bule 1" },
            { id: "MLB-2", nome: "Bule 2" },
            { id: "MLB-3", nome: "Bule 3" },
          ],
        },
      };

      const decisionState = resolveCatalogDecisionState({
        latestUserMessage: "2",
        context,
        shouldUseCatalog: true,
      });
      const state = resolveCatalogIntentState({
        latestUserMessage: "2",
        context,
        catalogDecision: decisionState.catalogDecision,
        detectProductSearch: () => false,
        buildProductSearchCandidates: () => [],
        isCatalogListingIntent: () => false,
      });

      assert.equal(state.catalogDecision?.kind, "recent_product_reference");
      assert.equal(state.catalogDecision?.reason, "explicit_catalog_item_command");
      assert.equal(state.currentCatalogProduct?.id, "MLB-2");
      assert.equal(state.stayOnCurrentProduct, true);
    },
  },
  {
    name: "catalogo em detalhe usa new_catalog_search para sair do item atual e buscar outro termo curto",
    run: async () => {
      let receivedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "tem balde?" }] as never,
        {
          agente: {
            id: "agent-catalog-detail-new-search",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-detail-new-search",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          conversation: { mode: "product_detail" },
          storefront: { kind: "mercado_livre", pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
          catalogo: {
            ultimaBusca: "inox",
            produtoAtual: {
              id: "MLB-INOX-1",
              nome: "Balde Inox Vintage",
              descricao: "Balde em inox",
              preco: 420,
            },
            ultimosProdutos: [
              {
                id: "MLB-INOX-1",
                nome: "Balde Inox Vintage",
                descricao: "Balde em inox",
                preco: 420,
              },
            ],
            listingSession: {
              id: "sessao-inox",
              snapshotId: "snapshot-inox",
              searchTerm: "inox",
              matchedProductIds: ["MLB-INOX-1"],
              offset: 0,
              nextOffset: 3,
              poolLimit: 24,
              hasMore: true,
              total: 1,
              source: "storefront_snapshot",
            },
            productFocus: {
              productId: "MLB-INOX-1",
              sourceListingSessionId: "sessao-inox",
              detailLevel: "focused",
            },
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "new_catalog_search",
            confidence: 0.93,
            reason: "Cliente saiu do detalhe e iniciou uma nova busca curta.",
            targetType: "balde",
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "");
            return {
              items: [
                {
                  id: "MLB-BALDE-1",
                  title: "Balde Esmaltado Azul",
                  price: 180,
                  currencyId: "BRL",
                  availableQuantity: 2,
                  permalink: "https://example.com/balde",
                  thumbnail: "https://example.com/balde.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "TIPO", name: "Tipo", valueName: "Balde" }],
                  freeShipping: false,
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 1, offset: 0, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.equal(receivedSearchTerm, "balde");
      assert.equal(result.metadata.semanticIntent?.intent, "new_catalog_search");
      assert.match(result.reply, /encontrei 1 produto/i);
      assert.doesNotMatch(result.reply, /valor atual deste produto/i);
    },
  },
  {
    name: "catalogo em detalhe sai do produto atual para busca ampla mesmo sem stage semantico explicito",
    run: async () => {
      let receivedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "tem porcelanato?" }] as never,
        {
          agente: {
            id: "agent-catalog-detail-storewide-search",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-detail-storewide-search",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          conversation: { mode: "product_detail" },
          storefront: { kind: "mercado_livre", pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
          catalogo: {
            ultimaBusca: "inox",
            produtoAtual: {
              id: "MLB-INOX-1",
              nome: "Balde Inox Vintage",
              descricao: "Balde em inox",
              preco: 420,
            },
            ultimosProdutos: [
              {
                id: "MLB-INOX-1",
                nome: "Balde Inox Vintage",
                descricao: "Balde em inox",
                preco: 420,
              },
            ],
            listingSession: {
              id: "sessao-inox",
              snapshotId: "snapshot-inox",
              searchTerm: "inox",
              matchedProductIds: ["MLB-INOX-1"],
              offset: 0,
              nextOffset: 3,
              poolLimit: 24,
              hasMore: true,
              total: 1,
              source: "storefront_snapshot",
            },
            productFocus: {
              productId: "MLB-INOX-1",
              sourceListingSessionId: "sessao-inox",
              detailLevel: "focused",
            },
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "");
            return {
              items: [
                {
                  id: "MLB-PORCELANATO-1",
                  title: "Vaso Decorativo Porcelanato",
                  price: 230,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/porcelanato",
                  thumbnail: "https://example.com/porcelanato.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Porcelanato" }],
                  freeShipping: false,
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 1, offset: 0, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.equal(receivedSearchTerm, "porcelanato");
      assert.equal(result.metadata.semanticIntent ?? null, null);
      assert.match(result.reply, /encontrei 1 produto/i);
      assert.doesNotMatch(result.reply, /valor atual deste produto/i);
    },
  },
  {
    name: "catalogo responde fim explicito quando load_more chega ao fim da sessao",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "Ver mais opcoes" }] as never,
        {
          agente: {
            id: "agent-catalog-end-of-session",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-end-of-session",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          ui: {
            catalogAction: "load_more",
            listingSessionId: "sessao-inox",
          },
          catalogo: {
            ultimaBusca: "inox",
            ultimosProdutos: [
              { id: "MLB1", nome: "Jarra Inox", descricao: "R$ 100,00" },
              { id: "MLB2", nome: "Balde Inox", descricao: "R$ 120,00" },
            ],
            listingSession: {
              id: "sessao-inox",
              snapshotId: "snapshot-inox",
              searchTerm: "inox",
              matchedProductIds: ["MLB1", "MLB2"],
              offset: 0,
              nextOffset: 3,
              poolLimit: 24,
              hasMore: true,
              total: 2,
              source: "storefront_snapshot",
            },
          },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async () => ({
            items: [],
            connector: { config: { oauthNickname: "Mesa Posta" } },
            paging: { total: 2, offset: 3, nextOffset: 3, poolLimit: 24, hasMore: false },
            error: null,
          }),
        }
      );

      assert.match(result.reply, /nao encontrei mais itens nessa busca no momento/i);
      assert.equal(result.assets.length, 0);
    },
  },
  {
    name: "catalogo recompõe reply incoerente quando a contagem real diverge da contagem textual",
    run: () => {
      const reply = enforceMercadoLivreSearchReplyCoherence(
        "Encontrei 1 produto. Vou te mostrar as opcoes disponiveis agora.",
        [
          { id: "MLB1", title: "Jarra Inox" },
          { id: "MLB2", title: "Balde Inox" },
        ],
        "inox",
        {},
        { total: 2, offset: 0, nextOffset: 3, poolLimit: 24, hasMore: false }
      );

      assert.match(reply, /encontrei 2 opcoes/i);
      assert.doesNotMatch(reply, /encontrei 1 produto/i);
    },
  },
  {
    name: "catalogo preserva a sessao na sequencia inox load_more detail e nova busca curta",
    run: async () => {
      const baseContext = {
        agente: {
          id: "agent-catalog-sequence",
          nome: "Loja Mesa Posta",
          promptBase: "Venda de forma consultiva.",
        },
        projeto: {
          id: "proj-catalog-sequence",
          nome: "Projeto teste",
          slug: "projeto-teste",
          directConnections: {
            mercadoLivre: 1,
          },
        },
        storefront: {
          kind: "mercado_livre",
          pageKind: "storefront",
        },
        ui: {
          catalogPreferred: true,
        },
      };

      let searchCalls: string[] = [];

      const firstTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "inox" }] as never,
        baseContext as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "new_catalog_search",
            confidence: 0.95,
            reason: "Cliente iniciou a busca por inox.",
            targetType: "inox",
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            searchCalls.push(String(options.searchTerm || ""));
            return {
              items: [
                {
                  id: "MLB1",
                  title: "Jarra Inox",
                  price: 100,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/jarra-inox",
                  thumbnail: "https://example.com/jarra-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
                {
                  id: "MLB2",
                  title: "Balde Inox",
                  price: 120,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/balde-inox",
                  thumbnail: "https://example.com/balde-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
                {
                  id: "MLB3",
                  title: "Conjunto Inox",
                  price: 200,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/conjunto-inox",
                  thumbnail: "https://example.com/conjunto-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 6, offset: 0, nextOffset: 3, poolLimit: 24, hasMore: true },
              error: null,
            };
          },
        }
      );

      const listedContext = updateContextFromAiResult({
        nextContext: {
          ...baseContext,
          conversation: { mode: "listing" },
          catalogo: {},
        },
        ai: firstTurn,
        chatId: "chat-sequence",
        historyLengthSource: 1,
      });
      const listedPayload = prepareAiReplyPayload({
        channelKind: "web",
        ai: firstTurn,
        nextContext: listedContext,
        normalizedExternalIdentifier: "lead-sequence",
        userMessage: "inox",
        agendaSlots: [],
      });
      const loadMoreAction = listedPayload.actions.find((action: any) => action?.extraContext?.ui?.catalogAction === "load_more");
      const productAsset = listedPayload.assets.find((asset: any) => asset?.id === "MLB2");

      const secondTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "Ver mais opcoes" }] as never,
        {
          ...listedContext,
          ui: loadMoreAction?.extraContext?.ui,
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            searchCalls.push(String(options.searchTerm || ""));
            return {
              items: [
                {
                  id: "MLB4",
                  title: "Saleiro Inox",
                  price: 90,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/saleiro-inox",
                  thumbnail: "https://example.com/saleiro-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 6, offset: 3, nextOffset: 6, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      const afterLoadMoreContext = updateContextFromAiResult({
        nextContext: {
          ...listedContext,
          ui: loadMoreAction?.extraContext?.ui,
        },
        ai: secondTurn,
        chatId: "chat-sequence",
        historyLengthSource: 2,
      });
      const loadMorePayload = prepareAiReplyPayload({
        channelKind: "web",
        ai: secondTurn,
        nextContext: afterLoadMoreContext,
        normalizedExternalIdentifier: "lead-sequence",
        userMessage: "Ver mais opcoes",
        agendaSlots: [],
      });

      const thirdTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "Saber mais" }] as never,
        {
          ...afterLoadMoreContext,
          ui: {
            catalogAction: "product_detail",
            catalogProductId: productAsset?.id,
            listingSessionId: productAsset?.metadata?.listingSessionId,
            productDetailPreferred: true,
          },
          conversation: { mode: "product_detail" },
          storefront: { kind: "mercado_livre", pageKind: "product_detail" },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreProductById: async () => ({
            item: {
              id: "MLB2",
              title: "Balde Inox",
              price: 120,
              currencyId: "BRL",
              availableQuantity: 1,
              permalink: "https://example.com/balde-inox",
              thumbnail: "https://example.com/balde-inox.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
              descriptionPlain: "Balde em inox vintage.",
            },
            error: null,
          }),
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar no detalhe estruturado");
          },
        }
      );

      const detailContext = updateContextFromAiResult({
        nextContext: {
          ...afterLoadMoreContext,
          conversation: { mode: "product_detail" },
          storefront: { kind: "mercado_livre", pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
        },
        ai: thirdTurn,
        chatId: "chat-sequence",
        historyLengthSource: 3,
      });

      const fourthTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "tem balde?" }] as never,
        detailContext as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "new_catalog_search",
            confidence: 0.94,
            reason: "Cliente iniciou nova busca curta a partir do detalhe.",
            targetType: "balde",
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            searchCalls.push(String(options.searchTerm || ""));
            return {
              items: [
                {
                  id: "MLB-BALDE-NEW",
                  title: "Balde Esmaltado Azul",
                  price: 180,
                  currencyId: "BRL",
                  availableQuantity: 2,
                  permalink: "https://example.com/balde-novo",
                  thumbnail: "https://example.com/balde-novo.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "TIPO", name: "Tipo", valueName: "Balde" }],
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 1, offset: 0, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.equal(listedContext.catalogo?.listingSession?.searchTerm, "inox");
      assert.equal(loadMoreAction?.extraContext?.ui?.listingSessionId, listedContext.catalogo?.listingSession?.id);
      assert.equal(productAsset?.metadata?.listingSessionId, listedContext.catalogo?.listingSession?.id);
      assert.match(secondTurn.reply, /encontrei mais 1 produto desta busca/i);
      assert.equal(loadMorePayload.catalogMessageMode, "replace_listing");
      assert.equal(loadMorePayload.catalogListingSessionId, listedContext.catalogo?.listingSession?.id);
      assert.equal(detailContext.catalogo?.productFocus?.productId, "MLB2");
      assert.equal(detailContext.catalogo?.productFocus?.sourceListingSessionId, listedContext.catalogo?.listingSession?.id);
      assert.deepEqual(searchCalls, ["inox", "inox", "balde"]);
      assert.equal(fourthTurn.metadata.semanticIntent?.intent, "new_catalog_search");
      assert.match(fourthTurn.reply, /encontrei 1 produto/i);
    },
  },
  {
    name: "catalogo sai do loop apos load_more e detalhe quando a nova pergunta ampla nao tem stage semantico",
    run: async () => {
      const baseContext = {
        agente: {
          id: "agent-catalog-sequence-no-semantic-exit",
          nome: "Loja Mesa Posta",
          promptBase: "Venda de forma consultiva.",
        },
        projeto: {
          id: "proj-catalog-sequence-no-semantic-exit",
          nome: "Projeto teste",
          slug: "projeto-teste",
          directConnections: {
            mercadoLivre: 1,
          },
        },
        storefront: {
          kind: "mercado_livre",
          pageKind: "storefront",
        },
        ui: {
          catalogPreferred: true,
        },
      };

      const searchCalls: string[] = [];

      const firstTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "inox" }] as never,
        baseContext as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "new_catalog_search",
            confidence: 0.95,
            reason: "Cliente iniciou a busca por inox.",
            targetType: "inox",
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            searchCalls.push(String(options.searchTerm || ""));
            return {
              items: [
                {
                  id: "MLB1",
                  title: "Jarra Inox",
                  price: 100,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/jarra-inox",
                  thumbnail: "https://example.com/jarra-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
                {
                  id: "MLB2",
                  title: "Balde Inox",
                  price: 120,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/balde-inox",
                  thumbnail: "https://example.com/balde-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
                {
                  id: "MLB3",
                  title: "Conjunto Inox",
                  price: 200,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/conjunto-inox",
                  thumbnail: "https://example.com/conjunto-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 6, offset: 0, nextOffset: 3, poolLimit: 24, hasMore: true },
              error: null,
            };
          },
        }
      );

      const listedContext = updateContextFromAiResult({
        nextContext: {
          ...baseContext,
          conversation: { mode: "listing" },
          catalogo: {},
        },
        ai: firstTurn,
        chatId: "chat-sequence-no-semantic-exit",
        historyLengthSource: 1,
      });
      const listedPayload = prepareAiReplyPayload({
        channelKind: "web",
        ai: firstTurn,
        nextContext: listedContext,
        normalizedExternalIdentifier: "lead-sequence-no-semantic-exit",
        userMessage: "inox",
        agendaSlots: [],
      });
      const loadMoreAction = listedPayload.actions.find((action: any) => action?.extraContext?.ui?.catalogAction === "load_more");
      const productAsset = listedPayload.assets.find((asset: any) => asset?.id === "MLB2");

      const secondTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "Ver mais opcoes" }] as never,
        {
          ...listedContext,
          ui: loadMoreAction?.extraContext?.ui,
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            searchCalls.push(String(options.searchTerm || ""));
            return {
              items: [
                {
                  id: "MLB4",
                  title: "Saleiro Inox",
                  price: 90,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/saleiro-inox",
                  thumbnail: "https://example.com/saleiro-inox.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 6, offset: 3, nextOffset: 6, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      const afterLoadMoreContext = updateContextFromAiResult({
        nextContext: {
          ...listedContext,
          ui: loadMoreAction?.extraContext?.ui,
        },
        ai: secondTurn,
        chatId: "chat-sequence-no-semantic-exit",
        historyLengthSource: 2,
      });

      const thirdTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "Saber mais" }] as never,
        {
          ...afterLoadMoreContext,
          ui: {
            catalogAction: "product_detail",
            catalogProductId: productAsset?.id,
            listingSessionId: productAsset?.metadata?.listingSessionId,
            productDetailPreferred: true,
          },
          conversation: { mode: "product_detail" },
          storefront: { kind: "mercado_livre", pageKind: "product_detail" },
        } as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreProductById: async () => ({
            item: {
              id: "MLB2",
              title: "Balde Inox",
              price: 120,
              currencyId: "BRL",
              availableQuantity: 1,
              permalink: "https://example.com/balde-inox",
              thumbnail: "https://example.com/balde-inox.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
              descriptionPlain: "Balde em inox vintage.",
            },
            error: null,
          }),
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar no detalhe estruturado");
          },
        }
      );

      const detailContext = updateContextFromAiResult({
        nextContext: {
          ...afterLoadMoreContext,
          conversation: { mode: "product_detail" },
          storefront: { kind: "mercado_livre", pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
        },
        ai: thirdTurn,
        chatId: "chat-sequence-no-semantic-exit",
        historyLengthSource: 3,
      });

      const fourthTurn = await executeSalesOrchestrator(
        [{ role: "user", content: "tem porcelanato?" }] as never,
        detailContext as never,
        {
          classifySemanticIntentStage: async () => null,
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            searchCalls.push(String(options.searchTerm || ""));
            return {
              items: [
                {
                  id: "MLB-PORCELANATO-1",
                  title: "Vaso Decorativo Porcelanato",
                  price: 230,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/porcelanato",
                  thumbnail: "https://example.com/porcelanato.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Porcelanato" }],
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 1, offset: 0, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.equal(fourthTurn.metadata.semanticIntent ?? null, null);
      assert.deepEqual(searchCalls, ["inox", "inox", "porcelanato"]);
      assert.match(fourthTurn.reply, /encontrei 1 produto/i);
      assert.doesNotMatch(fourthTurn.reply, /valor atual deste produto/i);
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
    name: "api runtime usa targetFieldHints para responder fato mesmo com frase vaga",
    run: () => {
      const reply = buildApiFallbackReply("me fala desse imovel", apiRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value: string) => value,
        targetFieldHints: ["matricula"],
        supportFieldHints: ["status", "data_leilao"],
      });

      assert.match(reply ?? "", /Matricula:/i);
      const focused = buildFocusedApiContext("me fala desse imovel", apiRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value: string) => value,
        targetFieldHints: ["matricula"],
        supportFieldHints: ["status", "data_leilao"],
      });
      assert.ok(focused.fields.some((field) => /status/i.test(String(field?.nome ?? ""))));
    },
  },
  {
    name: "api runtime nao responde fato aberto em frase vaga sem hint estruturado",
    run: () => {
      const reply = buildApiFallbackReply("me fala desse imovel", apiRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value: string) => value,
      });

      assert.equal(reply, null);
    },
  },
  {
    name: "api runtime nao abre contexto focado em frase vaga sem hint estruturado",
    run: () => {
      const focused = buildFocusedApiContext("me fala desse imovel", apiRealEstateFixture.apis, {
        normalizeText: normalizeFixtureText,
        buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
        singularizeToken: (value: string) => value,
      });

      assert.equal(focused.fields.length, 0);
    },
  },
  {
    name: "api runtime herda comparacao de catalogo quando a api retorna produtos",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual vale mais a pena entre o 1 e o 2?" }] as never,
        {
          agente: {
            id: "agent-api-catalog",
            nome: "Catalogo Interno",
            promptBase: "Venda de forma consultiva.",
          },
          runtimeApis: [
            {
              apiId: "api-prod-1",
              nome: "Produto 1",
              campos: [
                { nome: "sku", valor: "KIT-01" },
                { nome: "nome", valor: "Kit Mesa Posta Classic" },
                { nome: "preco", valor: 320 },
                { nome: "estoque", valor: 3 },
                { nome: "frete_gratis", valor: false },
              ],
            },
            {
              apiId: "api-prod-2",
              nome: "Produto 2",
              campos: [
                { nome: "sku", valor: "KIT-02" },
                { nome: "nome", valor: "Kit Mesa Posta Premium" },
                { nome: "preco", valor: 250 },
                { nome: "estoque", valor: 7 },
                { nome: "frete_gratis", valor: true },
                { nome: "garantia", valor: "30 dias" },
              ],
            },
          ],
        } as never
      )

      assert.equal(result.metadata.provider, "api_runtime")
      assert.equal(result.metadata.domainStage, "api_runtime")
      assert.match(result.reply, /eu iria em Kit Mesa Posta Premium/i)
      assert.match(result.reply, /frete gratis/i)
      assert.match(result.reply, /garantia 30 dias/i)
    },
  },
  {
    name: "api runtime responde fato canonico de produto sem misturar campos irrelevantes",
    run: () => {
      const reply = resolveApiCatalogReply(
        "tem peso?",
        {
          catalogo: {
            produtoAtual: {
              id: "KIT-03",
              nome: "Kit Mesa Posta",
              atributos: [
                { nome: "Altura", valor: "81 cm" },
                { nome: "Peso da embalagem do vendedor", valor: "6500 g" },
              ],
            },
            ultimosProdutos: [
              {
                id: "KIT-03",
                nome: "Kit Mesa Posta",
                atributos: [
                  { nome: "Altura", valor: "81 cm" },
                  { nome: "Peso da embalagem do vendedor", valor: "6500 g" },
                ],
              },
            ],
          },
        } as never,
        [],
        {
          semanticApiDecision: {
            kind: "api_fact_query",
            targetFieldHints: ["peso"],
          },
        } as never
      );

      assert.match(String(reply || ""), /Peso da embalagem: 6500 g/i);
      assert.doesNotMatch(String(reply || ""), /Altura: 81 cm/i);
    },
  },
  {
    name: "api runtime reutiliza escopo factual anterior em follow-up curto",
    run: () => {
      const reply = resolveApiCatalogReply(
        "e o peso?",
        {
          catalogo: {
            produtoAtual: {
              id: "KIT-04",
              nome: "Kit Mesa Posta",
              atributos: [
                { nome: "Altura da embalagem do vendedor", valor: "75 cm" },
                { nome: "Peso da embalagem do vendedor", valor: "6500 g" },
              ],
            },
            productFocus: {
              productId: "KIT-04",
              factualContext: {
                fields: ["dimensions"],
                scope: "package",
                productId: "KIT-04",
              },
            },
            ultimosProdutos: [
              {
                id: "KIT-04",
                nome: "Kit Mesa Posta",
                atributos: [
                  { nome: "Altura da embalagem do vendedor", valor: "75 cm" },
                  { nome: "Peso da embalagem do vendedor", valor: "6500 g" },
                ],
              },
            ],
          },
        } as never,
        [],
        {
          semanticApiDecision: {
            kind: "api_fact_query",
            targetFieldHints: ["peso"],
          },
        } as never
      );

      assert.match(String(reply || ""), /Peso da embalagem: 6500 g/i);
      assert.doesNotMatch(String(reply || ""), /Nao encontrei o peso do produto/i);
    },
  },
  {
    name: "api runtime compacta follow-up curto quando repete a mesma familia factual",
    run: () => {
      const reply = resolveApiCatalogReply(
        "qual tamanho?",
        {
          catalogo: {
            produtoAtual: {
              id: "KIT-05",
              nome: "Kit Mesa Posta",
              atributos: [
                { nome: "Altura", valor: "81 cm" },
                { nome: "Largura", valor: "95 cm" },
              ],
            },
            productFocus: {
              productId: "KIT-05",
              factualContext: {
                fields: ["dimensions"],
                scope: "product",
                productId: "KIT-05",
              },
            },
            ultimosProdutos: [
              {
                id: "KIT-05",
                nome: "Kit Mesa Posta",
                atributos: [
                  { nome: "Altura", valor: "81 cm" },
                  { nome: "Largura", valor: "95 cm" },
                ],
              },
            ],
          },
        } as never,
        [],
        {
          semanticApiDecision: {
            kind: "api_fact_query",
            targetFieldHints: ["dimensoes"],
          },
        } as never
      );

      assert.equal(String(reply || ""), "Altura: 81 cm, Largura: 95 cm.");
    },
  },
  {
    name: "api runtime semantico mapeia intencao factual estruturada",
    run: () => {
      const decision = buildApiDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "api_fact_query",
          confidence: 0.9,
          reason: "Cliente pediu um campo factual da API.",
          targetFieldHints: ["matricula"],
          supportFieldHints: ["status", "data_leilao"],
          usedLlm: true,
        },
      });

      assert.equal(decision?.kind, "api_fact_query");
      assert.deepEqual(decision?.targetFieldHints, ["matricula"]);
      assert.deepEqual(decision?.supportFieldHints, ["status", "data_leilao"]);
    },
  },
  {
    name: "api runtime semantico mapeia comparacao estruturada",
    run: () => {
      const decision = buildApiDecisionFromSemanticIntent({
        semanticIntent: {
          intent: "api_comparison",
          confidence: 0.88,
          reason: "Cliente pediu comparacao entre itens da API.",
          comparisonMode: "best_choice",
          referencedProductIndexes: [1, 2],
          usedLlm: true,
        },
      });

      assert.equal(decision?.kind, "api_comparison");
      assert.equal(decision?.comparisonMode, "best_choice");
      assert.deepEqual(decision?.referencedProductIndexes, [1, 2]);
    },
  },
  {
    name: "api runtime usa comparacao semantica estruturada sem depender do texto literal",
    run: () => {
      const reply = resolveApiCatalogReply(
        "entre esses dois, qual voce indica?",
        {},
        [
          {
            apiId: "api-prod-1",
            nome: "Produto 1",
            campos: [
              { nome: "sku", valor: "KIT-01" },
              { nome: "nome", valor: "Kit Mesa Posta Classic" },
              { nome: "preco", valor: 320 },
              { nome: "estoque", valor: 3 },
              { nome: "frete_gratis", valor: false },
            ],
          },
          {
            apiId: "api-prod-2",
            nome: "Produto 2",
            campos: [
              { nome: "sku", valor: "KIT-02" },
              { nome: "nome", valor: "Kit Mesa Posta Premium" },
              { nome: "preco", valor: 250 },
              { nome: "estoque", valor: 7 },
              { nome: "frete_gratis", valor: true },
              { nome: "garantia", valor: "30 dias" },
            ],
          },
        ],
        {
          semanticApiDecision: {
            kind: "api_comparison",
            comparisonMode: "best_choice",
            referencedProductIndexes: [1, 2],
          },
        }
      );

      assert.match(reply ?? "", /eu iria em Kit Mesa Posta Premium/i);
    },
  },
  {
    name: "api runtime nao compara por texto solto sem ancora real de lista",
    run: () => {
      const reply = resolveApiCatalogReply(
        "qual vale mais a pena?",
        {},
        [
          {
            apiId: "api-prod-1",
            nome: "Produto 1",
            campos: [
              { nome: "sku", valor: "KIT-01" },
              { nome: "nome", valor: "Kit Mesa Posta Classic" },
              { nome: "preco", valor: 320 },
            ],
          },
          {
            apiId: "api-prod-2",
            nome: "Produto 2",
            campos: [
              { nome: "sku", valor: "KIT-02" },
              { nome: "nome", valor: "Kit Mesa Posta Premium" },
              { nome: "preco", valor: 250 },
            ],
          },
        ]
      );

      assert.equal(reply, null);
    },
  },
  {
    name: "api runtime ainda aceita ranking textual de preco com lista recente real",
    run: () => {
      const products = [
        {
          nome: "Kit Mesa Posta Classic",
          preco: 320,
        },
        {
          nome: "Kit Mesa Posta Premium",
          preco: 250,
        },
      ];
      const reply = resolveApiCatalogReply(
        "qual o mais barato?",
        {
          catalogo: {
            ultimosProdutos: products,
          },
        },
        []
      );

      assert.match(reply ?? "", /mais barato/i);
      assert.match(reply ?? "", /Kit Mesa Posta Premium/i);
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
        project: {
          id: "proj-ml-focus",
          directConnections: {
            mercadoLivre: 1,
          },
        },
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
        resolveMercadoLivreProductById: async () => ({
          item: {
            id: "MLB2",
            title: "Jogo de Sopeira Completo",
            price: 250,
            currencyId: "BRL",
            availableQuantity: 2,
            status: "active",
            permalink: "https://example.com/sopeira",
            thumbnail: "https://example.com/sopeira.jpg",
            sellerId: "seller-1",
            sellerName: "Mesa Posta",
            freeShipping: true,
            warranty: "30 dias",
            attributes: [
              { id: "MATERIAL", name: "Material principal", valueName: "Ceramica" },
              { id: "COLOR", name: "Cor principal", valueName: "Amarelo" },
            ],
            pictures: ["https://example.com/sopeira-1.jpg"],
            variations: [
              {
                id: "VAR1",
                attributeCombinations: [{ id: "COLOR", name: "Cor principal", valueName: "Amarelo" }],
              },
            ],
            descriptionPlain: "Sopeira em ceramica com acabamento amarelo e conjunto de tigelas para servir.",
          },
          error: null,
        }),
        deps: {
          normalizeText: normalizeFixtureText,
          isWhatsAppChannel: () => true,
        },
      });

      assert.match(state.selectedProductSalesReply ?? "", /Preco atual/i);
      assert.doesNotMatch(state.selectedProductSalesReply ?? "", /escolha forte para seguir agora/i);
      assert.match(state.selectedProductSalesReply ?? "", /Preco atual/i);
      assert.match(state.selectedProductSalesReply ?? "", /Ceramica/i);
      assert.match(state.selectedProductSalesReply ?? "", /Amarelo/i);
      assert.match(state.selectedProductSalesReply ?? "", /frete gratis/i);
      assert.match(state.selectedProductSalesReply ?? "", /30 dias/i);
      assert.match(state.selectedProductSalesReply ?? "", /Variacoes visiveis/i);
      assert.match(state.selectedProductSalesReply ?? "", /Resumo:/i);
      assert.match(state.selectedProductSalesReply ?? "", /link direto/i);
      assert.doesNotMatch(state.selectedProductSalesReply ?? "", /custo-beneficio/i);
    },
  },
  {
    name: "orquestrador usa stage semantico para resolver item recente sem nova busca",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me fala mais daquela opcao floral" }] as never,
        {
          agente: {
            id: "agent-catalog-semantic-reference",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-semantic-reference",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "recent_product_reference",
            confidence: 0.93,
            reason: "Cliente referenciou a opcao floral.",
            referencedProductIds: ["MLB3"],
            targetType: "",
            excludeCurrentProduct: true,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
          resolveMercadoLivreProductById: async (_project, itemId) => {
            assert.equal(itemId, "MLB3");
            return {
              item: {
                id: "MLB3",
                title: "Jogo De Jantar Floral",
                price: 420,
                currencyId: "BRL",
                availableQuantity: 1,
                status: "active",
                permalink: "https://example.com/floral",
                thumbnail: "https://example.com/floral.jpg",
                sellerId: "seller-1",
                sellerName: "Mesa Posta",
                freeShipping: true,
                warranty: "90 dias",
                attributes: [
                  { id: "MATERIAL", name: "Material principal", valueName: "Porcelana" },
                  { id: "COLOR", name: "Cor principal", valueName: "Floral" },
                ],
                pictures: ["https://example.com/floral-1.jpg"],
                variations: [],
                descriptionPlain: "Conjunto floral em porcelana para mesa posta.",
              },
              error: null,
            };
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /Floral/i);
      assert.doesNotMatch(result.reply, /Nao achei itens da loja/i);
    },
  },
  {
    name: "orquestrador usa override semantico de catalogo quando o route base nao classifica",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "aquela floral" }] as never,
        {
          agente: {
            id: "agent-catalog-semantic-override",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-semantic-override",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "recent_product_reference",
            confidence: 0.94,
            reason: "Cliente se refere ao item floral da lista recente.",
            referencedProductIds: ["MLB3"],
            targetType: "",
            excludeCurrentProduct: true,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
          resolveMercadoLivreProductById: async (_project, itemId) => {
            assert.equal(itemId, "MLB3");
            return {
              item: {
                id: "MLB3",
                title: "Jogo De Jantar Floral",
                price: 420,
                currencyId: "BRL",
                availableQuantity: 1,
                status: "active",
                permalink: "https://example.com/floral",
                thumbnail: "https://example.com/floral.jpg",
                sellerId: "seller-1",
                sellerName: "Mesa Posta",
                freeShipping: true,
                warranty: "90 dias",
                attributes: [{ id: "MATERIAL", name: "Material principal", valueName: "Porcelana" }],
                pictures: ["https://example.com/floral-1.jpg"],
                variations: [],
                descriptionPlain: "Conjunto floral em porcelana para mesa posta.",
              },
              error: null,
            };
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.equal(result.metadata.routingDecision?.reason, "Cliente se refere ao item floral da lista recente.");
      assert.match(result.reply, /Floral/i);
    },
  },
  {
    name: "orquestrador usa stage semantico para pedir desambiguacao sem nova busca",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "gostei daquela opcao" }] as never,
        {
          agente: {
            id: "agent-catalog-semantic-ambiguous",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-semantic-ambiguous",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "recent_product_reference_ambiguous",
            confidence: 0.89,
            reason: "Cliente apontou para mais de um item plausivel.",
            referencedProductIds: ["MLB1", "MLB2"],
            targetType: "",
            excludeCurrentProduct: true,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
        }
      );

      assert.equal(result.metadata.provider, "local_heuristic");
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /Encontrei mais de um item com esse perfil/i);
      assert.match(result.reply, /Jogo de Jantar Porcelana/i);
      assert.match(result.reply, /Jogo de Sopeira Completo/i);
    },
  },
  {
    name: "orquestrador nao deixa ambiguidade heuristica sobrescrever unresolved semantico",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "gostei desse" }] as never,
        {
          agente: {
            id: "agent-catalog-semantic-unresolved",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-semantic-unresolved",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "recent_product_reference_unresolved",
            confidence: 0.84,
            reason: "Cliente segue na lista recente sem item unico resolvido.",
            referencedProductIds: [],
            targetType: "",
            excludeCurrentProduct: true,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async () => {
            throw new Error("nao deveria buscar novamente");
          },
        }
      );

      assert.equal(result.metadata.provider, "local_heuristic");
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(result.reply, /Quero confirmar qual voce quis dizer/i);
      assert.match(result.reply, /Me responde com 1, 2 ou 3/i);
      assert.doesNotMatch(result.reply, /Encontrei mais de um item com esse perfil/i);
    },
  },
  {
    name: "orquestrador usa stage semantico para refinamento de catalogo sem depender do guardrail local",
    run: async () => {
      let receivedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "quero em inox" }] as never,
        {
          agente: {
            id: "agent-catalog-semantic-refinement",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-semantic-refinement",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimaBusca: "jogo de jantar",
            ultimosProdutos: [
              {
                id: "MLB-A",
                nome: "Jogo de jantar porcelana azul",
                descricao: "porcelana azul 20 pecas",
              },
              {
                id: "MLB-B",
                nome: "Jogo de jantar ceramica branco",
                descricao: "ceramica branca 30 pecas",
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "catalog_search_refinement",
            confidence: 0.91,
            reason: "Cliente refinou a lista com inox.",
            targetType: "inox",
            referencedProductIds: [],
            excludeCurrentProduct: false,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "");
            return {
              items: [
                {
                  id: "MLB-INOX-2",
                  title: "Jogo de jantar em inox",
                  price: 990,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/inox-2",
                  thumbnail: "https://example.com/inox-2.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Inox" }],
                  freeShipping: true,
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 1, offset: 0, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.match(receivedSearchTerm, /inox/i);
      assert.match(result.reply, /encontrei 1 produto/i);
    },
  },
  {
    name: "orquestrador usa stage semantico para load more com snapshot recente",
    run: async () => {
      let receivedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me mostra mais opcoes" }] as never,
        {
          agente: {
            id: "agent-catalog-semantic-load-more",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-semantic-load-more",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimaBusca: "jogo de jantar",
            ultimosProdutos: [
              {
                id: "MLB1",
                nome: "Jogo de jantar porcelana",
                descricao: "R$ 358,00 - 1 em estoque",
              },
            ],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "catalog_load_more",
            confidence: 0.9,
            reason: "Cliente pediu mais opcoes da lista.",
            targetType: "",
            referencedProductIds: [],
            excludeCurrentProduct: false,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "");
            return {
              items: [
                {
                  id: "MLB-NEW-1",
                  title: "Jogo de jantar novo",
                  price: 410,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/new-1",
                  thumbnail: "https://example.com/new-1.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "MATERIAL", name: "Material", valueName: "Porcelana" }],
                  freeShipping: false,
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 2, offset: 1, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.equal(result.metadata.domainStage, "catalog");
      assert.equal(receivedSearchTerm, "jogo de jantar");
      assert.match(result.reply, /encontrei mais 1 produto desta busca/i);
    },
  },
  {
    name: "orquestrador usa stage semantico para busca curta de vitrine mesmo sem snapshot recente",
    run: async () => {
      let receivedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "saleiro azul" }] as never,
        {
          agente: {
            id: "agent-catalog-storefront-semantic",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-storefront-semantic",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
          catalogo: {
            ultimosProdutos: [],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "new_catalog_search",
            confidence: 0.92,
            reason: "Cliente iniciou busca curta na vitrine.",
            targetType: "saleiro azul",
            referencedProductIds: [],
            excludeCurrentProduct: false,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "");
            return {
              items: [
                {
                  id: "MLB-SALEIRO-AZUL",
                  title: "Saleiro Azul Decorado",
                  price: 199,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/saleiro-azul",
                  thumbnail: "https://example.com/saleiro-azul.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "COLOR", name: "Cor", valueName: "Azul" }],
                  freeShipping: false,
                },
              ],
              connector: { config: { oauthNickname: "Mesa Posta" } },
              paging: { total: 1, offset: 0, nextOffset: 24, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.equal(result.metadata.domainStage, "catalog");
      assert.equal(result.metadata.semanticIntent?.intent, "new_catalog_search");
      assert.equal(receivedSearchTerm, "saleiro azul");
      assert.match(result.reply, /encontrei 1 produto/i);
    },
  },
  {
    name: "whatsapp mantem catalogo em foco quando um produto especifico ja foi selecionado",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "qual o material?",
        history: [{ role: "assistant", content: "Separei esse produto para voce." }],
        context: {
          projeto: {
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            focusMode: "product_focus",
            produtoAtual: {
              id: "MLB-FOCO-1",
              nome: "Jogo de Jantar Ceramica",
            },
          },
          conversation: {
            mode: "product_focus",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "catalog");
      assert.equal(decision.source, "mercado_livre");
      assert.equal(decision.reason, "catalog_product_detail_focus");
    },
  },
  {
    name: "domain router nao depende de valor generico para mandar billing",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "me passa os valores",
        history: [],
        context: {},
        project: {
          directConnections: {},
        },
        runtimeApis: [],
        focusedApiContext: null,
        runtimeConfig: {
          pricingCatalog: {
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", priceLabel: "R$ 29,90/mes" },
              { slug: "pro", name: "Pro", priceLabel: "R$ 149,90/mes" },
            ],
          },
        },
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router deixa billing inicial para o stage semantico mesmo com nome explicito de plano",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "qual o valor do pro?",
        history: [],
        context: {},
        project: {
          directConnections: {},
        },
        runtimeApis: [],
        focusedApiContext: null,
        runtimeConfig: {
          pricingCatalog: {
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", priceLabel: "R$ 29,90/mes" },
              { slug: "pro", name: "Pro", priceLabel: "R$ 149,90/mes" },
            ],
          },
        },
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router nao continua billing nem com focus ativo antigo",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "qual o valor do pro?",
        history: [{ role: "assistant", content: "Posso te passar os valores dos planos Basic e Pro." }],
        context: {
          focus: {
            domain: "billing",
            source: "agent",
            subject: "planos",
            confidence: 0.9,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        },
        project: {
          directConnections: {},
        },
        runtimeApis: [],
        focusedApiContext: null,
        runtimeConfig: {
          pricingCatalog: {
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", priceLabel: "R$ 29,90/mes" },
              { slug: "pro", name: "Pro", priceLabel: "R$ 149,90/mes" },
            ],
          },
        },
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router nao assume billing sem pricing catalog estruturado",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "quais planos voces tem?",
        history: [],
        context: {},
        project: {
          directConnections: {},
        },
        runtimeConfig: {},
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.notEqual(decision.domain, "billing");
    },
  },
  {
    name: "domain router nao assume catalogo por resposta generica apos prompt antigo",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "entendi",
        history: [{ role: "assistant", content: "Encontrei alguns produtos para voce." }],
        context: {},
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router nao assume catalogo por verbo generico sem candidato de busca",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "me mostra",
        history: [],
        context: {},
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router deixa busca verbal de vitrine para o stage semantico",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "me mostra saleiro",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router ainda reconhece item explicito do mercado livre na vitrine",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "me mostra o mlb123456789",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume catalogo por substantivo amplo sem contexto real",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "produto",
        history: [],
        context: {},
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router ainda reconhece follow-up catalogal curto apos prompt recente",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "aquela floral",
        history: [{ role: "assistant", content: "Encontrei alguns produtos para voce." }],
        context: {
          catalogo: {
            ultimosProdutos: [
              { id: "ml-1", nome: "Prato Floral" },
              { id: "ml-2", nome: "Saleiro Floral" },
            ],
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume follow-up catalogal curto sem contexto recente real",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "aquela floral",
        history: [{ role: "assistant", content: "Encontrei alguns produtos para voce." }],
        context: {},
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
      });

      assert.notEqual(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume follow-up catalogal curto com snapshot velho",
    run: () => {
      const decision = resolveChatDomainRoute({
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
      });

      assert.notEqual(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume catalogo por substantivo amplo so por contexto de vitrine",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "produto",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.notEqual(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume catalogo por sinal forte de objeto na vitrine sem contexto recente",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "me manda o link",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.notEqual(decision.domain, "catalog");
    },
  },
  {
    name: "domain router assume catalogo por sinal forte de objeto com contexto recente",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "me manda o link",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
          catalogo: {
            ultimosProdutos: [{ id: "MLB1", nome: "Saleiro Azul" }],
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume catalogo por busca curta de vitrine sem contexto recente",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "saleiro azul",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.notEqual(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao assume catalogo por query curta ampla em vitrine",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "item",
        history: [],
        context: {
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.notEqual(decision.domain, "catalog");
    },
  },
  {
    name: "domain router nao continua catalogo so por focus antigo sem contexto recente real",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "essa",
        history: [],
        context: {
          focus: {
            domain: "catalog",
            source: "mercado_livre",
            subject: "catalogo",
            confidence: 0.82,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router nao continua catalogo por verbo generico com focus recente",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "quero",
        history: [],
        context: {
          focus: {
            domain: "catalog",
            source: "mercado_livre",
            subject: "catalogo",
            confidence: 0.82,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
          catalogo: {
            ultimosProdutos: [{ id: "MLB1", nome: "Saleiro Azul" }],
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "general");
    },
  },
  {
    name: "domain router continua catalogo por focus quando ainda existe contexto recente real",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "essa",
        history: [],
        context: {
          focus: {
            domain: "catalog",
            source: "mercado_livre",
            subject: "catalogo",
            confidence: 0.82,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
          catalogo: {
            ultimosProdutos: [{ id: "MLB1", nome: "Saleiro Azul" }],
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "catalog");
      assert.equal(decision.reason, "catalog_focus_continuation");
    },
  },
  {
    name: "domain router continua catalogo por referencia forte com focus recente",
    run: () => {
      const decision = resolveChatDomainRoute({
        latestUserMessage: "gostei desse",
        history: [],
        context: {
          focus: {
            domain: "catalog",
            source: "mercado_livre",
            subject: "catalogo",
            confidence: 0.82,
            expiresAt: "2099-01-01T00:00:00.000Z",
          },
          catalogo: {
            ultimosProdutos: [{ id: "MLB1", nome: "Saleiro Azul" }],
          },
        },
        project: {
          directConnections: {
            mercadoLivre: 1,
          },
        },
        runtimeApis: [],
        focusedApiContext: null,
      });

      assert.equal(decision.domain, "catalog");
      assert.equal(decision.reason, "catalog_focus_continuation");
    },
  },
  {
    name: "mercado livre promove unico item recente quando o usuario usa referencia deitica",
    run: () => {
      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "gostei desse",
        context: {
          catalogo: {
            ultimaBusca: "aparelho de jantar",
            ultimosProdutos: [
              {
                id: "MLB-UNICO-1",
                nome: "Aparelho De Jantar Oxford Ceramica",
                descricao: "R$ 358,00 - 1 em estoque",
                material: "Ceramica",
              },
            ],
          },
        },
        detectProductSearch: () => false,
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        isMercadoLivreListingIntent: () => true,
      });

      assert.equal(flow.forceNewSearch, false);
      assert.equal(flow.productSearchRequested, false);
      assert.equal(flow.genericMercadoLivreListingRequested, false);
      assert.equal(flow.currentCatalogProduct?.id, "MLB-UNICO-1");
    },
  },
  {
    name: "mercado livre usa o modelo para detalhe de produto e preserva o asset do anuncio",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "vcs entregam?" }] as never,
        {
          agente: {
            id: "agent-mercado-livre-detail",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-mercado-livre-detail",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ultimaBusca: "jogo de jantar",
            produtoAtual: {
              id: "MLB2",
              nome: "Jogo de Sopeira Completo",
              preco: 250,
              descricao: "R$ 250,00 - 2 em estoque",
              link: "https://example.com/sopeira",
              imagem: "https://example.com/sopeira.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              availableQuantity: 2,
            },
            ultimosProdutos: [
              {
                id: "MLB2",
                nome: "Jogo de Sopeira Completo",
                descricao: "R$ 250,00 - 2 em estoque",
              },
            ],
          },
        } as never,
        {
          resolveMercadoLivreProductById: async () => ({
            item: {
              id: "MLB2",
              title: "Jogo de Sopeira Completo",
              price: 250,
              currencyId: "BRL",
              availableQuantity: 2,
              status: "active",
              condition: "new",
              permalink: "https://example.com/sopeira",
              thumbnail: "https://example.com/sopeira.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              freeShipping: true,
              warranty: "30 dias",
              attributes: [
                { id: "MATERIAL", name: "Material principal", valueName: "Ceramica" },
                { id: "COLOR", name: "Cor principal", valueName: "Amarelo" },
                { id: "STYLE", name: "Estilo", valueName: "Classico" },
              ],
              variations: [
                {
                  id: "VAR1",
                  attributeCombinations: [{ id: "COLOR", name: "Cor principal", valueName: "Amarelo" }],
                },
              ],
              descriptionPlain:
                "Sopeira em ceramica com acabamento amarelo, conjunto de tigelas, tampa detalhada e proposta elegante para mesa posta.",
            },
            error: null,
          }),
          generateSalesReply: async () => ({
            reply: "Sim. A entrega e feita pelo Mercado Livre e o frete aparece no checkout pelo seu CEP.",
            assets: [],
            usage: {
              inputTokens: 0,
              outputTokens: 0,
            },
            metadata: {
              provider: "test_openai",
              model: "fake",
            },
          }),
        }
      );

      assert.ok(["mercado_livre_runtime", "local_heuristic"].includes(String(result.metadata.provider)));
      assert.match(result.reply, /entrega e feita pelo Mercado Livre/i);
      assert.doesNotMatch(result.reply, /escolha forte|pontos confirmados no anuncio|custo-beneficio/i);
    },
  },
  {
    name: "mercado livre responde valor do produto em foco de forma deterministica sem repetir card",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual o valor ?" }] as never,
        {
          agente: {
            id: "agent-mercado-livre-price",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-mercado-livre-price",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "product_detail",
          },
          conversation: {
            mode: "product_detail",
          },
          ui: {
            productDetailPreferred: true,
          },
          catalogo: {
            produtoAtual: {
              id: "MLB2",
              nome: "Jogo de Sopeira Completo",
              preco: 250,
              descricao: "R$ 250,00 - 2 em estoque",
              link: "https://example.com/sopeira",
              imagem: "https://example.com/sopeira.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              availableQuantity: 2,
            },
            ultimosProdutos: [
              {
                id: "MLB2",
                nome: "Jogo de Sopeira Completo",
                descricao: "R$ 250,00 - 2 em estoque",
              },
            ],
          },
        } as never,
        {
          resolveMercadoLivreProductById: async () => ({
            item: {
              id: "MLB2",
              title: "Jogo de Sopeira Completo",
              price: 250,
              currencyId: "BRL",
              availableQuantity: 2,
              status: "active",
              permalink: "https://example.com/sopeira",
              thumbnail: "https://example.com/sopeira.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              freeShipping: true,
              warranty: "30 dias",
              attributes: [{ id: "MATERIAL", name: "Material principal", valueName: "Ceramica" }],
              variations: [],
              descriptionPlain: "Sopeira em ceramica.",
            },
            error: null,
          }),
          generateSalesReply: async () => ({
            reply: "Nao deveria usar o modelo para valor de produto em foco.",
            assets: [{ id: "mercado-livre-1" }],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: { provider: "test_openai", model: "fake" },
          }),
        }
      );

      assert.equal(result.metadata.provider, "mercado_livre_runtime");
      assert.match(result.reply, /R\$\s*250,00/i);
      assert.equal(Array.isArray(result.assets) ? result.assets.length : 0, 0);
      assert.doesNotMatch(result.reply, /Nao posso informar o valor exato/i);
    },
  },
  {
    name: "pagina de produto usa classificacao semantica para buscar outro item do mesmo tipo",
    run: async () => {
      let receivedSearchTerm = ""
      let receivedExcludeItemIds: string[] = []

      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "tem outro saleiro alem desse ?" }] as never,
        {
          agente: {
            id: "agent-mercado-livre-same-type",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-mercado-livre-same-type",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "product_detail",
            productSlug: "saleiro-de-porcelana",
          },
          conversation: {
            mode: "product_detail",
          },
          ui: {
            productDetailPreferred: true,
          },
          catalogo: {
            produtoAtual: {
              id: "MLB-SALEIRO-ATUAL",
              nome: "Saleiro De Porcelana Canelado Com Tampa De Madeira",
              descricao: "R$ 147,65 - 1 em estoque",
              preco: 147.65,
              categoriaLabel: "Saleiros",
              atributos: [{ nome: "Material", valor: "Porcelana" }],
            },
            ultimosProdutos: [],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "same_type_search",
            confidence: 0.94,
            reason: "Cliente pediu outro item do mesmo tipo.",
            targetType: "saleiro",
            excludeCurrentProduct: true,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "")
            receivedExcludeItemIds = Array.isArray(options.excludeItemIds) ? options.excludeItemIds.map(String) : []
            return {
              items: [
                {
                  id: "MLB-SALEIRO-2",
                  title: "Saleiro De Porcelana Floral",
                  price: 129.9,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/saleiro-2",
                  thumbnail: "https://example.com/saleiro-2.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "TIPO", name: "Tipo", valueName: "Saleiro" }],
                },
              ],
              connector: {
                config: {
                  oauthNickname: "Mesa Posta",
                },
              },
              paging: {
                total: 1,
                offset: 0,
                nextOffset: 24,
                poolLimit: 24,
                hasMore: false,
              },
              error: null,
            }
          },
        },
      )

      assert.equal(result.metadata.provider, "mercado_livre_runtime")
      assert.equal(result.metadata.semanticIntent?.intent, "same_type_search")
      assert.equal(receivedSearchTerm, "saleiro")
      assert.deepEqual(receivedExcludeItemIds, ["MLB-SALEIRO-ATUAL"])
      assert.match(result.reply, /encontrei 1 produto/i)
      assert.doesNotMatch(result.reply, /loja Mesa Posta/i)
    },
  },
  {
    name: "pagina de produto deriva busca de similares pelo contexto estruturado do item atual",
    run: async () => {
      let receivedSearchTerm = ""
      let receivedExcludeItemIds: string[] = []

      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "voce tem outro produto similar a esse?" }] as never,
        {
          agente: {
            id: "agent-mercado-livre-similar",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-mercado-livre-similar",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "product_detail",
            productSlug: "saleiro-de-porcelana",
          },
          conversation: {
            mode: "product_detail",
          },
          ui: {
            productDetailPreferred: true,
          },
          catalogo: {
            produtoAtual: {
              id: "MLB-SALEIRO-ATUAL",
              nome: "Saleiro De Porcelana Canelado Com Tampa De Madeira",
              descricao: "R$ 147,65 - 1 em estoque",
              preco: 147.65,
              categoriaLabel: "Saleiros",
              atributos: [{ nome: "Material", valor: "Porcelana" }],
            },
            ultimosProdutos: [],
          },
        } as never,
        {
          classifySemanticIntentStage: async () => ({
            intent: "similar_items_search",
            confidence: 0.95,
            reason: "Cliente quer algo parecido com o item atual.",
            targetType: "",
            excludeCurrentProduct: true,
            usedLlm: true,
          }),
          resolveMercadoLivreSearch: async (_project, options = {}) => {
            receivedSearchTerm = String(options.searchTerm || "")
            receivedExcludeItemIds = Array.isArray(options.excludeItemIds) ? options.excludeItemIds.map(String) : []
            return {
              items: [
                {
                  id: "MLB-SALEIRO-3",
                  title: "Saleiro De Porcelana Azul",
                  price: 139.9,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://example.com/saleiro-3",
                  thumbnail: "https://example.com/saleiro-3.jpg",
                  sellerId: "seller-1",
                  sellerName: "Mesa Posta",
                  attributes: [{ id: "TIPO", name: "Tipo", valueName: "Saleiro" }],
                },
              ],
              connector: {
                config: {
                  oauthNickname: "Mesa Posta",
                },
              },
              paging: {
                total: 1,
                offset: 0,
                nextOffset: 24,
                poolLimit: 24,
                hasMore: false,
              },
              error: null,
            }
          },
        },
      )

      assert.equal(result.metadata.semanticIntent?.intent, "similar_items_search")
      assert.equal(receivedSearchTerm, "Saleiros")
      assert.deepEqual(receivedExcludeItemIds, ["MLB-SALEIRO-ATUAL"])
      assert.match(result.reply, /encontrei 1 produto/i)
    },
  },
  {
    name: "pagina de produto nao troca detalhe por nova listagem ao perguntar material",
    run: async () => {
      const productPageContext = {
        agente: {
          id: "agent-mercado-livre-material",
          nome: "Loja Reliquias",
          promptBase: "Venda de forma consultiva.",
        },
        projeto: {
          id: "proj-mercado-livre-material",
          nome: "Projeto teste",
          slug: "projeto-teste",
          directConnections: {
            mercadoLivre: 1,
          },
        },
        storefront: {
          kind: "mercado_livre",
          pageKind: "product_detail",
          storeSlug: "reliquias",
          productSlug: "sopeira-vintage",
        },
        conversation: {
          mode: "product_detail",
        },
        ui: {
          catalogPreferred: true,
          productDetailPreferred: true,
        },
        catalogo: {
          ultimaBusca: "jogo de sopeira completo",
          produtoAtual: {
            id: "MLB2",
            nome: "Jogo de Sopeira Completo",
            descricao: "R$ 250,00 - 2 em estoque",
            descricaoLonga: "Sopeira em ceramica com acabamento amarelo e conjunto para servir.",
            material: "Ceramica",
            cor: "Amarelo",
            atributos: [
              { id: "MATERIAL", nome: "Material principal", valor: "Ceramica" },
              { id: "COLOR", nome: "Cor principal", valor: "Amarelo" },
            ],
            link: "https://example.com/sopeira",
            imagem: "https://example.com/sopeira.jpg",
            sellerId: "seller-1",
            sellerName: "Mesa Posta",
            availableQuantity: 2,
          },
          ultimosProdutos: [
            {
              id: "MLB2",
              nome: "Jogo de Sopeira Completo",
              descricao: "R$ 250,00 - 2 em estoque",
              descricaoLonga: "Sopeira em ceramica com acabamento amarelo e conjunto para servir.",
              material: "Ceramica",
              cor: "Amarelo",
              atributos: [
                { id: "MATERIAL", nome: "Material principal", valor: "Ceramica" },
                { id: "COLOR", nome: "Cor principal", valor: "Amarelo" },
              ],
            },
          ],
        },
      };

      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "qual o material do produto?",
        context: productPageContext,
        detectProductSearch: (message: string) => deps.shouldSearchProducts(message),
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        isMercadoLivreListingIntent: () => true,
      });

      const state = await resolveMercadoLivreHeuristicState({
        context: productPageContext,
        project: productPageContext.projeto,
        latestUserMessage: "qual o material do produto?",
        productSearchRequested: flow.productSearchRequested,
        genericMercadoLivreListingRequested: flow.genericMercadoLivreListingRequested,
        forceNewSearch: flow.forceNewSearch,
        loadMoreCatalogRequested: flow.loadMoreCatalogRequested,
        productSearchTerm: flow.productSearchTerm,
        lastSearchTerm: flow.lastSearchTerm,
        paginationOffset: flow.paginationOffset,
        paginationPoolLimit: flow.paginationPoolLimit,
        catalogComparisonIntent: flow.catalogComparisonIntent,
        currentCatalogProduct: flow.currentCatalogProduct,
        recentCatalogProducts: flow.recentCatalogProducts,
        referencedCatalogProducts: flow.referencedCatalogProducts,
        resolveMercadoLivreSearch: async () => {
          throw new Error("nao deveria buscar lista para pergunta de detalhe");
        },
        resolveMercadoLivreProductById: async () => ({
          item: {
            id: "MLB2",
            title: "Jogo de Sopeira Completo",
            price: 250,
            currencyId: "BRL",
            availableQuantity: 2,
            status: "active",
            permalink: "https://example.com/sopeira",
            thumbnail: "https://example.com/sopeira.jpg",
            sellerId: "seller-1",
            sellerName: "Mesa Posta",
            freeShipping: true,
            warranty: "30 dias",
            attributes: [
              { id: "MATERIAL", name: "Material principal", valueName: "Ceramica" },
              { id: "COLOR", name: "Cor principal", valueName: "Amarelo" },
            ],
            pictures: ["https://example.com/sopeira-1.jpg"],
            variations: [],
            descriptionPlain: "Sopeira em ceramica com acabamento amarelo e conjunto para servir.",
          },
          error: null,
        }),
        resolveMercadoLivreStoreSettings: async () => ({
          chatContextFull: false,
        }),
      });

      assert.equal(flow.forceNewSearch, false);
      assert.equal(flow.productSearchRequested, false);
      assert.equal(flow.genericMercadoLivreListingRequested, false);
      assert.equal(flow.currentCatalogProduct?.id, "MLB2");
      assert.match(state.selectedProductSalesReply ?? "", /material deste produto e Ceramica/i);
      assert.equal(state.mercadoLivreHeuristicReply, null);
      assert.equal(state.mercadoLivreAssets.length, 0);
      assert.equal(state.selectedCatalogProduct?.contextoDetalhado, true);
      assert.equal(state.selectedCatalogProduct?.contextoCompleto, false);
      assert.match(state.selectedCatalogProduct?.descricaoLonga ?? "", /conjunto para servir/i);
    },
  },
  {
    name: "pagina de produto segura pergunta factual mesmo quando o resumo local nao trouxe o atributo ainda",
    run: async () => {
      const productPageContext = {
        projeto: {
          id: "proj-mercado-livre-material-missing",
          directConnections: {
            mercadoLivre: 1,
          },
        },
        storefront: {
          kind: "mercado_livre",
          pageKind: "product_detail",
        },
        conversation: {
          mode: "product_detail",
        },
        ui: {
          catalogPreferred: true,
          productDetailPreferred: true,
        },
        catalogo: {
          ultimaBusca: "aparelho de jantar",
          produtoAtual: {
            id: "MLB-OXFORD-1",
            nome: "Aparelho De Jantar Oxford Ceramica",
            descricao: "R$ 358,00 - 1 em estoque",
          },
          ultimosProdutos: [
            {
              id: "MLB-OXFORD-1",
              nome: "Aparelho De Jantar Oxford Ceramica",
              descricao: "R$ 358,00 - 1 em estoque",
            },
          ],
        },
      };

      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "qual o material desse produto ?",
        context: productPageContext,
        detectProductSearch: (message: string) => deps.shouldSearchProducts(message),
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        isMercadoLivreListingIntent: () => true,
      });

      const state = await resolveMercadoLivreHeuristicState({
        context: productPageContext,
        project: productPageContext.projeto,
        latestUserMessage: "qual o material desse produto ?",
        productSearchRequested: flow.productSearchRequested,
        genericMercadoLivreListingRequested: flow.genericMercadoLivreListingRequested,
        forceNewSearch: flow.forceNewSearch,
        loadMoreCatalogRequested: flow.loadMoreCatalogRequested,
        productSearchTerm: flow.productSearchTerm,
        lastSearchTerm: flow.lastSearchTerm,
        paginationOffset: flow.paginationOffset,
        paginationPoolLimit: flow.paginationPoolLimit,
        catalogComparisonIntent: flow.catalogComparisonIntent,
        currentCatalogProduct: flow.currentCatalogProduct,
        recentCatalogProducts: flow.recentCatalogProducts,
        referencedCatalogProducts: flow.referencedCatalogProducts,
        resolveMercadoLivreSearch: async () => {
          throw new Error("nao deveria cair em listagem quando o usuario pergunta do item aberto");
        },
        resolveMercadoLivreProductById: async () => ({
          item: {
            id: "MLB-OXFORD-1",
            title: "Aparelho De Jantar Oxford Ceramica",
            price: 358,
            currencyId: "BRL",
            availableQuantity: 1,
            status: "active",
            permalink: "https://example.com/oxford",
            thumbnail: "https://example.com/oxford.jpg",
            sellerId: "seller-1",
            sellerName: "PITTER774",
            freeShipping: false,
            warranty: "",
            attributes: [{ id: "MATERIAL", name: "Material", valueName: "Ceramica" }],
            pictures: ["https://example.com/oxford-1.jpg"],
            variations: [],
            descriptionPlain: "Aparelho de jantar em ceramica para mesa posta.",
          },
          error: null,
        }),
        resolveMercadoLivreStoreSettings: async () => ({
          chatContextFull: false,
        }),
      });

      assert.equal(flow.forceNewSearch, false);
      assert.equal(flow.productSearchRequested, false);
      assert.equal(flow.genericMercadoLivreListingRequested, false);
      assert.equal(flow.currentCatalogProduct?.id, "MLB-OXFORD-1");
      assert.match(state.selectedProductSalesReply ?? "", /material deste produto e Ceramica/i);
      assert.equal(state.mercadoLivreHeuristicReply, null);
    },
  },
  {
    name: "pagina de produto mantem item travado mesmo em frase solta de reafirmacao de contexto",
    run: async () => {
      const productPageContext = {
        projeto: {
          id: "proj-mercado-livre-locked-focus",
          directConnections: {
            mercadoLivre: 1,
          },
        },
        storefront: {
          kind: "mercado_livre",
          pageKind: "product_detail",
        },
        conversation: {
          mode: "product_detail",
        },
        ui: {
          catalogPreferred: true,
          productDetailPreferred: true,
        },
        catalogo: {
          produtoAtual: {
            id: "MLB-OXFORD-LOCKED",
            nome: "Aparelho De Jantar Oxford Ceramica",
            descricao: "R$ 358,00 - 1 em estoque",
            material: "Ceramica",
          },
          ultimosProdutos: [
            {
              id: "MLB-OXFORD-LOCKED",
              nome: "Aparelho De Jantar Oxford Ceramica",
              descricao: "R$ 358,00 - 1 em estoque",
              material: "Ceramica",
            },
          ],
        },
      };

      const flow = resolveMercadoLivreFlowState({
        latestUserMessage: "estou falando do produto que estou vendo aqui",
        context: productPageContext,
        detectProductSearch: (message: string) => deps.shouldSearchProducts(message),
        buildProductSearchCandidates: deps.buildProductSearchCandidates,
        isMercadoLivreListingIntent: () => true,
      });

      assert.equal(flow.forceNewSearch, false);
      assert.equal(flow.productSearchRequested, false);
      assert.equal(flow.genericMercadoLivreListingRequested, false);
      assert.equal(flow.currentCatalogProduct?.id, "MLB-OXFORD-LOCKED");
    },
  },
  {
    name: "mercado livre expande contexto completo do produto em foco quando a loja ativa a opcao",
    run: async () => {
      const state = await resolveMercadoLivreHeuristicState({
        context: {
          catalogo: {
            focusMode: "product_focus",
            produtoAtual: {
              id: "MLB-COMPLETE-1",
              nome: "Faqueiro Inox Premium",
            },
          },
          conversation: {
            mode: "product_focus",
          },
        },
        project: {
          id: "proj-mercado-livre-complete",
          directConnections: {
            mercadoLivre: 1,
          },
        },
        latestUserMessage: "me fala mais desse produto",
        currentCatalogProduct: {
          id: "MLB-COMPLETE-1",
          nome: "Faqueiro Inox Premium",
        },
        resolveMercadoLivreProductById: async () => ({
          item: {
            id: "MLB-COMPLETE-1",
            title: "Faqueiro Inox Premium",
            price: 499,
            currencyId: "BRL",
            availableQuantity: 3,
            permalink: "https://example.com/faqueiro",
            thumbnail: "https://example.com/faqueiro.jpg",
            sellerId: "seller-1",
            sellerName: "Mesa Posta",
            pictures: Array.from({ length: 10 }, (_, index) => `https://example.com/faqueiro-${index + 1}.jpg`),
            attributes: Array.from({ length: 30 }, (_, index) => ({
              id: `ATTR-${index + 1}`,
              name: `Atributo ${index + 1}`,
              valueName: `Valor ${index + 1}`,
            })),
            variations: Array.from({ length: 10 }, (_, index) => ({
              id: `VAR-${index + 1}`,
              attributeCombinations: [{ id: "COLOR", name: "Cor", valueName: `Cor ${index + 1}` }],
            })),
            descriptionPlain: "X".repeat(2500),
          },
          error: null,
        }),
        resolveMercadoLivreStoreSettings: async () => ({
          chatContextFull: true,
        }),
      });

      assert.equal(state.selectedCatalogProduct?.contextoDetalhado, true);
      assert.equal(state.selectedCatalogProduct?.contextoCompleto, true);
      assert.equal(state.selectedCatalogProduct?.atributos?.length, 30);
      assert.equal(state.selectedCatalogProduct?.imagens?.length, 8);
      assert.equal(state.selectedCatalogProduct?.variacoesResumo?.length, 10);
      assert.equal((state.selectedCatalogProduct?.descricaoLonga ?? "").length, 2500);
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
          widget: { slug: "site", whatsapp_celular: "" },
          whatsapp: { numero: "5511999999999", ctaEnabled: true },
          channel: { kind: "web" },
        } as never,
        false
      )

      assert.match(prompt, /5511999999999/)
      assert.match(prompt, /nunca use placeholder/i)
    },
  },
  {
    name: "prompt inclui catalogo estruturado quando pricing foi derivado do texto do agente",
    run: () => {
      const prompt = buildSystemPrompt(
        {
          id: "agent-derived-pricing-prompt",
          nome: "InfraStudio",
          promptBase: "Basic R$ 29,90/mes Pro R$ 149,90/mes",
          runtimeConfig: {
            pricingCatalog: {
              enabled: true,
              items: [
                { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
              ],
            },
          },
        } as never,
        {
          agente: {
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                ],
              },
            },
            runtimeConfigMeta: {
              pricingCatalogDerived: true,
            },
          },
          channel: { kind: "external_widget" },
        } as never,
        false
      )

      assert.match(prompt, /Catalogo de precos estruturado/i)
      assert.match(prompt, /Basic: R\$ 29,90\/mes/i)
      assert.match(prompt, /Pro: R\$ 149,90\/mes/i)
    },
  },
  {
    name: "prompt injeta tecnica de vendas quando houver contexto de produto do mercado livre",
    run: () => {
      const prompt = buildSystemPrompt(
        {
          id: "agent-ml-sales",
          nome: "Loja Mesa Posta",
          promptBase: "Venda de forma consultiva.",
        } as never,
        {
          projeto: {
            id: "proj-ml-sales",
            nome: "Projeto teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "product_detail",
          },
          conversation: {
            mode: "product_detail",
          },
          ui: {
            productDetailPreferred: true,
          },
          catalogo: {
            produtoAtual: {
              id: "MLB1",
              nome: "Aparelho De Jantar Oxford Ceramica",
            },
          },
          channel: { kind: "web" },
        } as never,
        false
      )

      assert.match(prompt, /Tecnica de vendas para produto do Mercado Livre/i)
      assert.match(prompt, /nao como catalogo neutro/i)
      assert.match(prompt, /Contexto travado: o cliente esta na pagina de detalhe do produto Aparelho De Jantar Oxford Ceramica/i)
      assert.match(prompt, /Nunca diga que nao conseguiu identificar o produto/i)
      assert.match(prompt, /Evite repetir so o titulo do produto/i)
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
    name: "orquestrador usa override semantico de api runtime quando o route base nao classifica",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me fala a matricula desse imovel" }] as never,
        {
          agente: {
            id: "agent-api-semantic",
            nome: "Nexo Leiloes",
            promptBase: "Atenda com precisao.",
          },
          runtimeApis: apiRealEstateFixture.apis,
        } as never,
        {
          classifySemanticApiIntentStage: async () => ({
            intent: "api_fact_query",
            confidence: 0.91,
            reason: "Cliente pediu campo factual da API.",
            targetFieldHints: ["matricula"],
            usedLlm: true,
          }),
        }
      );

      assert.equal(result.metadata.provider, "api_runtime");
      assert.equal(result.metadata.domainStage, "api_runtime");
      assert.equal(result.metadata.routingDecision?.reason, "Cliente pediu campo factual da API.");
      assert.match(result.reply, /Matricula:/i);
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
        } as never,
        {
          generateSalesReply: async () => ({
            reply: "A sopeira e uma boa opcao se voce quer algo mais classico e completo para servir.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: { provider: "test_openai", model: "fake" },
          }),
        }
      );

      assert.equal(result.metadata.provider, "mercado_livre_runtime");
      assert.doesNotMatch(result.reply, /escolha forte para seguir agora/i);
      assert.match(result.reply, /Sopeira/i);
    },
  },
  {
    name: "orquestrador enriquece produto recente selecionado antes de responder",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "gostei mais do segundo" }] as never,
        {
          agente: {
            id: "agent-catalog-enriched",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-catalog-enriched",
            nome: "Projeto teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ...catalogContext.catalogo,
            produtoAtual: null,
            ultimosProdutos: [
              {
                id: "MLB1",
                nome: "Jogo de Jantar Porcelana",
                descricao: "Jogo branco completo",
                preco: 2990,
                link: "https://example.com/jantar",
              },
              {
                id: "MLB2",
                nome: "Jogo de Sopeira Completo",
                descricao: "Sopeira amarela com tigelas",
                preco: 250,
                link: "https://example.com/sopeira",
              },
            ],
          },
        } as never,
        {
          resolveMercadoLivreProductById: async () => ({
            item: {
              id: "MLB2",
              title: "Jogo de Sopeira Completo",
              price: 250,
              currencyId: "BRL",
              availableQuantity: 2,
              status: "active",
              permalink: "https://example.com/sopeira",
              thumbnail: "https://example.com/sopeira.jpg",
              sellerId: "seller-1",
              sellerName: "Mesa Posta",
              freeShipping: true,
              warranty: "30 dias",
              attributes: [
                { id: "MATERIAL", name: "Material principal", valueName: "Ceramica" },
                { id: "COLOR", name: "Cor principal", valueName: "Amarelo" },
              ],
              variations: [
                {
                  id: "VAR1",
                  attributeCombinations: [{ id: "COLOR", name: "Cor principal", valueName: "Amarelo" }],
                },
              ],
              descriptionPlain: "Sopeira em ceramica com acabamento amarelo e conjunto de tigelas para servir.",
            },
            error: null,
          }),
          generateSalesReply: async () => ({
            reply: "Entre os que voce viu, a sopeira se destaca pelo material em ceramica, acabamento amarelo e frete gratis.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: { provider: "test_openai", model: "fake" },
          }),
        }
      )

      assert.ok(["test_openai", "mercado_livre_runtime"].includes(String(result.metadata.provider)))
      assert.doesNotMatch(result.reply, /escolha forte para seguir agora/i)
      assert.match(result.reply, /Ceramica/i)
      assert.match(result.reply, /Amarelo/i)
      assert.match(result.reply, /frete gratis/i)
    },
  },
  {
    name: "orquestrador prioriza listagem real no web quando busca produto da loja",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "preciso de um jogo de jantar" }] as never,
        {
          agente: {
            id: "agent-mercado-livre",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-mercado-livre",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
        } as never,
        {
          resolveMercadoLivreSearch: async () => ({
            items: [
              {
                id: "MLB6540079826",
                title: "Aparelho De Jantar Oxford Ceramica",
                price: 358,
                currencyId: "BRL",
                availableQuantity: 1,
                permalink: "https://produto.mercadolivre.com.br/MLB6540079826",
                thumbnail: "https://example.com/item-1.jpg",
                sellerId: "6918112",
                sellerName: "PITTER774",
                status: "active",
              },
            ],
            connector: {
              config: {
                oauthNickname: "PITTER774",
              },
            },
            paging: {
              total: 1,
              offset: 0,
              nextOffset: 0,
              poolLimit: 24,
              hasMore: false,
            },
            error: null,
          }),
        }
      );

      assert.equal(result.metadata.provider, "mercado_livre_runtime");
      assert.equal(result.metadata.domainStage, "catalog");
      assert.equal(result.assets.length, 1);
      assert.match(result.reply, /encontrei 1 produto/i);
      assert.doesNotMatch(result.reply, /da loja pitter774/i);
      assert.match(result.assets[0]?.nome ?? "", /Aparelho De Jantar Oxford Ceramica/i);
    },
  },
  {
    name: "orquestrador sai do loop quando usuario pede o que tiver",
    run: async () => {
      let capturedSearchTerm = "";
      const result = await executeSalesOrchestrator(
        [
          { role: "user", content: "tem jogo de jantar?" },
          { role: "assistant", content: "Vou buscar as opcoes de jogos de jantar disponiveis e te trago em seguida." },
          { role: "user", content: "manda o q tiver" },
        ] as never,
        {
          agente: {
            id: "agent-mercado-livre",
            nome: "Loja Mesa Posta",
            promptBase: "Venda de forma consultiva.",
          },
          projeto: {
            id: "proj-mercado-livre",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ultimaBusca: "jogos de jantar",
            paginationNextOffset: 0,
            paginationPoolLimit: 24,
          },
          focus: {
            domain: "catalog",
            source: "mercado_livre",
            subject: "jogos de jantar",
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          },
        } as never,
        {
          resolveMercadoLivreSearch: async (_project: any, options: any) => {
            capturedSearchTerm = options.searchTerm;
            return {
              items: [
                {
                  id: "MLB777",
                  title: "Jogo De Jantar Floral",
                  price: 420,
                  currencyId: "BRL",
                  availableQuantity: 1,
                  permalink: "https://produto.mercadolivre.com.br/MLB777",
                  thumbnail: "https://example.com/item-777.jpg",
                  sellerId: "6918112",
                  sellerName: "PITTER774",
                  status: "active",
                },
              ],
              connector: { config: { oauthNickname: "PITTER774" } },
              paging: { total: 1, offset: 0, nextOffset: 0, poolLimit: 24, hasMore: false },
              error: null,
            };
          },
        }
      );

      assert.equal(capturedSearchTerm, "jogos de jantar");
      assert.equal(result.metadata.provider, "mercado_livre_runtime");
      assert.equal(result.assets.length, 1);
      assert.match(result.assets[0]?.nome ?? "", /Jogo De Jantar Floral/i);
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
    name: "orquestrador responde pricing estruturado sem depender de texto fixo de whatsapp",
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
          whatsapp: { ctaEnabled: false },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "pricing_overview",
            confidence: 0.92,
            reason: "Cliente pediu preco de servicos.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )
      const withNumber = await executeSalesOrchestrator(
        [{ role: "user", content: "quanto custa um site com chat?" }] as never,
        {
          ...baseContext,
          widget: { slug: "site", whatsapp_celular: "" },
          whatsapp: { numero: "5511999999999", ctaEnabled: true },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "pricing_overview",
            confidence: 0.92,
            reason: "Cliente pediu preco de servicos.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )

      assert.match(withoutNumber.reply, /R\$/i)
      assert.match(withoutNumber.reply, /site/i)
      assert.match(withNumber.reply, /R\$/i)
      assert.match(withNumber.reply, /chat/i)
      assert.match(withNumber.reply, /R\$50/i)
    },
  },
  {
    name: "orquestrador usa catalogo estruturado do agente para responder plano mais caro",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual o valor do plano mais caro?" }] as never,
        {
          agente: {
            id: "agent-billing",
            nome: "InfraStudio",
            promptBase: "Voce vende planos de assinatura.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "plus", name: "Plus", matchAny: ["plus"], priceLabel: "R$ 79,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                  { slug: "scale", name: "Scale", matchAny: ["scale"], priceLabel: "R$ 299,90/mes" },
                ],
              },
            },
          },
          ui: { structured_response: false },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "highest_priced_plan",
            confidence: 0.93,
            reason: "Cliente pediu o plano mais caro.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )

      assert.match(result.reply, /Scale: R\$ 299,90\/mes/i)
      assert.doesNotMatch(result.reply, /gratuitos|evoluem conforme o uso/i)
    },
  },
  {
    name: "orquestrador lista os valores estruturados quando o cliente pede os planos",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me passa os valores" }] as never,
        {
          agente: {
            id: "agent-billing-list",
            nome: "InfraStudio",
            promptBase: "Voce vende planos de assinatura.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "plus", name: "Plus", matchAny: ["plus"], priceLabel: "R$ 79,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                ],
              },
            },
          },
          ui: { structured_response: false },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "pricing_overview",
            confidence: 0.92,
            reason: "Cliente pediu os valores dos planos.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )

      assert.match(result.reply, /Basic: R\$ 29,90\/mes/i)
      assert.match(result.reply, /Plus: R\$ 79,90\/mes/i)
      assert.match(result.reply, /Pro: R\$ 149,90\/mes/i)
      assert.equal(result.metadata?.semanticIntent?.intent, "pricing_overview")
    },
  },
  {
    name: "orquestrador usa catalogo extraido do texto do agente quando runtime config nao traz pricing pronto",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "tem valores ?" }] as never,
        {
          agente: {
            id: "agent-billing-extracted",
            nome: "InfraStudio",
            promptBase: [
              "Basic",
              "R$ 29,90/mes",
              "Plus",
              "R$ 79,90/mes",
              "Pro",
              "R$ 149,90/mes",
            ].join("\n"),
          },
          ui: { structured_response: false },
        } as never,
        {
          extractSemanticPricingCatalogFromAgentText: async () => ({
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
              { slug: "plus", name: "Plus", matchAny: ["plus"], priceLabel: "R$ 79,90/mes" },
              { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
            ],
          }),
          classifySemanticBillingIntentStage: async () => ({
            intent: "pricing_overview",
            confidence: 0.94,
            reason: "Cliente pediu os valores dos planos.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )

      assert.match(result.reply, /Basic: R\$ 29,90\/mes/i)
      assert.match(result.reply, /Plus: R\$ 79,90\/mes/i)
      assert.match(result.reply, /Pro: R\$ 149,90\/mes/i)
      assert.equal(result.metadata?.semanticIntent?.intent, "pricing_overview")
    },
  },
  {
    name: "orquestrador cacheia catalogo de pricing extraido do texto do agente",
    run: async () => {
      let extractionCalls = 0
      const inputHistory = [{ role: "user", content: "tem valores ?" }] as never
      const inputContext = {
        agente: {
          id: "agent-billing-extracted-cache",
          nome: "InfraStudio",
          promptBase: ["Basic", "R$ 29,90/mes", "Pro", "R$ 149,90/mes"].join("\n"),
        },
        ui: { structured_response: false },
      } as never
      const inputOptions = {
        extractSemanticPricingCatalogFromAgentText: async () => {
          extractionCalls += 1
          return {
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
              { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
            ],
          }
        },
        classifySemanticBillingIntentStage: async () => ({
          intent: "pricing_overview",
          confidence: 0.94,
          reason: "Cliente pediu os valores dos planos.",
          requestedPlanNames: [],
          usedLlm: true,
        }),
      }

      const first = await executeSalesOrchestrator(inputHistory, inputContext, inputOptions)
      const second = await executeSalesOrchestrator(inputHistory, inputContext, inputOptions)

      assert.match(first.reply, /Basic: R\$ 29,90\/mes/i)
      assert.match(second.reply, /Pro: R\$ 149,90\/mes/i)
      assert.equal(extractionCalls, 1)
    },
  },
  {
    name: "orquestrador responde plano mais caro com catalogo extraido do texto do agente",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual o valor do plano mais caro?" }] as never,
        {
          agente: {
            id: "agent-billing-extracted-highest",
            nome: "InfraStudio",
            promptBase: [
              "Basic",
              "R$ 29,90/mes",
              "Plus",
              "R$ 79,90/mes",
              "Scale",
              "R$ 299,90/mes",
            ].join("\n"),
          },
          ui: { structured_response: false },
        } as never,
        {
          extractSemanticPricingCatalogFromAgentText: async () => ({
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
              { slug: "plus", name: "Plus", matchAny: ["plus"], priceLabel: "R$ 79,90/mes" },
              { slug: "scale", name: "Scale", matchAny: ["scale"], priceLabel: "R$ 299,90/mes" },
            ],
          }),
          classifySemanticBillingIntentStage: async () => ({
            intent: "highest_priced_plan",
            confidence: 0.94,
            reason: "Cliente pediu o plano mais caro.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )

      assert.match(result.reply, /Scale: R\$ 299,90\/mes/i)
      assert.doesNotMatch(result.reply, /gratuitos|evoluem conforme o uso/i)
    },
  },
  {
    name: "orquestrador nao extrai pricing do texto do agente quando o roteamento inicial ja e catalogo",
    run: async () => {
      let extractionCalls = 0

      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me mostra saleiros" }] as never,
        {
          agente: {
            id: "agent-no-pricing-extract-catalog",
            nome: "Loja Cliente",
            promptBase: ["Basic", "R$ 29,90/mes", "Pro", "R$ 149,90/mes"].join("\n"),
          },
          projeto: {
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ultimosProdutos: [
              { id: "saleiro-1", nome: "Saleiro Azul" },
            ],
          },
        } as never,
        {
          extractSemanticPricingCatalogFromAgentText: async () => {
            extractionCalls += 1
            return {
              enabled: true,
              items: [{ slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" }],
            }
          },
          classifySemanticIntentStage: async () => ({
            intent: "catalog_search_refinement",
            confidence: 0.91,
            reason: "Cliente refinou a busca recente.",
            targetType: "saleiro",
            referencedProductIds: [],
            excludeCurrentProduct: false,
            usedLlm: true,
          }),
          generateSalesReply: async () => ({
            reply: "Busca de catalogo mantida.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-no-pricing-extract-catalog",
              agenteNome: "Loja Cliente",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "catalog",
            },
          }),
        }
      )

      assert.equal(extractionCalls, 0)
      assert.doesNotMatch(result.reply, /Basic: R\$ 29,90\/mes/i)
    },
  },
  {
    name: "orquestrador prioriza preco do produto em foco sobre pricing do agente",
    run: async () => {
      let extractionCalls = 0

      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual o valor?" }] as never,
        {
          agente: {
            id: "agent-product-price-priority",
            nome: "Loja Cliente",
            promptBase: ["Basic", "R$ 29,90/mes", "Pro", "R$ 149,90/mes"].join("\n"),
          },
          projeto: {
            id: "proj-product-price-priority",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 1,
            },
          },
          conversation: {
            mode: "product_detail",
          },
          storefront: {
            pageKind: "product_detail",
          },
          catalogo: {
            produtoAtual: {
              id: "MLB-PRICE-1",
              nome: "Saleiro De Porcelana",
              preco: 147.65,
              link: "https://example.com/saleiro",
            },
          },
        } as never,
        {
          extractSemanticPricingCatalogFromAgentText: async () => {
            extractionCalls += 1
            return {
              enabled: true,
              items: [{ slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" }],
            }
          },
          generateSalesReply: async () => ({
            reply: "Nao deveria usar o gerador para valor de produto em foco.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-product-price-priority",
              agenteNome: "Loja Cliente",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "catalog",
            },
          }),
        }
      )

      assert.equal(extractionCalls, 0)
      assert.match(result.reply, /R\$\s*147,65/i)
      assert.doesNotMatch(result.reply, /Basic: R\$ 29,90\/mes/i)
    },
  },
  {
    name: "orquestrador nao sobrescreve pricing catalog explicito com texto do agente",
    run: async () => {
      let extractionCalls = 0

      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me passa os valores" }] as never,
        {
          agente: {
            id: "agent-explicit-pricing-priority",
            nome: "InfraStudio",
            promptBase: ["Basic", "R$ 19,90/mes", "Pro", "R$ 99,90/mes"].join("\n"),
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                ],
              },
            },
          },
          ui: { structured_response: false },
        } as never,
        {
          extractSemanticPricingCatalogFromAgentText: async () => {
            extractionCalls += 1
            return {
              enabled: true,
              items: [
                { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 19,90/mes" },
                { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 99,90/mes" },
              ],
            }
          },
          classifySemanticBillingIntentStage: async () => ({
            intent: "pricing_overview",
            confidence: 0.94,
            reason: "Cliente pediu os valores dos planos.",
            requestedPlanNames: [],
            usedLlm: true,
          }),
        }
      )

      assert.equal(extractionCalls, 0)
      assert.match(result.reply, /Basic: R\$ 29,90\/mes/i)
      assert.match(result.reply, /Pro: R\$ 149,90\/mes/i)
      assert.doesNotMatch(result.reply, /R\$ 19,90\/mes/i)
      assert.doesNotMatch(result.reply, /R\$ 99,90\/mes/i)
    },
  },
  {
    name: "orquestrador entrega runtime config efetivo extraido ao gerador downstream",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "quero entender melhor" }] as never,
        {
          agente: {
            id: "agent-effective-runtime-forward",
            nome: "InfraStudio",
            promptBase: ["Basic", "R$ 29,90/mes", "Pro", "R$ 149,90/mes"].join("\n"),
          },
          ui: { structured_response: false },
        } as never,
        {
          extractSemanticPricingCatalogFromAgentText: async () => ({
            enabled: true,
            items: [
              { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
              { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
            ],
          }),
          classifySemanticBillingIntentStage: async () => null,
          generateSalesReply: async (_history, runtimeContext) => {
            assert.equal(runtimeContext?.agente?.runtimeConfig?.pricingCatalog?.items?.length, 2)
            return {
              reply: "Runtime estruturado entregue ao gerador.",
              assets: [],
              usage: { inputTokens: 0, outputTokens: 0 },
              metadata: {
                provider: "openai",
                model: "test",
                agenteId: "agent-effective-runtime-forward",
                agenteNome: "InfraStudio",
                routeStage: "sales",
                heuristicStage: null,
                domainStage: "general",
              },
            }
          },
        }
      )

      assert.match(result.reply, /Runtime estruturado entregue/i)
    },
  },
  {
    name: "orquestrador extrai contexto comercial basico do texto do agente para o gerador downstream",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "como funciona?" }] as never,
        {
          agente: {
            id: "agent-business-extracted-forward",
            nome: "InfraStudio",
            promptBase: "Automacao com IA, WhatsApp inteligente e sistemas sob medida para vender mais.",
          },
          ui: { structured_response: false },
        } as never,
        {
          extractSemanticBusinessRuntimeFromAgentText: async () => ({
            business: {
              summary: "Automacao com IA para atendimento e operacao comercial.",
              services: ["WhatsApp inteligente", "Sistemas sob medida"],
            },
            sales: {
              cta: "Se fizer sentido, continue no WhatsApp.",
            },
          }),
          classifySemanticBillingIntentStage: async () => null,
          generateSalesReply: async (_history, runtimeContext) => {
            assert.equal(runtimeContext?.agente?.runtimeConfig?.business?.summary, "Automacao com IA para atendimento e operacao comercial.")
            assert.deepEqual(runtimeContext?.agente?.runtimeConfig?.business?.services, ["WhatsApp inteligente", "Sistemas sob medida"])
            assert.equal(runtimeContext?.agente?.runtimeConfig?.sales?.cta, "Se fizer sentido, continue no WhatsApp.")
            return {
              reply: "Contexto comercial estruturado entregue.",
              assets: [],
              usage: { inputTokens: 0, outputTokens: 0 },
              metadata: {
                provider: "openai",
                model: "test",
                agenteId: "agent-business-extracted-forward",
                agenteNome: "InfraStudio",
                routeStage: "sales",
                heuristicStage: null,
                domainStage: "general",
              },
            }
          },
        }
      )

      assert.match(result.reply, /Contexto comercial estruturado entregue/i)
    },
  },
  {
    name: "orquestrador nao sobrescreve business explicito com texto do agente",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me explica" }] as never,
        {
          agente: {
            id: "agent-business-explicit-priority",
            nome: "InfraStudio",
            promptBase: "Automacao com IA, WhatsApp e APIs.",
            runtimeConfig: {
              business: {
                summary: "Resumo salvo explicitamente.",
                services: ["Servico salvo"],
              },
              sales: {
                cta: "CTA salvo.",
              },
            },
          },
          ui: { structured_response: false },
        } as never,
        {
          extractSemanticBusinessRuntimeFromAgentText: async () => ({
            business: {
              summary: "Resumo vindo do texto.",
              services: ["Servico do texto"],
            },
            sales: {
              cta: "CTA do texto.",
            },
          }),
          classifySemanticBillingIntentStage: async () => null,
          generateSalesReply: async (_history, runtimeContext) => {
            assert.equal(runtimeContext?.agente?.runtimeConfig?.business?.summary, "Resumo salvo explicitamente.")
            assert.deepEqual(runtimeContext?.agente?.runtimeConfig?.business?.services, ["Servico salvo"])
            assert.equal(runtimeContext?.agente?.runtimeConfig?.sales?.cta, "CTA salvo.")
            return {
              reply: "Business explicito preservado.",
              assets: [],
              usage: { inputTokens: 0, outputTokens: 0 },
              metadata: {
                provider: "openai",
                model: "test",
                agenteId: "agent-business-explicit-priority",
                agenteNome: "InfraStudio",
                routeStage: "sales",
                heuristicStage: null,
                domainStage: "general",
              },
            }
          },
        }
      )

      assert.match(result.reply, /Business explicito preservado/i)
    },
  },
  {
    name: "orquestrador nao extrai business do texto do agente quando o roteamento inicial ja e catalogo",
    run: async () => {
      let extractionCalls = 0

      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "me mostra saleiros" }] as never,
        {
          agente: {
            id: "agent-no-business-extract-catalog",
            nome: "Loja Cliente",
            promptBase: "Automacao com IA, WhatsApp e sistemas sob medida.",
          },
          projeto: {
            directConnections: {
              mercadoLivre: 1,
            },
          },
          catalogo: {
            ultimosProdutos: [{ id: "saleiro-1", nome: "Saleiro Azul" }],
          },
        } as never,
        {
          extractSemanticBusinessRuntimeFromAgentText: async () => {
            extractionCalls += 1
            return {
              business: {
                summary: "Resumo extraido do texto.",
                services: ["Servico extraido"],
              },
              sales: {
                cta: "CTA extraido.",
              },
            }
          },
          classifySemanticIntentStage: async () => ({
            intent: "catalog_search_refinement",
            confidence: 0.91,
            reason: "Cliente refinou a busca recente.",
            targetType: "saleiro",
            referencedProductIds: [],
            excludeCurrentProduct: false,
            usedLlm: true,
          }),
          generateSalesReply: async () => ({
            reply: "Busca de catalogo mantida.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-no-business-extract-catalog",
              agenteNome: "Loja Cliente",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "catalog",
            },
          }),
        }
      )

      assert.equal(extractionCalls, 0)
      assert.match(result.reply, /Busca de catalogo mantida/i)
    },
  },
  {
    name: "orquestrador nao reutiliza catalogo de pricing por historico antigo sem billing atual",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [
          { role: "user", content: "quais planos voces tem?" },
          { role: "assistant", content: "Temos Basic e Pro." },
          { role: "user", content: "e agora?" },
        ] as never,
        {
          agente: {
            id: "agent-billing-history",
            nome: "InfraStudio",
            promptBase: "Voce vende planos e servicos digitais.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                ],
              },
            },
          },
          ui: { structured_response: false },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => null,
          generateSalesReply: async () => ({
            reply: "Posso te explicar melhor o que voce precisa agora.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-billing-history",
              agenteNome: "InfraStudio",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "general",
            },
          }),
        }
      )

      assert.match(result.reply, /explicar melhor/i)
      assert.doesNotMatch(result.reply, /Basic: R\$ 29,90\/mes/i)
      assert.doesNotMatch(result.reply, /Pro: R\$ 149,90\/mes/i)
    },
  },
  {
    name: "orquestrador nao usa fallback residual de pricing quando o intent stage nao classifica",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual o valor do pro?" }] as never,
        {
          agente: {
            id: "agent-billing-no-fallback",
            nome: "InfraStudio",
            promptBase: "Voce vende planos e servicos digitais.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                ],
              },
            },
          },
          ui: { structured_response: false },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => null,
          generateSalesReply: async () => ({
            reply: "Posso te explicar melhor como cada plano funciona.",
            assets: [],
            usage: { inputTokens: 0, outputTokens: 0 },
            metadata: {
              provider: "openai",
              model: "test",
              agenteId: "agent-billing-no-fallback",
              agenteNome: "InfraStudio",
              routeStage: "sales",
              heuristicStage: null,
              domainStage: "billing",
            },
          }),
        }
      )

      assert.match(result.reply, /explicar melhor/i)
      assert.doesNotMatch(result.reply, /Pro: R\$ 149,90\/mes/i)
      assert.equal(result.metadata?.heuristicStage, null)
    },
  },
  {
    name: "orquestrador compara planos especificos pelo intent stage estruturado",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "compara basic e pro" }] as never,
        {
          agente: {
            id: "agent-billing-compare",
            nome: "InfraStudio",
            promptBase: "Voce vende planos de assinatura.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  { slug: "basic", name: "Basic", matchAny: ["basic"], priceLabel: "R$ 29,90/mes" },
                  { slug: "plus", name: "Plus", matchAny: ["plus"], priceLabel: "R$ 79,90/mes" },
                  { slug: "pro", name: "Pro", matchAny: ["pro"], priceLabel: "R$ 149,90/mes" },
                ],
              },
            },
          },
          ui: { structured_response: true },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_comparison",
            confidence: 0.91,
            reason: "Cliente pediu comparacao de planos.",
            requestedPlanNames: ["basic", "pro"],
            usedLlm: true,
          }),
        }
      )

      assert.match(result.reply, /Basic: R\$ 29,90\/mes/i)
      assert.match(result.reply, /Pro: R\$ 149,90\/mes/i)
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
    name: "whatsapp envia mercado livre com link limpo e comentario comercial",
    run: () => {
      const sequence = buildWhatsAppMessageSequence(
        "Separei alguns itens da loja para voce ver.",
        [
          {
            kind: "product",
            provider: "mercado_livre",
            nome: "Aparelho De Jantar Oxford Ceramica",
            targetUrl: "https://produto.mercadolivre.com.br/MLB123",
            metadata: {
              availableQuantity: 1,
            },
          },
        ]
      );

      assert.equal(sequence.length, 3);
      assert.equal(sequence[0], "Separei alguns itens da loja para voce ver.");
      assert.match(sequence[1], /^\*1\.\s+Aparelho De Jantar Oxford Ceramica\*/i);
      assert.match(sequence[1], /https:\/\/produto\.mercadolivre\.com\.br\/MLB123/);
      assert.match(sequence[1], /pode combinar com o que voce pediu/i);
      assert.match(sequence[1], /tenho 1 em estoque agora/i);
      assert.match(sequence[2], /responda MAIS/i);
      assert.match(sequence[2], /responda 1, 2 ou 3/i);
    },
  },
  {
    name: "whatsapp envia produto de api com link limpo e comentario comercial",
    run: () => {
      const sequence = buildWhatsAppMessageSequence(
        "Separei uma opcao para voce ver.",
        [
          {
            kind: "product",
            provider: "api_runtime",
            nome: "Kit Mesa Posta Premium",
            targetUrl: "https://catalogo.exemplo.local/produtos/kit-mesa-posta-premium",
            metadata: {
              availableQuantity: 7,
            },
          },
        ]
      );

      assert.equal(sequence.length, 3);
      assert.equal(sequence[0], "Separei uma opcao para voce ver.");
      assert.match(sequence[1], /^\*1\.\s+Kit Mesa Posta Premium\*/i);
      assert.match(sequence[1], /https:\/\/catalogo\.exemplo\.local\/produtos\/kit-mesa-posta-premium/);
      assert.match(sequence[1], /pode combinar com o que voce pediu|parece uma opcao forte para seguir agora/i);
      assert.match(sequence[1], /tenho 7 em estoque agora/i);
      assert.match(sequence[2], /responda MAIS/i);
      assert.match(sequence[2], /responda 1, 2 ou 3/i);
    },
  },
  {
    name: "whatsapp ajusta comentario comercial por contexto de produto",
    run: () => {
      const singleFocus = buildWhatsAppMessageSequence(
        "Perfeito, vamos seguir com esse item.",
        [
          {
            kind: "product",
            provider: "mercado_livre",
            nome: "Jogo De Jantar",
            targetUrl: "https://produto.mercadolivre.com.br/MLB321",
            metadata: { availableQuantity: 2 },
          },
        ]
      );
      const loadMore = buildWhatsAppMessageSequence(
        "Separei mais opcoes para voce.",
        [
          {
            kind: "product",
            provider: "mercado_livre",
            nome: "Jogo De Jantar Azul",
            targetUrl: "https://produto.mercadolivre.com.br/MLB654",
            metadata: { availableQuantity: 3 },
          },
        ],
        "Se quiser, eu continuo te mostrando outras opcoes."
      );

      assert.match(singleFocus[1], /parece a melhor opcao para seguir agora/i);
      assert.match(singleFocus[2], /responda MAIS/i);
      assert.match(singleFocus[2], /responda 1, 2 ou 3/i);
      assert.match(loadMore[2], /entra como mais uma opcao nessa linha/i);
      assert.match(loadMore[2], /continuo te mandando outras variacoes parecidas/i);
      assert.match(loadMore[3], /responda MAIS/i);
      assert.match(loadMore[3], /responda 1, 2 ou 3/i);
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
      const broadLoadMoreDetected = isCatalogLoadMoreMessage("manda o q tiver")
      const broadCatalogDecision = resolveDeterministicCatalogFollowUpDecision("manda o q tiver", catalogContext as never, deps as never)
      const splitReply = splitCatalogReplyForWhatsApp(
        "Encontrei algumas opcoes para voce. Me diga se gostou de algum ou se quer que eu traga mais opcoes nesse estilo.",
        true
      )

      assert.equal(searchDetected, true)
      assert.equal(loadMoreDetected, true)
      assert.equal(broadLoadMoreDetected, true)
      assert.equal(broadCatalogDecision?.shouldBlockNewSearch, false)
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
          images: ["https://example.com/jantar.jpg", "https://example.com/jantar-2.jpg"],
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
      assert.equal(products[0]?.imagens?.length, 2)
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
          conversation: { mode: "product_detail" },
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
      assert.equal(nextContext.conversation.mode, "listing")
      assert.equal(nextContext.widget.slug, "main")
    },
  },
  {
    name: "service preserva produto travado da pagina de detalhe sem derrubar foco por listagem posterior",
    run: () => {
      const updatedContext = updateContextFromAiResult({
        nextContext: {
          conversation: { mode: "product_detail" },
          storefront: { pageKind: "product_detail" },
          ui: { productDetailPreferred: true },
          catalogo: {
            produtoAtual: {
              id: "MLB-LOCKED-1",
              nome: "Aparelho De Jantar Oxford Ceramica",
            },
            focusMode: "product_focus",
          },
        },
        ai: {
          reply: "Encontrei algumas opcoes.",
          assets: [],
          metadata: {
            catalogoBusca: {
              ultimaBusca: "aparelho de jantar",
              ultimosProdutos: [
                { id: "MLB1", nome: "Opcao 1" },
                { id: "MLB2", nome: "Opcao 2" },
              ],
            },
          },
        },
        chatId: "chat-locked",
        historyLengthSource: 3,
      })

      assert.equal(updatedContext.conversation.mode, "product_detail")
      assert.equal(updatedContext.catalogo.catalogState, "product_locked")
      assert.equal(updatedContext.catalogo.produtoAtual.id, "MLB-LOCKED-1")
      assert.equal(updatedContext.catalogo.focusMode, "product_focus")
      assert.equal(updatedContext.catalogo.ultimosProdutos.length, 2)
    },
  },
  {
    name: "service limpa produto atual residual quando a ia devolve lista com varios itens",
    run: () => {
      const updatedContext = updateContextFromAiResult({
        nextContext: {
          conversation: { mode: "product_focus" },
          storefront: { pageKind: "storefront" },
          catalogo: {
            produtoAtual: {
              id: "MLB-OLD-1",
              nome: "Bule Antigo",
            },
            focusMode: "product_focus",
          },
        },
        ai: {
          reply: "Encontrei algumas opcoes.",
          assets: [],
          metadata: {
            catalogoBusca: {
              ultimaBusca: "bules",
              ultimosProdutos: [
                { id: "MLB1", nome: "Opcao 1" },
                { id: "MLB2", nome: "Opcao 2" },
              ],
            },
          },
        },
        chatId: "chat-listing-reset",
        historyLengthSource: 4,
      })

      assert.equal(updatedContext.conversation.mode, "listing")
      assert.equal(updatedContext.catalogo.focusMode, "listing")
      assert.equal(updatedContext.catalogo.catalogState, "storefront_listing")
      assert.equal(updatedContext.catalogo.produtoAtual, null)
      assert.equal(updatedContext.catalogo.ultimosProdutos.length, 2)
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
        actions: [{ type: "agenda_schedule", label: "Agendar horario" }],
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
      assert.equal(result.actions.length, 1)
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
            agente: { id: "agent-widget", nome: "Agente Widget", promptBase: "Atenda com objetividade." },
            widget: null,
            lockedToAgent: true,
            channel: { kind: "external_widget" },
          }),
          getChatById: async (chatId: string) => ({
            id: chatId,
            status: "ativo",
            projetoId: "proj-widget",
            agenteId: "agent-widget",
            contexto: {
              projeto: { id: "proj-widget", nome: "Projeto Widget", slug: "proj-widget" },
              agente: { id: "agent-widget", nome: "Agente Widget", promptBase: "Atenda com objetividade." },
            },
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
          getActiveWhatsAppChannelByProjectAgent: async () => null,
        }
      )

      const fallback = await resolveChatChannel(
        {
          canal: "web",
          identificadorExterno: "lead-12",
        },
        {
          getChatWidgetBySlug: async () => null,
          getActiveWhatsAppChannelByProjectAgent: async () => null,
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
      assert.equal(nextContext.catalogo.focusMode, "product_focus")
      assert.equal(nextContext.conversation.mode, "product_focus")
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
              kind: "product",
              provider: "mercado_livre",
              nome: "Jogo de Jantar Porcelana",
              descricao: "Conjunto floral",
              targetUrl: "https://example.com/jantar",
            },
          ],
        },
        nextContext: {
          lead: { nome: "Julia" },
          conversation: {
            mode: "listing",
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
          catalogo: {
            ultimosProdutos: [
              {
                id: "MLB1",
                nome: "Jogo de Jantar Porcelana",
              },
            ],
          },
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
              kind: "product",
              provider: "mercado_livre",
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
      assert.equal(webPayload.actions[0]?.type, "message")
      assert.equal(webPayload.actions[0]?.label, "Ver mais opcoes")
      assert.equal(webPayload.actions[0]?.skipUserBubble, true)
      assert.equal(webPayload.actions[0]?.extraContext?.ui?.catalogAction, "load_more")
      assert.doesNotMatch(whatsappPayload.primaryReply, /vou verificar|acolhedora/i)
      assert.equal(whatsappPayload.whatsappEmbeddedSequence.length, 3)
      assert.match(whatsappPayload.whatsappEmbeddedSequence[2] || "", /responda MAIS/i)
      assert.match(whatsappPayload.whatsappEmbeddedSequence[2] || "", /responda 1, 2 ou 3/i)
      assert.equal(whatsappPayload.whatsappContactNameForTitle, "Julia Rodrigues")
      assert.equal(whatsappPayload.contactSnapshot.contatoTelefone, "5511999999999")
    },
  },
  {
    name: "service injeta CTA discreto de WhatsApp no widget quando houver canal ativo",
    run: () => {
      const payload = prepareAiReplyPayload({
        channelKind: "web",
        ai: {
          reply: "Posso seguir com os detalhes por aqui e tambem no WhatsApp.",
          assets: [],
        },
        nextContext: {
          whatsapp: {
            numero: "5511999999999",
            ctaEnabled: true,
          },
        },
        agendaSlots: [
          {
            id: "slot-1",
            dataInicio: "2026-04-25T14:00:00.000Z",
            data: "2026-04-25",
            dia: "2026-04-25",
            horaInicio: "14:00",
            horaFim: "15:00",
            timezone: "America/Sao_Paulo",
          },
        ],
        normalizedExternalIdentifier: "lead-2",
        userMessage: "Quero entender valores e prazo do projeto",
      })

      assert.equal(payload.whatsappCta?.label, "Continuar no WhatsApp")
      assert.equal(payload.whatsappCta?.summary, "Leva um resumo rapido desta conversa.")
      assert.match(String(payload.whatsappCta?.url || ""), /^https:\/\/wa\.me\/5511999999999\?text=/i)
      assert.equal(Array.isArray(payload.actions), true)
      assert.equal(payload.actions.length, 2)
      assert.equal(payload.actions[0]?.type, "whatsapp_link")
      assert.equal(payload.actions[1]?.type, "agenda_schedule")
      assert.match(
        decodeURIComponent(String(payload.whatsappCta?.url || "").split("?text=")[1] || ""),
        /Resumo rapido:\n- Meu interesse: Quero entender valores e prazo do projeto/i
      )
      assert.match(payload.followUpReply, /marcar um horario/i)
      assert.doesNotMatch(payload.followUpReply, /continuar no WhatsApp/i)
    },
  },
  {
    name: "service nao injeta CTA de WhatsApp em micro-resposta factual do catalogo",
    run: () => {
      const payload = prepareAiReplyPayload({
        channelKind: "web",
        ai: {
          reply: "Altura: 81 cm.",
          assets: [],
          metadata: {
            heuristicStage: "mercado_livre_product_fact",
            catalogFactContext: {
              fields: ["height"],
              scope: "product",
              productId: "MLB-81",
            },
          },
        },
        nextContext: {
          whatsapp: {
            numero: "5511999999999",
            ctaEnabled: true,
          },
          conversation: {
            mode: "product_focus",
          },
          catalogo: {
            produtoAtual: {
              id: "MLB-81",
              nome: "Quadro Decorativo",
            },
          },
        },
        normalizedExternalIdentifier: "lead-3",
        userMessage: "altura?",
      })

      assert.equal(payload.whatsappCta, null)
      assert.equal(payload.actions.some((action) => action?.type === "whatsapp_link"), false)
      assert.equal(payload.actions.length, 0)
    },
  },
  {
    name: "service nao oferece agenda em contexto de catalogo da loja",
    run: () => {
      const payload = prepareAiReplyPayload({
        channelKind: "web",
        ai: {
          reply: "Encontrei algumas opcoes para voce.",
          assets: [{ id: "mercado-livre-1" }],
        },
        nextContext: {
          conversation: {
            mode: "listing",
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "storefront",
          },
          catalogo: {
            ultimosProdutos: [
              {
                id: "MLB1",
                nome: "Produto 1",
              },
            ],
          },
          whatsapp: {
            numero: "5511999999999",
            ctaEnabled: true,
          },
        },
        agendaSlots: [
          {
            id: "slot-1",
            dataInicio: "2026-04-25T14:00:00.000Z",
            data: "2026-04-25",
            dia: "2026-04-25",
            horaInicio: "14:00",
            horaFim: "15:00",
            timezone: "America/Sao_Paulo",
          },
        ],
        normalizedExternalIdentifier: "lead-catalog-1",
        userMessage: "me mostra as opcoes",
      })

      assert.equal(Array.isArray(payload.actions), true)
      assert.equal(payload.actions.length, 2)
      assert.equal(payload.actions[0]?.type, "message")
      assert.equal(payload.actions[1]?.type, "whatsapp_link")
      assert.doesNotMatch(String(payload.followUpReply || ""), /marcar um horario/i)
    },
  },
  {
    name: "service resolve ou cria sessao de chat ativa",
    run: async () => {
      const resolved = {
        projeto: { id: "proj-20", nome: "Projeto 20", slug: "proj-20" },
        agente: { id: "agent-20", nome: "Agente 20" },
        widget: { id: "widget-20", slug: "widget-20", whatsappCelular: "5511999999999" },
        whatsappChannel: {
          id: "wa-20",
          number: "5511999999999",
          connectionStatus: "connected",
        },
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
      assert.equal(initialContext.whatsapp.ctaEnabled, true)
      assert.equal(initialContext.whatsapp.channelId, "wa-20")
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
        actions: [{ type: "agenda_schedule", label: "Agendar horario" }],
      })

      assert.equal(metadata.provider, "openai")
      assert.equal(Array.isArray(metadata.assets), true)
      assert.equal(assistantMessage.id, "msg-80")
      assert.equal(assistantMessage.role, "assistant")
      assert.equal(finalResult.chatId, "chat-80")
      assert.equal(finalResult.followUpReply, "Se quiser, trago mais.")
      assert.equal(finalResult.assets.length, 1)
      assert.equal(finalResult.actions.length, 1)
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
              agente: { id: "agent-90", nome: "Agente 90", promptBase: "Atenda com objetividade." },
              widget: null,
              lockedToAgent: true,
              channel: { kind: "web" },
            }),
            ensureActiveChatSession: async () => ({
              chat: {
                id: "chat-90",
                projetoId: "proj-90",
                contexto: {
                  projeto: { id: "proj-90", nome: "Projeto 90", slug: "proj-90" },
                  agente: { id: "agent-90", nome: "Agente 90", promptBase: "Atenda com objetividade." },
                },
              },
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
  {
    name: "busca de catalogo remove termos genericos e nao deixa inox casar com item de madeira",
    run: () => {
      const candidates = buildProductSearchCandidates("o que vc tem de inox", {
        normalizeText: normalizeFixtureText,
        isGreetingOrAckMessage: (message: string) => isGreetingOrAckMessage(message, { normalizeText: normalizeFixtureText }),
      });
      const woodItem = {
        title: "Bau de madeira vintage",
        sellerName: "Reliquias de Familia",
        shortDescription: "Item decorativo antigo",
        descriptionPlain: "Item de madeira com detalhes em metal",
        attributes: [{ name: "Material", valueName: "Madeira" }],
        variations: [],
      };
      const inoxItem = {
        title: "Conjunto Cha Cafe Inox Fracalanza Bandeja Vintage Prateado",
        sellerName: "Reliquias de Familia",
        shortDescription: "Conjunto em inox",
        descriptionPlain: "Servico completo em inox vintage",
        attributes: [{ name: "Material", valueName: "Inox" }],
        variations: [],
      };

      assert.deepEqual(candidates, ["inox"]);
      assert.equal(scoreMercadoLivreItem(woodItem, "tem inox"), 0);
      assert.ok(scoreMercadoLivreItem(inoxItem, "tem inox") > 0);
    },
  },
  {
    name: "orquestrador de billing responde slot factual e atualiza contexto do plano em foco",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "quantos atendimentos cabem no plano plus?" }] as never,
        {
          agente: {
            id: "agent-billing-1",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "plus",
                    name: "Plano Plus",
                    matchAny: ["plus", "plano plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                    agentLimit: 2,
                    creditLimit: 400000,
                    whatsappIncluded: true,
                    supportLevel: "prioritario",
                    features: ["chat widget"],
                    channels: ["web", "whatsapp"],
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-1",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_limit_question",
            confidence: 0.97,
            reason: "pedido de capacidade do plano",
            requestedPlanNames: ["Plano Plus"],
            targetField: "attendance_limit",
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.match(result.reply, /Plano Plus comporta 250 atendimentos/i)
      assert.equal(result.metadata?.provider, "billing_runtime")
      assert.equal(result.metadata?.billingContextUpdate?.planFocus?.slug, "plus")
      assert.equal(result.metadata?.billingDiagnostics?.targetField, "attendance_limit")
    },
  },
  {
    name: "orquestrador de billing responde pergunta composta com slots estruturados",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "o plus tem whatsapp e quantos atendimentos?" }] as never,
        {
          agente: {
            id: "agent-billing-2",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "plus",
                    name: "Plano Plus",
                    matchAny: ["plus", "plano plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                    whatsappIncluded: true,
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-2",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_feature_question",
            confidence: 0.97,
            reason: "pedido composto sobre o plano",
            requestedPlanNames: ["Plano Plus"],
            targetField: "whatsapp_included",
            targetFields: ["whatsapp_included", "attendance_limit"],
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.match(result.reply, /WhatsApp: Sim\./i)
      assert.match(result.reply, /250 atendimentos\./i)
      assert.deepEqual(result.metadata?.billingDiagnostics?.targetFields, ["whatsapp_included", "attendance_limit"])
    },
  },
  {
    name: "orquestrador de billing recomenda plano por capacidade de forma deterministica",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "se eu precisar de mais atendimentos, qual plano faz sentido?" }] as never,
        {
          agente: {
            id: "agent-billing-3",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "basic",
                    name: "Basic",
                    matchAny: ["basic"],
                    priceLabel: "R$ 29,90/mes",
                    attendanceLimit: 100,
                  },
                  {
                    slug: "plus",
                    name: "Plus",
                    matchAny: ["plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                  },
                  {
                    slug: "pro",
                    name: "Pro",
                    matchAny: ["pro"],
                    priceLabel: "R$ 149,90/mes",
                    attendanceLimit: 500,
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-3",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
          billing: {
            planFocus: {
              slug: "basic",
              name: "Basic",
            },
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_recommendation",
            confidence: 0.96,
            reason: "pedido de recomendacao por capacidade",
            requestedPlanNames: [],
            targetField: "attendance_limit",
            targetFields: ["attendance_limit"],
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.match(result.reply, /melhor proximo encaixe e o Plus/i)
      assert.equal(result.metadata?.provider, "billing_runtime")
      assert.equal(result.metadata?.billingContextUpdate?.planFocus?.slug, "plus")
    },
  },
  {
    name: "orquestrador de billing responde comparacao multi-slot e persiste comparisonFocus",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual a diferenca do plus pro pro em atendimento e agentes?" }] as never,
        {
          agente: {
            id: "agent-billing-4",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "plus",
                    name: "Plus",
                    matchAny: ["plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                    agentLimit: 2,
                  },
                  {
                    slug: "pro",
                    name: "Pro",
                    matchAny: ["pro"],
                    priceLabel: "R$ 149,90/mes",
                    attendanceLimit: 500,
                    agentLimit: 5,
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-4",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_comparison",
            confidence: 0.96,
            reason: "comparacao multi-slot entre dois planos",
            requestedPlanNames: ["plus", "pro"],
            targetField: "attendance_limit",
            targetFields: ["attendance_limit", "agent_limit"],
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.equal(result.metadata?.billingContextUpdate?.comparisonFocus?.plans?.[1]?.slug, "pro")
      assert.deepEqual(result.metadata?.billingDiagnostics?.targetFields, ["attendance_limit", "agent_limit"])
      assert.match(result.reply, /500 atendimentos/i)
      assert.match(result.reply, /5 agentes/i)
    },
  },
  {
    name: "orquestrador de billing recomenda plano por multiplos criterios de forma deterministica",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "quero mais atendimentos, mais agentes e whatsapp. qual plano faz mais sentido?" }] as never,
        {
          agente: {
            id: "agent-billing-5",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "basic",
                    name: "Basic",
                    matchAny: ["basic"],
                    priceLabel: "R$ 29,90/mes",
                    attendanceLimit: 100,
                    agentLimit: 1,
                    whatsappIncluded: false,
                  },
                  {
                    slug: "plus",
                    name: "Plus",
                    matchAny: ["plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                    agentLimit: 2,
                    whatsappIncluded: true,
                  },
                  {
                    slug: "pro",
                    name: "Pro",
                    matchAny: ["pro"],
                    priceLabel: "R$ 149,90/mes",
                    attendanceLimit: 500,
                    agentLimit: 5,
                    whatsappIncluded: true,
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-5",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_recommendation",
            confidence: 0.96,
            reason: "recomendacao multi-criterio",
            requestedPlanNames: [],
            targetField: "attendance_limit",
            targetFields: ["attendance_limit", "agent_limit", "whatsapp_included"],
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.equal(result.metadata?.billingContextUpdate?.planFocus?.slug, "pro")
      assert.match(result.reply, /Pro/i)
      assert.match(result.reply, /WhatsApp: Sim/i)
    },
  },
  {
    name: "orquestrador de billing recommendation aberta pede criterio",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual plano voce recomenda?" }] as never,
        {
          agente: {
            id: "agent-billing-6",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "basic",
                    name: "Basic",
                    matchAny: ["basic"],
                    priceLabel: "R$ 29,90/mes",
                    attendanceLimit: 100,
                    agentLimit: 1,
                  },
                  {
                    slug: "plus",
                    name: "Plus",
                    matchAny: ["plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                    agentLimit: 2,
                    whatsappIncluded: true,
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-6",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_recommendation",
            confidence: 0.96,
            reason: "recommendation aberta sem criterio",
            requestedPlanNames: [],
            targetField: "",
            targetFields: [],
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.equal(result.metadata?.billingDiagnostics?.targetField, null)
      assert.match(result.reply, /preciso que voce priorize um criterio/i)
    },
  },
  {
    name: "orquestrador de billing usa comparisonFocus para responder qual vale mais a pena",
    run: async () => {
      const result = await executeSalesOrchestrator(
        [{ role: "user", content: "qual vale mais a pena?" }] as never,
        {
          agente: {
            id: "agent-billing-7",
            nome: "InfraStudio",
            promptBase: "Atenda com objetividade.",
            runtimeConfig: {
              pricingCatalog: {
                enabled: true,
                items: [
                  {
                    slug: "plus",
                    name: "Plus",
                    matchAny: ["plus"],
                    priceLabel: "R$ 79,90/mes",
                    attendanceLimit: 250,
                    agentLimit: 2,
                  },
                  {
                    slug: "pro",
                    name: "Pro",
                    matchAny: ["pro"],
                    priceLabel: "R$ 149,90/mes",
                    attendanceLimit: 500,
                    agentLimit: 5,
                  },
                ],
              },
            },
          },
          projeto: {
            id: "proj-billing-7",
            nome: "Projeto teste",
            slug: "projeto-teste",
            directConnections: {
              mercadoLivre: 0,
            },
          },
          channel: {
            kind: "web",
          },
          billing: {
            comparisonFocus: {
              plans: [
                { slug: "plus", name: "Plus" },
                { slug: "pro", name: "Pro" },
              ],
              fields: ["attendance_limit", "agent_limit"],
            },
          },
        } as never,
        {
          classifySemanticBillingIntentStage: async () => ({
            intent: "plan_recommendation",
            confidence: 0.96,
            reason: "follow-up consultivo apos comparacao",
            requestedPlanNames: [],
            targetField: "",
            targetFields: [],
            usedLlm: true,
          }),
          classifySemanticApiIntentStage: async () => null,
          classifySemanticIntentStage: async () => null,
        }
      )

      assert.equal(result.metadata?.billingContextUpdate?.planFocus?.slug, "pro")
      assert.match(result.reply, /plano que mais faz sentido no catalogo hoje e o Pro/i)
    },
  },
  {
    name: "buildBillingContextUpdate nao apaga foco anterior em overview generico",
    run: () => {
      const update = buildBillingContextUpdate(
        {
          kind: "pricing_overview",
          targetField: "price",
          requestedPlanNames: [],
        },
        {
          pricingCatalog: {
            enabled: true,
            items: [
              {
                slug: "plus",
                name: "Plano Plus",
                matchAny: ["plus"],
                priceLabel: "R$ 79,90/mes",
              },
            ],
          },
        },
        {
          billing: {
            planFocus: {
              slug: "plus",
              name: "Plano Plus",
            },
          },
        }
      )

      assert.equal(Object.prototype.hasOwnProperty.call(update ?? {}, "planFocus"), false)
      assert.equal(update?.lastIntent, "pricing_overview")
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
