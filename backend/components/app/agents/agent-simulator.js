"use client"

import { useState } from "react"
import { motion, useDragControls } from "framer-motion"
import { Info, LoaderCircle, SendHorizonal, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*(?!\*)([^*]+)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_(?!_)([^_]+)_(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
}

function renderMessageContent(value) {
  const normalizedValue = String(value || "").replace(/\r\n/g, "\n").trim()

  if (!normalizedValue) {
    return ""
  }

  return normalizedValue
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trimEnd())
      const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line))

      if (bulletLines.length === lines.length) {
        return `<ul>${bulletLines
          .map((line) => line.replace(/^[-*]\s+/, ""))
          .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
          .join("")}</ul>`
      }

      if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
        const headingLine = lines[0]
        const level = Math.min(3, headingLine.match(/^#+/)?.[0]?.length || 1)
        return `<h${level}>${formatInlineMarkdown(headingLine.replace(/^#{1,3}\s+/, ""))}</h${level}>`
      }

      return `<p>${lines.map((line) => formatInlineMarkdown(line)).join("<br />")}</p>`
    })
    .join("")
}

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
  }
}

function AgentTestMessage({ message }) {
  const [showTrace, setShowTrace] = useState(false)
  const isAgent = message.role === "assistant"

  return (
    <div className={cn("flex", isAgent ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[86%] rounded-lg border px-3 py-2 text-sm shadow-sm",
          isAgent ? "border-zinc-200 bg-white text-zinc-950" : "border-zinc-950 bg-zinc-950 text-white",
        )}
      >
        <div
          className="agent-simulator-message leading-6"
          dangerouslySetInnerHTML={{ __html: renderMessageContent(message.content) }}
        />
        {message.trace ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowTrace((value) => !value)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-950"
            >
              <Info className="h-3 w-3" />
              IA trace
            </button>
            {showTrace ? (
              <div className="mt-2 grid gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">
                <div>provider: <span className="font-medium text-zinc-950">{message.trace.provider}</span></div>
                <div>modelo: <span className="font-medium text-zinc-950">{message.trace.model}</span></div>
                <div>dominio: <span className="font-medium text-zinc-950">{message.trace.domainStage}</span></div>
                <div>heuristica: <span className="font-medium text-zinc-950">{message.trace.heuristicStage}</span></div>
                <div>tokens: <span className="font-medium text-zinc-950">{message.trace.tokens}</span></div>
                <div>APIs: <span className="font-medium text-zinc-950">{message.trace.runtimeApiCount}</span></div>
                <div>cache APIs: <span className="font-medium text-zinc-950">{message.trace.runtimeApiCacheHits}</span></div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AgentSimulator({ project, agent = project?.agent, open, onOpenChange }) {
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
        .slice(-12)
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
          trace: buildSimulatorTrace(data.diagnostics),
        },
      ])
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
      className="fixed bottom-5 right-5 z-[80] flex h-[620px] max-h-[calc(100vh-40px)] w-[420px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl"
    >
      <div
        className="flex cursor-grab items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 active:cursor-grabbing"
        onPointerDown={(event) => dragControls.start(event)}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-950">Teste do agente</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500">Runtime real efemero com APIs vinculadas.</p>
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

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-4">
        {messages.length ? (
          <div className="space-y-4">
            {messages.map((message) => (
              <AgentTestMessage key={message.id} message={message} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-5 text-sm text-zinc-500">
            Envie uma pergunta para testar prompt, runtimeConfig e APIs do agente.
          </div>
        )}
        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Digite uma mensagem de teste..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
          />
          <Button type="submit" disabled={!input.trim() || sending} size="icon" className="h-10 w-10 rounded-lg">
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}
