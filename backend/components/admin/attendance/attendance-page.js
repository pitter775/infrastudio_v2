"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Globe,
  Info,
  KanbanSquare,
  LayoutGrid,
  ListTodo,
  MessageSquareText,
  Paperclip,
  SendHorizonal,
  Sparkles,
  Trash2,
} from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const attendanceNav = [
  { label: "Atendimento", icon: MessageSquareText, active: true },
  { label: "Dashboard", icon: LayoutGrid, active: false, featureKey: "dashboard" },
  { label: "Leads", icon: ListTodo, active: false, featureKey: "leads" },
  { label: "CRM Kanban", icon: KanbanSquare, active: false, featureKey: "crm_kanban" },
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
  return conversation?.mensagens?.[conversation.mensagens.length - 1] ?? null
}

function getConversationPhone(conversation) {
  return conversation?.cliente?.telefone || ""
}

function getConversationSubtitle(conversation) {
  const value = String(getConversationPhone(conversation) || "").trim()
  if (!value) {
    return null
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) {
    return value
  }

  const digits = value.replace(/\D/g, "")
  if (digits.length >= 10 && digits.length <= 13) {
    return value
  }

  return null
}

function getAttachmentKey(attachment, index) {
  return attachment.storagePath || attachment.publicUrl || `${attachment.name || "arquivo"}-${index}`
}

function formatUsd(value) {
  return `US$ ${Number(value ?? 0).toFixed(6)}`
}

function buildAccessRequestMessage(label, projectName) {
  const lines = [
    `Solicito liberação de acesso ao módulo ${label}.`,
    "",
    "Entendo que essa habilitacao precisa ser solicitada diretamente para a InfraStudio.",
  ]

  if (projectName) {
    lines.push("", `Projeto de referencia: ${projectName}.`)
  }

  lines.push("", "Vou acompanhar a devolutiva na central de Feedback.")

  return lines.join("\n")
}

function parseMessageDate(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getMessageDayKey(message) {
  const date = parseMessageDate(message?.createdAt)
  if (!date) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatMessageDayLabel(message) {
  const date = parseMessageDate(message?.createdAt)
  if (!date) {
    return ""
  }

  const today = new Date()
  const todayKey = getMessageDayKey({ createdAt: today })
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = getMessageDayKey({ createdAt: yesterday })
  const messageDayKey = getMessageDayKey(message)

  if (messageDayKey === todayKey) {
    return "Hoje"
  }

  if (messageDayKey === yesterdayKey) {
    return "Ontem"
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function normalizeTraceOption(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function getConversationTraceEntries(conversation) {
  return (conversation?.mensagens ?? [])
    .filter((message) => message?.observability)
    .map((message) => {
      const trace = message.observability
      const totalTokens =
        Number(trace?.usage?.totalTokens ?? 0) ||
        Number(trace?.usage?.inputTokens ?? 0) + Number(trace?.usage?.outputTokens ?? 0)
      const estimatedCostUsd = Number(trace?.usage?.estimatedCostUsd ?? 0)

      return {
        id: message.id,
        horario: message.horario,
        createdAt: message.createdAt,
        texto: message.texto,
        provider: normalizeTraceOption(trace?.provider) ?? "n/a",
        stage: normalizeTraceOption(trace?.stage) ?? "n/a",
        domainStage: normalizeTraceOption(trace?.domainStage) ?? "n/a",
        heuristicStage: normalizeTraceOption(trace?.heuristicStage) ?? "modelo",
        handoffDecision: normalizeTraceOption(trace?.handoffDecision) ?? "n/a",
        failClosed: trace?.failClosed === true,
        runtimeApiCount: Number(trace?.runtimeApiCount ?? 0),
        runtimeApiCacheHits: Number(trace?.runtimeApiCacheHits ?? 0),
        runtimeApis: Array.isArray(trace?.runtimeApis) ? trace.runtimeApis : [],
        totalTokens,
        estimatedCostUsd,
      }
    })
}

function buildTraceSelectOptions(entries, key, fallbackLabel) {
  const values = Array.from(new Set(entries.map((entry) => entry[key]).filter(Boolean)))

  return [{ value: "", label: fallbackLabel }, ...values.map((value) => ({ value, label: value }))]
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function formatWhatsappText(value) {
  const escaped = escapeHtml(value)
  const formatted = escaped
    .replace(/```([\s\S]+?)```/g, '<pre class="overflow-x-auto rounded-xl bg-black/20 px-3 py-2 text-[12px] leading-5 text-slate-200">$1</pre>')
    .replace(/`([^`\n]+)`/g, '<code class="rounded bg-black/20 px-1.5 py-0.5 text-[12px] text-slate-100">$1</code>')
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, "<strong>$1</strong>")
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, "<strong>$1</strong>")
    .replace(/_(?=\S)(.+?)(?<=\S)_/g, "<em>$1</em>")
    .replace(/~(?=\S)(.+?)(?<=\S)~/g, "<s>$1</s>")
    .replace(/\n/g, "<br />")

  return formatted.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer" class="break-all underline underline-offset-2">$1</a>',
  )
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const [, base64 = ""] = result.split(",")
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo."))
    reader.readAsDataURL(file)
  })
}

const MAX_ATTACHMENT_FILES = 5
const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024

async function normalizeAttachmentFiles(fileList) {
  const files = Array.from(fileList || []).slice(0, MAX_ATTACHMENT_FILES)
  const acceptedFiles = files.filter((file) => Number(file.size || 0) <= MAX_ATTACHMENT_SIZE_BYTES)
  const rejectedFiles = files
    .filter((file) => Number(file.size || 0) > MAX_ATTACHMENT_SIZE_BYTES)
    .map((file) => file.name)

  const attachments = await Promise.all(
    acceptedFiles.map(async (file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataBase64: await fileToBase64(file),
    })),
  )

  return {
    attachments,
    rejectedFiles,
  }
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

function resolveConversationStatusLabel(conversation) {
  if (conversation?.status === "humano") {
    return "Humano no comando"
  }

  if (conversation?.status === "pausado_loop") {
    return "Pausado por loop"
  }

  if (conversation?.status === "pendente_humano") {
    return "Aguardando humano"
  }

  return "IA atendendo"
}

function ConversationItem({ conversation, active, onClick, isMobile = false }) {
  const lastMessage = getLastMessage(conversation)
  const initials = getInitials(conversation.cliente.nome)
  const loopPaused = conversation.status === "pausado_loop"
  const subtitle = getConversationSubtitle(conversation)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[12px] border px-2.5 py-2 text-left transition-all duration-200",
        isMobile && !active
          ? "border-transparent bg-transparent px-0 hover:border-transparent hover:bg-transparent"
          : active
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
            {subtitle ? <div className="truncate text-[10px] leading-4 text-slate-400">{subtitle}</div> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] text-slate-500">{lastMessage?.horario}</div>
          <div className="mt-1 flex flex-col items-end gap-1">
            {loopPaused ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-amber-200">
                Loop
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-1.5 truncate text-[10px] leading-4 text-slate-400">
        {lastMessage?.texto || "Sem mensagens."}
      </p>
    </button>
  )
}

function MessageBubble({ message, isAdmin = false }) {
  const isAgent = message.autor === "atendente"
  const originLabel = message.origem === "whatsapp" || message.canal === "whatsapp" ? "WhatsApp" : "Site"
  const OriginIcon = originLabel === "WhatsApp" ? MessageSquareText : Globe
  const [showAiTrace, setShowAiTrace] = useState(false)
  const trace = message.observability
  const canShowAiTrace = isAdmin && trace
  const bubbleClassName = isAgent
    ? "rounded-[9px] rounded-br-[4px] bg-sky-800/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_2px_4px_rgba(0,0,0,0.28)]"
    : "rounded-[14px] rounded-bl-[4px] bg-[rgba(30,41,59,0.92)] text-[rgba(226,232,240,0.86)] shadow-[inset_0_1px_0_rgba(255,255,255,0.01),0_2px_4px_rgba(0,0,0,0.08)]"
  const labelClassName = isAgent ? "text-sky-100/70" : "text-slate-500"
  const contentClassName = isAgent
    ? "text-white [&_a]:text-white/90 [&_code]:font-mono [&_em]:italic [&_pre]:whitespace-pre-wrap [&_strong]:font-semibold [&_strong]:text-white [&_s]:line-through"
    : "text-[rgba(226,232,240,0.86)] [&_a]:text-sky-300 [&_code]:font-mono [&_em]:italic [&_pre]:whitespace-pre-wrap [&_strong]:font-semibold [&_strong]:text-white [&_s]:line-through"
  const timeClassName = isAgent ? "text-sky-100/60" : "text-slate-500"
  const productAssets = (message.assets || [])
    .filter((asset) => asset?.kind === "product" || asset?.provider === "mercado_livre" || asset?.provider === "api_runtime")
    .slice(0, 6)
  const hasMultipleProductAssets = productAssets.length > 1

  return (
    <div className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] border-0 px-3 py-2.5 text-sm",
          bubbleClassName,
        )}
      >
        <div className={cn("text-[9px] font-semibold uppercase tracking-[0.22em]", labelClassName)}>
          {isAgent ? "Administrador" : "Cliente"}
        </div>
        <div
          className={cn("mt-2 leading-6", contentClassName)}
          dangerouslySetInnerHTML={{ __html: formatWhatsappText(message.texto) }}
        />
        {canShowAiTrace ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowAiTrace((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:border-sky-400/20 hover:bg-sky-500/10 hover:text-white"
            >
              <Info className="h-3 w-3" />
              IA trace
            </button>

            {showAiTrace ? (
              <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-slate-300">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Stage</span>
                    <div className="font-medium text-white">{trace.stage || "n/a"}</div>
                  </div>
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
                    <span className="text-slate-500">Handoff</span>
                    <div className="font-medium text-white">{trace.handoffDecision || "n/a"}</div>
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
                  <div>
                    <span className="text-slate-500">APIs runtime</span>
                    <div className="font-medium text-white">
                      {trace.runtimeApiCount ?? 0} / cache {trace.runtimeApiCacheHits ?? 0}
                    </div>
                  </div>
                </div>
                {trace.agenteNome || trace.assetsCount ? (
                  <div className="mt-2 border-t border-white/10 pt-2 text-slate-400">
                    {trace.agenteNome ? `Agente: ${trace.agenteNome}` : ""}
                    {trace.assetsCount ? `${trace.agenteNome ? " · " : ""}Assets: ${trace.assetsCount}` : ""}
                  </div>
                ) : null}
                {trace.widgetSlug || trace.failClosed || trace.handoffReason || trace.runtimeApis?.length ? (
                  <div className="mt-2 border-t border-white/10 pt-2 text-slate-400">
                    {trace.widgetSlug ? `Widget: ${trace.widgetSlug}` : ""}
                    {trace.failClosed ? `${trace.widgetSlug ? " | " : ""}Fail-closed: sim` : ""}
                    {trace.handoffReason ? `${trace.widgetSlug || trace.failClosed ? " | " : ""}Motivo handoff: ${trace.handoffReason}` : ""}
                    {trace.runtimeApis?.length ? `${trace.widgetSlug || trace.failClosed || trace.handoffReason ? " | " : ""}APIs: ${trace.runtimeApis.map((api) => `${api.nome || "API"}${api.cacheHit ? " (cache)" : ""}`).join(", ")}` : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {message.attachments?.length ? (
          <div className="mt-3 grid gap-2">
            {message.attachments.map((attachment, index) => {
              const previewable = attachment.category === "image" && attachment.publicUrl

              return (
                <a
                  key={`${message.id}-${getAttachmentKey(attachment, index)}`}
                  href={attachment.publicUrl || "#"}
                  target={attachment.publicUrl ? "_blank" : undefined}
                  rel={attachment.publicUrl ? "noreferrer" : undefined}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
                >
                  {previewable ? (
                    <img
                      src={attachment.publicUrl}
                      alt={attachment.name || "Anexo"}
                      className="max-h-56 w-full object-cover"
                    />
                  ) : null}
                  <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{attachment.name}</span>
                  </div>
                </a>
              )
            })}
          </div>
        ) : null}
        {productAssets.length ? (
          <div
            className={cn(
              "mt-3",
              hasMultipleProductAssets
                ? "-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "w-[270px] max-w-full",
            )}
          >
            {productAssets.map((asset, index) => {
              return (
                <a
                  key={`${message.id}-asset-${asset.id || index}`}
                  href={asset.targetUrl || asset.publicUrl || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={cn(
                    "block shrink-0 overflow-hidden rounded-xl border border-sky-400/20 bg-sky-500/10 transition hover:border-sky-300/30 hover:bg-sky-500/15",
                    hasMultipleProductAssets ? "w-[240px] sm:w-[260px]" : "w-full",
                  )}
                >
                  {asset.publicUrl ? (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950/45">
                      <img
                        src={asset.publicUrl}
                        alt={asset.nome || "Produto"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2 p-3">
                    <div
                      className="overflow-hidden text-sm font-semibold leading-5 text-white"
                      style={{
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                      }}
                    >
                      {asset.nome || "Produto"}
                    </div>
                    {asset.descricao ? (
                      <div
                        className="overflow-hidden text-xs leading-5 text-slate-300"
                        style={{
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {asset.descricao}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                        {asset.priceLabel || "Ver produto"}
                      </div>
                      <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                        {asset.provider === "mercado_livre" ? "Mercado Livre" : "Catálogo"}
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        ) : null}
        <div className={cn("mt-3 flex items-center gap-2 text-[10px]", timeClassName)}>
          <span>{message.horario}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5">
            <OriginIcon className="h-2.5 w-2.5" />
            {originLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

function MessageDayDivider({ label }) {
  if (!label) {
    return null
  }

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-white/10" />
      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function Composer({ conversation, onMessageSent, onStatusChanged }) {
  const [texto, setTexto] = useState("")
  const [attachments, setAttachments] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [attachmentFeedback, setAttachmentFeedback] = useState("")
  const inputRef = useRef(null)
  const touchTimerRef = useRef(null)
  const claimInFlightRef = useRef(false)

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 136)}px`
  }, [texto])

  useEffect(
    () => () => {
      if (touchTimerRef.current) {
        window.clearTimeout(touchTimerRef.current)
      }
    },
    []
  )

  async function signalHumanActivity(mode = "touch") {
    if (!conversation?.id) {
      return
    }

    if (mode === "claim" && claimInFlightRef.current) {
      return
    }

    if (mode === "claim") {
      claimInFlightRef.current = true
    }

    try {
      const response = await fetch(`/api/admin/conversations/${conversation.id}/handoff`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mode === "claim" ? { status: "human" } : { action: "touch" }),
      })

      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        if (mode === "claim") {
          onStatusChanged?.(conversation.id, "humano", data.handoff ?? null)
        }
      }
    } finally {
      if (mode === "claim") {
        claimInFlightRef.current = false
      }
    }
  }

  function wrapSelection(before, after = before) {
    const textarea = inputRef.current

    if (!textarea) {
      return
    }

    const start = textarea.selectionStart ?? texto.length
    const end = textarea.selectionEnd ?? texto.length
    const selectedText = texto.slice(start, end)
    const nextValue = `${texto.slice(0, start)}${before}${selectedText}${after}${texto.slice(end)}`

    setTexto(nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const caretStart = start + before.length
      const caretEnd = caretStart + selectedText.length
      textarea.setSelectionRange(caretStart, caretEnd)
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextText = texto.trim()

    if ((!nextText && attachments.length === 0) || !conversation) {
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
          body: JSON.stringify({ texto: nextText, attachments }),
        }
      )
      const messageData = await messageResponse.json()

      if (messageData.success) {
        onMessageSent(conversation.id, messageData.message)
        if (messageData.deliveryFailureMessage) {
          onMessageSent(conversation.id, messageData.deliveryFailureMessage)
        }
        onStatusChanged?.(conversation.id, messageData.status || "humano", messageData.handoff ?? null)
        setTexto("")
        setAttachments([])
        setAttachmentFeedback("")
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="sticky bottom-0 z-10 bg-[#0c1322] px-3 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] lg:px-4 lg:py-3 lg:pb-3">
      <form
        onSubmit={handleSubmit}
        className="rounded-[16px] border border-black/40 bg-[#07101d]/80 px-3 py-2 outline outline-2 outline-transparent transition-colors hover:border-white/20 hover:outline-black/20 focus-within:border-sky-400/30 focus-within:outline-black/20"
      >
        <textarea
          ref={inputRef}
          value={texto}
          onChange={(event) => {
            const nextValue = event.target.value
            setTexto(nextValue)

            if (!nextValue.trim()) {
              return
            }

            if (conversation?.status !== "humano") {
              void signalHumanActivity("claim")
            }

            if (touchTimerRef.current) {
              window.clearTimeout(touchTimerRef.current)
            }

            touchTimerRef.current = window.setTimeout(() => {
              void signalHumanActivity("touch")
            }, 400)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              handleSubmit(event)
            }
          }}
          placeholder="Digite sua resposta manual..."
          rows={1}
          className="block w-full resize-none border-0 bg-transparent px-0.5 py-1 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
          style={{ minHeight: 44, maxHeight: 136, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
        />
        {attachmentFeedback ? (
          <div className="mb-2 text-[11px] text-amber-200">{attachmentFeedback}</div>
        ) : null}
        {attachments.length ? (
          <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
            {attachments.map((attachment, index) => (
              <span key={`${attachment.name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  className="rounded-full px-1 text-slate-500 hover:bg-white/10 hover:text-white"
                  onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label="Remover anexo"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-slate-400">
            {[
              { label: "B", action: () => wrapSelection("**", "**") },
              { label: "I", action: () => wrapSelection("_") },
              { label: "S", action: () => wrapSelection("~") },
              { label: "{ }", action: () => wrapSelection("`") },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                {item.label}
              </button>
            ))}
            <label className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-sky-300 transition-colors hover:bg-white/[0.08] hover:text-white">
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={async (event) => {
                  const { attachments: nextAttachments, rejectedFiles } = await normalizeAttachmentFiles(event.target.files)
                  setAttachments(nextAttachments)
                  setAttachmentFeedback(
                    rejectedFiles.length
                      ? `Alguns anexos foram ignorados por excederem 2 MB: ${rejectedFiles.slice(0, 2).join(", ")}${rejectedFiles.length > 2 ? "..." : ""}`
                      : "",
                  )
                  event.target.value = ""
                }}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-sky-300 hover:bg-white/[0.08] hover:text-white"
              onClick={() => wrapSelection("```", "```")}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="submit"
            disabled={(!texto.trim() && attachments.length === 0) || isSending}
            className={cn(
              "h-10 w-10 rounded-xl bg-transparent p-0 text-sky-200 shadow-none hover:bg-sky-500/12 hover:text-white",
              (texto.trim() || attachments.length > 0) && "bg-sky-500 text-white hover:bg-sky-400"
            )}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

function ChatPanel({
  conversation,
  onMessageSent,
  onStatusChanged,
  onConversationDeleted,
  onLoadOlderMessages,
  loadingOlder = false,
  onCloseMobile,
  isAdmin = false,
}) {
  const initials = getInitials(conversation.cliente.nome)
  const lastMessage = getLastMessage(conversation)
  const originLabel = conversation.origem === "whatsapp" ? "WhatsApp" : "Site"
  const humanInControl = conversation.status === "humano"
  const loopPaused = conversation.status === "pausado_loop"
  const autoPause = conversation.handoff?.metadata?.autoPause
  const autoPauseReason = typeof autoPause?.reason === "string" ? autoPause.reason.trim() : ""
  const autoPauseDetails =
    typeof autoPause?.details === "string"
      ? autoPause.details.trim()
      : typeof autoPause?.details?.message === "string"
        ? autoPause.details.message.trim()
        : typeof autoPause?.details?.error === "string"
          ? autoPause.details.error.trim()
          : ""
  const statusLabel = resolveConversationStatusLabel(conversation)
  const compactMobileHeader = Boolean(onCloseMobile)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [traceProviderFilter, setTraceProviderFilter] = useState("")
  const [traceStageFilter, setTraceStageFilter] = useState("")
  const [traceCostFilter, setTraceCostFilter] = useState("")
  const [traceErrorFilter, setTraceErrorFilter] = useState("")
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearConfirmation, setClearConfirmation] = useState("")
  const [clearError, setClearError] = useState("")
  const [clearing, setClearing] = useState(false)
  const feedRef = useRef(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const detailsHistoryActiveRef = useRef(false)
  const detailsPopClosingRef = useRef(false)
  const mediaItems = conversation.mensagens.flatMap((message) =>
    (message.attachments ?? []).map((attachment, index) => ({
      ...attachment,
      messageId: message.id,
      horario: message.horario,
      key: `${message.id}-${getAttachmentKey(attachment, index)}`,
    })),
  )
  const traceEntries = useMemo(() => getConversationTraceEntries(conversation), [conversation])
  const traceProviderOptions = useMemo(
    () => buildTraceSelectOptions(traceEntries, "provider", "Todos os providers"),
    [traceEntries]
  )
  const traceStageOptions = useMemo(
    () => buildTraceSelectOptions(traceEntries, "stage", "Todos os stages"),
    [traceEntries]
  )
  const filteredTraceEntries = useMemo(
    () =>
      traceEntries.filter((entry) => {
        if (traceProviderFilter && entry.provider !== traceProviderFilter) {
          return false
        }

        if (traceStageFilter && entry.stage !== traceStageFilter) {
          return false
        }

        if (traceCostFilter === "with_cost" && entry.estimatedCostUsd <= 0) {
          return false
        }

        if (traceCostFilter === "high_cost" && entry.estimatedCostUsd < 0.001) {
          return false
        }

        if (traceErrorFilter === "failed" && !entry.failClosed) {
          return false
        }

        if (traceErrorFilter === "ok" && entry.failClosed) {
          return false
        }

        return true
      }),
    [traceCostFilter, traceEntries, traceErrorFilter, traceProviderFilter, traceStageFilter]
  )
  const timelineItems = useMemo(() => {
    const items = []
    let previousDayKey = null
    const sortedMessages = [...conversation.mensagens].sort((left, right) => {
      const leftTime = new Date(left.createdAt ?? left.data ?? 0).getTime()
      const rightTime = new Date(right.createdAt ?? right.data ?? 0).getTime()

      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime
      }

      return 0
    })

    sortedMessages.forEach((message) => {
      const currentDayKey = getMessageDayKey(message)

      if (currentDayKey && currentDayKey !== previousDayKey) {
        items.push({
          id: `day-${currentDayKey}`,
          type: "day",
          label: formatMessageDayLabel(message),
        })
      }

      items.push({
        id: message.id,
        type: "message",
        message,
      })

      previousDayKey = currentDayKey || previousDayKey
    })

    return items
  }, [conversation.mensagens])

  useEffect(() => {
    if (typeof window === "undefined" || !compactMobileHeader || !detailsOpen || detailsHistoryActiveRef.current) {
      return
    }

    window.history.pushState({ attendanceDetailsSheet: true }, "")
    detailsHistoryActiveRef.current = true
  }, [compactMobileHeader, detailsOpen])

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    function handlePopState() {
      if (!detailsHistoryActiveRef.current) {
        return
      }

      detailsPopClosingRef.current = true
      detailsHistoryActiveRef.current = false
      setDetailsOpen(false)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    const container = feedRef.current
    if (!container) {
      return
    }

    function updateScrollState() {
      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      const hasOverflow = container.scrollHeight - container.clientHeight > 40
      setShowScrollButton(hasOverflow && distanceToBottom > 80)
    }

    updateScrollState()
    container.addEventListener("scroll", updateScrollState)
    return () => container.removeEventListener("scroll", updateScrollState)
  }, [conversation.id])

  useEffect(() => {
    const container = feedRef.current
    if (!container) {
      return
    }

    container.scrollTo({ top: container.scrollHeight, behavior: "auto" })
  }, [conversation.id])

  useEffect(() => {
    const container = feedRef.current
    if (!container) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
      setShowScrollButton(false)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [conversation.mensagens.length])

  function scrollToBottom() {
    const container = feedRef.current
    if (!container) {
      return
    }

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
  }

  async function updateHandoff(nextStatus) {
    const response = await fetch(`/api/admin/conversations/${conversation.id}/handoff`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      onStatusChanged(conversation.id, nextStatus === "human" ? "humano" : "ia", data.handoff ?? null)
    }
  }

  async function handleClearConversation() {
    setClearing(true)
    setClearError("")

    const response = await fetch(`/api/admin/conversations/${conversation.id}/messages`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatIds: conversation.chatIds || [conversation.id],
        confirmation: clearConfirmation,
      }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      setClearError(data?.error || "Não foi possível limpar a conversa.")
      setClearing(false)
      return
    }

    setClearing(false)
    setClearDialogOpen(false)
    setClearConfirmation("")
    onConversationDeleted?.(conversation)
  }

  function handleDetailsOpenChange(nextOpen) {
    if (!nextOpen && compactMobileHeader && detailsHistoryActiveRef.current && !detailsPopClosingRef.current) {
      window.history.back()
      return
    }

    if (!nextOpen) {
      detailsHistoryActiveRef.current = false
    }

    detailsPopClosingRef.current = false
    setDetailsOpen(nextOpen)
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
        <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0c1322] px-3 py-3 lg:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {onCloseMobile ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-400/20 hover:bg-sky-500/10 hover:text-white lg:hidden"
                  onClick={onCloseMobile}
                  aria-label="Voltar para a lista de conversas"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#182235] text-[10px] font-semibold uppercase text-slate-200">
                  {initials}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-slate-100">
                        {conversation.cliente.nome}
                      </h2>
                      {compactMobileHeader ? null : (
                        <>
                          <Tag className="border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                            {originLabel}
                          </Tag>
                          <Tag
                            className={
                              humanInControl
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                                : loopPaused
                                  ? "border-amber-400/20 bg-amber-500/10 text-amber-100"
                                : "border-slate-500/20 bg-slate-500/10 text-slate-200"
                            }
                          >
                            {statusLabel}
                          </Tag>
                        </>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-400">
                      {compactMobileHeader
                        ? getConversationPhone(conversation)
                        : `${getConversationPhone(conversation)} - Ultima atividade em ${lastMessage?.horario}`}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className={cn("flex flex-wrap items-center gap-2", compactMobileHeader && "hidden lg:flex")}>
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
                {loopPaused ? "Reativar bot" : "Liberar IA"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setClearError("")
                  setClearConfirmation("")
                  setClearDialogOpen(true)
                }}
                className="h-8 rounded-lg px-2.5 text-[11px] text-rose-200 hover:bg-rose-500/16 hover:text-white"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Limpar
              </Button>
            </div>
          </div>
        </div>

        {humanInControl ? (
          <div className="border-b border-emerald-400/10 bg-emerald-500/[0.06] px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100 lg:px-4">
            Você está no comando da conversa
          </div>
        ) : loopPaused ? (
          <div className="border-b border-amber-400/10 bg-amber-500/[0.08] px-3 py-2 lg:px-4">
            <div className="flex flex-col gap-1.5 text-[11px] text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-semibold uppercase tracking-[0.16em]">Pausado por loop</div>
              <div className="text-amber-50/80">
                {autoPauseReason
                  ? `Motivo tecnico: ${autoPauseReason}${autoPauseDetails ? ` - ${autoPauseDetails}` : ""}`
                  : "O bot foi pausado automaticamente por suspeita de conversa automatica em ciclo."}
              </div>
            </div>
          </div>
        ) : null}

        <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div className="space-y-5 px-3 py-4 lg:px-4">
            {conversation.hasMore ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loadingOlder}
                  onClick={() => onLoadOlderMessages?.(conversation)}
                  className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[11px] text-slate-300 hover:border-sky-400/20 hover:bg-sky-500/10 hover:text-white"
                >
                  {loadingOlder ? "Carregando..." : "Carregar anteriores"}
                </Button>
              </div>
            ) : null}
            {timelineItems.map((item) =>
              item.type === "day" ? (
                <MessageDayDivider key={item.id} label={item.label} />
              ) : (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <MessageBubble message={item.message} isAdmin={isAdmin} />
                </motion.div>
              )
            )}
          </div>
        </div>

        <AnimatePresence>
          {showScrollButton ? (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.92 }}
              transition={{ duration: 0.18 }}
              onClick={scrollToBottom}
              className="absolute bottom-[92px] right-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/20 bg-[#10192b]/95 text-sky-100 shadow-[0_10px_24px_rgba(2,6,23,0.45)] hover:bg-sky-500/16"
              title="Descer para o fim"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.button>
          ) : null}
        </AnimatePresence>

        <Composer
          conversation={conversation}
          onMessageSent={onMessageSent}
          onStatusChanged={onStatusChanged}
        />

        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={(open) => {
            setClearDialogOpen(open)
            if (!open) {
              setClearConfirmation("")
              setClearError("")
            }
          }}
          title="Limpar conversa"
          description="Isso vai excluir todas as mensagens e remover a conversa da listagem. O consumo de tokens ja registrado sera mantido."
          confirmLabel={clearing ? "Limpando..." : "Remover tudo"}
          cancelLabel="Cancelar"
          danger
          loading={clearing}
          confirmDisabled={clearConfirmation.trim().toLowerCase() !== "remover tudo"}
          onConfirm={handleClearConversation}
        >
          <div className="px-5 pb-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-300">Digite remover tudo para confirmar</span>
              <input
                value={clearConfirmation}
                onChange={(event) => setClearConfirmation(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-rose-400/40"
                placeholder="remover tudo"
                autoComplete="off"
              />
            </label>
            {clearError ? (
              <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {clearError}
              </div>
            ) : null}
          </div>
        </ConfirmDialog>

        <Sheet open={detailsOpen} onOpenChange={handleDetailsOpenChange}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className={cn(
              "z-[271] border-l border-white/5 overflow-visible",
              compactMobileHeader ? "inset-y-0 right-0 w-screen max-w-none rounded-none" : "w-[92vw] max-w-[420px]",
            )}
            overlayClassName="z-[270]"
          >
            <SheetClose className="absolute left-0 top-[96px] z-40 hidden -translate-x-[60%] items-center justify-center rounded-full border border-white/10 bg-[#0c1426] p-2 text-slate-400 shadow-[0_14px_30px_rgba(2,6,23,0.52)] transition-colors hover:bg-[#101b31] hover:text-white focus:outline-none sm:inline-flex">
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Fechar painel</span>
            </SheetClose>
            <div className="flex h-full flex-col">
              <div className="border-b border-white/5 px-5 py-5">
                <SheetTitle className="text-left text-base font-semibold text-white">
                  {conversation.cliente.nome}
                </SheetTitle>
                <SheetDescription className="mt-1 text-left text-sm text-slate-400">
                  Resumo rapido e midias da conversa.
                </SheetDescription>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Origem", originLabel],
                    ["Status", statusLabel],
                    ["Mensagens", String(conversation.mensagens.length)],
                    ["Midias", String(mediaItems.length)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Contato</div>
                  <div className="mt-2 text-sm font-semibold text-white">{conversation.cliente.nome}</div>
                  <div className="mt-1 text-sm text-slate-400">{getConversationPhone(conversation)}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Midias e arquivos</div>
                  {mediaItems.length ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {mediaItems.map((attachment) => {
                        const previewable = attachment.category === "image" && attachment.publicUrl

                        return (
                          <a
                            key={attachment.key}
                            href={attachment.publicUrl || "#"}
                            target={attachment.publicUrl ? "_blank" : undefined}
                            rel={attachment.publicUrl ? "noreferrer" : undefined}
                            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                          >
                            {previewable ? (
                              <img
                                src={attachment.publicUrl}
                                alt={attachment.name || "Midia"}
                                className="h-28 w-full object-cover"
                              />
                            ) : null}
                            <div className="px-3 py-2.5">
                              <div className="flex items-center gap-2 text-sm font-medium text-white">
                                <FileText className="h-4 w-4" />
                                <span className="truncate">{attachment.name}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{attachment.horario}</div>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                      Nenhuma midia enviada nesta conversa.
                    </div>
                  )}
                </div>

                {isAdmin ? (
                  <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Observabilidade tecnica</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {traceEntries.length} evento(s) com IA trace nesta conversa.
                      </div>
                    </div>
                    {traceEntries.length ? (
                      <Tag className="border-sky-400/20 bg-sky-400/10 text-sky-200">
                        timeline
                      </Tag>
                    ) : null}
                  </div>

                  {traceEntries.length ? (
                    <>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <AppSelect
                          value={traceProviderFilter}
                          onChangeValue={setTraceProviderFilter}
                          options={traceProviderOptions}
                          placeholder="Filtrar provider"
                          minHeight={38}
                        />
                        <AppSelect
                          value={traceStageFilter}
                          onChangeValue={setTraceStageFilter}
                          options={traceStageOptions}
                          placeholder="Filtrar stage"
                          minHeight={38}
                        />
                        <AppSelect
                          value={traceCostFilter}
                          onChangeValue={setTraceCostFilter}
                          options={[
                            { value: "", label: "Todo custo" },
                            { value: "with_cost", label: "Com custo" },
                            { value: "high_cost", label: "Custo >= 0.001" },
                          ]}
                          placeholder="Filtrar custo"
                          minHeight={38}
                        />
                        <AppSelect
                          value={traceErrorFilter}
                          onChangeValue={setTraceErrorFilter}
                          options={[
                            { value: "", label: "Toda falha" },
                            { value: "failed", label: "Com fail-closed" },
                            { value: "ok", label: "Sem fail-closed" },
                          ]}
                          placeholder="Filtrar falha"
                          minHeight={38}
                        />
                      </div>

                      <div className="mt-3 space-y-3">
                        {filteredTraceEntries.length ? (
                          filteredTraceEntries.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Tag className="border-white/10 bg-white/[0.04] text-slate-200">
                                  {entry.horario}
                                </Tag>
                                <Tag className="border-white/10 bg-white/[0.04] text-slate-300">
                                  {entry.provider}
                                </Tag>
                                <Tag className="border-white/10 bg-white/[0.04] text-slate-300">
                                  {entry.stage}
                                </Tag>
                                {entry.failClosed ? (
                                  <Tag className="border-rose-400/20 bg-rose-500/10 text-rose-200">
                                    fail-closed
                                  </Tag>
                                ) : null}
                              </div>

                              <div className="mt-3 grid gap-2 text-[12px] text-slate-300 md:grid-cols-2">
                                <div>dominio: <span className="text-white">{entry.domainStage}</span></div>
                                <div>heuristica: <span className="text-white">{entry.heuristicStage}</span></div>
                                <div>handoff: <span className="text-white">{entry.handoffDecision}</span></div>
                                <div>tokens: <span className="text-white">{entry.totalTokens}</span></div>
                                <div>custo: <span className="text-white">{formatUsd(entry.estimatedCostUsd)}</span></div>
                                <div>APIs runtime: <span className="text-white">{entry.runtimeApiCount} / cache {entry.runtimeApiCacheHits}</span></div>
                              </div>

                              {entry.runtimeApis.length ? (
                                <div className="mt-3 border-t border-white/10 pt-3 text-[12px] text-slate-400">
                                  APIs: {entry.runtimeApis.map((api) => `${api.nome || "API"}${api.cacheHit ? " (cache)" : ""}`).join(", ")}
                                </div>
                              ) : null}

                              <div className="mt-3 border-t border-white/10 pt-3 text-[12px] text-slate-500">
                                {entry.texto.slice(0, 220)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                            Nenhum evento atende aos filtros atuais.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                      Esta conversa ainda não gerou timeline técnica de IA.
                    </div>
                  )}
                  </div>
                ) : null}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </motion.div>
    </AnimatePresence>
  )
}

export default function AttendancePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState(null)
  const [conversationDetails, setConversationDetails] = useState({})
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [projectFilter, setProjectFilter] = useState("")
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [loadingDetailId, setLoadingDetailId] = useState(null)
  const [loadingOlderId, setLoadingOlderId] = useState(null)
  const [accessSheetOpen, setAccessSheetOpen] = useState(false)
  const [accessRequest, setAccessRequest] = useState({
    featureKey: "",
    label: "",
    projetoId: "",
    assunto: "",
    mensagemInicial: "",
  })
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessError, setAccessError] = useState(null)

  async function fetchConversationList() {
    const response = await fetch("/api/admin/conversations", { cache: "no-store" })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível carregar as conversas.")
    }

    return data.conversations ?? []
  }

  async function fetchConversationDetail(conversation, options = {}) {
    if (!conversation?.id) {
      return null
    }

    const params = new URLSearchParams()
    params.set("limit", String(options.limit ?? 30))
    if (Array.isArray(conversation.chatIds) && conversation.chatIds.length) {
      params.set("chatIds", conversation.chatIds.join(","))
    }
    if (options.before) {
      params.set("before", options.before)
    }

    const response = await fetch(
      `/api/admin/conversations/${conversation.id}/messages${params.toString() ? `?${params.toString()}` : ""}`,
      { cache: "no-store" },
    )
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível carregar a conversa.")
    }

    return data.conversation ?? null
  }

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        const data = await response.json().catch(() => ({}))

        if (response.ok) {
          setCurrentUser(data.user ?? null)
        }
      } catch {}
    }

    loadUser()
  }, [])

  useEffect(() => {
    async function loadConversations() {
      try {
        setLoadError(null)
        const nextConversations = await fetchConversationList()
        setConversations(nextConversations)
      } catch (error) {
        setLoadError(error.message || "Não foi possível carregar as conversas.")
      } finally {
        setLoading(false)
      }
    }

    loadConversations()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return
      }

      try {
        const nextConversations = await fetchConversationList()
        setLoadError(null)
        setConversations(nextConversations)
      } catch (error) {
        setLoadError(error.message || "Não foi possível atualizar as conversas.")
      }
    }, 20000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    async function loadConversationDetail() {
      if (!selectedConversationId) {
        setLoadingDetailId(null)
        return
      }

      const selectedPreview = conversations.find((conversation) => conversation.id === selectedConversationId)
      if (!selectedPreview) {
        return
      }

      const cachedDetail = conversationDetails[selectedConversationId]
      const shouldRefreshDetail =
        !cachedDetail ||
        (selectedPreview.updatedAt &&
          cachedDetail.updatedAt &&
          new Date(selectedPreview.updatedAt).getTime() > new Date(cachedDetail.updatedAt).getTime())

      if (!shouldRefreshDetail) {
        return
      }

      try {
        setLoadingDetailId(selectedConversationId)
        const detail = await fetchConversationDetail(selectedPreview)
        if (!detail) {
          return
        }

        setConversationDetails((current) => ({
          ...current,
          [selectedConversationId]: {
            ...selectedPreview,
            ...detail,
            projeto: detail.projeto ?? selectedPreview.projeto ?? null,
            totalMensagens: detail.mensagens?.length ?? selectedPreview.totalMensagens ?? 0,
          },
        }))
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === selectedConversationId
              ? {
                  ...conversation,
                  mensagens: detail.mensagens?.length ? [detail.mensagens[detail.mensagens.length - 1]] : conversation.mensagens,
                  totalMensagens: detail.mensagens?.length ?? conversation.totalMensagens ?? 0,
                  updatedAt: detail.updatedAt ?? conversation.updatedAt,
                }
              : conversation,
          ),
        )
      } catch {
      } finally {
        setLoadingDetailId((current) => (current === selectedConversationId ? null : current))
      }
    }

    void loadConversationDetail()
  }, [conversationDetails, conversations, selectedConversationId])

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

  useEffect(() => {
    if (!mobileChatOpen) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [mobileChatOpen])

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        (activeFilter === "all" ? true : conversation.origem === activeFilter) &&
        (projectFilter ? conversation.projeto?.id === projectFilter : true)
      ),
    [activeFilter, conversations, projectFilter]
  )

  const projectOptions = useMemo(() => {
    const map = new Map()

    conversations.forEach((conversation) => {
      if (conversation.projeto?.id && !map.has(conversation.projeto.id)) {
        map.set(conversation.projeto.id, {
          value: conversation.projeto.id,
          label: conversation.projeto.nome || conversation.projeto.slug || "Projeto",
        })
      }
    })

    const membershipOptions =
      currentUser?.memberships?.map((item) => ({
        value: item.projetoId,
        label: item.projetoNome || item.projetoSlug || "Projeto",
      })) ?? []

    membershipOptions.forEach((option) => {
      if (option.value && !map.has(option.value)) {
        map.set(option.value, option)
      }
    })

    return [{ value: "", label: "Todos os projetos" }, ...Array.from(map.values())]
  }, [conversations, currentUser])
  const hasMultipleProjects = projectOptions.length > 2

  const activeConversation =
    (() => {
      if (!selectedConversationId) {
        return null
      }

      const selectedPreview =
        filteredConversations.find((conversation) => conversation.id === selectedConversationId) ??
        conversations.find((conversation) => conversation.id === selectedConversationId) ??
        null

      if (!selectedPreview) {
        return null
      }

      const detail = conversationDetails[selectedPreview.id]
      return detail
        ? {
            ...selectedPreview,
            ...detail,
            projeto: detail.projeto ?? selectedPreview.projeto ?? null,
          }
        : null
    })()

  const filterCounts = {
    all: conversations.length,
    site: conversations.filter((conversation) => conversation.origem === "site").length,
    whatsapp: conversations.filter((conversation) => conversation.origem === "whatsapp").length,
  }

  const setConversationQuery = useCallback((conversationId) => {
    const params = new URLSearchParams(searchParams.toString())

    if (conversationId) {
      params.set("conversa", conversationId)
    } else {
      params.delete("conversa")
    }

    const nextQuery = params.toString()
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }, [pathname, router, searchParams])

  useEffect(() => {
    if (
      selectedConversationId &&
      filteredConversations.length > 0 &&
      !filteredConversations.some((conversation) => conversation.id === selectedConversationId)
    ) {
      setSelectedConversationId(null)
      setConversationQuery(null)
    }
  }, [filteredConversations, selectedConversationId, setConversationQuery])

  useEffect(() => {
    const conversationId = searchParams.get("conversa")

    if (!conversationId) {
      if (isMobile) {
        setMobileChatOpen(false)
      }
      return
    }

    const conversation = conversations.find((item) => item.id === conversationId)
    if (!conversation) {
      return
    }

    setSelectedConversationId(conversation.id)

    if (isMobile) {
      setMobileChatOpen(true)
    }
  }, [conversations, isMobile, searchParams])

  function updateConversation(conversationId, message) {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              mensagens: [...(conversation.mensagens || []).slice(-1), message],
              totalMensagens: Number(conversation.totalMensagens ?? conversation.mensagens?.length ?? 0) + 1,
              updatedAt: message.createdAt || conversation.updatedAt,
            }
          : conversation
      )
    )

    setConversationDetails((current) => ({
      ...current,
      [conversationId]: current[conversationId]
        ? {
            ...current[conversationId],
            mensagens: [...(current[conversationId].mensagens || []), message],
            totalMensagens: Number(current[conversationId].totalMensagens ?? current[conversationId].mensagens?.length ?? 0) + 1,
            updatedAt: message.createdAt || current[conversationId].updatedAt,
          }
        : current[conversationId],
    }))
  }

  async function loadOlderMessages(conversation) {
    if (!conversation?.id || loadingOlderId === conversation.id) {
      return
    }

    const firstMessage = [...(conversation.mensagens || [])].sort(
      (left, right) => new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime(),
    )[0]

    if (!firstMessage?.createdAt) {
      return
    }

    setLoadingOlderId(conversation.id)

    try {
      const detail = await fetchConversationDetail(conversation, { limit: 30, before: firstMessage.createdAt })
      const olderMessages = detail?.mensagens || []

      setConversationDetails((current) => {
        const currentDetail = current[conversation.id]
        if (!currentDetail) {
          return current
        }

        const byId = new Map()
        olderMessages.forEach((message) => byId.set(message.id, message))
        ;(currentDetail.mensagens || []).forEach((message) => byId.set(message.id, message))

        const mensagens = Array.from(byId.values()).sort(
          (left, right) => new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime(),
        )

        return {
          ...current,
          [conversation.id]: {
            ...currentDetail,
            mensagens,
            hasMore: detail?.hasMore ?? false,
            nextCursor: detail?.nextCursor ?? mensagens[0]?.createdAt ?? null,
          },
        }
      })
    } finally {
      setLoadingOlderId((current) => (current === conversation.id ? null : current))
    }
  }

  function handleConversationSelect(conversation) {
    setSelectedConversationId(conversation.id)
    setConversationQuery(conversation.id)

    if (isMobile) {
      setMobileChatOpen(true)
    }
  }

  function handleMobileClose() {
    setMobileChatOpen(false)
    setConversationQuery(null)
  }

  function handleInactiveNavClick(item) {
    const projectId = activeConversation?.projeto?.id || projectFilter || ""
    const projectName = activeConversation?.projeto?.nome || activeConversation?.projeto?.slug || ""

    setAccessError(null)
    setAccessRequest({
      featureKey: item.featureKey || "",
      label: item.label,
      projetoId: projectId,
      assunto: `Solicitação de acesso: ${item.label}`,
      mensagemInicial: buildAccessRequestMessage(item.label, projectName),
    })
    setAccessSheetOpen(true)
  }

  async function handleAccessRequestSubmit(event) {
    event.preventDefault()
    setAccessSaving(true)
    setAccessError(null)

    const response = await fetch("/api/admin/feedbacks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projetoId: accessRequest.projetoId,
        categoria: "duvida",
        assunto: accessRequest.assunto,
        mensagemInicial: accessRequest.mensagemInicial,
      }),
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.feedback?.id) {
      setAccessError(data?.error ?? "Não foi possível abrir a solicitação.")
      setAccessSaving(false)
      return
    }

    setAccessSheetOpen(false)
    window.location.href = `/admin/feedback/${data.feedback.id}`
  }

  function updateConversationStatus(conversationId, status, handoff = undefined) {
    setConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, status, ...(typeof handoff !== "undefined" ? { handoff } : {}) }
          : conversation
      )
    )

    setConversationDetails((current) => ({
      ...current,
      [conversationId]: current[conversationId]
        ? { ...current[conversationId], status, ...(typeof handoff !== "undefined" ? { handoff } : {}) }
        : current[conversationId],
    }))
  }

  function handleConversationDeleted(conversation) {
    const removedIds = new Set([conversation.id, ...(conversation.chatIds || [])])
    setConversations((current) => current.filter((item) => !removedIds.has(item.id)))
    setConversationDetails((current) => {
      const next = { ...current }
      removedIds.forEach((id) => {
        delete next[id]
      })
      return next
    })
    setSelectedConversationId((currentId) => {
      if (!removedIds.has(currentId)) {
        return currentId
      }

      setConversationQuery(null)
      return null
    })

    if (isMobile) {
      setMobileChatOpen(false)
    }
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

  if (!conversations.length) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center">
        <p className="text-sm text-slate-500">Nenhuma conversa ativa encontrada.</p>
      </div>
    )
  }

  const selectedPreview = selectedConversationId
    ? conversations.find((conversation) => conversation.id === selectedConversationId) ?? null
    : null
  const detailLoading = Boolean(selectedConversationId && loadingDetailId === selectedConversationId)

  return (
    <div className="h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col">
        <AdminPageHeader
          title="Central de Atendimento"
          description="Fila ativa de conversas com inteligencia do pipeline real."
          actions={
            hasMultipleProjects ? (
              <div className="w-full min-w-[230px] lg:w-[280px]">
                <AppSelect
                  value={projectFilter}
                  onChangeValue={setProjectFilter}
                  options={projectOptions}
                  placeholder="Filtrar por projeto"
                  minHeight={38}
                />
              </div>
            ) : null
          }
          className={cn(mobileChatOpen && "hidden lg:flex")}
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
                      onClick={item.active ? undefined : () => handleInactiveNavClick(item)}
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
                      onClick={item.active ? undefined : () => handleInactiveNavClick(item)}
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

          <section
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              isMobile ? "rounded-none border-0 bg-transparent" : "rounded-[12px] border border-white/5 bg-[#0d1424]"
            )}
          >
            <div
              className={cn(
                "sticky top-0 z-10 px-3 py-3",
                isMobile ? "border-b-0 bg-transparent px-0 pt-1" : "border-b border-white/5 bg-[#0d1424]"
              )}
            >
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

            <div className={cn("min-h-0 flex-1 overflow-y-auto", isMobile ? "px-0 py-2" : "px-2 py-2")}>
              <div className="space-y-2">
                {filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === selectedConversationId}
                    isMobile={isMobile}
                    onClick={() => handleConversationSelect(conversation)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="hidden min-h-0 flex-col overflow-hidden rounded-[12px] border border-white/5 bg-[#0c1322] lg:flex">
            {activeConversation ? (
              <ChatPanel
                key={activeConversation.id}
                conversation={activeConversation}
                onMessageSent={updateConversation}
                onStatusChanged={updateConversationStatus}
                onConversationDeleted={handleConversationDeleted}
                onLoadOlderMessages={loadOlderMessages}
                loadingOlder={loadingOlderId === activeConversation.id}
                isAdmin={currentUser?.role === "admin"}
              />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    {detailLoading ? "Carregando conversa..." : "Selecione uma conversa"}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {detailLoading
                      ? "Buscando somente as mensagens dessa conversa."
                      : selectedPreview
                        ? "A conversa sera carregada aqui."
                        : "A lista ao lado carrega apenas os dados essenciais."}
                  </p>
                </div>
              </div>
            )}
          </section>

          <AnimatePresence initial={false}>
            {mobileChatOpen ? (
              <motion.section
                key="mobile-chat"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
                className="fixed inset-0 z-[70] flex min-h-0 flex-col overflow-hidden bg-[#0c1322] lg:hidden"
              >
                {activeConversation ? (
                  <ChatPanel
                    key={activeConversation.id}
                    conversation={activeConversation}
                    onMessageSent={updateConversation}
                    onStatusChanged={updateConversationStatus}
                    onConversationDeleted={handleConversationDeleted}
                    onLoadOlderMessages={loadOlderMessages}
                    loadingOlder={loadingOlderId === activeConversation.id}
                    onCloseMobile={handleMobileClose}
                    isAdmin={currentUser?.role === "admin"}
                  />
                ) : (
                  <div className="flex h-full flex-col">
                    <div className="border-b border-white/5 px-3 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-400/20 hover:bg-sky-500/10 hover:text-white"
                        onClick={handleMobileClose}
                        aria-label="Voltar para a lista de conversas"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid flex-1 place-items-center px-6 text-center">
                      <div>
                        <div className="text-sm font-semibold text-slate-200">Carregando conversa...</div>
                        <p className="mt-2 text-sm text-slate-500">Buscando somente as mensagens dessa conversa.</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <Sheet open={accessSheetOpen} onOpenChange={setAccessSheetOpen}>
        <SheetContent side="right" className="w-[92vw] max-w-[460px] border-l border-white/5">
          <form onSubmit={handleAccessRequestSubmit} className="flex h-full flex-col">
            <div className="border-b border-white/5 px-5 py-5">
              <SheetTitle className="text-left text-lg font-semibold text-white">Solicitar acesso</SheetTitle>
              <SheetDescription className="mt-1 text-left text-sm text-slate-400">
                Esse acesso deve ser solicitado diretamente para a InfraStudio.
              </SheetDescription>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Apos o envio, acompanhe a resposta na central de Feedback.
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-300">Projeto</span>
                <AppSelect
                  value={accessRequest.projetoId}
                  onChangeValue={(value) => setAccessRequest((current) => ({ ...current, projetoId: value }))}
                  options={projectOptions}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-300">Assunto</span>
                <input
                  value={accessRequest.assunto}
                  onChange={(event) => setAccessRequest((current) => ({ ...current, assunto: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-300">Mensagem</span>
                <textarea
                  value={accessRequest.mensagemInicial}
                  onChange={(event) => setAccessRequest((current) => ({ ...current, mensagemInicial: event.target.value }))}
                  rows={8}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
              </label>

              {accessError ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {accessError}
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/5 px-5 py-4">
              <Button
                type="submit"
                disabled={accessSaving || !accessRequest.assunto.trim() || !accessRequest.mensagemInicial.trim()}
                className="h-10 w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
              >
                {accessSaving ? "Enviando..." : "Enviar para feedback"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
