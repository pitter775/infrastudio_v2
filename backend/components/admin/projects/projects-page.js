'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { List, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const emptyForm = {
  nome: '',
  tipo: 'Projeto',
  descricao: '',
  status: 'ativo',
}

function mapProjectToForm(project) {
  return {
    id: project.id,
    nome: project.name,
    tipo: project.type,
    descricao: project.description === 'Sem descricao cadastrada.' ? '' : project.description,
    status: project.status === 'inativo' ? 'inativo' : 'ativo',
  }
}

function canEditProject(user, project) {
  if (!user || !project) {
    return false
  }

  if (user.role === 'admin') {
    return true
  }

  return project.owner?.id === user.id
}

function canDeleteProject(user, project, projects) {
  if (!user || !project) {
    return false
  }

  if (user.role === 'admin') {
    return true
  }

  if (project.owner?.id !== user.id) {
    return false
  }

  return (projects?.length ?? 0) > 1
}

export function AdminProjectsPage({ projects: initialProjects, user }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [loadingProjectSlug, setLoadingProjectSlug] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const isAdmin = user?.role === 'admin'

  function handleProjectSelect(project) {
    const projectIdentifier = project.routeKey || project.slug || project.id
    setLoadingProjectSlug(projectIdentifier)
    router.push(`/admin/projetos/${projectIdentifier}`)
  }

  async function refreshProjects() {
    const response = await fetch('/api/admin/projetos', { cache: 'no-store' })
    const payload = await response.json()

    if (response.ok) {
      setProjects(payload.projects)
      router.refresh()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)

    const response = await fetch('/api/admin/projetos', {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const payload = await response.json()

    if (!response.ok) {
      setFeedback(payload.error ?? 'Nao foi possivel salvar o projeto.')
      setSaving(false)
      return
    }

    await refreshProjects()
    setForm(emptyForm)
    setFeedback(form.id ? 'Projeto atualizado.' : 'Projeto criado.')
    setSaving(false)
  }

  function handleNewProject() {
    setForm(emptyForm)
    setFeedback(null)
    setSheetOpen(true)
  }

  function handleEditProject(project) {
    setForm(mapProjectToForm(project))
    setFeedback(null)
    setSheetOpen(true)
  }

  async function handleDeleteProject(project) {
    setDeleteTarget(project)
    setDeleteConfirmation('')
    setDeleteError('')
    setFeedback(null)
  }

  async function confirmDeleteProject() {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.name) {
      setDeleteError('Digite exatamente o nome do projeto para confirmar.')
      return
    }

    setDeleting(true)
    setDeleteError('')

    const response = await fetch(`/api/admin/projetos/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationName: deleteConfirmation.trim() }),
    })
    const payload = await response.json()

    if (!response.ok) {
      const code = payload.code ? `[${payload.code}] ` : ''
      setDeleteError(`${code}${payload.error ?? 'Nao foi possivel excluir o projeto.'}`)
      setDeleting(false)
      return
    }

    await refreshProjects()
    setForm(emptyForm)
    setDeleteTarget(null)
    setDeleteConfirmation('')
    setDeleteError('')
    setDeleting(false)
    setFeedback('Projeto excluido.')
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 56 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      <AdminPageHeader
        title="Projetos"
        description={
          user?.role === 'admin'
            ? 'Perfil admin: acesso completo a todos os projetos cadastrados.'
            : 'Projetos vinculados ao seu usuario.'
        }
        actions={
          <Button
            type="button"
            onClick={handleNewProject}
            className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Novo projeto
          </Button>
        }
      />

      <div className="mb-8 flex items-center gap-3">
        <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            <span>{projects.length} projetos</span>
          </div>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <div key={project.id} className="min-w-0">
              <AdminProjectCard
                project={project}
                index={index}
                onSelect={handleProjectSelect}
                onEdit={canEditProject(user, project) ? handleEditProject : undefined}
                loading={loadingProjectSlug === (project.routeKey || project.slug || project.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-6 text-sm text-slate-400">
          Nenhum projeto disponivel para este usuario.
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} modal={false}>
          <SheetContent
            side="right"
            showOverlay={false}
            closeOnInteractOutside={false}
            closeOnEscapeKeyDown={false}
            className="right-[19px] top-[54px] bottom-[18px] h-auto overflow-hidden rounded-l-lg border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-[-24px_0_48px_rgba(0,0,0,0.42)]"
            style={{ width: '1040px', maxWidth: 'calc(100vw - 38px)' }}
          >
            <SheetTitle className="sr-only">
              {form.id ? 'Editar projeto' : 'Novo projeto'}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Criar, editar e excluir projetos.
            </SheetDescription>

            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-white/5 px-6 py-5 pr-12">
                <h2 className="text-lg font-semibold text-white">
                  {form.id ? 'Editar projeto' : 'Novo projeto'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Criar, editar e excluir projetos.</p>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
                <div className="overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  value={form.nome}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nome: event.target.value }))
                  }
                  placeholder="Nome do projeto"
                  className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />
                <textarea
                  value={form.descricao}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, descricao: event.target.value }))
                  }
                  placeholder="Descricao"
                  rows={5}
                  className="w-full resize-none rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      status: current.status === 'ativo' ? 'inativo' : 'ativo',
                    }))
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm text-slate-300"
                >
                  <span>
                    <span className="block font-semibold text-white">Status</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {form.status === 'ativo' ? 'Projeto ativo' : 'Projeto inativo'}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'relative h-6 w-11 rounded-full border transition-colors',
                      form.status === 'ativo'
                        ? 'border-emerald-400/30 bg-emerald-400/20'
                        : 'border-white/10 bg-slate-800',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
                        form.status === 'ativo' ? 'translate-x-5' : 'translate-x-1',
                      )}
                    />
                  </span>
                </button>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 hover:bg-sky-500/15"
                  >
                    {saving ? (
                      <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : form.id ? (
                      <Pencil className="mr-1.5 h-4 w-4" />
                    ) : (
                      <Plus className="mr-1.5 h-4 w-4" />
                    )}
                    {form.id ? 'Salvar' : 'Criar'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setForm(emptyForm)
                      setFeedback(null)
                    }}
                    className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                  >
                    Limpar
                  </Button>
                  {form.id && canEditProject(user, projects.find((item) => item.id === form.id)) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const project = projects.find((item) => item.id === form.id)

                        if (project) {
                          handleDeleteProject(project)
                        }
                      }}
                      disabled={!canDeleteProject(user, projects.find((item) => item.id === form.id), projects)}
                      className="h-10 rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 text-sm text-rose-100 hover:bg-rose-400/15"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Excluir
                    </Button>
                  ) : null}
                </div>

                {feedback ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {feedback}
                  </div>
                ) : null}
              </form>
                </div>

                <div className="min-h-0 border-t border-white/5 p-6 lg:border-l lg:border-t-0">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {isAdmin ? 'Projetos cadastrados' : 'Seus projetos'}
                </h3>
                <div className="mt-4 max-h-[calc(100vh-190px)] space-y-2 overflow-y-auto pr-1">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-lg border px-3 py-3',
                        form.id === project.id
                          ? 'border-cyan-400/30 bg-cyan-400/10'
                          : 'border-white/10 bg-white/[0.03]',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{project.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{project.slug}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {canEditProject(user, project) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleEditProject(project)}
                            className="h-8 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 text-amber-100 hover:bg-amber-500/15"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {canEditProject(user, project) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleDeleteProject(project)}
                            disabled={!canDeleteProject(user, project, projects)}
                            className="h-8 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 text-rose-100 hover:bg-rose-400/15 disabled:opacity-40"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-lg border border-rose-400/20 bg-[#080e1d] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.58)]">
            <div className="mb-5">
              <div className="mb-3 inline-flex rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">
                Exclusao definitiva
              </div>
              <h2 className="text-lg font-semibold text-white">Excluir {deleteTarget.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Essa acao vai remover o projeto e tudo que pertence a ele: agente, APIs,
                conectores, widgets, WhatsApp, conversas, mensagens, produtos configurados,
                segredos, logs e vinculos de usuarios. O historico de tokens usados fica
                preservado sem vinculo com o projeto.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">
                Digite exatamente: <span className="text-white">{deleteTarget.name}</span>
              </span>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                placeholder={deleteTarget.name}
                autoFocus
              />
            </label>

            {deleteError ? (
              <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteConfirmation('')
                  setDeleteError('')
                }}
                className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={deleteConfirmation !== deleteTarget.name || deleting}
                onClick={confirmDeleteProject}
                className="h-10 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 text-sm text-rose-100 hover:bg-rose-500/15 disabled:opacity-40"
              >
                {deleting ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                Excluir definitivamente
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}

