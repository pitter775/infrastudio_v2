'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useDragControls, useMotionValue } from 'framer-motion'
import { GitBranch, Workflow } from 'lucide-react'
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
        'relative flex flex-col overflow-visible transition-[box-shadow] duration-200 hover:shadow-[0_12px_20px_rgba(0,0,0,0.58)]',
        isDragging
          ? 'shadow-[0_16px_24px_rgba(0,0,0,0.72)]'
          : 'shadow-[0_10px_18px_rgba(0,0,0,0.52)]',
        draggableHeader
          ? 'cursor-grab active:cursor-grabbing'
          : interactive
            ? 'cursor-pointer'
            : null,
      )}
      onClick={handleCardClick}
      onPointerDown={draggableHeader ? (event) => dragControls.start(event) : undefined}
    >
      {children}

      <div
        className={cn(
          'relative z-30 flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0f172a] transition-[box-shadow,border-color] duration-200',
          active
            ? 'border-violet-400/35 shadow-[0_0_0_1px_rgba(168,85,247,0.16),0_0_24px_rgba(168,85,247,0.18),0_0_56px_rgba(126,34,206,0.12)]'
            : null,
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-200',
            active
              ? 'opacity-100 shadow-[0_0_32px_rgba(168,85,247,0.28),0_0_72px_rgba(126,34,206,0.18)]'
              : 'opacity-0',
          )}
        />
        <div className="border-b border-white/5 p-5">
          <h3 className="font-medium text-white">Agente: {card.name}</h3>
        </div>

        <div
          className="flex h-32 items-center justify-center gap-4"
          style={{
            backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          {card.icons.map((icon, iconIndex) => (
            <ProjectServiceIcon key={`${card.slug}-${icon}-${iconIndex}`} type={icon} />
          ))}
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
