"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BadgeDollarSign, CreditCard, LoaderCircle, Save, ShieldAlert } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

function percentageBadge(value) {
  if (value == null) {
    return "Sem limite"
  }

  return `${Number(value).toFixed(2)}%`
}

function emptyForm() {
  return {
    projectId: "",
    planId: "",
    planName: "",
    referenceModel: "gpt-4o-mini",
    autoBlock: true,
    blocked: false,
    blockedReason: "",
    notes: "",
    limits: {
      inputTokens: "",
      outputTokens: "",
      totalTokens: "",
      monthlyCost: "",
    },
  }
}

function numberOrNull(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function buildFormFromProject(project) {
  const config = project?.billing?.projectPlan

  return {
    projectId: project?.id ?? "",
    planId: config?.planId ?? "",
    planName: config?.planName ?? "",
    referenceModel: config?.referenceModel ?? "gpt-4o-mini",
    autoBlock: config?.autoBlock !== false,
    blocked: Boolean(config?.blocked),
    blockedReason: config?.blockedReason ?? "",
    notes: config?.notes ?? "",
    limits: {
      inputTokens: config?.limits?.inputTokens ?? "",
      outputTokens: config?.limits?.outputTokens ?? "",
      totalTokens: config?.limits?.totalTokens ?? "",
      monthlyCost: config?.limits?.monthlyCost ?? "",
    },
  }
}

function toOptions(items = [], labelKey = "name") {
  return items.map((item) => ({ value: item.id, label: item[labelKey] }))
}

export function AdminBillingPage({ initialPlans, initialProjects, currentUser }) {
  const searchParams = useSearchParams()
  const [plans, setPlans] = useState(initialPlans)
  const [projects, setProjects] = useState(initialProjects)
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0]?.id ?? "")
  const [form, setForm] = useState(initialProjects[0] ? buildFormFromProject(initialProjects[0]) : emptyForm())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [projectFilter, setProjectFilter] = useState("")
  const [userEmailFilter, setUserEmailFilter] = useState("")
  const isAllowed = currentUser?.role === "admin"

  const availableEmails = useMemo(
    () =>
      Array.from(
        new Set(
          projects.flatMap((project) =>
            (project.billing?.usageByUser ?? []).map((item) => item.email).filter(Boolean),
          ),
        ),
      )
        .sort()
        .map((email) => ({ value: email, label: email })),
    [projects],
  )

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (projectFilter && project.id !== projectFilter) {
          return false
        }

        if (userEmailFilter) {
          return (project.billing?.usageByUser ?? []).some((item) => item.email === userEmailFilter)
        }

        return true
      }),
    [projectFilter, projects, userEmailFilter],
  )

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? projects.find((project) => project.id === selectedProjectId) ?? null,
    [filteredProjects, projects, selectedProjectId],
  )

  const visibleUsageByUser = useMemo(() => {
    if (!selectedProject) {
      return []
    }

    return (selectedProject.billing?.usageByUser ?? []).filter((item) => {
      if (userEmailFilter && item.email !== userEmailFilter) {
        return false
      }

      return true
    })
  }, [selectedProject, userEmailFilter])

  useEffect(() => {
    if (selectedProject) {
      setForm(buildFormFromProject(selectedProject))
    }
  }, [selectedProject])

  useEffect(() => {
    if (!filteredProjects.length) {
      return
    }

    if (!filteredProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0].id)
    }
  }, [filteredProjects, selectedProjectId])

  useEffect(() => {
    const projectIdFromQuery = searchParams.get("projeto")
    const emailFromQuery = searchParams.get("email")

    if (projectIdFromQuery) {
      setProjectFilter(projectIdFromQuery)
      setSelectedProjectId(projectIdFromQuery)
    }

    if (emailFromQuery) {
      setUserEmailFilter(emailFromQuery)
    }
  }, [searchParams])

  const stats = useMemo(
    () => ({
      totalProjects: filteredProjects.length,
      blocked: filteredProjects.filter((project) => project.billing?.status?.blocked).length,
      warnings: filteredProjects.filter(
        (project) => project.billing?.status?.warning80 || project.billing?.status?.warning100,
      ).length,
    }),
    [filteredProjects],
  )

  async function refreshBilling() {
    setLoading(true)
    const response = await fetch("/api/admin/billing", { cache: "no-store" })
    const data = await response.json()

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel carregar o billing.")
      setLoading(false)
      return
    }

    setPlans(data.plans ?? [])
    setProjects(data.projects ?? [])
    setLoading(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    const response = await fetch("/api/admin/billing", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: form.projectId,
        planId: form.planId || null,
        planName: form.planName,
        referenceModel: form.referenceModel,
        autoBlock: form.autoBlock,
        blocked: form.blocked,
        blockedReason: form.blockedReason,
        notes: form.notes,
        limits: {
          inputTokens: numberOrNull(form.limits.inputTokens),
          outputTokens: numberOrNull(form.limits.outputTokens),
          totalTokens: numberOrNull(form.limits.totalTokens),
          monthlyCost: numberOrNull(form.limits.monthlyCost),
        },
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel salvar o billing.")
      setSaving(false)
      return
    }

    await refreshBilling()
    setFeedback("Billing do projeto atualizado.")
    setSaving(false)
  }

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
          <ShieldAlert className="h-3.5 w-3.5" />
          Permissao insuficiente
        </div>
        <h1 className="text-2xl font-semibold text-white">Billing restrito ao admin</h1>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Billing"
        description="Planos, limites, bloqueio automatico e consumo consolidado por projeto."
        actions={
          <Button
            type="button"
            onClick={refreshBilling}
            disabled={loading}
            className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
          >
            {loading ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BadgeDollarSign className="mr-1.5 h-3.5 w-3.5" />}
            Atualizar
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["Projetos", stats.totalProjects],
          ["Bloqueados", stats.blocked],
          ["Alertas", stats.warnings],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-[#0b1120] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0b1120]">
          <div className="border-b border-white/5 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">Projetos e consumo</h3>
            <p className="mt-1 text-xs text-slate-500">Ciclo atual, plano aplicado e estado de bloqueio.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-950/30 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Projeto</th>
                  <th className="px-5 py-4 font-semibold">Plano</th>
                  <th className="px-5 py-4 font-semibold">Tokens</th>
                  <th className="px-5 py-4 font-semibold">Custo</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const cycle = project.billing?.currentCycle
                  const config = project.billing?.projectPlan
                  const active = project.id === selectedProjectId

                  return (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        "cursor-pointer border-t border-white/5 text-sm text-slate-300 transition",
                        active ? "bg-white/[0.04]" : "hover:bg-white/[0.02]",
                      )}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{project.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{project.slug}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-white">{config?.planName || "Sem configuracao"}</div>
                        <div className="mt-1 text-xs text-slate-500">{project.mode}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div>{formatInteger(cycle?.usage?.totalTokens ?? 0)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {percentageBadge(cycle?.usagePercent?.totalTokens)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>{formatCurrency(cycle?.usage?.totalCost ?? 0)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {percentageBadge(cycle?.usagePercent?.monthlyCost)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            project.billing?.status?.blocked
                              ? "bg-rose-500/15 text-rose-200"
                              : project.billing?.status?.warning100 || project.billing?.status?.warning80
                                ? "bg-amber-500/15 text-amber-200"
                                : "bg-emerald-500/15 text-emerald-200",
                          )}
                        >
                          {project.billing?.status?.blocked
                            ? "bloqueado"
                            : project.billing?.status?.warning100 || project.billing?.status?.warning80
                              ? "alerta"
                              : "ok"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Configurar projeto</h2>
              <p className="mt-1 text-xs text-slate-500">Override manual de limites e comportamento de bloqueio.</p>
            </div>
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/10 p-3 text-blue-200">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="space-y-2 block">
              <span className="text-sm font-semibold text-slate-300">Projeto</span>
              <AppSelect value={form.projectId} onChangeValue={setSelectedProjectId} options={toOptions(projects)} />
            </label>

            <label className="space-y-2 block">
              <span className="text-sm font-semibold text-slate-300">Plano base</span>
              <AppSelect
                value={form.planId}
                onChangeValue={(nextValue) => {
                  const plan = plans.find((item) => item.id === nextValue) ?? null
                  setForm((current) => ({
                    ...current,
                    planId: nextValue,
                    planName: plan?.name ?? current.planName,
                    limits: {
                      inputTokens: plan?.limits?.inputTokens ?? current.limits.inputTokens,
                      outputTokens: plan?.limits?.outputTokens ?? current.limits.outputTokens,
                      totalTokens: plan?.limits?.totalTokens ?? current.limits.totalTokens,
                      monthlyCost: plan?.limits?.monthlyCost ?? current.limits.monthlyCost,
                    },
                  }))
                }}
                placeholder="Sem plano vinculado"
                options={[{ value: "", label: "Sem plano vinculado" }, ...toOptions(plans)]}
              />
            </label>

            <input
              value={form.planName}
              onChange={(event) => setForm((current) => ({ ...current, planName: event.target.value }))}
              placeholder="Nome do plano no projeto"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <input
              value={form.referenceModel}
              onChange={(event) => setForm((current) => ({ ...current, referenceModel: event.target.value }))}
              placeholder="Modelo de referencia"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.limits.inputTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, limits: { ...current.limits, inputTokens: event.target.value } }))
                }
                placeholder="Limite tokens input"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.limits.outputTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, limits: { ...current.limits, outputTokens: event.target.value } }))
                }
                placeholder="Limite tokens output"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.limits.totalTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, limits: { ...current.limits, totalTokens: event.target.value } }))
                }
                placeholder="Limite tokens total"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={form.limits.monthlyCost}
                onChange={(event) =>
                  setForm((current) => ({ ...current, limits: { ...current.limits, monthlyCost: event.target.value } }))
                }
                placeholder="Limite custo mensal"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <span>Auto bloquear ao atingir limite</span>
              <input
                type="checkbox"
                checked={form.autoBlock}
                onChange={(event) => setForm((current) => ({ ...current, autoBlock: event.target.checked }))}
                className="h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <span>Bloquear projeto agora</span>
              <input
                type="checkbox"
                checked={form.blocked}
                onChange={(event) => setForm((current) => ({ ...current, blocked: event.target.checked }))}
                className="h-4 w-4"
              />
            </label>

            <input
              value={form.blockedReason}
              onChange={(event) => setForm((current) => ({ ...current, blockedReason: event.target.value }))}
              placeholder="Motivo do bloqueio"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Observacoes internas"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <Button
              type="submit"
              disabled={saving || !form.projectId}
              className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
            >
              {saving ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Salvar billing
            </Button>

            {feedback ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {feedback}
              </div>
            ) : null}
          </div>
        </form>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="flex flex-col gap-4 border-b border-white/5 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Filtro de leitura</h3>
              <p className="mt-1 text-xs text-slate-500">Admin enxerga todos os dados, com filtro por projeto e email.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AppSelect
                value={projectFilter}
                onChangeValue={setProjectFilter}
                placeholder="Todos os projetos"
                options={[{ value: "", label: "Todos os projetos" }, ...toOptions(projects)]}
              />
              <AppSelect
                value={userEmailFilter}
                onChangeValue={setUserEmailFilter}
                placeholder="Todos os usuarios"
                options={[{ value: "", label: "Todos os usuarios" }, ...availableEmails]}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-950/30 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Tokens</th>
                  <th className="px-4 py-3 font-semibold">Custo</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsageByUser.length ? (
                  visibleUsageByUser.map((item) => (
                    <tr key={`${selectedProject?.id}-${item.email || item.usuarioId || item.name}`} className="border-t border-white/5 text-sm text-slate-300">
                      <td className="px-4 py-3 text-white">{item.email || "--"}</td>
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3">{formatInteger(item.totalTokens)}</td>
                      <td className="px-4 py-3">{formatCurrency(item.totalCost)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-white/5 text-sm text-slate-400">
                    <td colSpan={4} className="px-4 py-5">
                      Nenhum consumo por usuario para o filtro atual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <h3 className="text-lg font-semibold text-white">Projeto em foco</h3>
          <p className="mt-1 text-xs text-slate-500">Uso por usuario, creditos e canal emissor central dos alertas.</p>

          {selectedProject ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-sm font-semibold text-white">{selectedProject.name}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedProject.slug}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Usuarios no filtro</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{visibleUsageByUser.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Tokens somados</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatInteger(visibleUsageByUser.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Creditos avulsos disponiveis</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatInteger(selectedProject.billing?.topUps?.availableTokens ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Canal emissor dos alertas</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {selectedProject.billing?.whatsappAlerts?.senderChannelNumber || "Nao configurado"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">
              Nenhum projeto encontrado para o filtro atual.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/5 bg-[#0b1120] p-5">
        <h3 className="text-lg font-semibold text-white">Planos cadastrados</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-white">{plan.name}</div>
                <span className="text-xs text-slate-400">preco do plano: {formatCurrency(plan.monthlyPrice)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{plan.description || "Sem descricao."}</p>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div>tokens total: {plan.limits.totalTokens != null ? formatInteger(plan.limits.totalTokens) : "sem limite"}</div>
                <div>custo mensal interno: {plan.limits.monthlyCost != null ? formatCurrency(plan.limits.monthlyCost) : "sem limite"}</div>
                <div>agentes: {plan.capacities.agents ?? "-"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
