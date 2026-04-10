'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown, LayoutGrid, List } from 'lucide-react'
import { projectCards } from '@/components/mock01/data'
import { ProjectCard } from '@/components/mock01/project-card'
import { Button } from '@/components/ui/button'

export function ProjectsGridView() {
  const router = useRouter()

  function handleProjectSelect(projectSlug) {
    router.push(`/mock01/${projectSlug}`)
  }

  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-white">Projects</h1>
        <Button className="rounded-lg bg-[#8b5cf6] px-5 py-2 font-medium text-white hover:bg-violet-600">
          <span className="text-lg">+</span>
          <span>New</span>
        </Button>
      </div>

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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {projectCards.map((card, index) => (
          <ProjectCard key={card.slug} card={card} index={index} onSelect={handleProjectSelect} />
        ))}
      </div>
    </>
  )
}
