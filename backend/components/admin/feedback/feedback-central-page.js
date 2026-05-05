"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, LoaderCircle, MessageSquareDashed, Plus, RefreshCcw } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
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

function toOptions(values = [], mapLabel = (value) => value) {
  return values.map((value) => ({ value, label: mapLabel(value) }))
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
  const [createOpen, setCreateOpen] = useState(false)
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
  const isAdmin = currentUser?.role === "admin"

  const stats = useMemo(
    () => ({
      total: feedbacks.length,
      novos: feedbacks.filter((item) => item.status === "novo").length,
      pendentes: feedbacks.filter((item) => (isAdmin ? item.possuiMensagemNaoLidaAdmin : item.possuiMensagemNaoLidaUsuário)).length,
      fechados: feedbacks.filter((item) => item.status === "fechado").length,
    }),
    [feedbacks, isAdmin],
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
      setFeedback(data?.error ?? "Nao foi possivel carregar as solicitações.")
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
      setFeedback(data?.error ?? "Nao foi possivel abrir a solicitação.")
      setSaving(false)
      return
    }

    setCreateOpen(false)
    window.location.href = `/admin/feedback/${data.feedback.id}`
  }

  return (
    <div>
      <AdminPageHeader
        title="Solicitações"
        description={isAdmin ? "Central administrativa para abrir, acompanhar e responder solicitações e chamados internos." : "Acompanhe suas solicitações e chamados."}
        actions={
          <>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-8 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-medium text-sky-100 hover:bg-sky-500/15"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Criar solicitação
            </Button>
            <Button
              type="button"
              onClick={() => void loadFeedbacks()}
              disabled={loading}
              className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
            >
              {loading ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </>
        }
      />

      <div className="mb-6 hidden gap-4 md:grid-cols-4 lg:grid">
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

      <div className="grid gap-6">
        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          {isAdmin ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <AppSelect value={filters.status} onChangeValue={(value) => setFilters((current) => ({ ...current, status: value }))} options={[{ value: "todos", label: "Todos os status" }, ...toOptions(statuses, getStatusLabel)]} />

                <AppSelect value={filters.categoria} onChangeValue={(value) => setFilters((current) => ({ ...current, categoria: value }))} options={[{ value: "todas", label: "Todas as categorias" }, ...toOptions(categorias)]} />

                <AppSelect value={filters.ordenacao} onChangeValue={(value) => setFilters((current) => ({ ...current, ordenacao: value }))} options={toOptions(ordenacoes)} />

                <AppSelect value={filters.usuarioId} onChangeValue={(value) => setFilters((current) => ({ ...current, usuarioId: value }))} options={[{ value: "", label: "Todos os usuários" }, ...(users || []).map((user) => ({ value: user.id, label: user.nome }))]} />

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
            </>
          ) : null}

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
                <h2 className="mt-5 text-xl font-semibold text-white">Nenhuma solicitação encontrada</h2>
                <p className="mt-2 text-sm text-slate-400">Ajuste os filtros ou abra uma nova solicitação para iniciar o atendimento.</p>
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
                      {(isAdmin ? item.possuiMensagemNaoLidaAdmin : item.possuiMensagemNaoLidaUsuário) ? (
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
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Usuário</div>
                    <div className="mt-2 font-medium text-white">{item.usuario.nome || "Usuário"}</div>
                    <div className="truncate text-xs text-slate-500">{item.usuario.email || "Sem email"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Projeto</div>
                    <div className="mt-2 font-medium text-white">{item.projeto?.nome || "Não vinculado"}</div>
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-[92vw] max-w-[460px] border-l border-white/5">
          <form onSubmit={handleCreate} className="flex h-full flex-col">
            <div className="border-b border-white/5 px-5 py-5">
              <SheetTitle className="text-left text-lg font-semibold text-white">Nova solicitação</SheetTitle>
              <SheetDescription className="mt-1 text-left text-sm text-slate-400">
                Abre uma conversa nova diretamente no fluxo administrativo.
              </SheetDescription>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-300">Projeto</span>
                <AppSelect value={form.projetoId} onChangeValue={(value) => setForm((current) => ({ ...current, projetoId: value }))} options={[{ value: "", label: "Não vinculado" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-300">Categoria</span>
                <AppSelect value={form.categoria} onChangeValue={(value) => setForm((current) => ({ ...current, categoria: value }))} options={toOptions(categorias)} />
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
                rows={6}
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="border-t border-white/5 px-5 py-4">
              <Button
                type="submit"
                disabled={saving || !form.assunto.trim() || !form.mensagemInicial.trim()}
                className="h-10 w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
              >
                {saving ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                Criar solicitação
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
