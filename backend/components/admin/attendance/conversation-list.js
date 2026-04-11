import { cn } from "@/lib/utils"

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b px-4 py-4">
        <h1 className="text-base font-semibold text-zinc-950">Conversas</h1>
        <p className="mt-1 text-sm text-zinc-500">Atendimentos recentes</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const isSelected = conversation.id === selectedConversation.id
          const lastMessage =
            conversation.mensagens[conversation.mensagens.length - 1]

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelectConversation(conversation)}
              className={cn(
                "block w-full border-b px-4 py-3 text-left transition-colors",
                isSelected ? "bg-zinc-100" : "bg-white hover:bg-zinc-50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 truncate text-sm font-medium text-zinc-950">
                  {conversation.cliente.nome}
                </h2>
                <span className="shrink-0 text-xs text-zinc-500">
                  {lastMessage.horario}
                </span>
              </div>

              <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-600">
                {lastMessage.texto}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
