"use client"

import { createContext, useContext, useState } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ConversationComposerContext = createContext(null)

export function ConversationComposerProvider({ children, value }) {
  return (
    <ConversationComposerContext.Provider value={value}>
      {children}
    </ConversationComposerContext.Provider>
  )
}

export default function ConversationComposer() {
  const composer = useContext(ConversationComposerContext)
  const [texto, setTexto] = useState("")
  const [isSending, setIsSending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    const nextText = texto.trim()

    const conversation = composer?.selectedConversation

    if (!nextText || !conversation) {
      return
    }

    setIsSending(true)

    try {
      const messageResponse = await fetch(
        `/api/admin/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ texto: nextText }),
        }
      )
      const messageData = await messageResponse.json()

      if (messageData.success) {
        composer.onMessageSent(conversation.id, messageData.message)
        setTexto("")

        const chatResponse = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            texto: nextText,
          }),
        })
        const chatData = await chatResponse.json()

        if (chatData.reply) {
          composer.onAssistantReply(conversation.id, chatData.reply)
        }
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="border-t bg-white px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          type="text"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Digite sua resposta manual..."
          className={cn(
            "h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-zinc-950",
            "placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        />

        <Button
          type="submit"
          disabled={!texto.trim() || isSending}
          className="shrink-0 gap-2"
        >
          <Send className="h-4 w-4" />
          Enviar
        </Button>
      </form>
    </div>
  )
}
