import { Bot, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function ConversationActions({ conversation }) {
  const lastMessage =
    conversation.mensagens[conversation.mensagens.length - 1]
  const statusLabel =
    conversation.status === "humano" ? "Em atendimento" : "IA ativa"
  const originLabel = conversation.origem === "whatsapp" ? "WhatsApp" : "Site"

  const details = [
    {
      label: "Ultima mensagem",
      value: lastMessage.horario,
    },
    {
      label: "Mensagens",
      value: conversation.mensagens.length,
    },
    {
      label: "Origem",
      value: originLabel,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b px-5 py-4">
        <h1 className="text-base font-semibold text-zinc-950">Controle</h1>
        <p className="mt-1 text-sm text-zinc-500">Acoes do atendimento</p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Cliente
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-950">
            {conversation.cliente.nome}
          </h2>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Status
          </p>

          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium",
                conversation.status === "humano"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              )}
            >
              {statusLabel}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium",
                "border-zinc-200 bg-zinc-50 text-zinc-700"
              )}
            >
              {originLabel}
            </span>
          </div>
        </section>

        <section className="space-y-3">
          <Button type="button" className="w-full gap-2">
            <UserCheck className="h-4 w-4" />
            Assumir atendimento
          </Button>

          <Button type="button" variant="outline" className="w-full gap-2">
            <Bot className="h-4 w-4" />
            Liberar para IA
          </Button>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Informacoes
          </p>

          <div className="divide-y rounded-lg border">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex items-center justify-between gap-3 px-3 py-3"
              >
                <span className="text-sm text-zinc-500">{detail.label}</span>
                <span className="text-sm font-medium text-zinc-950">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
