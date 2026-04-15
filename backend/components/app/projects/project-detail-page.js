"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Bot, FileText, MessageCircle, PlugZap, Sparkles } from "lucide-react"

import { AgentEditor } from "@/components/app/agents/agent-editor"
import { ConnectorList } from "@/components/app/apis/connector-list"
import { BillingSummaryCard } from "@/components/app/billing/billing-summary-card"
import { ApiManager } from "@/components/app/apis/api-manager"
import { WidgetManager } from "@/components/app/widgets/widget-manager"
import { WhatsAppManager } from "@/components/app/whatsapp/whatsapp-manager"
import { AppPageHeader } from "@/components/app/page-header"
import { Button } from "@/components/ui/button"

const integrationItems = [
  {
    key: "apis",
    label: "APIs",
    icon: PlugZap,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
  },
  {
    key: "chatWidget",
    label: "Widgets",
    icon: Bot,
  },
  {
    key: "files",
    label: "Arquivos",
    icon: FileText,
  },
]

export function AppProjectDetailPage({ project }) {
  const onboardingStorageKey = useMemo(
    () => `infrastudio:onboarding-project:${project.id || project.slug || project.routeKey}`,
    [project.id, project.routeKey, project.slug],
  )
  const [showOnboardingHint, setShowOnboardingHint] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const dismissed = window.localStorage.getItem(onboardingStorageKey) === "done"
    setShowOnboardingHint(!dismissed)
  }, [onboardingStorageKey])

  function handleAgentSummaryChange() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(onboardingStorageKey, "done")
    }
    setShowOnboardingHint(false)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <AppPageHeader
        eyebrow={project.type}
        title={project.name}
        description={project.description}
        action={
          <Button asChild variant="outline">
            <Link href="/app/projetos" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
              <Sparkles className="h-3.5 w-3.5" />
              Workspace operacional
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
              Edite o agente, revise integracoes, acompanhe billing e mantenha o projeto pronto para publicacao.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Agente", project.agent?.name || "Sem agente"],
              ["Plano", project.billing?.projectPlan?.planName || "Sem billing"],
              ["Ambiente", project.isDemo ? "Demo" : "Producao"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">{label}</div>
                <div className="mt-1 text-sm font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <AgentEditor project={project} onAgentSummaryChange={handleAgentSummaryChange} />
          <BillingSummaryCard billing={project.billing} />
        </div>

        <aside className="space-y-4">
          {showOnboardingHint ? (
            <div className="rounded-2xl border border-cyan-200/60 bg-white/75 p-5 shadow-[0_18px_40px_rgba(14,165,233,0.08)] backdrop-blur-sm">
              <div className="font-semibold text-sky-600">🚀 Seu projeto já está pronto</div>
              <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-600">
                <p>Clique no projeto que criamos para você.</p>
                <p>Ele já vem com tudo que precisa:</p>
                <ul className="space-y-2 text-zinc-700">
                  <li>agente de IA configurado, so adiciona suas informacos </li>
                  <li>chat funcionando no seu site</li>
                  <li>pronto para conectar WhatsApp e Mercado Livre</li>
                </ul>
                <p>Agora é só entrar no projeto e completar seus dados para começar a usar.</p>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Resumo do projeto</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Status</dt>
                <dd className="font-medium text-zinc-950">{project.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Slug</dt>
                <dd className="truncate font-medium text-zinc-950">{project.slug}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Ambiente</dt>
                <dd className="font-medium text-zinc-950">{project.isDemo ? "Demo" : "Producao"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-zinc-500">Billing</dt>
                <dd className="font-medium text-zinc-950">
                  {project.billing?.status?.blocked ? "Bloqueado" : project.billing?.projectPlan?.planName || "Pendente"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <div className="font-medium text-zinc-950">Atalhos desta tela</div>
              <a href="#apis" className="block text-zinc-600 hover:text-zinc-950">
                APIs e runtime
              </a>
              <a href="#widgets" className="block text-zinc-600 hover:text-zinc-950">
                Widgets
              </a>
              <a href="#whatsapp" className="block text-zinc-600 hover:text-zinc-950">
                WhatsApp
              </a>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {integrationItems.map((item) => {
          const Icon = item.icon
          const value = project.integrations?.[item.key] ?? 0

          return (
            <div key={item.key} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-2xl font-semibold text-zinc-950">{value}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-950">{item.label}</p>
            </div>
          )
        })}
      </section>

      <div id="apis">
        <ApiManager project={project} />
      </div>
      <ConnectorList project={project} />
      <div id="widgets">
        <WidgetManager project={project} />
      </div>
      <div id="whatsapp">
        <WhatsAppManager project={project} />
      </div>
    </div>
  )
}
