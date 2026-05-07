"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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
  const [appliedContext, setAppliedContext] = useState({})
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
        console.warn("[agent-simulator] contexto de teste inválido", parsedContext.error)
        return
      }

      setAppliedContext(parsedContext.value)
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

  return null
}
