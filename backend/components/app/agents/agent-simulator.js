"use client"

import { useEffect, useMemo, useRef } from "react"
import { RefreshCcw, X } from "lucide-react"

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

export function AgentSimulator({ project, agent = project?.agent, open, onOpenChange }) {
  const scriptRef = useRef(null)
  const sessionIdRef = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
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
  }, [agent?.id, agentIdentifier, instanceDetail, instanceKey, open, project?.id, projectIdentifier, widgetIdentity])

  if (!open) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-5 z-[141] flex translate-y-[-650px] items-center gap-2 rounded-lg border border-white/10 bg-[#0c1426]/95 px-3 py-2 shadow-[0_8px_18px_rgba(2,6,23,0.55)] backdrop-blur">
      <span className="text-xs font-medium text-slate-200">Teste usando o Chat Widget real</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-lg"
        title="Recarregar teste"
        onClick={() => {
          sessionIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
          if (scriptRef.current) {
            scriptRef.current.remove()
          }
          onOpenChange?.(false)
          window.setTimeout(() => onOpenChange?.(true), 0)
        }}
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
  )
}
