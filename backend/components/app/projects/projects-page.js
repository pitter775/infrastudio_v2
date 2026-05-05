"use client"

import { FolderKanban } from "lucide-react"

import { AppPageHeader } from "@/components/app/page-header"
import { AppProjectCard } from "@/components/app/projects/project-card"

export function AppProjectsPage({ projects, user }) {
  return (
    <div className="mx-auto max-w-7xl">
      <AppPageHeader
        eyebrow="Workspace"
        title="Projetos"
        description={`Bem-vindo, ${user?.name || "usuário"}. Acesse os projetos vinculados à sua conta.`}
      />

      {projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <AppProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-zinc-950">Nenhum projeto vinculado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Quando um projeto for vinculado ao seu usuário, ele aparecerá nesta tela.
          </p>
        </div>
      )}
    </div>
  )
}
