'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import { GitBranch, LoaderCircle, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'

function ProjectServiceIcon({ type }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-slate-900">
      {type === 'workflow' ? (
        <Workflow className="h-6 w-6 text-blue-400" />
      ) : (
        <GitBranch className="h-6 w-6 text-white" />
      )}
    </div>
  )
}

export function ProjectCard({
  card,
  index = 0,
  onSelect,
  onDragStateChange,
  active = false,
  interactive = true,
  loading = false,
  draggableHeader = false,
  resetDragSignal = 0,
  children,
}) {
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
    if (!interactive) {
      return
    }

    if (loading) {
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

    onSelect(card.slug)
  }

  return (
    <motion.div
      data-project-card-root
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
          : 'shadow-none hover:shadow-[0_12px_20px_rgba(0,0,0,0.58)]',
        draggableHeader
          ? 'cursor-grab active:cursor-grabbing'
          : interactive
            ? 'cursor-pointer'
            : null,
        loading && 'pointer-events-none',
      )}
      onClick={handleCardClick}
      onPointerDown={draggableHeader ? (event) => dragControls.start(event) : undefined}
    >
      {children}

      <div
        className={cn(
          'relative z-30 flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0b1120] transition-[background-color,box-shadow,border-color] duration-200 group-hover:bg-[#0f172a]',
          active
            ? 'border-violet-400/35 shadow-[0_0_0_1px_rgba(168,85,247,0.16),0_0_24px_rgba(168,85,247,0.18),0_0_56px_rgba(126,34,206,0.12)]'
            : 'shadow-none group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-200',
            active
              ? 'opacity-100 shadow-[0_0_32px_rgba(168,85,247,0.28),0_0_72px_rgba(126,34,206,0.18)]'
              : 'opacity-0 group-hover:opacity-100 group-hover:shadow-[0_0_24px_rgba(15,23,42,0.22)]',
          )}
        />
        <div className="border-b border-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-white">Agente: {card.name}</h3>
            {loading ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Abrindo
              </span>
            ) : null}
          </div>
        </div>

        <div
          className="flex h-32 items-center justify-center gap-4"
          style={{
            backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-cyan-300" />
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Carregando projeto
              </div>
            </div>
          ) : (
            card.icons.map((icon, iconIndex) => (
              <ProjectServiceIcon key={`${card.slug}-${icon}-${iconIndex}`} type={icon} />
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/5 p-4 text-[11px] font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', card.statusDotClassName)} />
            <span>{card.status}</span>
          </div>
          {card.details ? <div>{card.details}</div> : null}
        </div>
      </div>
    </motion.div>
  )
}
