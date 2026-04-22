import { MessageCircle, PackageSearch, PlugZap, Store } from 'lucide-react'

export const MOBILE_BREAKPOINT = 768
export const DESKTOP_BREAKPOINT = 1280
export const COLLAPSED_SIDEBAR_WIDTH = 80
export const EXPANDED_SIDEBAR_WIDTH = 192
export const CONTENT_SIDE_PADDING = 32
export const DOCK_GAP = 24
export const SHEET_RIGHT_OFFSET = 19
export const SHEET_TOP_OFFSET = 54
export const SHEET_BOTTOM_OFFSET = 18
export const CARD_CLOSED_SCALE = 0.88
export const DEFAULT_PANEL = 'project'

const SHEET_MIN_WIDTH = 460
const SHEET_MAX_WIDTH = 1120
const CARD_ESTIMATED_HEIGHT = 228
const MOBILE_CARD_SCALE = 0.72
const SATELLITE_BUTTON_WIDTH = 152
const SATELLITE_BUTTON_HEIGHT = 64

export function buildIntegrationPanels(project) {
  return [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      shortLabel: 'WhatsApp',
      icon: MessageCircle,
      colorClassName: 'emerald',
      serviceIconType: 'whatsapp',
      directToAgent: true,
      mobilePosition: { x: 94, y: 314 },
      desktopPosition: { x: 96, y: 322 },
      cardAnchor: { x: 168, y: CARD_ESTIMATED_HEIGHT },
      routeY: 292,
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
      id: 'apis',
      label: 'APIs',
      shortLabel: 'APIs',
      icon: PlugZap,
      colorClassName: 'sky',
      serviceIconType: 'apis',
      directToAgent: true,
      mobilePosition: { x: 94, y: 392 },
      desktopPosition: { x: 96, y: 400 },
      cardAnchor: { x: 112, y: CARD_ESTIMATED_HEIGHT },
      routeY: 370,
      buttonAnchor: { x: SATELLITE_BUTTON_WIDTH / 2, y: 0 },
      title: 'APIs',
      description: '',
      statusLabel: `${project.integrations.apis} endpoints conectados`,
      isAvailable: (project.apis?.length || 0) > 0 || Number(project.integrations?.apis || 0) > 0,
      items:
        project.apis.length > 0
          ? project.apis.map((api) => `${api.method} ${api.name}`)
          : ['Nenhuma API cadastrada neste projeto.'],
    },
    {
      id: 'chat-widget',
      label: 'Chat widget',
      shortLabel: 'Chat widget',
      icon: PackageSearch,
      colorClassName: 'violet',
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

export function buildTopMenuItems(panels) {
  return panels.map((panel) => ({
    id: panel.id,
    label: panel.shortLabel || panel.label,
    icon: panel.icon,
    colorClassName: panel.colorClassName,
  }))
}

export function getPanelAccentClasses(colorClassName) {
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
      return {
        connector: 'border-fuchsia-400/80',
        button: 'border-fuchsia-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(217,70,239,0.24),0_0_44px_rgba(162,28,175,0.16)]',
        icon: 'text-fuchsia-300',
      }
    default:
      return {
        connector: 'border-sky-400/80',
        button: 'border-sky-400/50 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(56,189,248,0.24),0_0_44px_rgba(2,132,199,0.16)]',
        icon: 'text-sky-300',
      }
  }
}

export function getToneClasses(colorClassName) {
  switch (colorClassName) {
    case 'emerald':
      return {
        text: 'text-[#6dff8b]',
        mutedText: 'text-[#6dff8b]',
        pill: 'border-[#3f8f2c]/35 bg-[#2d5a12]/32',
        pillActive: 'border-[#6dff8b]/45 bg-[#214f14]/58 text-[#b7ffc4]',
        hover: 'hover:border-[#6dff8b]/28 hover:bg-[#214f14]/28 hover:text-[#a6ffb6]',
        track: 'bg-emerald-500/20',
        thumb: 'bg-emerald-300',
      }
    case 'amber':
      return {
        text: 'text-[#ffd84d]',
        mutedText: 'text-[#ffd84d]',
        pill: 'border-[#8a7812]/35 bg-[#4b4307]/32',
        pillActive: 'border-[#ffd84d]/45 bg-[#534900]/58 text-[#fff0a3]',
        hover: 'hover:border-[#ffd84d]/28 hover:bg-[#534900]/28 hover:text-[#ffe88a]',
        track: 'bg-amber-500/20',
        thumb: 'bg-amber-300',
      }
    case 'violet':
      return {
        text: 'text-[#d86bff]',
        mutedText: 'text-[#d86bff]',
        pill: 'border-[#7f2fa7]/35 bg-[#401056]/32',
        pillActive: 'border-[#d86bff]/45 bg-[#4b1166]/58 text-[#efb4ff]',
        hover: 'hover:border-[#d86bff]/28 hover:bg-[#4b1166]/28 hover:text-[#e79cff]',
        track: 'bg-fuchsia-500/20',
        thumb: 'bg-fuchsia-300',
      }
    case 'sky':
    default:
      return {
        text: 'text-[#5fe7ff]',
        mutedText: 'text-[#5fe7ff]',
        pill: 'border-[#0e8ca8]/35 bg-[#073544]/32',
        pillActive: 'border-[#5fe7ff]/45 bg-[#0c4150]/58 text-[#baf8ff]',
        hover: 'hover:border-[#5fe7ff]/28 hover:bg-[#0c4150]/28 hover:text-[#9ef2ff]',
        track: 'bg-sky-500/20',
        thumb: 'bg-sky-300',
      }
  }
}

export function getSatelliteLayout(panel, isMobile) {
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

export function getSheetWidth(viewportWidth) {
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

export function getCardWidth(viewportWidth) {
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

export function getClosedCardLayout(viewportWidth, viewportHeight, cardWidth) {
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

export function getMobileCardLayout(viewportWidth, cardWidth) {
  return {
    left: Math.max((viewportWidth - cardWidth) / 2, 0),
    top: 164,
    scale: MOBILE_CARD_SCALE,
  }
}

export function getDockedCardLayout({ viewportWidth, viewportHeight }) {
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
