import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronRight, Menu, Sparkles } from 'lucide-react'
import { AppSidebar, primaryNav } from '@/components/app-sidebar'
import { ProjectWorkspaceMock } from '@/components/project-workspace-mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const projects = [
  {
    id: 'reliquia',
    name: 'Reliquia de familia',
    status: 'Atendimento ativo',
    description: 'Fluxo com WhatsApp, site e handoff humano.',
  },
  {
    id: 'lumina',
    name: 'Lumina Clinic',
    status: 'Agente em setup',
    description: 'Configuracao inicial de roteiros e qualificacao.',
  },
  {
    id: 'north',
    name: 'North Scale',
    status: 'Operacao pausada',
    description: 'Projeto em revisao de automacoes.',
  },
]

function ProjectCard({ project, onSelect }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22 }}
      onClick={() => onSelect(project.name)}
      className="group rounded-[28px] border border-white/5 bg-[linear-gradient(145deg,rgba(10,18,33,0.96),rgba(10,29,42,0.88))] p-6 text-left shadow-[0_24px_70px_-42px_rgba(0,0,0,1)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="cyan">{project.status}</Badge>
          <h3 className="mt-4 text-xl font-semibold text-white">{project.name}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">{project.description}</p>
        </div>
        <div className="rounded-full border border-white/10 p-2 text-slate-500 transition-colors group-hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
        <Check className="h-4 w-4 text-emerald-300" />
        <span>Entrar no workspace do projeto</span>
      </div>
    </motion.button>
  )
}

export function InfraStudioMock() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeKey, setActiveKey] = useState('projects')
  const [selectedProject, setSelectedProject] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSelectProject = (projectName) => {
    setSelectedProject(projectName)
    setActiveKey('projects')
    setSidebarCollapsed(true)
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
    setActiveKey('projects')
    setSidebarCollapsed(false)
  }

  const handleOpenAttendance = () => {
    setActiveKey('attendance')
    setSidebarCollapsed(false)
  }

  const handleSelectNav = (key) => {
    setActiveKey(key)
    setMobileMenuOpen(false)

    if (key === 'attendance' && selectedProject) {
      setSidebarCollapsed(false)
      return
    }

    if (key === 'projects' && !selectedProject) {
      setSidebarCollapsed(false)
    }
  }

  const showAttendanceButton = selectedProject && activeKey !== 'attendance'

  return (
    <div className="min-h-screen bg-[#050b16] text-slate-300">
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.1),transparent_20%),linear-gradient(180deg,#050b16_0%,#091120_100%)]">
        <AppSidebar
          collapsed={sidebarCollapsed}
          activeKey={activeKey}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          onSelect={handleSelectNav}
        />

        {selectedProject ? (
          <ProjectWorkspaceMock
            project={selectedProject}
            onBack={handleBackToProjects}
            onOpenAttendance={handleOpenAttendance}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        ) : (
          <main className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-white/5 bg-[#08111f]/95 px-4 py-4 backdrop-blur sm:px-6 lg:static lg:bg-transparent lg:px-8 lg:backdrop-blur-0">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                {showAttendanceButton ? (
                  <Button
                    variant="ghost"
                    className="h-11 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 text-cyan-100 hover:bg-cyan-500/15 hover:text-white"
                    onClick={handleOpenAttendance}
                  >
                    Atendimento
                  </Button>
                ) : (
                  <div className="h-11" />
                )}
              </div>
              <div className="max-w-4xl">
                <Badge variant="cyan">Workspace</Badge>
                <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
                  Escolha um projeto para abrir o atendimento
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  O fluxo mock parte da selecao do projeto, entra no workspace com sheets e libera o
                  botao de atendimento no topo.
                </p>
              </div>
            </header>

            <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} onSelect={handleSelectProject} />
                  ))}
                </div>

                <div className="rounded-[30px] border border-white/5 bg-white/[0.03] p-6 shadow-[0_24px_70px_-42px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <Sparkles className="h-4 w-4" />
                    Como vai funcionar
                  </div>
                  <div className="mt-5 space-y-4 text-sm leading-7 text-slate-400">
                    <p>1. Escolhe o projeto.</p>
                    <p>2. Abre o workspace com sheets e contexto do projeto.</p>
                    <p>3. Clica em atendimento no topo para abrir a tela dedicada do chat.</p>
                  </div>
                  <Button
                    className="mt-6 h-12 w-full rounded-2xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    onClick={() => handleSelectProject(projects[0].name)}
                  >
                    Abrir primeiro projeto
                  </Button>
                </div>
              </div>
            </section>
          </main>
        )}

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="border-white/5 bg-[#08111f] text-slate-200">
            <SheetHeader>
              <SheetTitle className="text-white">Menu principal</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {primaryNav.map((item) => {
                const Icon = item.icon

                return (
                  <Button
                    key={item.key}
                    variant="ghost"
                    className="h-12 w-full justify-start rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
                    onClick={() => handleSelectNav(item.key)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
