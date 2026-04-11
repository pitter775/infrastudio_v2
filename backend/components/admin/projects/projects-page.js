'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ChevronDown, LayoutGrid, List } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/page-header'
import { AdminProjectCard } from '@/components/admin/projects/project-card'
import { Button } from '@/components/ui/button'

export function AdminProjectsPage({ projects, user }) {
  const router = useRouter()
  const [loadingProjectSlug, setLoadingProjectSlug] = useState(null)

  function handleProjectSelect(project) {
    setLoadingProjectSlug(project.slug)
    router.push(`/admin/projetos/${project.slug}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 56 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      <AdminPageHeader
        title="Projects"
        description={
          user?.role === 'admin'
            ? 'Perfil admin: acesso completo a todos os projetos cadastrados.'
            : 'Projetos vinculados ao seu usuario.'
        }
        actions={
          <Button className="h-8 rounded-lg bg-[#8b5cf6] px-3 text-xs font-medium text-white hover:bg-violet-600">
            <span className="text-lg">+</span>
            <span>New</span>
          </Button>
        }
      />

      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            <span>{projects.length} Projects</span>
          </div>
          <span className="hidden text-slate-700 sm:inline">|</span>
          <button type="button" className="hidden items-center gap-1 hover:text-slate-300 sm:flex">
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

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <div key={project.id} className="max-w-[360px]">
              <AdminProjectCard
                project={project}
                index={index}
                onSelect={handleProjectSelect}
                loading={loadingProjectSlug === project.slug}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-[#0b1120] p-6 text-sm text-slate-400">
          Nenhum projeto disponivel para este usuario.
        </div>
      )}
    </motion.div>
  )
}
