"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, History, Link2, MessageSquareText, RotateCcw, Save, Sparkles, Wand2 } from "lucide-react"

import { AgentSimulator } from "@/components/app/agents/agent-simulator"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { buildAgentRuntimeConfigTemplate, normalizeAgentRuntimeConfig } from "@/lib/agent-runtime-config"
import { cn } from "@/lib/utils"

const runtimeConfigTemplateText = JSON.stringify(buildAgentRuntimeConfigTemplate(), null, 2)

function formatRuntimeConfigText(value) {
  const parsed = typeof value === "string" && value.trim() ? JSON.parse(value) : null
  const normalized = normalizeAgentRuntimeConfig(parsed)
  return normalized ? JSON.stringify(normalized, null, 2) : ""
}

function getRuntimeConfigValidationError(value) {
  const rawValue = String(value || "")
  if (!rawValue.trim()) {
    return ""
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "Runtime config precisa ser um objeto JSON."
    }

    return ""
  } catch (error) {
    return `JSON inválido: ${error.message}`
  }
}

function buildEditorState(agent) {
  return {
    name: agent?.name || "",
    description: agent?.description || "",
    prompt: agent?.prompt || "",
    runtimeConfig: agent?.runtimeConfig ? JSON.stringify(normalizeAgentRuntimeConfig(agent.runtimeConfig), null, 2) : "",
    structuredConfigDraft: agent?.structuredConfigDraft || null,
    structuredConfig: agent?.structuredConfig || null,
    active: agent?.active !== false,
  }
}

export function AgentEditor({ project, onAgentSummaryChange }) {
  const router = useRouter()
  const agent = project.agent
  const projectIdentifier = project.routeKey || project.slug || project.id
  const agentSourceSnapshot = useMemo(
    () =>
      JSON.stringify({
        id: agent?.id || "",
        name: agent?.name || "",
        description: agent?.description || "",
        prompt: agent?.prompt || "",
        runtimeConfig: agent?.runtimeConfig ?? null,
        structuredConfig: agent?.structuredConfig ?? null,
        structuredConfigDraft: agent?.structuredConfigDraft ?? null,
        active: agent?.active !== false,
        versions: agent?.versions || [],
      }),
    [agent?.active, agent?.description, agent?.id, agent?.name, agent?.prompt, agent?.runtimeConfig, agent?.structuredConfig, agent?.structuredConfigDraft, agent?.versions],
  )
  const initialEditorState = useMemo(() => buildEditorState(agent), [agent])
  const [name, setName] = useState(initialEditorState.name)
  const [description, setDescription] = useState(initialEditorState.description)
  const [prompt, setPrompt] = useState(initialEditorState.prompt)
  const [runtimeConfig, setRuntimeConfig] = useState(initialEditorState.runtimeConfig)
  const [active, setActive] = useState(initialEditorState.active)
  const [lastSavedState, setLastSavedState] = useState(initialEditorState)
  const [structuredDraft, setStructuredDraft] = useState(initialEditorState.structuredConfigDraft)
  const [versions, setVersions] = useState(agent?.versions || [])
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [saving, setSaving] = useState(false)
  const [structuring, setStructuring] = useState(false)
  const [applyingStructure, setApplyingStructure] = useState(false)
  const [restoringId, setRestoringId] = useState("")
  const [testOpen, setTestOpen] = useState(false)
  const [setupBusinessContext, setSetupBusinessContext] = useState("")
  const [setupSiteUrl, setSetupSiteUrl] = useState("")
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [restoreConfirmId, setRestoreConfirmId] = useState("")
  const runtimeConfigValidationError = getRuntimeConfigValidationError(runtimeConfig)
  const isDirty =
    name !== lastSavedState.name ||
    description !== lastSavedState.description ||
    prompt !== lastSavedState.prompt ||
    runtimeConfig !== lastSavedState.runtimeConfig ||
    active !== lastSavedState.active

  useEffect(() => {
    setName(initialEditorState.name)
    setDescription(initialEditorState.description)
    setPrompt(initialEditorState.prompt)
    setRuntimeConfig(initialEditorState.runtimeConfig)
    setActive(initialEditorState.active)
    setLastSavedState(initialEditorState)
    setStructuredDraft(initialEditorState.structuredConfigDraft)
    setVersions(agent?.versions || [])
  }, [agent?.versions, agentSourceSnapshot, initialEditorState])

  function applyAgentState(nextAgent) {
    const nextState = {
      name: nextAgent?.nome || nextAgent?.name || "",
      description: nextAgent?.descricao || nextAgent?.description || "",
      prompt: nextAgent?.promptBase || nextAgent?.prompt || "",
      runtimeConfig: nextAgent?.runtimeConfig ? JSON.stringify(normalizeAgentRuntimeConfig(nextAgent.runtimeConfig), null, 2) : "",
      structuredConfigDraft: nextAgent?.structuredConfigDraft || null,
      structuredConfig: nextAgent?.structuredConfig || null,
      active: nextAgent?.ativo !== false && nextAgent?.active !== false,
    }
    setName(nextState.name)
    setDescription(nextState.description)
    setPrompt(nextState.prompt)
    setRuntimeConfig(nextState.runtimeConfig)
    setStructuredDraft(nextState.structuredConfigDraft)
    setActive(nextState.active)
    setLastSavedState(nextState)
  }

  async function handleStructureAgent(mode = "analyze") {
    if (!agent?.id || structuring) {
      return
    }

    setStructuring(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "structure_agent_text",
          mode,
          sourceText: prompt,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível organizar o agente.")
      }

      setStructuredDraft(data.draft?.structuredConfig || data.agent?.structuredConfigDraft || null)
      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }
      setStatus({ type: "success", message: "Rascunho estruturado criado. Revise e aplique quando estiver correto." })
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setStructuring(false)
    }
  }

  async function handleApplyStructuredConfig() {
    if (!agent?.id || !structuredDraft || applyingStructure) {
      return
    }

    setApplyingStructure(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "apply_structured_config",
          structuredConfig: structuredDraft,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível aplicar a estrutura.")
      }

      applyAgentState(data.agent)
      setStructuredDraft(null)
      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setStatus({ type: "success", message: "Estrutura aplicada ao agente." })
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setApplyingStructure(false)
    }
  }

  async function handleDiscardStructuredDraft() {
    if (!agent?.id || !structuredDraft || applyingStructure) {
      return
    }

    setApplyingStructure(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "discard_structured_config_draft",
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível descartar o rascunho.")
      }

      setStructuredDraft(null)
      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setStatus({ type: "success", message: "Rascunho descartado." })
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setApplyingStructure(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!agent?.id) {
      setStatus({ type: "error", message: "Nenhum agente ativo para editar." })
      return
    }

    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      if (runtimeConfigValidationError) {
        throw new Error(runtimeConfigValidationError)
      }

      let parsedRuntimeConfig = null
      if (runtimeConfig.trim()) {
        parsedRuntimeConfig = normalizeAgentRuntimeConfig(JSON.parse(runtimeConfig))
        if (!parsedRuntimeConfig || typeof parsedRuntimeConfig !== "object" || Array.isArray(parsedRuntimeConfig)) {
          throw new Error("Runtime config precisa ser um objeto JSON.")
        }
      }

      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agenteId: agent.id,
          nome: name,
          descricao: description,
          promptBase: prompt,
          runtimeConfig: parsedRuntimeConfig,
          ativo: active,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível salvar o agente.")
      }

      if (Array.isArray(data.agent?.versions)) {
        setVersions(data.agent.versions)
      } else {
        const versionsResponse = await fetch(`/api/app/projetos/${projectIdentifier}/agente`)
        const versionsData = await versionsResponse.json().catch(() => ({}))
        if (Array.isArray(versionsData.versions)) {
          setVersions(versionsData.versions)
        }
      }

      if (agent?.prompt !== prompt) {
        onAgentSummaryChange?.({
          projectId: project.id,
          projectSlug: project.slug,
          changed: true,
        })
      }

      setStatus({ type: "success", message: "Agente salvo." })
      setLastSavedState({
        name,
        description,
        prompt,
        runtimeConfig: parsedRuntimeConfig ? JSON.stringify(parsedRuntimeConfig, null, 2) : "",
        active,
      })
      setRuntimeConfig(parsedRuntimeConfig ? JSON.stringify(parsedRuntimeConfig, null, 2) : "")
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleRestoreVersion(versionId) {
    if (!versionId || restoringId) {
      return
    }

    setRestoringId(versionId)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
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
        throw new Error(data.error || "Não foi possível restaurar a versão.")
      }

      applyAgentState(data.agent)
      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setStatus({ type: "success", message: "Versão restaurada." })
      setRestoreConfirmId("")
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setRestoringId("")
    }
  }

  async function handleCreateAgent(event) {
    event.preventDefault()

    setCreatingAgent(true)
    setStatus({ type: "idle", message: "" })

    try {
      const createResponse = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_agent",
          businessContext: setupBusinessContext.trim(),
        }),
      })
      const createData = await createResponse.json().catch(() => ({}))

      if (!createResponse.ok) {
        throw new Error(createData.error || "Não foi possível criar o agente.")
      }

      const createdAgent = createData.agent

      if (setupSiteUrl.trim() && createdAgent?.id) {
        const summaryResponse = await fetch(`/api/app/projetos/${projectIdentifier}/agente/site-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: setupSiteUrl.trim(),
            currentPrompt: setupBusinessContext.trim(),
          }),
        })
        const summaryData = await summaryResponse.json().catch(() => ({}))

        if (summaryResponse.ok && (summaryData.mergedEditorDraft || summaryData.summary)) {
          const basePrompt = String(createdAgent.promptBase || createdAgent.prompt || setupBusinessContext || "").trim()
          const mergedPrompt = basePrompt
            ? [
                basePrompt,
                summaryData.summary ? `Resumo do site:\n${summaryData.summary}` : "",
                summaryData.promptSuggestion ? `Prompt base sugerido:\n${summaryData.promptSuggestion}` : "",
              ]
                .filter(Boolean)
                .join("\n\n")
            : String(summaryData.mergedEditorDraft || "").trim()
              || [summaryData.summary ? `Resumo do site:\n${summaryData.summary}` : "", summaryData.promptSuggestion ? `Prompt base sugerido:\n${summaryData.promptSuggestion}` : ""]
                .filter(Boolean)
                .join("\n\n")

          await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              agenteId: createdAgent.id,
              nome: createdAgent.nome || createdAgent.name || `${project.name} Assistente`,
              descricao: createdAgent.descricao || createdAgent.description || setupBusinessContext,
              promptBase: mergedPrompt,
              runtimeConfig: createdAgent.runtimeConfig ?? null,
              ativo: true,
            }),
          })
        }
      }

      setStatus({ type: "success", message: "Agente e widget padrão criados." })
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setCreatingAgent(false)
    }
  }

  if (!agent) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Criar agente</h2>
              <p className="text-sm text-zinc-600">Informe o negócio e, se tiver, a URL do site.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
            <Sparkles className="h-3.5 w-3.5" />
            Cria widget padrão junto
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleCreateAgent}>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Sobre o negócio</span>
            <textarea
              value={setupBusinessContext}
              onChange={(event) => setSetupBusinessContext(event.target.value)}
              placeholder="Descreva seu negócio, os serviços ou produtos que oferece, seus diferenciais, valores, regras, limites e como você gosta de atender seus clientes. Quanto mais claro e detalhado, melhor o agente vai conversar."
              className="mt-1 min-h-28 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">URL do site opcional</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 focus-within:border-zinc-950 focus-within:ring-2 focus-within:ring-zinc-950/10">
              <Link2 className="h-4 w-4 text-zinc-400" />
              <input
                value={setupSiteUrl}
                onChange={(event) => setSetupSiteUrl(event.target.value)}
                placeholder="https://cliente.com.br"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">Se informado, o sistema tenta capturar resumo e logo do site.</p>
          </label>

          {status.message ? (
            <p
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                status.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {status.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={creatingAgent} className="gap-2">
              <Save className="h-4 w-4" />
              {creatingAgent ? "Criando..." : "Criar agente"}
            </Button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Agente ativo</h2>
            <p className="text-sm text-zinc-500">Ajuste nome, descrição e prompt principal.</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => setTestOpen(true)}>
          <MessageSquareText className="h-4 w-4" />
          Testar agente
        </Button>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Nome</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
            required
          />
        </label>

        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-sky-950">Estrutura do agente</p>
              <p className="text-xs text-sky-700">Organize o texto em campos estruturados antes de ativar no runtime.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
                disabled={structuring || !prompt.trim()}
                onClick={() => handleStructureAgent(agent?.structuredConfig ? "update" : "analyze")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {structuring ? "Organizando..." : agent?.structuredConfig ? "Atualizar com IA" : "Organizar com IA"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-sky-300 bg-white text-sky-800 hover:bg-sky-100"
                disabled={structuring || !prompt.trim()}
                onClick={() => handleStructureAgent("reset")}
              >
                Resetar e importar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={applyingStructure || !structuredDraft}
                onClick={handleApplyStructuredConfig}
              >
                {applyingStructure ? "Aplicando..." : "Aplicar estrutura"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={applyingStructure || !structuredDraft}
                onClick={handleDiscardStructuredDraft}
              >
                Descartar
              </Button>
            </div>
          </div>

          {structuredDraft ? (
            <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3">
              <div className="grid gap-2 text-xs text-zinc-700 sm:grid-cols-4">
                <span>Tipo: {structuredDraft.diagnostics?.detectedType || "detectado por IA"}</span>
                <span>Planos: {structuredDraft.pricingCatalog?.items?.length || 0}</span>
                <span>Conhecimento: {structuredDraft.knowledgeBase?.length || 0}</span>
                <span>Módulos: {structuredDraft.diagnostics?.modules?.length || 0}</span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-sky-800">Ver JSON do rascunho</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                  {JSON.stringify(structuredDraft, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Descrição</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 min-h-20 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Prompt base</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="mt-1 min-h-48 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
            required
          />
          <div className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">Inclua produtos, limites e tom.</span>
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">Diga quando deve pedir humano.</span>
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">Evite dados que não pode prometer.</span>
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Runtime config JSON</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={Boolean(runtimeConfigValidationError)}
              onClick={() => {
                try {
                  setRuntimeConfig(formatRuntimeConfigText(runtimeConfig))
                  setStatus({ type: "idle", message: "" })
                } catch (error) {
                  setStatus({ type: "error", message: error.message })
                }
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Limpar JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRuntimeConfig(runtimeConfigTemplateText)
                setStatus({ type: "idle", message: "" })
              }}
            >
              Usar modelo
            </Button>
          </div>
          <textarea
            value={runtimeConfig}
            onChange={(event) => setRuntimeConfig(event.target.value)}
            placeholder={runtimeConfigTemplateText}
            className={cn(
              "mt-1 min-h-44 w-full resize-y rounded-lg border bg-white px-3 py-2 font-mono text-sm outline-none transition focus:ring-2",
              runtimeConfigValidationError
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                : "border-zinc-300 focus:border-zinc-950 focus:ring-zinc-950/10",
            )}
          />
          {runtimeConfigValidationError ? (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {runtimeConfigValidationError}
            </p>
          ) : null}
          <div className="mt-2 space-y-2 text-xs text-zinc-500">
            <p>Só estas chaves são usadas hoje pelo runtime: `business`, `sales`, `leadCapture` e `pricingCatalog`.</p>
            <p>Ao salvar, o sistema limpa campos vazios e remove chaves que o orquestrador não consome.</p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Agente ativo neste projeto
        </label>

        {status.message ? (
          <p
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              status.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {status.message}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || Boolean(runtimeConfigValidationError) || !isDirty} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar agente"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-zinc-200 pt-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-950">Histórico de versões</h3>
        </div>

        {versions.length ? (
          <div className="mt-3 space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-950">v{version.versionNumber} - {version.nome}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {new Date(version.createdAt).toLocaleString("pt-BR")} - {version.source === "rollback" ? "rollback" : "salvamento"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={Boolean(restoringId)}
                              onClick={() => setRestoreConfirmId(version.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restoringId === version.id ? "Restaurando..." : "Restaurar"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
            Nenhuma versão salva ainda. O histórico será criado antes do próximo salvamento.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(restoreConfirmId)}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreConfirmId("")
          }
        }}
        title="Restaurar versão do agente"
        description="O estado atual será salvo no histórico antes do rollback."
        confirmLabel="Restaurar versão"
        loading={Boolean(restoringId)}
        onConfirm={() => restoreConfirmId ? handleRestoreVersion(restoreConfirmId) : null}
      />

      <AgentSimulator
        project={project}
        agent={agent}
        open={testOpen}
        onOpenChange={setTestOpen}
        onUsageRecorded={() => router.refresh()}
      />
    </section>
  )
}
