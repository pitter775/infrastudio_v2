'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Bot,
  Bell,
  CreditCard,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  FlaskConical,
  House,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquareQuote,
  MessageSquareText,
  PanelsTopLeft,
  UserCog,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: ChartColumn, href: '/admin/dashboard' },
  { label: 'Projetos', icon: LayoutGrid, href: '/admin/projetos' },
  { label: 'Atendimento', icon: MessageSquareText, href: '/admin/atendimento' },
  { label: 'Feedback', icon: MessageSquareQuote, href: '/admin/feedback' },
  { label: 'Template', icon: PanelsTopLeft, href: '/admin/template', adminOnly: true },
  { label: 'Perfil', icon: UserCog, href: '/admin/perfil' },
  { label: 'Adriana', icon: Bot, href: '/admin/adriana', adminOnly: true },
  { label: 'Usuarios', icon: Users, href: '/admin/usuarios', adminOnly: true },
  { label: 'Billing', icon: CreditCard, href: '/admin/billing', adminOnly: true },
  { label: 'Laboratorio', icon: FlaskConical, href: '/admin/laboratorio', adminOnly: true },
]

function isItemActive(item, pathname) {
  if (item.href === '/admin') {
    return pathname === '/admin'
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function SidebarItem({ item, pathname, collapsed, pendingHref, onNavigate }) {
  const Icon = item.icon
  const active = isItemActive(item, pathname)
  const loading = pendingHref === item.href

  const content = (
    <Link
      href={item.href}
      onClick={() => onNavigate?.(item.href)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
        collapsed && 'justify-center',
        active
          ? 'bg-slate-800/60 text-white'
          : 'text-slate-400 hover:bg-slate-800/40 hover:text-white',
        loading && 'pointer-events-none',
      )}
    >
      {loading ? (
        <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
      ) : (
        <Icon
          className={cn(
            'h-4 w-4 shrink-0',
            active ? 'text-[#b084f8]' : 'text-slate-400 group-hover:text-[#6f9aea]',
          )}
        />
      )}
      {collapsed ? null : <span>{item.label}</span>}
    </Link>
  )

  if (!collapsed) {
    return content
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarContent({ user, collapsed = false, pathname, pendingHref, onNavigate }) {
  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'
  const availableNavItems = navItems.filter((item) => !item.adminOnly || user?.role === "admin")

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <>
      <div className="px-4">
      <div className={cn('mb-10 flex items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
  <img 
    src="/logo.png" 
    alt="InfraStudio Logo"
    className="h-5 w-5 object-contain"
  />

  {collapsed ? null : (
    <span className="text-sm font-semibold text-white">
      InfraStudio
    </span>
  )}
</div>

        <nav className="space-y-1">
          {availableNavItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              pendingHref={pendingHref}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        <div className="mt-8 space-y-1">
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-slate-800/40 hover:text-white',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-4 w-4 text-slate-400 group-hover:text-[#6f9aea]" />
            {collapsed ? null : <span>Sair</span>}
          </button>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white">
              {userInitial}
            </div>
            {collapsed ? null : (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{user?.name || 'Usuario'}</p>
                <p className="truncate text-xs text-slate-500">{user?.role || 'viewer'}</p>
              </div>
            )}
          </div>

          {collapsed ? null : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-500 shadow-none hover:bg-transparent hover:text-white"
            >
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

export function AdminShell({ user, children }) {
  const pathname = usePathname()
  const attendanceRoute = pathname.startsWith('/admin/atendimento')
  const projectDetailRoute = pathname.startsWith('/admin/projetos/')
  const [collapsed, setCollapsed] = useState(attendanceRoute || projectDetailRoute)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState(null)
  const contentBackgroundStyle = projectDetailRoute
    ? {
        backgroundImage: 'radial-gradient(rgba(71,85,105,0.18) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }
    : undefined

  useEffect(() => {
    setCollapsed(attendanceRoute || projectDetailRoute)
    setMobileOpen(false)
    setPendingHref(null)
  }, [attendanceRoute, pathname, projectDetailRoute])

  function handleNavigate(href) {
    if (!href || href === pathname) {
      return
    }

    setPendingHref(href)
  }

  useEffect(() => {
    function handleProjectSheetToggle(event) {
      if (!projectDetailRoute) {
        return
      }

      setCollapsed(Boolean(event.detail?.open))
    }

    window.addEventListener('admin-project-sheet-toggle', handleProjectSheetToggle)

    return () => {
      window.removeEventListener('admin-project-sheet-toggle', handleProjectSheetToggle)
    }
  }, [projectDetailRoute])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('admin-sidebar-state-change', {
        detail: { collapsed },
      }),
    )
  }, [collapsed])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#080e1d] font-sans text-slate-400 antialiased lg:h-screen lg:overflow-hidden">
        <div className="flex min-h-screen w-full bg-[#080e1d] lg:h-full">
          <motion.aside
            animate={{ width: collapsed ? 80 : 192 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="hidden shrink-0 py-6 lg:block"
          >
            <div className="flex h-full flex-col justify-between">
              <SidebarContent
                user={user}
                collapsed={collapsed}
                pathname={pathname}
                pendingHref={pendingHref}
                onNavigate={handleNavigate}
              />
            </div>
          </motion.aside>

          <main className="flex min-h-screen min-w-0 flex-1 flex-col pt-16 lg:min-h-0 lg:pt-0">
            <header className="fixed inset-x-0 top-0 z-50 h-16 shrink-0 bg-[#080e1d] px-4 sm:px-8 lg:sticky lg:z-20 lg:h-12">
              <div className="flex h-full items-center justify-end">
                <div className="mr-auto lg:hidden">
                  <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                      >
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="py-6">
                      <div className="flex h-full flex-col justify-between">
                        <SidebarContent
                          user={user}
                          pathname={pathname}
                          pendingHref={pendingHref}
                          onNavigate={(href) => {
                            handleNavigate(href)
                          }}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                <div className="mr-auto hidden min-w-0 items-center gap-3 lg:flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                    onClick={() => setCollapsed((current) => !current)}
                  >
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                  >
                    <Link href="/" aria-label="Voltar para a home publica">
                      <House className="h-5 w-5" />
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                  >
                    <Bell className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </header>

            <div className="flex min-w-0 flex-1 flex-col px-4 pb-4 pt-1 lg:min-h-0">
              <div
                className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-visible rounded-none border-0 lg:min-h-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-white/5"
                style={contentBackgroundStyle}
              >
                <div className={cn('min-w-0 overflow-x-hidden lg:flex-1', attendanceRoute ? 'lg:overflow-hidden' : 'lg:overflow-y-auto')}>
                  <div className={cn(attendanceRoute ? 'h-full px-2 py-2' : 'min-w-0 px-4 py-6')}>
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

