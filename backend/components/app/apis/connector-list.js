"use client"

import { useEffect, useState } from "react"
import { Cable, CheckCircle2, ShoppingBag, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

function isMercadoLivre(connector) {
  const value = `${connector.slug || ""} ${connector.type || ""} ${connector.name || ""}`.toLowerCase()
  return value.includes("mercado") || value.includes("ml")
}

export function ConnectorList({ project }) {
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadConnectors() {
      setLoading(true)
      try {
        const response = await fetch(`/api/app/projetos/${project.slug || project.id}/conectores`)
        const data = await response.json()

        if (active && response.ok) {
          setConnectors(data.connectors || [])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadConnectors()

    return () => {
      active = false
    }
  }, [project.id, project.slug])

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Cable className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Conectores</h2>
          <p className="text-sm text-zinc-500">Integrações estruturadas vinculadas ao projeto.</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
        {connectors.length ? (
          <div className="divide-y divide-zinc-200">
            {connectors.map((connector) => {
              const MercadoIcon = isMercadoLivre(connector) ? ShoppingBag : Cable

              return (
                <div key={connector.id} className="grid gap-3 p-4 text-sm md:grid-cols-[minmax(0,1fr)_120px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <MercadoIcon className="h-4 w-4 text-zinc-500" />
                      <h3 className="font-semibold text-zinc-950">{connector.name}</h3>
                      <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                        {connector.type}
                      </span>
                    </div>
                    {connector.endpointBase ? (
                      <p className="mt-1 truncate text-zinc-600">{connector.endpointBase}</p>
                    ) : null}
                    {isMercadoLivre(connector) ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Mercado Livre mapeado no novo padrao de conectores.
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-fit w-fit items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium md:justify-self-end",
                      connector.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600",
                    )}
                  >
                    {connector.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {connector.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-600">
            {loading ? "Carregando conectores..." : "Nenhum conector cadastrado neste projeto."}
          </p>
        )}
      </div>
    </section>
  )
}
