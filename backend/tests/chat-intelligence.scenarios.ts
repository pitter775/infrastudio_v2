import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

import {
  appendOptionalHumanOffer,
  buildApiFallbackReply,
  buildCatalogDecisionFromSemanticIntent,
  buildFocusedApiContext,
  buildHumanHandoffReply,
  buildWhatsAppMessageSequence,
  classifyHumanEscalationNeed,
  resolveDeterministicCatalogFollowUpDecision,
  extractRecentMercadoLivreProductsFromAssets,
  isHumanHandoffIntent,
  mergeContext,
  resolveCanonicalWhatsAppExternalIdentifier,
  resolveChatContactSnapshot,
  resolveConversationPipelineStageState,
  resolveRecentCatalogProductReference,
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

type ScenarioResult = {
  category: string;
  title: string;
  input: string;
  observations: string[];
};

const deps = createFixtureSearchDeps();
const catalogContext = loadCatalogContextFixture();
const apiFixture = loadApiRuntimeFixture();
const apiRealEstateFixture = loadApiRuntimeRealEstateFixture();
const handoffFixture = loadHandoffFixture();
const leadContextFixture = loadLeadContextFixture();
const whatsappContextFixture = loadWhatsAppContextFixture();

function buildScenarioResults() {
  const scenarios: ScenarioResult[] = [];

  const catalogDecision = resolveDeterministicCatalogFollowUpDecision("gostei da sopeira que mandou", catalogContext as never, deps as never);
  const catalogAmbiguous = resolveDeterministicCatalogFollowUpDecision("quero o amarelo", catalogContext as never, deps as never);
  const catalogResolved = resolveRecentCatalogProductReference("gostei da dopeira que mandou", catalogContext as never);
  scenarios.push({
    category: "catalog",
    title: "resolucao de catalogo recente",
    input: "gostei da sopeira que mandou",
    observations: [
      `decision=${catalogDecision?.kind ?? "null"}`,
      `ambiguous=${catalogAmbiguous?.kind ?? "null"}`,
      `resolved_refs=${catalogResolved.map((item: any) => item.nome ?? item.id).join(" | ") || "none"}`,
    ],
  });

  const semanticDecision = buildCatalogDecisionFromSemanticIntent({
    semanticIntent: {
      intent: "product_question",
      confidence: 0.92,
      reason: "pergunta sobre item em foco",
      usedLlm: true,
    },
    context: catalogContext,
    recentProducts: catalogContext.catalogo?.ultimosProdutos ?? [],
    currentCatalogProduct: catalogContext.catalogo?.produtoAtual ?? null,
  });
  scenarios.push({
    category: "catalog",
    title: "catalogo semantico segura produto em foco",
    input: "tem garantia?",
    observations: [
      `semantic_decision=${semanticDecision?.kind ?? "null"}`,
      `used_llm=${String(semanticDecision?.usedLlm ?? false)}`,
    ],
  });

  const apiFocused = buildFocusedApiContext("status pedido PED-2026-0042 previsao envio", apiFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value: string) => value,
  });
  const apiReply = buildApiFallbackReply("me passa a data do leilao", apiRealEstateFixture.apis, {
    normalizeText: normalizeFixtureText,
    buildSearchTokens: (value: string) => normalizeFixtureText(value).split(/\s+/).filter((item) => item.length >= 2),
    singularizeToken: (value: string) => value,
  });
  const apiStage = resolveConversationPipelineStageState({
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
  scenarios.push({
    category: "api",
    title: "api runtime focal e data normalizada",
    input: "status pedido PED-2026-0042 / me passa a data do leilao",
    observations: [
      `focused_fields=${apiFocused.fields.length}`,
      `api_reply_has_date=${/27\/03\/2026/.test(apiReply ?? "") ? "yes" : "no"}`,
      `api_reply_has_raw_iso=${/2026-03-27T16:00:00Z/.test(apiReply ?? "") ? "yes" : "no"}`,
      `domain_stage=${apiStage.conversationDomainStage}`,
    ],
  });

  const explicitIntent = isHumanHandoffIntent(handoffFixture.explicitHumanMessage);
  const handoffOffer = appendOptionalHumanOffer(handoffFixture.softOfferReply, "whatsapp");
  const handoffReply = buildHumanHandoffReply("whatsapp");
  scenarios.push({
    category: "handoff",
    title: "handoff explicito e resposta controlada",
    input: handoffFixture.explicitHumanMessage,
    observations: [
      `explicit_intent=${String(explicitIntent)}`,
      `offer_has_human=${/atendente humano/i.test(handoffOffer) ? "yes" : "no"}`,
      `reply_has_channel=${/WhatsApp/i.test(handoffReply) ? "yes" : "no"}`,
    ],
  });

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
  scenarios.push({
    category: "whatsapp",
    title: "identidade canonica e lote humanizado",
    input: "catalogo enviado no whatsapp",
    observations: [
      `canonical=${canonical}`,
      `sequence_length=${sequence.length}`,
      `intro_has_follow_up=${/me diga se gostou de algum|traga mais opcoes/i.test(sequence[0] ?? "") ? "yes" : "no"}`,
    ],
  });

  const mergedContext = mergeContext(
    { lead: { identificado: false } },
    {
      whatsapp: {
        contactName: "Julia Rodrigues",
        profilePicUrl: "https://example.com/julia.jpg",
      },
    }
  )
  const contactSnapshot = resolveChatContactSnapshot(mergedContext, "5511999999999")
  const recentProducts = extractRecentMercadoLivreProductsFromAssets([
    {
      id: "MLB1",
      nome: "Jogo de Jantar Porcelana",
      descricao: "R$ 2.990,00",
      targetUrl: "https://example.com/jantar",
      publicUrl: "https://example.com/jantar.jpg",
    },
    {
      id: "asset-generic",
      nome: "Arquivo",
      descricao: "sem preco",
    },
  ])
  scenarios.push({
    category: "service",
    title: "snapshot de contato e assets recentes",
    input: "mergeContext + assets mercado livre",
    observations: [
      `snapshot_name=${contactSnapshot.contatoNome ?? "null"}`,
      `snapshot_phone=${contactSnapshot.contatoTelefone ?? "null"}`,
      `snapshot_avatar=${contactSnapshot.contatoAvatarUrl ? "yes" : "no"}`,
      `recent_products=${recentProducts.length}`,
      `recent_first_price=${recentProducts[0]?.preco ?? "null"}`,
    ],
  })

  return scenarios;
}

function summarizeByCategory(scenarios: ScenarioResult[]) {
  const counts = new Map<string, number>();

  for (const scenario of scenarios) {
    counts.set(scenario.category, (counts.get(scenario.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([category, count]) => `${category}: ${count} cenarios`);
}

async function persistScenarioHistory(scenarios: ScenarioResult[]) {
  const timestamp = new Date().toISOString();
  const safeTimestamp = timestamp.replace(/[:.]/g, "-");
  const outputDir = path.resolve(process.cwd(), "analises");
  const outputFile = path.join(outputDir, `chat-intelligence-${safeTimestamp}.md`);

  await mkdir(outputDir, { recursive: true });

  const decision = await classifyHumanEscalationNeed({
    projetoId: null,
    channelKind: "web",
    message: "nao entendi",
    aiReply: "Posso tentar de outro jeito.",
    aiMetadata: { provider: "agent_scoped_recovery" },
    context: leadContextFixture,
    history: handoffFixture.recoveryHistory,
  });

  const body = [
    "# Chat Intelligence Scenario Report",
    "",
    `Execucao: ${timestamp}`,
    "",
    "## Resumo",
    "",
    ...summarizeByCategory(scenarios).map((item) => `- ${item}`),
    `- handoff_runtime_decision: ${decision.decision}`,
    "",
    ...scenarios.flatMap((scenario) => [
      `## [${scenario.category}] ${scenario.title}`,
      `Input: \`${scenario.input}\``,
      ...scenario.observations.map((observation) => `- ${observation}`),
      "",
    ]),
  ].join("\n");

  await writeFile(outputFile, `${body}\n`, "utf8");
  return outputFile;
}

async function main() {
  const scenarios = buildScenarioResults();
  const historyFile = await persistScenarioHistory(scenarios);

  console.log("\nChat Intelligence Scenario Report\n");
  for (const scenario of scenarios) {
    console.log(`[${scenario.category}] ${scenario.title}`);
    for (const observation of scenario.observations) {
      console.log(`- ${observation}`);
    }
    console.log("");
  }

  console.log(`History file: ${historyFile}`);
  console.log(`${scenarios.length} scenarios analyzed.`);
}

main().catch((error) => {
  console.error("Scenario runner failed.");
  console.error(error);
  process.exit(1);
});
