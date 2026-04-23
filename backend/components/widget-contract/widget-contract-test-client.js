"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ExternalLink, Loader2, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DEFAULTS = {
  projeto: "nexo",
  agente: "agente-imovel",
  widget: "nexo_leiloes",
}

function removeScript(id) {
  document.getElementById(id)?.remove()
}

function destroyInfraChat() {
  if (window.InfraChatWidget?.destroyAll) {
    window.InfraChatWidget.destroyAll()
    return
  }

  if (window.InfraChat?.destroy) {
    window.InfraChat.destroy()
  }
}

function appendScript(input) {
  removeScript(input.id)

  const script = document.createElement("script")
  script.id = input.id
  script.src = input.src
  script.async = true

  for (const [name, value] of Object.entries(input.dataset ?? {})) {
    if (value) {
      script.setAttribute(name, value)
    }
  }

  document.body.appendChild(script)
}

export function WidgetContractTestClient() {
  const [projeto, setProjeto] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULTS.projeto
    }

    return new URLSearchParams(window.location.search).get("projeto") || DEFAULTS.projeto
  })
  const [agente, setAgente] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULTS.agente
    }

    return new URLSearchParams(window.location.search).get("agente") || DEFAULTS.agente
  })
  const [widget, setWidget] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULTS.widget
    }

    return new URLSearchParams(window.location.search).get("widget") || DEFAULTS.widget
  })
  const [loaded, setLoaded] = useState(null)
  const [loading, setLoading] = useState(false)

  const apiBase = useMemo(() => {
    if (typeof window === "undefined") {
      return ""
    }

    return window.location.origin
  }, [])

  function reset() {
    destroyInfraChat()
    removeScript("widget-contract-chat-js")
    removeScript("widget-contract-chat-widget-js")
    setLoaded(null)
  }

  function loadModernWidget() {
    setLoading(true)
    reset()
    appendScript({
      id: "widget-contract-chat-js",
      src: `${window.location.origin}/chat.js`,
      dataset: {
        "data-projeto": projeto,
        "data-agente": agente,
        "data-api-base": window.location.origin,
      },
    })
    window.setTimeout(() => {
      setLoaded("chat.js")
      setLoading(false)
    }, 500)
  }

  function loadLegacyWidget() {
    setLoading(true)
    reset()
    appendScript({
      id: "widget-contract-chat-widget-js",
      src: `${window.location.origin}/chat-widget.js`,
      dataset: {
        "data-widget": widget,
        "data-api-base": window.location.origin,
        "data-title": "InfraStudio",
      },
    })
    window.setTimeout(() => {
      setLoaded("chat-widget.js")
      setLoading(false)
    }, 500)
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <h2 className="text-lg font-semibold">Teste interativo</h2>
          <p className="mt-1 text-sm text-slate-300">
            Carrega os scripts publicos do proprio host atual e envia para o `/api/chat` do v2.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Projeto</span>
            <input
              value={projeto}
              onChange={(event) => setProjeto(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Agente</span>
            <input
              value={agente}
              onChange={(event) => setAgente(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-300">Widget</span>
            <input
              value={widget}
              onChange={(event) => setWidget(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={loadModernWidget} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            Carregar chat.js
          </Button>
          <Button onClick={loadLegacyWidget} disabled={loading} variant="outline">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            Carregar chat-widget.js
          </Button>
          <Button onClick={reset} variant="ghost">
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpar
          </Button>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            loaded
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-slate-700 bg-slate-950 text-slate-300"
          )}
        >
          {loaded ? <CheckCircle2 className="h-4 w-4" /> : null}
          {loaded ? `${loaded} carregado em ${apiBase}` : "Nenhum script carregado nesta pagina."}
        </div>
      </section>
    </div>
  )
}
