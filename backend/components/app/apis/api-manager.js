"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, FlaskConical, Pencil, PlugZap, Plus, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const emptyForm = {
  id: null,
  name: "",
  url: "",
  description: "",
  active: true,
}

function normalizeInitialApi(api) {
  return {
    id: api.id,
    name: api.name,
    url: api.url,
    description: api.description || "",
    active: api.active !== false,
    method: api.method || "GET",
  }
}

export function ApiManager({ project }) {
  const endpoint = `/api/app/projetos/${project.slug || project.id}/apis`
  const [apis, setApis] = useState(() => (project.apis || []).map(normalizeInitialApi))
  const [linkedApiIds, setLinkedApiIds] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState(null)
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

  function toggleApiLink(apiId) {
    setLinkedApiIds((current) =>
      current.includes(apiId) ? current.filter((item) => item !== apiId) : [...current, apiId],
    )
  }

  async function saveApiLinks() {
    setSavingLinks(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${project.slug || project.id}/agente/apis`, {
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
          <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
            {testResult.preview || "Sem corpo de resposta."}
          </pre>
        </div>
      ) : null}
    </section>
  )
}
