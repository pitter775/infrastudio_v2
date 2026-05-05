"use client"

import { useRef, useState } from "react"
import { FileText, Info } from "lucide-react"

import { cn } from "@/lib/utils"

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=\S)(.+?)(?<=\S)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*(?!\*)([^*]+)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_(?!_)([^_]+)_(?=$|[\s).,!?:;])/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, '<code class="rounded bg-black/20 px-1.5 py-0.5 text-[12px] text-slate-100">$1</code>')
}

export function renderChatMessageHtml(value) {
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
        const level = Math.min(3, lines[0].match(/^#+/)?.[0]?.length || 1)
        return `<h${level}>${formatInlineMarkdown(lines[0].replace(/^#{1,3}\s+/, ""))}</h${level}>`
      }

      return `<p>${lines.map((line) => formatInlineMarkdown(line)).join("<br />")}</p>`
    })
    .join("")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noreferrer" class="break-all underline underline-offset-2">$1</a>'
    )
}

export function ProductAssetCards({ assets, className }) {
  const products = Array.isArray(assets)
    ? assets.filter((asset) => asset && (asset.kind === "product" || asset.provider === "mercado_livre")).slice(0, 3)
    : []

  if (!products.length) {
    return null
  }

  return (
    <div className={cn("mt-3 grid gap-3", className)}>
      {products.map((asset, index) => (
        <a
          key={`${asset.id || "product"}-${index}`}
          href={asset.targetUrl || asset.publicUrl || "#"}
          target="_blank"
          rel="noreferrer noopener"
          className="overflow-hidden rounded-2xl border border-sky-400/20 bg-sky-500/10 transition hover:border-sky-300/30 hover:bg-sky-500/15"
        >
          {asset.publicUrl ? (
            <img src={asset.publicUrl} alt={asset.nome || "Produto"} className="h-40 w-full object-cover" />
          ) : null}
          <div className="space-y-2 px-3 py-3">
            <div className="text-sm font-semibold text-white">{asset.nome || "Produto"}</div>
            {asset.descricao ? <div className="text-xs leading-5 text-slate-300">{asset.descricao}</div> : null}
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                {asset.priceLabel || "Ver produto"}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                Mercado Livre
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

function ChatUiBlocks({ ui }) {
  const blocks = Array.isArray(ui?.blocks) ? ui.blocks : []
  if (!blocks.length) {
    return null
  }

  function bindDragScroll(element) {
    if (!element || element.dataset.dragScrollBound === "true") {
      return
    }

    element.dataset.dragScrollBound = "true"

    let pointerId = null
    let startX = 0
    let startScrollLeft = 0
    let dragging = false

    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return
      }

      pointerId = event.pointerId
      startX = event.clientX
      startScrollLeft = element.scrollLeft
      dragging = false
    })

    element.addEventListener("pointermove", (event) => {
      if (pointerId !== event.pointerId) {
        return
      }

      const delta = event.clientX - startX
      if (!dragging && Math.abs(delta) > 6) {
        dragging = true
        element.classList.add("is-dragging")
        try {
          element.setPointerCapture(event.pointerId)
        } catch {}
      }

      if (!dragging) {
        return
      }

      element.scrollLeft = startScrollLeft - delta
      event.preventDefault()
    })

    const release = (event) => {
      if (pointerId !== event.pointerId) {
        return
      }

      pointerId = null
      dragging = false
      element.classList.remove("is-dragging")
    }

    element.addEventListener("pointerup", release)
    element.addEventListener("pointercancel", release)
    element.addEventListener("lostpointercapture", () => {
      pointerId = null
      dragging = false
      element.classList.remove("is-dragging")
    })
  }

  function HorizontalRail({ as: Component = "div", children, className }) {
    const railRef = useRef(null)

    return (
      <Component
        ref={(node) => {
          railRef.current = node
          bindDragScroll(node)
        }}
        className={cn(
          "flex gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-1.5 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [scroll-snap-type:x_proximity] cursor-grab [&::-webkit-scrollbar]:hidden",
          "[&.is-dragging]:cursor-grabbing [&.is-dragging]:[scroll-snap-type:none]",
          className
        )}
      >
        {children}
      </Component>
    )
  }

  return (
    <div className="mb-3 grid gap-2.5">
      {blocks.map((block, index) => {
        if (!block?.type) {
          return null
        }

        if (block.type === "text" && block.text) {
          return (
            <div
              key={`text-${index}`}
              className={cn(
                block.variant === "title" && "text-[13px] font-semibold leading-5 text-white",
                block.variant === "subtitle" && "text-[11px] leading-5 text-slate-400",
                (!block.variant || block.variant === "body") && "text-sm leading-6 text-slate-200"
              )}
            >
              {block.text}
            </div>
          )
        }

        if (block.type === "badges" && Array.isArray(block.items)) {
          return (
            <div key={`badges-${index}`} className="flex flex-wrap gap-2">
              {block.items.map((item, itemIndex) => (
                <span
                  key={`badge-${itemIndex}`}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold tracking-[0.04em] text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          )
        }

        if (block.type === "list" && Array.isArray(block.items)) {
          return (
            <HorizontalRail key={`list-${index}`} as="ul" className="list-none">
              {block.items.map((item, itemIndex) => (
                <li
                  key={`item-${itemIndex}`}
                  className="flex min-w-[180px] max-w-[220px] shrink-0 snap-start items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm leading-5 text-slate-200"
                >
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-300" />
                  <span>{item}</span>
                </li>
              ))}
            </HorizontalRail>
          )
        }

        if (block.type === "cards" && Array.isArray(block.items)) {
          return (
            <HorizontalRail key={`cards-${index}`}>
              {block.items.map((item, itemIndex) => (
                <div key={`card-${itemIndex}`} className="min-w-[184px] max-w-[214px] shrink-0 snap-start rounded-[10px] border border-white/10 bg-white/[0.04] px-2.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    {item.badge ? (
                      <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  {item.description ? <div className="mt-2 text-xs leading-5 text-slate-300">{item.description}</div> : null}
                  {item.meta ? <div className="mt-2 text-xs font-semibold text-white">{item.meta}</div> : null}
                </div>
              ))}
            </HorizontalRail>
          )
        }

        if (block.type === "notice" && block.text) {
          return (
            <div key={`notice-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-300">
              {block.text}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

export function AttachmentCards({ messageId, attachments }) {
  const items = Array.isArray(attachments) ? attachments : []
  if (!items.length) {
    return null
  }

  return (
    <div className="mt-3 grid gap-2">
      {items.map((attachment, index) => {
        const previewable = attachment.category === "image" && attachment.publicUrl
        const key = attachment.storagePath || attachment.publicUrl || `${attachment.name || "arquivo"}-${index}`

        return (
          <a
            key={`${messageId || "message"}-${key}`}
            href={attachment.publicUrl || "#"}
            target={attachment.publicUrl ? "_blank" : undefined}
            rel={attachment.publicUrl ? "noreferrer" : undefined}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
          >
            {previewable ? (
              <img src={attachment.publicUrl} alt={attachment.name || "Anexo"} className="max-h-56 w-full object-cover" />
            ) : null}
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{attachment.name}</span>
            </div>
          </a>
        )
      })}
    </div>
  )
}

export function AiTraceBlock({ trace, compact = false }) {
  const [open, setOpen] = useState(false)
  if (!trace) {
    return null
  }

  const usage = trace.usage ?? {}
  const tokens = Number(trace.tokens ?? 0) || Number(usage.inputTokens ?? 0) + Number(usage.outputTokens ?? 0)
  const cost = Number(trace.estimatedCostUsd ?? usage.estimatedCostUsd ?? 0)

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:border-sky-400/20 hover:bg-sky-500/10 hover:text-white"
      >
        <Info className="h-3 w-3" />
        IA trace
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-slate-300">
          <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
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
              <div className="font-medium text-white">{tokens}</div>
            </div>
            <div>
              <span className="text-slate-500">Custo</span>
              <div className="font-medium text-white">US$ {cost.toFixed(6)}</div>
            </div>
            <div>
              <span className="text-slate-500">APIs</span>
              <div className="font-medium text-white">
                {trace.runtimeApiCount ?? 0} / cache {trace.runtimeApiCacheHits ?? 0}
              </div>
            </div>
            {trace.stage ? (
              <div>
                <span className="text-slate-500">Stage</span>
                <div className="font-medium text-white">{trace.stage}</div>
              </div>
            ) : null}
          </div>
          {trace.runtimeApis?.length ? (
            <div className="mt-2 border-t border-white/10 pt-2 text-slate-400">
              APIs: {trace.runtimeApis.map((api) => `${api.nome || "API"} [${api.intentType || "generic_fact"}]${api.cacheHit ? " (cache)" : ""}`).join(", ")}
            </div>
          ) : null}
          {trace.apiRuntimeDiagnostics?.selectedApiId || trace.apiRuntimeDiagnostics?.semanticKind ? (
            <div className="mt-2 border-t border-white/10 pt-2 text-slate-400">
              API runtime: {trace.apiRuntimeDiagnostics.semanticKind || "n/a"} em {trace.apiRuntimeDiagnostics.selectedApiId || "sem API selecionada"}
              {trace.apiRuntimeDiagnostics.selectedMissingRequiredFields?.length ? (
                <div>Faltando: {trace.apiRuntimeDiagnostics.selectedMissingRequiredFields.join(", ")}</div>
              ) : null}
              {trace.apiRuntimeDiagnostics.selectedBlockedReasons?.length ? (
                <div>Bloqueios: {trace.apiRuntimeDiagnostics.selectedBlockedReasons.join(", ")}</div>
              ) : null}
              {trace.apiRuntimeDiagnostics.conflictingApiIds?.length ? (
                <div>Conflito: {trace.apiRuntimeDiagnostics.conflictingApiIds.join(", ")}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ChatMessageRenderer({ text, ui, assets, attachments, trace, messageId, compactTrace = false, className }) {
  return (
    <div className={className}>
      <ChatUiBlocks ui={ui} />
      {text ? (
        <div
          className="leading-6 [&_a]:text-sky-300 [&_code]:font-mono [&_em]:italic [&_li]:ml-4 [&_li]:list-disc [&_pre]:whitespace-pre-wrap [&_strong]:font-semibold [&_strong]:text-white"
          dangerouslySetInnerHTML={{ __html: renderChatMessageHtml(text) }}
        />
      ) : null}
      <ProductAssetCards assets={assets} />
      <AttachmentCards messageId={messageId} attachments={attachments} />
      <AiTraceBlock trace={trace} compact={compactTrace} />
    </div>
  )
}
