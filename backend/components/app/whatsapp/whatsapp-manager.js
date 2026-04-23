"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, MessageCircle, Pencil, Plus, Power, QrCode, RotateCcw, Trash2, Users, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ToggleSwitchButton } from "@/components/ui/toggle-switch-button"
import { cn } from "@/lib/utils"

const inputClassName =
  "mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const labelClassName = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
const QR_PENDING_TIMEOUT_MS = 40000
const QR_POLL_INTERVAL_IDLE_MS = 4500
const QR_POLL_INTERVAL_ACTIVE_MS = 1500

function normalizeConnectionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase()

  if (["online", "conectado", "connected", "ready", "ativo"].includes(normalized)) {
    return "online"
  }

  if (["offline", "desconectado"].includes(normalized)) {
    return "offline"
  }

  return normalized || "desconectado"
}

function isConnectedChannel(value) {
  return normalizeConnectionStatus(value) === "online"
}

function isQrFlowLockedForChannel({ channelId, pendingChannelId, pendingQrExpiresAt, qrSnapshotChannelId, connectionStatus }) {
  if (!channelId || !pendingChannelId || pendingChannelId !== channelId || !pendingQrExpiresAt) {
    return false
  }

  if (isConnectedChannel(connectionStatus)) {
    return false
  }

  if (qrSnapshotChannelId && qrSnapshotChannelId !== channelId) {
    return false
  }

  return true
}

function getQrPollDelay({ hasQrCode = false, hasSeenQr = false, connectionStatus = "" }) {
  const normalizedStatus = normalizeConnectionStatus(connectionStatus)

  if (hasQrCode || (hasSeenQr && normalizedStatus === "connecting")) {
    return QR_POLL_INTERVAL_ACTIVE_MS
  }

  if (normalizedStatus === "aguardando_qr" || normalizedStatus === "reconnecting") {
    return QR_POLL_INTERVAL_IDLE_MS
  }

  return QR_POLL_INTERVAL_IDLE_MS
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 13)
}

function formatWhatsappPhone(value) {
  const digits = normalizePhoneDigits(value)

  if (!digits) {
    return ""
  }

  const hasBrazilCountryCode = digits.startsWith("55")
  const country = hasBrazilCountryCode ? "55" : ""
  const localDigits = hasBrazilCountryCode ? digits.slice(2) : digits
  const areaCode = localDigits.slice(0, 2)
  const subscriber = localDigits.slice(2)
  const prefixLength = subscriber.length > 8 ? 5 : 4
  const prefix = subscriber.slice(0, prefixLength)
  const suffix = subscriber.slice(prefixLength, prefixLength + 4)

  let formatted = country ? `+${country}` : ""
  if (areaCode) {
    formatted += `${formatted ? " " : ""}(${areaCode}`
    if (areaCode.length === 2) {
      formatted += ")"
    }
  }
  if (prefix) {
    formatted += `${areaCode ? " " : ""}${prefix}`
  }
  if (suffix) {
    formatted += `-${suffix}`
  }

  return formatted.trim()
}

function sanitizeWorkerUiMessage(value) {
  const message = String(value || "").trim()
  if (!message) {
    return ""
  }

  const normalized = message.toLowerCase()

  if (
    normalized.includes("failed to launch the browser process") ||
    normalized.includes("zygote could not fork") ||
    normalized.includes("resource temporarily unavailable") ||
    normalized.includes("failed to connect to the bus") ||
    normalized.includes("pthread_create") ||
    normalized.includes("crashpad") ||
    normalized.includes("/sys/devices/system/cpu")
  ) {
    return "O worker do WhatsApp ficou sem recursos para abrir a sessao. Tente conectar novamente em alguns instantes."
  }

  if (normalized.includes("profile appears to be in use") || normalized.includes("chromium has locked the profile")) {
    return "A sessao do WhatsApp esta temporariamente bloqueada por outro processo. Tente novamente em alguns instantes."
  }

  return message
}

export function WhatsAppManager({ project, initialChannelId = null, activeTab: controlledActiveTab, onTabChange, onFooterStateChange, onStatsChange, compact = false }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/whatsapp`
  const contactsEndpoint = `${endpoint}/handoff-contatos`
  const emptyContactForm = { id: null, nome: "", numero: "", papel: "", observacoes: "", ativo: true, receberAlertas: true }
  const [activeTab, setActiveTab] = useState("connect")
  const currentTab = controlledActiveTab && ["connect", "attendants"].includes(controlledActiveTab) ? controlledActiveTab : activeTab
  const [channels, setChannels] = useState([])
  const [contacts, setContacts] = useState([])
  const [number, setNumber] = useState("")
  const [contactForm, setContactForm] = useState(emptyContactForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [qrSnapshot, setQrSnapshot] = useState(null)
  const [pendingChannelId, setPendingChannelId] = useState(null)
  const [pendingQrExpiresAt, setPendingQrExpiresAt] = useState(null)
  const [pendingQrNow, setPendingQrNow] = useState(Date.now())
  const [hasSeenQr, setHasSeenQr] = useState(false)
  const [connectionHint, setConnectionHint] = useState("")
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [deleteContactTarget, setDeleteContactTarget] = useState(null)
  const [deleteChannelTarget, setDeleteChannelTarget] = useState(null)
  const connectedChannels = channels.filter((channel) => isConnectedChannel(channel.connectionStatus))
  const activeAlertContacts = contacts.filter((contact) => contact.ativo !== false && contact.receberAlertas !== false)
  const primaryConnectedChannel = connectedChannels[0] || channels[0] || null
  const shouldWarnMissingAttendant = connectedChannels.length > 0 && activeAlertContacts.length === 0

  async function loadChannels(options = {}) {
    if (!options.silent) {
      setLoading(true)
    }

    try {
      const response = await fetch(endpoint)
      const data = await response.json()

      if (response.ok) {
        const nextChannels = data.channels || []
        setChannels(nextChannels)
        return nextChannels
      }
    } finally {
      if (!options.silent) {
        setLoading(false)
      }
    }

    return []
  }

  async function loadContacts() {
    try {
      const response = await fetch(contactsEndpoint)
      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setContacts(data.contacts || [])
      }
    } catch {}
  }

  useEffect(() => {
    loadChannels()
    loadContacts()
  }, [endpoint, contactsEndpoint])

  useEffect(() => {
    if (!pendingChannelId) {
      return
    }

    let active = true
    let timeoutId = null

    async function syncPendingChannel() {
      let currentChannel = null
      let snapshot = null
      let nextPollDelay = QR_POLL_INTERVAL_IDLE_MS
      const nextChannels = await loadChannels({ silent: true })
      if (!active) {
        return
      }

      currentChannel = nextChannels.find((channel) => channel.id === pendingChannelId)
      if (!currentChannel) {
        setPendingChannelId(null)
        setPendingQrExpiresAt(null)
        setQrSnapshot(null)
        setHasSeenQr(false)
        setConnectionHint("")
        return
      }

      if (pendingQrExpiresAt && Date.now() >= pendingQrExpiresAt) {
        setPendingChannelId(null)
        setPendingQrExpiresAt(null)
        setQrSnapshot(null)
        setHasSeenQr(false)
        setConnectionHint("")
        setStatus({ type: "error", message: "Tempo do QR esgotado. Gere novamente se precisar." })
        return
      }

      try {
        const response = await fetch(`${endpoint}/${pendingChannelId}/qr`)
        const data = await response.json().catch(() => ({}))
        snapshot = data.snapshot || null

        if (!active) {
          return
        }

        if (isConnectedChannel(currentChannel.connectionStatus) || isConnectedChannel(snapshot?.status)) {
          setQrSnapshot(null)
          setPendingChannelId(null)
          setPendingQrExpiresAt(null)
          setHasSeenQr(false)
          setConnectionHint("")
          setStatus({ type: "success", message: "WhatsApp conectado com sucesso." })
          return
        }

        if (snapshot?.qrCodeDataUrl) {
          setQrSnapshot(snapshot)
          setHasSeenQr(true)
          setConnectionHint("QR pronto. Escaneie com o WhatsApp do dispositivo antes do tempo acabar.")
          nextPollDelay = getQrPollDelay({
            hasQrCode: true,
            hasSeenQr: true,
            connectionStatus: snapshot?.status || currentChannel.connectionStatus,
          })
        } else if (hasSeenQr && (currentChannel.connectionStatus === "connecting" || snapshot?.status === "connecting")) {
          setQrSnapshot(snapshot)
          setConnectionHint("QR lido. Aguardando confirmacao do dispositivo e estabilizacao da conexao.")
          nextPollDelay = getQrPollDelay({
            hasQrCode: false,
            hasSeenQr,
            connectionStatus: snapshot?.status || currentChannel.connectionStatus,
          })
        } else if (currentChannel.connectionStatus === "reconnecting" || snapshot?.status === "reconnecting") {
          setQrSnapshot(snapshot)
          setConnectionHint("Conexao perdida. O worker esta tentando reconectar automaticamente.")
          nextPollDelay = getQrPollDelay({
            hasQrCode: false,
            hasSeenQr,
            connectionStatus: snapshot?.status || currentChannel.connectionStatus,
          })
        } else if (currentChannel.connectionStatus === "aguardando_qr") {
          setQrSnapshot(snapshot)
          setConnectionHint("Aguardando o QR ser gerado pelo worker.")
          nextPollDelay = getQrPollDelay({
            hasQrCode: false,
            hasSeenQr,
            connectionStatus: currentChannel.connectionStatus,
          })
        } else if (currentChannel.connectionStatus === "connecting") {
          setQrSnapshot(snapshot)
          setConnectionHint("Conectando o dispositivo. Aguarde alguns instantes.")
          nextPollDelay = getQrPollDelay({
            hasQrCode: false,
            hasSeenQr,
            connectionStatus: currentChannel.connectionStatus,
          })
        } else {
          setQrSnapshot(snapshot)
          nextPollDelay = getQrPollDelay({
            hasQrCode: Boolean(snapshot?.qrCodeDataUrl),
            hasSeenQr,
            connectionStatus: snapshot?.status || currentChannel.connectionStatus,
          })
        }
      } catch {}

      if (!active) {
        return
      }

      timeoutId = window.setTimeout(syncPendingChannel, nextPollDelay)
    }

    syncPendingChannel()

    return () => {
      active = false
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [endpoint, hasSeenQr, pendingChannelId, pendingQrExpiresAt])

  useEffect(() => {
    if (!pendingQrExpiresAt) {
      return
    }

    setPendingQrNow(Date.now())
    const ticker = window.setInterval(() => {
      setPendingQrNow(Date.now())
    }, 1000)
    const timeout = window.setTimeout(() => {
      finalizePendingConnectionCheck(pendingChannelId)
        .then((connected) => {
          if (connected) {
            return
          }

          setPendingChannelId(null)
          setPendingQrExpiresAt(null)
          setQrSnapshot(null)
          setHasSeenQr(false)
          setConnectionHint("")
          setStatus({ type: "error", message: "Tempo do QR esgotado. Gere novamente se precisar." })
        })
        .catch(() => {
          setPendingChannelId(null)
          setPendingQrExpiresAt(null)
          setQrSnapshot(null)
          setHasSeenQr(false)
          setConnectionHint("")
          setStatus({ type: "error", message: "Tempo do QR esgotado. Gere novamente se precisar." })
        })
    }, Math.max(0, pendingQrExpiresAt - Date.now()))

    return () => {
      window.clearInterval(ticker)
      window.clearTimeout(timeout)
    }
  }, [pendingChannelId, pendingQrExpiresAt])

  useEffect(() => {
    if (!qrSnapshot?.channelId) {
      return
    }

    const channel = channels.find((item) => item.id === qrSnapshot.channelId)
    if (isConnectedChannel(channel?.connectionStatus)) {
      setQrSnapshot(null)
      setPendingChannelId(null)
      setPendingQrExpiresAt(null)
      setHasSeenQr(false)
      setConnectionHint("")
    }
  }, [channels, qrSnapshot])

  useEffect(() => {
    onFooterStateChange?.({
      activeTab: currentTab,
      hasChannel: channels.length > 0,
      canSaveContact: currentTab === "attendants",
      savingContact,
    })
  }, [channels.length, currentTab, onFooterStateChange, savingContact])

  useEffect(() => {
    onStatsChange?.({ whatsapp: channels.length })
  }, [channels.length, onStatsChange])

  async function finalizePendingConnectionCheck(channelId) {
    if (!channelId) {
      return false
    }

    const nextChannels = await loadChannels({ silent: true })
    const currentChannel = nextChannels.find((channel) => channel.id === channelId)

    if (isConnectedChannel(currentChannel?.connectionStatus)) {
      setPendingChannelId(null)
      setPendingQrExpiresAt(null)
      setQrSnapshot(null)
      setHasSeenQr(false)
      setConnectionHint("")
      setStatus({ type: "success", message: "WhatsApp conectado com sucesso." })
      return true
    }

    try {
      const response = await fetch(`${endpoint}/${channelId}/qr`)
      const data = await response.json().catch(() => ({}))
      const snapshot = data.snapshot || null

      if (isConnectedChannel(snapshot?.status)) {
        setPendingChannelId(null)
        setPendingQrExpiresAt(null)
        setQrSnapshot(null)
        setHasSeenQr(false)
        setConnectionHint("")
        setStatus({ type: "success", message: "WhatsApp conectado com sucesso." })
        return true
      }

      if (snapshot?.qrCodeDataUrl) {
        setQrSnapshot(snapshot)
      }
    } catch {}

    return false
  }

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
          numero: normalizePhoneDigits(number),
          agenteId: project.agent?.id || null,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel criar o canal.")
      }

      setChannels(data.channel ? [data.channel] : [])
      if (data.contact) {
        setContacts((current) => [data.contact, ...current.filter((item) => item.id !== data.contact.id)])
      }
      setNumber("")
      setStatus({
        type: "success",
        message: data.contact ? "Canal criado com atendente automatico." : "Canal criado.",
      })
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setSaving(false)
    }
  }

  async function runAction(channel, action) {
    setBusyId(channel.id)
    setStatus({ type: "idle", message: "" })

    if (action === "disconnect") {
      setPendingChannelId(null)
      setPendingQrExpiresAt(null)
      setQrSnapshot(null)
      setHasSeenQr(false)
      setConnectionHint("")
    } else {
      setPendingChannelId(channel.id)
      setPendingQrExpiresAt(Date.now() + QR_PENDING_TIMEOUT_MS)
      setHasSeenQr(false)
      setConnectionHint(action === "connect" ? "Solicitando conexao ao worker. Aguarde o QR." : "Atualizando QR Code do dispositivo.")
    }

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
        if (data.snapshot?.qrCodeDataUrl) {
          setHasSeenQr(true)
          setConnectionHint("QR pronto. Escaneie com o WhatsApp do dispositivo antes do tempo acabar.")
        }
      } else {
        setQrSnapshot(data.snapshot)
        setStatus({
          type: "success",
          message: action === "connect" ? "Conexao solicitada ao worker." : "Desconexao solicitada.",
        })
        if (action === "connect" && data.snapshot?.qrCodeDataUrl) {
          setHasSeenQr(true)
          setConnectionHint("QR pronto. Escaneie com o WhatsApp do dispositivo antes do tempo acabar.")
        }
      }

      await loadChannels({ silent: true })
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setBusyId(null)
    }
  }

  async function refreshChannel(channel) {
    setBusyId(channel.id)
    setStatus({ type: "idle", message: "" })

    try {
      await runAction(channel, "qr")
      await loadChannels({ silent: true })
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setBusyId(null)
    }
  }

  function updateContactForm(field, value) {
    setContactForm((current) => ({ ...current, [field]: value }))
  }

  function editContact(contact) {
    setContactForm({
      id: contact.id,
      nome: contact.nome || "",
      numero: formatWhatsappPhone(contact.numero || ""),
      papel: contact.papel || "",
      observacoes: contact.observacoes || "",
      ativo: contact.ativo !== false,
      receberAlertas: contact.receberAlertas !== false,
    })
    setStatus({ type: "idle", message: "" })
  }

  function applyConnectedChannelAsAttendant() {
    if (!primaryConnectedChannel?.number) {
      return
    }

    setContactForm((current) => ({
      ...current,
      numero: formatWhatsappPhone(primaryConnectedChannel.number),
      nome: current.nome || "Meu WhatsApp",
      receberAlertas: true,
      ativo: true,
    }))
    setStatus({ type: "idle", message: "" })
  }

  async function saveContact(event) {
    event.preventDefault()
    setSavingContact(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(contactsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...contactForm,
          numero: normalizePhoneDigits(contactForm.numero),
          canalWhatsappId: primaryConnectedChannel?.id || null,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel salvar o atendente.")
      }

      setContacts((current) =>
        contactForm.id ? current.map((item) => (item.id === data.contact.id ? data.contact : item)) : [data.contact, ...current],
      )
      setContactForm(emptyContactForm)
      setStatus({ type: "success", message: contactForm.id ? "Atendente atualizado." : "Atendente criado." })
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setSavingContact(false)
    }
  }

  async function deleteContact(contact) {
    setBusyId(contact.id)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(contactsEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "delete", contactId: contact.id }),
      })

      if (!response.ok) {
        throw new Error("Nao foi possivel remover o atendente.")
      }

      setContacts((current) => current.filter((item) => item.id !== contact.id))
      setStatus({ type: "success", message: "Atendente removido." })
      setDeleteContactTarget(null)
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setBusyId(null)
    }
  }

  async function deleteChannel(channel) {
    setBusyId(channel.id)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/${channel.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Nao foi possivel remover o WhatsApp.")
      setChannels((current) => current.filter((item) => item.id !== channel.id))
      setQrSnapshot(null)
      setStatus({ type: "success", message: "WhatsApp removido." })
      setDeleteChannelTarget(null)
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setBusyId(null)
    }
  }

  async function updateChannel(channelId, patch, successMessage) {
    setBusyId(channelId)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/${channelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.channel) {
        throw new Error(data.error || "Nao foi possivel atualizar o canal.")
      }

      setChannels((current) => current.map((item) => (item.id === data.channel.id ? data.channel : item)))
      setStatus({ type: "success", message: successMessage })
    } catch (error) {
      setStatus({ type: "error", message: sanitizeWorkerUiMessage(error.message) })
    } finally {
      setBusyId(null)
    }
  }

  const tabs = [
    { id: "connect", label: "Conectar", icon: QrCode },
    { id: "attendants", label: "Atendentes", icon: Users },
  ]
  const pendingQrSeconds = pendingQrExpiresAt ? Math.max(0, Math.ceil((pendingQrExpiresAt - pendingQrNow) / 1000)) : 0

  return (
    <section className={cn("mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", compact && "mt-0 border-0 bg-transparent p-0 text-slate-300 shadow-none")}>
      <div className={cn("flex items-center gap-3", compact && "sr-only")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-950">WhatsApp</h2>
          <p className="text-sm text-zinc-500">Canais conectados ao worker externo.</p>
        </div>
      </div>

      <div className={cn("mt-5 flex flex-wrap gap-2", compact && "hidden")}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
                onTabChange?.(tab.id)
              }}
              className={cn(
                "infra-tab-motion inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                active
                  ? "border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-[6px_6px_0_rgba(8,15,38,0.16)]"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {status.message ? (
        <p
          className={cn(
            "mt-4 rounded-xl border px-3 py-2 text-sm",
            status.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200",
          )}
        >
          {status.message}
        </p>
      ) : null}

      {currentTab !== "attendants" ? (
        <>
      {loading ? (
      <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
        <RotateCcw className="h-3.5 w-3.5 animate-spin" />
        Verificando cadastro
      </div>
      ) : null}
      {!loading && channels.length === 0 ? (
      <form id="whatsapp-channel-form" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]" onSubmit={createChannel}>
        <label className="block">
          <span className={labelClassName}>Numero</span>
          <input
            value={number}
            placeholder="+55 (11) 99999-9999"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            onChange={(event) => setNumber(formatWhatsappPhone(event.target.value))}
            className={inputClassName}
            required
          />
        </label>
        <Button
          type="submit"
          disabled={saving}
          variant="ghost"
          className="mt-6 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {saving ? "Criando canal..." : "Criar canal"}
        </Button>
      </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
        {channels.length ? (
          <div className="divide-y divide-zinc-200">
            {shouldWarnMissingAttendant ? (
              <div className="border-b border-amber-400/15 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-100">Canal conectado sem atendente</p>
                    <p className="mt-1 text-sm text-amber-100/90">
                      O agente pode oferecer atendimento humano, mas ainda nao existe nenhum atendente configurado para receber esse chamado.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-3 h-8 rounded-lg border border-amber-300/20 bg-amber-500/10 px-3 text-amber-50 hover:bg-amber-500/20"
                      onClick={() => {
                        setActiveTab("attendants")
                        onTabChange?.("attendants")
                        applyConnectedChannelAsAttendant()
                      }}
                    >
                      Configurar atendente
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {channels.map((channel) => {
              const normalizedStatus = normalizeConnectionStatus(channel.connectionStatus)
              const online = normalizedStatus === "online"
              const reconnecting = normalizedStatus === "reconnecting"
              const transitional = reconnecting || normalizedStatus === "connecting" || normalizedStatus === "aguardando_qr"
              const qrFlowLocked = isQrFlowLockedForChannel({
                channelId: channel.id,
                pendingChannelId,
                pendingQrExpiresAt,
                qrSnapshotChannelId: qrSnapshot?.channelId || null,
                connectionStatus: channel.connectionStatus,
              })

              return (
                <div
                  key={channel.id}
                  className={cn(
                    "grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_320px]",
                    online && "bg-emerald-500/10",
                    reconnecting && "bg-amber-500/10",
                    initialChannelId === channel.id && "bg-sky-500/10",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{formatWhatsappPhone(channel.number)}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                          online
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                            : reconnecting
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                              : transitional
                                ? "border-sky-500/20 bg-sky-500/10 text-sky-200"
                                : "border-white/10 bg-white/[0.03] text-slate-400",
                        )}
                      >
                        {online ? <CheckCircle2 className="h-3 w-3" /> : reconnecting ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        {normalizedStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500">{channel.notes || "Sem observacao do worker."}</p>
                    <div className="mt-3">
                      <ToggleSwitchButton
                        checked={channel.onlyReplyToUnsavedContacts === true}
                        disabled={busyId === channel.id || qrFlowLocked}
                        labelOn="Não responder contatos salvos"
                        labelOff="Responder incluindo contatos salvos"
                        onChange={(nextValue) =>
                          updateChannel(
                            channel.id,
                            { onlyReplyToUnsavedContacts: nextValue },
                            nextValue
                              ? "Resposta limitada a contatos nao salvos."
                              : "Resposta liberada para todos os contatos.",
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1.5 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
                      onClick={() => refreshChannel(channel)}
                      disabled={busyId === channel.id || qrFlowLocked}
                    >
                      <RotateCcw className={cn("h-3.5 w-3.5", busyId === channel.id && "animate-spin")} />
                      Atualizar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-2 border border-sky-500/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
                      onClick={() => runAction(channel, "connect")}
                      disabled={busyId === channel.id || online || qrFlowLocked}
                    >
                      {busyId === channel.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                      {online ? "Conectado" : "Conectar"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => runAction(channel, "qr")} disabled={busyId === channel.id || online || qrFlowLocked}>
                      <QrCode className="h-4 w-4" />
                      Gerar QR
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => runAction(channel, "disconnect")} disabled={busyId === channel.id || qrFlowLocked}>
                      <RotateCcw className="h-4 w-4" />
                      Desconectar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="gap-2 text-red-200" onClick={() => setDeleteChannelTarget(channel)} disabled={busyId === channel.id || qrFlowLocked}>
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-400">
            {loading ? "Carregando canais..." : "Nenhum canal WhatsApp cadastrado neste projeto."}
          </p>
        )}
      </div>

      {qrSnapshot ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">QR Code</p>
              <p className="mt-1 text-xs text-slate-500">Status: {qrSnapshot.status || "desconhecido"}</p>
            </div>
            {pendingQrExpiresAt ? (
              <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200">
                Expira em {pendingQrSeconds}s
              </span>
            ) : null}
          </div>
          {connectionHint ? <p className="mt-2 text-sm text-amber-200">{connectionHint}</p> : null}
          {pendingQrExpiresAt ? <p className="mt-2 text-xs text-slate-400">Acoes do canal ficam bloqueadas ate o QR concluir ou expirar.</p> : null}
          {qrSnapshot.qrCodeDataUrl ? (
            <img src={qrSnapshot.qrCodeDataUrl} alt="QR Code do WhatsApp" className="mt-3 h-56 w-56 rounded-lg border border-zinc-200 bg-white p-2" />
          ) : (
            <p className="mt-3 text-sm text-slate-400">QR indisponivel. Use o botao Gerar QR quando precisar de um novo codigo.</p>
          )}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">Fluxo rapido</p>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          <p>1. Crie o canal com o numero oficial.</p>
          <p>2. Clique em conectar e aguarde o pareamento iniciar.</p>
          <p>3. Depois que o QR for lido, aguarde a confirmacao do dispositivo.</p>
          <p>4. Quando conectar, o status vira conectado e o QR some automaticamente.</p>
        </div>
      </div>
        </>
      ) : null}

      {currentTab === "attendants" ? (
        <div>
          <form id="whatsapp-contact-form" className="grid gap-4 md:grid-cols-2" onSubmit={saveContact}>
            <label className="block">
              <span className={labelClassName}>Nome</span>
              <input
                value={contactForm.nome}
                onChange={(event) => updateContactForm("nome", event.target.value)}
                placeholder="Nome do atendente"
                className={inputClassName}
                required
              />
            </label>
            <label className="block">
              <span className={labelClassName}>WhatsApp</span>
              <input
                value={contactForm.numero}
                onChange={(event) => updateContactForm("numero", formatWhatsappPhone(event.target.value))}
                placeholder="+55 (11) 99999-9999"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                className={inputClassName}
                required
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Papel</span>
              <input
                value={contactForm.papel}
                onChange={(event) => updateContactForm("papel", event.target.value)}
                placeholder="Vendas, suporte, plantao"
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Observacoes</span>
              <input
                value={contactForm.observacoes}
                onChange={(event) => updateContactForm("observacoes", event.target.value)}
                placeholder="Horario, regra ou area"
                className={inputClassName}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <ToggleSwitchButton
                checked={contactForm.receberAlertas}
                onChange={(value) => updateContactForm("receberAlertas", value)}
                labelOn="Recebe alertas"
                labelOff="Sem alertas"
              />
              {primaryConnectedChannel?.number ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-200"
                  onClick={applyConnectedChannelAsAttendant}
                >
                  Usar numero conectado
                </Button>
              ) : null}
              {!compact ? <Button
                type="submit"
                disabled={savingContact}
                variant="ghost"
                className="ml-auto h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingContact ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {savingContact ? "Salvando..." : contactForm.id ? "Atualizar atendente" : "Adicionar atendente"}
              </Button> : null}
            </div>
          </form>

          {shouldWarnMissingAttendant ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Nenhum atendente esta configurado para receber alerta humano deste projeto. Se quiser, voce pode usar o mesmo numero do canal conectado.
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            {contacts.length ? (
              <div className="divide-y divide-zinc-200">
                {contacts.map((contact) => (
                  <div key={contact.id} className="grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{contact.nome}</h3>
                        <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-slate-400">
                          {contact.receberAlertas && contact.ativo ? "Recebe alertas" : "Pausado"}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-500">{formatWhatsappPhone(contact.numero)} {contact.papel ? `- ${contact.papel}` : ""}</p>
                      {contact.observacoes ? <p className="mt-1 text-xs text-slate-500">{contact.observacoes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Button type="button" size="sm" variant="ghost" className="gap-2 border border-sky-500/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20" onClick={() => editContact(contact)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => setDeleteContactTarget(contact)} disabled={busyId === contact.id}>
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-400">Nenhum atendente cadastrado para aviso humano.</p>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteContactTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteContactTarget(null)
          }
        }}
        title="Remover atendente"
        description={deleteContactTarget ? `O atendente ${deleteContactTarget.nome} sera removido da lista.` : ""}
        confirmLabel="Remover atendente"
        danger
        loading={busyId === deleteContactTarget?.id}
        onConfirm={() => deleteContactTarget ? deleteContact(deleteContactTarget) : null}
      />

      <ConfirmDialog
        open={Boolean(deleteChannelTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteChannelTarget(null)
          }
        }}
        title="Remover canal do WhatsApp"
        description={deleteChannelTarget ? `O canal ${formatWhatsappPhone(deleteChannelTarget.number)} sera removido.` : ""}
        confirmLabel="Remover canal"
        danger
        loading={busyId === deleteChannelTarget?.id}
        onConfirm={() => deleteChannelTarget ? deleteChannel(deleteChannelTarget) : null}
      />
    </section>
  )
}
