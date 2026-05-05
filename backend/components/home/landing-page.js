'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe,
  LayoutGrid,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  PackageSearch,
  Phone,
  PlugZap,
  Sparkles,
  Store,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PremiumHomeChatDemo } from '@/components/home/chat-demo'
import { LoginModal } from '@/components/home/login-modal'
import { LogoCubo3D } from '@/components/ui/LogoCubo3D'
import { UserAvatar } from '@/components/ui/user-avatar'
import { conthrax } from '@/lib/fonts'
import {
  BENEFIT_ITEMS,
  DEMO_FEATURES,
  FOOTER_COMPANY_LINKS,
  FOOTER_SOLUTION_LINKS,
  SERVICE_ITEMS,
  TECH_STACK,
  WHATSAPP_NUMBER,
} from '@/components/home/data'
import { signOutProjectAuth } from '@/lib/auth'
import { buildBillingIntentPayload, startBillingCheckout } from '@/lib/public-billing-client'
import { formatCredits, formatPlanPrice } from '@/lib/public-planos'
import { cn } from '@/lib/utils'

const HERO_CHANNEL_BUTTONS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    promptMessage: 'Quero entender melhor como funciona o WhatsApp.',
    icon: MessageCircle,
    className:
      'border-emerald-400/55 bg-emerald-500/14 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(52,211,153,0.24),0_0_44px_rgba(5,150,105,0.16)]',
    iconClassName: 'text-emerald-300',
  },
  {
    key: 'mercado_livre',
    label: 'Mercado Livre',
    promptMessage: 'Quero entender melhor como funciona o Mercado Livre.',
    icon: Store,
    className:
      'border-amber-400/55 bg-amber-500/14 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(251,191,36,0.24),0_0_44px_rgba(217,119,6,0.16)]',
    iconClassName: 'text-amber-300',
  },
  {
    key: 'apis',
    label: 'APIs',
    promptMessage: 'Quero entender melhor como funcionam as APIs.',
    icon: PlugZap,
    className:
      'border-sky-400/55 bg-sky-500/14 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(56,189,248,0.24),0_0_44px_rgba(2,132,199,0.16)]',
    iconClassName: 'text-sky-300',
  },
  {
    key: 'chat_widget',
    label: 'Chat widget',
    promptMessage: 'Quero entender melhor como funciona o chat widget.',
    icon: PackageSearch,
    className:
      'border-fuchsia-400/55 bg-fuchsia-500/14 text-white shadow-[0_8px_0_rgba(2,6,23,0.64),0_0_22px_rgba(217,70,239,0.24),0_0_44px_rgba(162,28,175,0.16)]',
    iconClassName: 'text-fuchsia-300',
  },
]

const HOME_CHANNEL_SHOWCASE_ITEMS = [
  {
    key: 'whatsapp',
    title: 'WhatsApp',
    description: 'Atenda seus clientes diretamente no WhatsApp.',
    icon: MessageCircle,
    accentClassName: 'border-emerald-400/40 text-emerald-300',
    iconWrapClassName:
      'border-emerald-400/35 bg-emerald-500/10 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]',
  },
  {
    key: 'mercado_livre',
    title: 'Mercado Livre',
    description: 'Respostas e vendas no Mercado Livre.',
    icon: Store,
    accentClassName: 'border-amber-400/40 text-amber-300',
    iconWrapClassName:
      'border-amber-400/35 bg-amber-500/10 text-amber-300 shadow-[0_0_24px_rgba(250,204,21,0.18)]',
  },
  {
    key: 'site',
    title: 'Site',
    description: 'Adicione o atendente ao site e nunca perca um lead.',
    icon: Globe,
    accentClassName: 'border-sky-400/40 text-sky-300',
    iconWrapClassName:
      'border-sky-400/35 bg-sky-500/10 text-sky-300 shadow-[0_0_24px_rgba(56,189,248,0.18)]',
  },
  {
    key: 'apis',
    title: 'APIs',
    description: 'Integre sistemas, plataformas e ferramentas favoritas.',
    icon: PlugZap,
    accentClassName: 'border-fuchsia-400/40 text-fuchsia-300',
    iconWrapClassName:
      'border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300 shadow-[0_0_24px_rgba(217,70,239,0.18)]',
  },
]

function HomeNavbar({ currentUser, onLoginClick }) {
  const projectsHref = currentUser?.role === 'admin' ? '/admin/projetos' : '/app/projetos'
  const displayName = currentUser?.name?.trim() || currentUser?.email?.trim() || 'Usuário'
  const navItems = useMemo(
    () => [
      { href: '#planos', label: 'Planos', icon: Sparkles },
      { href: '#servicos', label: 'Serviços', icon: Sparkles },
      { href: '#como-funciona', label: 'Como funciona', icon: BriefcaseBusiness },
      { href: '#sobre', label: 'Sobre nós', icon: BriefcaseBusiness },
    ],
    [],
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [projectLoading, setProjectLoading] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    function syncScrolled() {
      setScrolled(window.scrollY > 12)
    }

    syncScrolled()
    window.addEventListener('scroll', syncScrolled, { passive: true })

    return () => {
      window.removeEventListener('scroll', syncScrolled)
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function handleLogout() {
    setUserMenuOpen(false)
    setMobileOpen(false)
    await signOutProjectAuth()
    window.location.href = '/'
  }

  function handleProjectsOpen() {
    setProjectLoading(true)
    setUserMenuOpen(false)
    setMobileOpen(false)
    window.location.href = projectsHref
  }

  return (
    <nav
      className={cn(
        'home-nav-shell fixed top-0 z-[90] w-full py-4 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200',
        scrolled && 'home-nav-shell-scrolled border-b',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <LogoCubo3D animado tamanho={50} velocidade={0.16} />
          <div>
            <span className={`${conthrax.className} font-brand-conthrax block text-[1rem] leading-none`}>
              <span className="text-slate-900 dark:text-white/80 shadow-sm">infra</span>
              <span className="text-[#2B6BEE] shadow-sm">studio</span>
            </span>
          </div>
        </Link>

        <div className="hidden items-center space-x-2 md:flex lg:space-x-3">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-500/10 hover:text-blue-600 lg:px-3 dark:text-slate-300 dark:hover:text-blue-300"
              >
                <Icon size={15} className="text-slate-400 dark:text-slate-500" />
                <span className="hidden lg:inline">{item.label}</span>
              </a>
            )
          })}

          {currentUser ? (
            <div ref={userMenuRef} className="relative block">
              <button
                type="button"
                onClick={() => setUserMenuOpen((value) => !value)}
                className="relative inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 py-1.5 pl-2 pr-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:text-white"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <UserAvatar
                  src={currentUser?.avatarUrl}
                  label={displayName}
                  className="h-7 w-7 bg-gradient-to-br from-cyan-400 to-blue-500 text-[11px]"
                />
                {projectLoading ? (
                  <Loader2
                    size={14}
                    className="shrink-0 animate-spin text-cyan-500 dark:text-cyan-100"
                  />
                ) : (
                  <span className="hidden max-w-[140px] truncate text-left xl:inline">{displayName}</span>
                )}
                <ChevronDown
                  size={16}
                  className={cn('text-slate-400 transition-transform', userMenuOpen && 'rotate-180')}
                />
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-72 rounded-3xl border border-slate-200/90 bg-white/96 p-3 shadow-[0_28px_80px_rgba(71,104,145,0.24)] dark:border-slate-700/80 dark:bg-slate-950 dark:shadow-[0_28px_80px_rgba(2,6,23,0.82)]">
                  <div className="mb-2 border-b border-slate-200 px-2 pb-3 dark:border-white/10">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {currentUser?.email || 'Sessão ativa'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleProjectsOpen}
                      disabled={projectLoading}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                    >
                      {projectLoading ? (
                        <Loader2 size={16} className="animate-spin text-cyan-600 dark:text-cyan-200" />
                      ) : (
                        <LayoutGrid size={16} className="text-cyan-600 dark:text-cyan-200" />
                      )}
                      Entrar em projetos
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-rose-400/25 hover:bg-rose-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
                    >
                      <LogOut size={16} className="text-rose-500 dark:text-rose-300" />
                      Deslogar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={onLoginClick}
              className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-blue-400 hover:bg-white dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:text-white"
            >
              Entrar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/80 p-2.5 text-slate-700 shadow-sm transition-all hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-slate-950 md:hidden dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:text-white"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {mobileOpen ? (
        <div className="mx-4 mt-4 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-2xl md:hidden dark:border-white/10 dark:bg-slate-950/95">
          <div className="space-y-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
              >
                <item.icon size={16} className="text-cyan-600 dark:text-cyan-200" />
                {item.label}
              </a>
            ))}

            {currentUser ? (
              <>
                <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                  {projectLoading ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-cyan-600 dark:bg-white/10 dark:text-cyan-200">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  ) : (
                    <UserAvatar
                      src={currentUser?.avatarUrl}
                      label={displayName}
                      className="h-8 w-8 bg-gradient-to-br from-cyan-400 to-blue-500"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {currentUser?.email || 'Sessão ativa'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleProjectsOpen}
                  disabled={projectLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {projectLoading ? (
                    <Loader2 size={16} className="animate-spin text-cyan-600 dark:text-cyan-200" />
                  ) : (
                    <LayoutGrid size={16} className="text-cyan-600 dark:text-cyan-200" />
                  )}
                  Entrar em projetos
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-rose-400/25 hover:bg-rose-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <LogOut size={16} className="text-rose-500 dark:text-rose-300" />
                  Deslogar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false)
                  onLoginClick()
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  )
}

function ServiceCard({ icon: Icon, title, description, delay }) {
  const normalizedTitle = String(title || '').toLowerCase()
  const accentMap =
    normalizedTitle === 'automação whatsapp'
      ? {
          glow: 'rgba(16,185,129,0.18)',
          iconClassName: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300',
          titleClassName: 'from-emerald-200 via-emerald-300 to-cyan-300',
          hoverBorderClassName: 'group-hover:border-emerald-300/30 dark:group-hover:border-emerald-300/25',
        }
      : normalizedTitle === 'mercado livre'
        ? {
            glow: 'rgba(250,204,21,0.18)',
            iconClassName: 'border-amber-400/35 bg-amber-500/10 text-amber-300',
            titleClassName: 'from-amber-200 via-amber-300 to-yellow-300',
            hoverBorderClassName: 'group-hover:border-amber-300/30 dark:group-hover:border-amber-300/25',
          }
        : normalizedTitle === 'ia para sites'
          ? {
              glow: 'rgba(217,70,239,0.18)',
              iconClassName: 'border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300',
              titleClassName: 'from-fuchsia-200 via-fuchsia-300 to-violet-300',
              hoverBorderClassName: 'group-hover:border-fuchsia-300/30 dark:group-hover:border-fuchsia-300/25',
            }
          : normalizedTitle === 'integração de apis'
            ? {
                glow: 'rgba(56,189,248,0.18)',
                iconClassName: 'border-sky-400/35 bg-sky-500/10 text-sky-300',
                titleClassName: 'from-sky-200 via-sky-300 to-cyan-300',
                hoverBorderClassName: 'group-hover:border-sky-300/30 dark:group-hover:border-sky-300/25',
              }
            : {
                glow: 'rgba(59,130,246,0.16)',
                iconClassName: 'border-blue-400/30 bg-blue-500/10 text-blue-300',
                titleClassName: 'from-sky-200 via-blue-300 to-cyan-300',
                hoverBorderClassName: 'group-hover:border-blue-300/25 dark:group-hover:border-white/20',
              }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="group relative overflow-hidden rounded-[1.65rem] transition-transform duration-300 hover:-translate-y-1"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <div className="plan-card-pro h-full w-full rounded-[1.65rem] border-transparent p-[4px]">
          <div className="h-full w-full rounded-[1.55rem] bg-transparent" />
        </div>
      </div>
      <div
        className={cn(
          'glass-effect relative min-h-[340px] h-full rounded-[1.65rem] border px-10 py-10 transition-all duration-300 group-hover:-translate-y-1',
          accentMap.hoverBorderClassName,
        )}
        style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 24px 60px -36px ${accentMap.glow}` }}
      >
        <div
          className={cn(
            'mb-8 flex h-14 w-14 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-110',
            accentMap.iconClassName,
          )}
        >
          <Icon size={24} />
        </div>
        <h3 className={cn('mb-4 bg-gradient-to-r bg-clip-text text-[1.55rem] font-semibold text-transparent', accentMap.titleClassName)}>{title}</h3>
        <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
      </div>
    </motion.div>
  )
}

function HomeChannelsShowcaseSection({ onChannelClick, onLoginClick }) {
  return (
    <section className="relative overflow-hidden py-8 md:py-10">
      <div className="absolute inset-0 bg-black" />

      <div
        className="absolute inset-x-0 bottom-0 top-0 hidden opacity-95 md:block"
        style={{
          backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.72) 24%, rgba(0,0,0,0.18) 50%), url('/bginfra.png')",
          backgroundPosition: 'center calc(100% + 70px)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '96% auto',
        }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="relative min-h-[640px] py-8 md:min-h-[430px] md:py-10">
          <div className="mb-8 flex justify-center md:mb-6 md:justify-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/8 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/90 shadow-[0_0_20px_rgba(168,85,247,0.12)] md:px-4 md:text-[9px] md:tracking-[0.22em]">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              <span>Tecnologia de ponta</span>
              <span className="text-sky-300">Automação inteligente</span>
            </div>
          </div>

          <div className="grid min-h-[290px] items-start gap-8 md:grid-cols-[1fr_1fr] md:items-end md:gap-6">
            <div className="mx-auto max-w-[25rem]  text-center md:mx-0 md:max-w-[30rem] md:pt-8 md:text-left">
              <h2 className="mx-auto max-w-[15.5rem] text-[1.55rem] font-semibold leading-[0.98] tracking-[-0.04em] text-white md:mx-0 md:max-w-none md:-translate-y-10 md:text-[2.55rem]">
                Tecnologia de ponta
                <br />
                para transformar
                <br />
                <span className="text-[#2B6BEE]">seu atendimento</span>
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3 md:mt-6 md:flex md:flex-wrap md:gap-2.5">
                {HOME_CHANNEL_SHOWCASE_ITEMS.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onChannelClick(item)}
                      className={cn('group flex min-h-[88px] w-full items-start gap-2.5 rounded-[0.9rem] border bg-[#07101f]/84 px-3.5 py-3.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-[1px] transition-all duration-300 hover:-translate-y-1 sm:min-w-0 md:min-h-[78px] md:w-[234px] md:min-w-[234px]', item.accentClassName)}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                          item.iconWrapClassName,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[0.8rem] font-semibold leading-none md:text-[0.82rem]">{item.title}</div>
                        <p className="mt-1.5 max-w-[12rem] text-[0.68rem] leading-[1.38] text-slate-300 md:max-w-none md:text-[0.66rem]">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="relative hidden min-h-[300px] items-end justify-center md:flex md:min-h-[340px] md:items-center">
              <button
                type="button"
                onClick={onLoginClick}
                className="absolute left-1/2 top-2 z-10 inline-flex -translate-x-1/2 items-center gap-3 rounded-[1rem] border border-emerald-400/45 bg-[#07101f]/88 px-4 py-3 text-left shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_0_42px_rgba(16,185,129,0.08)] transition-all duration-300 hover:-translate-y-1 md:left-auto md:right-[18%] md:top-[18%] md:translate-x-0"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2B6BEE]/40 bg-[#2B6BEE]/10 text-[#2B6BEE]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[1rem] font-semibold leading-none text-white md:text-[1.05rem]">Plano free</div>
                  <div className="mt-1 text-[0.72rem] font-medium leading-none text-emerald-300">infrastudio.pro</div>
                </div>
              </button>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] md:hidden" />
            </div>
          </div>

          <div className="mt-5 flex justify-center md:hidden">
            <button
              type="button"
              onClick={onLoginClick}
              className="inline-flex items-center gap-3 rounded-[1rem] border border-emerald-400/45 bg-[#07101f]/88 px-4 py-3 text-left shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_0_42px_rgba(16,185,129,0.08)] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2B6BEE]/40 bg-[#2B6BEE]/10 text-[#2B6BEE]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[1rem] font-semibold leading-none text-white">Plano free</div>
                <div className="mt-1 text-[0.72rem] font-medium leading-none text-emerald-300">infrastudio.pro</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function PlanFeature({ children }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300">
        <CheckCircle2 size={11} strokeWidth={3} />
      </span>
      {children}
    </li>
  )
}

function getPlanPresentation(plan) {
  if (plan.isFree) {
    return {
      frameClassName: 'border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]',
      nameClassName: 'text-emerald-400',
      buttonClassName:
        'border border-emerald-400/30 bg-emerald-500/14 text-emerald-700 shadow-[0_14px_28px_-20px_rgba(16,185,129,0.85)] hover:border-emerald-300/40 hover:bg-emerald-500/18 dark:text-emerald-100',
      hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_34px_rgba(16,185,129,0.2)]',
    }
  }

  if (plan.featured) {
    return {
      frameClassName: '',
      nameClassName: 'text-gradient',
      buttonClassName:
        'border border-cyan-300/35 bg-cyan-400/12 text-cyan-700 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_28px_rgba(34,211,238,0.16)] hover:border-cyan-200/50 hover:bg-cyan-400/18 dark:text-cyan-50',
      hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_0_40px_rgba(59,130,246,0.22),0_0_80px_rgba(250,204,21,0.12)]',
    }
  }

  return {
    frameClassName: 'border-zinc-800',
    nameClassName: 'text-blue-600 dark:text-blue-300',
    buttonClassName:
      'border border-slate-200/90 bg-white/90 text-slate-800 shadow-[0_18px_38px_-32px_rgba(71,104,145,0.34)] hover:border-cyan-400/25 hover:bg-cyan-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white',
    hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_28px_rgba(34,211,238,0.12)]',
  }
}

function buildPlanFeatures(plan) {
  return [
    formatCredits(plan.totalTokens),
    plan.isFree ? 'Disponível no primeiro projeto do cadastro' : 'Assinatura mensal via Mercado Pago',
    plan.featured ? 'Plano mais usado na operação' : 'Troca vinculada ao projeto selecionado',
  ]
}

function PricingSection({ plans = [], onPlanSelect }) {
  const visiblePlans = Array.isArray(plans)
    ? plans.filter((plan) => String(plan?.name || '').trim().toLowerCase() !== 'scale')
    : []

  return (
    <section id="planos" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Escolha um plano e inicie seu projeto.</h2>
          <p className="mx-auto mt-4 max-w-3xl leading-relaxed text-slate-600 dark:text-zinc-400">
            O plano free fica restrito ao primeiro projeto criado no cadastro.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {visiblePlans.map((plan) => {
            const presentation = getPlanPresentation(plan)
            const features = buildPlanFeatures(plan)
            const ctaLabel = plan.isFree ? 'Iniciar agora' : 'Assinar'

            return (
            <div key={plan.id || plan.name} className="relative h-full">
              <div
                className={cn(
                  'home-pricing-card h-full rounded-[1.6rem] border transition-all duration-300 hover:-translate-y-1',
                  presentation.hoverGlowClassName,
                  plan.featured ? 'plan-card-pro border-transparent p-[2px]' : presentation.frameClassName,
                )}
              >
                {plan.featured ? (
                  <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs text-white shadow-[0_10px_24px_rgba(37,99,235,0.32)]">
                    MAIS USADO
                  </span>
                ) : null}

                <div className="flex h-full flex-col rounded-[1.45rem] bg-[rgba(10,18,38,0.78)] p-6 text-left">
                  <span className={cn('font-bold', presentation.nameClassName)}>{plan.name}</span>
                  <h3 className="mt-2 text-2xl font-bold text-white">
                    {formatPlanPrice(plan.monthlyPrice, plan.isFree)}
                    <span className="text-sm text-slate-400">/mês</span>
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {plan.description || formatCredits(plan.totalTokens)}
                  </p>

                  <ul className="mt-6 space-y-3 text-sm text-slate-200">
                    {features.map((feature) => (
                      <PlanFeature key={feature}>{feature}</PlanFeature>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      onClick={() => onPlanSelect?.(plan)}
                      disabled={!plan.isFree && !plan.checkoutUrl}
                      className={cn(
                        'w-full rounded-xl px-4 py-3 font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
                        presentation.buttonClassName,
                      )}
                    >
                      {ctaLabel}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>

      </div>
    </section>
  )
}

function AboutSection({ onLoginClick }) {
  const sectionVisualRef = useRef(null)
  const sectionVisible = useInView(sectionVisualRef, { once: true, amount: 0.45 })

  return (
    <section id="sobre" className="py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <div ref={sectionVisualRef} className="flex justify-center lg:justify-start">
          <motion.div
            initial={{ opacity: 0 }}
            animate={sectionVisible ? { opacity: 1 } : undefined}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="relative flex h-[250px] w-[250px] items-center justify-center sm:h-[290px] sm:w-[290px]"
          >
            <LogoCubo3D
              animado
              entrada
              ativo={sectionVisible}
              tamanho={220}
              velocidade={0.11}
              className="relative z-10 h-full w-full"
            />
          </motion.div>
        </div>

        <div className="text-left">
          
          <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-white md:text-[2.65rem]">
            <span className="text-gradient">Tecnologia</span> que resolve de verdade
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-base leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
            <p>
              A InfraStudio resolve um problema comum como empresas que perdem tempo e vendas
              com atendimento manual ou algo mais complexo entre uma integracao ou sistemas completos.
            </p>
            <p>
              Temos mais de 18 anos de experiência, focado em criar sistemas, 
              integrações e automações que funcionam na prática.
            </p>
            <p>
              Ao longo do tempo, diversos sistemas foram desenvolvidos e colocados em uso,
              sendo utilizados no dia a dia para atendimento, organização de processos e apoio
              direto nas operações.
            </p>
            <p>
              O que você está vendo aqui é reflexo desse trabalho com soluções que já estão
              rodando, sendo usadas e evoluindo continuamente.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-sm font-medium text-cyan-700 dark:text-cyan-200 sm:text-base">
              Comece no plano free e veja a automação funcionando no seu projeto.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onLoginClick}
                className="inline-flex items-center gap-2 rounded-full border border-blue-300/70 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_0_28px_rgba(37,99,235,0.32)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-500 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.24),0_0_40px_rgba(37,99,235,0.42)] dark:border-cyan-300/50 dark:bg-blue-500 dark:text-white dark:shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_0_34px_rgba(59,130,246,0.4)]"
              >
                <Sparkles size={16} className="text-cyan-100" />
                Plano free
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage({ currentUser = null, plans = [] }) {
  const searchParams = useSearchParams()
  const selectedProjectId =
    searchParams.get('projeto') || searchParams.get('projectId') || currentUser?.currentProjectId || ''
  const authNotice = searchParams.get('auth_notice')
  const authNoticeMessage =
    authNotice === 'email_verified'
      ? 'Email confirmado. Você já pode entrar.'
      : authNotice === 'email_expired'
        ? 'Seu link de confirmação expirou. Reenvie a confirmação.'
        : authNotice === 'email_already_verified'
          ? 'Este email já foi confirmado. Você já pode entrar.'
          : authNotice === 'email_invalid'
            ? 'Link de confirmação inválido. Reenvie a confirmação.'
            : authNotice === 'social_oauth_error'
              ? 'Não foi possível concluir o login social. Verifique a configuração e tente novamente.'
              : ''
  const [loginOpen, setLoginOpen] = useState(Boolean(authNoticeMessage))

  useEffect(() => {
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'

    return () => {
      document.documentElement.style.scrollBehavior = previousBehavior
    }
  }, [])

  useEffect(() => {
    function handleOpenFreePlan() {
      window.dispatchEvent(new CustomEvent('infrastudio-chat:close'))
      setLoginOpen(true)
    }

    window.addEventListener('infrastudio-home:open-free-plan', handleOpenFreePlan)
    return () => {
      window.removeEventListener('infrastudio-home:open-free-plan', handleOpenFreePlan)
    }
  }, [])

  function handleHeroChannelClick(item) {
    if (typeof window === 'undefined') {
      setLoginOpen(true)
      return
    }

    window.dispatchEvent(
      new CustomEvent('infrastudio-chat:home-cta', {
        detail: {
          ctaKey: item.key,
          promptMessage: item.promptMessage,
        },
      }),
    )
  }

  async function openCheckout(plan) {
    if (typeof window === 'undefined') {
      return
    }

    if (!currentUser) {
      setLoginOpen(true)
      return
    }

    if (!selectedProjectId) {
      window.location.href = currentUser?.role === 'admin' ? '/admin/projetos' : '/app/projetos'
      return
    }

    const payload = buildBillingIntentPayload(plan, selectedProjectId)
    if (!payload) {
      return
    }

    await startBillingCheckout(payload, { source: 'public_home' })
  }

  return (
    <div className="home-shell home-theme-root min-h-screen bg-grid">
      <HomeNavbar currentUser={currentUser} onLoginClick={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} initialNotice={authNoticeMessage} />
      <section className="home-hero-light relative overflow-hidden pb-20 pt-32 md:pb-32 md:pt-48">
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-300/70 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-600 dark:border-blue-500/20 dark:text-blue-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Tecnologia de ponta e automação inteligente
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-slate-800 dark:text-white md:text-7xl md:font-semibold"
          >
            Crie um atendente com IA <br className="hidden md:block" /> e coloque ele{' '}
            <span className="text-gradient">onde quiser</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12 flex flex-wrap items-center justify-center gap-3"
          >
            {HERO_CHANNEL_BUTTONS.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleHeroChannelClick(item)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-1 hover:brightness-110',
                    item.className,
                  )}
                >
                  <Icon size={16} className={item.iconClassName} />
                  {item.label}
                </button>
              )
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="mb-12 flex justify-center"
          >
            <LogoCubo3D montarAoEntrar animado tamanho={112} velocidade={0.12} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/70 bg-white px-8 py-4 font-semibold text-slate-800 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.18),0_0_0_1px_rgba(52,211,153,0.18),0_0_30px_rgba(16,185,129,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.2),0_0_0_1px_rgba(52,211,153,0.24),0_0_44px_rgba(16,185,129,0.24)] dark:rounded-xl dark:border-emerald-400/35 dark:bg-[#0d1834] dark:text-emerald-100 dark:shadow-[0_18px_40px_-24px_rgba(8,145,178,0.22),0_0_0_1px_rgba(52,211,153,0.18),0_0_38px_rgba(16,185,129,0.2)] dark:hover:border-emerald-300/45 dark:hover:bg-[#102044]"
            >
              <Sparkles size={18} className="animate-pulse text-emerald-500 dark:text-emerald-200" />
              Comece agora no plano gratuito! 
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-24"
          >
            <div className="mx-auto max-w-6xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
              <div className="tech-marquee flex w-max items-center gap-3 py-4">
                {[...TECH_STACK, ...TECH_STACK].map((tech, index) => (
                  <span
                    key={`${tech}-${index}`}
                    className="rounded-full border border-slate-200/90 bg-white/72 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500 shadow-[0_18px_38px_-32px_rgba(71,104,145,0.28)] transition-all duration-300 hover:border-blue-500/35 hover:bg-blue-500/10 hover:text-blue-600 dark:border-white/10 dark:bg-[#0c142a] dark:text-slate-300 dark:hover:border-cyan-400/30 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-200"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <HomeChannelsShowcaseSection
        onChannelClick={handleHeroChannelClick}
        onLoginClick={() => setLoginOpen(true)}
      />

      <PricingSection plans={plans} onPlanSelect={openCheckout} />

      <section id="como-funciona" className="relative overflow-hidden py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-20 lg:flex-row">
            <div className="lg:w-1/2">
              <h2 className="mb-8 text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-900 dark:text-slate-50 md:text-[2.8rem]">
                Veja um atendente funcionando
              </h2>
              <p className="mb-10 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Veja na prática como o atendimento responde com rapidez, mantém contexto e segue no canal certo.
              </p>
              <div className="space-y-6">
                {DEMO_FEATURES.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-[0.9rem] border border-sky-400/25 bg-[#07101f]/84 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-colors hover:border-sky-400/40 dark:border-sky-400/25 dark:bg-[#07101f]/84"
                  >
                    <div className="rounded-full border border-sky-400/30 bg-sky-500/10 p-2 text-sky-300">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="mb-1 text-sm font-semibold text-slate-100">{item.title}</h4>
                      <p className="text-sm text-slate-300">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex w-full justify-center lg:w-1/2 lg:justify-end">
              <PremiumHomeChatDemo />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 py-24 dark:border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-12 lg:grid-cols-4">
            {BENEFIT_ITEMS.map((item) => (
              <div key={item.title} className="group text-center">
                <div className="mb-6 flex justify-center text-blue-500 transition-transform group-hover:scale-110">
                  <item.icon size={40} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">{item.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="servicos" className="home-panel-soft py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 text-center">
            <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-50 md:text-[2.35rem]">
              Soluções técnicas
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Para conectar, automatizar e expandir a operação quando você precisar ir além do atendimento.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {SERVICE_ITEMS.map((item) => (
              <ServiceCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <AboutSection onLoginClick={() => setLoginOpen(true)} />

      <footer id="contato" className="home-footer-surface relative z-10 border-t py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
            <div className="max-w-sm">
              <Link href="/" className="mb-6 flex items-center gap-2">
                <LogoCubo3D velocidade={0.16} animado tamanho={50} />
                <span className={`${conthrax.className} font-brand-conthrax text-[1rem] leading-none`}>
                  <span className="text-slate-900 dark:text-white/80">infra</span>
                  <span className="text-[#2B6BEE]">studio</span>
                </span>
              </Link>
              <p className="text-sm leading-relaxed text-slate-500">
                Tecnologia sob medida para acelerar negócios com inteligência e automação.
              </p>
            </div>

            <div className="grid gap-12 md:grid-cols-3 md:gap-16">
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white">Soluções</span>
                <nav className="flex flex-col gap-3">
                  {FOOTER_SOLUTION_LINKS.map((link) => (
                    <a
                      key={link}
                      href="#servicos"
                      className="text-sm text-slate-500 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {link}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white">Contato</span>
                <address className="not-italic">
                  <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Telefone
                        </div>
                        <a
                          href={`https://wa.me/${WHATSAPP_NUMBER}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-300"
                        >
                          +55 11 9 4950 6267
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Endereço
                        </div>
                        <div className="mt-1 text-slate-700 dark:text-slate-300">
                          Estrada de São Francisco, Taboão da Serra - São Paulo, SP
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Horário de funcionamento
                        </div>
                        <div className="mt-1 text-slate-700 dark:text-slate-300">
                          Aberto 24 horas por dia, 7 dias por semana
                        </div>
                      </div>
                    </div>
                  </div>
                </address>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white">Empresa</span>
                <nav className="flex flex-col gap-3">
                  {FOOTER_COMPANY_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {link.label}
                    </a>
                  ))}
                  <Link
                    href="/politica-de-privacidade"
                    className="text-sm text-slate-500 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Política de Privacidade
                  </Link>
                </nav>
              </div>
            </div>
          </div>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-slate-200/80 pt-8 text-xs font-medium text-slate-500 md:flex-row dark:border-white/5 dark:text-slate-600">
            <p>{`© ${new Date().getFullYear()} InfraStudio. Todos os direitos reservados.`}</p>
            <div className="flex items-center gap-2">
              Desenvolvido com carinho pela InfraSudio.
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
