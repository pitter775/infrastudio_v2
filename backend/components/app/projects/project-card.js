"use client"

import Link from "next/link"
import { ArrowUpRight, Bot, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

const statusLabels = {
  ativo: "Ativo",
  inativo: "Inativo",
  pausado: "Pausado",
}

export function AppProjectCard({ project }) {
  const status = String(project.status || "ativo").toLowerCase()
  const active = status === "ativo"

  return (
    <Link
      href={`/app/projetos/${project.slug || project.id}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-950">{project.name}</h2>
            <p className="truncate text-sm text-zinc-500">{project.type}</p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-zinc-950" />
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 text-sm text-zinc-600">{project.description}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
            active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-zinc-200 bg-zinc-50 text-zinc-600",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {statusLabels[status] || project.status || "Ativo"}
        </span>
        {project.isDemo ? <span className="text-xs font-medium text-zinc-500">Demo</span> : null}
      </div>
    </Link>
  )
}
