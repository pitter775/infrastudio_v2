'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import { LoaderCircle, MessageSquare, MessageSquareText, PackageSearch, Pencil, PlugZap, Store } from 'lucide-react'
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
  const integrations = project.directConnections || project.integrations || {}

  if (
    (project.apis?.length || 0) > 0 ||
    Number(integrations.apis || 0) > 0
  ) {
    icons.push('apis')
  }

  if (Number(integrations.whatsapp || 0) > 0) {
    icons.push('whatsapp')
  }

  if (Number(integrations.chatWidget || 0) > 0) {
    icons.push('chatWidget')
  }

  if (Number(integrations.mercadoLivre || 0) > 0) {
    icons.push('mercadoLivre')
  }

  return icons.slice(0, 4)
}

function getStatusLabel(status) {
  return status === 'ativo' ? 'Ativo' : status || 'Sem status'
}

function getOwnerInitials(owner) {
  const name = owner?.name?.trim()

  if (!name) {
    return 'U'
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function AdminProjectCard({
  project,
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
  children,
}) {
  const icons = Array.isArray(serviceIcons) && serviceIcons.length ? serviceIcons : getProjectServiceIcons(project)
  const projectAvatarUrl = resolveEntityAvatar(project)
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
        isDragging
          ? 'shadow-[0_16px_24px_rgba(0,0,0,0.72)]'
          : 'hover:shadow-[0_12px_20px_rgba(0,0,0,0.58)]',
        draggableHeader ? 'cursor-grab active:cursor-grabbing' : interactive ? 'cursor-pointer' : null,
        loading && 'pointer-events-none',
      )}
      onClick={handleCardClick}
      onPointerDown={draggableHeader ? (event) => dragControls.start(event) : undefined}
    >
      {children}

      <div
        className={cn(
          'relative z-30 flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0b1120] transition-[background-color,box-shadow,border-color] duration-200 group-hover:bg-[#0f172a] group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
          active && 'border-emerald-400/35 shadow-[0_0_0_1px_rgba(52,211,153,0.16),0_0_24px_rgba(52,211,153,0.18)]',
        )}
      >
        <div className="border-b border-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <TinyAvatar src={projectAvatarUrl} fallback={project.name} />
              <h3 className="truncate font-medium text-white">{project.name}</h3>
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
          className="relative flex h-32 items-center justify-center gap-4"
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
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[9px] font-semibold uppercase text-slate-200"
                  style={
                    project.owner.avatarUrl
                      ? {
                          backgroundImage: `url(${project.owner.avatarUrl})`,
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                        }
                      : undefined
                  }
                >
                  {project.owner.avatarUrl ? null : getOwnerInitials(project.owner)}
                </span>
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
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
