"use client"

import { useEffect, useState } from "react"
import { BookOpen, CheckCircle2, MessageCircle, Pencil, Plus, Power, QrCode, RotateCcw, Trash2, Users, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleSwitchButton } from "@/components/ui/toggle-switch-button"
import { cn } from "@/lib/utils"

const inputClassName =
  "mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const labelClassName = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"

export function WhatsAppManager({ project, initialChannelId = null, activeTab: controlledActiveTab, onTabChange, onFooterStateChange, compact = false }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/whatsapp`
  const contactsEndpoint = `${endpoint}/handoff-contatos`
  const emptyContactForm = { id: null, nome: "", numero: "", papel: "", observacoes: "", ativo: true, receberAlertas: true }
  const [activeTab, setActiveTab] = useState("connect")
  const currentTab = controlledActiveTab || activeTab
  const [channels, setChannels] = useState([])
  const [contacts, setContacts] = useState([])
  const [number, setNumber] = useState("")
  const [contactForm, setContactForm] = useState(emptyContactForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
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
    if (initialChannelId) {
      onTabChange?.("connect")
      setActiveTab("connect")
    }
  }, [initialChannelId, onTabChange])

  useEffect(() => {
    onFooterStateChange?.({
      activeTab: currentTab,
      hasChannel: channels.length > 0,
      canSaveContact: currentTab === "attendants",
    })
  }, [channels.length, currentTab, onFooterStateChange])

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

  function updateContactForm(field, value) {
    setContactForm((current) => ({ ...current, [field]: value }))
  }

  function editContact(contact) {
    setContactForm({
      id: contact.id,
      nome: contact.nome || "",
      numero: contact.numero || "",
      papel: contact.papel || "",
      observacoes: contact.observacoes || "",
      ativo: contact.ativo !== false,
      receberAlertas: contact.receberAlertas !== false,
    })
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
          canalWhatsappId: channels[0]?.id || null,
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
      setStatus({ type: "error", message: error.message })
    } finally {
      setSavingContact(false)
    }
  }

  async function deleteContact(contact) {
    const confirmed = window.confirm("Remover este atendente?")
    if (!confirmed) {
      return
    }

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
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setBusyId(null)
    }
  }

  async function deleteChannel(channel) {
    const confirmed = window.confirm("Remover este WhatsApp?")
    if (!confirmed) return

    setBusyId(channel.id)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/${channel.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Nao foi possivel remover o WhatsApp.")
      setChannels((current) => current.filter((item) => item.id !== channel.id))
      setQrSnapshot(null)
      setStatus({ type: "success", message: "WhatsApp removido." })
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setBusyId(null)
    }
  }

  const tabs = [
    { id: "connect", label: "Conectar", icon: QrCode },
    { id: "attendants", label: "Atendentes", icon: Users },
    { id: "tutorial", label: "Tutorial", icon: BookOpen },
  ]

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
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
                active
                  ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
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

      {currentTab === "connect" ? (
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
            onChange={(event) => setNumber(event.target.value)}
            placeholder="5511999999999"
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
          <Plus className="h-4 w-4" />
          {saving ? "Criando..." : "Criar canal"}
        </Button>
      </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
        {channels.length ? (
          <div className="divide-y divide-zinc-200">
            {channels.map((channel) => {
              const online = channel.connectionStatus === "online"

              return (
                <div
                  key={channel.id}
                  className={cn(
                    "grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_320px]",
                    initialChannelId === channel.id && "bg-sky-500/10",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{channel.number}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                          online
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.03] text-slate-400",
                        )}
                      >
                        {online ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {channel.connectionStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500">{channel.notes || "Sem observacao do worker."}</p>
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
                    <Button type="button" size="sm" variant="ghost" className="gap-2 text-red-200" onClick={() => deleteChannel(channel)} disabled={busyId === channel.id}>
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
          <p className="text-sm font-semibold text-white">QR Code</p>
          <p className="mt-1 text-xs text-slate-500">Status: {qrSnapshot.status || "desconhecido"}</p>
          {qrSnapshot.qrCodeDataUrl ? (
            <img src={qrSnapshot.qrCodeDataUrl} alt="QR Code do WhatsApp" className="mt-3 h-56 w-56 rounded-lg border border-zinc-200 bg-white p-2" />
          ) : (
            <p className="mt-3 text-sm text-slate-400">QR indisponivel. Clique em conectar e aguarde o worker gerar o QR.</p>
          )}
        </div>
      ) : null}
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
                onChange={(event) => updateContactForm("numero", event.target.value)}
                placeholder="5511999999999"
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
              {!compact ? <Button
                type="submit"
                disabled={savingContact}
                variant="ghost"
                className="ml-auto h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {savingContact ? "Salvando..." : contactForm.id ? "Atualizar atendente" : "Adicionar atendente"}
              </Button> : null}
            </div>
          </form>

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
                      <p className="mt-1 text-slate-500">{contact.numero} {contact.papel ? `- ${contact.papel}` : ""}</p>
                      {contact.observacoes ? <p className="mt-1 text-xs text-slate-500">{contact.observacoes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => editContact(contact)}>
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => deleteContact(contact)} disabled={busyId === contact.id}>
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

      {currentTab === "tutorial" ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1. Crie o canal", "Cadastre o numero oficial que ficara conectado ao worker."],
            ["2. Leia o QR", "Clique em Conectar e escaneie o QR com o WhatsApp correto."],
            ["3. Cadastre atendentes", "Adicione quem deve receber aviso quando houver pedido de humano."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
