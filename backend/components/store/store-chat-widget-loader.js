'use client'

import { useEffect } from 'react'
import Script from 'next/script'

export function StoreChatWidgetLoader({ config }) {
  const serializedContext =
    config.context && typeof config.context === 'object' ? JSON.stringify(config.context) : undefined
  const scriptId = `store-widget-${config.widgetId || config.widget}`

  useEffect(() => {
    if (!config?.widget && !config?.widgetId) {
      return
    }

    const script = document.getElementById(scriptId)
    if (!script) {
      return
    }

    const syncAttribute = (name, value) => {
      if (value == null || value === '') {
        script.removeAttribute(name)
        return
      }
      script.setAttribute(name, value)
    }

    syncAttribute('data-widget', config.widget)
    syncAttribute('data-widget-id', config.widgetId)
    syncAttribute('data-api-base', config.apiBase)
    syncAttribute('data-projeto', config.projeto)
    syncAttribute('data-agente', config.agente)
    syncAttribute('data-title', config.title)
    syncAttribute('data-theme', config.theme)
    syncAttribute('data-accent', config.accent)
    syncAttribute('data-store-slug', config.storeSlug)
    syncAttribute('data-context', serializedContext)
    syncAttribute(
      'data-transparent',
      typeof config.transparent === 'boolean' ? (config.transparent ? 'true' : 'false') : undefined,
    )

    window.dispatchEvent(
      new CustomEvent('infrastudio-chat:context-sync', {
        detail: {
          widgetId: config.widgetId || null,
          widgetSlug: config.widget || null,
        },
      }),
    )
  }, [
    config.widget,
    config.widgetId,
    config.apiBase,
    config.projeto,
    config.agente,
    config.title,
    config.theme,
    config.accent,
    config.storeSlug,
    config.transparent,
    serializedContext,
    scriptId,
  ])

  if (!config?.widget && !config?.widgetId) {
    return null
  }

  return (
    <Script
      id={scriptId}
      src={config.src || '/chat-widget.js'}
      strategy="afterInteractive"
      data-widget={config.widget}
      data-widget-id={config.widgetId || undefined}
      data-api-base={config.apiBase || undefined}
      data-projeto={config.projeto || undefined}
      data-agente={config.agente || undefined}
      data-title={config.title || undefined}
      data-theme={config.theme || undefined}
      data-accent={config.accent || undefined}
      data-store-slug={config.storeSlug || undefined}
      data-context={serializedContext}
      data-transparent={typeof config.transparent === 'boolean' ? (config.transparent ? 'true' : 'false') : undefined}
    />
  )
}
