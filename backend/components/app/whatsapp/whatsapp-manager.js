"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, MessageCircle, Plus, Power, QrCode, RotateCcw, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function WhatsAppManager({ project }) {
  const endpoint = `/api/app/projetos/${project.slug || project.id}/whatsapp`
  const [channels, setChannels] = useState([])
  const [number, setNumber] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [qrSnapshot, setQrSnapshot] = useState(null)
  const [status, setStatus] = useState({ type: "idle", message: "" })

  async function loadChannels() {
    setLoading(true)
    try {
      const response = await fetch(endpoint)
      const data = await response.json()

      if (response.ok) {
        setChannels(data.channels || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [endpoint])

  async function createChannel(event) {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numero: number,
          agenteId: project.agent?.id || null,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel criar o canal.")
      }

      setChannels((current) => [data.channel, ...current])
      setNumber("")
      setStatus({ type: "success", message: "Canal criado." })
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function runAction(channel, action) {
    setBusyId(channel.id)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/${channel.id}/${action}`, {
        method: action === "qr" ? "GET" : "POST",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Falha ao chamar o worker.")
      }

      if (action === "qr") {
        setQrSnapshot(data.snapshot)
      } else {
        setQrSnapshot(data.snapshot)
        setStatus({
          type: "success",
          message: action === "connect" ? "Conexao solicitada ao worker." : "Desconexao solicitada.",
        })
      }

      await loadChannels()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-950">WhatsApp</h2>
          <p className="text-sm text-zinc-500">Canais conectados ao worker externo.</p>
        </div>
      </div>

      <form className="mt-5 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[minmax(0,1fr)_150px]" onSubmit={createChannel}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Numero</span>
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="5511999999999"
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
            required
          />
        </label>
        <Button type="submit" disabled={saving} className="mt-6 gap-2">
          <Plus className="h-4 w-4" />
          {saving ? "Criando..." : "Criar canal"}
        </Button>
      </form>

      {status.message ? (
        <p
          className={cn(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {status.message}
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
        {channels.length ? (
          <div className="divide-y divide-zinc-200">
            {channels.map((channel) => {
              const online = channel.connectionStatus === "online"

              return (
                <div key={channel.id} className="grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-950">{channel.number}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                          online
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600",
                        )}
                      >
                        {online ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {channel.connectionStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-500">{channel.notes || "Sem observacao do worker."}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => runAction(channel, "connect")} disabled={busyId === channel.id}>
                      <Power className="h-4 w-4" />
                      Conectar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => runAction(channel, "qr")} disabled={busyId === channel.id}>
                      <QrCode className="h-4 w-4" />
                      QR
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => runAction(channel, "disconnect")} disabled={busyId === channel.id}>
                      <RotateCcw className="h-4 w-4" />
                      Desconectar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-600">
            {loading ? "Carregando canais..." : "Nenhum canal WhatsApp cadastrado neste projeto."}
          </p>
        )}
      </div>

      {qrSnapshot ? (
        <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-zinc-950">QR Code</p>
          <p className="mt-1 text-xs text-zinc-600">Status: {qrSnapshot.status || "desconhecido"}</p>
          {qrSnapshot.qrCodeDataUrl ? (
            <img src={qrSnapshot.qrCodeDataUrl} alt="QR Code do WhatsApp" className="mt-3 h-56 w-56 rounded-lg border border-zinc-200 bg-white p-2" />
          ) : (
            <p className="mt-3 text-sm text-zinc-600">QR indisponivel. Clique em conectar e aguarde o worker gerar o QR.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
