'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Files,
  MessageSquare,
  PackageSearch,
  PlugZap,
  Store,
  Wand2,
} from 'lucide-react'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1280
const COLLAPSED_SIDEBAR_WIDTH = 80
const CONTENT_SIDE_PADDING = 32
const DOCK_GAP = 24
const SHEET_RIGHT_OFFSET = 19
const SHEET_TOP_OFFSET = 54
const SHEET_BOTTOM_OFFSET = 18
const SHEET_MIN_WIDTH = 520
const SHEET_MAX_WIDTH = 1320
const CARD_ESTIMATED_HEIGHT = 228
const CARD_CLOSED_SCALE = 0.88
const MOBILE_CARD_SCALE = 0.72
const DEFAULT_PANEL = 'project'
const SATELLITE_BUTTON_WIDTH = 146
const SATELLITE_BUTTON_HEIGHT = 52

function buildIntegrationPanels(project) {
  return [
    {
      id: 'apis',
      label: 'APIs',
      icon: PlugZap,
      colorClassName: 'violet',
      mobilePosition: { x: 190, y: 312 },
      desktopPosition: { x: 230, y: 316 },
      cardAnchor: { x: 168, y: CARD_ESTIMATED_HEIGHT },
      routeY: 296,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'APIs',
      description: 'Endpoints cadastrados para o agente usar no pipeline.',
      statusLabel: `${project.integrations.apis} endpoints conectados`,
      items:
        project.apis.length > 0
          ? project.apis.map((api) => `${api.method} ${api.name}`)
          : ['Nenhuma API cadastrada neste projeto.'],
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: MessageSquare,
      colorClassName: 'emerald',
      mobilePosition: { x: -26, y: 300 },
      desktopPosition: { x: -34, y: 304 },
      cardAnchor: { x: 112, y: CARD_ESTIMATED_HEIGHT },
      routeY: 316,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'WhatsApp',
      description: 'Canais WhatsApp vinculados ao projeto.',
      statusLabel: `${project.integrations.whatsapp} numeros ativos`,
      items: ['Webhook de entrada', 'Fila de atendimento', 'Handoff humano', 'Resposta automatizada'],
    },
    {
      id: 'mercado-livre',
      label: 'Mercado Livre',
      icon: Store,
      colorClassName: 'amber',
      mobilePosition: { x: 190, y: 434 },
      desktopPosition: { x: 194, y: 450 },
      cardAnchor: { x: 194, y: CARD_ESTIMATED_HEIGHT },
      routeY: 432,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'Mercado Livre',
      description: 'Painel reservado para catalogo, pedidos e operacao de marketplace.',
      statusLabel: 'Integracao preparada',
      items: ['Catalogo', 'Pedidos', 'Reputacao', 'Perguntas'],
    },
    {
      id: 'chat-widget',
      label: 'Chat widget',
      icon: PackageSearch,
      colorClassName: 'sky',
      mobilePosition: { x: -18, y: 406 },
      desktopPosition: { x: -22, y: 422 },
      cardAnchor: { x: 138, y: CARD_ESTIMATED_HEIGHT },
      routeY: 404,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'Chat widget',
      description: 'Widgets web conectados ao atendimento.',
      statusLabel: `${project.integrations.chatWidget} widgets online`,
      items: ['Fluxo inicial', 'Qualificacao de lead', 'Fallback humano', 'Eventos de conversao'],
    },
  ]
}

function getPanelAccentClasses(colorClassName) {
  switch (colorClassName) {
    case 'emerald':
      return {
        connector: 'border-emerald-400/80',
        button: 'border-emerald-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(52,211,153,0.24),0_0_44px_rgba(5,150,105,0.16)]',
        icon: 'text-emerald-300',
      }
    case 'amber':
      return {
        connector: 'border-amber-400/80',
        button: 'border-amber-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(251,191,36,0.24),0_0_44px_rgba(217,119,6,0.16)]',
        icon: 'text-amber-300',
      }
    case 'sky':
      return {
        connector: 'border-sky-400/80',
        button: 'border-sky-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(56,189,248,0.24),0_0_44px_rgba(2,132,199,0.16)]',
        icon: 'text-sky-300',
      }
    case 'violet':
    default:
      return {
        connector: 'border-violet-400/80',
        button: 'border-violet-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(168,85,247,0.24),0_0_44px_rgba(126,34,206,0.16)]',
        icon: 'text-violet-300',
      }
  }
}

function getSatelliteLayout(panel, isMobile) {
  const position = isMobile ? panel.mobilePosition : panel.desktopPosition
  const lineStart = { x: panel.cardAnchor.x, y: panel.cardAnchor.y }
  const lineEnd = { x: position.x + panel.buttonAnchor.x, y: position.y + panel.buttonAnchor.y }
  const routeY = panel.routeY

  return {
    buttonStyle: {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${SATELLITE_BUTTON_WIDTH}px`,
      height: `${SATELLITE_BUTTON_HEIGHT}px`,
    },
    trunkStyle: {
      left: `${lineStart.x}px`,
      top: `${lineStart.y}px`,
      height: `${Math.abs(routeY - lineStart.y)}px`,
    },
    branchStyle: {
      left: `${Math.min(lineStart.x, lineEnd.x)}px`,
      top: `${routeY}px`,
      width: `${Math.abs(lineEnd.x - lineStart.x)}px`,
    },
    tipStyle: {
      left: `${lineEnd.x}px`,
      top: `${Math.min(routeY, lineEnd.y)}px`,
      height: `${Math.abs(lineEnd.y - routeY)}px`,
    },
  }
}

function getSheetWidth(viewportWidth) {
  if (viewportWidth < MOBILE_BREAKPOINT) {
    return viewportWidth
  }

  if (viewportWidth < DESKTOP_BREAKPOINT) {
    return Math.min(Math.max(viewportWidth * 0.52, SHEET_MIN_WIDTH), 760)
  }

  let widthRatio = 0.54

  if (viewportWidth >= 1800) {
    widthRatio = 0.64
  } else if (viewportWidth >= 1600) {
    widthRatio = 0.59
  }

  return Math.min(Math.max(viewportWidth * widthRatio, SHEET_MIN_WIDTH), SHEET_MAX_WIDTH)
}

function getCardWidth(viewportWidth) {
  if (viewportWidth < MOBILE_BREAKPOINT) {
    return Math.min(viewportWidth - 48, 320)
  }

  if (viewportWidth < DESKTOP_BREAKPOINT) {
    return 332
  }

  if (viewportWidth >= 1800) {
    return 368
  }

  return 348
}

function getDockedCardScale(viewportWidth) {
  if (viewportWidth < DESKTOP_BREAKPOINT) {
    return 0.92
  }

  return viewportWidth >= 1600 ? 0.82 : 0.78
}

function getClosedCardLayout(viewportWidth, viewportHeight, cardWidth) {
  const isMobile = viewportWidth < MOBILE_BREAKPOINT
  const contentLeft = isMobile ? CONTENT_SIDE_PADDING / 2 : COLLAPSED_SIDEBAR_WIDTH + CONTENT_SIDE_PADDING
  const contentRight = viewportWidth - CONTENT_SIDE_PADDING
  const usableWidth = Math.max(cardWidth, contentRight - contentLeft)

  return {
    left: contentLeft + Math.max((usableWidth - cardWidth) / 2, 0),
    top: Math.max((viewportHeight - CARD_ESTIMATED_HEIGHT) / 2, SHEET_TOP_OFFSET + 24),
    scale: 1,
  }
}

function getMobileCardLayout(viewportWidth, cardWidth) {
  return {
    left: Math.max((viewportWidth - cardWidth) / 2, 0),
    top: 56,
    scale: MOBILE_CARD_SCALE,
  }
}

function getDockedCardLayout({ viewportWidth, viewportHeight }) {
  const sheetWidth = getSheetWidth(viewportWidth)
  const cardWidth = getCardWidth(viewportWidth)
  const scale = getDockedCardScale(viewportWidth)
  const dockLeft = COLLAPSED_SIDEBAR_WIDTH + CONTENT_SIDE_PADDING + DOCK_GAP
  const dockRight = viewportWidth - SHEET_RIGHT_OFFSET - sheetWidth - DOCK_GAP
  const usableWidth = Math.max(cardWidth, dockRight - dockLeft)
  const scaledCardWidth = cardWidth * scale
  const availableTravel = Math.max(usableWidth - scaledCardWidth, 0)
  const anchorFactor = viewportWidth >= 1400 ? 0.12 : 0.5
  const left = dockLeft + availableTravel * anchorFactor
  const top = Math.max((viewportHeight - CARD_ESTIMATED_HEIGHT) / 2, SHEET_TOP_OFFSET + 24)

  return { left, top, scale, cardWidth, sheetWidth }
}

function SheetPanelHeader({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'emerald',
  compactTitle = true,
  enabled = true,
}) {
  const statusClasses =
    statusTone === 'sky'
      ? { text: 'text-sky-300', track: 'bg-sky-500/20', thumb: 'bg-sky-300' }
      : { text: 'text-emerald-300', track: 'bg-emerald-500/20', thumb: 'bg-emerald-300' }

  return (
    <div className="border-b border-white/5 px-6 py-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 pr-14 sm:pr-0">
          <div className="min-w-0">
            <p className={cn('hidden text-xs uppercase tracking-[0.22em] sm:block', statusTone === 'sky' ? 'text-sky-300' : 'text-slate-500')}>
              {eyebrow}
            </p>
            <h2
              className={cn(
                'font-semibold text-white sm:mt-2',
                compactTitle ? 'text-xl leading-tight' : 'text-[2rem] leading-none',
              )}
            >
              {title}
            </h2>
          </div>

          {statusLabel ? (
            <div className="flex shrink-0 items-center gap-3">
              <span className={cn('text-xs font-semibold uppercase tracking-[0.18em]', statusClasses.text)}>
                {enabled ? 'Desativar' : 'Ativar'}
              </span>
              <div className={cn('flex h-7 w-10 items-center rounded-full p-1', statusClasses.track)}>
                <div className={cn(enabled ? 'ml-auto' : 'mr-auto', 'h-5 w-5 rounded-full', statusClasses.thumb)} />
              </div>
            </div>
          ) : null}
        </div>

        <p className="hidden text-sm text-slate-400 sm:block">{description}</p>
      </div>
    </div>
  )
}

function ProjectPanel({ project }) {
  const agent = project.agent

  return (
    <>
      <SheetPanelHeader
        eyebrow="Agente"
        title="Editar"
        description="Defina o agente e selecione quais APIs deste projeto ele pode usar."
        statusLabel={agent?.active === false ? 'Inativo' : 'Ativo'}
        statusTone="sky"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-h-full grid-cols-1 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-white/5 px-6 py-5 xl:border-b-0 xl:border-r">
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Nome do agente
                </label>
                <div className="mt-3 rounded-xl border border-white/10 bg-[#0a1020] px-4 py-3 text-sm text-white">
                  {agent?.name || 'Nenhum agente ativo encontrado'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Resumo do agente
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs text-emerald-200"
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Validar e organizar
                  </Button>
                </div>

                <div className="mt-3 min-h-[420px] rounded-2xl border border-white/10 bg-[#0a1020] p-4 text-sm leading-6 text-slate-300">
                  {agent?.prompt || agent?.description || 'Sem prompt base cadastrado para este agente.'}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-4">
              {[
                { icon: MessageSquare, title: 'Chat widget', value: project.integrations.chatWidget },
                { icon: MessageSquare, title: 'WhatsApp', value: project.integrations.whatsapp },
                { icon: PlugZap, title: 'APIs disponiveis', value: project.integrations.apis },
                { icon: Files, title: 'Arquivos e imagens', value: project.integrations.files },
              ].map((section) => {
                const Icon = section.icon

                return (
                  <div key={section.title} className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                        <Icon className="h-4 w-4 text-slate-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">{section.title}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">
                          {section.value} registro(s) encontrado(s) no banco para este projeto.
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">
                      APIs disponiveis para este agente
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Escolha quais APIs este agente pode usar no atendimento.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-300"
                  >
                    Expandir
                    <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
            Salvar
          </Button>
          <Button type="button" variant="ghost" className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300">
            Cancelar
          </Button>
        </div>
      </div>
    </>
  )
}

function IntegrationPanel({ panel, sheetItems }) {
  return (
    <>
      <SheetPanelHeader
        eyebrow="Integration Panel"
        title={panel.title}
        description={panel.description}
        statusLabel={panel.statusLabel}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
            <div className="mt-3 text-base font-medium text-white">{panel.statusLabel}</div>
            <div className="mt-2 text-sm text-slate-400">{panel.description}</div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Connected modules
            </div>
            <div className="mt-4 space-y-3">
              {sheetItems.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3"
                >
                  <span className="text-sm text-slate-200">{item}</span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                    ok
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function AdminProjectDetailPage({ project }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activePanel, setActivePanel] = useState(DEFAULT_PANEL)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [dragResetSignal, setDragResetSignal] = useState(0)
  const [isCardDragging, setIsCardDragging] = useState(false)
  const integrationPanels = useMemo(() => buildIntegrationPanels(project), [project])

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

  function handleOpenPanel(panelId = DEFAULT_PANEL) {
    setActivePanel(panelId)
    setIsPanelOpen(true)
  }

  return (
    <div className={cn('min-h-full px-8 py-10', isMobile && 'h-[calc(100dvh-88px)] overflow-hidden px-4 py-6')}>
      <div
        className={cn(
          'relative flex min-h-[420px] items-start justify-center lg:min-h-full lg:items-center',
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
            active={isPanelOpen}
            interactive
            draggableHeader={!isMobile}
            resetDragSignal={dragResetSignal}
            onDragStateChange={setIsCardDragging}
            onSelect={() => handleOpenPanel(DEFAULT_PANEL)}
          >
            {integrationPanels.map((panel, index) => {
              const Icon = panel.icon
              const satelliteLayout = getSatelliteLayout(panel, isMobile)
              const accent = getPanelAccentClasses(panel.colorClassName)
              const isActiveConnector = activePanel === panel.id && isPanelOpen
              const connectorClassName = isActiveConnector ? accent.connector : 'border-slate-600/35'

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
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        handleOpenPanel(panel.id)
                      }}
                      className={cn(
                        'h-full w-full rounded-full border border-white/10 bg-[#0c1426] px-4 text-slate-200 transition-[box-shadow,transform] duration-200 hover:bg-[#101b31] hover:text-white',
                        isCardDragging
                          ? 'shadow-[0_14px_0_rgba(2,6,23,0.78)]'
                          : 'shadow-[0_8px_0_rgba(2,6,23,0.64)]',
                        activePanel === panel.id && isPanelOpen ? accent.button : null,
                      )}
                    >
                      <Icon
                        className={cn(
                          'mr-2 h-4 w-4 text-slate-300',
                          activePanel === panel.id && isPanelOpen ? accent.icon : null,
                        )}
                      />
                      <span className="text-xs font-medium tracking-[0.08em]">{panel.label}</span>
                    </Button>
                  </motion.div>
                </div>
              )
            })}
          </AdminProjectCard>
        </motion.div>
      </div>

      <Sheet
        open={isPanelOpen}
        onOpenChange={(open) => {
          setIsPanelOpen(open)

          if (!open) {
            setActivePanel(DEFAULT_PANEL)
          }
        }}
        modal={false}
      >
        <SheetContent
          side="right"
          showOverlay={false}
          closeOnInteractOutside={false}
          closeOnEscapeKeyDown={false}
          className={
            isMobile
              ? 'inset-0 h-screen w-screen max-w-none overflow-hidden rounded-none border-0 bg-[#080e1d] p-0 text-slate-300 shadow-none'
              : 'right-[19px] top-[54px] bottom-[18px] h-auto overflow-hidden rounded-l-lg border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-none'
          }
          style={
            isMobile
              ? { width: '100vw', maxWidth: '100vw' }
              : { width: `${dockedLayout.sheetWidth}px`, maxWidth: `${dockedLayout.sheetWidth}px` }
          }
        >
          <SheetTitle className="sr-only">{sheetHeading}</SheetTitle>
          <SheetDescription className="sr-only">{sheetIntro}</SheetDescription>
          <div className="flex h-full min-h-0 flex-col">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activePanel}
                initial={{ opacity: 0, x: 56 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 56 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full min-h-0 flex-col"
              >
                {selectedPanel ? (
                  <IntegrationPanel panel={selectedPanel} sheetItems={sheetItems} />
                ) : (
                  <ProjectPanel project={project} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
