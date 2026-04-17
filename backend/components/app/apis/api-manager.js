"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Code2, FlaskConical, History, Pencil, PlugZap, Plus, RotateCcw, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { JsonCodeBlock } from "@/components/ui/json-code-block"
import { ToggleSwitchButton } from "@/components/ui/toggle-switch-button"
import { cn } from "@/lib/utils"

const pricingApiConfigTemplate = {
  http: {
    headers: {
      "x-api-key": "SUBSTITUA_PELO_TOKEN",
    },
  },
  runtime: {
    factual: true,
    cacheTtlSeconds: 300,
    responsePath: "data",
    previewPath: "summary",
    fields: [
      {
        nome: "site_institucional_valor",
        tipo: "string",
        descricao: "Faixa de valor do site institucional",
        path: "precos.site_institucional.faixa",
      },
      {
        nome: "site_institucional_prazo",
        tipo: "string",
        descricao: "Prazo medio do site institucional",
        path: "precos.site_institucional.prazo",
      },
      {
        nome: "chat_widget_valor",
        tipo: "string",
        descricao: "Preco do chat widget com IA",
        path: "precos.chat_widget.faixa",
      },
      {
        nome: "chat_widget_observacao",
        tipo: "string",
        descricao: "Observacao comercial do chat widget",
        path: "precos.chat_widget.observacao",
      },
      {
        nome: "sistema_ia_valor",
        tipo: "string",
        descricao: "Faixa de valor de sistema com IA",
        path: "precos.sistema_ia.faixa",
      },
      {
        nome: "sistema_ia_prazo",
        tipo: "string",
        descricao: "Prazo medio de sistema com IA",
        path: "precos.sistema_ia.prazo",
      },
    ],
  },
}

const pricingApiResponseExample = {
  data: {
    summary: "Sites a partir de R$300. Widget de IA a partir de R$50 de adesao + R$20/mes.",
    precos: {
      site_institucional: {
        faixa: "R$300 a R$1000",
        prazo: "3 a 7 dias",
      },
      chat_widget: {
        faixa: "R$50 de adesao + R$20/mes",
        observacao: "Instalacao em poucos minutos",
      },
      sistema_ia: {
        faixa: "R$500 a R$2000",
        prazo: "Sob escopo",
      },
    },
  },
}

const pricingApiConfigTemplateText = JSON.stringify(pricingApiConfigTemplate, null, 2)
const pricingApiResponseExampleText = JSON.stringify(pricingApiResponseExample, null, 2)

const emptyForm = {
  id: null,
  name: "",
  url: "",
  description: "",
  active: true,
  method: "GET",
  configText: "{}",
}

const inputClassName =
  "mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const textareaClassName =
  "mt-1 w-full resize-y rounded-xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const labelClassName = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"

function parseObjectText(value, fallback = {}) {
  try {
    const parsed = JSON.parse(String(value || "").trim() || "{}")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function setNestedValue(target, path, value) {
  const segments = String(path || "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (!segments.length) {
    return target
  }

  let current = target
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }

    if (!current[segment] || typeof current[segment] !== "object" || Array.isArray(current[segment])) {
      current[segment] = {}
    }

    current = current[segment]
  })

  return target
}

function getApiConfigFromForm(form) {
  return parseObjectText(form?.configText, {})
}

function stringifyJson(value, fallback = "{}") {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return fallback
  }
}

function buildLockedTestContext(project) {
  const widget = Array.isArray(project?.chatWidgets) ? project.chatWidgets.find((item) => item?.slug) : null
  return {
    projeto: {
      id: project?.id || "",
      slug: project?.slug || project?.routeKey || "",
      nome: project?.name || "",
    },
    agente: {
      id: project?.agent?.id || "",
      nome: project?.agent?.name || "",
    },
    widget: {
      id: widget?.id || "",
      slug: widget?.slug || "",
      nome: widget?.nome || "",
    },
    lead: {
      nome: "Lead de teste",
      email: "lead.teste@infrastudio.local",
      telefone: "11999999999",
    },
    memoria: {
      resumo: "Teste manual disparado pelo painel do projeto.",
    },
    agenda: {
      horarioId: "",
      horarioReservado: "",
    },
  }
}

function getApiTestFields({ api, form }) {
  const sourceApi = api || null
  const url = String(sourceApi?.url || form?.url || "").trim()
  const config = sourceApi?.config || getApiConfigFromForm(form)
  const fields = new Map()
  const configuredParameters = Array.isArray(config?.parametros) ? config.parametros : []
  const bodyTemplate =
    config?.http?.body == null
      ? ""
      : typeof config.http.body === "string"
        ? config.http.body
        : JSON.stringify(config.http.body)

  for (const match of url.matchAll(/\{([^{}]+)\}/g)) {
    const name = String(match[1] || "").trim()
    if (!name) continue
    const configured = configuredParameters.find(
      (item) => String(item?.nome || item?.name || "").trim() === name
    )
    const path = String(configured?.path || configured?.contextPath || configured?.source || name).trim()
    fields.set(path, {
      key: path,
      label: name,
      path,
      source: "url",
      description: configured?.descricao || configured?.description || `Parametro ${name}`,
    })
  }

  for (const match of bodyTemplate.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const path = String(match[1] || "").trim()
    if (!path) continue
    if (!fields.has(path)) {
      fields.set(path, {
        key: path,
        label: path.split(".").slice(-1)[0],
        path,
        source: "body",
        description: `Campo ${path} usado no body`,
      })
    }
  }

  return Array.from(fields.values())
    .filter((field) => !["projeto.id", "agente.id", "projetoId", "agenteId"].includes(field.path))
}

function buildInitialTestContext({ project, api, form }) {
  const context = buildLockedTestContext(project)
  for (const field of getApiTestFields({ api, form })) {
    const existingValue = field.path.split(".").reduce((current, segment) => {
      if (current == null || typeof current !== "object") {
        return undefined
      }
      return current[segment]
    }, context)

    if (existingValue == null) {
      setNestedValue(context, field.path, "")
    }
  }
  return context
}

function buildInitialTestHeaders({ api, form }) {
  const config = api?.config || getApiConfigFromForm(form)
  return stringifyJson(config?.http?.headers ?? {})
}

function resolveTemplateWithContext(template, context) {
  return String(template || "").replace(/\{\{([^{}]+)\}\}/g, (_match, path) => {
    const segments = String(path || "")
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean)
    let current = context
    for (const segment of segments) {
      if (current == null || typeof current !== "object") {
        current = ""
        break
      }
      current = current[segment]
    }
    return current == null ? "" : String(current)
  })
}

function buildInitialTestBody({ project, api, form }) {
  const config = api?.config || getApiConfigFromForm(form)
  if (config?.http?.body == null) {
    return ""
  }

  const context = buildInitialTestContext({ project, api, form })
  const template =
    typeof config.http.body === "string" ? config.http.body : JSON.stringify(config.http.body, null, 2)

  return resolveTemplateWithContext(template, context)
}

function isAgendaApi(api, form) {
  const sourceApi = api || null
  const name = String(sourceApi?.name || form?.name || "").toLowerCase()
  const url = String(sourceApi?.url || form?.url || "").toLowerCase()
  const config = sourceApi?.config || getApiConfigFromForm(form)
  const tags = Array.isArray(config?.tags) ? config.tags.map((tag) => String(tag).toLowerCase()) : []
  return tags.includes("agenda") || name.includes("agenda") || url.includes("/api/agenda")
}

function getUrlOriginSafe(value, fallback = "") {
  try {
    return new URL(String(value || "")).origin
  } catch {
    return fallback
  }
}

function isLegacyAgendaApi(api, form) {
  if (!isAgendaApi(api, form)) {
    return false
  }

  const sourceApi = api || null
  const url = String(sourceApi?.url || form?.url || "")
  const config = sourceApi?.config || getApiConfigFromForm(form)
  const bodyText =
    config?.http?.body == null
      ? ""
      : typeof config.http.body === "string"
        ? config.http.body
        : JSON.stringify(config.http.body)

  return (
    url.includes("projetoId={projetoId}") ||
    url.includes("agenteId={agenteId}") ||
    bodyText.includes("{{projeto.id}}") ||
    bodyText.includes("{{agente.id}}") ||
    bodyText.includes('"projetoId"') ||
    bodyText.includes('"agenteId"')
  )
}

function buildAgendaMigrationConfig(api, form) {
  const sourceApi = api || null
  const config = sourceApi?.config || getApiConfigFromForm(form)
  const method = String(sourceApi?.method || form?.method || "GET").toUpperCase()
  const fallbackOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  const origin = getUrlOriginSafe(sourceApi?.url || form?.url, fallbackOrigin)
  const widgetSlug = String(config?.widgetSlug || "").trim() || "{{widget.slug}}"

  if (method === "GET") {
    return {
      url: `${origin}/api/agenda?widgetSlug={widgetSlug}`,
      config: {
        parametros: [{ nome: "widgetSlug", path: "widget.slug" }],
        runtime: {
          factual: true,
          cacheTtlSeconds: 60,
          responsePath: "slots",
          previewPath: "0",
          fields: [
            { nome: "horario_id", tipo: "string", descricao: "ID do horario", path: "0.id" },
            { nome: "data_inicio", tipo: "string", descricao: "Data do horario", path: "0.dataInicio" },
            { nome: "hora_inicio", tipo: "string", descricao: "Hora inicial", path: "0.horaInicio" },
            { nome: "hora_fim", tipo: "string", descricao: "Hora final", path: "0.horaFim" },
          ],
        },
        tags: ["agenda", "slots"],
        widgetSlug,
      },
    }
  }

  return {
    url: `${origin}/api/agenda`,
    config: {
      http: {
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          widgetSlug: "{{widget.slug}}",
          horarioId: "{{agenda.horarioId}}",
          horarioReservado: "{{agenda.horarioReservado}}",
          contatoNome: "{{lead.nome}}",
          contatoEmail: "{{lead.email}}",
          contatoTelefone: "{{lead.telefone}}",
          resumoConversa: "{{memoria.resumo}}",
          origem: "chat",
          canal: "web",
        },
      },
      runtime: {
        factual: false,
        autoExecute: false,
        responsePath: "reservation",
        previewPath: "id",
        fields: [
          { nome: "reserva_id", tipo: "string", descricao: "ID da reserva", path: "id" },
          { nome: "status", tipo: "string", descricao: "Status da reserva", path: "status" },
        ],
      },
      tags: ["agenda", "reserva"],
      widgetSlug,
    },
  }
}

function normalizeInitialApi(api) {
  return {
    id: api.id,
    name: api.name,
    url: api.url,
    description: api.description || "",
    active: api.active !== false,
    method: api.method || "GET",
    configText: JSON.stringify(api.config || {}, null, 2),
    versions: Array.isArray(api.versions) ? api.versions : [],
  }
}

export function ApiManager({
  project,
  initialApiId = null,
  activeTab: controlledActiveTab = "edit",
  onTabChange,
  onDetailOpenChange,
  onDeleteAvailableChange,
  onStatsChange,
  resetSignal = 0,
  compact = false,
}) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/apis`
  const [apis, setApis] = useState(() => (project.apis || []).map(normalizeInitialApi))
  const [linkedApiIds, setLinkedApiIds] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [selectedApiId, setSelectedApiId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [restoringVersionId, setRestoringVersionId] = useState(null)
  const [savingLinks, setSavingLinks] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [internalActiveTab, setInternalActiveTab] = useState(controlledActiveTab || "edit")
  const [testContextText, setTestContextText] = useState(() =>
    JSON.stringify(buildInitialTestContext({ project, api: null, form: emptyForm }), null, 2),
  )
  const [testHeadersText, setTestHeadersText] = useState(() => buildInitialTestHeaders({ api: null, form: emptyForm }))
  const [testBodyText, setTestBodyText] = useState(() => buildInitialTestBody({ project, api: null, form: emptyForm }))
  const [agendaTestSlots, setAgendaTestSlots] = useState([])
  const [loadingAgendaTestSlots, setLoadingAgendaTestSlots] = useState(false)

  const editing = useMemo(() => Boolean(form.id), [form.id])
  const activeTab = onTabChange ? controlledActiveTab : internalActiveTab

  useEffect(() => {
    if (onTabChange) {
      setInternalActiveTab(controlledActiveTab || "edit")
    }
  }, [controlledActiveTab, onTabChange])

  function setTab(nextTab) {
    if (onTabChange) {
      onTabChange(nextTab)
      return
    }
    setInternalActiveTab(nextTab)
  }

  useEffect(() => {
    onDetailOpenChange?.(Boolean(selectedApiId))
  }, [onDetailOpenChange, selectedApiId])

  useEffect(() => {
    onDeleteAvailableChange?.(Boolean(form.id))
  }, [form.id, onDeleteAvailableChange])

  useEffect(() => {
    onStatsChange?.({ apis: apis.length })
  }, [apis.length, onStatsChange])

  useEffect(() => {
    if (resetSignal) {
      resetForm()
    }
  }, [resetSignal])

  useEffect(() => {
    let active = true

    async function loadApis() {
      setLoading(true)
      try {
        const response = await fetch(endpoint)
        const data = await response.json()

        if (active && response.ok) {
          setApis((data.apis || []).map(normalizeInitialApi))
          setLinkedApiIds(data.linkedApiIds || [])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadApis()

    return () => {
      active = false
    }
  }, [endpoint])

  useEffect(() => {
    if (!initialApiId || !apis.length) {
      return
    }

    const api = apis.find((item) => item.id === initialApiId)
    if (api) {
      startEdit(api)
    }
  }, [apis, initialApiId])

  useEffect(() => {
    if (!loading && apis.length === 0 && !selectedApiId) {
      startCreate()
    }
  }, [apis.length, loading, selectedApiId])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function startEdit(api) {
    setSelectedApiId(api.id)
    setTab("edit")
    setForm({
      id: api.id,
      name: api.name,
      url: api.url,
      description: api.description || "",
      active: api.active !== false,
      method: api.method || "GET",
      configText: api.configText || "{}",
    })
    setStatus({ type: "idle", message: "" })
    setTestResult(null)
    setTestContextText(JSON.stringify(buildInitialTestContext({ project, api, form: null }), null, 2))
    setTestHeadersText(buildInitialTestHeaders({ api, form: null }))
    setTestBodyText(buildInitialTestBody({ project, api, form: null }))
  }

  function resetForm() {
    setForm(emptyForm)
    setSelectedApiId(null)
    setTab("edit")
    setStatus({ type: "idle", message: "" })
    setTestContextText(JSON.stringify(buildInitialTestContext({ project, api: null, form: emptyForm }), null, 2))
    setTestHeadersText(buildInitialTestHeaders({ api: null, form: emptyForm }))
    setTestBodyText(buildInitialTestBody({ project, api: null, form: emptyForm }))
  }

  function startCreate() {
    setSelectedApiId("new")
    setTab("edit")
    setForm(emptyForm)
    setStatus({ type: "idle", message: "" })
    setTestResult(null)
    setTestContextText(JSON.stringify(buildInitialTestContext({ project, api: null, form: emptyForm }), null, 2))
    setTestHeadersText(buildInitialTestHeaders({ api: null, form: emptyForm }))
    setTestBodyText(buildInitialTestBody({ project, api: null, form: emptyForm }))
  }

  async function saveApi(event) {
    event?.preventDefault?.()
    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      let parsedConfig = {}
      try {
        parsedConfig = form.configText?.trim() ? JSON.parse(form.configText) : {}
        if (!parsedConfig || typeof parsedConfig !== "object" || Array.isArray(parsedConfig)) {
          throw new Error()
        }
      } catch {
        throw new Error("Configuracoes precisam ser um objeto JSON valido.")
      }

      const url = editing ? `${endpoint}/${form.id}` : endpoint
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: form.name,
          url: form.url,
          descricao: form.description,
          ativo: form.active,
          metodo: form.method || "GET",
          configuracoes: parsedConfig,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel salvar a API.")
      }

      const saved = normalizeInitialApi(data.api)
      setApis((current) =>
        editing ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current],
      )
      setStatus({ type: "success", message: editing ? "API atualizada." : "API criada." })
      setSelectedApiId(saved.id)
      setForm({
        id: saved.id,
        name: saved.name,
        url: saved.url,
        description: saved.description || "",
        active: saved.active !== false,
        method: saved.method || "GET",
        configText: saved.configText || "{}",
      })
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function testApi(api) {
    setTestingId(api.id)
    setTestResult(null)

    try {
      const response = await fetch(`${endpoint}/${api.id}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testOverrides: {
            headers: parseObjectText(testHeadersText, {}),
            body: testBodyText || undefined,
          },
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel testar a API.")
      }

      setTestResult({ apiId: api.id, apiName: api.name, ...data.result })
    } catch (error) {
      setTestResult({
        apiId: api.id,
        apiName: api.name,
        ok: false,
        status: 0,
        statusText: "Erro",
        preview: error.message,
      })
    } finally {
      setTestingId(null)
    }
  }

  async function deleteApi() {
    if (!form.id) {
      return
    }

    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/${form.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel deletar a API.")
      }

      setApis((current) => current.filter((api) => api.id !== form.id))
      setLinkedApiIds((current) => current.filter((apiId) => apiId !== form.id))
      resetForm()
      setStatus({ type: "success", message: "API deletada." })
      setDeleteConfirmOpen(false)
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteSubmit(event) {
    event.preventDefault()
    if (!form.id) {
      return
    }
    setDeleteConfirmOpen(true)
  }

  async function restoreApiVersion(api, versionId) {
    if (!api?.id || !versionId || restoringVersionId) {
      return
    }

    setRestoringVersionId(versionId)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/${api.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "restore_version",
          versionId,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel restaurar a API.")
      }

      const restored = normalizeInitialApi(data.api)
      setApis((current) => current.map((item) => (item.id === restored.id ? restored : item)))
      if (form.id === restored.id) {
        setForm({
          id: restored.id,
          name: restored.name,
          url: restored.url,
          description: restored.description || "",
          active: restored.active !== false,
          configText: restored.configText || "{}",
        })
      }
      setStatus({ type: "success", message: "Versao da API restaurada." })
      setRestoreTarget(null)
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setRestoringVersionId(null)
    }
  }

  function toggleApiLink(apiId) {
    setLinkedApiIds((current) =>
      current.includes(apiId) ? current.filter((item) => item !== apiId) : [...current, apiId],
    )
  }

  async function saveApiLinks() {
    setSavingLinks(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente/apis`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiIds: linkedApiIds }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel salvar os vinculos.")
      }

      setLinkedApiIds(data.apiIds || [])
      setStatus({ type: "success", message: "Vinculos do agente salvos." })
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSavingLinks(false)
    }
  }

  function applyPricingTemplate() {
    setForm((current) => ({
      ...current,
      configText: pricingApiConfigTemplateText,
    }))
    setStatus({ type: "idle", message: "" })
  }

  const selectedApi = apis.find((api) => api.id === form.id) || null
  const testFields = useMemo(() => getApiTestFields({ api: selectedApi, form }), [form, selectedApi])
  const parsedTestContext = useMemo(() => parseObjectText(testContextText, {}), [testContextText])
  const resolvedBodyPreview = useMemo(() => testBodyText, [testBodyText])
  const parsedConfigPreview = useMemo(() => stringifyJson(getApiConfigFromForm(form)), [form])
  const agendaApiSelected = useMemo(() => isAgendaApi(selectedApi, form), [form, selectedApi])
  const legacyAgendaApi = useMemo(() => isLegacyAgendaApi(selectedApi, form), [form, selectedApi])
  const detailOpen = Boolean(selectedApiId)
  const tabs = [
    { id: "edit", label: "Criar/Editar", icon: Pencil },
    { id: "json", label: "JSON", icon: Code2 },
    { id: "test", label: "Testar", icon: FlaskConical },
  ]

  useEffect(() => {
    let active = true

    async function loadAgendaSlotsForTest() {
      const widgetSlug = parsedTestContext?.widget?.slug
      if (!agendaApiSelected || !widgetSlug) {
        if (active) {
          setAgendaTestSlots([])
          setLoadingAgendaTestSlots(false)
        }
        return
      }

      setLoadingAgendaTestSlots(true)
      try {
        const response = await fetch(`/api/agenda?widgetSlug=${encodeURIComponent(widgetSlug)}`)
        const data = await response.json().catch(() => ({}))
        if (!active) {
          return
        }
        if (!response.ok) {
          setAgendaTestSlots([])
          return
        }
        setAgendaTestSlots(Array.isArray(data.slots) ? data.slots : [])
      } finally {
        if (active) {
          setLoadingAgendaTestSlots(false)
        }
      }
    }

    loadAgendaSlotsForTest()

    return () => {
      active = false
    }
  }, [agendaApiSelected, parsedTestContext])

  function applyAgendaSlotToTest(slot) {
    const nextContext = parseObjectText(testContextText, {})
    const nextReservedAt =
      slot?.dataInicio && slot?.horaInicio
        ? `${String(slot.dataInicio).slice(0, 10)}T${String(slot.horaInicio).slice(0, 5)}:00.000Z`
        : ""
    setNestedValue(nextContext, "agenda.horarioId", slot?.id || "")
    setNestedValue(nextContext, "agenda.horarioReservado", nextReservedAt)
    setTestContextText(JSON.stringify(nextContext, null, 2))
    const sourceApi = selectedApi || null
    const config = sourceApi?.config || getApiConfigFromForm(form)
    if (config?.http?.body != null) {
      const template =
        typeof config.http.body === "string" ? config.http.body : JSON.stringify(config.http.body, null, 2)
      setTestBodyText(resolveTemplateWithContext(template, nextContext))
    }
  }

  async function migrateAgendaApi() {
    if (!selectedApi) {
      return
    }

    const migration = buildAgendaMigrationConfig(selectedApi, form)
    setForm((current) => ({
      ...current,
      url: migration.url,
      configText: stringifyJson(migration.config),
    }))
    setStatus({ type: "success", message: "Modelo da agenda migrado para widgetSlug. Salve a API." })
  }

  if (!detailOpen) {
    return (
      <section className="mt-0 border-0 bg-transparent p-0 text-slate-300 shadow-none">
        <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", compact && "sr-only")}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-300">
              <PlugZap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">APIs conectadas</h2>
              <p className="text-sm text-slate-400">Cadastre endpoints GET, POST, PUT, PATCH ou DELETE para uso da inteligencia.</p>
            </div>
          </div>
          <Button type="button" variant="outline" className="gap-2" onClick={startCreate}>
            <Plus className="h-4 w-4" />
            Criar API
          </Button>
        </div>

        {compact ? (
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
              onClick={startCreate}
            >
              <Plus className="h-4 w-4" />
              Criar API
            </Button>
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          {apis.length ? (
            <div className="divide-y divide-zinc-200">
              {apis.map((api) => (
                <button
                  key={api.id}
                  type="button"
                  onClick={() => startEdit(api)}
                  className="grid w-full gap-3 p-4 text-left text-sm transition hover:bg-sky-500/10 lg:grid-cols-[minmax(0,1fr)_120px]"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{api.name}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                          api.active
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.03] text-slate-400",
                        )}
                      >
                        {api.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {api.active ? "Ativa" : "Inativa"}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-slate-400">{api.url}</span>
                    <span className="mt-1 inline-flex rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                      {api.method || "GET"}
                    </span>
                    {api.description ? <span className="mt-1 block text-slate-500">{api.description}</span> : null}
                  </span>
                  <span className="self-center justify-self-start rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 lg:justify-self-end">
                    Abrir
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-slate-400">
              {loading ? "Carregando APIs..." : "Nenhuma API conectada neste projeto."}
            </p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="mt-0 border-0 bg-transparent p-0 text-slate-300 shadow-none">
      <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", compact && "sr-only")}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-300">
            <PlugZap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">APIs conectadas</h2>
            <p className="text-sm text-slate-400">Cadastre endpoints GET, POST, PUT, PATCH ou DELETE para uso da inteligencia.</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={resetForm}>
          <Plus className="h-4 w-4" />
          Voltar para lista
        </Button>
      </div>

      <div className={cn("mt-5 flex flex-wrap gap-2", compact && "hidden")}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
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

      {activeTab === "edit" ? (
      <form id="api-editor-form" className="grid gap-4" onSubmit={saveApi}>
        <div className="grid gap-3 md:grid-cols-[160px_220px_minmax(0,1fr)]">
          <label className="block">
            <span className={labelClassName}>Metodo</span>
            <select
              value={form.method}
              onChange={(event) => updateForm("method", event.target.value)}
              className={inputClassName}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClassName}>Nome</span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              className={inputClassName}
              required
            />
          </label>
          <label className="block">
            <span className={labelClassName}>URL</span>
            <input
              value={form.url}
              onChange={(event) => updateForm("url", event.target.value)}
              placeholder="https://exemplo.com/api/produtos"
              className={inputClassName}
              required
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClassName}>Descricao</span>
          <textarea
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            className={cn(textareaClassName, "min-h-20")}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ToggleSwitchButton checked={form.active} onChange={(value) => updateForm("active", value)} labelOn="API ativa" labelOff="API inativa" />
        </div>
      </form>
      ) : null}

      {activeTab === "json" ? (
        <div className="mt-0 grid gap-5">
          {legacyAgendaApi ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-100">API de agenda em formato legado</p>
              <p className="mt-1 text-xs text-amber-200/80">Essa API ainda usa `projetoId/agenteId`. Migre para `widgetSlug` e salve.</p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={migrateAgendaApi}
                  className="h-10 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 text-sm text-amber-100"
                >
                  Migrar para widgetSlug
                </Button>
              </div>
            </div>
          ) : null}

          <label className="block">
            <div className="flex items-center justify-between gap-3">
              <span className={labelClassName}>Configuracao JSON</span>
            </div>
            <textarea
              value={form.configText}
              onChange={(event) => updateForm("configText", event.target.value)}
              className={cn(textareaClassName, "min-h-80 break-all font-mono text-xs [overflow-wrap:anywhere]")}
              spellCheck={false}
            />
          </label>

          <div>
            <p className="text-sm font-medium text-white">Modelo atual da API</p>
            <p className="mt-1 text-xs text-slate-500">Snapshot do que esta cadastrado agora.</p>
            <JsonCodeBlock value={parsedConfigPreview} className="mt-3 max-h-72 overflow-y-auto" />
          </div>

          <div>
            <p className="text-sm font-medium text-white">Exemplo JSON de retorno</p>
            <p className="mt-1 text-xs text-slate-500">
              A URL deve responder JSON. O runtime usa `responsePath`, `previewPath` e `fields.path`.
            </p>
            <JsonCodeBlock value={pricingApiResponseExampleText} className="mt-3 max-h-80 overflow-y-auto" />
          </div>
        </div>
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

      {false && activeTab === "edit" ? (
      <>
      <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
        {apis.length ? (
          <div className="divide-y divide-zinc-200">
            {apis.map((api) => (
              <div key={api.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_210px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-zinc-950">{api.name}</h3>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
                        api.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-zinc-200 bg-zinc-50 text-zinc-600",
                      )}
                    >
                      {api.active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {api.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-zinc-600">{api.url}</p>
                  {api.description ? <p className="mt-1 text-zinc-500">{api.description}</p> : null}
                  {project.agent?.id ? (
                    <label className="mt-3 flex w-fit items-center gap-2 text-xs font-medium text-zinc-600">
                      <input
                        type="checkbox"
                        checked={linkedApiIds.includes(api.id)}
                        onChange={() => toggleApiLink(api.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      Vinculada ao agente
                    </label>
                  ) : null}
                  {api.versions.length ? (
                    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                        <History className="h-3.5 w-3.5" />
                        Historico de versoes
                      </div>
                      <div className="mt-2 space-y-2">
                        {api.versions.slice(0, 3).map((version) => (
                          <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-zinc-800">
                                v{version.versionNumber} - {version.name}
                              </p>
                              <p className="truncate text-[11px] text-zinc-500">
                                {new Date(version.createdAt).toLocaleString("pt-BR")} - {version.source === "rollback" ? "rollback" : "salvamento"}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs"
                              disabled={Boolean(restoringVersionId)}
                              onClick={() => setRestoreTarget({ api, versionId: version.id })}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {restoringVersionId === version.id ? "Restaurando..." : "Rollback"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => testApi(api)}>
                    <FlaskConical className="h-4 w-4" />
                    {testingId === api.id ? "Testando..." : "Testar"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => startEdit(api)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-600">
            {loading ? "Carregando APIs..." : "Nenhuma API conectada neste projeto."}
          </p>
        )}
      </div>

      {project.agent?.id && apis.length ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={saveApiLinks}
            disabled={savingLinks}
            className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingLinks ? "Salvando vinculos..." : "Salvar vinculos do agente"}
          </Button>
        </div>
      ) : null}
      </>
      ) : null}

      {activeTab === "test" ? (
        <div className="mt-0 space-y-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Opcoes do teste</p>
            <p className="mt-1 text-xs text-slate-500">Projeto e agente ficam travados. Headers e body podem ser ajustados para testar API externa.</p>

            {legacyAgendaApi ? (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-100">API de agenda em formato legado</p>
                <p className="mt-1 text-xs text-amber-200/80">Migre para `widgetSlug` na aba JSON antes de confiar no teste.</p>
              </div>
            ) : null}

            {testFields.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {testFields.map((field) => (
                  <label key={field.key} className="block">
                    <span className={labelClassName}>
                      {field.label}
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
                        {field.source}
                      </span>
                    </span>
                    <input
                      value={String(
                        field.path.split(".").reduce((current, segment) => {
                          if (current == null || typeof current !== "object") {
                            return ""
                          }
                          return current[segment]
                        }, parsedTestContext) ?? ""
                      )}
                      placeholder={field.path}
                      readOnly
                      disabled
                      className={inputClassName}
                    />
                    <span className="mt-1 block text-xs text-slate-500">{field.description}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-[#0a1020] px-4 py-3 text-xs text-slate-500">
                Esta API nao tem parametros dinamicos cadastrados.
              </div>
            )}

            <label className="mt-4 block">
              <span className={labelClassName}>Contexto JSON do teste</span>
              <textarea
                value={testContextText}
                className={cn(textareaClassName, "min-h-44 break-all font-mono text-xs [overflow-wrap:anywhere]")}
                spellCheck={false}
                readOnly
                disabled
              />
            </label>

            <label className="mt-4 block">
              <span className={labelClassName}>Headers do teste</span>
              <textarea
                value={testHeadersText}
                onChange={(event) => setTestHeadersText(event.target.value)}
                className={cn(textareaClassName, "min-h-32 break-all font-mono text-xs [overflow-wrap:anywhere]")}
                spellCheck={false}
              />
            </label>

            {agendaApiSelected ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-[#0a1020] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Slots para teste</p>
                    <p className="mt-1 text-xs text-slate-500">Escolha um horario real para preencher o teste da agenda.</p>
                  </div>
                  {loadingAgendaTestSlots ? <span className="text-xs text-slate-500">Carregando...</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {agendaTestSlots.slice(0, 12).map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => applyAgendaSlotToTest(slot)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 hover:border-sky-400/30 hover:bg-sky-500/10"
                    >
                      {String(slot.dataInicio).slice(0, 10)} {String(slot.horaInicio).slice(0, 5)}
                    </button>
                  ))}
                  {!loadingAgendaTestSlots && !agendaTestSlots.length ? (
                    <div className="text-xs text-slate-500">Nenhum slot encontrado para o widget atual.</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {resolvedBodyPreview ? (
              <label className="mt-4 block">
                <span className={labelClassName}>Body do teste</span>
                <textarea
                  value={resolvedBodyPreview}
                  onChange={(event) => setTestBodyText(event.target.value)}
                  className={cn(textareaClassName, "min-h-40 break-all font-mono text-xs [overflow-wrap:anywhere]")}
                  spellCheck={false}
                />
              </label>
            ) : null}

            <form
              id="api-test-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (selectedApi) {
                  testApi(selectedApi)
                }
              }}
            />
          </div>

          {testResult ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Teste: {testResult.apiName}</p>
                <span
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium",
                    testResult.ok
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                      : "border-red-500/20 bg-red-500/10 text-red-200",
                  )}
                >
                  {testResult.status || 0} {testResult.statusText}
                </span>
              </div>
              {testingId === selectedApi?.id ? (
                <div className="mt-3 text-xs text-slate-500">Executando teste...</div>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2 text-xs text-slate-400">
                  <div className="text-slate-500">Metodo</div>
                  <div className="mt-1 break-all text-slate-200">{testResult.method || selectedApi?.method || "GET"}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#0a1020] px-3 py-2 text-xs text-slate-400">
                  <div className="text-slate-500">Duracao</div>
                  <div className="mt-1 text-slate-200">
                    {testResult.durationMs !== null && testResult.durationMs !== undefined ? `${testResult.durationMs}ms` : "Sem medicao"}
                  </div>
                </div>
              </div>
              {testResult.url ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">URL testada</p>
                  <JsonCodeBlock value={testResult.url} className="mt-2 max-h-32 overflow-y-auto" />
                </div>
              ) : null}
              {testResult.requestBody ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Body enviado</p>
                  <JsonCodeBlock value={testResult.requestBody} className="mt-2 max-h-48 overflow-y-auto" />
                </div>
              ) : null}
              {Array.isArray(testResult.fields) && testResult.fields.length ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Campos extraidos</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {testResult.fields.map((field) => (
                      <div key={`${field.nome}-${field.valor}`} className="rounded-md border border-white/10 bg-[#0a1020] px-2.5 py-2">
                        <p className="text-xs font-medium text-slate-300">{field.nome}</p>
                        <p className="mt-1 text-xs text-slate-500">{String(field.valor)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Retorno</p>
                <JsonCodeBlock value={testResult.preview || "Sem corpo de resposta."} className="mt-2 max-h-56 overflow-y-auto" />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <form id="api-delete-form" onSubmit={handleDeleteSubmit} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir API"
        description="Esta API sera removida do projeto."
        confirmLabel="Excluir API"
        danger
        loading={saving}
        onConfirm={deleteApi}
      />

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreTarget(null)
          }
        }}
        title="Restaurar versao da API"
        description="O estado atual sera salvo no historico antes do rollback."
        confirmLabel="Restaurar versao"
        loading={Boolean(restoringVersionId)}
        onConfirm={() => (restoreTarget ? restoreApiVersion(restoreTarget.api, restoreTarget.versionId) : null)}
      />

      {detailOpen && !compact ? (
        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {activeTab === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetForm}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="api-editor-form"
                  disabled={saving}
                  variant="ghost"
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : editing ? "Salvar API" : "Criar API"}
                </Button>
              </>
            ) : null}

            {activeTab === "json" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={applyPricingTemplate}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                >
                  Usar modelo
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  variant="ghost"
                  onClick={() => saveApi()}
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar JSON"}
                </Button>
              </>
            ) : null}

            {activeTab === "test" ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedApi || testingId === selectedApi?.id}
                onClick={() => selectedApi && testApi(selectedApi)}
              >
                {testingId === selectedApi?.id ? "Testando..." : "Testar"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
