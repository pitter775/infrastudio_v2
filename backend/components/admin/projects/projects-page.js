'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronRight, List, LoaderCircle, MessageSquare, Pencil, Plus, Repeat, Store, Trash2 } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { AppSelect } from '@/components/ui/app-select'
import { Button } from '@/components/ui/button'
import { LogoCubo3D } from '@/components/ui/LogoCubo3D'
import {
  Sheet,
  SheetClose,
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

export function AdminProjectsPage({ projects: initialProjects, user, users = [] }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [loadingProjectSlug, setLoadingProjectSlug] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [transferTarget, setTransferTarget] = useState(null)
  const [transferUserId, setTransferUserId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')
  const sheetHistoryActiveRef = useRef(false)
  const sheetPopClosingRef = useRef(false)
  const isAdmin = user?.role === 'admin'
  const orderedProjects = useMemo(() => {
    if (!isAdmin) {
      return projects
    }

    return [...projects].sort((first, second) => {
      const firstAdminOwned = first.owner?.role === 'admin' ? 1 : 0
      const secondAdminOwned = second.owner?.role === 'admin' ? 1 : 0

      if (firstAdminOwned !== secondAdminOwned) {
        return secondAdminOwned - firstAdminOwned
      }

      return new Date(second.updatedAt || 0).getTime() - new Date(first.updatedAt || 0).getTime()
    })
  }, [isAdmin, projects])
  const primaryProject = orderedProjects[0] || null
  const onboardingStorageKey = useMemo(
    () => (primaryProject ? `infrastudio:onboarding-project:${primaryProject.id || primaryProject.slug || primaryProject.routeKey}` : ''),
    [primaryProject],
  )
  const [showOnboardingHint, setShowOnboardingHint] = useState(false)

  useEffect(() => {
    function syncMobileState() {
      setIsMobile(window.innerWidth < 1024)
    }

    syncMobileState()
    window.addEventListener('resize', syncMobileState)
    return () => window.removeEventListener('resize', syncMobileState)
  }, [])

  useEffect(() => {
    if (!onboardingStorageKey || typeof window === 'undefined') {
      setShowOnboardingHint(false)
      return
    }

    const dismissed = window.localStorage.getItem(onboardingStorageKey) === 'done'
    setShowOnboardingHint(!dismissed)
  }, [onboardingStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile || !sheetOpen || sheetHistoryActiveRef.current) {
      return
    }

    window.history.pushState({ adminProjectsSheet: true }, '')
    sheetHistoryActiveRef.current = true
  }, [isMobile, sheetOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    function handlePopState() {
      if (!sheetHistoryActiveRef.current) {
        return
      }

      sheetPopClosingRef.current = true
      sheetHistoryActiveRef.current = false
      setSheetOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function handleSheetOpenChange(nextOpen) {
    if (!nextOpen && isMobile && sheetHistoryActiveRef.current && !sheetPopClosingRef.current) {
      window.history.back()
      return
    }

    if (!nextOpen) {
      sheetHistoryActiveRef.current = false
    }

    sheetPopClosingRef.current = false
    setSheetOpen(nextOpen)
  }

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

  function handleTransferProject(project) {
    setTransferTarget(project)
    setTransferUserId('')
    setTransferError('')
    setFeedback(null)
  }

  async function confirmTransferProject() {
    if (!transferTarget?.id || !transferUserId) {
      setTransferError('Selecione o usuario destino.')
      return
    }

    setTransferring(true)
    setTransferError('')

    const response = await fetch(`/api/admin/projetos/${transferTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: transferUserId }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setTransferError(payload.error ?? 'Nao foi possivel transferir o projeto.')
      setTransferring(false)
      return
    }

    await refreshProjects()
    setTransferTarget(null)
    setTransferUserId('')
    setTransferError('')
    setTransferring(false)
    setFeedback('Projeto transferido com sucesso.')
  }

  const transferUserOptions = users
    .filter((item) => item?.id && item.id !== transferTarget?.owner?.id)
    .map((item) => ({
      value: item.id,
      label: `${item.name} (${item.email})`,
    }))

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
            <span>{orderedProjects.length} projetos</span>
          </div>
        </div>
      </div>

      {orderedProjects.length > 0 ? (
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-5">
            {orderedProjects.map((project, index) => (
              <div key={project.id} className="min-w-0">
                <AdminProjectCard
                  project={project}
                  index={index}
                  onSelect={handleProjectSelect}
                  onEdit={canEditProject(user, project) ? handleEditProject : undefined}
                  loading={loadingProjectSlug === (project.routeKey || project.slug || project.id)}
                  highlighted={isAdmin && project.owner?.role === 'admin'}
                />
              </div>
            ))}
          </div>

          <aside className="w-full xl:sticky xl:top-6 xl:w-[min(40vw,640px)] xl:min-w-[480px]">
            {showOnboardingHint && primaryProject && orderedProjects.length === 1 ? (
              <div className="px-2 pt-1 text-slate-200 xl:[font-size:clamp(0.84rem,0.68rem+0.34vw,1rem)]">
                <div className="flex items-center gap-3">
                  <LogoCubo3D tamanho={32} />
                  <div className="text-[clamp(1.5rem,1.2rem+1vw,1.75rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-transparent bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400 bg-clip-text">
                    Seu projeto já está pronto
                  </div>
                </div>

                <div className="mt-4 max-w-[30rem] space-y-3 text-[clamp(0.92rem,0.78rem+0.24vw,1.04rem)] leading-[1.65] text-slate-300">
                <p className="text-sm text-gray-400 leading-relaxed">Clique no projeto que criamos para você.
                  Ele já vem com tudo que precisa:</p>
                  <ul className="space-y-2.5 text-slate-100">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-300" />
                      <span>Agente configurado, agora vc inclui suas informacoes.</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <MessageSquare className="h-4.5 w-4.5 shrink-0 text-emerald-300" />
                      <span>Chat funcionando no seu site ou sistema.</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="flex shrink-0 items-center gap-2">
                        <MessageSquare className="h-4.5 w-4.5 text-emerald-300" />
                        <Store className="h-4.5 w-4.5 text-amber-300" />
                      </span>
                      <span>Conecta seu WhatsApp e Mercado Livre e suas APis</span>
                    </li>
                  </ul>
                  <p className="pt-1 text-slate-400">
                    Clica no projeto e completar seus dados para começar a usar!
                  </p>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-6 text-sm text-slate-400">
          Nenhum projeto disponivel para este usuario.
        </div>
      )}

        <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange} modal={false}>
          <SheetContent
            side="right"
            showOverlay={false}
            showCloseButton={false}
            closeOnInteractOutside={false}
            closeOnEscapeKeyDown={false}
            className={cn(
              'overflow-visible border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-[-24px_0_48px_rgba(0,0,0,0.42)]',
              isMobile
                ? 'inset-y-0 right-0 top-0 h-[100dvh] rounded-none'
                : 'right-[19px] top-[54px] bottom-[18px] h-auto rounded-l-lg',
            )}
            style={isMobile ? { width: '100vw', maxWidth: '100vw' } : { width: '1040px', maxWidth: 'calc(100vw - 38px)' }}
          >
            <SheetClose className={cn(
              'absolute z-40 inline-flex items-center justify-center rounded-full border border-white/10 bg-[#0c1426] p-2 text-slate-400 shadow-[0_14px_30px_rgba(2,6,23,0.52)] transition-colors hover:bg-[#101b31] hover:text-white focus:outline-none',
              isMobile ? 'right-4 top-4' : 'left-0 top-[102px] -translate-x-[60%]',
            )}>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Fechar painel</span>
            </SheetClose>
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
                  {orderedProjects.map((project) => (
                    <div
                      key={project.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-lg border px-3 py-3',
                        form.id === project.id
                          ? 'border-cyan-400/30 bg-cyan-400/10'
                          : isAdmin && project.owner?.role === 'admin'
                            ? 'border-cyan-300/30 bg-cyan-500/[0.05]'
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
                            onClick={() => handleTransferProject(project)}
                            className="h-8 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 text-cyan-100 hover:bg-cyan-500/15"
                            title="Transferir"
                          >
                            <Repeat className="h-3.5 w-3.5" />
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
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
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

      {transferTarget ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-lg border border-cyan-400/20 bg-[#080e1d] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.58)]">
            <div className="mb-5">
              <div className="mb-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Transferencia
              </div>
              <h2 className="text-lg font-semibold text-white">Transferir {transferTarget.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Altera o dono do projeto. Se o projeto estiver ilimitado por ter sido criado por admin e for transferido para usuario comum, ele entra automaticamente no plano free.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-300">Usuario destino</span>
              <AppSelect
                value={transferUserId}
                onChangeValue={setTransferUserId}
                options={transferUserOptions}
                placeholder="Selecione um usuario"
              />
            </label>

            {transferError ? (
              <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {transferError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setTransferTarget(null)
                  setTransferUserId('')
                  setTransferError('')
                }}
                className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!transferUserId || transferring}
                onClick={confirmTransferProject}
                className="h-10 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-40"
              >
                {transferring ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Repeat className="mr-1.5 h-4 w-4" />}
                Transferir projeto
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
