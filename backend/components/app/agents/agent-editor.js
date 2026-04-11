"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AgentEditor({ project }) {
  const router = useRouter()
  const agent = project.agent
  const [name, setName] = useState(agent?.name || "")
  const [description, setDescription] = useState(agent?.description || "")
  const [prompt, setPrompt] = useState(agent?.prompt || "")
  const [active, setActive] = useState(agent?.active !== false)
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!agent?.id) {
      setStatus({ type: "error", message: "Nenhum agente ativo para editar." })
      return
    }

    setSaving(true)
    setStatus({ type: "idle", message: "" })

    try {
      const response = await fetch(`/api/app/projetos/${project.slug || project.id}/agente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agenteId: agent.id,
          nome: name,
          descricao: description,
          promptBase: prompt,
          ativo: active,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Nao foi possivel salvar o agente.")
      }

      setStatus({ type: "success", message: "Agente salvo." })
      router.refresh()
    } catch (error) {
      setStatus({ type: "error", message: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (!agent) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Agente ativo</h2>
            <p className="text-sm text-zinc-600">Nenhum agente ativo encontrado para este projeto.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Agente ativo</h2>
          <p className="text-sm text-zinc-500">Ajuste nome, descricao e prompt principal.</p>
        </div>
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
    </section>
  )
}
