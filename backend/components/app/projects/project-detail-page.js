"use client"

import Link from "next/link"
import { ArrowLeft, FileText, MessageCircle, PlugZap } from "lucide-react"

import { AgentEditor } from "@/components/app/agents/agent-editor"
import { ConnectorList } from "@/components/app/apis/connector-list"
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <AgentEditor project={project} />

        <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-950">Resumo</h2>
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
          </dl>
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

      <ApiManager project={project} />
      <ConnectorList project={project} />
      <WidgetManager project={project} />
      <WhatsAppManager project={project} />
    </div>
  )
}
