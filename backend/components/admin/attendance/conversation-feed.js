import { cn } from "@/lib/utils"

import ConversationComposer from "@/components/admin/attendance/conversation-composer"

export default function ConversationFeed({ conversation }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50">
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-base font-semibold text-zinc-950">
          {conversation.cliente.nome}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Conversa em atendimento</p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {conversation.mensagens.map((message) => {
          const isAgent = message.autor === "atendente"

          return (
            <div
              key={message.id}
              className={cn("flex", isAgent ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[72%] rounded-lg px-4 py-3 shadow-sm",
                  isAgent
                    ? "bg-zinc-950 text-white"
                    : "border bg-white text-zinc-950"
                  )}
                >
                <p className="text-sm leading-6">{message.texto}</p>
                <span
                  className={cn(
                    "mt-2 block text-right text-xs",
                    isAgent ? "text-zinc-300" : "text-zinc-500"
                  )}
                >
                  {message.horario}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <ConversationComposer />
    </div>
  )
}
