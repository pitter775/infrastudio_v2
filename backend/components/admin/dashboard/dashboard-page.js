"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AlertTriangle,
  BellRing,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FolderKanban,
  MessageSquareText,
  Sparkles,
} from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatDateTime(value) {
  if (!value) {
    return "--"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatInteger(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0))
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

function statusTone(value) {
  if (value === "bloqueado") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-200"
  }
  if (value === "alerta") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200"
  }
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
}

function MobileSection({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-xl border border-white/5 bg-[#0b1120] lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-white/5 px-4 py-4">{children}</div> : null}
    </section>
  )
}

export function AdminDashboardPage({ overview, currentUser }) {
  if (!currentUser || !overview) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-100">
        Sessão inválida.
      </div>
    )
  }

  const summary = overview.summary
  const isAdmin = overview.role === "admin"

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description={
          isAdmin
            ? "Leitura consolidada do admin baseada nos dados reais do v2, inspirada no dashboard do legado."
            : "Visao do seu uso e dos projetos ligados ao seu acesso."
        }
        actions={
          <Button asChild className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400">
            <Link href="/admin/projetos">
              <FolderKanban className="mr-1.5 h-3.5 w-3.5" />
              Abrir projetos
            </Link>
          </Button>
        }
      />

      <div className="mb-6 hidden rounded-2xl border border-white/5 bg-[#0b1120] p-4 sm:p-6 lg:block">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <ChartColumn className="h-3.5 w-3.5" />
              Painel consolidado
            </div>
            <h2 className="mt-4 text-xl font-semibold text-white sm:text-2xl">Resumo operacional</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{summary.practicalSummary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Perfil</div>
              <div className="mt-1 text-sm font-semibold text-white">{isAdmin ? "Admin" : "Usuário"}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Usuário</div>
              <div className="mt-1 text-sm font-semibold text-white">{overview.userName}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Último chat</div>
              <div className="mt-1 text-sm font-semibold text-white">{formatDateTime(summary.latestChat?.updatedAt)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 hidden gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:grid">
        {summary.cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/5 bg-[#0b1120] p-3 sm:p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-white sm:text-2xl">{formatInteger(card.value)}</div>
            <div className="mt-1 text-xs text-slate-400">{card.detail}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4 lg:hidden">
        <MobileSection title="Resumo operacional" subtitle="Toque para expandir.">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <ChartColumn className="h-3.5 w-3.5" />
                Painel consolidado
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{summary.practicalSummary}</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Perfil</div>
                <div className="mt-1 text-sm font-semibold text-white">{isAdmin ? "Admin" : "Usuário"}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Usuário</div>
                <div className="mt-1 text-sm font-semibold text-white">{overview.userName}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Último chat</div>
                <div className="mt-1 text-sm font-semibold text-white">{formatDateTime(summary.latestChat?.updatedAt)}</div>
              </div>
            </div>
          </div>
        </MobileSection>

        <MobileSection title="Indicadores" subtitle="Toque para expandir.">
          <div className="grid gap-3">
            {summary.cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
                <div className="mt-2 text-xl font-semibold text-white">{formatInteger(card.value)}</div>
                <div className="mt-1 text-xs text-slate-400">{card.detail}</div>
              </div>
            ))}
          </div>
        </MobileSection>

        <MobileSection title={isAdmin ? "Top projetos por consumo" : "Meus projetos"} subtitle="Toque para expandir.">
          <div className="space-y-3">
            {summary.topProjects.length ? (
              summary.topProjects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{project.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{project.planName}</div>
                    </div>
                    <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", statusTone(project.status))}>
                      {project.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Tokens</div>
                      <div className="mt-1 font-semibold text-white">{formatInteger(project.totalTokens)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Custo</div>
                      <div className="mt-1 font-semibold text-white">{formatCurrency(project.totalCost)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Uso</div>
                      <div className="mt-1 font-semibold text-white">{formatInteger(project.percentTokens)}%</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                Nenhum projeto com billing suficiente para consolidar.
              </div>
            )}
          </div>
        </MobileSection>

        <MobileSection title="Canais e chats" subtitle="Toque para expandir.">
          <div className="space-y-3">
            {summary.channelUsage.length ? (
              summary.channelUsage.map((channel) => (
                <div key={channel.key} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{channel.label}</div>
                    <div className="text-sm text-slate-300">{formatInteger(channel.totalChats)} chats</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{formatInteger(channel.totalTokens)} tokens recentes</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                Sem chats suficientes para leitura por canal.
              </div>
            )}
          </div>
        </MobileSection>

        {isAdmin ? (
          <MobileSection title="Eventos recentes" subtitle="Toque para expandir.">
            <div className="space-y-3">
              {summary.recentLogs.length ? (
                summary.recentLogs.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{item.description}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.origin} • {item.type}</div>
                      </div>
                      {item.level === "error" ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                      ) : item.type.includes("billing") ? (
                        <CreditCard className="h-4 w-4 shrink-0 text-amber-300" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                      )}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{formatDateTime(item.createdAt)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                  Sem eventos recentes no laboratório.
                </div>
              )}
            </div>
          </MobileSection>
        ) : null}
      </div>

      <div className="hidden gap-6 lg:grid xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">{isAdmin ? "Top projetos por consumo" : "Meus projetos por consumo"}</h3>
              <p className="mt-1 text-xs text-slate-500">Leitura do ciclo atual de billing.</p>
            </div>
            <Sparkles className="h-4 w-4 text-cyan-300" />
          </div>

          <div className="mt-4 space-y-3">
            {summary.topProjects.length ? (
              summary.topProjects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-white">{project.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{project.planName}</div>
                    </div>
                    <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", statusTone(project.status))}>
                      {project.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Tokens</div>
                      <div className="mt-1 font-semibold text-white">{formatInteger(project.totalTokens)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Custo</div>
                      <div className="mt-1 font-semibold text-white">{formatCurrency(project.totalCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Uso</div>
                      <div className="mt-1 font-semibold text-white">{formatInteger(project.percentTokens)}%</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                Nenhum projeto com billing suficiente para consolidar.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
            <div className="flex items-center gap-3">
              <MessageSquareText className="h-4 w-4 text-sky-300" />
              <h3 className="text-lg font-semibold text-white">Canais e chats</h3>
            </div>

            <div className="mt-4 space-y-3">
              {summary.channelUsage.length ? (
                summary.channelUsage.map((channel) => (
                  <div key={channel.key} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{channel.label}</div>
                      <div className="text-sm text-slate-300">{formatInteger(channel.totalChats)} chats</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{formatInteger(channel.totalTokens)} tokens recentes</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                  Sem chats suficientes para leitura por canal.
                </div>
              )}
            </div>
          </div>

          {isAdmin ? (
            <div className="rounded-xl border border-white/5 bg-[#0b1120] p-5">
              <div className="flex items-center gap-3">
                <BellRing className="h-4 w-4 text-amber-300" />
                <h3 className="text-lg font-semibold text-white">Eventos recentes</h3>
              </div>

              <div className="mt-4 space-y-3">
                {summary.recentLogs.length ? (
                  summary.recentLogs.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{item.description}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.origin} • {item.type}</div>
                        </div>
                        {item.level === "error" ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                        ) : item.type.includes("billing") ? (
                          <CreditCard className="h-4 w-4 shrink-0 text-amber-300" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{formatDateTime(item.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-5 text-sm text-slate-400">
                    Sem eventos recentes no laboratório.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
