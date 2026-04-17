"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const SCRIPT_ID = "infrastudio-home-chat-widget-script"

function destroyChatWidget(widgetSlug) {
  if (widgetSlug && window.InfraChatWidget?.destroy) {
    window.InfraChatWidget.destroy(widgetSlug)
    return
  }

  if (window.InfraChat?.destroy) {
    window.InfraChat.destroy()
  }
}

function removeHomeWidget(widgetSlug) {
  destroyChatWidget(widgetSlug)

  if (widgetSlug) {
    const host = document.getElementById(`infrastudio-chat-widget-root-${widgetSlug}`)
    if (host?.parentNode) {
      host.parentNode.removeChild(host)
    }
  }

  const script = document.getElementById(SCRIPT_ID)
  if (script?.parentNode) {
    script.parentNode.removeChild(script)
  }
}

export function HomeChatWidgetLoader({ config }) {
  const pathname = usePathname()

  useEffect(() => {
    if (!config?.widget || !config?.projeto || !config?.agente) {
      return undefined
    }

    if (pathname !== "/") {
      removeHomeWidget(config.widget)
      return undefined
    }

    removeHomeWidget(config.widget)

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = "/chat-widget.js"
    script.defer = true
    script.dataset.widget = config.widget
    script.dataset.apiBase = window.location.origin
    if (config.title) {
      script.dataset.title = config.title
    }
    if (config.theme) {
      script.dataset.theme = config.theme
    }
    if (config.accent) {
      script.dataset.accent = config.accent
    }
    if (typeof config.transparent === "boolean") {
      script.dataset.transparent = config.transparent ? "true" : "false"
    }
    document.body.appendChild(script)

    return () => {
      removeHomeWidget(config.widget)
    }
  }, [config, pathname])

  return null
}
