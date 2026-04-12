"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, FlaskConical, History, Pencil, PlugZap, Plus, RotateCcw, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  configText: "{}",
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

export function ApiManager({ project }) {
  const projectIdentifier = project.routeKey || project.slug || project.id
  const endpoint = `/api/app/projetos/${projectIdentifier}/apis`
  const [apis, setApis] = useState(() => (project.apis || []).map(normalizeInitialApi))
  const [linkedApiIds, setLinkedApiIds] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)
  const [restoringVersionId, setRestoringVersionId] = useState(null)
  const [savingLinks, setSavingLinks] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [status, setStatus] = useState({ type: "idle", message: "" })

  const editing = useMemo(() => Boolean(form.id), [form.id])

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

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function startEdit(api) {
    setForm({
      id: api.id,
      name: api.name,
      url: api.url,
      description: api.description || "",
      active: api.active !== false,
      configText: api.configText || "{}",
    })
    setStatus({ type: "idle", message: "" })
    setTestResult(null)
  }

  function resetForm() {
    setForm(emptyForm)
    setStatus({ type: "idle", message: "" })
  }

  async function saveApi(event) {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      let parsedConfig = {}
      try {
        parsedConfig = form.configText?.trim() ? JSON.parse(form.configText) : {}
      } catch {
        throw new Error("JSON de configuracoes invalido.")
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
          metodo: "GET",
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
      setForm(emptyForm)
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
      const response = await fetch(`${endpoint}/${api.id}/test`, { method: "POST" })
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

  async function restoreApiVersion(api, versionId) {
    if (!api?.id || !versionId || restoringVersionId) {
      return
    }

    const confirmed = window.confirm("Restaurar esta versao da API? O estado atual sera salvo no historico antes do rollback.")
    if (!confirmed) {
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

  return (
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            <PlugZap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">APIs conectadas</h2>
            <p className="text-sm text-zinc-500">Cadastre endpoints GET para uso da inteligencia.</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={resetForm}>
          <Plus className="h-4 w-4" />
          Nova API
        </Button>
      </div>

      <form className="mt-5 grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4" onSubmit={saveApi}>
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Nome</span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">URL GET</span>
            <input
              value={form.url}
              onChange={(event) => updateForm("url", event.target.value)}
              placeholder="https://exemplo.com/api/produtos"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Descricao</span>
          <textarea
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            className="mt-1 min-h-16 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
          />
        </label>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-700">Configuracoes JSON</span>
              <Button type="button" variant="outline" size="sm" onClick={applyPricingTemplate}>
                Usar modelo de valores
              </Button>
            </div>
            <textarea
              value={form.configText}
              onChange={(event) => updateForm("configText", event.target.value)}
              className="mt-1 min-h-64 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              spellCheck={false}
            />
          </label>

          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-3">
            <p className="text-sm font-medium text-zinc-800">Exemplo para API de valores</p>
            <p className="mt-1 text-xs text-zinc-500">
              A URL deve responder JSON. O runtime usa `responsePath`, `previewPath` e `fields.path`.
            </p>
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
              {pricingApiResponseExampleText}
            </pre>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateForm("active", event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            API ativa
          </label>
          <div className="flex gap-2">
            {editing ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" disabled={saving} className="gap-2">
              <PlugZap className="h-4 w-4" />
              {saving ? "Salvando..." : editing ? "Atualizar API" : "Criar API"}
            </Button>
          </div>
        </div>
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
                              onClick={() => restoreApiVersion(api, version.id)}
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
          <Button type="button" variant="outline" onClick={saveApiLinks} disabled={savingLinks}>
            {savingLinks ? "Salvando vinculos..." : "Salvar vinculos do agente"}
          </Button>
        </div>
      ) : null}

      {testResult ? (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-950">Teste: {testResult.apiName}</p>
            <span
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium",
                testResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {testResult.status || 0} {testResult.statusText}
            </span>
          </div>
          {testResult.durationMs !== null && testResult.durationMs !== undefined ? (
            <p className="mt-2 text-xs text-zinc-500">{testResult.durationMs}ms</p>
          ) : null}
          {Array.isArray(testResult.fields) && testResult.fields.length ? (
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Campos extraidos</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {testResult.fields.map((field) => (
                  <div key={`${field.nome}-${field.valor}`} className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                    <p className="text-xs font-medium text-zinc-700">{field.nome}</p>
                    <p className="mt-1 text-xs text-zinc-500">{String(field.valor)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
            {testResult.preview || "Sem corpo de resposta."}
          </pre>
        </div>
      ) : null}
    </section>
  )
}
