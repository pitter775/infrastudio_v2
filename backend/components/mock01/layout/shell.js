'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Bell,
  ChevronDown,
  EllipsisVertical,
  Menu,
  Settings,
} from 'lucide-react'
import { primaryNav, projectCards, resourceNav } from '@/components/mock01/data'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function isProjectsRoute(pathname) {
  return pathname === '/mock01' || pathname.startsWith('/mock01/')
}

function SidebarItem({ item }) {
  const Icon = item.icon
  const active = item.href ? isProjectsRoute(item.href) && isProjectsRoute(item.currentPath) : item.active

  return (
    <Link
      href={item.href || '#'}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-200',
        active
          ? 'bg-slate-800/60 text-white'
          : 'text-slate-400 hover:bg-slate-800/40 hover:text-white',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-[#b084f8]' : 'text-slate-400 group-hover:text-[#6f9aea]',
        )}
      />
      <span>{item.label}</span>
    </Link>
  )
}

function SidebarItemCollapsed({ item }) {
  const Icon = item.icon
  const active = item.href ? isProjectsRoute(item.href) && isProjectsRoute(item.currentPath) : item.active

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href || '#'}
          className={cn(
            'group flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
            active
              ? 'bg-slate-800/60 text-white'
              : 'text-slate-400 hover:bg-slate-800/40 hover:text-white',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              active ? 'text-[#b084f8]' : 'text-slate-400 group-hover:text-[#6f9aea]',
            )}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function SettingsItem() {
  return (
    <button
      type="button"
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-slate-800/40 hover:text-white"
    >
      <span className="flex items-center gap-3">
        <Settings className="h-4 w-4 text-slate-400 group-hover:text-[#6f9aea]" />
        <span>Settings</span>
      </span>
      <ChevronDown className="h-3 w-3" />
    </button>
  )
}

function SidebarContent({ isSidebarCollapsed = false, pathname }) {
  const navItems = primaryNav.map((item) => ({
    ...item,
    href: item.label === 'Projects' ? '/mock01' : '#',
    currentPath: pathname,
  }))
  const secondaryItems = resourceNav.map((item) => ({ ...item, href: '#', currentPath: pathname }))

  return (
    <>
      <div className="px-4">
        <div className="mb-10 flex items-center gap-2 px-3">
          <div className="h-5 w-5 rounded-sm bg-blue-500" />
        </div>

        <nav className="space-y-1">
          {navItems.map((item) =>
            isSidebarCollapsed ? (
              <SidebarItemCollapsed key={item.label} item={item} />
            ) : (
              <SidebarItem key={item.label} item={item} />
            ),
          )}
        </nav>

        <div className="mt-8 space-y-1">
          {secondaryItems.map((item) =>
            isSidebarCollapsed ? (
              <SidebarItemCollapsed key={item.label} item={item} />
            ) : (
              <SidebarItem key={item.label} item={item} />
            ),
          )}
          {isSidebarCollapsed ? (
            <SidebarItemCollapsed item={{ label: 'Settings', icon: Settings, href: '#', currentPath: pathname }} />
          ) : (
            <SettingsItem />
          )}
        </div>
      </div>

      <div className="border-t border-white/5 px-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold text-white">
              P
            </div>
            {!isSidebarCollapsed ? <span className="text-sm font-medium text-white">Pitter</span> : null}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-500 shadow-none hover:bg-transparent hover:text-white"
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}

export function Mock01Shell({ children }) {
  const pathname = usePathname()
  const isSidebarCollapsed = pathname !== '/mock01'
  const currentProject = pathname.startsWith('/mock01/')
    ? projectCards.find((card) => card.slug === pathname.replace('/mock01/', '')) ?? null
    : null
  const contentBackgroundStyle = currentProject
    ? {
        backgroundImage: 'radial-gradient(rgba(71,85,105,0.18) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }
    : undefined

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#080e1d] font-sans text-slate-400 antialiased lg:h-screen lg:overflow-hidden">
        <div className="flex min-h-screen w-full bg-[#080e1d] lg:h-full">
          <motion.aside
            animate={{ width: isSidebarCollapsed ? 80 : 192 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="hidden shrink-0 py-6 lg:block"
          >
            <div className="flex h-full flex-col justify-between">
              <SidebarContent isSidebarCollapsed={isSidebarCollapsed} pathname={pathname} />
            </div>
          </motion.aside>

          <main className="flex min-h-screen flex-1 flex-col lg:min-h-0">
            <header className="sticky top-0 z-20 h-12 shrink-0 bg-[#080e1d] px-8">
              <div className="flex h-full items-center justify-end">
                <div className="mr-auto lg:hidden">
                  <Sheet>
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
                        <SidebarContent pathname={pathname} />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {currentProject ? (
                  <div className="mr-auto hidden min-w-0 lg:block">
                    <p className="truncate text-sm font-medium text-white">
                      {currentProject.name}
                    </p>
                  </div>
                ) : null}

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                >
                  <Bell className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-1 pl-0 lg:min-h-0">
              <div
                className="flex flex-1 flex-col overflow-visible rounded-none border-0 lg:min-h-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-white/5"
                style={contentBackgroundStyle}
              >
                <div className="overflow-visible lg:flex-1 lg:overflow-y-auto">
                  <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
