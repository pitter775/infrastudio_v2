'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  ChevronRight,
  Files,
  History,
  LoaderCircle,
  MessageSquare,
  PackageSearch,
  PlugZap,
  RotateCcw,
  Store,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import { AgentSimulator } from '@/components/app/agents/agent-simulator'
import { ApiManager } from '@/components/app/apis/api-manager'
import { WhatsAppManager } from '@/components/app/whatsapp/whatsapp-manager'
import { WidgetManager } from '@/components/app/widgets/widget-manager'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { HorizontalDragScroll } from '@/components/ui/horizontal-drag-scroll'
import { JsonCodeBlock } from '@/components/ui/json-code-block'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { formatCredits } from '@/lib/public-planos'
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
const AGENT_TAB_URL_VALUES = {
  edit: 'editar',
  history: 'historico',
  json: 'json',
  connections: 'conexao',
}
const AGENT_TAB_ALIASES = {
  edit: 'edit',
  editar: 'edit',
  history: 'history',
  historico: 'history',
  json: 'json',
  connections: 'connections',
  conexao: 'connections',
  conexoes: 'connections',
}
const SATELLITE_BUTTON_WIDTH = 152
const SATELLITE_BUTTON_HEIGHT = 64

function resolveAgentTab(value) {
  return AGENT_TAB_ALIASES[String(value || '').toLowerCase()] || null
}

function getAgentTabUrlValue(tabId) {
  return AGENT_TAB_URL_VALUES[tabId] || AGENT_TAB_URL_VALUES.edit
}

function updateAgentTabQuery(tabId) {
  const url = new URL(window.location.href)
  url.searchParams.set('tab', getAgentTabUrlValue(tabId))
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function updatePanelQuery(panelId, params = {}) {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', panelId)
  url.searchParams.delete('tab')
  url.searchParams.delete('api')
  url.searchParams.delete('channel')
  url.searchParams.delete('widget')

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  })

  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function clearProjectDetailQuery() {
  const url = new URL(window.location.href)
  url.searchParams.delete('panel')
  url.searchParams.delete('tab')
  url.searchParams.delete('api')
  url.searchParams.delete('channel')
  url.searchParams.delete('widget')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

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
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'infra-rich-editor min-h-[420px] px-4 py-4 text-sm leading-7 text-slate-200 outline-none',
        'data-placeholder': placeholder || '',
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return
    }

    const nextValue = value || ''
    if (nextValue !== editor.getHTML()) {
      editor.commands.setContent(nextValue, { emitUpdate: false })
    }
  }, [editor, value])

  const toolbarItems = [
    {
      label: 'B',
      name: 'bold',
      className: 'font-bold',
      onClick: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'I',
      name: 'italic',
      className: 'italic',
      onClick: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Lista',
      name: 'bulletList',
      className: '',
      onClick: () => editor?.chain().focus().toggleBulletList().run(),
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020]">
      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-[#0d1528] px-3 py-3">
        {toolbarItems.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={item.onClick}
            disabled={!editor}
            className={cn(
              'inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 transition hover:bg-white/[0.06]',
              editor?.isActive(item.name) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : '',
              !editor ? 'cursor-not-allowed opacity-50' : '',
              item.className,
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} />
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

function buildMergedAgentSummary(currentHtml, generatedSummary, promptSuggestion = '') {
  const currentText = richTextToPlainText(currentHtml)
  const summaryText = String(generatedSummary || '').trim()
  const promptText = String(promptSuggestion || '').trim()
  const nextSections = []

  if (summaryText) {
    nextSections.push(summaryText)
  }

  if (promptText) {
    nextSections.push(`Prompt base sugerido:\n${promptText}`)
  }

  if (!nextSections.length) {
    return currentHtml
  }

  const mergedText = currentText ? `${currentText}\n\n${nextSections.join('\n\n')}` : nextSections.join('\n\n')
  return plainTextToEditorHtml(mergedText)
}

function buildSiteSummaryHighlights(data) {
  if (!data?.source) {
    return []
  }

  const source = data.source
  const contacts = source.contacts || {}
  const institutionals = source.institutionalData || {}
  const structuredData = source.structuredData || {}

  return [
    contacts.emails?.length ? { label: 'Emails', values: contacts.emails } : null,
    contacts.phones?.length ? { label: 'Telefones', values: contacts.phones } : null,
    contacts.whatsappLinks?.length ? { label: 'WhatsApp', values: contacts.whatsappLinks } : null,
    source.people?.length ? { label: 'Pessoas', values: source.people } : null,
    institutionals.cnpjs?.length ? { label: 'CNPJ', values: institutionals.cnpjs } : null,
    institutionals.addresses?.length ? { label: 'Endereco', values: institutionals.addresses } : null,
    source.socialLinks?.length ? { label: 'Redes', values: source.socialLinks } : null,
    structuredData.organizations?.length ? { label: 'Organizacao', values: structuredData.organizations } : null,
  ].filter(Boolean)
}

function normalizeVersionText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildPromptDiffSummary(currentValue, previousValue) {
  const current = normalizeVersionText(currentValue)
  const previous = normalizeVersionText(previousValue)

  if (!current && !previous) {
    return { changed: false, delta: 0, preview: 'sem alteracao de prompt' }
  }

  const delta = current.length - previous.length
  if (current === previous) {
    return { changed: false, delta, preview: 'sem alteracao de prompt' }
  }

  return {
    changed: true,
    delta,
    preview:
      delta === 0
        ? 'prompt reescrito'
        : delta > 0
          ? `prompt expandido (+${delta} chars)`
          : `prompt reduzido (${delta} chars)`,
  }
}

function buildRuntimeConfigDiffSummary(currentConfig, previousConfig) {
  const currentKeys = Object.keys(currentConfig && typeof currentConfig === 'object' ? currentConfig : {})
  const previousKeys = Object.keys(previousConfig && typeof previousConfig === 'object' ? previousConfig : {})
  const added = currentKeys.filter((key) => !previousKeys.includes(key))
  const removed = previousKeys.filter((key) => !currentKeys.includes(key))

  if (!added.length && !removed.length) {
    return 'runtime sem mudanca estrutural'
  }

  return [
    added.length ? `+ ${added.slice(0, 3).join(', ')}` : '',
    removed.length ? `- ${removed.slice(0, 3).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
}

function buildVersionChangeNote(version, compareVersion) {
  const items = []

  if (normalizeVersionText(version.nome) !== normalizeVersionText(compareVersion?.nome)) {
    items.push('nome alterado')
  }

  if (normalizeVersionText(version.descricao) !== normalizeVersionText(compareVersion?.descricao)) {
    items.push('descricao alterada')
  }

  const promptDiff = buildPromptDiffSummary(version.promptBase, compareVersion?.promptBase)
  if (promptDiff.changed) {
    items.push(promptDiff.preview)
  }

  const runtimeDiff = buildRuntimeConfigDiffSummary(version.runtimeConfig, compareVersion?.runtimeConfig)
  if (runtimeDiff !== 'runtime sem mudanca estrutural') {
    items.push(runtimeDiff)
  }

  if (normalizeVersionText(version.note)) {
    items.push(`nota: ${normalizeVersionText(version.note)}`)
  }

  return items.length ? items.join(' | ') : 'sem diferenca relevante visivel'
}

function buildIntegrationPanels(project) {
  return [
    {
      id: 'apis',
      label: 'APIs',
      shortLabel: 'APIs',
      icon: PlugZap,
      colorClassName: 'sky',
      serviceIconType: 'apis',
      directToAgent: true,
      mobilePosition: { x: 94, y: 314 },
      desktopPosition: { x: 96, y: 322 },
      cardAnchor: { x: 168, y: CARD_ESTIMATED_HEIGHT },
      routeY: 292,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'APIs',
      description: 'Endpoints cadastrados para o agente usar no pipeline.',
      statusLabel: `${project.integrations.apis} endpoints conectados`,
      isAvailable: (project.apis?.length || 0) > 0 || Number(project.integrations?.apis || 0) > 0,
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
      serviceIconType: 'whatsapp',
      directToAgent: true,
      mobilePosition: { x: 94, y: 392 },
      desktopPosition: { x: 96, y: 400 },
      cardAnchor: { x: 112, y: CARD_ESTIMATED_HEIGHT },
      routeY: 370,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'WhatsApp',
      description: 'Canais WhatsApp vinculados ao projeto.',
      statusLabel: `${project.integrations.whatsapp} numeros ativos`,
      isAvailable:
        (project.whatsappChannels?.length || 0) > 0 || Number(project.integrations?.whatsapp || 0) > 0,
      items: ['Webhook de entrada', 'Fila de atendimento', 'Handoff humano', 'Resposta automatizada'],
    },
    {
      id: 'mercado-livre',
      label: 'Mercado Livre',
      shortLabel: 'Mercado Livre',
      icon: Store,
      colorClassName: 'amber',
      serviceIconType: 'mercadoLivre',
      directToAgent: true,
      mobilePosition: { x: 94, y: 548 },
      desktopPosition: { x: 96, y: 556 },
      cardAnchor: { x: 194, y: CARD_ESTIMATED_HEIGHT },
      routeY: 526,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'Mercado Livre',
      description: 'Painel reservado para catalogo, pedidos e operacao de marketplace.',
      statusLabel: 'Integracao preparada',
      isAvailable: Number(project.directConnections?.mercadoLivre || 0) > 0,
      items: ['Catalogo', 'Pedidos', 'Reputacao', 'Perguntas'],
    },
    {
      id: 'chat-widget',
      label: 'Chat widget',
      shortLabel: 'Chat widget',
      icon: PackageSearch,
      colorClassName: 'sky',
      serviceIconType: 'chatWidget',
      directToAgent: true,
      mobilePosition: { x: 94, y: 470 },
      desktopPosition: { x: 96, y: 478 },
      cardAnchor: { x: 138, y: CARD_ESTIMATED_HEIGHT },
      routeY: 448,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'Chat widget',
      description: 'Widgets web conectados ao atendimento.',
      statusLabel: `${project.integrations.chatWidget} widgets online`,
      isAvailable:
        (project.chatWidgets?.length || 0) > 0 || Number(project.integrations?.chatWidget || 0) > 0,
      items: ['Fluxo inicial', 'Qualificacao de lead', 'Fallback humano', 'Eventos de conversao'],
    },
  ]
}

function buildTopMenuItems(panels) {
  return panels.map((panel) => ({
    id: panel.id,
    label: panel.shortLabel || panel.label,
    icon: panel.icon,
  }))
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
    top: 164,
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
  eyebrowIcon: EyebrowIcon = null,
  description,
  statusLabel,
  statusTone = 'emerald',
  enabled = true,
  leftAction = null,
  onCancel = null,
}) {
  const statusClasses =
    statusTone === 'sky'
      ? { text: 'text-sky-300', track: 'bg-sky-500/20', thumb: 'bg-sky-300' }
      : { text: 'text-emerald-300', track: 'bg-emerald-500/20', thumb: 'bg-emerald-300' }

  return (
    <div className="px-6 pt-8 pb-5 sm:py-5">
      <div className="relative flex flex-col gap-3 pr-14 sm:pr-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start justify-between gap-3 pr-8 sm:pr-0">
                <p className={cn('flex items-center gap-2 text-xs uppercase tracking-[0.22em]', statusTone === 'sky' ? 'text-sky-300' : 'text-slate-500')}>
                  {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5" /> : null}
                  {eyebrow}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
            </div>

            <p className="mt-2 hidden text-sm text-slate-400 sm:block">{description}</p>
          </div>
        </div>

        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="absolute right-0 top-0 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-0 text-slate-300 hover:bg-white/[0.06] hover:text-white sm:hidden"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function SheetPowerToggle({ enabled, disabled = false, onClick, compact = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group inline-flex items-center rounded-full border text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        compact ? 'h-6 gap-1 px-1.5 pr-1.5' : 'h-7 gap-1.5 px-2 pr-2.5',
        enabled
          ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
          : 'border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20',
      )}
      title={enabled ? 'Desativar' : 'Ativar'}
    >
        <span
          className={cn(
            compact ? 'flex h-3.5 w-6 items-center rounded-full p-0.5 transition-colors' : 'flex h-4 w-7 items-center rounded-full p-0.5 transition-colors',
            enabled ? 'bg-emerald-400/25' : 'bg-red-400/25',
          )}
        >
          <span
            className={cn(
              compact ? 'h-2.5 w-2.5 rounded-full transition-transform' : 'h-3 w-3 rounded-full transition-transform',
              enabled ? (compact ? 'translate-x-2.5 bg-emerald-300' : 'translate-x-3 bg-emerald-300') : 'translate-x-0 bg-red-300',
            )}
          />
        </span>
      {compact ? null : enabled ? 'Desativar' : 'Ativar'}
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
              data-item-id={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'infra-tab-motion inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold',
                active
                  ? 'border-sky-400/30 bg-sky-500/15 text-sky-100 shadow-[6px_6px_0_rgba(8,15,38,0.18)]'
                  : 'border-transparent bg-transparent text-slate-400 hover:bg-[#10192b] hover:text-slate-100',
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

function mergeIntegrationStats(current, next) {
  if (!next || typeof next !== 'object') {
    return current
  }

  let changed = false
  const merged = { ...current }

  for (const [key, value] of Object.entries(next)) {
    if (value == null || merged[key] === value) {
      continue
    }

    merged[key] = value
    changed = true
  }

  return changed ? merged : current
}

function ProjectPanel({
  project,
  initialAgentTab = 'edit',
  onAgentTabChange,
  onOpenConnection,
  onCloseSheet = null,
}) {
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
  const [restoreConfirmId, setRestoreConfirmId] = useState('')
  const [savingActive, setSavingActive] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [generatingSiteSummary, setGeneratingSiteSummary] = useState(false)
  const [siteSummaryData, setSiteSummaryData] = useState(null)
  const [agentName, setAgentName] = useState(initialAgentName)
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [promptValue, setPromptValue] = useState(() => plainTextToEditorHtml(initialPrompt))
  const [rollbackStatus, setRollbackStatus] = useState({ type: 'idle', message: '' })
  const [editorStatus, setEditorStatus] = useState({ type: 'idle', message: '' })
  const [siteSummaryStatus, setSiteSummaryStatus] = useState({ type: 'idle', message: '' })
  const [activeAgentTab, setActiveAgentTab] = useState(resolveAgentTab(initialAgentTab) || 'edit')
  const agentTabs = [
    { id: 'edit', label: 'Editar agente', icon: Wand2 },
    { id: 'connections', label: 'Conexoes', icon: PlugZap },
    { id: 'history', label: 'Historico', icon: History },
    { id: 'json', label: 'Ver JSON', icon: Files },
  ]
  const normalizedPrompt = useMemo(() => richTextToPlainText(promptValue), [promptValue])
  const hasUnsavedChanges =
    agentName.trim() !== initialAgentName.trim() ||
    normalizedPrompt !== initialPrompt.trim() ||
    siteUrl.trim() !== initialSiteUrl.trim() ||
    logoUrl.trim() !== initialLogoUrl.trim()
  const currentVersionSnapshot = useMemo(
    () => ({
      id: 'current',
      versionNumber: 'Atual',
      nome: agentName.trim() || initialAgentName,
      descricao: '',
      promptBase: normalizedPrompt,
      runtimeConfig: agent?.runtimeConfig ?? null,
      note: hasUnsavedChanges ? 'rascunho local' : 'estado atual salvo',
      source: hasUnsavedChanges ? 'draft' : 'current',
      createdAt: new Date().toISOString(),
      ativo: agentActive,
    }),
    [agent?.runtimeConfig, agentActive, agentName, hasUnsavedChanges, initialAgentName, normalizedPrompt],
  )

  useEffect(() => {
    setAgentName(initialAgentName)
    setSiteUrl(initialSiteUrl)
    setLogoUrl(initialLogoUrl)
    setPromptValue(plainTextToEditorHtml(initialPrompt))
    setEditorStatus({ type: 'idle', message: '' })
  }, [initialAgentName, initialLogoUrl, initialPrompt, initialSiteUrl])

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
      panel: 'apis',
      params: { api: api.id },
    })),
    ...(project.whatsappChannels || []).map((channel) => ({
      id: channel.id,
      type: 'channel',
      title: channel.number || 'Canal WhatsApp',
      description: channel.connectionStatus || channel.status || 'Canal cadastrado',
      icon: MessageSquare,
      panel: 'whatsapp',
      params: { channel: channel.id },
    })),
    ...(project.chatWidgets || []).map((widget) => ({
      id: widget.id,
      type: 'widget',
      title: widget.name || widget.nome || 'Chat widget',
      description: widget.slug || 'Widget cadastrado',
      icon: PackageSearch,
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
          businessContext: normalizedPrompt || project.description || project.name,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Nao foi possivel criar o agente.')
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

      setPromptValue((currentValue) => buildMergedAgentSummary(currentValue, data.summary, data.promptSuggestion))
      setSiteSummaryData(data)
      if (data?.source?.logoUrl) {
        setLogoUrl(data.source.logoUrl)
      }
      setSiteSummaryStatus({ type: 'success', message: 'Resumo, contatos e prompt sugerido somados ao editor.' })
    } catch (error) {
      setSiteSummaryData(null)
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
                Crie o agente inicial e o chat widget padrao automaticamente.
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

                {siteSummaryData ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-[#0a1020] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Leitura automatica
                        </div>
                        <div className="mt-1 text-sm text-slate-200">
                          {siteSummaryData.source?.title || siteUrl}
                        </div>
                      </div>
                      {siteSummaryData.usage?.estimatedCostUsd != null ? (
                        <div className="text-xs text-slate-500">
                          custo {Number(siteSummaryData.usage.estimatedCostUsd).toFixed(6)} USD
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {buildSiteSummaryHighlights(siteSummaryData).map((item) => (
                        <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {item.label}
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-300">
                            {item.values.slice(0, 3).map((value) => (
                              <div key={value} className="break-words">
                                {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {siteSummaryData.promptSuggestion ? (
                      <div className="mt-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                          Prompt sugerido
                        </div>
                        <div className="mt-2 text-xs leading-6 text-slate-300">
                          {siteSummaryData.promptSuggestion.slice(0, 420)}
                          {siteSummaryData.promptSuggestion.length > 420 ? '...' : ''}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Adiciona seus dados para o agente atender.
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
            <JsonCodeBlock value={{ projectId: project.id, agent }} />
          </div>
        ) : null}

        {activeAgentTab === 'connections' ? (
          <div className="grid gap-3 px-6 py-5 md:grid-cols-2">
            {connectionItems.length ? (
              connectionItems.map((item) => {
                const Icon = item.icon

                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => onOpenConnection?.(item.panel, item.params)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a1020] p-4 text-left transition-colors hover:border-sky-400/40 hover:bg-sky-500/10"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{item.description}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-sky-300" />
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
                                {isCurrent ? version.versionNumber : `v${version.versionNumber}`} - {version.nome}
                              </div>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                  isCurrent
                                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                    : "border-white/10 bg-white/[0.04] text-slate-300",
                                )}
                              >
                                {isCurrent ? "versao atual" : version.source === 'rollback' ? 'rollback' : 'salvamento'}
                              </span>
                              {!isCurrent && version.ativo === true ? (
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
                  Nenhuma versao salva ainda. O historico sera criado antes do proximo salvamento.
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
            disabled={activeAgentTab !== 'edit' || !agent?.id || savingDraft}
            onClick={handleSaveAgent}
            className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDraft ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCloseSheet}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
          >
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
        title="Restaurar versao do agente"
        description="O estado atual sera salvo no historico antes do rollback."
        confirmLabel="Restaurar versao"
        loading={Boolean(restoringId)}
        onConfirm={() => (restoreConfirmId ? handleRestoreVersion(restoreConfirmId) : null)}
      />
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

function ManagerFrame({ children }) {
  return (
    <div className="text-slate-300">
      {children}
    </div>
  )
}

function MercadoLivrePanel({ project, activeTab: controlledActiveTab, onTabChange, onFooterStateChange, compact = false }) {
  const activeCount = project.directConnections?.mercadoLivre ?? 0
  const [activeTab, setActiveTab] = useState('connection')
  const currentTab = controlledActiveTab || activeTab
  const [step, setStep] = useState(activeCount ? 2 : 1)
  const [productUrl, setProductUrl] = useState('')
  const [storeName, setStoreName] = useState('')
  const [appId, setAppId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [seedId, setSeedId] = useState('')
  const [loadingConnector, setLoadingConnector] = useState(false)
  const tabs = [
    { id: 'connection', label: 'Conexao', icon: Store },
    { id: 'tutorial', label: 'Tutorial', icon: Files },
  ]

  useEffect(() => {
    let active = true

    async function loadMercadoLivreConnector() {
      setLoadingConnector(true)

      try {
        const response = await fetch(`/api/app/projetos/${project.routeKey || project.slug || project.id}/conectores`)
        const data = await response.json().catch(() => ({}))

        if (!active || !response.ok) {
          return
        }

        const connector = (data.connectors || []).find((item) => {
          const haystack = `${item.slug || ''} ${item.type || ''} ${item.name || ''}`.toLowerCase()
          return haystack.includes('mercado') || haystack.includes('ml')
        })

        if (!connector) {
          return
        }

        const config = connector.config && typeof connector.config === 'object' ? connector.config : {}
        setStoreName((current) => current || connector.name || 'Loja Mercado Livre')
        setAppId((current) => current || String(config.appId || config.app_id || config.clientId || config.client_id || ''))
        setClientSecret((current) => current || String(config.clientSecret || config.client_secret || config.secret || ''))
        setSeedId((current) => current || String(config.seedId || config.seed_id || config.sellerId || config.seller_id || ''))
        setStep(2)
      } catch {}
      finally {
        if (active) {
          setLoadingConnector(false)
        }
      }
    }

    loadMercadoLivreConnector()

    return () => {
      active = false
    }
  }, [project.id, project.routeKey, project.slug])

  function handleResolveStore(event) {
    event.preventDefault()
    const sellerMatch = productUrl.match(/(?:seller_id|sellerId|official_store_id)=([^&]+)/i)
    const productMatch = productUrl.match(/MLB-?(\d+)/i)
    setSeedId(sellerMatch?.[1] || productMatch?.[1] || '')
    setStoreName((current) => current || 'Loja Mercado Livre')
    setStep(2)
  }

  useEffect(() => {
    onFooterStateChange?.({ step, activeTab: currentTab })
  }, [currentTab, onFooterStateChange, step])

  return (
    <div className="grid gap-4">
      <div className={cn("flex flex-wrap gap-2", compact && "hidden")}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = currentTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
                onTabChange?.(tab.id)
              }}
              className={cn(
                'infra-tab-motion inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium',
                active
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-[6px_6px_0_rgba(8,15,38,0.16)]'
                  : 'border-transparent bg-transparent text-slate-400 hover:bg-[#10192b] hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {currentTab === 'connection' ? (
        <div className="grid gap-4">
          {loadingConnector ? (
            <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              carregando conector
            </div>
          ) : null}
          {step === 1 ? (
            <form id="mercado-livre-resolve-form" className="grid gap-4" onSubmit={handleResolveStore}>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Produto cadastrado na loja
                </span>
                <input
                  value={productUrl}
                  onChange={(event) => setProductUrl(event.target.value)}
                  placeholder="Cole a URL de qualquer produto da loja"
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none transition focus:border-amber-300/40"
                />
              </label>
              {!compact ? <div className="flex justify-end">
                <Button type="submit" className="rounded-xl">
                  Avancar
                </Button>
              </div> : null}
            </form>
          ) : null}

          {step === 2 ? (
            <>
            <form id="mercado-livre-save-form" onSubmit={(event) => event.preventDefault()} />
            <div className="grid gap-4">
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200"
                >
                  Voltar e trocar link do produto
                </Button>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                {seedId ? `Identificador sugerido: ${seedId}` : 'Resolucao automatica indisponivel. Preencha manualmente.'}
              </div>
              <div className="grid gap-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nome da loja</span>
                  <input value={storeName} onChange={(event) => setStoreName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">App ID</span>
                  <input value={appId} onChange={(event) => setAppId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Client secret</span>
                  <input value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seed ID</span>
                  <input value={seedId} onChange={(event) => setSeedId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#080e1d] px-3 text-sm text-white outline-none" />
                </label>
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                <p className="font-semibold">Pegue os dados direto no Mercado Livre</p>
                <p className="mt-1 text-amber-50/80">
                  Abra o painel de apps para copiar o App ID e o Client Secret antes de salvar a loja.
                </p>
                <a
                  href="https://developers.mercadolivre.com.br/devcenter"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-9 items-center rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100 transition hover:bg-amber-400/20"
                >
                  Abrir painel do Mercado Livre
                </a>
              </div>
            </div>
            </>
          ) : null}
        </div>
      ) : null}

      {currentTab === 'tutorial' ? (
        <div className="grid gap-7 bg-transparent p-0 text-sm text-slate-300">
          <div className="grid gap-2">
            <p className="text-base font-semibold text-white">Tutorial rapido</p>
            <p className="text-slate-400">Como conectar o Mercado Livre</p>
            <p className="leading-6 text-slate-400">
              Aqui funciona em 2 etapas bem simples: primeiro voce cadastra a loja com os dados do aplicativo, depois conecta a conta do Mercado Livre para liberar o acesso.
            </p>
          </div>

          <div className="grid gap-3 bg-transparent p-0">
            <p className="text-sm font-semibold text-white">Painel de apps do Mercado Livre</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Etapa 1. Cadastrar a loja: crie um aplicativo do tipo <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">Web</code>, ative as opcoes pedidas pelo Mercado Livre e copie o <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">APP ID</code> e o <code className="rounded bg-white/5 px-1 py-0.5 text-sky-200">CLIENT SECRET</code> para este cadastro.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Etapa 2. Conectar a loja: depois de salvar, clique em conectar para autorizar a conta do Mercado Livre e finalizar a integracao.
            </p>
            <a
              href="https://developers.mercadolivre.com.br/devcenter"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
            >
              Abrir painel do Mercado Livre
            </a>
          </div>

          <div className="grid gap-4">
            <p className="text-sm font-semibold text-white">Links para configurar no Mercado Livre</p>
            <p className="text-sm leading-6 text-slate-400">
              Abra para copiar os links que o Mercado Livre vai pedir na configuracao.
            </p>
            <p className="text-sm leading-6 text-slate-400">
              Use os links abaixo exatamente como estao. Se o campo de notificacoes nao aceitar o endereco direto, use uma URL publica intermediaria.
            </p>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-2 bg-transparent p-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Link de retorno</p>
              <div className="mt-2 bg-transparent px-0 py-0 font-mono text-xs text-sky-200">
                https://infrastudio.pro/api/admin/conectores/mercado-livre/callback
              </div>
            </div>

            <div className="grid gap-2 bg-transparent p-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Link de notificacoes</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Em alguns casos, o Mercado Livre pode nao aceitar esse endereco direto nesse campo.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Se isso acontecer, use uma URL publica intermediaria e aponte essa URL para o endereco abaixo:
              </p>
              <div className="mt-2 bg-transparent px-0 py-0 font-mono text-xs text-sky-200">
                https://infrastudio.pro/api/mercado-livre/webhook?canal=ml
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function resolveProjectPlanSummary(project) {
  const projectPlanName = project.billing?.projectPlan?.planName?.trim?.() || ''
  const subscriptionPlanName = project.billing?.subscription?.plan?.name?.trim?.() || ''
  const rawPlanName = projectPlanName || subscriptionPlanName
  const normalizedPlanName = rawPlanName.toLowerCase()
  const hasValidPaidPlan =
    Boolean(project.billing?.projectPlan?.planId || project.billing?.subscription?.plan?.id) &&
    Boolean(normalizedPlanName) &&
    !['padrao', 'padrão', 'default'].includes(normalizedPlanName)

  return {
    planId: hasValidPaidPlan
      ? project.billing?.projectPlan?.planId || project.billing?.subscription?.plan?.id || null
      : 'free',
    planName: hasValidPaidPlan ? rawPlanName : 'Free',
    isFree:
      Boolean(project.billing?.subscription?.plan?.isFree) ||
      normalizedPlanName === 'free' ||
      !hasValidPaidPlan,
  }
}

function IntegrationPanel({ panel, sheetItems, project, deepLink, onCloseSheet = null, enabled = true, onIntegrationStatsChange = null }) {
  const [apiDetailOpen, setApiDetailOpen] = useState(Boolean(deepLink?.api))
  const [apiDeleteAvailable, setApiDeleteAvailable] = useState(false)
  const [apiResetSignal, setApiResetSignal] = useState(0)
  const [whatsappFooter, setWhatsappFooter] = useState({})
  const [widgetFooter, setWidgetFooter] = useState({})
  const [mercadoFooter, setMercadoFooter] = useState({})
  const [integrationStats, setIntegrationStats] = useState({})

  const handleStatsChange = useCallback((stats) => {
    setIntegrationStats((current) => mergeIntegrationStats(current, stats))
  }, [])

  useEffect(() => {
    if (Object.keys(integrationStats).length > 0) {
      onIntegrationStatsChange?.(integrationStats)
    }
  }, [integrationStats, onIntegrationStatsChange])
  const tabs = useMemo(() => {
    if (panel.id === 'apis') {
      return [
        { id: 'edit', label: 'Criar/Editar', icon: Wand2 },
        { id: 'tutorial', label: 'Tutorial', icon: Files },
        { id: 'json', label: 'JSON', icon: Files },
        { id: 'test', label: 'Testar', icon: MessageSquare },
      ]
    }

    if (panel.id === 'whatsapp') {
      return [
        { id: 'connect', label: 'Conectar', icon: MessageSquare },
        { id: 'attendants', label: 'Atendentes', icon: Users },
        { id: 'tutorial', label: 'Tutorial', icon: Files },
      ]
    }

    if (panel.id === 'chat-widget') {
      return [
        { id: 'edit', label: 'Editar', icon: Wand2 },
        { id: 'code', label: 'Ver codigo fonte', icon: Files },
        { id: 'docs', label: 'Documentacao', icon: MessageSquare },
      ]
    }

    if (panel.id === 'mercado-livre') {
      return [
        { id: 'connection', label: 'Conexao', icon: Store },
        { id: 'tutorial', label: 'Tutorial', icon: Files },
      ]
    }

    return buildIntegrationTabs(panel.id)
  }, [panel.id])
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'overview')
  useEffect(() => {
    setActiveTab(tabs[0]?.id || 'overview')
  }, [panel.id, tabs])

  const realPanel =
    panel.id === 'apis' && activeTab !== 'tutorial' ? (
      <ManagerFrame>
        <ApiManager
          project={project}
          initialApiId={deepLink?.api || null}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onDetailOpenChange={setApiDetailOpen}
          onDeleteAvailableChange={setApiDeleteAvailable}
          onStatsChange={handleStatsChange}
          resetSignal={apiResetSignal}
          compact
        />
      </ManagerFrame>
    ) : panel.id === 'whatsapp' ? (
      <ManagerFrame>
        <WhatsAppManager project={project} initialChannelId={deepLink?.channel || null} activeTab={activeTab} onTabChange={setActiveTab} onFooterStateChange={setWhatsappFooter} onStatsChange={handleStatsChange} compact />
      </ManagerFrame>
    ) : panel.id === 'chat-widget' ? (
      <ManagerFrame>
        <WidgetManager project={project} initialWidgetId={deepLink?.widget || null} activeTab={activeTab} onTabChange={setActiveTab} onFooterStateChange={setWidgetFooter} onStatsChange={handleStatsChange} compact />
      </ManagerFrame>
    ) : panel.id === 'mercado-livre' ? (
      <MercadoLivrePanel project={project} activeTab={activeTab} onTabChange={setActiveTab} onFooterStateChange={setMercadoFooter} compact />
    ) : null

  return (
    <>
      <SheetPanelHeader
        eyebrow={panel.title || panel.label}
        eyebrowIcon={panel.icon}
        description={panel.description}
        statusTone="sky"
        onCancel={onCloseSheet}
      />
      {panel.id === 'apis' && !apiDetailOpen ? null : (
        <SheetInternalTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${panel.id}:${activeTab}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
        {realPanel ? (
          realPanel
        ) : panel.id === 'apis' && activeTab === 'tutorial' ? (
        <PlaceholderPanel
          title="Tutorial para API autenticada"
          description="O projeto ja esta preparado para APIs autenticadas via JSON de configuracao. Use `configuracoes.http.headers` para enviar `Authorization`, `x-api-key` ou qualquer header fixo."
          items={[
            'Use URL GET valida e retorne JSON.',
            'No JSON, configure http.headers com Bearer ou x-api-key.',
            'Use runtime.responsePath para apontar o bloco correto da resposta.',
            'Defina runtime.previewPath para o resumo rapido exibido no teste.',
            'Mapeie runtime.fields.path para extrair valores especificos do payload.',
            'Teste a API antes de vincular ao agente.',
          ]}
        />
        ) : (
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
        )}
          </motion.div>
        </AnimatePresence>
      </div>
      {panel.id === 'apis' && apiDetailOpen ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                onClick={() => setApiResetSignal((value) => value + 1)}
              >
                Voltar para lista
              </Button>
            </div>
            <div className="flex items-center gap-3">
            {apiDeleteAvailable ? (
              <Button
                type="submit"
                form="api-delete-form"
                variant="ghost"
                className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm text-red-200"
              >
                Deletar API
              </Button>
            ) : null}
            {activeTab === 'edit' ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-300"
                  onClick={onCloseSheet}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="api-editor-form"
                  variant="ghost"
                  className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
                >
                  Salvar API
                </Button>
              </>
            ) : null}
            {activeTab === 'json' ? (
              <Button
                type="submit"
                form="api-editor-form"
                variant="ghost"
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
              >
                Salvar JSON
              </Button>
            ) : null}
            {activeTab === 'test' ? (
              <Button
                type="submit"
                form="api-test-form"
                variant="ghost"
                className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
              >
                Testar
              </Button>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {panel.id === 'whatsapp' && whatsappFooter.canSaveContact ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex justify-end">
            {activeTab === 'attendants' ? (
              <Button type="submit" form="whatsapp-contact-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Salvar atendente
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {panel.id === 'chat-widget' && (widgetFooter.canSave || widgetFooter.canCopy) ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex justify-end">
            {activeTab === 'edit' ? (
              <Button type="submit" form="widget-editor-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Salvar widget
              </Button>
            ) : null}
            {activeTab === 'code' ? (
              <Button type="submit" form="widget-copy-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Copiar codigo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {panel.id === 'mercado-livre' && activeTab === 'connection' ? (
        <div className="border-t border-white/5 px-6 py-4">
          <div className="flex justify-end">
            {mercadoFooter.step === 1 ? (
              <Button type="submit" form="mercado-livre-resolve-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Avancar
              </Button>
            ) : null}
            {mercadoFooter.step === 2 ? (
              <Button type="submit" form="mercado-livre-save-form" variant="ghost" className="h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100">
                Salvar conexao
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

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
    const monthlyLimit =
      project.billing?.currentCycle?.limits?.totalTokens ??
      project.billing?.projectPlan?.limits?.totalTokens ??
      null
    const usedTokens = Number(project.billing?.currentCycle?.usage?.totalTokens ?? 0)
    const remainingTokens = monthlyLimit == null ? null : Math.max(0, Number(monthlyLimit) - usedTokens)
    const usagePercent = Number(project.billing?.currentCycle?.usagePercent?.totalTokens ?? 0)

    window.dispatchEvent(
      new CustomEvent('admin-project-usage-summary', {
        detail: {
          projectId: project.id,
          projectName: project.name,
          planId: planSummary.planId,
          planName: planSummary.planName,
          isFree: planSummary.isFree,
          subscriptionStatus: project.billing?.subscription?.status || '',
          billingBlocked: Boolean(project.billing?.status?.blocked || project.billing?.projectPlan?.blocked),
          blockedReason: project.billing?.projectPlan?.blockedReason || '',
          usedTokens,
          monthlyLimit,
          topUpAvailableTokens: Number(project.billing?.topUps?.availableTokens ?? 0),
          remainingLabel: remainingTokens == null ? 'Sem limite' : formatCredits(remainingTokens),
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

      if (nextTab) {
        setAgentTabFromUrl(nextTab)
        setActivePanel(DEFAULT_PANEL)
        setIsPanelOpen(true)
        return
      }

      if (panel && [DEFAULT_PANEL, ...integrationPanels.map((item) => item.id)].includes(panel)) {
        setDeepLink({
          api: params.get('api') || null,
          channel: params.get('channel') || null,
          widget: params.get('widget') || null,
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

              return (
                <button
                  key={item.id}
                  data-item-id={item.id}
                  type="button"
                  onClick={() => handleOpenPanel(item.id)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-sky-500/15 text-sky-200'
                      : 'bg-transparent text-slate-400 hover:bg-[#10192b] hover:text-white',
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

      <AgentSimulator project={project} agent={project.agent} open={testOpen} onOpenChange={setTestOpen} />

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
