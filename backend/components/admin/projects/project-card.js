'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import { LoaderCircle, MessageSquare, MessageSquareText, PackageSearch, Pencil, PlugZap, Store } from 'lucide-react'
import { formatCredits } from '@/lib/public-planos'
import { cn } from '@/lib/utils'

const integrationIconMap = {
  apis: {
    icon: PlugZap,
    className: 'text-sky-300',
    label: 'APIs',
  },
  whatsapp: {
    icon: MessageSquare,
    className: 'text-emerald-300',
    label: 'WhatsApp',
  },
  chatWidget: {
    icon: PackageSearch,
    className: 'text-sky-300',
    label: 'Chat widget',
  },
  mercadoLivre: {
    icon: Store,
    className: 'text-amber-300',
    label: 'Mercado Livre',
  },
}

function ProjectServiceIcon({ type }) {
  const config = integrationIconMap[type] || integrationIconMap.apis
  const Icon = config.icon

  return (
    <div className="flex min-w-[54px] flex-col items-center gap-1 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-slate-900">
        <Icon className={cn('h-5 w-5', config.className)} />
      </div>
      <span className="max-w-[60px] text-[9px] font-medium leading-3 text-slate-500">
        {config.label}
      </span>
    </div>
  )
}

function TinyAvatar({ src, fallback }) {
  if (!src) {
    return null
  }

  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800 align-middle"
      style={{
        backgroundImage: `url(${src})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
      aria-hidden="true"
    >
      {fallback ? <span className="sr-only">{fallback}</span> : null}
    </span>
  )
}

function UserAvatar({ owner }) {
  if (owner?.avatarUrl) {
    return <TinyAvatar src={owner.avatarUrl} fallback={owner.name} />
  }

  const initials = String(owner?.name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-[9px] font-semibold uppercase text-slate-200">
      {initials}
    </span>
  )
}

function resolveEntityAvatar(project) {
  const explicitLogo = project.logoUrl || project.agent?.logoUrl || ''
  if (explicitLogo) {
    return explicitLogo
  }

  const siteUrl = project.siteUrl || project.agent?.siteUrl || ''
  if (!siteUrl) {
    return ''
  }

  try {
    return new URL('/favicon.ico', siteUrl).toString()
  } catch {
    return ''
  }
}

function getProjectServiceIcons(project) {
  const icons = []
  const directConnections =
    project.directConnections && typeof project.directConnections === 'object' ? project.directConnections : {}
  const integrations =
    project.integrations && typeof project.integrations === 'object' ? project.integrations : {}
  const apiCount = Number(
    directConnections.apis ??
      directConnections.api ??
      integrations.apis ??
      integrations.api ??
      project.apis?.length ??
      0,
  )
  const whatsappCount = Number(
    directConnections.whatsapp ??
      integrations.whatsapp ??
      project.whatsappChannels?.length ??
      0,
  )
  const chatWidgetCount = Number(
    directConnections.chatWidget ??
      directConnections.chat_widget ??
      integrations.chatWidget ??
      integrations.chat_widget ??
      project.chatWidgets?.length ??
      0,
  )
  const mercadoLivreCount = Number(
    directConnections.mercadoLivre ??
      directConnections.mercado_livre ??
      integrations.mercadoLivre ??
      integrations.mercado_livre ??
      0,
  )

  if (apiCount > 0) {
    icons.push('apis')
  }

  if (whatsappCount > 0) {
    icons.push('whatsapp')
  }

  if (chatWidgetCount > 0) {
    icons.push('chatWidget')
  }

  if (mercadoLivreCount > 0) {
    icons.push('mercadoLivre')
  }

  return icons.slice(0, 4)
}

function getStatusLabel(status) {
  return status === 'ativo' ? 'Ativo' : status || 'Sem status'
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
    planId: hasValidPaidPlan ? project.billing?.projectPlan?.planId || project.billing?.subscription?.plan?.id || null : null,
    planName: hasValidPaidPlan ? rawPlanName : 'Free',
    isFree:
      Boolean(project.billing?.subscription?.plan?.isFree) ||
      normalizedPlanName === 'free' ||
      !hasValidPaidPlan,
  }
}

function formatPlanBadgeLabel(planName) {
  const normalizedPlanName = String(planName || 'Free').trim() || 'Free'
  return `PLANO ${normalizedPlanName}`.toUpperCase()
}

function buildProjectUsageSummary(project) {
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
  const usagePercentRaw = shouldUseProvidedPercent
    ? providedUsagePercent
    : monthlyLimit == null
      ? 0
      : (usedTokens / Math.max(Number(monthlyLimit), 1)) * 100
  const hardLimitReached = (monthlyLimit != null && usedTokens >= Number(monthlyLimit)) || usagePercentRaw >= 100
  const billingBlocked = Boolean(project.billing?.status?.blocked || project.billing?.projectPlan?.blocked || hardLimitReached)
  const usagePercent = Math.max(0, Math.min(100, Number.isFinite(usagePercentRaw) ? usagePercentRaw : 0))

  return {
    projectId: project.id,
    projectName: project.name,
    planId: planSummary.planId,
    planName: planSummary.planName,
    planBadgeLabel: formatPlanBadgeLabel(planSummary.planName),
    isFree: planSummary.isFree,
    subscriptionStatus: project.billing?.subscription?.status || '',
    pendingCheckout: project.billing?.pendingCheckout || null,
    billingBlocked,
    blockedReason: project.billing?.projectPlan?.blockedReason || '',
    usedTokens,
    monthlyLimit,
    usagePercent,
    topUpAvailableTokens,
    remainingLabel: monthlyLimit == null ? 'Sem limite' : formatCredits(remainingTokens),
    limitLabel: monthlyLimit == null ? 'Sem limite' : formatCredits(monthlyLimit),
    remainingPercentLabel: monthlyLimit == null ? null : `${Math.max(0, Math.round(100 - usagePercent))}%`,
    cycleEndDate: project.billing?.currentCycle?.endDate ?? null,
  }
}

function openBillingSummary(summary) {
  if (typeof window === 'undefined' || !summary) {
    return
  }

  window.dispatchEvent(
    new CustomEvent('admin-project-usage-summary', {
      detail: summary,
    }),
  )
  window.dispatchEvent(
    new CustomEvent('admin-billing-modal-toggle', {
      detail: { open: true },
    }),
  )
}

function getUsageTone(usagePercent, billingBlocked) {
  if (billingBlocked || usagePercent >= 80) {
    return {
      fill: 'bg-rose-500',
      glow: 'bg-rose-400/90',
      badge: 'bg-rose-500/12 text-rose-100',
    }
  }

  if (usagePercent > 50) {
    return {
      fill: 'bg-amber-400',
      glow: 'bg-amber-300/90',
      badge: 'bg-amber-400/12 text-amber-100',
    }
  }

  return {
    fill: 'bg-lime-400',
    glow: 'bg-lime-300/90',
    badge: 'bg-emerald-400/12 text-emerald-100',
  }
}

function ProjectUsageBar({ summary, onClick, variant = 'inside' }) {
  if (!summary) {
    return null
  }

  const hasLimit = summary.monthlyLimit != null
  const usagePercent = hasLimit ? summary.usagePercent : 0
  const markerLeft = `${Math.max(0, Math.min(100, usagePercent))}%`
  const tone = getUsageTone(usagePercent, summary.billingBlocked)
  const hasExtraCredits = Number(summary.topUpAvailableTokens ?? 0) > 0
  const usageLabelSafe = hasLimit
    ? `${summary.planName || 'Plano'}${hasExtraCredits ? ` + ${formatCredits(summary.topUpAvailableTokens)} extra` : ''} | ${Math.round(usagePercent)}%`
    : `${summary.planName || 'Plano'} | Sem limite`
  const planName = summary.planName || 'Plano'
  const usageLabel = hasLimit
    ? `${planName} · ${Math.round(usagePercent)}%`
    : `${planName} · Sem limite`
  const labelAnchorsRight = hasLimit && usagePercent > 50
  const trackClassName =
    variant === 'satellite'
      ? 'bg-white/28 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]'
      : 'bg-white/12'
  const wrapperClassName = variant === 'satellite' ? 'relative px-1 pb-1 pt-4' : 'relative pb-1 pt-4'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full rounded-xl px-1 pt-1 text-left"
      title="Abrir Meu Plano"
    >
      <div className={wrapperClassName}>
        <div className={cn('h-px overflow-hidden rounded-full', trackClassName)}>
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', tone.fill)}
            style={{ width: hasLimit ? `${usagePercent}%` : '100%' }}
          />
        </div>

        {hasLimit ? (
          <>
            <div
              className="pointer-events-none absolute top-4 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 shadow-[0_0_0_2px_rgba(8,17,32,0.85)]"
              style={{ left: markerLeft }}
            >
              <div className={cn('h-full w-full rounded-full', tone.glow)} />
            </div>
            <div
              className={cn(
                'pointer-events-none absolute top-0',
                labelAnchorsRight ? 'right-0 text-right' : 'left-0 text-left',
              )}
              style={labelAnchorsRight ? { right: `calc(100% - ${markerLeft})` } : { left: markerLeft }}
            >
              <div className={cn('whitespace-nowrap px-2 py-0.5 text-[9px] font-semibold tracking-[0.04em] shadow-[0_6px_20px_rgba(2,6,23,0.28)]', tone.badge)}>
                {usageLabelSafe}
              </div>
            </div>
          </>
        ) : (
          <div className="pointer-events-none absolute left-0 top-0">
            <div className={cn('whitespace-nowrap px-2 py-0.5 text-[9px] font-semibold tracking-[0.04em]', tone.badge)}>
              {usageLabelSafe}
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

function ProjectPlanPill({ summary, className = '' }) {
  if (!summary) {
    return null
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        openBillingSummary(summary)
      }}
      className={cn(
        'ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
        summary.billingBlocked
          ? 'border-rose-400/20 bg-rose-500/10 text-rose-100 hover:border-rose-300/35 hover:bg-rose-500/16'
          : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-500/16',
        className,
      )}
      title="Abrir Meu Plano"
    >
      {summary.planBadgeLabel || formatPlanBadgeLabel(summary.planName)}
    </button>
  )
}

function ProjectExtraCreditsPill({ summary }) {
  const extraCredits = Number(summary?.topUpAvailableTokens ?? 0)

  if (!extraCredits) {
    return null
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        openBillingSummary(summary)
      }}
      className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-300/35 hover:bg-cyan-500/16"
      title="Abrir Meu Plano"
    >
      +{formatCredits(extraCredits)}
    </button>
  )
}

export function AdminProjectCard({
  project,
  titleOverride,
  serviceIcons,
  index = 0,
  onSelect,
  onEdit,
  onTestAgent,
  loading = false,
  active = false,
  interactive = true,
  draggableHeader = false,
  resetDragSignal = 0,
  onDragStateChange,
  statusControl,
  highlighted = false,
  usageBarPlacement = 'satellite',
  primaryActionLabel = 'Entrar',
  children,
}) {
  const icons = Array.isArray(serviceIcons) && serviceIcons.length ? serviceIcons : getProjectServiceIcons(project)
  const projectAvatarUrl = resolveEntityAvatar(project)
  const cardTitle = titleOverride?.trim() || project.name
  const usageSummary = buildProjectUsageSummary(project)
  const billingBlocked = usageSummary.billingBlocked
  const dragControls = useDragControls()
  const isDraggingRef = useRef(false)
  const dragEndedAtRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  useEffect(() => {
    const controlsX = animate(x, 0, { duration: 0.24, ease: 'easeInOut' })
    const controlsY = animate(y, 0, { duration: 0.24, ease: 'easeInOut' })

    return () => {
      controlsX.stop()
      controlsY.stop()
    }
  }, [resetDragSignal, x, y])

  function handleCardClick(event) {
    if (!interactive || loading) {
      event.preventDefault()
      return
    }

    if (isDraggingRef.current) {
      event.preventDefault()
      return
    }

    if (dragEndedAtRef.current && Date.now() - dragEndedAtRef.current < 250) {
      event.preventDefault()
      return
    }

    onSelect?.(project)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      style={{ x, y }}
      drag={draggableHeader}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.12}
      onDragStart={() => {
        isDraggingRef.current = true
        setIsDragging(true)
        onDragStateChange?.(true)
      }}
      onDragEnd={() => {
        isDraggingRef.current = false
        setIsDragging(false)
        onDragStateChange?.(false)
        dragEndedAtRef.current = Date.now()
      }}
      className={cn(
        'group relative flex flex-col overflow-visible transition-[box-shadow] duration-200',
        usageBarPlacement === 'satellite' && 'pt-7',
        isDragging
          ? 'shadow-[0_16px_24px_rgba(0,0,0,0.72)]'
          : 'hover:shadow-[0_12px_20px_rgba(0,0,0,0.58)]',
        draggableHeader ? 'cursor-grab active:cursor-grabbing' : interactive ? 'cursor-pointer' : null,
        loading && 'pointer-events-none',
      )}
      onClick={handleCardClick}
      onPointerDown={draggableHeader ? (event) => dragControls.start(event) : undefined}
    >
      {usageBarPlacement === 'satellite' ? (
        <div className="absolute inset-x-4 top-0 z-40">
          <ProjectUsageBar
            summary={usageSummary}
            variant="satellite"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              openBillingSummary(usageSummary)
            }}
          />
        </div>
      ) : null}

      {children}

      <div
        className={cn(
          'relative z-30 flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0b1120] transition-[background-color,box-shadow,border-color] duration-200 group-hover:bg-[#0f172a] group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
          billingBlocked && 'border-rose-500/50 shadow-[0_0_0_1px_rgba(244,63,94,0.16),0_0_22px_rgba(244,63,94,0.12)]',
          highlighted && 'border-cyan-300/45 shadow-[0_0_0_1px_rgba(103,232,249,0.18),0_0_28px_rgba(34,211,238,0.14)]',
          active && 'border-emerald-400/35 shadow-[0_0_0_1px_rgba(52,211,153,0.16),0_0_24px_rgba(52,211,153,0.18)]',
        )}
      >
        {usageBarPlacement !== 'satellite' ? (
          <div className="px-3 pt-2 pb-1">
            <ProjectUsageBar
              summary={usageSummary}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                openBillingSummary(usageSummary)
              }}
            />
          </div>
        ) : null}
        <div className="border-b border-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <TinyAvatar src={projectAvatarUrl} fallback={cardTitle} />
              <h3 className="truncate font-medium text-white">{cardTitle}</h3>
            </div>
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Abrindo
              </span>
            ) : project.isDemo ? (
              <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Demo
              </span>
            ) : null}
          </div>
          <p className="mt-2 truncate text-xs leading-4 text-slate-500">
            {project.description}
          </p>
        </div>

        <div
          className="relative flex h-32 items-center justify-center gap-4 pt-8"
          style={{
            backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          {project.owner ? (
            <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[150px] items-center gap-1.5 rounded-full border border-white/5 bg-[#0b1120]/85 px-2 py-1 text-[10px] font-medium text-slate-400 backdrop-blur">
              {projectAvatarUrl ? (
                <TinyAvatar src={projectAvatarUrl} fallback={project.name} />
              ) : (
                <UserAvatar owner={project.owner} />
              )}
              <span className="truncate">{project.owner.name}</span>
            </div>
          ) : null}
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-cyan-300" />
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Carregando projeto
              </div>
            </div>
          ) : (
            icons.map((icon, iconIndex) => (
              <ProjectServiceIcon key={`${project.id}-${icon}-${iconIndex}`} type={icon} />
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 p-4 text-[11px] font-medium text-slate-500">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                project.status === 'ativo' ? 'bg-emerald-400' : 'bg-slate-500',
              )}
            />
              <span className="truncate">{getStatusLabel(project.status)}</span>
              <ProjectPlanPill summary={usageSummary} />
              <ProjectExtraCreditsPill summary={usageSummary} />
              {statusControl ? <span className="ml-1 shrink-0">{statusControl}</span> : null}
            </div>
          <div className="flex shrink-0 items-center gap-2">
            {interactive ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()

                  if (!loading) {
                    onSelect?.(project)
                  }
                }}
                className="inline-flex h-8 items-center rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 text-[11px] font-semibold text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-500/20"
                title={primaryActionLabel}
              >
                {primaryActionLabel}
              </button>
            ) : null}
            {onTestAgent ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onTestAgent(project)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 text-[11px] font-semibold text-sky-100 transition-colors hover:border-sky-300/45 hover:bg-sky-500/20"
                title="Testar agente"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Testar
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onEdit(project)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-amber-400/25 hover:bg-amber-500/10 hover:text-amber-100"
                title="Editar projeto"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  )
}
