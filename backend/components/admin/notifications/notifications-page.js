"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Bell, CreditCard, LoaderCircle, MessageSquareQuote, MessageSquareText, RefreshCcw } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const iconByKind = {
  attendance: MessageSquareText,
  feedback: MessageSquareQuote,
  billing: CreditCard,
}

export function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState({ attendance: 0, feedback: 0, notifications: 0 })
  const [items, setItems] = useState([])

  async function markItemsAsRead(nextItems) {
    if (!Array.isArray(nextItems) || !nextItems.length) {
      return
    }

    const response = await fetch("/api/admin/avisos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: nextItems.map((item) => ({
          kind: item.kind,
          href: item.href,
          readKey: item.readKey,
        })),
      }),
    }).catch(() => null)

    if (response?.ok) {
      window.dispatchEvent(new CustomEvent("admin-notifications-refresh"))
    }
  }

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch("/api/admin/avisos", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel carregar os avisos.")
      }

      setSummary(data.summary ?? { attendance: 0, feedback: 0, notifications: 0 })
      const nextItems = data.items ?? []
      setItems(nextItems)
      void markItemsAsRead(nextItems)
    } catch (loadError) {
      setError(loadError.message || "Nao foi possivel carregar os avisos.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  return (
    <div className="min-h-0">
      <AdminPageHeader
        title="Avisos"
        description="Historico consolidado de atendimento, solicitações e billing."
        actions={
          <Button
            type="button"
            variant="ghost"
            className="gap-2 text-slate-300 hover:bg-white/[0.04] hover:text-white"
            onClick={() => void loadItems()}
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Atendimento", summary.attendance],
          ["Solicitações", summary.feedback],
          ["Total", summary.notifications],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#0d1424] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0d1424]">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando avisos...
          </div>
        ) : error ? (
          <div className="px-4 py-5 text-sm text-rose-200">{error}</div>
        ) : items.length ? (
          <div className="divide-y divide-white/5">
            {items.map((item) => {
              const Icon = iconByKind[item.kind] || Bell

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    void markItemsAsRead([item])
                  }}
                  className="flex items-start gap-3 px-4 py-4 transition hover:bg-white/[0.03]"
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                      <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">
                        {item.count}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-slate-500">Nenhum aviso pendente no momento.</div>
        )}
      </div>
    </div>
  )
}
