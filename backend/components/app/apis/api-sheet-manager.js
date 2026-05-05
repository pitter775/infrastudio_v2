"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, Pencil, Plus, Send, Trash2, XCircle } from "lucide-react"

import { AppSelect } from "@/components/ui/app-select"
import { Button } from "@/components/ui/button"
import { JsonCodeBlock } from "@/components/ui/json-code-block"
import { ToggleSwitchButton } from "@/components/ui/toggle-switch-button"
import { cn } from "@/lib/utils"

const emptyForm = {
  id: null,
  name: "",
  description: "",
  url: "",
  method: "GET",
  active: true,
  baseConfig: {},
  authType: "none",
  authHeaderName: "Authorization",
  bearerToken: "",
  apiKeyName: "x-api-key",
  apiKeyValue: "",
  runtimeIntentType: "generic_fact",
  runtimeDescriptionForIntent: "",
  runtimeResponsePath: "",
  runtimePreviewPath: "",
  runtimeAutoExecute: false,
  runtimeRequiresConfirmation: false,
  headerRows: [{ id: "header-1", key: "", value: "" }],
  bodyFields: [{ id: "field-1", name: "", type: "string", required: false }],
  bodyText: "",
}

const methodOptions = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
]

const authTypeOptions = [
  { value: "none", label: "Sem autorização" },
  { value: "bearer", label: "Bearer token" },
  { value: "api-key", label: "API Key" },
]

const editorTabs = [
  { id: "body", label: "Body" },
  { id: "runtime", label: "Runtime" },
  { id: "authorization", label: "Authorization" },
  { id: "headers", label: "Headers" },
  { id: "description", label: "Descrição" },
]

const bodySubtabs = [
  { id: "fields", label: "Campos" },
  { id: "json", label: "JSON" },
]

const fieldTypeOptions = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
]

const runtimeIntentTypeOptions = [
  { value: "generic_fact", label: "Fato genérico" },
  { value: "lookup_by_identifier", label: "Consulta por identificador" },
  { value: "knowledge_search", label: "Busca informativa" },
  { value: "catalog_search", label: "Busca de catálogo" },
  { value: "create_record", label: "Cadastro / envio de dados" },
]

const runtimePresetOptions = [
  {
    id: "create_record",
    label: "Cadastro",
    method: "POST",
    intentType: "create_record",
    descriptionForIntent: "Cadastra ou envia dados do cliente depois de coletar os campos obrigatórios e confirmar com o usuário.",
    autoExecute: false,
    requiresConfirmation: true,
    fields: [
      { name: "nome", type: "string", required: true },
      { name: "telefone", type: "string", required: true },
      { name: "mensagem", type: "string", required: false },
    ],
  },
  {
    id: "lookup_by_identifier",
    label: "Consulta por código",
    method: "GET",
    intentType: "lookup_by_identifier",
    descriptionForIntent: "Consulta um registro específico por código, id, documento ou outro identificador informado pelo usuário.",
    autoExecute: false,
    requiresConfirmation: false,
    fields: [{ name: "codigo", type: "string", required: true }],
  },
  {
    id: "knowledge_search",
    label: "Busca informativa",
    method: "GET",
    intentType: "knowledge_search",
    descriptionForIntent: "Busca informações factuais em uma base de conhecimento ou serviço informativo sem criar registros.",
    autoExecute: false,
    requiresConfirmation: false,
    fields: [{ name: "termo", type: "string", required: true }],
  },
  {
    id: "catalog_search",
    label: "Catálogo",
    method: "GET",
    intentType: "catalog_search",
    descriptionForIntent: "Busca produtos por termo, categoria, cor, material, preço, estoque ou disponibilidade.",
    autoExecute: false,
    requiresConfirmation: false,
    fields: [
      { name: "nome", type: "string", required: false },
      { name: "preco", type: "number", required: false },
      { name: "estoque", type: "number", required: false },
      { name: "link", type: "string", required: false },
      { name: "imagem", type: "string", required: false },
    ],
  },
]

const inputClassName =
  "mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const textareaClassName =
  "mt-1 w-full resize-y rounded-xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
const labelClassName = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"

function isInternalUrl(value) {
  const rawValue = String(value || "").trim()
  if (!rawValue) {
    return false
  }

  return rawValue.startsWith("/api/")
}

function isInternalApi(apiOrForm) {
  const url = String(apiOrForm?.url || "").trim()
  const tags = Array.isArray(apiOrForm?.config?.tags)
    ? apiOrForm.config.tags.map((item) => String(item || "").toLowerCase())
    : Array.isArray(apiOrForm?.baseConfig?.tags)
      ? apiOrForm.baseConfig.tags.map((item) => String(item || "").toLowerCase())
      : []

  return isInternalUrl(url) || tags.includes("internal")
}

function isAgendaInternalApi(apiOrForm) {
  const url = String(apiOrForm?.url || "").toLowerCase()
  const tags = Array.isArray(apiOrForm?.config?.tags)
    ? apiOrForm.config.tags.map((item) => String(item || "").toLowerCase())
    : Array.isArray(apiOrForm?.baseConfig?.tags)
      ? apiOrForm.baseConfig.tags.map((item) => String(item || "").toLowerCase())
      : []

  return isInternalApi(apiOrForm) && (url.includes("/api/agenda") || tags.includes("agenda"))
}

function truncateMiddleValue(value) {
  const text = String(value || "").trim()
  if (!text) {
    return ""
  }

  const visibleLength = Math.max(8, Math.ceil(text.length / 2))
  return text.length <= visibleLength ? text : `${text.slice(0, visibleLength)}...`
}

function getRuntimeIntentTypeLabel(value) {
  return runtimeIntentTypeOptions.find((option) => option.value === value)?.label || "Fato genérico"
}

function stringifyBody(value) {
  if (value == null) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

function tryParseJson(value) {
  try {
    return JSON.parse(String(value || "").trim())
  } catch {
    return null
  }
}

function inferBodyFieldsFromBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return []
  }

  return Object.entries(body).map(([key, value], index) => ({
    id: `field-${index + 1}`,
    name: key,
    type:
      typeof value === "number"
        ? "number"
        : typeof value === "boolean"
          ? "boolean"
          : "string",
    required: false,
  }))
}

function buildBodyFromFields(fields) {
  return (Array.isArray(fields) ? fields : []).reduce((acc, field) => {
    const key = String(field?.name || "").trim()
    if (!key) {
      return acc
    }

    if (field?.type === "number") {
      acc[key] = 0
      return acc
    }

    if (field?.type === "boolean") {
      acc[key] = false
      return acc
    }

    acc[key] = ""
    return acc
  }, {})
}

function buildHeaderRows(headers, reservedKeys = []) {
  const blockedKeys = reservedKeys.map((item) => String(item || "").toLowerCase())
  const rows = Object.entries(headers || {})
    .filter(([key]) => !blockedKeys.includes(String(key || "").toLowerCase()))
    .map(([key, value], index) => ({
      id: `header-${index + 1}`,
      key,
      value: String(value ?? ""),
    }))

  return rows.length ? rows : [{ id: "header-1", key: "", value: "" }]
}

function resolveAuthorization(config) {
  const authConfig = config?.authorization && typeof config.authorization === "object" ? config.authorization : {}
  const headers = config?.http?.headers && typeof config.http.headers === "object" ? config.http.headers : {}
  const authorizationHeader = String(headers.Authorization || headers.authorization || "").trim()

  if (String(authConfig.type || "").trim() === "bearer" || authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return {
      authType: "bearer",
      authHeaderName: String(authConfig.headerName || "Authorization").trim() || "Authorization",
      bearerToken: String(authConfig.token || authorizationHeader.replace(/^bearer\s+/i, "")).trim(),
      apiKeyName: "x-api-key",
      apiKeyValue: "",
      reservedKeys: ["Authorization"],
    }
  }

  const apiKeyName = String(authConfig.headerName || authConfig.keyName || "x-api-key").trim()
  const apiKeyValue =
    String(authConfig.value || headers[apiKeyName] || headers[apiKeyName.toLowerCase()] || "").trim()

  if (String(authConfig.type || "").trim() === "api-key" || apiKeyValue) {
    return {
      authType: "api-key",
      authHeaderName: "Authorization",
      bearerToken: "",
      apiKeyName: apiKeyName || "x-api-key",
      apiKeyValue,
      reservedKeys: [apiKeyName || "x-api-key"],
    }
  }

  return {
    authType: "none",
    authHeaderName: "Authorization",
    bearerToken: "",
    apiKeyName: "x-api-key",
    apiKeyValue: "",
    reservedKeys: [],
  }
}

function resolveRuntimeConfig(config) {
  const runtime = config?.runtime && typeof config.runtime === "object" ? config.runtime : {}
  const intentType = runtimeIntentTypeOptions.some((option) => option.value === runtime.intentType)
    ? runtime.intentType
    : "generic_fact"

  return {
    runtimeIntentType: intentType,
    runtimeDescriptionForIntent: String(runtime.descriptionForIntent || ""),
    runtimeResponsePath: String(runtime.responsePath || ""),
    runtimePreviewPath: String(runtime.previewPath || ""),
    runtimeAutoExecute: runtime.autoExecute === true,
    runtimeRequiresConfirmation: runtime.requiresConfirmation === true,
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
    config: api.config ?? null,
  }
}

function buildFormFromApi(api) {
  const config = api?.config && typeof api.config === "object" ? api.config : {}
  const authorization = resolveAuthorization(config)
  const runtime = resolveRuntimeConfig(config)
  const inferredBodyFields = inferBodyFieldsFromBody(config?.http?.body)
  const bodyFields = Array.isArray(config?.bodyFields)
    ? config.bodyFields.map((field, index) => ({
        id: field?.id || `field-${index + 1}`,
        name: String(field?.name || field?.nome || ""),
        type: String(field?.type || field?.tipo || "string"),
        required: field?.required === true || field?.obrigatorio === true,
      }))
    : inferredBodyFields.length
      ? inferredBodyFields
      : emptyForm.bodyFields

  return {
    id: api?.id || null,
    name: api?.name || "",
    description: api?.description || "",
    url: api?.url || "",
    method: api?.method || "GET",
    active: api?.active !== false,
    baseConfig: config,
    authType: authorization.authType,
    authHeaderName: authorization.authHeaderName,
    bearerToken: authorization.bearerToken,
    apiKeyName: authorization.apiKeyName,
    apiKeyValue: authorization.apiKeyValue,
    ...runtime,
    headerRows: buildHeaderRows(config?.http?.headers, authorization.reservedKeys),
    bodyFields: bodyFields.length ? bodyFields : emptyForm.bodyFields,
    bodyText: stringifyBody(config?.http?.body),
  }
}

function buildHeadersFromRows(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const key = String(row?.key || "").trim()
    const value = String(row?.value || "").trim()

    if (key && value) {
      acc[key] = value
    }

    return acc
  }, {})
}

function buildConfigFromForm(form) {
  const baseConfig = form.baseConfig && typeof form.baseConfig === "object" ? form.baseConfig : {}
  const requiredFields = (Array.isArray(form.bodyFields) ? form.bodyFields : [])
    .filter((field) => field?.required === true && String(field?.name || "").trim())
    .map((field) => ({
      name: String(field.name).trim(),
      source: String(field.name).trim(),
      param: String(field.name).trim(),
      description: "",
    }))
  const runtimeFields = (Array.isArray(form.bodyFields) ? form.bodyFields : [])
    .map((field) => ({
      nome: String(field?.name || "").trim(),
      tipo: String(field?.type || "string").trim() || "string",
      path: String(field?.name || "").trim(),
      descricao: "",
    }))
    .filter((field) => field.nome)
  const nextConfig = {
    ...baseConfig,
    runtime: {
      ...(baseConfig.runtime && typeof baseConfig.runtime === "object" ? baseConfig.runtime : {}),
      intentType: form.runtimeIntentType || "generic_fact",
      descriptionForIntent: String(form.runtimeDescriptionForIntent || "").trim(),
      responsePath: String(form.runtimeResponsePath || "").trim(),
      previewPath: String(form.runtimePreviewPath || "").trim(),
      autoExecute: form.runtimeAutoExecute === true,
      requiresConfirmation: form.runtimeRequiresConfirmation === true,
      requiredFields,
      fields: runtimeFields,
    },
    http: {
      ...(baseConfig.http && typeof baseConfig.http === "object" ? baseConfig.http : {}),
      headers: buildHeadersFromRows(form.headerRows),
    },
  }

  if (form.authType === "bearer" && form.bearerToken.trim()) {
    nextConfig.http.headers[form.authHeaderName || "Authorization"] = `Bearer ${form.bearerToken.trim()}`
    nextConfig.authorization = {
      type: "bearer",
      headerName: form.authHeaderName || "Authorization",
      token: form.bearerToken.trim(),
    }
  } else if (form.authType === "api-key" && form.apiKeyName.trim() && form.apiKeyValue.trim()) {
    nextConfig.http.headers[form.apiKeyName.trim()] = form.apiKeyValue.trim()
    nextConfig.authorization = {
      type: "api-key",
      headerName: form.apiKeyName.trim(),
      value: form.apiKeyValue.trim(),
    }
  } else {
    delete nextConfig.authorization
  }

  const parsedBody = tryParseJson(form.bodyText)
  const hasBody = String(form.bodyText || "").trim().length > 0
  const bodyFromFields = buildBodyFromFields(form.bodyFields)
  const hasBodyFields = Object.keys(bodyFromFields).length > 0

  if (hasBody && !["GET", "DELETE"].includes(String(form.method || "GET").toUpperCase())) {
    nextConfig.http.body = parsedBody ?? form.bodyText
    if (parsedBody && !nextConfig.http.headers["Content-Type"]) {
      nextConfig.http.headers["Content-Type"] = "application/json"
    }
  } else if (hasBodyFields && !["GET", "DELETE"].includes(String(form.method || "GET").toUpperCase())) {
    nextConfig.http.body = bodyFromFields
    if (!nextConfig.http.headers["Content-Type"]) {
      nextConfig.http.headers["Content-Type"] = "application/json"
    }
  } else {
    delete nextConfig.http.body
  }

  nextConfig.bodyFields = (Array.isArray(form.bodyFields) ? form.bodyFields : [])
    .map((field) => ({
      name: String(field?.name || "").trim(),
      type: String(field?.type || "string").trim() || "string",
      required: field?.required === true,
    }))
    .filter((field) => field.name)

  if (!Object.keys(nextConfig.http.headers).length) {
    delete nextConfig.http.headers
  }

  if (!Object.keys(nextConfig.http).length) {
    delete nextConfig.http
  }

  if (!nextConfig.runtime.descriptionForIntent) {
    delete nextConfig.runtime.descriptionForIntent
  }

  if (!nextConfig.runtime.responsePath) {
    delete nextConfig.runtime.responsePath
  }

  if (!nextConfig.runtime.previewPath) {
    delete nextConfig.runtime.previewPath
  }

  if (!nextConfig.runtime.requiredFields.length) {
    delete nextConfig.runtime.requiredFields
  }

  if (!nextConfig.runtime.fields.length) {
    delete nextConfig.runtime.fields
  }

  return nextConfig
}

export function ApiSheetManager({
  project,
  initialApiId = null,
  onDetailOpenChange,
  onFooterStateChange,
  onStatsChange,
  resetSignal = 0,
  compact = false,
}) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/apis`
  const [apis, setApis] = useState(() => (project.apis || []).map(normalizeInitialApi))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [editorTab, setEditorTab] = useState("body")
  const [bodySubtab, setBodySubtab] = useState("fields")
  const [mode, setMode] = useState(initialApiId ? "editor" : "list")
  const [form, setForm] = useState(emptyForm)
  const [responseResult, setResponseResult] = useState(null)
  const [agendaDate, setAgendaDate] = useState("")

  const inEditor = mode === "editor"
  const editing = Boolean(form.id)
  const internalApi = useMemo(() => isInternalApi(form), [form])
  const agendaInternalApi = useMemo(() => isAgendaInternalApi(form), [form])
  const runtimeWarnings = useMemo(() => {
    const warnings = []
    const method = String(form.method || "GET").toUpperCase()
    const hasRuntimeIntentType = Boolean(String(form.runtimeIntentType || "").trim())
    const requiredFields = (Array.isArray(form.bodyFields) ? form.bodyFields : []).filter(
      (field) => field?.required === true && String(field?.name || "").trim(),
    )
    const configuredFields = (Array.isArray(form.bodyFields) ? form.bodyFields : []).filter((field) => String(field?.name || "").trim())

    if (!hasRuntimeIntentType) {
      warnings.push("Defina o tipo de intenção do runtime.")
    }

    if (method !== "GET" && form.runtimeAutoExecute && !requiredFields.length) {
      warnings.push("Non-GET com execução automática precisa de campos obrigatórios.")
    }

    if (method !== "GET" && form.runtimeAutoExecute && !form.runtimeRequiresConfirmation) {
      warnings.push("Non-GET autoexecutável deve exigir confirmação.")
    }

    if (form.runtimeIntentType === "create_record" && !form.runtimeRequiresConfirmation) {
      warnings.push("Cadastro deve exigir confirmação antes de executar.")
    }

    if (form.runtimeIntentType === "catalog_search") {
      const fieldNames = configuredFields.map((field) => String(field.name || "").toLowerCase())
      const hasCatalogName = fieldNames.some((name) => ["nome", "titulo", "title", "produto"].includes(name))
      if (!hasCatalogName) {
        warnings.push("Catálogo precisa de um campo de nome, título ou produto.")
      }
      const hasCommercialField = fieldNames.some((name) => ["preco", "valor", "estoque", "link", "imagem", "thumbnail"].includes(name))
      if (!hasCommercialField) {
        warnings.push("Catálogo deve mapear preço, estoque, link ou imagem quando a API retornar esses dados.")
      }
    }

    if (form.runtimeIntentType === "lookup_by_identifier" && !requiredFields.length) {
      warnings.push("Consulta por identificador deve ter pelo menos um campo obrigatório.")
    }

    if (form.runtimeIntentType === "create_record" && !requiredFields.length) {
      warnings.push("Cadastro deve ter campos obrigatórios para coleta segura.")
    }

    if (!String(form.runtimeDescriptionForIntent || "").trim()) {
      warnings.push("Descrição para decisão da IA ajuda a evitar conflito entre APIs.")
    }

    if (!configuredFields.length) {
      warnings.push("Configure campos para o agente consumir a resposta com segurança.")
    }

    return warnings
  }, [form])

  useEffect(() => {
    let active = true

    async function loadApis() {
      setLoading(true)
      try {
        const response = await fetch(endpoint)
        const data = await response.json().catch(() => ({}))

        if (active && response.ok) {
          setApis((data.apis || []).map(normalizeInitialApi))
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

    const initialApi = apis.find((item) => item.id === initialApiId)
    if (initialApi) {
      setForm(buildFormFromApi(initialApi))
      setMode("editor")
    }
  }, [apis, initialApiId])

  useEffect(() => {
    if (resetSignal) {
      setMode("list")
      setForm(emptyForm)
      setEditorTab("body")
      setBodySubtab("fields")
      setResponseResult(null)
      setAgendaDate("")
      setStatus({ type: "idle", message: "" })
    }
  }, [resetSignal])

  useEffect(() => {
    onDetailOpenChange?.(inEditor)
  }, [inEditor, onDetailOpenChange])

  useEffect(() => {
    onFooterStateChange?.({
      canSave: inEditor,
      saving,
    })
  }, [inEditor, onFooterStateChange, saving])

  useEffect(() => {
    onStatsChange?.({ apis: apis.length })
  }, [apis.length, onStatsChange])

  const responseValue = useMemo(() => {
    if (!responseResult) {
      return null
    }

    if (typeof responseResult.preview === "string") {
      try {
        return JSON.stringify(JSON.parse(responseResult.preview), null, 2)
      } catch {
        return responseResult.preview
      }
    }

    return JSON.stringify(responseResult, null, 2)
  }, [responseResult])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateHeaderRow(rowId, field, value) {
    setForm((current) => ({
      ...current,
      headerRows: current.headerRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }))
  }

  function updateBodyField(rowId, field, value) {
    setForm((current) => ({
      ...current,
      bodyFields: current.bodyFields.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }))
  }

  function addHeaderRow() {
    setForm((current) => ({
      ...current,
      headerRows: [...current.headerRows, { id: `header-${Date.now()}`, key: "", value: "" }],
    }))
  }

  function addBodyField() {
    setForm((current) => ({
      ...current,
      bodyFields: [...current.bodyFields, { id: `field-${Date.now()}`, name: "", type: "string", required: false }],
    }))
  }

  function removeBodyField(rowId) {
    setForm((current) => {
      const nextRows = current.bodyFields.filter((row) => row.id !== rowId)
      return {
        ...current,
        bodyFields: nextRows.length ? nextRows : [{ id: `field-${Date.now()}`, name: "", type: "string", required: false }],
      }
    })
  }

  function removeHeaderRow(rowId) {
    setForm((current) => {
      const nextRows = current.headerRows.filter((row) => row.id !== rowId)
      return {
        ...current,
        headerRows: nextRows.length ? nextRows : [{ id: `header-${Date.now()}`, key: "", value: "" }],
      }
    })
  }

  function applyRuntimePreset(preset) {
    if (!preset) {
      return
    }

    setForm((current) => ({
      ...current,
      method: isInternalApi(current) ? current.method : preset.method,
      runtimeIntentType: preset.intentType,
      runtimeDescriptionForIntent: preset.descriptionForIntent,
      runtimeAutoExecute: preset.autoExecute,
      runtimeRequiresConfirmation: preset.requiresConfirmation,
      bodyFields: preset.fields.map((field, index) => ({
        id: `field-${preset.id}-${index + 1}`,
        name: field.name,
        type: field.type,
        required: field.required,
      })),
    }))
    setEditorTab("runtime")
    setBodySubtab("fields")
  }

  function startCreate() {
    setForm(emptyForm)
    setMode("editor")
    setEditorTab("body")
    setBodySubtab("fields")
    setResponseResult(null)
    setAgendaDate("")
    setStatus({ type: "idle", message: "" })
  }

  async function loadApiDetail(api) {
    if (api?.config !== null) {
      return api
    }

    const response = await fetch(`${endpoint}/${api.id}`)
    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.api) {
      throw new Error(data.error || "Não foi possível carregar a API.")
    }

    const detailedApi = normalizeInitialApi(data.api)
    setApis((current) => current.map((item) => (item.id === detailedApi.id ? detailedApi : item)))
    return detailedApi
  }

  async function startEdit(api) {
    setMode("editor")
    setEditorTab("body")
    setBodySubtab("fields")
    setResponseResult(null)
    setAgendaDate("")
    setStatus({ type: "idle", message: "" })

    try {
      const detailedApi = await loadApiDetail(api)
      setForm(buildFormFromApi(detailedApi))
    } catch (error) {
      setMode("list")
      setStatus({ type: "error", message: error.message })
    }
  }

  async function handleSave(event) {
    event?.preventDefault?.()
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
          descricao: form.description,
          url: form.url,
          metodo: form.method,
          ativo: form.active,
          configuracoes: buildConfigFromForm(form),
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar a API.")
      }

      const savedApi = normalizeInitialApi(data.api)
      setApis((current) =>
        editing ? current.map((item) => (item.id === savedApi.id ? savedApi : item)) : [savedApi, ...current],
      )
      setForm(buildFormFromApi(savedApi))
      setStatus({ type: "success", message: editing ? "API atualizada." : "API criada." })
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  function handleSend() {
    sendDraftRequest()
  }

  async function sendDraftRequest() {
    setSending(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`${endpoint}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agendaDate,
          api: {
            nome: form.name || "API sem nome",
            descricao: form.description,
            url: form.url,
            metodo: form.method,
            ativo: form.active,
            configuracoes: buildConfigFromForm(form),
          },
          testOverrides: {
            headers: buildHeadersFromRows(form.headerRows),
            body: String(form.bodyText || "").trim() ? tryParseJson(form.bodyText) ?? form.bodyText : undefined,
          },
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível enviar a requisição.")
      }

      if (!data.result) {
        throw new Error("A API não retornou resultado de teste.")
      }

      const nextResult = data.result

      if (agendaInternalApi) {
        let slots = []
        const parsedResponse =
          nextResult?.responseJson && typeof nextResult.responseJson === "object"
            ? nextResult.responseJson
            : (() => {
                try {
                  return JSON.parse(String(nextResult.responseBodyText || nextResult.preview || "{}"))
                } catch {
                  return {}
                }
              })()

        slots = Array.isArray(parsedResponse?.slots) ? parsedResponse.slots : []

        const filteredSlots = agendaDate
          ? slots.filter((slot) => String(slot?.dataInicio || "").slice(0, 10) === agendaDate)
          : slots

        setResponseResult({
          ...nextResult,
          preview: JSON.stringify(
            agendaDate
              ? {
                  data: agendaDate,
                  horarios: filteredSlots.map((slot) => String(slot?.horaInicio || "")).filter(Boolean),
                }
              : {
                  slots: filteredSlots.map((slot) => ({
                    data: String(slot?.dataInicio || "").slice(0, 10),
                    inicio: String(slot?.horaInicio || ""),
                    fim: String(slot?.horaFim || ""),
                  })),
                },
            null,
            2,
          ),
        })
        return
      }

      setResponseResult(nextResult)
    } catch (error) {
      setResponseResult({
        ok: false,
        status: 0,
        statusText: "Erro",
        durationMs: null,
        preview: error.message,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={cn("flex h-full min-h-0 flex-col px-6 text-slate-300", compact && "mt-0")}>
      {status.message ? (
        <p
          className={cn(
            "mb-4 rounded-xl border px-3 py-2 text-sm",
            status.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/20 bg-red-500/10 text-red-200",
          )}
        >
          {status.message}
        </p>
      ) : null}

      {!inEditor ? (
        <div className="-mr-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-6">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
              Carregando APIs...
            </div>
          ) : null}

          {!loading && apis.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="divide-y divide-white/10">
                {apis.map((api) => (
                  <button
                    key={api.id}
                    type="button"
                    onClick={() => startEdit(api)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-100">
                          {api.method}
                        </span>
                        <h3 className="text-sm font-semibold text-white">{api.name}</h3>
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
                        <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs font-medium text-slate-300">
                          {getRuntimeIntentTypeLabel(api.config?.runtime?.intentType || "generic_fact")}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm text-slate-400">{api.url}</p>
                      {api.description ? <p className="mt-1 text-xs text-slate-500">{api.description}</p> : null}
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!loading ? (
            <p className="text-xs text-slate-500">
              O runtime usa até 4 APIs ativas vinculadas ao agente. Priorize as APIs mais importantes para atendimento.
            </p>
          ) : null}

          {!loading ? (
            <Button
              type="button"
              variant="ghost"
              onClick={startCreate}
              className="h-11 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
            >
              <Plus className="h-4 w-4" />
              Criar nova API
            </Button>
          ) : null}
        </div>
      ) : (
        <form id="api-postman-form" onSubmit={handleSave} className="flex h-full min-h-0 flex-col">
          <div className="-mr-6 min-h-0 flex-1 overflow-y-auto pr-6 pt-0">
          <div className="sticky top-0 z-20 mb-5 rounded-2xl border border-white/10 bg-[#0b1221]/95 p-3 shadow-[0_22px_34px_-18px_rgba(2,6,23,1),0_10px_18px_-12px_rgba(8,15,38,0.92)] backdrop-blur">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className={labelClassName}>Nome da API</span>
                {internalApi ? (
                  <div className={cn(inputClassName, "flex items-center text-slate-400")}>{form.name || "API interna"}</div>
                ) : (
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Consulta de pedidos"
                    className={inputClassName}
                    required
                  />
                )}
              </label>
              <div className="flex items-end">
                <ToggleSwitchButton
                  checked={form.active}
                  onChange={(value) => updateForm("active", value)}
                  labelOn="API ativa"
                  labelOff="API inativa"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              {internalApi ? (
                <>
                  <div className="flex h-12 w-full items-center rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-slate-400 lg:max-w-[170px]">
                    {truncateMiddleValue(form.method)}
                  </div>
                  <div className="flex h-12 flex-1 items-center rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-slate-400">
                    {truncateMiddleValue(form.url)}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full lg:max-w-[170px]">
                    <AppSelect options={methodOptions} value={form.method} onChangeValue={(value) => updateForm("method", value)} />
                  </div>
                  <input
                    value={form.url}
                    onChange={(event) => updateForm("url", event.target.value)}
                    placeholder="https://api.exemplo.com/rota"
                    className="h-12 flex-1 rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                    required
                  />
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleSend}
                disabled={sending}
                className="h-12 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 text-sm text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Enviando..." : "Send"}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {editorTabs.map((tab) => {
                const active = editorTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditorTab(tab.id)}
                    className={cn(
                      "infra-tab-motion inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium",
                      active
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-[6px_6px_0_rgba(8,15,38,0.16)]"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
            {runtimeWarnings.length ? (
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    {runtimeWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {editorTab === "runtime" ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Presets rápidos</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {runtimePresetOptions.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="ghost"
                      onClick={() => applyRuntimePreset(preset)}
                      className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelClassName}>Tipo de intenção</span>
                  <div className="mt-1">
                    <AppSelect
                      options={runtimeIntentTypeOptions}
                      value={form.runtimeIntentType}
                      onChangeValue={(value) => updateForm("runtimeIntentType", value || "generic_fact")}
                    />
                  </div>
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <ToggleSwitchButton
                    checked={form.runtimeAutoExecute}
                    onChange={(value) => updateForm("runtimeAutoExecute", value)}
                    labelOn="Autoexecuta"
                    labelOff="Não autoexecuta"
                  />
                  <ToggleSwitchButton
                    checked={form.runtimeRequiresConfirmation}
                    onChange={(value) => updateForm("runtimeRequiresConfirmation", value)}
                    labelOn="Exige confirmação"
                    labelOff="Sem confirmação"
                  />
                </div>
              </div>

              <label className="block">
                <span className={labelClassName}>Descrição para decisão da IA</span>
                <textarea
                  value={form.runtimeDescriptionForIntent}
                  onChange={(event) => updateForm("runtimeDescriptionForIntent", event.target.value)}
                  placeholder="Exemplo: Busca produtos por termo, categoria, cor, material ou disponibilidade."
                  className={cn(textareaClassName, "min-h-[120px]")}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelClassName}>Response path</span>
                  <input
                    value={form.runtimeResponsePath}
                    onChange={(event) => updateForm("runtimeResponsePath", event.target.value)}
                    placeholder="data.items"
                    className={inputClassName}
                  />
                </label>
                <label className="block">
                  <span className={labelClassName}>Preview path</span>
                  <input
                    value={form.runtimePreviewPath}
                    onChange={(event) => updateForm("runtimePreviewPath", event.target.value)}
                    placeholder="summary"
                    className={inputClassName}
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Campos obrigatórios do runtime</p>
                <p className="mt-1 text-sm text-slate-400">
                  Os campos marcados como obrigatórios na aba Body viram `runtime.requiredFields` e bloqueiam execução automática quando faltarem.
                </p>
              </div>
            </div>
          ) : null}

          {editorTab === "authorization" ? (
            <div className="grid gap-4">
              {internalApi ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Autorização preenchida automaticamente pela API interna.
                </div>
              ) : (
                <label className="block">
                    <span className={labelClassName}>Tipo de autorização</span>
                  <div className="mt-1">
                    <AppSelect options={authTypeOptions} value={form.authType} onChangeValue={(value) => updateForm("authType", value)} />
                  </div>
                </label>
              )}

              {!internalApi && form.authType === "bearer" ? (
                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="block">
                    <span className={labelClassName}>Header</span>
                    <input
                      value={form.authHeaderName}
                      onChange={(event) => updateForm("authHeaderName", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Bearer token</span>
                    <input
                      value={form.bearerToken}
                      onChange={(event) => updateForm("bearerToken", event.target.value)}
                      placeholder="Cole o token"
                      className={inputClassName}
                    />
                  </label>
                </div>
              ) : null}

              {!internalApi && form.authType === "api-key" ? (
                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="block">
                    <span className={labelClassName}>Nome do header</span>
                    <input
                      value={form.apiKeyName}
                      onChange={(event) => updateForm("apiKeyName", event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClassName}>Valor da API Key</span>
                    <input
                      value={form.apiKeyValue}
                      onChange={(event) => updateForm("apiKeyValue", event.target.value)}
                      placeholder="Cole a chave"
                      className={inputClassName}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {editorTab === "body" ? (
            <div className="grid gap-4">
              {internalApi ? null : (
                <div className="flex flex-wrap gap-2">
                  {bodySubtabs.map((tab) => {
                    const active = bodySubtab === tab.id

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBodySubtab(tab.id)}
                        className={cn(
                          "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium",
                          active
                            ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                            : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
                        )}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {internalApi && !agendaInternalApi ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  API interna sem body manual. Clique em Send para listar os dados disponíveis.
                </div>
              ) : null}

              {agendaInternalApi ? (
                <div className="grid gap-4">
                  <p className="text-sm text-slate-400">Selecione uma data para listar os horários disponíveis.</p>
                  <label className="block max-w-xs">
                    <span className={labelClassName}>Data</span>
                    <input
                      type="date"
                      value={agendaDate}
                      onChange={(event) => setAgendaDate(event.target.value)}
                      className={inputClassName}
                    />
                  </label>
                  <p className="text-xs text-slate-500">Ao clicar em Send, a consulta busca os horários disponíveis somente dessa data.</p>
                </div>
              ) : null}

              {!internalApi && bodySubtab === "fields" ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">Campos que o agente de IA pode enviar na API.</p>
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_180px_140px_52px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <span>Nome</span>
                      <span>Tipo</span>
                      <span>Obrigatório</span>
                      <span></span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {form.bodyFields.map((field) => (
                        <div key={field.id} className="grid grid-cols-[minmax(0,1.2fr)_180px_140px_52px] gap-3 px-4 py-3">
                          <input
                            value={field.name}
                            onChange={(event) => updateBodyField(field.id, "name", event.target.value)}
                            placeholder="campo"
                            className="h-11 rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                          />
                          <AppSelect
                            options={fieldTypeOptions}
                            value={field.type}
                            onChangeValue={(value) => updateBodyField(field.id, "type", value)}
                            minHeight={44}
                          />
                          <div className="flex items-center">
                            <ToggleSwitchButton
                              checked={field.required}
                              onChange={(value) => updateBodyField(field.id, "required", value)}
                              labelOn="Sim"
                              labelOff="Não"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeBodyField(field.id)}
                            className="h-11 rounded-xl border border-white/10 bg-white/[0.03] px-0 text-sm text-slate-300"
                            aria-label="Remover campo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addBodyField}
                    className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar campo
                  </Button>
                </div>
              ) : null}

              {!internalApi && bodySubtab === "json" ? (
                <div className="grid gap-3">
                  <p className="text-sm text-slate-400">Use para testar manualmente a requisição.</p>
                  <label className="block">
                    <span className={labelClassName}>Body da requisição</span>
                    <textarea
                      value={form.bodyText}
                      onChange={(event) => updateForm("bodyText", event.target.value)}
                      placeholder='{"clienteId": 1}'
                      className={cn(textareaClassName, "min-h-[220px] font-mono text-xs")}
                      spellCheck={false}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {editorTab === "headers" ? (
            <div className="space-y-3">
              {internalApi ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                  Headers preenchidos automaticamente pela API interna.
                </div>
              ) : null}
              {!internalApi ? (
                <>
              {form.headerRows.map((row) => (
                <div key={row.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_52px]">
                  <input
                    value={row.key}
                    onChange={(event) => updateHeaderRow(row.id, "key", event.target.value)}
                    placeholder="Header"
                    className="h-12 rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                  />
                  <input
                    value={row.value}
                    onChange={(event) => updateHeaderRow(row.id, "value", event.target.value)}
                    placeholder="Valor"
                    className="h-12 rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeHeaderRow(row.id)}
                    className="h-12 rounded-xl border border-white/10 bg-white/[0.03] px-0 text-sm text-slate-300"
                    aria-label="Remover header"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                onClick={addHeaderRow}
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
              >
                <Plus className="h-4 w-4" />
                Adicionar header
              </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {editorTab === "description" ? (
            <div className="grid gap-4">
              <label className="block">
                <span className={labelClassName}>Descrição</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Resumo interno para identificar a integração"
                  className={cn(textareaClassName, "min-h-[220px]")}
                />
              </label>
            </div>
          ) : null}

          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Response</p>
                <p className="mt-1 text-xs text-slate-500">Resposta da API após clicar em Send.</p>
              </div>
              {responseResult ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
                      responseResult.ok === false
                        ? "border-red-500/20 bg-red-500/10 text-red-200"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
                    )}
                  >
                    {responseResult.status || 0}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-slate-300">
                    <Clock3 className="h-3 w-3" />
                    {responseResult.durationMs ?? "--"}ms
                  </span>
                </div>
              ) : null}
            </div>

            {!responseResult ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-[#0a1020] px-4 py-6 text-sm text-slate-500">
                Nenhuma requisição enviada ainda
              </div>
            ) : (
              <JsonCodeBlock value={responseValue} className="mt-4 max-h-[320px] overflow-y-auto" />
            )}
          </div>
          </div>
          </div>
        </form>
      )}
    </section>
  )
}
