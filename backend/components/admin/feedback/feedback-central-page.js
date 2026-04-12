"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, LoaderCircle, MessageSquareDashed, Plus, RefreshCcw } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatDateTime(value) {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function getStatusLabel(status) {
  switch (status) {
    case "em_andamento":
      return "Em andamento"
    case "respondido":
      return "Respondido"
    case "fechado":
      return "Fechado"
    case "novo":
    default:
      return "Novo"
  }
}

function getStatusTone(status) {
  switch (status) {
    case "fechado":
      return "border-slate-500/20 bg-slate-500/10 text-slate-300"
    case "respondido":
      return "border-sky-500/20 bg-sky-500/10 text-sky-200"
    case "em_andamento":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200"
    case "novo":
    default:
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
  }
}

export function AdminFeedbackPage({
  initialFeedbacks,
  initialUsers,
  projects,
  currentUser,
  statuses,
  categorias,
  ordenacoes,
}) {
  const [feedbacks, setFeedbacks] = useState(initialFeedbacks)
  const [users, setUsers] = useState(initialUsers)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [filters, setFilters] = useState({
    status: "todos",
    categoria: "todas",
    ordenacao: "pendentes",
    usuarioId: "",
    busca: "",
  })
  const [form, setForm] = useState({
    projetoId: "",
    categoria: "sugestao",
    assunto: "",
    mensagemInicial: "",
  })
  const isAllowed = currentUser?.role === "admin"

  const stats = useMemo(
    () => ({
      total: feedbacks.length,
      novos: feedbacks.filter((item) => item.status === "novo").length,
      pendentes: feedbacks.filter((item) => item.possuiMensagemNaoLidaAdmin).length,
      fechados: feedbacks.filter((item) => item.status === "fechado").length,
    }),
    [feedbacks],
  )

  async function loadFeedbacks(nextFilters = filters) {
    setLoading(true)
    setFeedback(null)

    const params = new URLSearchParams()
    if (nextFilters.status && nextFilters.status !== "todos") {
      params.set("status", nextFilters.status)
    }
    if (nextFilters.categoria && nextFilters.categoria !== "todas") {
      params.set("categoria", nextFilters.categoria)
    }
    if (nextFilters.ordenacao) {
      params.set("ordenacao", nextFilters.ordenacao)
    }
    if (nextFilters.usuarioId) {
      params.set("usuarioId", nextFilters.usuarioId)
    }
    if (nextFilters.busca.trim()) {
      params.set("busca", nextFilters.busca.trim())
    }

    const response = await fetch(`/api/admin/feedbacks?${params.toString()}`, { cache: "no-store" })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      setFeedback(data?.error ?? "Nao foi possivel carregar os feedbacks.")
      setFeedbacks([])
      setLoading(false)
      return
    }

    setFeedbacks(data?.feedbacks ?? [])
    setUsers(data?.filtros?.usuarios ?? [])
    setLoading(false)
  }

  async function handleCreate(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    const response = await fetch("/api/admin/feedbacks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback?.id) {
      setFeedback(data?.error ?? "Nao foi possivel abrir o feedback.")
      setSaving(false)
      return
    }

    window.location.href = `/admin/feedback/${data.feedback.id}`
  }

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-100">
        Modulo Feedback restrito ao admin.
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Feedback"
        description="Central administrativa para abrir, acompanhar e responder feedbacks e chamados internos."
        actions={
          <Button
            type="button"
            onClick={() => void loadFeedbacks()}
            disabled={loading}
            className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
          >
            {loading ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
            Atualizar
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["Total", stats.total],
          ["Novos", stats.novos],
          ["Pendentes", stats.pendentes],
          ["Fechados", stats.fechados],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/5 bg-[#0b1120] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={handleCreate} className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Novo feedback</h2>
            <p className="mt-1 text-xs text-slate-500">Abre uma conversa nova diretamente no fluxo administrativo.</p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Projeto</span>
              <select
                value={form.projetoId}
                onChange={(event) => setForm((current) => ({ ...current, projetoId: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Nao vinculado</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Categoria</span>
              <select
                value={form.categoria}
                onChange={(event) => setForm((current) => ({ ...current, categoria: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
              >
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </label>

            <input
              value={form.assunto}
              onChange={(event) => setForm((current) => ({ ...current, assunto: event.target.value }))}
              placeholder="Assunto"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <textarea
              value={form.mensagemInicial}
              onChange={(event) => setForm((current) => ({ ...current, mensagemInicial: event.target.value }))}
              placeholder="Mensagem inicial"
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <Button
              type="submit"
              disabled={saving || !form.assunto.trim() || !form.mensagemInicial.trim()}
              className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
            >
              {saving ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Criar feedback
            </Button>
          </div>
        </form>

        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="todos">Todos os status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>

            <select
              value={filters.categoria}
              onChange={(event) => setFilters((current) => ({ ...current, categoria: event.target.value }))}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="todas">Todas as categorias</option>
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>

            <select
              value={filters.ordenacao}
              onChange={(event) => setFilters((current) => ({ ...current, ordenacao: event.target.value }))}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
            >
              {ordenacoes.map((ordenacao) => (
                <option key={ordenacao} value={ordenacao}>
                  {ordenacao}
                </option>
              ))}
            </select>

            <select
              value={filters.usuarioId}
              onChange={(event) => setFilters((current) => ({ ...current, usuarioId: event.target.value }))}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">Todos os usuarios</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nome}
                </option>
              ))}
            </select>

            <input
              value={filters.busca}
              onChange={(event) => setFilters((current) => ({ ...current, busca: event.target.value }))}
              placeholder="Buscar"
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadFeedbacks()}
              disabled={loading}
              className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200"
            >
              {loading ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1.5 h-4 w-4" />}
              Aplicar filtros
            </Button>
          </div>

          {feedback ? (
            <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {feedback}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {!loading && !feedbacks.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-5 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300">
                  <MessageSquareDashed className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">Nenhum feedback encontrado</h2>
                <p className="mt-2 text-sm text-slate-400">Ajuste os filtros ou abra um novo feedback para iniciar o atendimento.</p>
              </div>
            ) : null}

            {feedbacks.map((item) => (
              <Link
                key={item.id}
                href={`/admin/feedback/${item.id}`}
                className="block rounded-2xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-white/20 hover:bg-slate-950/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", getStatusTone(item.status))}>
                        {getStatusLabel(item.status)}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        {item.categoria}
                      </span>
                      {item.possuiMensagemNaoLidaAdmin ? (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                          pendente
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-white">{item.assunto}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{item.ultimaMensagem || "Sem mensagens."}</p>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                </div>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Usuario</div>
                    <div className="mt-2 font-medium text-white">{item.usuario.nome || "Usuario"}</div>
                    <div className="truncate text-xs text-slate-500">{item.usuario.email || "Sem email"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Projeto</div>
                    <div className="mt-2 font-medium text-white">{item.projeto?.nome || "Nao vinculado"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Ultima atividade</div>
                    <div className="mt-2 font-medium text-white">{formatDateTime(item.ultimaMensagemAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Mensagens</div>
                    <div className="mt-2 font-medium text-white">{item.totalMensagens}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
