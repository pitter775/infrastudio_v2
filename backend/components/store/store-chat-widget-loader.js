'use client'

import Script from 'next/script'

export function StoreChatWidgetLoader({ config }) {
  if (!config?.widget && !config?.widgetId) {
    return null
  }

  return (
    <Script
      id={`store-widget-${config.widgetId || config.widget}`}
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
      data-transparent={typeof config.transparent === 'boolean' ? (config.transparent ? 'true' : 'false') : undefined}
    />
  )
}
