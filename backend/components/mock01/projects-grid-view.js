'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ChevronDown, LayoutGrid, List } from 'lucide-react'
import { projectCards } from '@/components/mock01/data'
import { MockPageHeader } from '@/components/mock01/mock-page-header'
import { ProjectCard } from '@/components/mock01/project-card'
import { Button } from '@/components/ui/button'

export function ProjectsGridView() {
  const router = useRouter()
  const [loadingProjectSlug, setLoadingProjectSlug] = useState(null)

  function handleProjectSelect(projectSlug) {
    setLoadingProjectSlug(projectSlug)
    router.push(`/mock01/${projectSlug}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 56 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      <MockPageHeader
        title="Projects"
        description="Selecione um projeto para abrir a area operacional e navegar pelos mocks."
        actions={
          <Button className="h-8 rounded-lg bg-[#8b5cf6] px-3 text-xs font-medium text-white hover:bg-violet-600">
          <span className="text-lg">+</span>
          <span>New</span>
          </Button>
        }
      />

      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            <span>{projectCards.length} Projects</span>
          </div>
          <span className="text-slate-700">|</span>
          <button type="button" className="flex items-center gap-1 hover:text-slate-300">
            <span>Sort By: Recent Activity</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center rounded-lg border border-white/5 bg-slate-800/20 p-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border border-white/5 bg-white/10 text-white shadow-none hover:bg-white/10 hover:text-white"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 shadow-none hover:bg-transparent hover:text-white"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projectCards.map((card, index) => (
          <div key={card.slug} className="max-w-[360px]">
            <ProjectCard
              card={card}
              index={index}
              onSelect={handleProjectSelect}
              loading={loadingProjectSlug === card.slug}
            />
          </div>
        ))}
      </div>
    </motion.div>
  )
}
