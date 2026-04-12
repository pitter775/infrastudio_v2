"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Globe,
  ImagePlus,
  Info,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  MessageSquareText,
  Paperclip,
  SendHorizonal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const attendanceNav = [
  { label: "Atendimento", icon: MessageSquareText, active: true },
  { label: "Dashboard", icon: LayoutGrid, active: false },
  { label: "Leads", icon: ListTodo, active: false },
  { label: "CRM Kanban", icon: KanbanSquare, active: false },
]

const conversationFilters = [
  { id: "all", icon: MessageSquareText, label: "Todos" },
  { id: "site", icon: Globe, label: "Site" },
  { id: "whatsapp", icon: MessageSquareText, label: "WhatsApp" },
]

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function getLastMessage(conversation) {
  return conversation.mensagens[conversation.mensagens.length - 1]
}

function getConversationPhone(conversation) {
  return conversation.cliente.telefone || "+55 11 97061-4357"
}

function Tag({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em]",
        className
      )}
    >
      {children}
    </span>
  )
}

function ConversationItem({ conversation, active, onClick }) {
  const lastMessage = getLastMessage(conversation)
  const initials = getInitials(conversation.cliente.nome)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[12px] border px-2.5 py-2 text-left transition-all duration-200",
        active
          ? "border-sky-500/30 bg-sky-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#182235] text-[9px] font-semibold uppercase text-slate-200">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold leading-4 text-slate-100">
              {conversation.cliente.nome}
            </div>
            <div className="truncate text-[10px] leading-4 text-slate-400">
              {getConversationPhone(conversation)}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-slate-500">{lastMessage?.horario}</div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-400">
            {conversation.mensagens.length} msg
          </div>
        </div>
      </div>

      <p className="mt-1.5 truncate text-[10px] leading-4 text-slate-400">
        {lastMessage?.texto || "Sem mensagens."}
      </p>
    </button>
  )
}

function MessageBubble({ message }) {
  const isAgent = message.autor === "atendente"
  const [showAiTrace, setShowAiTrace] = useState(false)
  const trace = message.observability

  return (
    <div className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-[18px] border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
          isAgent
            ? "border-amber-400/25 bg-[#2a241e] text-amber-50"
            : "border-sky-400/20 bg-[#0a1728] text-slate-100"
        )}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          {isAgent ? "Administrador" : "Cliente"}
        </div>
        <div className="mt-3 whitespace-pre-line text-sm leading-6">{message.texto}</div>
        {trace ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAiTrace((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              <Info className="h-3 w-3" />
              IA trace
            </button>

            {showAiTrace ? (
              <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-slate-300">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Provider</span>
                    <div className="font-medium text-white">{trace.provider || "n/a"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Modelo</span>
                    <div className="font-medium text-white">{trace.model || "n/a"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Dominio</span>
                    <div className="font-medium text-white">{trace.domainStage || "n/a"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Heuristica</span>
                    <div className="font-medium text-white">{trace.heuristicStage || "modelo"}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tokens</span>
                    <div className="font-medium text-white">
                      {(trace.usage?.inputTokens ?? 0) + (trace.usage?.outputTokens ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Custo</span>
                    <div className="font-medium text-white">
                      US$ {Number(trace.usage?.estimatedCostUsd ?? 0).toFixed(6)}
                    </div>
                  </div>
                </div>
                {trace.agenteNome || trace.assetsCount ? (
                  <div className="mt-2 border-t border-white/10 pt-2 text-slate-400">
                    {trace.agenteNome ? `Agente: ${trace.agenteNome}` : ""}
                    {trace.assetsCount ? `${trace.agenteNome ? " · " : ""}Assets: ${trace.assetsCount}` : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {message.attachments?.length ? (
          <div className="mt-3 space-y-1">
            {message.attachments.map((attachment) => (
              <div key={`${message.id}-${attachment.name}`} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300">
                {attachment.name}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 text-xs text-slate-400">{message.horario}</div>
      </div>
    </div>
  )
}

function Composer({ conversation, onMessageSent }) {
  const [texto, setTexto] = useState("")
  const [attachments, setAttachments] = useState([])
  const [isSending, setIsSending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    const nextText = texto.trim()

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
          body: JSON.stringify({
            texto: nextText,
            attachments,
          }),
        }
      )
      const messageData = await messageResponse.json()

      if (messageData.success) {
        onMessageSent(conversation.id, messageData.message)
        setTexto("")
        setAttachments([])
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="border-t border-white/5 px-4 py-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white">
          <Paperclip className="h-4 w-4" />
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={(event) =>
              setAttachments(
                Array.from(event.target.files || [])
                  .map((file) => ({ name: file.name, type: file.type, size: file.size }))
                  .slice(0, 5),
              )
            }
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <input
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Digite sua resposta manual..."
          className="h-8 w-full rounded-xl border border-white/10 bg-[#09111f] px-3 text-xs text-slate-100 outline-none placeholder:text-slate-500"
        />
        <Button
          type="submit"
          disabled={!texto.trim() || isSending}
          className="h-8 rounded-xl bg-[#11233a] px-4 text-xs text-slate-100 hover:bg-[#17304f]"
        >
          <SendHorizonal className="mr-1.5 h-3.5 w-3.5" />
          {isSending ? "Enviando" : "Enviar"}
        </Button>
      </form>
      {attachments.length ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
          {attachments.map((attachment) => (
            <span key={attachment.name} className="rounded-lg border border-white/10 px-2 py-1">
              {attachment.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ChatPanel({ conversation, onMessageSent, onStatusChanged, onCloseMobile }) {
  const initials = getInitials(conversation.cliente.nome)
  const lastMessage = getLastMessage(conversation)
  const originLabel = conversation.origem === "whatsapp" ? "WhatsApp" : "Site"
  const statusLabel = conversation.status === "humano" ? "Humano" : "IA atendendo"

  async function updateHandoff(nextStatus) {
    const response = await fetch(`/api/admin/conversations/${conversation.id}/handoff`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (response.ok) {
      onStatusChanged(conversation.id, nextStatus === "human" ? "humano" : "ia")
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={conversation.id}
        initial={{ opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 48 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="flex h-full min-h-0 flex-col"
      >
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#182235] text-[10px] font-semibold uppercase text-slate-200">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-slate-100">
                      {conversation.cliente.nome}
                    </h2>
                    <Tag className="border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                      {originLabel}
                    </Tag>
                    <Tag className="border-slate-500/20 bg-slate-500/10 text-slate-200">
                      {statusLabel}
                    </Tag>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-400">
                    {getConversationPhone(conversation)} - Ultima atividade em {lastMessage?.horario}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => updateHandoff("human")}
                className="h-8 rounded-lg bg-transparent px-3 text-[11px] text-emerald-300 shadow-none hover:bg-emerald-500/16 hover:text-white"
              >
                <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
                Assumir atendimento
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => updateHandoff("bot")}
                className="h-8 rounded-lg px-2.5 text-[11px] text-cyan-200 hover:bg-cyan-500/16 hover:text-white"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Liberar IA
              </Button>
              <Button
                variant="ghost"
                className="h-8 rounded-lg px-2.5 text-[11px] text-sky-300 hover:bg-sky-500/16 hover:text-white"
              >
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                Midias
              </Button>
              <Button
                variant="ghost"
                className="h-8 rounded-lg px-2.5 text-[11px] text-rose-200 hover:bg-rose-500/16 hover:text-white"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Limpar
              </Button>
              {onCloseMobile ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white lg:hidden"
                  onClick={onCloseMobile}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            {conversation.mensagens.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <MessageBubble message={message} />
              </motion.div>
            ))}
          </div>
        </div>

        <Composer
          conversation={conversation}
          onMessageSent={onMessageSent}
        />
      </motion.div>
    </AnimatePresence>
  )
}

export default function AttendancePage() {
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoadError(null)
        const response = await fetch("/api/admin/conversations")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Nao foi possivel carregar as conversas.")
        }

        setConversations(data.conversations ?? [])
        setSelectedConversation(data.conversations?.[0] ?? null)
      } catch (error) {
        setLoadError(error.message || "Nao foi possivel carregar as conversas.")
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/conversations")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Nao foi possivel atualizar as conversas.")
        }

        setLoadError(null)
        setConversations(data.conversations ?? [])
        setSelectedConversation((current) => {
          if (!current) {
            return data.conversations?.[0] ?? null
          }

          return data.conversations?.find((conversation) => conversation.id === current.id) ?? current
        })
      } catch (error) {
        setLoadError(error.message || "Nao foi possivel atualizar as conversas.")
      }
    }, 10000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function syncMobile() {
      setIsMobile(window.innerWidth < 1024)
    }

    syncMobile()
    window.addEventListener("resize", syncMobile)

    return () => window.removeEventListener("resize", syncMobile)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileChatOpen(false)
    }
  }, [isMobile])

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        activeFilter === "all" ? true : conversation.origem === activeFilter
      ),
    [activeFilter, conversations]
  )

  const activeConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversation?.id) ??
    filteredConversations[0] ??
    conversations[0] ??
    null

  const filterCounts = {
    all: conversations.length,
    site: conversations.filter((conversation) => conversation.origem === "site").length,
    whatsapp: conversations.filter((conversation) => conversation.origem === "whatsapp").length,
  }

  useEffect(() => {
    if (
      filteredConversations.length > 0 &&
      !filteredConversations.some((conversation) => conversation.id === selectedConversation?.id)
    ) {
      setSelectedConversation(filteredConversations[0])
    }
  }, [filteredConversations, selectedConversation?.id])

  function updateConversation(conversationId, message) {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              mensagens: [...conversation.mensagens, message],
            }
          : conversation
      )
    )

    setSelectedConversation((currentConversation) =>
      currentConversation?.id === conversationId
        ? {
            ...currentConversation,
            mensagens: [...currentConversation.mensagens, message],
          }
        : currentConversation
    )
  }

  function handleConversationSelect(conversation) {
    setSelectedConversation(conversation)

    if (isMobile) {
      setMobileChatOpen(true)
    }
  }

  function updateConversationStatus(conversationId, status) {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, status } : conversation
      )
    )

    setSelectedConversation((currentConversation) =>
      currentConversation?.id === conversationId ? { ...currentConversation, status } : currentConversation
    )
  }

  if (loading) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center">
        <p className="text-sm text-slate-500">Carregando conversas reais...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
        {loadError}
      </div>
    )
  }

  if (!activeConversation) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center">
        <p className="text-sm text-slate-500">Nenhuma conversa ativa encontrada.</p>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col">
        <AdminPageHeader
          title="Central de Atendimento"
          description="Fila ativa de conversas com inteligencia do pipeline real."
        />

        <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[104px,320px,minmax(0,1fr)]">
          <aside className="min-h-0 lg:block">
            <div className="flex h-full flex-col px-1 py-1">
              <div className="grid grid-cols-4 gap-2 lg:hidden">
                {attendanceNav.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={cn(
                        "flex h-11 w-full items-center justify-center rounded-[14px] transition-all duration-200",
                        item.active
                          ? "bg-sky-500/10 text-white"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          item.active ? "text-sky-300" : "text-slate-500"
                        )}
                      />
                    </button>
                  )
                })}
              </div>

              <div className="hidden space-y-2 lg:block">
                {attendanceNav.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-center gap-2 rounded-[16px] px-1.5 py-3 text-center text-[10px] font-medium transition-all duration-200 lg:px-2 lg:text-[11px]",
                        item.active
                          ? "bg-sky-500/10 text-white"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          item.active ? "text-sky-300" : "text-slate-500"
                        )}
                      />
                      <span className="hidden leading-4 lg:block">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          <section className="overflow-visible rounded-[12px] border border-white/5 bg-[#0d1424] lg:min-h-0 lg:overflow-hidden">
            <div className="border-b border-white/5 px-3 py-3">
              <div className="text-sm font-semibold text-slate-100">Conversas do projeto</div>
              <p className="mt-1 text-[11px] text-slate-500">Site e WhatsApp no mesmo feed.</p>
              <div className="mt-3 flex items-center gap-2">
                {conversationFilters.map((filter) => {
                  const Icon = filter.icon
                  const active = activeFilter === filter.id

                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveFilter(filter.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all duration-200",
                        active
                          ? "border-sky-400/15 bg-sky-400/10 text-sky-200"
                          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]"
                      )}
                      title={filter.label}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{filterCounts[filter.id]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="px-2 py-2 lg:h-[calc(100%-104px)] lg:overflow-y-auto">
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeConversation.id}
                    onClick={() => handleConversationSelect(conversation)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="hidden min-h-0 flex-col overflow-hidden rounded-[12px] border border-white/5 bg-[#0c1322] lg:flex">
            <ChatPanel
              conversation={activeConversation}
              onMessageSent={updateConversation}
              onStatusChanged={updateConversationStatus}
            />
          </section>

          <AnimatePresence initial={false}>
            {mobileChatOpen ? (
              <motion.section
                key="mobile-chat"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
                className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-white/5 bg-[#0c1322] lg:hidden"
              >
                <ChatPanel
                  conversation={activeConversation}
                  onMessageSent={updateConversation}
                  onStatusChanged={updateConversationStatus}
                  onCloseMobile={() => setMobileChatOpen(false)}
                />
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
