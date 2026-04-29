'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Bot,
  Bell,
  CalendarClock,
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
  RefreshCcw,
  MessageSquareQuote,
  MessageSquareText,
  PanelsTopLeft,
  UserCog,
  Users,
} from 'lucide-react'
import { ProjectBillingModal } from '@/components/admin/billing/project-billing-modal'
import { LogoCubo3D } from '@/components/ui/LogoCubo3D'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/ui/user-avatar'
import { conthrax } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: ChartColumn, href: '/admin/dashboard' },
  { label: 'Projetos', icon: LayoutGrid, href: '/admin/projetos' },
  { label: 'Atendimento', icon: MessageSquareText, href: '/admin/atendimento', badgeKey: 'attendance' },
  { label: 'Agenda', icon: CalendarClock, href: '/admin/agenda' },
  { label: 'Feedback', icon: MessageSquareQuote, href: '/admin/feedback', badgeKey: 'feedback' },
  { label: 'Avisos', icon: Bell, href: '/admin/avisos', badgeKey: 'notifications' },
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

function formatBadgeValue(value) {
  if (!value) {
    return null
  }

  return value > 99 ? '99+' : String(value)
}

const notificationIconByKind = {
  attendance: MessageSquareText,
  feedback: MessageSquareQuote,
  billing: CreditCard,
}

function SidebarItem({ item, pathname, collapsed, pendingHref, onNavigate, badgeCount }) {
  const Icon = item.icon
  const active = isItemActive(item, pathname)
  const loading = pendingHref === item.href
  const badgeLabel = formatBadgeValue(badgeCount)

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
      {badgeLabel ? (
        <span
          className={cn(
            'ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            active ? 'bg-sky-400/20 text-sky-100' : 'bg-rose-500/15 text-rose-200',
          )}
        >
          {badgeLabel}
        </span>
      ) : null}
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

function SidebarContent({ user, collapsed = false, pathname, pendingHref, onNavigate, counts, projectUsageSummary = null, buildLabel = '' }) {
  const availableNavItems = navItems.filter((item) => !item.adminOnly || user?.role === "admin")
  const shouldShowBuildLabel = user?.role === 'admin' && !collapsed && buildLabel

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <>
      <div className="px-4">
        <div className={cn('mb-10 flex items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
          <LogoCubo3D animado tamanho={20} velocidade={0.16} />

          {collapsed ? null : (
            <span className={`${conthrax.className} font-brand-conthrax text-[0.72rem] leading-none`}>
              <span className="text-white">Infra</span>
              <span className="text-[#2B6BEE]">Studio</span>
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
              badgeCount={counts?.[item.badgeKey] ?? 0}
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

        {shouldShowBuildLabel ? (
          <div className="mt-16 px-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
              build {buildLabel}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/5 px-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar src={user?.avatarUrl} label={user?.name || user?.email} className="h-8 w-8" />
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

function formatCycleResetLabel(value) {
  if (!value) {
    return 'Renovacao mensal'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

function openBillingModal() {
  window.dispatchEvent(
    new CustomEvent('admin-billing-modal-toggle', {
      detail: { open: true },
    }),
  )
}

function SidebarProjectUsageCard({ summary }) {
  if (!summary) {
    return null
  }

  const statusLabel =
    summary.subscriptionStatus === 'aguardando_confirmacao'
      ? 'Pagamento em confirmacao'
      : summary.billingBlocked && !summary.planId
        ? 'Projeto sem plano'
        : summary.billingBlocked
          ? 'Projeto bloqueado'
          : summary.isFree
            ? 'Plano Free'
            : summary.planName || 'Plano ativo'

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-medium text-white">Limites de uso restantes</p>
      <p className="mt-1 text-xs text-slate-500">{statusLabel}</p>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{summary.remainingLabel}</p>
          <p className="mt-1 text-xs text-slate-500">Mensalmente</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-200">{summary.remainingPercentLabel || '--'}</p>
          <p className="mt-1 text-xs text-slate-500">{formatCycleResetLabel(summary.cycleEndDate)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <button
          type="button"
          onClick={openBillingModal}
          className="flex items-center justify-between rounded-xl px-2 py-2 text-sm text-white transition hover:bg-white/[0.04]"
        >
          <span>Fazer upgrade para o Plus</span>
          <ArrowUpRight className="h-4 w-4 text-slate-500" />
        </button>
        <button
          type="button"
          onClick={openBillingModal}
          className="flex items-center justify-between rounded-xl px-2 py-2 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
        >
          <span>Saiba mais</span>
          <ArrowUpRight className="h-4 w-4 text-slate-500" />
        </button>
      </div>
    </div>
  )
}

export function AdminShell({ user, children, buildLabel = '' }) {
  const pathname = usePathname()
  const attendanceRoute = pathname.startsWith('/admin/atendimento')
  const projectDetailRoute = pathname.startsWith('/admin/projetos/')
  const compactSidebarRoute = attendanceRoute || projectDetailRoute
  const [desktopManuallyCollapsed, setDesktopManuallyCollapsed] = useState(false)
  const [sidebarPinnedOpen, setSidebarPinnedOpen] = useState(false)
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState(null)
  const [notificationCounts, setNotificationCounts] = useState({
    attendance: 0,
    feedback: 0,
    notifications: 0,
  })
  const [notificationItems, setNotificationItems] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [projectUsageSummary, setProjectUsageSummary] = useState(null)
  const [billingModalOpen, setBillingModalOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const notificationsRef = useRef(null)
  const billingHistoryActiveRef = useRef(false)
  const billingPopClosingRef = useRef(false)
  const collapsed = compactSidebarRoute ? !(sidebarPinnedOpen || sidebarHoverOpen) : desktopManuallyCollapsed
  const contentBackgroundStyle = projectDetailRoute
    ? {
        backgroundImage: 'radial-gradient(rgba(71,85,105,0.18) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }
    : undefined

  useEffect(() => {
    function syncMobileState() {
      setIsMobile(window.innerWidth < 1024)
    }

    syncMobileState()
    window.addEventListener('resize', syncMobileState)
    return () => window.removeEventListener('resize', syncMobileState)
  }, [])

  useEffect(() => {
    setDesktopManuallyCollapsed(false)
    setSidebarPinnedOpen(false)
    setSidebarHoverOpen(false)
    setMobileOpen(false)
    setPendingHref(null)
    if (!projectDetailRoute) {
      setProjectUsageSummary(null)
    }
  }, [pathname, projectDetailRoute])

  function handleNavigate(href) {
    if (!href || href === pathname) {
      return
    }

    setPendingHref(href)
  }

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('admin-sidebar-state-change', {
        detail: { collapsed },
      }),
    )
  }, [collapsed])

  useEffect(() => {
    function handleProjectUsageSummary(event) {
      if (!event.detail) {
        setProjectUsageSummary(null)
        return
      }

      setProjectUsageSummary({
        ...event.detail,
        cycleResetLabel: formatCycleResetLabel(event.detail.cycleEndDate),
      })
    }

    window.addEventListener('admin-project-usage-summary', handleProjectUsageSummary)

    return () => {
      window.removeEventListener('admin-project-usage-summary', handleProjectUsageSummary)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile || !billingModalOpen || billingHistoryActiveRef.current) {
      return
    }

    window.history.pushState({ adminBillingModal: true }, '')
    billingHistoryActiveRef.current = true
  }, [billingModalOpen, isMobile])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    function handlePopState() {
      if (!billingHistoryActiveRef.current) {
        return
      }

      billingPopClosingRef.current = true
      billingHistoryActiveRef.current = false
      setBillingModalOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    function handleBillingModalToggle(event) {
      setBillingModalOpen(Boolean(event.detail?.open))
    }

    window.addEventListener('admin-billing-modal-toggle', handleBillingModalToggle)

    return () => {
      window.removeEventListener('admin-billing-modal-toggle', handleBillingModalToggle)
    }
  }, [])

  function handleBillingModalOpenChange(nextOpen) {
    if (!nextOpen && isMobile && billingHistoryActiveRef.current && !billingPopClosingRef.current) {
      window.history.back()
      return
    }

    if (!nextOpen) {
      billingHistoryActiveRef.current = false
    }

    billingPopClosingRef.current = false
    setBillingModalOpen(nextOpen)
  }

  useEffect(() => {
    let active = true

    async function loadNotifications({ includeItems = false } = {}) {
      try {
        if (includeItems) {
          setNotificationsLoading(true)
        }

        const response = await fetch(includeItems ? '/api/admin/avisos' : '/api/admin/avisos?summary=1', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !active) {
          return
        }

        setNotificationCounts({
          attendance: Number(data.summary?.attendance ?? 0),
          feedback: Number(data.summary?.feedback ?? 0),
          notifications: Number(data.summary?.notifications ?? 0),
        })

        if (includeItems) {
          setNotificationItems(data.items ?? [])
        }
      } catch {}
      finally {
        if (includeItems && active) {
          setNotificationsLoading(false)
        }
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(() => loadNotifications(), 30000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [pathname])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function loadNotificationItems() {
    setNotificationsLoading(true)
    const response = await fetch('/api/admin/avisos', { cache: 'no-store' }).catch(() => null)
    const data = await response?.json().catch(() => ({}))

    if (response?.ok) {
      setNotificationCounts({
        attendance: Number(data.summary?.attendance ?? 0),
        feedback: Number(data.summary?.feedback ?? 0),
        notifications: Number(data.summary?.notifications ?? 0),
      })
      setNotificationItems(data.items ?? [])
    }

    setNotificationsLoading(false)
  }

  async function loadNotificationSummary() {
    const response = await fetch('/api/admin/avisos?summary=1', { cache: 'no-store' }).catch(() => null)
    const data = await response?.json().catch(() => ({}))

    if (response?.ok) {
      setNotificationCounts({
        attendance: Number(data.summary?.attendance ?? 0),
        feedback: Number(data.summary?.feedback ?? 0),
        notifications: Number(data.summary?.notifications ?? 0),
      })
    }
  }

  async function markNotificationsAsRead(items) {
    const normalizedItems = Array.isArray(items)
      ? items.filter((item) => item?.readKey)
      : []

    if (!normalizedItems.length) {
      return
    }

    await fetch('/api/admin/avisos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: normalizedItems.map((item) => ({
          kind: item.kind,
          href: item.href,
          readKey: item.readKey,
        })),
      }),
    }).catch(() => null)

    const kindCounts = normalizedItems.reduce(
      (accumulator, item) => {
        if (item.kind === 'attendance') {
          accumulator.attendance += 1
        } else if (item.kind === 'feedback') {
          accumulator.feedback += 1
        }

        return accumulator
      },
      { attendance: 0, feedback: 0 },
    )

    setNotificationItems((current) => current.filter((item) => !normalizedItems.some((readItem) => readItem.readKey === item.readKey)))
    setNotificationCounts((current) => ({
      attendance: Math.max(0, current.attendance - kindCounts.attendance),
      feedback: Math.max(0, current.feedback - kindCounts.feedback),
      notifications: Math.max(0, current.notifications - normalizedItems.length),
    }))
  }

  async function handleNotificationsToggle() {
    const nextOpen = !notificationsOpen
    setNotificationsOpen(nextOpen)

    if (nextOpen) {
      await loadNotificationItems()
    }
  }

  useEffect(() => {
    function handleNotificationsRefresh() {
      if (notificationsOpen) {
        void loadNotificationItems()
        return
      }

      void loadNotificationSummary()
    }

    window.addEventListener('admin-notifications-refresh', handleNotificationsRefresh)

    return () => {
      window.removeEventListener('admin-notifications-refresh', handleNotificationsRefresh)
    }
  }, [notificationsOpen])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#080e1d] font-sans text-slate-400 antialiased lg:h-screen lg:overflow-hidden">
        <div className="flex min-h-screen w-full bg-[#080e1d] lg:h-full">
          <motion.aside
            animate={{ width: collapsed ? 80 : 192 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="hidden shrink-0 py-6 lg:block"
            onMouseEnter={() => {
              if (compactSidebarRoute) {
                setSidebarHoverOpen(true)
              }
            }}
            onMouseLeave={() => {
              if (compactSidebarRoute && !sidebarPinnedOpen) {
                setSidebarHoverOpen(false)
              }
            }}
          >
            <div className="flex h-full flex-col justify-between">
              <SidebarContent
                user={user}
                collapsed={collapsed}
                pathname={pathname}
                pendingHref={pendingHref}
                onNavigate={handleNavigate}
                counts={notificationCounts}
                projectUsageSummary={projectUsageSummary}
                buildLabel={buildLabel}
              />
            </div>
          </motion.aside>

          <main className="flex min-h-screen min-w-0 flex-1 flex-col pt-16 lg:min-h-0 lg:pt-0">
            <header className="fixed inset-x-0 top-0 z-[70] h-16 shrink-0 bg-[#080e1d] px-4 sm:px-8 lg:sticky lg:z-[220] lg:h-12">
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
                        <div className="flex h-full flex-col justify-between">
                          <SidebarContent
                            user={user}
                            pathname={pathname}
                            pendingHref={pendingHref}
                            onNavigate={(href) => {
                              handleNavigate(href)
                            }}
                            counts={notificationCounts}
                            projectUsageSummary={projectUsageSummary}
                            buildLabel={buildLabel}
                          />
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                <div className="mr-auto hidden min-w-0 items-center gap-3 lg:flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                    onClick={() => {
                      if (compactSidebarRoute) {
                        setSidebarPinnedOpen((current) => !current)
                        setSidebarHoverOpen(false)
                        return
                      }

                      setDesktopManuallyCollapsed((current) => !current)
                    }}
                  >
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  {projectDetailRoute ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBillingModalOpen(true)}
                      className="h-9 rounded-xl px-3 text-slate-400 shadow-none hover:bg-white/[0.04] hover:text-white"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Meu Plano
                    </Button>
                  ) : null}

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

                  <div ref={notificationsRef} className="relative z-[230]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleNotificationsToggle()}
                      className="relative text-slate-500 shadow-none hover:bg-transparent hover:text-white"
                      aria-label="Abrir avisos"
                    >
                      <Bell className="h-5 w-5" />
                      {notificationCounts.notifications ? (
                        <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                          {formatBadgeValue(notificationCounts.notifications)}
                        </span>
                      ) : null}
                    </Button>

                    {notificationsOpen ? (
                      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[240] w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1424] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Avisos</div>
                            <div className="text-xs text-slate-500">Acesse direto o conteudo pendente.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void loadNotificationItems()}
                            className="rounded-full p-1 text-slate-500 transition hover:bg-white/[0.04] hover:text-white"
                            aria-label="Atualizar avisos"
                          >
                            <RefreshCcw className={cn('h-4 w-4', notificationsLoading && 'animate-spin')} />
                          </button>
                        </div>

                        {notificationsLoading ? (
                          <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-400">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Carregando avisos...
                          </div>
                        ) : notificationItems.length ? (
                          <div className="max-h-[420px] overflow-y-auto">
                            {notificationItems.slice(0, 8).map((item) => {
                              const Icon = notificationIconByKind[item.kind] || Bell

                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  onClick={() => {
                                    setNotificationsOpen(false)
                                    void markNotificationsAsRead([item])
                                  }}
                                  className="flex items-start gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/[0.03]"
                                >
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                                      <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">
                                        {item.count}
                                      </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.description}</p>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                                    </p>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="px-4 py-6 text-sm text-slate-500">Nenhum aviso pendente no momento.</div>
                        )}

                        <div className="border-t border-white/5 p-3">
                          <Link
                            href="/admin/avisos"
                            onClick={() => setNotificationsOpen(false)}
                            className="block rounded-xl px-3 py-2 text-center text-sm font-medium text-sky-200 transition hover:bg-white/[0.03] hover:text-white"
                          >
                            Ver todos os avisos
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            <div className="flex min-w-0 flex-1 flex-col px-4 pb-4 pt-1 lg:min-h-0">
              <div
                className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-visible rounded-none border-0 lg:min-h-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-white/5"
                style={contentBackgroundStyle}
              >
                <div className={cn('min-w-0 overflow-x-hidden lg:flex-1', attendanceRoute ? 'lg:overflow-hidden' : 'lg:overflow-y-auto')}>
                  <div
                    className={cn(
                      attendanceRoute
                        ? 'h-full px-2 py-2'
                        : projectDetailRoute
                          ? 'min-w-0 px-0 py-2 lg:px-4 lg:py-6'
                          : 'min-w-0 px-4 py-6',
                    )}
                  >
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
        <ProjectBillingModal
          open={billingModalOpen}
          onOpenChange={handleBillingModalOpenChange}
          summary={projectUsageSummary}
        />
      </div>
    </TooltipProvider>
  )
}
