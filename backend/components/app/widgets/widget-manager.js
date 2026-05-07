"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, BookOpen, CheckCircle2, Code2, Copy, ExternalLink, LoaderCircle, Pencil, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AppSelect } from "@/components/ui/app-select"
import { JsonCodeBlock } from "@/components/ui/json-code-block"
import { ToggleSwitchButton } from "@/components/ui/toggle-switch-button"
import { cn } from "@/lib/utils"

const PUBLIC_DOMAIN = "https://www.infrastudio.pro"

const emptyForm = {
  id: null,
  name: "",
  slug: "",
  domain: "",
  theme: "dark",
  accent: "#2563eb",
  transparent: true,
  identificationBoxEnabled: false,
  active: true,
}

const inputClassName =
  "mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const labelClassName = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
const compactCardClassName = "rounded-[22px] border border-white/10 bg-[#0a1020] p-4"

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
    theme: widget.tema || "dark",
    accent: widget.corPrimaria || "#2563eb",
    transparent: widget.fundoTransparente !== false,
    identificationBoxEnabled: widget.identificacaoContatoAtiva === true,
    active: widget.ativo !== false,
  }
}

function buildWidgetSnippet(project, widget) {
  return [
    "<!-- Cole este script antes de fechar o </body> da página -->",
    `<script`,
    `  src="${PUBLIC_DOMAIN}/chat-widget.js"`,
    `  data-widget="${widget.slug}"`,
    `  data-agente="${project.agent?.slug || project.agent?.id || ""}"`,
    `  defer`,
    `></script>`,
  ].join("\n")
}

function buildWidgetContextSnippet(project, widget) {
  return [
    "<!-- Use data-context quando a página já tiver o ID do imóvel, produto, pedido ou outro recurso -->",
    `<script`,
    `  src="${PUBLIC_DOMAIN}/chat-widget.js"`,
    `  data-widget="${widget.slug}"`,
    `  data-agente="${project.agent?.slug || project.agent?.id || ""}"`,
    `  data-context='{"propertyId":"c47ae17f-ddbe-4c59-96b9-30e6d12c5ff2","id":"c47ae17f-ddbe-4c59-96b9-30e6d12c5ff2"}'`,
    `  defer`,
    `></script>`,
  ].join("\n")
}

function buildCompatSnippet(project, widget) {
  return [
    "<!-- Cole este fallback no mesmo ponto quando precisar do contrato legado -->",
    `<script`,
    `  src="${PUBLIC_DOMAIN}/chat.js"`,
    `  data-projeto="${project.slug || project.id}"`,
    `  data-agente="${project.agent?.slug || project.agent?.id || ""}"`,
    `  data-widget="${widget.slug}"`,
    `  data-api-base="${PUBLIC_DOMAIN}"`,
    `  defer`,
    `></script>`,
  ].join("\n")
}

function buildPreviewUrl(project, widget) {
  const params = new URLSearchParams({
    projeto: project.slug || project.id,
    agente: project.agent?.slug || project.agent?.id || "",
    widget: widget.slug,
  })

  return `/widget-contract-test?${params.toString()}`
}

function buildWidgetLlmGuidePrompt({ project, widget }) {
  return [
    "Contrato da aba Chat widget do InfraStudio.",
    "Use este contrato como fonte de verdade para orientar dúvidas sobre instalação, comportamento, contexto, segurança e uso do Chat widget.",
    "Não invente opções fora deste contrato. Se faltar algum dado, peça exatamente o dado que falta. Responda em português do Brasil.",
    "",
    "Objetivo do Chat widget:",
    "- Publicar o chat do agente em sites externos, lojas, páginas públicas, áreas logadas e páginas com recurso específico.",
    "- Levar para o agente o contexto correto da página quando o sistema externo souber qual item, imóvel, produto, pedido, cliente ou cadastro está aberto.",
    "- Permitir atendimento aberto na home pública e atendimento travado em um item atual quando existir data-context.",
    "",
    "Abas do painel:",
    "- Editar: configura título, slug, domínio permitido, tema, cor, fundo, identificação e status ativo.",
    "- Ver código fonte: mostra o snippet recomendado, exemplo com data-context e fallback de compatibilidade.",
    "- Documentação: explica contrato de instalação, contexto, políticas de exibição, atualização e este botão de cópia para LLM.",
    "",
    "Campos de configuração:",
    "- Título: nome interno do widget no InfraStudio.",
    "- Slug: identificador público usado no script data-widget. Deve ser estável depois de instalado no site.",
    "- Domínio permitido: restringe onde o widget pode rodar. Use o domínio real do cliente, por exemplo https://cliente.com.br.",
    "- Tema: define visual dark ou light.",
    "- Cor: cor primária do widget.",
    "- Fundo transparente: deixa o widget integrado ao fundo do site.",
    "- Identificação ativa: habilita caixa de identificação do contato quando o fluxo precisa capturar nome, telefone ou dados do visitante.",
    "- Widget ativo: permite ou bloqueia uso público do widget.",
    "",
    "Snippet recomendado:",
    buildWidgetSnippet(project, widget || { slug: "meu-widget" }),
    "",
    "Snippet com contexto de recurso específico:",
    buildWidgetContextSnippet(project, widget || { slug: "meu-widget" }),
    "",
    "Contrato do data-context:",
    "- data-context deve ser JSON válido em string.",
    "- Use id quando houver um identificador principal do recurso atual.",
    "- Use propertyId quando a página representa um imóvel e as APIs do agente usam propertyId ou {id}.",
    "- Use resource para detalhar tipo e id do item atual, por exemplo { id, tipo: 'imovel' }.",
    "- Use tenant quando o sistema externo tiver contexto de cliente, conta ou organização.",
    "- Use user quando a página já souber o usuário logado ou visitante identificado.",
    "- Use route para enviar caminho, origem ou seção da página atual.",
    "- Não envie dados sensíveis, tokens, senhas, cookies, CPF completo ou dados privados desnecessários.",
    "",
    "Política de uso por cenário:",
    "- Home pública: instale sem data-context específico ou com contexto genérico da rota. O agente pode usar APIs de busca aberta, catálogo e FAQ.",
    "- Página de item/imóvel/produto: instale com data-context contendo id/propertyId/resource. O agente deve usar APIs de item atual ou consulta por identificador.",
    "- Área logada: use data-context com user e tenant apenas se esses dados forem necessários para atendimento.",
    "- Checkout, pedido ou suporte: use resource com tipo pedido, compra, protocolo ou atendimento quando o agente tiver API compatível.",
    "",
    "Política de relação com APIs do agente:",
    "- APIs de busca aberta funcionam melhor quando o visitante pergunta por nome, título, bairro, cidade, categoria ou termo.",
    "- APIs de item atual funcionam melhor quando o widget envia id ou propertyId no data-context.",
    "- Se a API usa URL com {id}, o contexto precisa ter id ou campo equivalente mapeável.",
    "- Se a API usa query como ?titulo={titulo}, o agente precisa extrair o termo da mensagem do visitante.",
    "- Evite ter duas APIs com intenção parecida e descrições fracas, porque o agente pode escolher a errada.",
    "",
    "Controle de host e exibição:",
    "- O widget só deve existir em hosts permitidos.",
    "- Fora do host, rota ou política autorizada, a ação correta é não montar ou destruir o widget.",
    "- Use allowedRoutes/policy no host externo quando precisar bloquear rotas específicas.",
    "- hide() e show({ open: true }) escondem e reabrem a mesma sessão autorizada.",
    "- updateContext() deve ser usado quando só mudou o recurso na mesma tela.",
    "- destroy() seguido de mount() limpo é preferível quando muda tenant, agente, usuário, permissão ou perfil.",
    "",
    "Boas práticas de instalação:",
    "- Cole o script antes de fechar o </body>.",
    "- Use defer.",
    "- Mantenha data-widget e data-agente exatamente como gerados pelo InfraStudio.",
    "- Não duplique o script na mesma página.",
    "- Em SPAs, atualize contexto ao trocar item sem reload.",
    "- Teste em página real e no preview antes de entregar ao cliente.",
    "",
    "Erros comuns:",
    "- Slug do widget diferente do cadastrado.",
    "- Domínio permitido incompatível com o domínio real.",
    "- JSON inválido em data-context.",
    "- Enviar propertyId na home pública sem ter item atual.",
    "- Instalar widget de outro projeto ou outro agente.",
    "- Alterar slug depois que o script já está publicado.",
    "- Esperar que API de item atual funcione sem id/propertyId no contexto.",
    "",
    "Estado atual no InfraStudio:",
    JSON.stringify(
      {
        projeto: {
          id: project?.id || null,
          nome: project?.name || project?.nome || project?.title || null,
          slug: project?.slug || null,
          routeKey: project?.routeKey || null,
        },
        agente: {
          id: project?.agent?.id || null,
          slug: project?.agent?.slug || null,
          nome: project?.agent?.name || project?.agent?.nome || null,
        },
        widget: widget
          ? {
              id: widget.id || null,
              titulo: widget.name || null,
              slug: widget.slug || null,
              dominioPermitido: widget.domain || null,
              tema: widget.theme || null,
              corPrimaria: widget.accent || null,
              fundoTransparente: Boolean(widget.transparent),
              identificacaoAtiva: Boolean(widget.identificationBoxEnabled),
              ativo: widget.active !== false,
            }
          : null,
      },
      null,
      2,
    ),
    "",
    "Como orientar o usuário:",
    "- Se ele quer chat aberto na home, orientar instalação simples sem item atual.",
    "- Se ele quer chat travado em imóvel/produto/pedido, orientar instalação com data-context do recurso atual.",
    "- Se o agente não encontra dados, revisar APIs vinculadas, descrição para decisão da IA e contexto enviado pelo widget.",
    "- Se o widget não aparece, revisar domínio permitido, slug, agente, status ativo e console do navegador.",
  ].join("\n")
}

export function WidgetManager({ project, initialWidgetId = null, activeTab: controlledActiveTab, onTabChange, onFooterStateChange, onStatsChange, compact = false }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/widgets`
  const initialWidgets = useMemo(
    () => (project.chatWidgets || []).map(normalizeWidget),
    [project.chatWidgets],
  )
  const [widgets, setWidgets] = useState(initialWidgets)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(initialWidgets.length === 0)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [selectedWidgetId, setSelectedWidgetId] = useState(initialWidgetId || initialWidgets[0]?.id || null)
  const [activeTab, setActiveTab] = useState("edit")
  const currentTab = controlledActiveTab || activeTab

  const editing = Boolean(form.id)
  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedWidgetId) || widgets[0] || null,
    [selectedWidgetId, widgets],
  )

  const loadWidgets = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(endpoint)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível carregar os widgets.")
      }

      const nextWidgets = (data.widgets || []).map(normalizeWidget)
      setWidgets(nextWidgets)
      setSelectedWidgetId((current) => current || nextWidgets[0]?.id || null)
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    setWidgets(initialWidgets)
    setSelectedWidgetId(initialWidgetId || initialWidgets[0]?.id || null)
    setLoading(initialWidgets.length === 0)
  }, [initialWidgetId, initialWidgets])

  useEffect(() => {
    let active = true

    if (initialWidgets.length > 0) {
      return () => {
        active = false
      }
    }

    ;(async () => {
      await loadWidgets()
      if (!active) {
        return
      }
    })()

    return () => {
      active = false
    }
  }, [initialWidgets.length, loadWidgets])

  const startEdit = useCallback((widget) => {
    setForm(widget)
    setActiveTab("edit")
    onTabChange?.("edit")
    setStatus({ type: "idle", message: "" })
  }, [onTabChange])

  useEffect(() => {
    if (!initialWidgetId || !widgets.length) {
      return
    }

    const widget = widgets.find((item) => item.id === initialWidgetId)
    if (widget) {
      setSelectedWidgetId(widget.id)
      startEdit(widget)
    }
  }, [initialWidgetId, startEdit, widgets])

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
      saving,
    })
  }, [currentTab, editing, form.name, onFooterStateChange, saving, selectedWidget])

  useEffect(() => {
    onStatsChange?.({ chatWidget: widgets.filter((widget) => widget.active !== false).length })
  }, [widgets, onStatsChange])

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
          tema: form.theme,
          corPrimaria: form.accent,
          fundoTransparente: form.transparent,
          identificacaoContatoAtiva: form.identificationBoxEnabled,
          ativo: form.active,
          agenteId: project.agent?.id || null,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar o widget.")
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

  async function copyWidgetGuideForLlm() {
    const prompt = buildWidgetLlmGuidePrompt({ project, widget: selectedWidget || form || null })

    try {
      await navigator.clipboard.writeText(prompt)
      setStatus({ type: "success", message: "Contrato do Chat widget copiado para LLM." })
    } catch {
      try {
        const textarea = document.createElement("textarea")
        textarea.value = prompt
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        setStatus({ type: "success", message: "Contrato do Chat widget copiado para LLM." })
      } catch {
        setStatus({ type: "error", message: "Não foi possível copiar o contrato do Chat widget." })
      }
    }
  }

  return (
    <section className={cn("mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm", compact && "mt-0 border-0 bg-transparent p-0 text-slate-300 shadow-none")}>
      {compact && loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm text-slate-300">
            <LoaderCircle className="h-4 w-4 animate-spin text-sky-300" />
            Carregando widget...
          </div>
        </div>
      ) : null}

      <div className={cn("flex items-center gap-3", compact && "sr-only")}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Chat widget</h2>
        <p className="text-sm text-zinc-500">Instalação pública usando {PUBLIC_DOMAIN}.</p>
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

      {!selectedWidget && !loading ? (
        <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Nenhum widget padrão encontrado neste projeto.
        </p>
      ) : null}

      {!loading && currentTab === "edit" && (form.name || editing) ? (
        <form id="widget-editor-form" className={cn("grid gap-4", compact && "pt-1")} onSubmit={saveWidget}>
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

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="block md:col-span-2">
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
              <div className="mt-1">
                <AppSelect
                  value={form.theme}
                  onChangeValue={(value) => updateForm("theme", value)}
                  options={[
                    { value: "dark", label: "Dark" },
                    { value: "light", label: "Light" },
                  ]}
                />
              </div>
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

          <div className="grid gap-3 pt-1 md:grid-cols-[220px_220px_180px]">
            <div className="flex items-end">
              <ToggleSwitchButton checked={form.transparent} onChange={(value) => updateForm("transparent", value)} labelOn="Fundo transparente" labelOff="Fundo sólido" />
            </div>
            <div className="flex items-end">
              <ToggleSwitchButton checked={form.identificationBoxEnabled} onChange={(value) => updateForm("identificationBoxEnabled", value)} labelOn="Identificação ativa" labelOff="Identificação inativa" />
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

      {false ? (
      <div className={cn("mt-6 overflow-hidden rounded-[24px] border", compact ? "border-white/10 bg-[#0a1020]" : "border-zinc-200")}>
        {widgets.length ? (
          <div className={cn("divide-y", compact ? "divide-white/10" : "divide-zinc-200")}>
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className={cn(
                  "grid gap-4 p-4 text-sm xl:grid-cols-[minmax(0,1fr)_220px]",
                  initialWidgetId === widget.id && "bg-sky-500/10",
                  selectedWidgetId === widget.id && compact && "bg-sky-500/[0.07]",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => setSelectedWidgetId(widget.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn("font-semibold", compact ? "text-white" : "text-zinc-950")}>{widget.name}</h3>
                    <span className={cn("rounded-full border px-2.5 py-1 text-[11px]", compact ? "border-slate-700 bg-slate-900 text-slate-200" : "border-zinc-200 bg-zinc-50 text-zinc-600")}>
                      {widget.slug}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        widget.active
                          ? compact
                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : compact
                            ? "border-slate-700 bg-slate-900 text-slate-400"
                            : "border-zinc-200 bg-zinc-50 text-zinc-600",
                      )}
                    >
                      {widget.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {widget.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-zinc-500">
                    {widget.domain || "Sem domínio restrito"} · {widget.theme} · {widget.transparent ? "transparente" : "sólido"}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("gap-2", compact && "border-slate-700 bg-slate-950 text-slate-200 hover:border-sky-400/25 hover:bg-sky-500/10 hover:text-sky-100")}
                    onClick={() => startEdit(widget)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("gap-2", compact && "border border-slate-700 bg-slate-950 text-slate-200 hover:border-sky-400/25 hover:bg-sky-500/10 hover:text-sky-100")}
                    onClick={() => copySnippet(buildWidgetSnippet(project, widget))}
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

      {!loading && currentTab === "code" && selectedWidget ? (
        <div className="mt-5 grid gap-5">
          <form
            id="widget-copy-form"
            onSubmit={(event) => {
              event.preventDefault()
              copySnippet(buildWidgetSnippet(project, selectedWidget))
            }}
          />
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Code2 className="h-4 w-4 text-sky-300" />
                Snippet recomendado
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg px-3 text-xs" onClick={() => copySnippet(buildWidgetSnippet(project, selectedWidget))}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar
                </Button>
                {!compact ? (
                  <Button asChild type="button" size="sm" variant="outline" className="h-8 rounded-lg px-3 text-xs">
                    <a href={buildPreviewUrl(project, selectedWidget)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Preview
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <JsonCodeBlock
              value={buildWidgetSnippet(project, selectedWidget)}
              className="rounded-xl border-white/10 bg-transparent p-0"
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-white">Exemplo com contexto da página</div>
            <JsonCodeBlock
              value={buildWidgetContextSnippet(project, selectedWidget)}
              className="rounded-xl border-white/10 bg-transparent p-0"
            />
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Troque o UUID pelo identificador real renderizado na página. APIs cadastradas com URL como
              {" "}<code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">/api/imoveis/{"{id}"}</code>{" "}
              podem usar esse contexto para consultar o recurso certo.
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-white">Compatibilidade</div>
            <JsonCodeBlock
              value={buildCompatSnippet(project, selectedWidget)}
              className="rounded-xl border-white/10 bg-transparent p-0"
            />
          </div>
        </div>
      ) : null}

      {!loading && currentTab === "docs" ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-2">
            <div>
              <div className="text-sm font-semibold text-white">Documentação do Chat widget</div>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Funcionamento, opções de uso, contexto da página e instalação em sites externos.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={copyWidgetGuideForLlm}
              className="h-9 shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copiar para LLM (GPT)
            </Button>
          </div>
          {[
            ["1. Host no controle", "O chat só deve existir quando o host permitir. Fora do contexto autorizado, a ação esperada é destroy()."],
            ["2. Mount mínimo", "No mount inicial use projeto, agente, apiBase e strictHostControl: true."],
            ["3. Contexto certo", "Envie data-context com tenant, user, resource, route, id ou propertyId apenas quando esses dados existirem de verdade."],
            ["4. Recurso específico", "O agente pode iniciar focado em um recurso do sistema usando data-context, como { propertyId: 'uuid-do-imovel', id: 'uuid-do-imovel' }. Quando o agente já tem uma API configurada com {id} na URL, esse contexto permite buscar ou filtrar os dados certos para atender apenas aquele imóvel, produto, pedido ou cadastro."],
            ["5. Política de exibição", "Use policy e allowedRoutes para bloquear o widget fora das rotas e cenários permitidos."],
            ["6. Atualização segura", "Se só mudou o recurso na mesma tela, use updateContext(). Se mudou tenant, agente ou perfil, prefira destroy() e mount() limpo."],
            ["7. Sessão visível ou oculta", "hide() e show({ open: true }) servem para esconder e reabrir a mesma sessão autorizada sem destruir tudo."],
          ].map(([title, text], index) => (
            <div key={title} className="flex items-start gap-3 border-b border-white/5 pb-3 text-sm">
              <p className="shrink-0 font-semibold text-white">{index + 1}. {String(title).replace(/^\d+\.\s*/, "")}</p>
              <p className="leading-6 text-slate-400">{text}</p>
            </div>
          ))}
          <div className="pt-2">
            <div className="mb-2 text-sm font-semibold text-white">Exemplo HTML com API do agente</div>
            <JsonCodeBlock
              value={buildWidgetContextSnippet(project, selectedWidget || { slug: "meu-widget" })}
              className="rounded-xl border-white/10 bg-transparent p-0"
            />
          </div>
          <div className="pt-2">
            <div className="mb-2 text-sm font-semibold text-white">Exemplo dinâmico com API do agente</div>
            <JsonCodeBlock
              value={[
                "const propertyId = 'c47ae17f-ddbe-4c59-96b9-30e6d12c5ff2'",
                "",
                "const script = document.createElement('script')",
                `script.src = '${PUBLIC_DOMAIN}/chat-widget.js'`,
                `script.dataset.widget = '${selectedWidget?.slug || "meu-widget"}'`,
                `script.dataset.agente = '${project.agent?.slug || project.agent?.id || "meu-agente"}'`,
                "script.dataset.context = JSON.stringify({",
                "  id: propertyId,",
                "  propertyId,",
                "  tenant: { id: 'cliente_001' },",
                "  user: { id: 'usuario_789', nome: 'Maria' },",
                "  resource: { id: propertyId, tipo: 'imovel' },",
                "  route: { path: window.location.pathname },",
                "})",
                "",
                "document.body.appendChild(script)",
              ].join("\n")}
              className="rounded-xl border-white/10 bg-transparent p-0"
            />
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Use esse formato quando o sistema externo já sabe qual entidade está aberta e a API vinculada ao agente
              consegue carregar os dados a partir desse identificador.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
