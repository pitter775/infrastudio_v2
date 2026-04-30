import { normalizeAgentRuntimeConfig } from "@/lib/agent-runtime-config"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const PAGE_SIZE = 200

function normalizeRuntimeConfig(configuracoes) {
  const runtimeConfig =
    configuracoes && typeof configuracoes === "object" && !Array.isArray(configuracoes)
      ? configuracoes.runtimeConfig
      : null

  return runtimeConfig && typeof runtimeConfig === "object" && !Array.isArray(runtimeConfig)
    ? normalizeAgentRuntimeConfig(runtimeConfig)
    : null
}

async function loadAgentRows() {
  const supabase = getSupabaseAdminClient()
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("agentes")
      .select("id, nome, projeto_id, configuracoes")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    if (!Array.isArray(data) || data.length === 0) {
      break
    }

    rows.push(...data)

    if (data.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}

async function main() {
  const rows = await loadAgentRows()
  const agents = rows
    .map((row) => {
      const runtimeConfig = normalizeRuntimeConfig(row?.configuracoes)
      const pricingCatalog = runtimeConfig?.pricingCatalog
      const items = Array.isArray(pricingCatalog?.items) ? pricingCatalog.items : []

      return {
        id: row?.id ?? null,
        nome: typeof row?.nome === "string" ? row.nome.trim() : "",
        projetoId: row?.projeto_id ?? null,
        pricingEnabled: pricingCatalog?.enabled === true,
        items,
      }
    })
    .filter((agent) => agent.pricingEnabled || agent.items.length > 0)

  const catalogItems = agents.flatMap((agent) =>
    agent.items.map((item) => ({
      agentId: agent.id,
      agentName: agent.nome || "Agente sem nome",
      projectId: agent.projetoId,
      slug: typeof item?.slug === "string" ? item.slug : null,
      hasPrice: typeof item?.priceLabel === "string" && item.priceLabel.trim().length > 0,
      hasAttendanceLimit: typeof item?.attendanceLimit === "number",
      hasAgentLimit: typeof item?.agentLimit === "number",
      hasCreditLimit: typeof item?.creditLimit === "number",
      hasWhatsAppIncluded: typeof item?.whatsappIncluded === "boolean",
      hasSupportLevel: typeof item?.supportLevel === "string" && item.supportLevel.trim().length > 0,
    }))
  )

  const summary = {
    agentsWithPricingCatalog: agents.length,
    agentsWithItems: agents.filter((agent) => agent.items.length > 0).length,
    agentsWithOnlyPriceLabel: agents.filter(
      (agent) =>
        agent.items.length > 0 &&
        agent.items.every(
          (item) =>
            typeof item?.priceLabel === "string" &&
            item.priceLabel.trim() &&
            typeof item?.attendanceLimit !== "number" &&
            typeof item?.agentLimit !== "number" &&
            typeof item?.creditLimit !== "number" &&
            typeof item?.whatsappIncluded !== "boolean" &&
            !(typeof item?.supportLevel === "string" && item.supportLevel.trim())
        )
    ).length,
    totalPlans: catalogItems.length,
    plansWithAttendanceLimit: catalogItems.filter((item) => item.hasAttendanceLimit).length,
    plansWithAgentLimit: catalogItems.filter((item) => item.hasAgentLimit).length,
    plansWithCreditLimit: catalogItems.filter((item) => item.hasCreditLimit).length,
    plansWithWhatsAppIncluded: catalogItems.filter((item) => item.hasWhatsAppIncluded).length,
    plansWithSupportLevel: catalogItems.filter((item) => item.hasSupportLevel).length,
  }

  const weakAgents = agents
    .filter((agent) => agent.items.length > 0)
    .map((agent) => {
      const missingFields = {
        attendanceLimit: agent.items.filter((item) => typeof item?.attendanceLimit !== "number").length,
        agentLimit: agent.items.filter((item) => typeof item?.agentLimit !== "number").length,
        creditLimit: agent.items.filter((item) => typeof item?.creditLimit !== "number").length,
        whatsappIncluded: agent.items.filter((item) => typeof item?.whatsappIncluded !== "boolean").length,
        supportLevel: agent.items.filter((item) => !(typeof item?.supportLevel === "string" && item.supportLevel.trim())).length,
      }

      return {
        agentId: agent.id,
        agentName: agent.nome || "Agente sem nome",
        projectId: agent.projetoId,
        items: agent.items.length,
        missingFields,
      }
    })
    .sort((left, right) => {
      const leftTotal = Object.values(left.missingFields).reduce((sum, value) => sum + value, 0)
      const rightTotal = Object.values(right.missingFields).reduce((sum, value) => sum + value, 0)
      return rightTotal - leftTotal
    })
    .slice(0, 20)

  console.log(JSON.stringify({ summary, weakAgents }, null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error || "Falha desconhecida.")
  if (/Supabase server environment variables are not configured/i.test(message)) {
    console.error("[pricing-catalog-audit] configure NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar.")
    process.exit(1)
  }

  console.error("[pricing-catalog-audit] failed", error)
  process.exit(1)
})
