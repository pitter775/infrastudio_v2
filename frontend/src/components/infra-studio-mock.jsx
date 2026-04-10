import { motion } from 'framer-motion'
import {
  Bell,
  ChartColumn,
  ChevronDown,
  EllipsisVertical,
  FileText,
  GitBranch,
  Globe,
  LayoutGrid,
  List,
  MessageSquareText,
  Settings,
  Users,
  Workflow,
} from 'lucide-react'
import SimpleBar from 'simplebar-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const primaryNav = [
  { label: 'Projects', icon: LayoutGrid, active: true },
  { label: 'Templates', icon: FileText },
]

const resourceNav = [
  { label: 'Usage', icon: ChartColumn },
  { label: 'People', icon: Users },
]

const externalNav = [
  { label: 'Docs', icon: FileText },
  { label: 'Central Station', icon: Globe },
  { label: 'Suporte', icon: MessageSquareText },
]

const projectCards = [
  {
    name: 'EquilibraMente',
    status: 'production',
    details: '2/2 services online',
    statusDotClassName: 'bg-emerald-500',
    icons: ['workflow', 'github'],
  },
  {
    name: 'airy-beauty',
    status: 'No services',
    details: '0/0 services online',
    statusDotClassName: 'bg-slate-500',
    icons: [],
  },
  {
    name: 'pleasant-joy',
    status: 'production',
    details: '1/1 service online',
    statusDotClassName: 'bg-emerald-500',
    icons: ['github'],
  },
]

function SidebarItem({ item }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200',
        item.active
          ? 'bg-slate-800/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          : 'text-slate-400 hover:bg-slate-800/40 hover:text-white',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 transition-colors duration-200',
          item.active ? 'text-sky-400' : 'text-slate-500 group-hover:text-sky-400',
        )}
      />
      <span>{item.label}</span>
    </button>
  )
}

function SettingsItem() {
  return (
    <button
      type="button"
      className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-white"
    >
      <span className="flex items-center gap-3">
        <Settings className="h-4 w-4 text-slate-500 transition-colors duration-200 group-hover:text-sky-400" />
        <span>Settings</span>
      </span>
      <ChevronDown className="h-3 w-3" />
    </button>
  )
}

function ExternalItem({ item }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-white"
    >
      <Icon className="h-4 w-4 text-slate-500 transition-colors duration-200 group-hover:text-sky-400" />
      <span>{item.label}</span>
    </button>
  )
}

function ProjectServiceIcon({ type }) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-slate-950/90 shadow-[0_10px_30px_-18px_rgba(59,130,246,0.65)]">
      {type === 'workflow' ? (
        <Workflow className="h-5 w-5 text-sky-400" />
      ) : (
        <GitBranch className="h-5 w-5 text-white" />
      )}
    </div>
  )
}

function ProjectCardItem({ card, index }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -6 }}
      className="group overflow-hidden rounded-2xl border border-white/5 bg-[#0f172a]/92 shadow-[0_22px_60px_-32px_rgba(0,0,0,0.9)]"
    >
      <div className="border-b border-white/5 p-5">
        <h3 className="font-medium text-white transition-colors duration-200 group-hover:text-sky-300">
          {card.name}
        </h3>
      </div>

      <div
        className="flex h-36 items-center justify-center gap-4 bg-[#0d1527]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(51,65,85,0.95) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {card.icons.length > 0 ? (
          card.icons.map((icon, iconIndex) => (
            <ProjectServiceIcon key={`${card.name}-${icon}-${iconIndex}`} type={icon} />
          ))
        ) : (
          <span className="text-sm text-slate-600">No services linked</span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/5 p-4 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', card.statusDotClassName)} />
          <span>{card.status}</span>
        </div>
        <span>{card.details}</span>
      </div>
    </motion.article>
  )
}

export function InfraStudioMock() {
  return (
    <div className="min-h-screen bg-[#080e1d] text-slate-300">
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_22%),linear-gradient(180deg,#080e1d_0%,#0b1220_100%)]">
        <aside className="hidden w-60 shrink-0 border-r border-white/5 bg-[#0a1020]/90 lg:block">
          <div className="flex h-screen flex-col justify-between py-6">
            <div className="px-5">
              <div className="mb-10 flex items-center gap-3 px-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-bold text-white shadow-[0_12px_30px_-12px_rgba(59,130,246,0.8)]">
                  I
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">InfraStudio</p>
                  <p className="text-xs text-slate-500">Workspace control</p>
                </div>
              </div>

              <nav className="space-y-1">
                {primaryNav.map((item) => (
                  <SidebarItem key={item.label} item={item} />
                ))}
              </nav>

              <div className="mt-8 space-y-1">
                {resourceNav.map((item) => (
                  <SidebarItem key={item.label} item={item} />
                ))}
                <SettingsItem />
              </div>

              <div className="mt-8 border-t border-white/5 pt-6">
                <div className="space-y-1">
                  {externalNav.map((item) => (
                    <ExternalItem key={item.label} item={item} />
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 px-5 pt-5">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-colors duration-200 hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-sm font-semibold text-white">
                    P
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Pitter</div>
                    <div className="text-xs text-slate-500">Admin</div>
                  </div>
                </div>
                <EllipsisVertical className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-white/5 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                  Workspace
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                  Projects
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl border border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white"
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Button className="rounded-xl bg-violet-500 px-5 text-white hover:bg-violet-600">
                  <span className="mr-2 text-lg leading-none">+</span>
                  <span>New</span>
                </Button>
              </div>
            </div>
          </header>

          <SimpleBar className="h-[calc(100vh-97px)]">
            <section className="px-4 py-6 sm:px-6 lg:px-8">
              <div className="rounded-[28px] border border-white/5 bg-white/[0.02] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm sm:p-6 lg:p-8">
                <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <span>3 Projects</span>
                    </div>
                    <span className="hidden text-slate-700 sm:inline">|</span>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 transition-colors duration-200 hover:text-slate-200"
                    >
                      <span>Sort By: Recent Activity</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center rounded-xl border border-white/5 bg-slate-900/40 p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg bg-white/10 text-white hover:bg-white/10 hover:text-white"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-slate-500 hover:bg-transparent hover:text-white"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  {projectCards.map((card, index) => (
                    <ProjectCardItem key={card.name} card={card} index={index} />
                  ))}
                </div>
              </div>
            </section>
          </SimpleBar>
        </main>
      </div>
    </div>
  )
}
