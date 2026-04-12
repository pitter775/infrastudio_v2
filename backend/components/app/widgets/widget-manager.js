"use client"

import { useEffect, useMemo, useState } from "react"
import { Bot, CheckCircle2, Code2, Copy, ExternalLink, Pencil, Plus, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
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

export function WidgetManager({ project }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/widgets`
  const [widgets, setWidgets] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [selectedWidgetId, setSelectedWidgetId] = useState(null)

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

  function startCreate() {
    setForm({
      ...emptyForm,
      name: `${project.name} Chat`,
      slug: slugify(`${project.slug || project.name}-chat`),
    })
    setStatus({ type: "idle", message: "" })
  }

  function startEdit(widget) {
    setForm(widget)
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
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Widgets de chat</h2>
            <p className="text-sm text-zinc-500">Instalacao publica usando {PUBLIC_DOMAIN}.</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Novo widget
        </Button>
      </div>

      {form.name || editing ? (
        <form className="mt-5 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4" onSubmit={saveWidget}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Titulo</span>
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Slug</span>
              <input
                value={form.slug}
                onChange={(event) => updateForm("slug", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                required
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px]">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Dominio permitido</span>
              <input
                value={form.domain}
                onChange={(event) => updateForm("domain", event.target.value)}
                placeholder="https://cliente.com.br"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Tema</span>
              <select
                value={form.theme}
                onChange={(event) => updateForm("theme", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Cor</span>
              <input
                type="color"
                value={form.accent}
                onChange={(event) => updateForm("accent", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px]">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">WhatsApp de continuidade</span>
              <input
                value={form.whatsapp}
                onChange={(event) => updateForm("whatsapp", event.target.value)}
                placeholder="5511999999999"
                className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              />
            </label>
            <label className="flex items-center gap-3 pt-6 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.transparent}
                onChange={(event) => updateForm("transparent", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Fundo transparente
            </label>
            <label className="flex items-center gap-3 pt-6 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateForm("active", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Ativo
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : editing ? "Atualizar widget" : "Criar widget"}
            </Button>
          </div>
        </form>
      ) : null}

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
        {widgets.length ? (
          <div className="divide-y divide-zinc-200">
            {widgets.map((widget) => (
              <div key={widget.id} className="grid gap-3 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_220px]">
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

      {selectedWidget ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Code2 className="h-4 w-4" />
              Snippet recomendado
            </div>
            <pre className="overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
              {buildWidgetSnippet(selectedWidget)}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-950">Compatibilidade</p>
            <p className="mt-1 text-xs text-zinc-600">Snippet alternativo para clientes que usam o contrato antigo.</p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
              {buildCompatSnippet(project, selectedWidget)}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  )
}
