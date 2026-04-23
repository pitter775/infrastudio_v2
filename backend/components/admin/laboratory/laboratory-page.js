"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowUpDown, FlaskConical, LoaderCircle, RefreshCcw, Search, Trash2 } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

const POSSIBLE_LAB_ERRORS = [
  {
    title: "OPENAI_API_KEY ausente",
    source: "chat_orchestrator",
    detail: "O runtime do chat nao consegue chamar o provedor e o laboratorio passa a registrar falha interna logo no inicio.",
  },
  {
    title: "Projeto ou agente invalido no widget",
    source: "chat_service",
    detail: "O embed aponta para projeto/agente inexistente ou inativo e o chat publico nao encontra um contexto valido para responder.",
  },
  {
    title: "Sessao do chat nao localizada",
    source: "chat_service",
    detail: "A abertura da conversa falha e o laboratorio tende a mostrar erro de sessao nao iniciada ou nao encontrada.",
  },
  {
    title: "Prompt do agente sem configuracao valida",
    source: "chat_orchestrator",
    detail: "O agente existe, mas a configuracao principal esta vazia ou inconsistente e a resposta nao consegue ser montada.",
  },
  {
    title: "Falha para gravar mensagens no banco",
    source: "chat_service",
    detail: "O modelo responde, mas a persistencia falha por permissao ou schema e o laboratorio registra erro de gravacao.",
  },
  {
    title: "Erro de runtime em API externa",
    source: "api_runtime_error",
    detail: "Uma API conectada retorna timeout, credencial invalida ou payload inesperado e degrada a resposta final do chat.",
  },
  {
    title: "Webhook do Mercado Pago nao disparou",
    source: "mercado_pago_webhook",
    detail: "O checkout foi aberto e o pagamento pode ate ter sido aprovado, mas nenhuma notificacao chegou na aplicacao configurada.",
  },
  {
    title: "Webhook do Mercado Pago rejeitado",
    source: "mercado_pago_webhook",
    detail: "A notificacao chegou no backend, mas a assinatura foi considerada invalida e o evento nao foi processado.",
  },
  {
    title: "Pagamento nao casou com a intent pendente",
    source: "mercado_pago_webhook",
    detail: "O webhook foi recebido, mas o sistema nao encontrou uma recarga ou troca de plano pendente para vincular a confirmacao.",
  },
]

function formatDateTime(value) {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatFileSize(value) {
  const size = Number(value || 0)
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function levelClasses(level) {
  if (level === "error") {
    return "border-rose-400/20 bg-rose-500/10 text-rose-200"
  }

  if (level === "warn") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-200"
  }

  return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
}

function prettifyType(value) {
  return String(value || "system")
    .replace(/_/g, " ")
    .trim()
}

function buildQuery(filters) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value)
    }
  }

  params.set("limit", "100")
  return params.toString()
}

function getSortValue(entry, key) {
  switch (key) {
    case "createdAt":
      return new Date(entry.createdAt || 0).getTime()
    case "level":
      return entry.level || ""
    case "type":
      return entry.type || ""
    case "project":
      return entry.projectName || entry.projectSlug || entry.projectId || ""
    case "description":
      return entry.description || ""
    default:
      return ""
  }
}

function getLabObservability(entry) {
  const payload = entry?.payload && typeof entry.payload === "object" ? entry.payload : {}
  const trace = payload.observability && typeof payload.observability === "object" ? payload.observability : null
  const diagnostics = payload.diagnostics && typeof payload.diagnostics === "object" ? payload.diagnostics : {}

  return {
    provider: trace?.provider || diagnostics.provider || null,
    model: trace?.model || diagnostics.model || null,
    domainStage: trace?.domainStage || diagnostics.domainStage || null,
    heuristicStage: trace?.heuristicStage || diagnostics.heuristicStage || null,
    routeStage: trace?.routeStage || diagnostics.routeStage || null,
    inputTokens: trace?.usage?.inputTokens ?? diagnostics.inputTokens ?? null,
    outputTokens: trace?.usage?.outputTokens ?? diagnostics.outputTokens ?? null,
    cost: trace?.usage?.estimatedCostUsd ?? diagnostics.custo ?? null,
    matchedExpectedAgent: payload.matchedExpectedAgent,
    matchedExpectedProject: payload.matchedExpectedProject,
  }
}

function getScenarioEntries(logs) {
  return (Array.isArray(logs) ? logs : []).filter((entry) => entry.type === "lab_chat_scenario")
}

function getScenarioSummary(logs) {
  const entries = getScenarioEntries(logs)
  const grouped = new Map()

  for (const entry of entries) {
    const scenarioId = entry.payload?.scenarioId
    const caseId = entry.payload?.caseId
    if (!scenarioId || !caseId) {
      continue
    }

    const key = `${scenarioId}:${caseId}`
    if (!grouped.has(key)) {
      grouped.set(key, entry)
    }
  }

  return [...grouped.values()]
}

function formatDiff(diff) {
  if (!diff?.changed) {
    return "sem mudanca relevante"
  }

  const added = Array.isArray(diff.added) && diff.added.length ? `+ ${diff.added.slice(0, 4).join(", ")}` : ""
  const removed = Array.isArray(diff.removed) && diff.removed.length ? `- ${diff.removed.slice(0, 4).join(", ")}` : ""
  return [added, removed].filter(Boolean).join(" | ")
}

function AiTraceDetails({ entry }) {
  const trace = getLabObservability(entry)
  const hasTrace = trace.provider || trace.domainStage || trace.heuristicStage || trace.routeStage

  if (!hasTrace) {
    return null
  }

  return (
    <div className="mt-2 rounded-xl border border-sky-400/10 bg-sky-500/5 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
        IA trace
      </div>
      <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <div>provider: <span className="text-slate-200">{trace.provider || "n/a"}</span></div>
        <div>modelo: <span className="text-slate-200">{trace.model || "n/a"}</span></div>
        <div>dominio: <span className="text-slate-200">{trace.domainStage || "n/a"}</span></div>
        <div>heuristica: <span className="text-slate-200">{trace.heuristicStage || "modelo"}</span></div>
        <div>tokens: <span className="text-slate-200">{Number(trace.inputTokens ?? 0) + Number(trace.outputTokens ?? 0)}</span></div>
        <div>custo: <span className="text-slate-200">US$ {Number(trace.cost ?? 0).toFixed(6)}</span></div>
      </div>
    </div>
  )
}

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.18em] transition-colors",
        active ? "text-emerald-200" : "text-slate-500 hover:text-slate-300",
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  )
}

export function AdminLaboratoryPage({ initialLogs, projects, currentUser }) {
  const [logs, setLogs] = useState(initialLogs)
  const [payloadDumps, setPayloadDumps] = useState({ enabled: false, files: [] })
  const [filters, setFilters] = useState({
    projectId: "",
    type: "",
    origin: "",
    level: "",
    search: "",
  })
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [sort, setSort] = useState({ key: "createdAt", direction: "desc" })
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [dumpBusy, setDumpBusy] = useState(false)
  const [runningScenarioId, setRunningScenarioId] = useState("")
  const [scoringLogId, setScoringLogId] = useState("")
  const isAllowed = currentUser?.role === "admin"

  const availableTypes = useMemo(
    () => [...new Set((logs ?? []).map((entry) => entry.type).filter(Boolean))].sort(),
    [logs],
  )
  const availableOrigins = useMemo(
    () => [...new Set((logs ?? []).map((entry) => entry.origin).filter(Boolean))].sort(),
    [logs],
  )
  const stats = useMemo(
    () => ({
      total: logs.length,
      errors: logs.filter((entry) => entry.level === "error").length,
      warnings: logs.filter((entry) => entry.level === "warn").length,
    }),
    [logs],
  )
  const latestScenarioEntries = useMemo(() => getScenarioSummary(logs), [logs])
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const aValue = getSortValue(a, sort.key)
      const bValue = getSortValue(b, sort.key)
      const direction = sort.direction === "asc" ? 1 : -1

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction
      }

      return String(aValue).localeCompare(String(bValue), "pt-BR") * direction
    })
  }, [logs, sort])

  function handleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  async function refreshLogs(nextFilters = filters) {
    setLoading(true)
    setFeedback(null)

    const [logsResponse, dumpsResponse] = await Promise.all([
      fetch(`/api/admin/laboratorio?${buildQuery(nextFilters)}`, {
        cache: "no-store",
      }),
      fetch("/api/admin/laboratorio/payload-dumps", {
        cache: "no-store",
      }),
    ])
    const data = await logsResponse.json()
    const dumpsData = await dumpsResponse.json().catch(() => ({}))

    if (!logsResponse.ok) {
      setFeedback(data.error ?? "Nao foi possivel carregar os logs.")
      setLoading(false)
      return
    }

    setLogs(data.logs ?? [])
    if (dumpsResponse.ok) {
      setPayloadDumps({
        enabled: dumpsData.enabled === true,
        files: Array.isArray(dumpsData.files) ? dumpsData.files : [],
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshLogs()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function togglePayloadDump(enabled) {
    setDumpBusy(true)
    setFeedback(null)

    const response = await fetch("/api/admin/laboratorio/payload-dumps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel alterar o dump JSON.")
      setDumpBusy(false)
      return
    }

    setPayloadDumps((current) => ({
      ...current,
      enabled: data.enabled === true,
    }))
    setFeedback(data.enabled ? "Gravacao de dump JSON ativada." : "Gravacao de dump JSON desativada.")
    setDumpBusy(false)
  }

  async function clearPayloadDumps() {
    setDumpBusy(true)
    setFeedback(null)

    const response = await fetch("/api/admin/laboratorio/payload-dumps", {
      method: "DELETE",
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel limpar os dumps JSON.")
      setDumpBusy(false)
      return
    }

    setPayloadDumps((current) => ({
      ...current,
      files: [],
    }))
    setFeedback(`${data.deleted ?? 0} dump(s) removido(s).`)
    setDumpBusy(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await refreshLogs(filters)
  }

  async function runBaselineScenario() {
    setRunningScenarioId("infrastudio-home-baseline")
    setFeedback(null)

    const response = await fetch("/api/admin/laboratorio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: "infrastudio-home-baseline" }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel executar o baseline.")
      setRunningScenarioId("")
      return
    }

    await refreshLogs(filters)
    setFeedback(`${data.runs?.length ?? 0} caso(s) do baseline executado(s).`)
    setRunningScenarioId("")
  }

  async function setHumanScore(entry, humanScore) {
    setScoringLogId(entry.id)
    setFeedback(null)

    const response = await fetch("/api/admin/laboratorio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logId: entry.id,
        humanScore,
        humanNotes: entry.payload?.humanNotes || "",
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel salvar o score humano.")
      setScoringLogId("")
      return
    }

    setLogs((current) => current.map((item) => (item.id === entry.id ? data.log : item)))
    setScoringLogId("")
  }

  async function handleClearEvents() {
    setLoading(true)
    setFeedback(null)

    const response = await fetch("/api/admin/laboratorio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filters),
    })
    const data = await response.json()

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel limpar os eventos.")
      setLoading(false)
      return
    }

    await refreshLogs(filters)
    setFeedback(`${data.deleted ?? 0} eventos removidos.`)
    setClearConfirmOpen(false)
  }

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-slate-950/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          Permissao insuficiente
        </div>
        <h1 className="text-2xl font-semibold text-white">Laboratorio restrito ao admin</h1>
        <p className="mt-3 max-w-xl text-sm text-slate-300">
          Este painel concentra logs operacionais do chat, widget e WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Laboratorio"
        description="Leitura operacional do v2 para chat publico, config do widget e eventos do worker WhatsApp."
        actions={
          <Button
            type="button"
            onClick={() => refreshLogs()}
            disabled={loading}
            className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
          >
            {loading ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
            Atualizar
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          ["Eventos", stats.total],
          ["Errors", stats.errors],
          ["Warnings", stats.warnings],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-[#0b1120] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-white/5 bg-[#0b1120] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dump JSON do WhatsApp</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {payloadDumps.enabled ? "Gravacao ativada" : "Gravacao desativada"}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              Arquivos disponiveis: {payloadDumps.files.length}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={dumpBusy || payloadDumps.enabled}
              onClick={() => togglePayloadDump(true)}
              className="h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm text-emerald-100"
            >
              {dumpBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Ativar gravacao
            </Button>
            <Button
              type="button"
              disabled={dumpBusy || !payloadDumps.enabled}
              onClick={() => togglePayloadDump(false)}
              className="h-10 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 text-sm text-amber-100"
            >
              {dumpBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Desativar gravacao
            </Button>
            <Button
              type="button"
              disabled={dumpBusy || payloadDumps.files.length === 0}
              onClick={clearPayloadDumps}
              className="h-10 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm text-rose-100 hover:bg-rose-400/15"
            >
              {dumpBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Remover todos
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_120px_120px] gap-3 border-b border-white/5 bg-slate-950/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <div>Arquivo</div>
            <div>Tamanho</div>
            <div>Atualizado</div>
            <div>Acao</div>
          </div>
          {payloadDumps.files.length ? (
            payloadDumps.files.map((file) => (
              <div key={file.name} className="grid grid-cols-[minmax(0,1fr)_110px_120px_120px] gap-3 border-t border-white/5 px-4 py-3 text-sm text-slate-300 first:border-t-0">
                <div className="truncate">{file.name}</div>
                <div className="text-slate-400">{formatFileSize(file.size)}</div>
                <div className="text-slate-400">{formatDateTime(file.updatedAt)}</div>
                <div>
                  <a
                    href={`/api/admin/laboratorio/payload-dumps?download=${encodeURIComponent(file.name)}`}
                    className="inline-flex h-8 items-center rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-medium text-sky-100 hover:bg-sky-500/15"
                  >
                    Baixar
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-slate-500">Nenhum dump JSON gravado.</div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/5 bg-[#0b1120] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Baseline do laboratorio</div>
            <div className="mt-2 text-lg font-semibold text-white">InfraStudio Home Baseline</div>
            <div className="mt-1 text-sm text-slate-400">
              Executa os cenarios da home e compara cada resposta com a rodada anterior.
            </div>
          </div>
          <Button
            type="button"
            onClick={runBaselineScenario}
            disabled={loading || runningScenarioId === "infrastudio-home-baseline"}
            className="h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm text-emerald-100"
          >
            {runningScenarioId === "infrastudio-home-baseline" ? (
              <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-1.5 h-4 w-4" />
            )}
            Rodar baseline
          </Button>
        </div>

        {latestScenarioEntries.length ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {latestScenarioEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{entry.payload?.caseId || entry.description}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</div>
                  </div>
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", levelClasses(entry.level))}>
                    {entry.level}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-400">
                  <div>diff: {formatDiff(entry.payload?.diff)}</div>
                  <div>similaridade: {Number(entry.payload?.diff?.similarity ?? 0).toFixed(2)}</div>
                  {entry.payload?.baselineReply ? <div>baseline anterior: carregado</div> : <div>baseline anterior: primeira rodada</div>}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((score) => {
                    const active = Number(entry.payload?.humanScore ?? 0) === score

                    return (
                      <button
                        key={score}
                        type="button"
                        disabled={scoringLogId === entry.id}
                        onClick={() => setHumanScore(entry, score)}
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors",
                          active
                            ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                        )}
                      >
                        {score}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  score humano: {entry.payload?.humanScore ?? "pendente"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
            Ainda nao existem execucoes de baseline registradas.
          </div>
        )}
      </div>



      <form onSubmit={handleSubmit} className="mb-6 grid gap-4 rounded-xl border border-white/5 bg-[#0b1120] p-5 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Busca</span>
          <div className="flex items-center rounded-xl border border-white/10 bg-slate-950/50 px-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="codigo, chatId, widget, erro, projeto..."
              className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Projeto</span>
          <AppSelect value={filters.projectId} onChangeValue={(value) => setFilters((current) => ({ ...current, projectId: value }))} options={[{ value: "", label: "Todos" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Tipo</span>
          <AppSelect value={filters.type} onChangeValue={(value) => setFilters((current) => ({ ...current, type: value }))} options={[{ value: "", label: "Todos" }, ...availableTypes.map((type) => ({ value: type, label: prettifyType(type) }))]} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Origem</span>
          <AppSelect value={filters.origin} onChangeValue={(value) => setFilters((current) => ({ ...current, origin: value }))} options={[{ value: "", label: "Todas" }, ...availableOrigins.map((origin) => ({ value: origin, label: origin }))]} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Nivel</span>
          <AppSelect value={filters.level} onChangeValue={(value) => setFilters((current) => ({ ...current, level: value }))} options={[{ value: "", label: "Todos" }, { value: "error", label: "error" }, { value: "warn", label: "warn" }, { value: "info", label: "info" }]} />
        </label>

        <div className="lg:col-span-full flex gap-3">
          <Button type="submit" disabled={loading} className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15">
            {loading ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-1.5 h-4 w-4" />}
            Filtrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              const nextFilters = { projectId: "", type: "", origin: "", level: "", search: "" }
              setFilters(nextFilters)
              await refreshLogs(nextFilters)
            }}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
          >
            Limpar filtros
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setClearConfirmOpen(true)}
            disabled={loading || logs.length === 0}
            className="h-10 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm text-rose-100 hover:bg-rose-400/15"
          >
            {loading ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Limpar eventos
          </Button>
        </div>
      </form>

      {feedback ? (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
          {feedback}
        </div>
      ) : null}

      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Limpar eventos do laboratorio"
        description="Os eventos exibidos com os filtros atuais serao removidos do laboratorio."
        confirmLabel="Limpar eventos"
        danger
        loading={loading}
        onConfirm={handleClearEvents}
      />

      <div className="overflow-hidden rounded-xl border border-white/5 bg-[#0b1120]">
        <div className="border-b border-white/5 px-5 py-4">
          <h3 className="text-lg font-semibold text-white">Eventos recentes</h3>
          <p className="mt-1 text-xs text-slate-500">
            Mostra apenas eventos persistidos no banco pela instrumentacao atual do v2.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-950/30 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-4">
                  <SortHeader label="Quando" sortKey="createdAt" sort={sort} onSort={handleSort} />
                </th>
                <th className="px-5 py-4">
                  <SortHeader label="Nivel" sortKey="level" sort={sort} onSort={handleSort} />
                </th>
                <th className="px-5 py-4">
                  <SortHeader label="Tipo" sortKey="type" sort={sort} onSort={handleSort} />
                </th>
                <th className="px-5 py-4">
                  <SortHeader label="Projeto" sortKey="project" sort={sort} onSort={handleSort} />
                </th>
                <th className="px-5 py-4">
                  <SortHeader label="Descricao" sortKey="description" sort={sort} onSort={handleSort} />
                </th>
                <th className="px-5 py-4 font-semibold">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                sortedLogs.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/5 align-top text-sm text-slate-300">
                    <td className="px-5 py-4 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", levelClasses(entry.level))}>
                        {entry.level}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{prettifyType(entry.type)}</div>
                      <div className="mt-1 text-xs text-slate-500">{entry.origin}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{entry.projectName || "Sem projeto"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {entry.projectSlug || entry.projectId || "-"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[360px] text-sm text-slate-200">{entry.description}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[380px] space-y-1 text-xs text-slate-400">
                        {entry.payload?.event ? <div>event: {entry.payload.event}</div> : null}
                        {entry.payload?.appErrorCode ? <div>codigo: {entry.payload.appErrorCode}</div> : null}
                        {entry.payload?.errorCode ? <div>db: {entry.payload.errorCode}</div> : null}
                        {entry.payload?.status ? <div>status: {entry.payload.status}</div> : null}
                        {entry.payload?.tokens != null ? <div>tokens: {Number(entry.payload.tokens).toLocaleString("pt-BR")}</div> : null}
                        {entry.payload?.cost != null ? <div>valor: R$ {Number(entry.payload.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div> : null}
                        {entry.payload?.mercadoPagoResourceId ? <div>mp resource: {entry.payload.mercadoPagoResourceId}</div> : null}
                        {entry.payload?.intentId ? <div>intent: {entry.payload.intentId}</div> : null}
                        {entry.payload?.billingState?.blocked != null ? (
                          <div>billing desbloqueado: {entry.payload.billingState.blocked ? "nao" : "sim"}</div>
                        ) : null}
                        {entry.payload?.billingState?.availableCreditTokens != null ? (
                          <div>credito disponivel: {Number(entry.payload.billingState.availableCreditTokens).toLocaleString("pt-BR")}</div>
                        ) : null}
                        {entry.payload?.widgetSlug ? <div>widget: {entry.payload.widgetSlug}</div> : null}
                        {entry.payload?.agente ? <div>agente: {entry.payload.agente}</div> : null}
                        {entry.payload?.chatId ? <div>chatId: {entry.payload.chatId}</div> : null}
                        {entry.payload?.caseId ? <div>cenario: {entry.payload.caseId}</div> : null}
                        {entry.payload?.diff ? <div>diff: {formatDiff(entry.payload.diff)}</div> : null}
                        {entry.payload?.diff?.similarity != null ? <div>similaridade: {Number(entry.payload.diff.similarity).toFixed(2)}</div> : null}
                        {entry.payload?.humanScore != null ? <div>score humano: {entry.payload.humanScore}/5</div> : null}
                        {entry.payload?.matchedExpectedAgent != null ? (
                          <div>agente esperado: {entry.payload.matchedExpectedAgent ? "ok" : "falhou"}</div>
                        ) : null}
                        {entry.payload?.matchedExpectedProject != null ? (
                          <div>projeto esperado: {entry.payload.matchedExpectedProject ? "ok" : "falhou"}</div>
                        ) : null}
                        <AiTraceDetails entry={entry} />
                        {entry.payload?.errorSource ? <div>erro: {entry.payload.errorSource}</div> : null}
                        {entry.payload?.error ? <div>mensagem: {entry.payload.error}</div> : null}
                        {entry.payload?.elapsedMs != null ? <div>tempo: {entry.payload.elapsedMs} ms</div> : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-white/5 text-sm text-slate-300">
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Nenhum evento encontrado para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
