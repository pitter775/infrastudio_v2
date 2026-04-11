import { motion } from 'framer-motion'
import {
  Bell,
  ChartColumn,
  ChevronDown,
  FileText,
  Globe,
  LayoutGrid,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const primaryNav = [
  { label: 'Projetos', icon: LayoutGrid, key: 'projects' },
  { label: 'Atendimento', icon: MessageSquareText, key: 'attendance' },
]

const secondaryNav = [
  { label: 'Uso', icon: ChartColumn },
  { label: 'Equipe', icon: Users },
]

const supportNav = [
  { label: 'Documentacao', icon: FileText },
  { label: 'Portal', icon: Globe },
]

function SidebarItem({ item, active, collapsed, onClick }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition-all duration-200',
        active
          ? 'bg-cyan-500/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-300',
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )
}

export function AppSidebar({ collapsed, activeKey, onToggle, onSelect }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 94 : 264 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="hidden shrink-0 border-r border-white/5 bg-[#091120]/92 lg:block"
    >
      <div className="flex h-screen flex-col justify-between px-4 py-5">
        <div>
          <div className={cn('mb-8 flex items-center gap-3 px-2', collapsed && 'justify-center')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-base font-bold text-white shadow-[0_16px_40px_-16px_rgba(34,211,238,0.9)]">
              I
            </div>
            {!collapsed && (
              <div>
                <div className="text-sm font-semibold text-white">InfraStudio</div>
                <div className="text-xs text-slate-500">Operacao</div>
              </div>
            )}
          </div>

          <div className={cn('mb-6 flex', collapsed ? 'justify-center' : 'justify-between px-2')}>
            {!collapsed && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Navegacao
                </div>
                <div className="mt-1 text-sm text-slate-300">Workspace principal</div>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-2xl border border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
              onClick={onToggle}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <nav className="space-y-2">
            {primaryNav.map((item) => (
              <SidebarItem
                key={item.key}
                item={item}
                active={activeKey === item.key}
                collapsed={collapsed}
                onClick={() => onSelect(item.key)}
              />
            ))}
          </nav>

          <div className="mt-8 space-y-2">
            {secondaryNav.map((item) => (
              <SidebarItem key={item.label} item={item} collapsed={collapsed} />
            ))}

            <button
              type="button"
              className={cn(
                'group flex w-full items-center rounded-2xl px-3 py-3 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-white/[0.04] hover:text-white',
                collapsed ? 'justify-center px-2' : 'justify-between',
              )}
            >
              <span className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-slate-500 group-hover:text-cyan-300" />
                {!collapsed && <span>Configuracoes</span>}
              </span>
              {!collapsed && <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-8 border-t border-white/5 pt-6">
            <div className="space-y-2">
              {supportNav.map((item) => (
                <SidebarItem key={item.label} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/5 pt-5">
          <div
            className={cn(
              'flex items-center rounded-[22px] border border-white/5 bg-white/[0.03] p-3',
              collapsed ? 'justify-center' : 'gap-3',
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-semibold text-white">
              P
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">Pitter</div>
                <div className="text-xs text-slate-500">Administrador</div>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-2xl border border-white/5 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.aside>
  )
}
