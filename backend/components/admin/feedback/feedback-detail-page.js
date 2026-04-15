"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, LoaderCircle, RefreshCcw, Send } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
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

export function AdminFeedbackDetailPage({ initialFeedback, currentUser, statuses }) {
  const [detail, setDetail] = useState(initialFeedback)
  const [mensagem, setMensagem] = useState("")
  const [statusDraft, setStatusDraft] = useState(initialFeedback.status)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const isAdmin = currentUser?.role === "admin"

  async function refreshDetail() {
    setLoading(true)
    setFeedback(null)

    const response = await fetch(`/api/admin/feedbacks/${detail.id}`, { cache: "no-store" })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback) {
      setFeedback(data?.error ?? "Nao foi possivel carregar o feedback.")
      setLoading(false)
      return
    }

    setDetail(data.feedback)
    setStatusDraft(data.feedback.status)
    setLoading(false)
  }

  async function handleStatusSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setFeedback(null)

    const response = await fetch(`/api/admin/feedbacks/${detail.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: statusDraft }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback) {
      setFeedback(data?.error ?? "Nao foi possivel atualizar o feedback.")
      setLoading(false)
      return
    }

    setDetail(data.feedback)
    setStatusDraft(data.feedback.status)
    setLoading(false)
  }

  async function handleMessageSubmit(event) {
    event.preventDefault()

    if (!mensagem.trim()) {
      return
    }

    setLoading(true)
    setFeedback(null)

    const response = await fetch(`/api/admin/feedbacks/${detail.id}/mensagens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mensagem,
        statusAdmin: statusDraft,
      }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback) {
      setFeedback(data?.error ?? "Nao foi possivel enviar a mensagem.")
      setLoading(false)
      return
    }

    setDetail(data.feedback)
    setStatusDraft(data.feedback.status)
    setMensagem("")
    setLoading(false)
  }

  async function handleReopen() {
    setLoading(true)
    setFeedback(null)

    const response = await fetch(`/api/admin/feedbacks/${detail.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ acao: "reabrir" }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback) {
      setFeedback(data?.error ?? "Nao foi possivel reabrir o feedback.")
      setLoading(false)
      return
    }

    setDetail(data.feedback)
    setStatusDraft(data.feedback.status)
    setLoading(false)
  }

  return (
    <div>
      <AdminPageHeader
        title={detail.assunto}
        description={`Feedback ${detail.id} • ${detail.projeto?.nome || "Nao vinculado"}`}
        actions={
          <>
            <Button
              asChild
              variant="ghost"
              className="h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 hover:bg-white/[0.08] hover:text-white"
            >
              <Link href="/admin/feedback">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Voltar
              </Link>
            </Button>
            <Button
              type="button"
              onClick={() => void refreshDetail()}
              disabled={loading}
              className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
            >
              {loading ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
              Atualizar
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <h2 className="text-lg font-semibold text-white">Resumo</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Usuario</dt>
              <dd className="mt-1 font-medium text-white">{detail.usuario.nome || "Usuario"}</dd>
              <dd className="text-xs text-slate-500">{detail.usuario.email || "Sem email"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Projeto</dt>
              <dd className="mt-1 font-medium text-white">{detail.projeto?.nome || "Nao vinculado"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Categoria</dt>
              <dd className="mt-1 font-medium text-white">{detail.categoria}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Criado em</dt>
              <dd className="mt-1 font-medium text-white">{formatDateTime(detail.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ultima atividade</dt>
              <dd className="mt-1 font-medium text-white">{formatDateTime(detail.ultimaMensagemAt)}</dd>
            </div>
          </dl>

          <form onSubmit={handleStatusSubmit} className="mt-6 space-y-4">
            {isAdmin ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Status</span>
                  <AppSelect
                    value={statusDraft}
                    onChangeValue={setStatusDraft}
                    options={statuses.map((status) => ({ value: status, label: getStatusLabel(status) }))}
                  />
                </label>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
                >
                  {loading ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Salvar status
                </Button>
              </>
            ) : null}

            {detail.status === "fechado" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleReopen()}
                disabled={loading}
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200"
              >
                Reabrir feedback
              </Button>
            ) : null}
          </form>
        </aside>

        <section className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          {feedback ? (
            <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {feedback}
            </div>
          ) : null}

          <div className="space-y-4">
            {detail.mensagens.map((item) => {
              const isAdmin = item.remetenteTipo === "admin"

              return (
                <div key={item.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl border px-4 py-3",
                      isAdmin
                        ? "border-sky-500/20 bg-sky-500/10 text-sky-50"
                        : "border-white/10 bg-slate-950/40 text-slate-100",
                    )}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {isAdmin ? "Admin" : "Usuario"}
                    </div>
                    <div className="mt-2 whitespace-pre-line text-sm leading-6">{item.mensagem}</div>
                    <div className="mt-3 text-xs text-slate-400">{formatDateTime(item.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <form onSubmit={handleMessageSubmit} className="mt-6 space-y-3 border-t border-white/5 pt-5">
            <textarea
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              placeholder={detail.status === "fechado" ? "Feedback fechado." : isAdmin ? "Escreva a resposta administrativa" : "Escreva sua mensagem"}
              rows={5}
              disabled={detail.status === "fechado" || loading}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-60"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={detail.status === "fechado" || loading || !mensagem.trim()}
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
              >
                {loading ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Enviar mensagem
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
