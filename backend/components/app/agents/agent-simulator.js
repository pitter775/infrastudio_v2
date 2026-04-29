"use client"

import { useState } from "react"
import { motion, useDragControls } from "framer-motion"
import { LoaderCircle, SendHorizonal, Trash2, X } from "lucide-react"

import { ChatMessageRenderer } from "@/components/chat/message-renderer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function buildSimulatorTrace(diagnostics = {}) {
  if (!diagnostics || typeof diagnostics !== "object") {
    return null
  }

  if (!diagnostics.provider && !diagnostics.domainStage && !diagnostics.heuristicStage && !diagnostics.routeStage) {
    return null
  }

  return {
    provider: diagnostics.provider || "n/a",
    model: diagnostics.model || "n/a",
    domainStage: diagnostics.domainStage || "n/a",
    heuristicStage: diagnostics.heuristicStage || "modelo",
    routeStage: diagnostics.routeStage || "n/a",
    tokens: Number(diagnostics.inputTokens ?? 0) + Number(diagnostics.outputTokens ?? 0),
    runtimeApiCount: diagnostics.runtimeApiCount ?? 0,
    runtimeApiCacheHits: diagnostics.runtimeApiCacheHits ?? 0,
    runtimeApis: Array.isArray(diagnostics.runtimeApis) ? diagnostics.runtimeApis : [],
  }
}

function AgentTestMessage({ message }) {
  const isAgent = message.role === "assistant"

  return (
    <div className={cn("flex", isAgent ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[86%] rounded-lg border px-3 py-2 text-sm shadow-sm",
          isAgent
            ? "border-white/10 bg-[#0f172a] text-slate-100"
            : "border-sky-500/30 bg-sky-500/15 text-sky-50",
        )}
      >
        <ChatMessageRenderer text={message.content} ui={message.ui} assets={message.assets} trace={message.trace} compactTrace />
      </div>
    </div>
  )
}

export function AgentSimulator({ project, agent = project?.agent, open, onOpenChange, onUsageRecorded }) {
  const dragControls = useDragControls()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [context, setContext] = useState(null)
  const [sessionId] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  const projectIdentifier = project?.routeKey || project?.slug || project?.id || ""
  const agentIdentifier = agent?.slug || agent?.id || ""

  async function handleSubmit(event) {
    event.preventDefault()
    const message = input.trim()

    if (!message || sending || !agent?.id || !project?.id) {
      return
    }

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
      },
    ])
    setInput("")
    setSending(true)
    setError("")

    try {
      const simulatorHistory = messages
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: item.content,
        }))
        .filter((item) => item.content)
        .slice(-6)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          canal: "admin_agent_test",
          source: "agent_simulator",
          projeto: projectIdentifier,
          agente: agentIdentifier,
          identificadorExterno: `admin-widget-simulator:${project.id}:${agent.id}:${sessionId}`,
          context: {
            channel: {
              kind: "admin_agent_test",
            },
            admin: {
              projetoId: project.id,
              agenteId: agent.id,
              source: "agent_simulator",
              history: simulatorHistory,
              simulatorContext: context,
            },
            laboratory: {
              origin: "agent_admin_test",
              persistAsRealConversation: false,
            },
            ui: {
              structured_response: true,
            },
          },
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel testar o agente.")
      }

      setContext(data.simulatorContext || null)
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply || "Sem resposta.",
          ui: data.ui || null,
          trace: buildSimulatorTrace(data.diagnostics),
          assets: Array.isArray(data.assets) ? data.assets : [],
        },
      ])
      onUsageRecorded?.(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.08}
      initial={false}
      className="fixed bottom-5 right-5 z-[140] flex h-[620px] max-h-[calc(100vh-40px)] w-[420px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#080e1d] shadow-[0_8px_18px_rgba(2,6,23,0.82)]"
    >
      <div
        className="flex cursor-grab items-start justify-between gap-3 border-b border-white/10 bg-[#0c1426] px-4 py-3 active:cursor-grabbing"
        onPointerDown={(event) => dragControls.start(event)}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Teste do agente</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">Simule com o agente o que foi salvo.</p>
        </div>
        <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => {
              setMessages([])
              setError("")
              setContext(null)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onOpenChange?.(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#080e1d] px-4 py-4">
        {messages.length ? (
          <div className="space-y-4">
            {messages.map((message) => (
              <AgentTestMessage key={message.id} message={message} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
            Envie uma pergunta para testar prompt, runtimeConfig e APIs do agente.
          </div>
        )}
        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 bg-[#0c1426] px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Digite uma mensagem de teste..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0a1020] px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
          />
          <Button type="submit" disabled={!input.trim() || sending} size="icon" className="h-10 w-10 rounded-lg border border-sky-500/20 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25">
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}
