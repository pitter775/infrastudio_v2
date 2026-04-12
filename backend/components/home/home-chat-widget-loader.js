"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const SCRIPT_ID = "infrastudio-home-chat-widget-script"

function removeHomeWidget(widgetSlug) {
  if (window.InfraChatWidget?.destroy) {
    window.InfraChatWidget.destroy(widgetSlug)
  }

  const host = document.getElementById(`infrastudio-chat-widget-root-${widgetSlug}`)
  if (host?.parentNode) {
    host.parentNode.removeChild(host)
  }

  const script = document.getElementById(SCRIPT_ID)
  if (script?.parentNode) {
    script.parentNode.removeChild(script)
  }
}

export function HomeChatWidgetLoader({ config }) {
  const pathname = usePathname()

  useEffect(() => {
    if (!config?.widget) {
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
    script.dataset.title = config.title || "Chat"
    script.dataset.theme = config.theme || "dark"
    script.dataset.accent = config.accent || "#2563eb"
    script.dataset.transparent = String(config.transparent !== false)
    document.body.appendChild(script)

    return () => {
      removeHomeWidget(config.widget)
    }
  }, [config, pathname])

  return null
}
