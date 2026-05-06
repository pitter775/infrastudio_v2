"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"

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
    if (!config?.widget) {
      return undefined
    }

    if (pathname !== "/") {
      removeHomeWidget(config.widget)
      return undefined
    }

    return () => {
      removeHomeWidget(config.widget)
    }
  }, [config?.widget, pathname])

  if (pathname !== "/" || !config?.widget) {
    return null
  }

  return (
    <Script
      id={SCRIPT_ID}
      src={config.src || "https://www.infrastudio.pro/chat-widget.js"}
      strategy="afterInteractive"
      data-widget={config.widget}
      data-api-base={config.apiBase || undefined}
      data-projeto={config.projeto || undefined}
      data-agente={config.agente || undefined}
    />
  )
}
