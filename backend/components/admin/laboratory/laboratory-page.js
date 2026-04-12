"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ArrowUpDown, FlaskConical, LoaderCircle, RefreshCcw, Search, Trash2 } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

    const response = await fetch(`/api/admin/laboratorio?${buildQuery(nextFilters)}`, {
      cache: "no-store",
    })
    const data = await response.json()

    if (!response.ok) {
      setFeedback(data.error ?? "Nao foi possivel carregar os logs.")
      setLoading(false)
      return
    }

    setLogs(data.logs ?? [])
    setLoading(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    await refreshLogs(filters)
  }

  async function handleClearEvents() {
    const confirmed = window.confirm("Limpar os eventos exibidos no laboratorio?")

    if (!confirmed) {
      return
    }

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
          <select
            value={filters.projectId}
            onChange={(event) => setFilters((current) => ({ ...current, projectId: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Todos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Tipo</span>
          <select
            value={filters.type}
            onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Todos</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {prettifyType(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Origem</span>
          <select
            value={filters.origin}
            onChange={(event) => setFilters((current) => ({ ...current, origin: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Todas</option>
            {availableOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {origin}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-300">Nivel</span>
          <select
            value={filters.level}
            onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">Todos</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
          </select>
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
            onClick={handleClearEvents}
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
                        {entry.payload?.widgetSlug ? <div>widget: {entry.payload.widgetSlug}</div> : null}
                        {entry.payload?.agente ? <div>agente: {entry.payload.agente}</div> : null}
                        {entry.payload?.chatId ? <div>chatId: {entry.payload.chatId}</div> : null}
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
