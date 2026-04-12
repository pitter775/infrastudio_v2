"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, History, Link2, MessageSquareText, RotateCcw, Save, Sparkles } from "lucide-react"

import { AgentSimulator } from "@/components/app/agents/agent-simulator"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AgentEditor({ project }) {
  const router = useRouter()
  const agent = project.agent
  const projectIdentifier = project.routeKey || project.slug || project.id
  const initialRuntimeConfig = agent?.runtimeConfig ? JSON.stringify(agent.runtimeConfig, null, 2) : ""
  const [name, setName] = useState(agent?.name || "")
  const [description, setDescription] = useState(agent?.description || "")
  const [prompt, setPrompt] = useState(agent?.prompt || "")
  const [runtimeConfig, setRuntimeConfig] = useState(initialRuntimeConfig)
  const [active, setActive] = useState(agent?.active !== false)
  const [versions, setVersions] = useState(agent?.versions || [])
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState("")
  const [testOpen, setTestOpen] = useState(false)
  const [setupBusinessContext, setSetupBusinessContext] = useState("")
  const [setupSiteUrl, setSetupSiteUrl] = useState("")
  const [creatingAgent, setCreatingAgent] = useState(false)

  function applyAgentState(nextAgent) {
    setName(nextAgent?.nome || nextAgent?.name || "")
    setDescription(nextAgent?.descricao || nextAgent?.description || "")
    setPrompt(nextAgent?.promptBase || nextAgent?.prompt || "")
    setRuntimeConfig(nextAgent?.runtimeConfig ? JSON.stringify(nextAgent.runtimeConfig, null, 2) : "")
    setActive(nextAgent?.ativo !== false && nextAgent?.active !== false)
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
      let parsedRuntimeConfig = null
      if (runtimeConfig.trim()) {
        parsedRuntimeConfig = JSON.parse(runtimeConfig)
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
        throw new Error(data.error || "Nao foi possivel salvar o agente.")
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

      setStatus({ type: "success", message: "Agente salvo." })
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

    const confirmed = window.confirm("Restaurar esta versao do agente? O estado atual sera salvo no historico antes do rollback.")
    if (!confirmed) {
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
        throw new Error(data.error || "Nao foi possivel restaurar a versao.")
      }

      applyAgentState(data.agent)
      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setStatus({ type: "success", message: "Versao restaurada." })
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setRestoringId("")
    }
  }

  async function handleCreateAgent(event) {
    event.preventDefault()

    if (!setupBusinessContext.trim()) {
      setStatus({ type: "error", message: "Conte um pouco sobre o negocio para criar o agente." })
      return
    }

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
          businessContext: setupBusinessContext,
        }),
      })
      const createData = await createResponse.json().catch(() => ({}))

      if (!createResponse.ok) {
        throw new Error(createData.error || "Nao foi possivel criar o agente.")
      }

      const createdAgent = createData.agent

      if (setupSiteUrl.trim() && createdAgent?.id) {
        const summaryResponse = await fetch(`/api/app/projetos/${projectIdentifier}/agente/site-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: setupSiteUrl.trim() }),
        })
        const summaryData = await summaryResponse.json().catch(() => ({}))

        if (summaryResponse.ok && summaryData.summary) {
          const mergedPrompt = [createdAgent.promptBase || createdAgent.prompt || "", "Resumo do site:", summaryData.summary]
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

      setStatus({ type: "success", message: "Agente e widget padrao criados." })
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
              <p className="text-sm text-zinc-600">Informe o negocio e, se tiver, a URL do site.</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600">
            <Sparkles className="h-3.5 w-3.5" />
            Cria widget padrao junto
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleCreateAgent}>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Sobre o negocio</span>
            <textarea
              value={setupBusinessContext}
              onChange={(event) => setSetupBusinessContext(event.target.value)}
              placeholder="O que vende, para quem atende, diferenciais, limites e tom desejado."
              className="mt-1 min-h-28 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              required
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
            <p className="text-sm text-zinc-500">Ajuste nome, descricao e prompt principal.</p>
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

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Descricao</span>
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
            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">Evite dados que nao pode prometer.</span>
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Runtime config JSON</span>
          <textarea
            value={runtimeConfig}
            onChange={(event) => setRuntimeConfig(event.target.value)}
            placeholder='{"leadCapture":{"mode":"after_offer"},"pricingCatalog":{"enabled":true,"items":[]}}'
            className="mt-1 min-h-44 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Configuracao operacional premium do agente. Use JSON valido para regras de oferta, CTA e captura de lead.
          </p>
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
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar agente"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-zinc-200 pt-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-950">Historico de versoes</h3>
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
                  onClick={() => handleRestoreVersion(version.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restoringId === version.id ? "Restaurando..." : "Restaurar"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
            Nenhuma versao salva ainda. O historico sera criado antes do proximo salvamento.
          </p>
        )}
      </div>

      <AgentSimulator project={project} agent={agent} open={testOpen} onOpenChange={setTestOpen} />
    </section>
  )
}
