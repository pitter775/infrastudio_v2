"use client"

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatInteger(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0))
}

function renderUsage(used, limit, formatter) {
  if (limit == null) {
    return `${formatter(used)} / sem limite`
  }

  return `${formatter(used)} / ${formatter(limit)}`
}

export function BillingSummaryCard({ billing }) {
  const config = billing?.projectPlan
  const cycle = billing?.currentCycle

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Billing</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Plano, limites e consumo atual deste projeto.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            billing?.status?.blocked
              ? "bg-rose-100 text-rose-700"
              : billing?.status?.warning100 || billing?.status?.warning80
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {billing?.status?.blocked
            ? "Bloqueado"
            : billing?.status?.warning100 || billing?.status?.warning80
              ? "Em alerta"
              : "Normal"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Plano</div>
          <div className="mt-2 text-sm font-semibold text-zinc-950">{config?.planName || "Sem configuracao"}</div>
          <div className="mt-1 text-xs text-zinc-500">{billing?.mode || "plano"}</div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Tokens no ciclo</div>
          <div className="mt-2 text-sm font-semibold text-zinc-950">
            {renderUsage(cycle?.usage?.totalTokens ?? 0, cycle?.limits?.totalTokens ?? config?.limits?.totalTokens ?? null, formatInteger)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {cycle?.usagePercent?.totalTokens != null ? `${cycle.usagePercent.totalTokens}% usado` : "Sem limite definido"}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Custo no ciclo</div>
          <div className="mt-2 text-sm font-semibold text-zinc-950">
            {renderUsage(cycle?.usage?.totalCost ?? 0, cycle?.limits?.monthlyCost ?? config?.limits?.monthlyCost ?? null, formatCurrency)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {cycle?.usagePercent?.monthlyCost != null ? `${cycle.usagePercent.monthlyCost}% usado` : "Sem limite definido"}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">Tokens avulsos</div>
          <div className="mt-2 text-sm font-semibold text-zinc-950">{formatInteger(billing?.topUps?.totalTokens ?? 0)}</div>
          <div className="mt-1 text-xs text-zinc-500">{billing?.topUps?.availableCount ?? 0} lote(s) disponivel(is)</div>
        </div>
      </div>

      {config?.blockedReason ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {config.blockedReason}
        </div>
      ) : null}
    </section>
  )
}
