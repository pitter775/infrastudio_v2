"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, RefreshCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"

function getWidgetIdentity(project) {
  const widget = Array.isArray(project?.chatWidgets) ? project.chatWidgets[0] : null

  return {
    id: widget?.id || widget?.widgetId || "",
    slug: widget?.slug || widget?.widgetSlug || "",
    title: widget?.name || widget?.nome || project?.agent?.name || project?.name || "Teste do agente",
    accent: widget?.accentColor || widget?.accent || "#38bdf8",
    theme: widget?.theme || "dark",
  }
}

function dispatchWidgetEvent(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function parseTestContext(value) {
  const rawValue = String(value || "").trim()
  if (!rawValue) {
    return { value: {}, error: "" }
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: {}, error: "O contexto precisa ser um objeto JSON." }
    }
    return { value: parsed, error: "" }
  } catch (error) {
    return { value: {}, error: `JSON inválido: ${error.message}` }
  }
}

export function AgentSimulator({ project, agent = project?.agent, open, onOpenChange }) {
  const scriptRef = useRef(null)
  const sessionIdRef = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  const [contextText, setContextText] = useState("")
  const [appliedContext, setAppliedContext] = useState({})
  const [contextError, setContextError] = useState("")
  const [contextOpen, setContextOpen] = useState(false)
  const [contextVersion, setContextVersion] = useState(0)
  const projectIdentifier = project?.routeKey || project?.slug || project?.id || ""
  const agentIdentifier = agent?.slug || agent?.id || ""
  const instanceKey = `admin-agent-test:${project?.id || "project"}:${agent?.id || "agent"}`
  const widgetIdentity = useMemo(() => getWidgetIdentity(project), [project])
  const instanceDetail = useMemo(
    () => ({
      widgetId: widgetIdentity.id || undefined,
      widgetSlug: widgetIdentity.slug || undefined,
    }),
    [widgetIdentity.id, widgetIdentity.slug],
  )

  useEffect(() => {
    function handleApplyTestContext(event) {
      const rawContext =
        typeof event?.detail?.contextText === "string"
          ? event.detail.contextText
          : event?.detail?.context && typeof event.detail.context === "object"
            ? JSON.stringify(event.detail.context, null, 2)
            : ""
      const parsedContext = parseTestContext(rawContext)
      if (parsedContext.error) {
        setContextError(parsedContext.error)
        setContextOpen(true)
        return
      }

      setContextText(rawContext)
      setAppliedContext(parsedContext.value)
      setContextError("")
      setContextOpen(true)
      sessionIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      if (scriptRef.current) {
        scriptRef.current.remove()
      }
      setContextVersion((current) => current + 1)
      onOpenChange?.(true)
    }

    window.addEventListener("infrastudio-agent-test:set-context", handleApplyTestContext)
    return () => window.removeEventListener("infrastudio-agent-test:set-context", handleApplyTestContext)
  }, [onOpenChange])

  useEffect(() => {
    if (!open || !project?.id || !agent?.id || !projectIdentifier || !agentIdentifier) {
      return undefined
    }

    const scriptId = `infrastudio-agent-test-widget-${project.id}-${agent.id}`
    const existing = document.getElementById(scriptId)
    if (existing) {
      existing.remove()
    }

    const script = document.createElement("script")
    const context = {
      channel: {
        kind: "admin_agent_test",
      },
      admin: {
        projetoId: project.id,
        agenteId: agent.id,
        source: "agent_simulator",
      },
      laboratory: {
        origin: "agent_admin_test",
        persistAsRealConversation: false,
      },
      ui: {
        structured_response: true,
      },
      ...(appliedContext || {}),
    }

    script.id = scriptId
    script.src = "/chat-widget.js"
    script.async = true
    script.dataset.projeto = projectIdentifier
    script.dataset.agente = agentIdentifier
    script.dataset.canal = "admin_agent_test"
    script.dataset.source = "agent_simulator"
    script.dataset.instanceKey = instanceKey
    script.dataset.identificadorExterno = `admin-widget-simulator:${project.id}:${agent.id}:${sessionIdRef.current}`
    script.dataset.context = JSON.stringify(context)
    script.dataset.title = `Teste: ${widgetIdentity.title}`
    script.dataset.theme = widgetIdentity.theme
    script.dataset.accent = widgetIdentity.accent
    script.dataset.transparent = "true"
    script.dataset.identificacaoContato = "false"
    script.dataset.agentStatus = "online"

    if (widgetIdentity.id) {
      script.dataset.widgetId = widgetIdentity.id
    }
    if (widgetIdentity.slug) {
      script.dataset.widget = widgetIdentity.slug
    }

    script.onload = () => {
      window.requestAnimationFrame(() => {
        dispatchWidgetEvent("infrastudio-chat:open", instanceDetail)
      })
    }

    document.body.appendChild(script)
    scriptRef.current = script

    return () => {
      dispatchWidgetEvent("infrastudio-chat:close", instanceDetail)
      if (window.InfraChatWidget?.destroy) {
        window.InfraChatWidget.destroy(widgetIdentity.id || widgetIdentity.slug || instanceKey)
      }
      script.remove()
      scriptRef.current = null
    }
  }, [agent?.id, agentIdentifier, appliedContext, instanceDetail, instanceKey, open, project?.id, projectIdentifier, widgetIdentity, contextVersion])

  function reloadTest() {
    const parsedContext = parseTestContext(contextText)
    if (parsedContext.error) {
      setContextError(parsedContext.error)
      return
    }

    setContextError("")
    setAppliedContext(parsedContext.value)
    sessionIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    if (scriptRef.current) {
      scriptRef.current.remove()
    }
    setContextVersion((current) => current + 1)
    onOpenChange?.(false)
    window.setTimeout(() => onOpenChange?.(true), 0)
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-5 z-[141] w-[min(440px,calc(100vw-2rem))] translate-y-[-650px] rounded-lg border border-white/10 bg-[#0c1426]/95 px-3 py-2 shadow-[0_8px_18px_rgba(2,6,23,0.55)] backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs font-medium text-slate-200">Teste usando o Chat Widget real</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          title="Contexto do chat para teste"
          onClick={() => setContextOpen((current) => !current)}
        >
          {contextOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          title="Recarregar teste"
          onClick={reloadTest}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          title="Fechar teste"
          onClick={() => onOpenChange?.(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {contextOpen ? (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Contexto do chat para teste
            </label>
            <textarea
              value={contextText}
              onChange={(event) => {
                setContextText(event.target.value)
                setContextError("")
              }}
              placeholder={'{"propertyId":"c47ae17f-ddbe-4c59-96b9-30e6d12c5ff2"}'}
              className="mt-1 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-[#070d1a] px-3 py-2 font-mono text-xs text-slate-100 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
              spellCheck={false}
            />
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Use para simular item atual no chat. O campo de variáveis da API vale apenas para o botão Send.
          </p>
          {contextError ? <p className="text-xs text-red-200">{contextError}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
