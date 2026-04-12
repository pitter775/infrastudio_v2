'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronRight,
  Files,
  History,
  MessageSquare,
  PackageSearch,
  PlugZap,
  RotateCcw,
  Store,
  Wand2,
} from 'lucide-react'
import { AgentSimulator } from '@/components/app/agents/agent-simulator'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { Button } from '@/components/ui/button'
import { HorizontalDragScroll } from '@/components/ui/horizontal-drag-scroll'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1280
const COLLAPSED_SIDEBAR_WIDTH = 80
const EXPANDED_SIDEBAR_WIDTH = 192
const CONTENT_SIDE_PADDING = 32
const DOCK_GAP = 24
const SHEET_RIGHT_OFFSET = 19
const SHEET_TOP_OFFSET = 54
const SHEET_BOTTOM_OFFSET = 18
const SHEET_MIN_WIDTH = 460
const SHEET_MAX_WIDTH = 1120
const CARD_ESTIMATED_HEIGHT = 228
const CARD_CLOSED_SCALE = 0.88
const MOBILE_CARD_SCALE = 0.72
const DEFAULT_PANEL = 'project'
const SATELLITE_BUTTON_WIDTH = 146
const SATELLITE_BUTTON_HEIGHT = 52

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\*)([^*]+)\*(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!_)([^_]+)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function plainTextToEditorHtml(value) {
  const normalizedValue = (value || '').replace(/\r\n/g, '\n').trim()

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trimEnd())
      const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line))

      if (bulletLines.length === lines.length) {
        return `<ul>${bulletLines
          .map((line) => line.replace(/^[-*]\s+/, ''))
          .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
          .join('')}</ul>`
      }

      if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
        const headingLine = lines[0]
        const level = Math.min(3, headingLine.match(/^#+/)?.[0]?.length || 1)
        return `<h${level}>${formatInlineMarkdown(headingLine.replace(/^#{1,3}\s+/, ''))}</h${level}>`
      }

      return `<p>${lines.map((line) => formatInlineMarkdown(line)).join('<br />')}</p>`
    })
    .join('')
}

function richTextToPlainText(value) {
  if (!value || typeof document === 'undefined') {
    return ''
  }

  const container = document.createElement('div')
  container.innerHTML = value

  container.querySelectorAll('br').forEach((lineBreak) => {
    lineBreak.replaceWith('\n')
  })

  container.querySelectorAll('li').forEach((item) => {
    item.insertBefore(document.createTextNode('- '), item.firstChild)
    item.append(document.createTextNode('\n'))
  })

  container.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre').forEach((node) => {
    node.append(document.createTextNode('\n\n'))
  })

  return (container.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function AgentRichEditor({ value, onChange, placeholder }) {
  function runCommand(command) {
    if (typeof document === 'undefined') {
      return
    }

    document.execCommand(command)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020]">
      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-[#0d1528] px-3 py-3">
        {[
          { label: 'B', command: 'bold', className: 'font-bold' },
          { label: 'I', command: 'italic', className: 'italic' },
          { label: 'U', command: 'underline', className: 'underline' },
          { label: 'Lista', command: 'insertUnorderedList', className: '' },
        ].map((item) => (
          <button
            key={item.command}
            type="button"
            onClick={() => runCommand(item.command)}
            className={cn(
              'inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 transition hover:bg-white/[0.06]',
              item.className,
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        data-placeholder={placeholder}
        className="infra-rich-editor min-h-[420px] px-4 py-4 text-sm leading-7 text-slate-200 outline-none"
      />
    </div>
  )
}

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

function resolveEntityAvatarUrl(primaryUrl, siteUrl) {
  if (primaryUrl) {
    return primaryUrl
  }

  if (!siteUrl) {
    return ''
  }

  try {
    return new URL('/favicon.ico', siteUrl).toString()
  } catch {
    return ''
  }
}

function buildMergedAgentSummary(currentHtml, generatedSummary) {
  const currentText = richTextToPlainText(currentHtml)
  const summaryText = String(generatedSummary || '').trim()

  if (!summaryText) {
    return currentHtml
  }

  const mergedText = currentText ? `${currentText}\n\n${summaryText}` : summaryText
  return plainTextToEditorHtml(mergedText)
}

function buildIntegrationPanels(project) {
  return [
    {
      id: 'apis',
      label: 'APIs',
      shortLabel: 'APIs',
      icon: PlugZap,
      colorClassName: 'sky',
      directToAgent: true,
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
      shortLabel: 'WhatsApp',
      icon: MessageSquare,
      colorClassName: 'emerald',
      directToAgent: true,
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
      shortLabel: 'Mercado Livre',
      icon: Store,
      colorClassName: 'amber',
      directToAgent: false,
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
      shortLabel: 'Chat widget',
      icon: PackageSearch,
      colorClassName: 'sky',
      directToAgent: true,
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

function buildTopMenuItems(panels) {
  return [
    {
      id: DEFAULT_PANEL,
      label: 'Agente',
      icon: Wand2,
    },
    ...panels.map((panel) => ({
      id: panel.id,
      label: panel.shortLabel || panel.label,
      icon: panel.icon,
    })),
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
    default:
      return {
        connector: 'border-sky-400/80',
        button: 'border-sky-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(56,189,248,0.24),0_0_44px_rgba(2,132,199,0.16)]',
        icon: 'text-sky-300',
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
    return Math.min(Math.max(viewportWidth * 0.48, SHEET_MIN_WIDTH), 700)
  }

  let widthRatio = 0.48

  if (viewportWidth >= 1800) {
    widthRatio = 0.56
  } else if (viewportWidth >= 1600) {
    widthRatio = 0.52
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
  description,
  statusLabel,
  statusTone = 'emerald',
  enabled = true,
  leftAction = null,
}) {
  const statusClasses =
    statusTone === 'sky'
      ? { text: 'text-sky-300', track: 'bg-sky-500/20', thumb: 'bg-sky-300' }
      : { text: 'text-emerald-300', track: 'bg-emerald-500/20', thumb: 'bg-emerald-300' }

  return (
    <div className="px-6 py-5">
      <div className="flex flex-col gap-3 pr-14 sm:pr-0">
        <div className="flex items-center gap-3">
          <p className={cn('hidden text-xs uppercase tracking-[0.22em] sm:block', statusTone === 'sky' ? 'text-sky-300' : 'text-slate-500')}>
            {eyebrow}
          </p>

          {leftAction ? <div className="flex items-center">{leftAction}</div> : null}

          {!leftAction && statusLabel ? (
          <div className="flex items-center gap-3">
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

function SheetPowerToggle({ enabled, disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group inline-flex h-7 items-center gap-1.5 rounded-full border px-2 pr-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        enabled
          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
          : 'border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20',
      )}
      title={enabled ? 'Desativar' : 'Ativar'}
    >
      <span
        className={cn(
          'flex h-4 w-7 items-center rounded-full p-0.5 transition-colors',
          enabled ? 'bg-emerald-400/25' : 'bg-red-400/25',
        )}
      >
        <span
          className={cn(
            'h-3 w-3 rounded-full transition-transform',
            enabled ? 'translate-x-3 bg-emerald-300' : 'translate-x-0 bg-red-300',
          )}
        />
      </span>
      {enabled ? 'Desativar' : 'Ativar'}
    </button>
  )
}

function SheetInternalTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="border-b border-white/5 px-6 py-3">
      <HorizontalDragScroll className="-mx-1" itemClassName="px-1" scrollClassName="py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = tab.id === activeTab

          return (
            <button
              key={tab.id}
              itemId={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition-colors',
                active
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {tab.label}
              {tab.badge ? (
                <span className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </HorizontalDragScroll>
    </div>
  )
}

function PlaceholderPanel({ title, description, items = [] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-5">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
      {items.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-slate-300">
              {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ProjectPanel({ project }) {
  const router = useRouter()
  const agent = project.agent
  const projectIdentifier = project.routeKey || project.slug || project.id
  const initialAgentName = agent?.name || ''
  const initialPrompt = agent?.prompt || agent?.description || ''
  const initialLogoUrl = agent?.logoUrl || ''
  const initialSiteUrl = agent?.siteUrl || ''
  const [agentActive, setAgentActive] = useState(agent?.active !== false)
  const [versions, setVersions] = useState(agent?.versions || [])
  const [restoringId, setRestoringId] = useState('')
  const [savingActive, setSavingActive] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [generatingSiteSummary, setGeneratingSiteSummary] = useState(false)
  const [agentName, setAgentName] = useState(initialAgentName)
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [promptValue, setPromptValue] = useState(() => plainTextToEditorHtml(initialPrompt))
  const [rollbackStatus, setRollbackStatus] = useState({ type: 'idle', message: '' })
  const [editorStatus, setEditorStatus] = useState({ type: 'idle', message: '' })
  const [siteSummaryStatus, setSiteSummaryStatus] = useState({ type: 'idle', message: '' })
  const [activeAgentTab, setActiveAgentTab] = useState('edit')
  const agentTabs = [
    { id: 'edit', label: 'Editar agente', icon: Wand2 },
    { id: 'history', label: 'Historico', icon: History },
    { id: 'json', label: 'Ver JSON', icon: Files },
    { id: 'connections', label: 'Conexoes', icon: PlugZap },
    { id: 'observability', label: 'Observabilidade', icon: MessageSquare, badge: 'Em desenvolvimento' },
  ]
  const normalizedPrompt = useMemo(() => richTextToPlainText(promptValue), [promptValue])
  const hasUnsavedChanges =
    agentName.trim() !== initialAgentName.trim() ||
    normalizedPrompt !== initialPrompt.trim() ||
    siteUrl.trim() !== initialSiteUrl.trim() ||
    logoUrl.trim() !== initialLogoUrl.trim()

  useEffect(() => {
    setAgentName(initialAgentName)
    setSiteUrl(initialSiteUrl)
    setLogoUrl(initialLogoUrl)
    setPromptValue(plainTextToEditorHtml(initialPrompt))
    setEditorStatus({ type: 'idle', message: '' })
  }, [initialAgentName, initialLogoUrl, initialPrompt, initialSiteUrl])

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
          configuracoes: {
            ...(agent.configuracoes ?? {}),
            brand: {
              ...((agent.configuracoes?.brand && typeof agent.configuracoes.brand === 'object') ? agent.configuracoes.brand : {}),
              siteUrl: siteUrl.trim(),
              logoUrl: logoUrl.trim(),
            },
          },
          ativo: nextActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel alterar o status do agente.')
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

    const confirmed = window.confirm('Restaurar esta versao do agente? O estado atual sera salvo no historico antes do rollback.')
    if (!confirmed) {
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
        throw new Error(data.error || 'Nao foi possivel restaurar a versao.')
      }

      setVersions(Array.isArray(data.versions) ? data.versions : [])
      setRollbackStatus({ type: 'success', message: 'Versao restaurada.' })
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
          runtimeConfig: agent.runtimeConfig ?? null,
          configuracoes: {
            ...(agent.configuracoes ?? {}),
            brand: {
              ...((agent.configuracoes?.brand && typeof agent.configuracoes.brand === 'object') ? agent.configuracoes.brand : {}),
              siteUrl: siteUrl.trim(),
              logoUrl: logoUrl.trim(),
            },
          },
          ativo: agentActive,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel salvar o agente.')
      }

      if (Array.isArray(data.versions)) {
        setVersions(data.versions)
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
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel gerar o resumo do site.')
      }

      setPromptValue((currentValue) => buildMergedAgentSummary(currentValue, data.summary))
      if (data?.source?.logoUrl) {
        setLogoUrl(data.source.logoUrl)
      }
      setSiteSummaryStatus({ type: 'success', message: 'Resumo do site somado ao editor.' })
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
        description="Defina o agente e selecione quais APIs deste projeto ele pode usar."
        statusTone="sky"
        leftAction={
          agent?.id ? (
            <SheetPowerToggle enabled={agentActive} disabled={savingActive} onClick={handleToggleAgentActive} />
          ) : null
        }
      />
      <SheetInternalTabs tabs={agentTabs} activeTab={activeAgentTab} onChange={setActiveAgentTab} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeAgentTab === 'edit' ? (
        <div className="min-h-full px-6 py-5">
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

                <div className="mt-3 flex flex-col gap-3 xl:flex-row">
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
                    O sistema busca informacoes do site e soma esse contexto ao texto que voce ja escreveu no editor.
                  </p>
                  {logoUrl ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <TinyEntityAvatar src={resolveEntityAvatarUrl(logoUrl, siteUrl)} label={agentName || 'Agente'} />
                      <span>Logo capturado do site e pronto para salvar no agente.</span>
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
                    Comportamento do agente
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs text-emerald-200"
                    onClick={handleResetAgentDraft}
                  >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Voltar ao ultimo carregado
                  </Button>
                </div>

                <div className="mt-3">
                  <AgentRichEditor
                    value={promptValue}
                    onChange={setPromptValue}
                    placeholder="Defina o comportamento, regras, tom, exemplos e limites do agente."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {activeAgentTab === 'json' ? (
          <div className="px-6 py-5">
            <pre className="max-h-[calc(100vh-220px)] overflow-auto rounded-2xl border border-white/10 bg-[#0a1020] p-4 text-xs leading-5 text-slate-300">
              {JSON.stringify({ projectId: project.id, agent }, null, 2)}
            </pre>
          </div>
        ) : null}

        {activeAgentTab === 'connections' ? (
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <PlaceholderPanel title="APIs vinculadas" description="Aqui entram as APIs liberadas para este agente." items={project.apis.map((api) => api.name)} />
            <PlaceholderPanel title="Canais conectados" description="Aqui entram widget, WhatsApp e conectores usados pelo agente." items={['Chat widget', 'WhatsApp', 'Arquivos']} />
          </div>
        ) : null}

        {activeAgentTab === 'history' ? (
          <div className="px-6 py-5">
            <div className="rounded-2xl border border-white/10 bg-[#0a1020] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <History className="h-4 w-4 text-sky-300" />
                    Historico e rollback
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Restaure uma versao anterior do prompt e runtimeConfig.
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
                  {versions.slice(0, 8).map((version) => (
                    <div
                      key={version.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          v{version.versionNumber} - {version.nome}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {new Date(version.createdAt).toLocaleString('pt-BR')} - {version.source === 'rollback' ? 'rollback' : 'salvamento'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={Boolean(restoringId)}
                        onClick={() => handleRestoreVersion(version.id)}
                        className="h-8 shrink-0 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 text-xs text-sky-100"
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        {restoringId === version.id ? 'Restaurando...' : 'Rollback'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-slate-500">
                  Nenhuma versao salva ainda. O historico sera criado antes do proximo salvamento.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeAgentTab === 'observability' ? (
          <div className="px-6 py-5">
            <PlaceholderPanel
              title="Observabilidade do agente"
              description="Espaco reservado para IA trace, APIs consultadas, custo, handoff e falhas do runtime."
              items={['IA trace', 'APIs consultadas', 'Tokens e custo', 'Handoff', 'Fail-closed']}
            />
          </div>
        ) : null}
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
            disabled={activeAgentTab !== 'edit' || !agent?.id || savingDraft}
            onClick={handleSaveAgent}
            className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDraft ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={activeAgentTab !== 'edit' || !hasUnsavedChanges || savingDraft}
            onClick={handleResetAgentDraft}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </>
  )
}

function buildIntegrationTabs(panelId) {
  if (panelId === 'apis') {
    return [
      { id: 'list', label: 'Lista', icon: PlugZap },
      { id: 'edit', label: 'Criar/editar', icon: Wand2 },
      { id: 'json', label: 'Ver JSON', icon: Files },
      { id: 'test', label: 'Testar', icon: MessageSquare },
      { id: 'history', label: 'Historico', icon: History },
    ]
  }

  if (panelId === 'whatsapp') {
    return [
      { id: 'channels', label: 'Canais', icon: MessageSquare },
      { id: 'qr', label: 'QR Code', icon: Store },
      { id: 'session', label: 'Sessao', icon: PlugZap },
      { id: 'events', label: 'Eventos', icon: History },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  if (panelId === 'chat-widget') {
    return [
      { id: 'widgets', label: 'Widgets', icon: PackageSearch },
      { id: 'install', label: 'Instalacao', icon: PlugZap },
      { id: 'behavior', label: 'Comportamento', icon: Wand2 },
      { id: 'events', label: 'Eventos', icon: History },
      { id: 'json', label: 'Config JSON', icon: Files },
    ]
  }

  return [
    { id: 'overview', label: 'Visao geral', icon: Store },
    { id: 'catalog', label: 'Catalogo', icon: PackageSearch },
    { id: 'orders', label: 'Pedidos', icon: Files },
    { id: 'questions', label: 'Perguntas', icon: MessageSquare },
    { id: 'json', label: 'Config JSON', icon: Files },
  ]
}

function IntegrationPanel({ panel, sheetItems }) {
  const tabs = useMemo(() => buildIntegrationTabs(panel.id), [panel.id])
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'overview')
  const [enabled, setEnabled] = useState(true)

  return (
    <>
      <SheetPanelHeader
        eyebrow="Painel de integracao"
        description={panel.description}
        leftAction={<SheetPowerToggle enabled={enabled} onClick={() => setEnabled((value) => !value)} />}
      />
      <SheetInternalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-6 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
            <div className="mt-3 text-base font-medium text-white">{panel.statusLabel}</div>
            <div className="mt-2 text-sm text-slate-400">{panel.description}</div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Modulos conectados
            </div>
            <div className="mt-2 text-xs text-slate-500">Aba ativa: {tabs.find((tab) => tab.id === activeTab)?.label}</div>
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
  const [testOpen, setTestOpen] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [dragResetSignal, setDragResetSignal] = useState(0)
  const [isCardDragging, setIsCardDragging] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const integrationPanels = useMemo(() => buildIntegrationPanels(project), [project])
  const topMenuItems = useMemo(() => buildTopMenuItems(integrationPanels), [integrationPanels])
  const directCardIcons = useMemo(
    () =>
      integrationPanels
        .filter((panel) => panel.directToAgent)
        .map((panel) => panel.id),
    [integrationPanels],
  )

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
  function handleOpenPanel(panelId = DEFAULT_PANEL) {
    setActivePanel(panelId)
    setIsPanelOpen(true)
  }

  return (
    <div className={cn('min-h-full px-8 py-10', isMobile && 'h-[calc(100dvh-88px)] overflow-hidden px-4 py-6')}>
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
        <div className="px-0 py-1">
          <HorizontalDragScroll className="w-full" itemClassName="px-1" scrollClassName="px-1 py-0.5">
            {topMenuItems.map((item) => {
              const Icon = item.icon
              const active = activePanel === item.id && isPanelOpen

              return (
                <button
                  key={item.id}
                  itemId={item.id}
                  type="button"
                  onClick={() => handleOpenPanel(item.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-sky-500/15 text-sky-200'
                      : 'bg-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
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
            serviceIcons={directCardIcons}
            active={isPanelOpen}
            interactive
            draggableHeader={!isMobile}
            resetDragSignal={dragResetSignal}
            onDragStateChange={setIsCardDragging}
            onSelect={() => handleOpenPanel(DEFAULT_PANEL)}
            onTestAgent={project.agent?.id ? () => setTestOpen(true) : null}
          >
            {integrationPanels
              .filter((panel) => panel.directToAgent)
              .map((panel, index) => {
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

      <AgentSimulator project={project} agent={project.agent} open={testOpen} onOpenChange={setTestOpen} />

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
          showCloseButton={false}
          closeOnInteractOutside={false}
          closeOnEscapeKeyDown={false}
          className={
            isMobile
              ? 'inset-0 h-screen w-screen max-w-none overflow-hidden rounded-none border-0 bg-[#080e1d] p-0 text-slate-300 shadow-none'
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
            <SheetClose className="absolute left-0 top-[102px] z-40 -translate-x-1/2 rounded-full border border-white/10 bg-[#0c1426] p-2 text-slate-400 shadow-[0_14px_30px_rgba(2,6,23,0.52)] transition-colors hover:bg-[#101b31] hover:text-white focus:outline-none">
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Fechar painel</span>
            </SheetClose>
          ) : null}
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-l-lg">
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
