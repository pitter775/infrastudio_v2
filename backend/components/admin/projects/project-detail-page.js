'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  Files,
  History,
  LoaderCircle,
  MessageCircle,
  MessageSquare,
  PackageSearch,
  PlugZap,
  RotateCcw,
  Store,
  Users,
  Wand2,
} from 'lucide-react'
import { AgentSimulator } from '@/components/app/agents/agent-simulator'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { HorizontalDragScroll } from '@/components/ui/horizontal-drag-scroll'
import { JsonCodeBlock } from '@/components/ui/json-code-block'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import {
  AgentRichEditor,
  plainTextToEditorHtml,
  richTextToPlainText,
} from './agent-rich-editor'
import {
  buildAgentDraftConfig,
  buildMergedAgentSummary,
  buildSiteSummaryHighlights,
  buildVersionChangeNote,
  resolveEntityAvatarUrl,
} from './agent-config-utils'
import {
  CARD_CLOSED_SCALE,
  COLLAPSED_SIDEBAR_WIDTH,
  CONTENT_SIDE_PADDING,
  DEFAULT_PANEL,
  DESKTOP_BREAKPOINT,
  DOCK_GAP,
  EXPANDED_SIDEBAR_WIDTH,
  MOBILE_BREAKPOINT,
  SHEET_BOTTOM_OFFSET,
  SHEET_RIGHT_OFFSET,
  SHEET_TOP_OFFSET,
  buildIntegrationPanels,
  buildTopMenuItems,
  getCardWidth,
  getClosedCardLayout,
  getDockedCardLayout,
  getMobileCardLayout,
  getPanelAccentClasses,
  getSatelliteLayout,
  getSheetWidth,
  getToneClasses,
} from './project-detail-layout'
import {
  PlaceholderPanel,
  SheetInternalTabs,
  SheetPanelHeader,
  SheetPowerToggle,
} from './project-detail-sheet'
import {
  clearProjectDetailQuery,
  resolveAgentTab,
  updateAgentTabQuery,
  updatePanelQuery,
} from './project-detail-query'
import {
  IntegrationPanel,
  mergeIntegrationStats,
  resolveProjectPlanSummary,
} from './integration-panel'
import { ProjectPanel } from './project-agent-panel'
import { formatCredits } from '@/lib/public-planos'
import { cn } from '@/lib/utils'

export function AdminProjectDetailPage({ project }) {
  const router = useRouter()
  const projectIdentifier = project.routeKey || project.slug || project.id
  const [isPanelOpen, setIsPanelOpen] = useState(Boolean(project.agent?.id))
  const [activePanel, setActivePanel] = useState(DEFAULT_PANEL)
  const [agentTabFromUrl, setAgentTabFromUrl] = useState('edit')
  const [deepLink, setDeepLink] = useState({})
  const [testOpen, setTestOpen] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [dragResetSignal, setDragResetSignal] = useState(0)
  const [isCardDragging, setIsCardDragging] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [pendingPanelId, setPendingPanelId] = useState(null)
  const [agentCardActive, setAgentCardActive] = useState(project.agent?.active !== false)
  const [savingAgentCardActive, setSavingAgentCardActive] = useState(false)
  const [integrationStats, setIntegrationStats] = useState(() => ({
    apis: Number(project.directConnections?.apis || project.integrations?.apis || project.apis?.length || 0),
    whatsapp: Number(project.directConnections?.whatsapp || project.integrations?.whatsapp || project.whatsappChannels?.length || 0),
    chatWidget: Number(project.directConnections?.chatWidget || project.integrations?.chatWidget || project.chatWidgets?.length || 0),
    mercadoLivre: Number(project.directConnections?.mercadoLivre || 0),
  }))
  const mobileHistoryGuardRef = useRef(false)
  const integrationPanels = useMemo(() => {
    const nextProject = {
      ...project,
      integrations: {
        ...(project.integrations || {}),
        apis: integrationStats.apis,
        whatsapp: integrationStats.whatsapp,
        chatWidget: integrationStats.chatWidget,
      },
      directConnections: {
        ...(project.directConnections || {}),
        ...integrationStats,
      },
    }

    return buildIntegrationPanels(nextProject)
  }, [integrationStats, project])
  const [panelEnabledMap, setPanelEnabledMap] = useState({})
  const activeIntegrationPanels = useMemo(
    () => integrationPanels.filter((panel) => panel.isAvailable),
    [integrationPanels],
  )
  const topMenuItems = useMemo(() => buildTopMenuItems(integrationPanels), [integrationPanels])
  const directCardIcons = useMemo(
    () =>
      activeIntegrationPanels
        .filter((panel) => panel.directToAgent)
        .map((panel) => panel.serviceIconType || panel.id),
    [activeIntegrationPanels],
  )

  useEffect(() => {
    setIntegrationStats({
      apis: Number(project.directConnections?.apis || project.integrations?.apis || project.apis?.length || 0),
      whatsapp: Number(project.directConnections?.whatsapp || project.integrations?.whatsapp || project.whatsappChannels?.length || 0),
      chatWidget: Number(project.directConnections?.chatWidget || project.integrations?.chatWidget || project.chatWidgets?.length || 0),
      mercadoLivre: Number(project.directConnections?.mercadoLivre || 0),
    })
  }, [project])

  useEffect(() => {
    setPanelEnabledMap((current) =>
      integrationPanels.reduce((acc, panel) => {
        acc[panel.id] = current[panel.id] ?? true
        return acc
      }, {}),
    )
  }, [integrationPanels])

  useEffect(() => {
    setAgentCardActive(project.agent?.active !== false)
  }, [project.agent?.active, project.agent?.id])

  useEffect(() => {
    function syncViewport() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)

    return () => {
      window.removeEventListener('resize', syncViewport)
    }
  }, [])

  useEffect(() => {
    setDragResetSignal((value) => value + 1)
  }, [isPanelOpen])

  useEffect(() => {
    function handleSidebarStateChange(event) {
      setSidebarCollapsed(Boolean(event.detail?.collapsed))
    }

    window.addEventListener('admin-sidebar-state-change', handleSidebarStateChange)

    return () => {
      window.removeEventListener('admin-sidebar-state-change', handleSidebarStateChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const planSummary = resolveProjectPlanSummary(project)
    const baseMonthlyLimit =
      project.billing?.currentCycle?.limits?.totalTokens ??
      project.billing?.projectPlan?.limits?.totalTokens ??
      null
    const topUpAvailableTokens = Number(project.billing?.topUps?.availableTokens ?? 0)
    const monthlyLimit =
      baseMonthlyLimit == null ? (topUpAvailableTokens > 0 ? topUpAvailableTokens : null) : Number(baseMonthlyLimit) + topUpAvailableTokens
    const usedTokens = Number(project.billing?.currentCycle?.usage?.totalTokens ?? 0)
    const remainingTokens = monthlyLimit == null ? null : Math.max(0, Number(monthlyLimit) - usedTokens)
    const providedUsagePercent = Number(project.billing?.currentCycle?.usagePercent?.totalTokens)
    const shouldUseProvidedPercent = Number.isFinite(providedUsagePercent) && topUpAvailableTokens <= 0
    const usagePercent = shouldUseProvidedPercent
      ? providedUsagePercent
      : monthlyLimit == null
        ? 0
        : (usedTokens / Math.max(Number(monthlyLimit), 1)) * 100

    window.dispatchEvent(
      new CustomEvent('admin-project-usage-summary', {
        detail: {
          projectId: project.id,
          projectName: project.name,
          planId: planSummary.planId,
          planName: planSummary.planName,
          isFree: planSummary.isFree,
          subscriptionStatus: project.billing?.subscription?.status || '',
          pendingCheckout: project.billing?.pendingCheckout || null,
          billingBlocked: Boolean(project.billing?.status?.blocked || project.billing?.projectPlan?.blocked),
          blockedReason: project.billing?.projectPlan?.blockedReason || '',
          usedTokens,
          monthlyLimit,
          usagePercent,
          topUpAvailableTokens,
          remainingLabel: remainingTokens == null ? 'Sem limite' : formatCredits(remainingTokens),
          limitLabel: monthlyLimit == null ? 'Sem limite' : formatCredits(monthlyLimit),
          remainingPercentLabel: monthlyLimit == null ? null : `${Math.max(0, Math.round(100 - usagePercent))}%`,
          cycleEndDate: project.billing?.currentCycle?.endDate ?? null,
        },
      }),
    )

    return () => {
      window.dispatchEvent(
        new CustomEvent('admin-project-usage-summary', {
          detail: null,
        }),
      )
    }
  }, [project])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('admin-project-sheet-toggle', {
        detail: { open: isPanelOpen },
      }),
    )

    return () => {
      window.dispatchEvent(
        new CustomEvent('admin-project-sheet-toggle', {
          detail: { open: false },
        }),
      )
    }
  }, [isPanelOpen])

  const viewportWidth = viewport.width || DESKTOP_BREAKPOINT
  const viewportHeight = viewport.height || 900
  const isMobile = viewportWidth < MOBILE_BREAKPOINT
  const cardWidth = getCardWidth(viewportWidth)
  const closedLayout = useMemo(
    () => getClosedCardLayout(viewportWidth, viewportHeight, cardWidth),
    [cardWidth, viewportHeight, viewportWidth],
  )
  const dockedLayout = useMemo(
    () => getDockedCardLayout({ viewportWidth, viewportHeight }),
    [viewportHeight, viewportWidth],
  )
  const mobileLayout = useMemo(
    () => getMobileCardLayout(viewportWidth, cardWidth),
    [cardWidth, viewportWidth],
  )
  const cardLayout = isMobile
    ? { ...mobileLayout, cardWidth }
    : isPanelOpen
      ? dockedLayout
      : { ...closedLayout, cardWidth }
  const sidebarWidth = sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH
  const menuLeft = isMobile ? 0 : sidebarWidth + CONTENT_SIDE_PADDING
  const menuTop = isMobile ? 0 : SHEET_TOP_OFFSET + 6
  const menuWidth = isMobile
    ? viewportWidth
    : Math.max(
        Math.min(
          viewportWidth - menuLeft - CONTENT_SIDE_PADDING - (isPanelOpen ? dockedLayout.sheetWidth + DOCK_GAP : 0),
          viewportWidth - menuLeft - CONTENT_SIDE_PADDING,
        ),
        280,
      )
  const selectedPanel =
    activePanel === DEFAULT_PANEL
      ? null
      : integrationPanels.find((panel) => panel.id === activePanel)
  const sheetHeading = selectedPanel?.title ?? project.name
  const sheetIntro =
    selectedPanel?.description ?? 'Painel lateral com detalhes contextuais do projeto selecionado.'
  const sheetItems =
    selectedPanel?.items ?? [
      'Projeto carregado do banco',
      'Agente ativo resolvido',
      'Permissao validada pela sessao',
      'Pipeline pronto para evoluir',
    ]

  useEffect(() => {
    function syncAgentTabFromUrl() {
      const params = new URLSearchParams(window.location.search)
      const nextTab = resolveAgentTab(params.get('tab'))
      const panel = params.get('panel')
      const allowAutoOpenSheet = !isMobile

      if (nextTab) {
        setAgentTabFromUrl(nextTab)
        if (allowAutoOpenSheet) {
          setActivePanel(DEFAULT_PANEL)
          setIsPanelOpen(true)
        }
        return
      }

      if (panel && [DEFAULT_PANEL, ...integrationPanels.map((item) => item.id)].includes(panel)) {
        if (!allowAutoOpenSheet) {
          return
        }

        setDeepLink({
          api: params.get('api') || null,
          channel: params.get('channel') || null,
          widget: params.get('widget') || null,
          tab: params.get('tab') || null,
          notice: params.get('ml_notice') || null,
        })
        setActivePanel(panel)
        setIsPanelOpen(true)
      }
    }

    function handlePopState() {
      if (isMobile && isPanelOpen && mobileHistoryGuardRef.current) {
        mobileHistoryGuardRef.current = false
        setIsPanelOpen(false)
        setActivePanel(DEFAULT_PANEL)
        setDeepLink({})
        clearProjectDetailQuery()
        return
      }

      syncAgentTabFromUrl()
    }

    syncAgentTabFromUrl()
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [integrationPanels, isMobile, isPanelOpen])

  useEffect(() => {
    if (!isMobile) {
      mobileHistoryGuardRef.current = false
      return
    }

    if (!isPanelOpen || mobileHistoryGuardRef.current) {
      return
    }

    window.history.pushState({ ...(window.history.state || {}), adminProjectSheetGuard: true }, '', window.location.href)
    mobileHistoryGuardRef.current = true
  }, [isMobile, isPanelOpen])

  function closePanel() {
    setIsPanelOpen(false)
    setActivePanel(DEFAULT_PANEL)
    setDeepLink({})
    clearProjectDetailQuery()
  }

  function handleMobileBack() {
    if (isMobile && mobileHistoryGuardRef.current) {
      window.history.back()
      return
    }

    closePanel()
  }

  function handleCloseSheet() {
    if (isMobile) {
      handleMobileBack()
      return
    }

    closePanel()
  }

  function handleOpenPanel(panelId = DEFAULT_PANEL, params = {}) {
    setPendingPanelId(panelId)
    setActivePanel(panelId)
    setDeepLink(params)
    setIsPanelOpen(true)

    if (panelId === DEFAULT_PANEL) {
      updateAgentTabQuery(agentTabFromUrl)
    } else {
      updatePanelQuery(panelId, params)
    }
  }

  useEffect(() => {
    if (!pendingPanelId) return
    const timeout = setTimeout(() => setPendingPanelId(null), 450)
    return () => clearTimeout(timeout)
  }, [pendingPanelId])

  function handleAgentTabChange(tabId) {
    setAgentTabFromUrl(tabId)
    updateAgentTabQuery(tabId)
  }

  const handleIntegrationStatsChange = useCallback((stats) => {
    setIntegrationStats((current) => mergeIntegrationStats(current, stats))
  }, [])

  async function handleToggleAgentCardActive() {
    if (!project.agent?.id || savingAgentCardActive) {
      return
    }

    const nextActive = !agentCardActive
    setSavingAgentCardActive(true)

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/agente`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agenteId: project.agent.id,
          nome: project.agent.name,
          descricao: project.agent.description,
          promptBase: project.agent.prompt,
          runtimeConfig: project.agent.runtimeConfig ?? null,
          configuracoes: project.agent.configuracoes ?? {},
          ativo: nextActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel alterar o status do agente.')
      }

      setAgentCardActive(nextActive)
      router.refresh()
    } catch (error) {
      console.error('[project-detail] failed to toggle agent from card', error)
    } finally {
      setSavingAgentCardActive(false)
    }
  }

  return (
    <div className={cn('min-h-full px-8 py-10', isMobile && 'h-[calc(100dvh-88px)] overflow-hidden px-0 pb-4 pt-4')}>
      <div
        className={cn(
          'z-30',
          isMobile
            ? 'relative mb-4 w-full'
            : 'fixed',
        )}
        style={
          isMobile
            ? undefined
            : {
                left: `${menuLeft}px`,
                top: `${menuTop}px`,
                width: `${menuWidth}px`,
                maxWidth: `${menuWidth}px`,
              }
        }
      >
        <div className={cn(isMobile ? 'py-0' : 'px-0 py-1')}>
          <HorizontalDragScroll
            className="w-full"
            itemClassName={isMobile ? 'px-0' : 'px-0.5'}
            scrollClassName={isMobile ? 'px-0 py-0.5' : 'px-0.5 py-0.5'}
          >
            {topMenuItems.map((item) => {
              const Icon = item.icon
              const active = activePanel === item.id && isPanelOpen
              const loading = pendingPanelId === item.id
              const toneClasses = getToneClasses(item.colorClassName)

              return (
                <button
                  key={item.id}
                  data-item-id={item.id}
                  type="button"
                  onClick={() => handleOpenPanel(item.id)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-semibold transition-colors',
                    active
                      ? toneClasses.pillActive
                      : cn(toneClasses.pill, toneClasses.text, toneClasses.hover),
                  )}
                >
                  {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {item.label}
                </button>
              )
            })}
          </HorizontalDragScroll>
        </div>
      </div>

      <div
        className={cn(
          'relative flex min-h-[420px] items-start justify-center lg:min-h-full lg:items-center',
          !isMobile && 'pt-14',
          isMobile && 'h-full min-h-0 overflow-hidden',
        )}
      >
        <motion.div
          animate={{
            left: cardLayout.left,
            top: cardLayout.top,
            scale: cardLayout.scale ?? CARD_CLOSED_SCALE,
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="z-10 w-full origin-center"
          style={{
            position: 'fixed',
            width: `${cardWidth}px`,
            maxWidth: `${cardWidth}px`,
          }}
        >
          <AdminProjectCard
            project={project}
            titleOverride={project.agent?.name || project.name}
            serviceIcons={directCardIcons}
            active={isPanelOpen}
            interactive
            usageBarPlacement="satellite"
            draggableHeader={!isMobile}
            resetDragSignal={dragResetSignal}
            onDragStateChange={setIsCardDragging}
            onSelect={() => handleOpenPanel(DEFAULT_PANEL)}
            onTestAgent={project.agent?.id ? () => setTestOpen(true) : null}
            statusControl={
              project.agent?.id ? (
                <span
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                >
                  <SheetPowerToggle
                    enabled={agentCardActive}
                    disabled={savingAgentCardActive}
                    onClick={handleToggleAgentCardActive}
                    compact
                  />
                </span>
              ) : null
            }
          >
            {activeIntegrationPanels
              .filter((panel) => panel.directToAgent)
              .map((panel, index) => {
                const Icon = panel.icon
                const satelliteLayout = getSatelliteLayout(panel, isMobile)
                const accent = getPanelAccentClasses(panel.colorClassName)
                const isActiveConnector = activePanel === panel.id && isPanelOpen
                const connectorClassName = isActiveConnector ? accent.connector : 'border-slate-500/55'
                const enabled = panelEnabledMap[panel.id] !== false

                return (
                  <div key={panel.id}>
                    <motion.div
                      initial={false}
                      animate={{ opacity: 0.72, scaleY: 1 }}
                      transition={{ duration: 0.24, delay: 0.035 * (index + 1), ease: 'easeOut' }}
                      className={cn('pointer-events-none absolute z-10 border-l border-dashed', isActiveConnector ? 'w-[2px]' : 'w-px', connectorClassName)}
                      style={satelliteLayout.trunkStyle}
                    />
                    <motion.div
                      initial={false}
                      animate={{ opacity: 0.72, scaleX: 1 }}
                      transition={{ duration: 0.24, delay: 0.045 * (index + 1), ease: 'easeOut' }}
                      className={cn('pointer-events-none absolute z-10 border-t border-dashed', isActiveConnector ? 'h-[2px]' : 'h-px', connectorClassName)}
                      style={satelliteLayout.branchStyle}
                    />
                    <motion.div
                      initial={false}
                      animate={{ opacity: 0.72, scaleY: 1 }}
                      transition={{ duration: 0.24, delay: 0.055 * (index + 1), ease: 'easeOut' }}
                      className={cn('pointer-events-none absolute z-10 border-l border-dashed', isActiveConnector ? 'w-[2px]' : 'w-px', connectorClassName)}
                      style={satelliteLayout.tipStyle}
                    />
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: 0.04 * (index + 1), ease: 'easeOut' }}
                      className="absolute z-20"
                      style={satelliteLayout.buttonStyle}
                    >
                      <div
                        className={cn(
                          'flex h-full w-full items-center gap-2 rounded-[22px] border border-white/10 bg-[#0c1426] px-3 py-2 text-slate-200 transition-[box-shadow,transform,background-color,border-color] duration-200',
                          isCardDragging
                            ? 'shadow-[0_14px_0_rgba(2,6,23,0.78)]'
                            : 'shadow-[0_8px_0_rgba(2,6,23,0.64)]',
                          activePanel === panel.id && isPanelOpen ? accent.button : 'hover:border-sky-400/30 hover:bg-[#12203a] hover:text-white',
                        )}
                      >
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleOpenPanel(panel.id)
                          }}
                          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1"
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 text-slate-300',
                              activePanel === panel.id && isPanelOpen ? accent.icon : null,
                            )}
                          />
                          <span className="truncate text-center text-[11px] font-medium tracking-[0.08em]">{panel.label}</span>
                        </button>
                        <span
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setPanelEnabledMap((current) => ({ ...current, [panel.id]: !enabled }))
                          }}
                          className="shrink-0 self-center"
                        >
                          <SheetPowerToggle enabled={enabled} compact />
                        </span>
                      </div>
                    </motion.div>
                  </div>
                )
              })}
          </AdminProjectCard>
        </motion.div>
      </div>

      <AgentSimulator
        project={project}
        agent={project.agent}
        open={testOpen}
        onOpenChange={setTestOpen}
        onUsageRecorded={() => router.refresh()}
      />

      <Sheet
        open={isPanelOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseSheet()
            return
          }

          setIsPanelOpen(true)
        }}
        modal={false}
      >
        <SheetContent
          side="right"
          showOverlay={false}
          showCloseButton={false}
          closeOnInteractOutside={false}
          closeOnEscapeKeyDown={false}
          className={
            isMobile
              ? 'inset-0 h-[100svh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-[#080e1d] p-0 text-slate-300 shadow-none'
              : 'right-[19px] top-[54px] bottom-[18px] h-auto overflow-visible rounded-l-lg border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-none'
          }
          style={
            isMobile
              ? { width: '100vw', maxWidth: '100vw' }
              : { width: `${dockedLayout.sheetWidth}px`, maxWidth: `${dockedLayout.sheetWidth}px` }
          }
        >
          <SheetTitle className="sr-only">{sheetHeading}</SheetTitle>
          <SheetDescription className="sr-only">{sheetIntro}</SheetDescription>
          {!isMobile ? (
            <SheetClose className="absolute left-0 top-[102px] z-40 inline-flex -translate-x-[60%] items-center justify-center rounded-full border border-white/10 bg-[#0c1426] p-2 text-slate-400 shadow-[0_14px_30px_rgba(2,6,23,0.52)] transition-colors hover:bg-[#101b31] hover:text-white focus:outline-none">
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Fechar painel</span>
            </SheetClose>
          ) : null}
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-l-lg">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activePanel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex h-full min-h-0 flex-col"
              >
                {selectedPanel ? (
                  <IntegrationPanel
                    key={`${selectedPanel.id}:${deepLink?.tab || ''}:${deepLink?.api || ''}:${deepLink?.channel || ''}:${deepLink?.widget || ''}:${deepLink?.notice || ''}`}
                    panel={selectedPanel}
                    sheetItems={sheetItems}
                    project={project}
                    deepLink={deepLink}
                    onCloseSheet={handleCloseSheet}
                    enabled={panelEnabledMap[selectedPanel.id] !== false}
                    onIntegrationStatsChange={handleIntegrationStatsChange}
                  />
                ) : (
                  <ProjectPanel
                    project={project}
                    initialAgentTab={agentTabFromUrl}
                    onAgentTabChange={handleAgentTabChange}
                    onOpenConnection={handleOpenPanel}
                    onCloseSheet={handleCloseSheet}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

