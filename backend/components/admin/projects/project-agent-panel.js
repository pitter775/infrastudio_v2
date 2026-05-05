'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight, Files, History, MessageCircle, MessageSquare, PackageSearch, PlugZap, RotateCcw, Store, Wand2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { JsonCodeBlock } from '@/components/ui/json-code-block'
import { cn } from '@/lib/utils'
import { AgentRichEditor, plainTextToEditorHtml, richTextToPlainText } from './agent-rich-editor'
import { buildAgentDraftConfig, buildMergedAgentSummary, buildVersionChangeNote, resolveEntityAvatarUrl } from './agent-config-utils'
import { getPanelAccentClasses, getToneClasses } from './project-detail-layout'
import { PlaceholderPanel, SheetInternalTabs, SheetPanelHeader } from './project-detail-sheet'
import { resolveAgentTab } from './project-detail-query'

function TinyEntityAvatar({ src, label }) {
  if (!src) {
    return null
  }

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full bg-slate-800"
      style={{
        backgroundImage: `url(${src})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
      aria-hidden="true"
      title={label || ""}
    />
  )
}

export function ProjectPanel({
  project,
  initialAgentTab = 'edit',
  onAgentTabChange,
  onOpenConnection,
  onCloseSheet = null,
}) {
  const router = useRouter()
  const agent = project.agent
  const projectIdentifier = project.routeKey || project.slug || project.id
  const agentServerSnapshot = useMemo(
    () =>
      JSON.stringify({
        id: agent?.id || '',
        name: agent?.name || '',
        prompt: agent?.prompt || agent?.description || '',
        logoUrl: agent?.logoUrl || '',
        siteUrl: agent?.siteUrl || '',
        active: agent?.active !== false,
        versions: Array.isArray(agent?.versions)
          ? agent.versions.map((item) => ({
              id: item?.id || '',
              versionNumber: item?.versionNumber || '',
              createdAt: item?.createdAt || '',
              source: item?.source || '',
            }))
          : [],
      }),
    [agent],
  )
  const initialAgentName = agent?.name || ''
  const initialPrompt = agent?.prompt || agent?.description || ''
  const initialLogoUrl = agent?.logoUrl || ''
  const initialSiteUrl = agent?.siteUrl || ''
  const [agentActive, setAgentActive] = useState(agent?.active !== false)
  const [versions, setVersions] = useState(agent?.versions || [])
  const [restoringId, setRestoringId] = useState('')
  const [restoreConfirmId, setRestoreConfirmId] = useState('')
  const [savingActive, setSavingActive] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [generatingSiteSummary, setGeneratingSiteSummary] = useState(false)
  const [agentName, setAgentName] = useState(initialAgentName)
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [promptValue, setPromptValue] = useState(() => plainTextToEditorHtml(initialPrompt))
  const [promptAutofillPendingClear, setPromptAutofillPendingClear] = useState(false)
  const [promptEditedByUser, setPromptEditedByUser] = useState(false)
  const [rollbackStatus, setRollbackStatus] = useState({ type: 'idle', message: '' })
  const [editorStatus, setEditorStatus] = useState({ type: 'idle', message: '' })
  const [siteSummaryStatus, setSiteSummaryStatus] = useState({ type: 'idle', message: '' })
  const [activeAgentTab, setActiveAgentTab] = useState(resolveAgentTab(initialAgentTab) || 'edit')
  const agentTabs = [
    { id: 'edit', label: 'Editar agente', icon: Wand2 },
    { id: 'connections', label: 'Conexoes', icon: PlugZap },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'json', label: 'Ver JSON', icon: Files },
  ]
  const normalizedPrompt = useMemo(() => richTextToPlainText(promptValue), [promptValue])
  const draftAgentConfig = useMemo(
    () =>
      buildAgentDraftConfig({
        runtimeConfig: agent?.runtimeConfig ?? null,
        promptText: normalizedPrompt,
        siteUrl,
        logoUrl,
      }),
    [agent?.runtimeConfig, logoUrl, normalizedPrompt, siteUrl],
  )
  const draftAgentJson = useMemo(
    () => ({
      id: agent?.id || null,
      slug: agent?.slug || null,
      name: agentName.trim() || initialAgentName || agent?.name || agent?.nome || '',
      description: agent?.description || agent?.descricao || '',
      prompt: normalizedPrompt,
      configuracoes: draftAgentConfig,
      siteUrl: draftAgentConfig.brand?.siteUrl || '',
      logoUrl: draftAgentConfig.brand?.logoUrl || '',
      active: agentActive,
    }),
    [agent?.description, agent?.descricao, agent?.id, agent?.name, agent?.nome, agent?.slug, agentActive, agentName, draftAgentConfig, initialAgentName, normalizedPrompt],
  )
  const hasUnsavedChanges =
    agentName.trim() !== initialAgentName.trim() ||
    normalizedPrompt !== initialPrompt.trim() ||
    siteUrl.trim() !== initialSiteUrl.trim() ||
    logoUrl.trim() !== initialLogoUrl.trim()
  const canSaveAgent =
    activeAgentTab === 'edit' &&
    Boolean(agent?.id) &&
    !savingDraft &&
    Boolean(agentName.trim()) &&
    Boolean(normalizedPrompt.trim()) &&
    hasUnsavedChanges
  const currentVersionSnapshot = useMemo(
    () => ({
      id: 'current',
      versionNumber: 'Atual',
      name: agentName.trim() || initialAgentName,
      description: '',
      prompt: normalizedPrompt,
      runtimeConfig: draftAgentConfig.runtimeConfig ?? null,
      configuracoes: draftAgentConfig,
      note: hasUnsavedChanges ? 'rascunho local' : 'estado atual salvo',
      source: hasUnsavedChanges ? 'draft' : 'current',
      createdAt: '',
      active: agentActive,
    }),
    [agentActive, agentName, draftAgentConfig, hasUnsavedChanges, initialAgentName, normalizedPrompt],
  )

  useEffect(() => {
    setAgentName(initialAgentName)
    setSiteUrl(initialSiteUrl)
    setLogoUrl(initialLogoUrl)
    setPromptValue(plainTextToEditorHtml(initialPrompt))
    setPromptAutofillPendingClear(false)
    setPromptEditedByUser(false)
    setAgentActive(agent?.active !== false)
    setVersions(agent?.versions || [])
    setEditorStatus({ type: 'idle', message: '' })
  }, [agent?.active, agent?.versions, agentServerSnapshot, initialAgentName, initialLogoUrl, initialPrompt, initialSiteUrl])

  useEffect(() => {
    const nextTab = resolveAgentTab(initialAgentTab)
    if (nextTab && nextTab !== activeAgentTab) {
      setActiveAgentTab(nextTab)
    }
  }, [activeAgentTab, initialAgentTab])

  function handleAgentTabChange(tabId) {
    setActiveAgentTab(tabId)
    onAgentTabChange?.(tabId)
  }

  const connectionItems = [
    ...(project.apis || []).map((api) => ({
      id: api.id,
      type: 'api',
      title: api.name,
      description: api.url || `${api.method || 'GET'} cadastrado`,
      icon: PlugZap,
      colorClassName: 'sky',
      panel: 'apis',
      params: { api: api.id },
    })),
    ...(project.whatsappChannels || []).map((channel) => ({
      id: channel.id,
      type: 'channel',
      title: channel.number || 'Canal WhatsApp',
      description: channel.connectionStatus || channel.status || 'Canal cadastrado',
      icon: MessageCircle,
      colorClassName: 'emerald',
      panel: 'whatsapp',
      params: { channel: channel.id },
    })),
    ...(project.chatWidgets || []).map((widget) => ({
      id: widget.id,
      type: 'widget',
      title: widget.name || widget.nome || 'Chat widget',
      description: widget.slug || 'Widget cadastrado',
      icon: PackageSearch,
      colorClassName: 'violet',
      panel: 'chat-widget',
      params: { widget: widget.id },
    })),
    ...(project.directConnections?.mercadoLivre
      ? [
          {
            id: 'mercado-livre',
            type: 'connector',
            title: 'Mercado Livre',
            description: `${project.directConnections.mercadoLivre} conector ativo`,
            icon: Store,
            colorClassName: 'amber',
            panel: 'mercado-livre',
            params: {},
          },
        ]
      : []),
  ]

  async function handleCreateAgent() {
    if (agent?.id || creatingAgent) {
      return
    }

    setCreatingAgent(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_agent',
          nome: agentName.trim() || `${project.name} Assistente`,
          businessContext: normalizedPrompt,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível criar o agente.')
      }

      setEditorStatus({ type: 'success', message: 'Agente e chat widget criados.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setCreatingAgent(false)
    }
  }

  async function handleToggleAgentActive() {
    if (!agent?.id || savingActive) {
      return
    }

    const nextActive = !agentActive
    setSavingActive(true)
    setRollbackStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agenteId: agent.id,
          nome: agent.name,
          descricao: agent.description,
          promptBase: agent.prompt,
          runtimeConfig: agent.runtimeConfig ?? null,
          configuracoes: buildAgentDraftConfig({
            runtimeConfig: agent.runtimeConfig ?? null,
            promptText: agent.prompt,
            siteUrl,
            logoUrl,
          }),
          ativo: nextActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível alterar o status do agente.')
      }

      setAgentActive(nextActive)
      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }
      setRollbackStatus({
        type: 'success',
        message: nextActive ? 'Agente ativado.' : 'Agente desativado.',
      })
      router.refresh()
    } catch (error) {
      setRollbackStatus({ type: 'error', message: error.message })
    } finally {
      setSavingActive(false)
    }
  }

  async function handleRestoreVersion(versionId) {
    if (!versionId || restoringId) {
      return
    }

    setRestoringId(versionId)
    setRollbackStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore_version',
          versionId,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível restaurar a versão.')
      }

      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setRollbackStatus({ type: 'success', message: 'Versao restaurada.' })
      setRestoreConfirmId('')
      router.refresh()
    } catch (error) {
      setRollbackStatus({ type: 'error', message: error.message })
    } finally {
      setRestoringId('')
    }
  }

  async function handleSaveAgent() {
    if (!agent?.id || savingDraft) {
      return
    }

    const nextName = agentName.trim()
    const nextPrompt = normalizedPrompt

    if (!nextName || !nextPrompt) {
      setEditorStatus({ type: 'error', message: 'Nome e comportamento do agente sao obrigatorios.' })
      return
    }

    setSavingDraft(true)
    setEditorStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agenteId: agent.id,
          nome: nextName,
          descricao: agent.description || '',
          promptBase: nextPrompt,
          runtimeConfig: draftAgentConfig.runtimeConfig ?? null,
          configuracoes: draftAgentConfig,
          ativo: agentActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível salvar o agente.')
      }

      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          `infrastudio:onboarding-project:${project.id || project.slug || project.routeKey}`,
          'done',
        )
      }

      setEditorStatus({ type: 'success', message: 'Agente salvo.' })
      router.refresh()
    } catch (error) {
      setEditorStatus({ type: 'error', message: error.message })
    } finally {
      setSavingDraft(false)
    }
  }

  function handleResetAgentDraft() {
    setAgentName(initialAgentName)
    setSiteUrl(initialSiteUrl)
    setLogoUrl(initialLogoUrl)
    setPromptValue(plainTextToEditorHtml(initialPrompt))
    setPromptAutofillPendingClear(false)
    setPromptEditedByUser(false)
    setEditorStatus({ type: 'idle', message: '' })
  }

  async function handleGenerateSiteSummary() {
    const normalizedUrl = siteUrl.trim()

    if (!normalizedUrl || generatingSiteSummary) {
      return
    }

    setGeneratingSiteSummary(true)
    setSiteSummaryStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente/site-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: normalizedUrl,
          currentPrompt: normalizedPrompt,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível gerar o resumo do site.')
      }

      setPromptValue((currentValue) =>
        buildMergedAgentSummary(currentValue, data.summary, data.promptSuggestion, data.mergedEditorDraft),
      )
      if (!promptEditedByUser) {
        setPromptAutofillPendingClear(true)
      }
      if (data?.source?.logoUrl) {
        setLogoUrl(data.source.logoUrl)
      }
      setSiteSummaryStatus({ type: 'success', message: 'Conteúdo do site adicionado ao editor sem remover seu texto.' })
    } catch (error) {
      setSiteSummaryStatus({ type: 'error', message: error.message })
    } finally {
      setGeneratingSiteSummary(false)
    }
  }

  return (
    <>
      <SheetPanelHeader
        eyebrow="Agente"
        description="Edite seu agente com suas políticas e regras."
        statusTone="sky"
        onCancel={onCloseSheet}
      />
      <SheetInternalTabs tabs={agentTabs} activeTab={activeAgentTab} onChange={handleAgentTabChange} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`agent-tab:${activeAgentTab}`}
            initial={{ opacity: 0.985, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.985, y: -3 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
        {activeAgentTab === 'edit' ? (
        <div className="min-h-full px-6 py-5">
          {!agent?.id ? (
            <div className="mb-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
              <div className="text-sm font-medium text-sky-100">Projeto sem agente ativo.</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">
                Crie o agente inicial e o chat widget padrão automaticamente.
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={creatingAgent}
                onClick={handleCreateAgent}
                className="mt-4 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingAgent ? 'Criando...' : 'Criar agente + widget'}
              </Button>
            </div>
          ) : null}
          <div>
            <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Nome do agente
                  </label>
                  <div className="mt-3 flex items-center gap-2">
                    <TinyEntityAvatar src={resolveEntityAvatarUrl(logoUrl, siteUrl)} label={agentName || 'Agente'} />
                    <input
                      value={agentName}
                      onChange={(event) => setAgentName(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                      placeholder="Nome do agente"
                    />
                  </div>
                </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  URL do site para leitura automatica
                </label>

                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <input
                    value={siteUrl}
                    onChange={(event) => setSiteUrl(event.target.value)}
                    className="h-12 flex-1 rounded-xl border border-white/10 bg-[#0a1020] px-4 text-sm text-white outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/10"
                    placeholder="https://seudominio.com.br"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!siteUrl.trim() || generatingSiteSummary}
                    onClick={handleGenerateSiteSummary}
                    className="h-12 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingSiteSummary ? 'Lendo site...' : 'Gerar resumo automatico'}
                  </Button>
                </div>

                  <p className="mt-2 text-xs text-slate-500">
                    O sistema busca informações do site e soma esse contexto.
                  </p>
                  {logoUrl ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <TinyEntityAvatar src={resolveEntityAvatarUrl(logoUrl, siteUrl)} label={agentName || 'Agente'} />
                      <span>Logo capturado do site.</span>
                    </div>
                  ) : null}

                {siteSummaryStatus.message ? (
                  <div
                    className={cn(
                      'mt-3 rounded-xl border px-3 py-2 text-xs',
                      siteSummaryStatus.type === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                        : 'border-red-500/20 bg-red-500/10 text-red-200',
                    )}
                  >
                    {siteSummaryStatus.message}
                  </div>
                ) : null}

              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Escreva suas políticas e regras do seu negócio.
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs text-emerald-200"
                    onClick={handleResetAgentDraft}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Voltar
                  </Button>
                </div>

                <div className="mt-3">
                  <AgentRichEditor
                    value={promptValue}
                    onChange={(nextValue) => {
                      setPromptValue(nextValue)
                      if (!promptAutofillPendingClear) {
                        setPromptEditedByUser(true)
                      }
                    }}
                    placeholder="Descreva seu negócio, os serviços ou produtos que oferece, seus diferenciais, valores, regras, limites e como você gosta de atender seus clientes. Quanto mais claro e detalhado, melhor o agente vai conversar."
                    clearOnFirstInput={promptAutofillPendingClear}
                    onFirstInputClear={() => {
                      setPromptAutofillPendingClear(false)
                      setPromptEditedByUser(true)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {activeAgentTab === 'json' ? (
          <div className="px-6 py-5">
            <JsonCodeBlock value={{ projectId: project.id, agent: draftAgentJson }} />
          </div>
        ) : null}

        {activeAgentTab === 'connections' ? (
          <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
            {connectionItems.length ? (
              connectionItems.map((item) => {
                const Icon = item.icon
                const accent = getPanelAccentClasses(item.colorClassName)
                const toneClasses = getToneClasses(item.colorClassName)
                const isWhatsApp = item.panel === 'whatsapp'

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => onOpenConnection?.(item.panel, item.params)}
                    className={cn(
                      'group flex items-center gap-3 rounded-[22px] border bg-[#0c1426] p-4 text-left shadow-[0_8px_0_rgba(2,6,23,0.64)] transition-[background-color,border-color,box-shadow]',
                      accent.button,
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center border border-white/10 bg-white/[0.06]',
                        isWhatsApp ? 'rounded-full' : 'rounded-xl',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                      <span className={cn('mt-1 block truncate text-xs', toneClasses.text)}>{item.description}</span>
                    </span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0', accent.icon)} />
                  </button>
                )
              })
            ) : (
              <PlaceholderPanel title="Sem conexoes" description="Cadastre APIs, WhatsApp, widget ou conectores para liberar atalhos diretos." />
            )}
          </div>
        ) : null}

        {activeAgentTab === 'history' ? (
          <div className="px-6 py-5">
            <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <History className="h-4 w-4 text-sky-300" />
                    Histórico e rollback
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Restaure uma versão anterior do prompt e runtimeConfig.
                  </div>
                </div>
              </div>

              {rollbackStatus.message ? (
                <div
                  className={cn(
                    'mt-3 rounded-xl border px-3 py-2 text-xs',
                    rollbackStatus.type === 'success'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/20 bg-red-500/10 text-red-200',
                  )}
                >
                  {rollbackStatus.message}
                </div>
              ) : null}

              {versions.length ? (
                <div className="mt-4 space-y-2">
                  {[currentVersionSnapshot, ...versions.slice(0, 8)].map((version, index, list) => {
                    const isCurrent = version.id === 'current'
                    const compareVersion = list[index + 1] ?? null
                    const changeNote = buildVersionChangeNote(version, compareVersion)

                    return (
                      <div
                        key={version.id}
                        className={cn(
                          "rounded-xl border px-3 py-3",
                          isCurrent ? "border-emerald-400/20 bg-emerald-500/5" : "border-white/10 bg-black/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-medium text-white">
                                {isCurrent ? version.versionNumber : `v${version.versionNumber}`} - {version.name}
                              </div>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                  isCurrent
                                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                    : "border-white/10 bg-white/[0.04] text-slate-300",
                                )}
                              >
                                {isCurrent ? "versão atual" : version.source === 'rollback' ? 'rollback' : 'salvamento'}
                              </span>
                              {!isCurrent && version.active === true ? (
                                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                                  ativa na epoca
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {isCurrent ? 'referencia atual para comparacao' : new Date(version.createdAt).toLocaleString('pt-BR')}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-slate-400">
                              {changeNote}
                            </div>
                          </div>

                          {!isCurrent ? (
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={Boolean(restoringId)}
                              onClick={() => setRestoreConfirmId(version.id)}
                              className="h-8 shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs text-sky-100"
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              {restoringId === version.id ? 'Restaurando...' : 'Rollback'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-500">
                  Nenhuma versão salva ainda. O historico sera criado antes do proximo salvamento.
                </div>
              )}
            </div>
          </div>
        ) : null}

          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-white/5 px-6 py-4">
        {editorStatus.message && activeAgentTab === 'edit' ? (
          <div
            className={cn(
              'mb-3 rounded-xl border px-3 py-2 text-xs',
              editorStatus.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/20 bg-red-500/10 text-red-200',
            )}
          >
            {editorStatus.message}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={!canSaveAgent}
            onClick={handleSaveAgent}
            className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="mr-2 h-4 w-4" />
            {savingDraft ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCloseSheet}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(restoreConfirmId)}
        onOpenChange={(open) => {
          if (!open) {
            setRestoreConfirmId('')
          }
        }}
        title="Restaurar versão do agente"
        description="O estado atual será salvo no histórico antes do rollback."
        confirmLabel="Restaurar versão"
        loading={Boolean(restoringId)}
        onConfirm={() => (restoreConfirmId ? handleRestoreVersion(restoreConfirmId) : null)}
      />
    </>
  )
}

