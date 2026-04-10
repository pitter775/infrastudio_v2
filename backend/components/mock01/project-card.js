'use client'

import { useRef } from 'react'
import { motion, useDragControls } from 'framer-motion'
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
  interactive = true,
  draggableHeader = false,
}) {
  const dragControls = useDragControls()
  const isDraggingRef = useRef(false)
  const dragEndedAtRef = useRef(0)

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
      drag={draggableHeader}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.12}
      onDragStart={() => {
        isDraggingRef.current = true
      }}
      onDragEnd={() => {
        isDraggingRef.current = false
        dragEndedAtRef.current = Date.now()
      }}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#0f172a] transition-[box-shadow] duration-200 hover:shadow-[0_0_0_10px_rgba(59,130,246,0.08)]',
        interactive && 'cursor-pointer',
      )}
      onClick={handleCardClick}
    >
      <div
        className={cn(
          'border-b border-white/5 p-5',
          draggableHeader && 'cursor-grab active:cursor-grabbing',
        )}
        onPointerDown={draggableHeader ? (event) => dragControls.start(event) : undefined}
      >
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
    </motion.div>
  )
}
