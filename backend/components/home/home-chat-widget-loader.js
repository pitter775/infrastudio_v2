"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const SCRIPT_ID = "infrastudio-home-chat-widget-script"

function removeHomeWidget() {
  if (window.InfraChat?.destroy) {
    window.InfraChat.destroy()
  }

  const host = document.getElementById("infrastudio-chat-root")
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
    if (!config?.widget || !config?.projeto || !config?.agente) {
      return undefined
    }

    if (pathname !== "/") {
      removeHomeWidget()
      return undefined
    }

    removeHomeWidget()

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = "/chat.js"
    script.defer = true
    script.dataset.projeto = config.projeto
    script.dataset.agente = config.agente
    script.dataset.widget = config.widget
    script.dataset.apiBase = window.location.origin
    document.body.appendChild(script)

    return () => {
      removeHomeWidget()
    }
  }, [config, pathname])

  return null
}
