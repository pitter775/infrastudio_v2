"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, BookOpen, CheckCircle2, Code2, Copy, ExternalLink, Pencil, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { JsonCodeBlock } from "@/components/ui/json-code-block"
import { ToggleSwitchButton } from "@/components/ui/toggle-switch-button"
import { cn } from "@/lib/utils"

const PUBLIC_DOMAIN = "https://www.infrastudio.pro"

const emptyForm = {
  id: null,
  name: "",
  slug: "",
  domain: "",
  whatsapp: "",
  theme: "dark",
  accent: "#2563eb",
  transparent: true,
  active: true,
}

const inputClassName =
  "mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const labelClassName = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function normalizeWidget(widget) {
  return {
    id: widget.id,
    name: widget.nome,
    slug: widget.slug,
    domain: widget.dominio || "",
    whatsapp: widget.whatsappCelular || "",
    theme: widget.tema || "dark",
    accent: widget.corPrimaria || "#2563eb",
    transparent: widget.fundoTransparente !== false,
    active: widget.ativo !== false,
  }
}

function buildWidgetSnippet(widget) {
  return `<script src="${PUBLIC_DOMAIN}/chat-widget.js" data-widget="${widget.slug}" data-title="${widget.name}" data-theme="${widget.theme}" data-accent="${widget.accent}" data-transparent="${widget.transparent ? "true" : "false"}" defer></script>`
}

function buildCompatSnippet(project, widget) {
  return `<script src="${PUBLIC_DOMAIN}/chat.js" data-projeto="${project.slug || project.id}" data-agente="${project.agent?.slug || project.agent?.id || ""}" data-api-base="${PUBLIC_DOMAIN}" defer></script>`
}

function buildPreviewUrl(project, widget) {
  const params = new URLSearchParams({
    projeto: project.slug || project.id,
    agente: project.agent?.slug || project.agent?.id || "",
    widget: widget.slug,
  })

  return `/widget-contract-test?${params.toString()}`
}

export function WidgetManager({ project, initialWidgetId = null, activeTab: controlledActiveTab, onTabChange, onFooterStateChange, compact = false }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/widgets`
  const [widgets, setWidgets] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [selectedWidgetId, setSelectedWidgetId] = useState(null)
  const [activeTab, setActiveTab] = useState("edit")
  const currentTab = controlledActiveTab || activeTab

  const editing = Boolean(form.id)
  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedWidgetId) || widgets[0] || null,
    [selectedWidgetId, widgets],
  )

  useEffect(() => {
    let active = true

    async function loadWidgets() {
      setLoading(true)
      try {
        const response = await fetch(endpoint)
        const data = await response.json()

        if (active && response.ok) {
          const nextWidgets = (data.widgets || []).map(normalizeWidget)
          setWidgets(nextWidgets)
          setSelectedWidgetId((current) => current || nextWidgets[0]?.id || null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadWidgets()

    return () => {
      active = false
    }
  }, [endpoint])

  useEffect(() => {
    if (!initialWidgetId || !widgets.length) {
      return
    }

    const widget = widgets.find((item) => item.id === initialWidgetId)
    if (widget) {
      setSelectedWidgetId(widget.id)
      startEdit(widget)
    }
  }, [initialWidgetId, widgets])

  useEffect(() => {
    if (!form.id && selectedWidget) {
      setForm(selectedWidget)
    }
  }, [form.id, selectedWidget])

  useEffect(() => {
    onFooterStateChange?.({
      activeTab: currentTab,
      canSave: currentTab === "edit" && Boolean(form.name || editing),
      canCopy: currentTab === "code" && Boolean(selectedWidget),
    })
  }, [currentTab, editing, form.name, onFooterStateChange, selectedWidget])

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value }

      if (field === "name" && !current.id && !current.slug) {
        next.slug = slugify(value)
      }

      if (field === "slug") {
        next.slug = slugify(value)
      }

      return next
    })
  }

  function startEdit(widget) {
    setForm(widget)
    setActiveTab("edit")
    onTabChange?.("edit")
    setStatus({ type: "idle", message: "" })
  }

  function resetForm() {
    setForm(emptyForm)
    setStatus({ type: "idle", message: "" })
  }

  async function saveWidget(event) {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(editing ? `${endpoint}/${form.id}` : endpoint, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: form.name,
          slug: form.slug,
          dominio: form.domain,
          whatsappCelular: form.whatsapp,
          tema: form.theme,
          corPrimaria: form.accent,
          fundoTransparente: form.transparent,
          ativo: form.active,
          agenteId: project.agent?.id || null,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel salvar o widget.")
      }

      const saved = normalizeWidget(data.widget)
      setWidgets((current) =>
        editing ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current],
      )
      setSelectedWidgetId(saved.id)
      setForm(emptyForm)
      setStatus({ type: "success", message: editing ? "Widget atualizado." : "Widget criado." })
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function copySnippet(text) {
    await navigator.clipboard.writeText(text)
    setStatus({ type: "success", message: "Snippet copiado." })
  }

  return (
    <section className={cn("mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", compact && "mt-0 border-0 bg-transparent p-0 text-slate-300 shadow-none")}>
      <div className={cn("flex items-center gap-3", compact && "sr-only")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Chat widget</h2>
            <p className="text-sm text-zinc-500">Instalacao publica usando {PUBLIC_DOMAIN}.</p>
          </div>
        </div>
      </div>

      <div className={cn("mt-5 flex flex-wrap gap-2", compact && "hidden")}>
        {[
          { id: "edit", label: "Editar", icon: Pencil },
          { id: "code", label: "Ver codigo fonte", icon: Code2 },
          { id: "docs", label: "Documentacao", icon: BookOpen },
        ].map((tab) => {
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

      {!selectedWidget && !loading ? (
        <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Nenhum widget padrao encontrado neste projeto.
        </p>
      ) : null}

      {currentTab === "edit" && (form.name || editing) ? (
        <form id="widget-editor-form" className="grid gap-4" onSubmit={saveWidget}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={labelClassName}>Titulo</span>
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className={inputClassName}
                required
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Slug</span>
              <input
                value={form.slug}
                onChange={(event) => updateForm("slug", event.target.value)}
                className={inputClassName}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_160px]">
            <label className="block">
              <span className={labelClassName}>Dominio permitido</span>
              <input
                value={form.domain}
                onChange={(event) => updateForm("domain", event.target.value)}
                placeholder="https://cliente.com.br"
                className={inputClassName}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Tema</span>
              <select
                value={form.theme}
                onChange={(event) => updateForm("theme", event.target.value)}
                className={inputClassName}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClassName}>Cor</span>
              <input
                type="color"
                value={form.accent}
                onChange={(event) => updateForm("accent", event.target.value)}
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-2 py-1"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
            <label className="block">
              <span className={labelClassName}>WhatsApp de continuidade</span>
              <input
                value={form.whatsapp}
                onChange={(event) => updateForm("whatsapp", event.target.value)}
                placeholder="5511999999999"
                className={inputClassName}
              />
            </label>
            <div className="flex items-end">
              <ToggleSwitchButton checked={form.transparent} onChange={(value) => updateForm("transparent", value)} labelOn="Fundo transparente" labelOff="Fundo solido" />
            </div>
            <div className="flex items-end">
              <ToggleSwitchButton checked={form.active} onChange={(value) => updateForm("active", value)} labelOn="Widget ativo" labelOff="Widget inativo" />
            </div>
          </div>

          {!compact ? <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={saving}
              variant="ghost"
              className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Atualizar widget"}
            </Button>
          </div> : null}
        </form>
      ) : null}

      {status.message ? (
        <p
          className={cn(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            status.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200",
          )}
        >
          {status.message}
        </p>
      ) : null}

      {currentTab === "edit" && widgets.length > 1 ? (
      <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
        {widgets.length ? (
          <div className="divide-y divide-zinc-200">
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className={cn(
                  "grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_220px]",
                  initialWidgetId === widget.id && "bg-sky-500/10",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => setSelectedWidgetId(widget.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-zinc-950">{widget.name}</h3>
                    <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                      {widget.slug}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                        widget.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600",
                      )}
                    >
                      {widget.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {widget.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-zinc-500">
                    {widget.domain || "Sem dominio restrito"} · {widget.theme} · {widget.transparent ? "transparente" : "solido"}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => startEdit(widget)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => copySnippet(buildWidgetSnippet(widget))}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-600">
            {loading ? "Carregando widgets..." : "Nenhum widget cadastrado neste projeto."}
          </p>
        )}
      </div>
      ) : null}

      {currentTab === "code" && selectedWidget ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form
            id="widget-copy-form"
            onSubmit={(event) => {
              event.preventDefault()
              copySnippet(buildWidgetSnippet(selectedWidget))
            }}
          />
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Code2 className="h-4 w-4" />
              Snippet recomendado
            </div>
            <JsonCodeBlock value={buildWidgetSnippet(selectedWidget)} />
            {!compact ? <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" className="gap-2" onClick={() => copySnippet(buildWidgetSnippet(selectedWidget))}>
                <Copy className="h-4 w-4" />
                Copiar snippet
              </Button>
              <Button asChild type="button" size="sm" variant="outline" className="gap-2">
                <a href={buildPreviewUrl(project, selectedWidget)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Testar preview
                </a>
              </Button>
            </div> : null}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Compatibilidade</p>
            <p className="mt-1 text-xs text-zinc-600">Snippet alternativo para clientes que usam o contrato antigo.</p>
            <JsonCodeBlock value={buildCompatSnippet(project, selectedWidget)} className="mt-3 max-h-40 overflow-y-auto" />
          </div>
        </div>
      ) : null}

      {currentTab === "docs" ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["1. Publique o script", "Use o codigo fonte no site do cliente."],
            ["2. Domínio", "Restrinja por domínio quando precisar controlar origem."],
            ["3. Continuidade", "Configure WhatsApp para seguir o atendimento fora do site."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
