'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LayoutGrid,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Phone,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PremiumHomeChatDemo } from '@/components/home/chat-demo'
import { LoginModal } from '@/components/home/login-modal'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  BENEFIT_ITEMS,
  DEMO_FEATURES,
  FOOTER_COMPANY_LINKS,
  FOOTER_SOLUTION_LINKS,
  NICHE_ITEMS,
  SERVICE_ITEMS,
  TECH_STACK,
  WHATSAPP_NUMBER,
} from '@/components/home/data'
import { signOutProjectAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

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
  const userMenuRef = useRef(null)

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
    <nav className="fixed top-0 z-[90] w-full border-b border-white/5 bg-slate-950/88 py-4 shadow-[0_12px_50px_rgba(2,6,23,0.42)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden p-1">
            <img src="/logo.png" alt="InfraStudio" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="block font-bold tracking-tight text-white">InfraStudio</span>
          </div>
        </Link>

        <div className="hidden items-center space-x-3 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                <Icon size={15} className="text-slate-500" />
                {item.label}
              </a>
            )
          })}

          {currentUser ? (
            <div ref={userMenuRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setUserMenuOpen((value) => !value)}
                className="relative inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-2 pr-3 text-sm font-medium text-slate-200 transition-all hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-white"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <UserAvatar
                  src={projectLoading ? '' : currentUser?.avatarUrl}
                  label={displayName}
                  className="h-7 w-7 bg-gradient-to-br from-cyan-400 to-blue-500 text-[11px]"
                  fallbackClassName={projectLoading ? 'hidden' : undefined}
                />
                {projectLoading ? (
                  <Loader2
                    size={12}
                    className="absolute left-4 top-1/2 -translate-y-1/2 animate-spin text-cyan-100"
                  />
                ) : null}
                <span className="max-w-[140px] truncate text-left">{displayName}</span>
                <ChevronDown
                  size={16}
                  className={cn('text-slate-400 transition-transform', userMenuOpen && 'rotate-180')}
                />
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-72 rounded-3xl border border-slate-700/80 bg-slate-950 p-3 shadow-[0_28px_80px_rgba(2,6,23,0.82)] backdrop-blur-xl">
                  <div className="mb-2 border-b border-white/10 px-2 pb-3">
                    <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {currentUser?.email || 'Sessão ativa'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleProjectsOpen}
                      disabled={projectLoading}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/10"
                    >
                      {projectLoading ? (
                        <Loader2 size={16} className="animate-spin text-cyan-200" />
                      ) : (
                        <LayoutGrid size={16} className="text-cyan-200" />
                      )}
                      Entrar em projetos
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:border-rose-400/25 hover:bg-rose-500/10"
                    >
                      <LogOut size={16} className="text-rose-300" />
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
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-all hover:border-cyan-300/35 hover:bg-cyan-500/16 hover:text-white"
            >
              Entrar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 transition-all hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:text-white md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {mobileOpen ? (
        <div className="mx-4 mt-4 rounded-[28px] border border-white/10 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl md:hidden">
          <div className="space-y-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100"
              >
                <item.icon size={16} className="text-cyan-200" />
                {item.label}
              </a>
            ))}

            {currentUser ? (
              <>
                <div className="mb-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <UserAvatar
                    src={projectLoading ? '' : currentUser?.avatarUrl}
                    label={displayName}
                    className="h-8 w-8 bg-gradient-to-br from-cyan-400 to-blue-500"
                    fallbackClassName={projectLoading ? 'hidden' : undefined}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {currentUser?.email || 'Sessão ativa'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleProjectsOpen}
                  disabled={projectLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/10"
                >
                  {projectLoading ? (
                    <Loader2 size={16} className="animate-spin text-cyan-200" />
                  ) : (
                    <LayoutGrid size={16} className="text-cyan-200" />
                  )}
                  Entrar em projetos
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-rose-400/25 hover:bg-rose-500/10"
                >
                  <LogOut size={16} className="text-rose-300" />
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
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-cyan-400/25 hover:bg-cyan-500/10"
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
      <div className="glass-effect relative min-h-[340px] h-full rounded-[1.65rem] border border-white/10 px-10 py-10 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white/20">
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-transform duration-300 group-hover:scale-110">
          <Icon size={24} />
        </div>
        <h3 className="mb-4 text-[1.55rem] font-semibold text-slate-100/88">{title}</h3>
        <p className="text-base leading-relaxed text-slate-400">{description}</p>
      </div>
    </motion.div>
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

function PricingSection({ onPlanSelect }) {
  const plans = [
    {
      name: 'Free',
      price: 'R$ 0',
      description: 'Ideal para testar',
      cta: 'Testar grátis',
      features: ['até 10.000 créditos de IA', 'site e WhatsApp no mesmo fluxo', 'upgrade quando quiser'],
      frameClassName: 'border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]',
      nameClassName: 'text-emerald-400',
      buttonClassName:
        'border border-emerald-400/30 bg-emerald-500/14 text-emerald-100 shadow-[0_14px_28px_-20px_rgba(16,185,129,0.85)] hover:border-emerald-300/40 hover:bg-emerald-500/18 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_26px_rgba(16,185,129,0.26)]',
      hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_34px_rgba(16,185,129,0.2)]',
    },
    {
      name: 'Starter',
      price: 'R$ 29,90',
      description: 'Ideal para começar',
      cta: 'Começar agora',
      features: ['até 50.000 créditos de IA', 'operação inicial com atendimento real', 'integrações liberadas'],
      frameClassName: 'border-zinc-800',
      nameClassName: 'text-emerald-400',
      buttonClassName:
        'border border-white/10 bg-white/[0.04] text-white hover:border-cyan-400/25 hover:bg-cyan-500/10 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.1),0_0_22px_rgba(34,211,238,0.14)]',
      hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_0_28px_rgba(34,211,238,0.12)]',
    },
    {
      name: 'Pro',
      price: 'R$ 79,90',
      description: 'Melhor custo-benefício',
      cta: 'Começar agora',
      featured: true,
      features: ['até 200.000 créditos de IA', 'mais volume para atendimento', 'melhor custo para operação ativa', 'crescimento sem trocar a estrutura'],
      nameClassName: 'text-gradient',
      buttonClassName:
        'border border-cyan-300/35 bg-cyan-400/12 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_28px_rgba(34,211,238,0.16),0_0_60px_rgba(59,130,246,0.14)] hover:border-cyan-200/50 hover:bg-cyan-400/18 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_0_30px_rgba(59,130,246,0.2),0_0_70px_rgba(34,211,238,0.18)]',
      hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_0_40px_rgba(59,130,246,0.22),0_0_80px_rgba(250,204,21,0.12)]',
    },
    {
      name: 'Business',
      price: 'R$ 149,90',
      description: 'Escalando',
      cta: 'Começar agora',
      features: ['uso ilimitado com sua chave de API', 'consulta do gasto de tokens por uso', 'mais espaço para integrações', 'mais folga operacional para escalar'],
      frameClassName: 'border-blue-500/45 shadow-[0_0_0_1px_rgba(59,130,246,0.14)]',
      nameClassName: 'text-blue-300',
      buttonClassName:
        'border border-white/10 bg-white/[0.04] text-white hover:border-blue-400/30 hover:bg-blue-500/10 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_0_24px_rgba(59,130,246,0.16)]',
      hoverGlowClassName: 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.14),0_0_30px_rgba(59,130,246,0.16)]',
    },
  ]

  return (
    <section id="planos" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Você cria quantos projetos quiser</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-zinc-400">
            Cada projeto pode ter o próprio plano, de acordo com o volume e a fase da sua operação.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className="relative h-full">
              <div
                className={cn(
                  'h-full rounded-[1.6rem] border bg-brand-dark transition-all duration-300 hover:scale-[1.03]',
                  plan.hoverGlowClassName,
                  plan.featured ? 'plan-card-pro border-transparent p-[2px]' : plan.frameClassName,
                )}
              >
                {plan.featured ? (
                  <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs text-white shadow-[0_10px_24px_rgba(37,99,235,0.32)]">
                    MAIS USADO
                  </span>
                ) : null}

                <div className={cn('flex h-full flex-col rounded-[1.45rem] p-6 text-left', plan.featured ? 'bg-brand-dark' : null)}>
                  <span className={cn('font-bold', plan.nameClassName)}>{plan.name}</span>
                  <h3 className="mt-2 text-2xl font-bold text-white">
                    {plan.price}
                    <span className="text-sm text-zinc-400">/mês</span>
                  </h3>
                  <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>

                  <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                    {plan.features.map((feature) => (
                      <PlanFeature key={feature}>{feature}</PlanFeature>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      onClick={() => onPlanSelect?.(plan)}
                      className={cn(
                        'w-full rounded-xl px-4 py-2.5 font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.99]',
                        plan.buttonClassName,
                      )}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-14 text-center font-semibold text-slate-400">
          Soluções adaptadas para diferentes nichos de mercado.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {NICHE_ITEMS.map((item) => (
            <div
              key={item.label}
              className="group cursor-default rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center transition-all hover:border-blue-500/25 hover:bg-blue-500/10"
            >
              <div className="mb-4 flex justify-center text-slate-400 transition-colors group-hover:text-blue-400">
                <item.icon size={32} strokeWidth={1.5} />
              </div>
              <h4 className="text-sm font-medium text-slate-100/88">{item.label}</h4>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutSection({ onLoginClick }) {
  return (
    <section id="sobre" className="py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <div className="flex justify-center lg:justify-start">
          <div className="group relative">
            <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-emerald-400/25 blur-2xl" />
            <div className="relative rounded-full border border-white/10 bg-slate-950/80 p-2 shadow-lg">
              <img
                src="/Pitter Rocha Bico.jpg"
                alt="Pitter Rocha"
                className="h-48 w-48 rounded-full object-cover transition-transform duration-300 group-hover:scale-105 sm:h-56 sm:w-56"
              />
            </div>
          </div>
        </div>

        <div className="text-left">
          <img src="/logo.png" alt="InfraStudio" className="mb-5 h-10 w-10 object-contain opacity-90" />
          <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-white md:text-[2.65rem]">
            <span className="text-gradient">Tecnologia</span> que resolve de verdade
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-base leading-8 text-slate-300 md:text-lg">
            <p>
              A InfraStudio resolve um problema comum: empresas que perdem tempo e vendas
              com atendimento manual.
            </p>
            <p>
              Por trás está Pitter Rocha, desenvolvedor com mais de 18 anos de experiência,
              focado em criar sistemas, integrações e automações que funcionam na prática.
            </p>
            <p>
              Ao longo do tempo, diversos sistemas foram desenvolvidos e colocados em uso,
              sendo utilizados no dia a dia para atendimento, organização de processos e apoio
              direto nas operações.
            </p>
            <p>
              O que você está vendo aqui é reflexo desse trabalho: soluções que já estão
              rodando, sendo usadas e evoluindo continuamente.
            </p>
            <p>
              A proposta é simples: automatizar o que é repetitivo, organizar o atendimento
              e ajudar empresas a crescer com mais controle e menos esforço.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-sm font-medium text-cyan-200 sm:text-base">
              Comece testando grátis ou fale direto com a gente no WhatsApp.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onLoginClick}
                className="rounded-full border border-cyan-400/30 bg-cyan-500/12 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition-all hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-500/18"
              >
                Testar grátis
              </button>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition-all hover:-translate-y-0.5 hover:border-emerald-300/35 hover:bg-emerald-500/16"
              >
                <MessageSquare size={16} />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage({ currentUser = null }) {
  const [loginOpen, setLoginOpen] = useState(false)
  const searchParams = useSearchParams()
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

  useEffect(() => {
    if (authNoticeMessage) {
      setLoginOpen(true)
    }
  }, [authNoticeMessage])

  useEffect(() => {
    const previousBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'

    return () => {
      document.documentElement.style.scrollBehavior = previousBehavior
    }
  }, [])

  return (
    <div className="home-shell min-h-screen bg-grid bg-[#040816] text-slate-100">
      <HomeNavbar currentUser={currentUser} onLoginClick={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} initialNotice={authNoticeMessage} />
      <section className="relative overflow-hidden pb-20 pt-32 md:pb-32 md:pt-48">
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-7xl -translate-x-1/2">
          <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400"
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
            className="mb-8 text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-white md:text-7xl md:font-semibold"
          >
            Crie um atendente com IA <br className="hidden md:block" /> e coloque ele{' '}
            <span className="text-gradient">onde quiser</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-12 max-w-3xl text-lg leading-relaxed text-slate-400 md:text-xl"
          >
            Agentes no WhatsApp, Instagram, site e conectados aos seus sistemas via API.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/12 px-8 py-4 font-medium text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_28px_rgba(34,211,238,0.22),0_0_60px_rgba(59,130,246,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/50 hover:bg-cyan-400/18"
            >
              <Sparkles size={18} className="animate-pulse text-cyan-200" />
              Veja funcionando no Plano Free
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
                    className="rounded-full border border-white/5 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400 transition-all duration-300 hover:border-blue-500/35 hover:bg-blue-500/10 hover:text-blue-300"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="como-funciona" className="relative overflow-hidden py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-20 lg:flex-row">
            <div className="lg:w-1/2">
              <h2 className="mb-8 text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-100/88 md:text-[2.8rem]">
                Veja um atendente funcionando
              </h2>
              <p className="mb-10 text-lg leading-relaxed text-slate-400">
                Veja na prática como o atendimento responde com rapidez, mantém contexto e segue no canal certo.
              </p>
              <div className="space-y-6">
                {DEMO_FEATURES.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-blue-500/30"
                  >
                    <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="mb-1 font-medium text-slate-100/88">{item.title}</h4>
                      <p className="text-sm text-slate-400">{item.desc}</p>
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

      <section className="border-y border-white/5 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-12 lg:grid-cols-4">
            {BENEFIT_ITEMS.map((item) => (
              <div key={item.title} className="group text-center">
                <div className="mb-6 flex justify-center text-blue-500 transition-transform group-hover:scale-110">
                  <item.icon size={40} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-100/88">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="servicos" className="bg-slate-900/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 text-center">
            <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-slate-100/88 md:text-[2.35rem]">
              Soluções técnicas
            </h2>
            <p className="text-slate-400">
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

      <PricingSection onPlanSelect={() => setLoginOpen(true)} />
      <AboutSection onLoginClick={() => setLoginOpen(true)} />

      <footer id="contato" className="relative z-10 border-t border-white/5 bg-brand-dark py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
            <div className="max-w-sm">
              <Link href="/" className="mb-6 flex items-center gap-2">
                <img src="/logo.png" alt="InfraStudio" className="h-8 w-8 object-contain" />
                <span className="text-xl font-bold tracking-tight text-white">InfraStudio</span>
              </Link>
              <p className="text-sm leading-relaxed text-slate-500">
                Tecnologia sob medida para acelerar negócios brasileiros com inteligência e automação.
              </p>
            </div>

            <div className="grid gap-12 md:grid-cols-3 md:gap-16">
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-white">Soluções</span>
                <nav className="flex flex-col gap-3">
                  {FOOTER_SOLUTION_LINKS.map((link) => (
                    <a
                      key={link}
                      href="#servicos"
                      className="text-sm text-slate-500 transition-colors hover:text-blue-400"
                    >
                      {link}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-white">Contato</span>
                <address className="not-italic">
                  <div className="space-y-4 text-sm text-slate-400">
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
                          className="mt-1 block text-slate-300 transition-colors hover:text-cyan-300 hover:underline"
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
                        <div className="mt-1 text-slate-300">
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
                        <div className="mt-1 text-slate-300">
                          Aberto 24 horas por dia, 7 dias por semana
                        </div>
                      </div>
                    </div>
                  </div>
                </address>
              </div>
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-white">Empresa</span>
                <nav className="flex flex-col gap-3">
                  {FOOTER_COMPANY_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors hover:text-blue-400"
                    >
                      {link.label}
                    </a>
                  ))}
                  <Link
                    href="/politica-de-privacidade"
                    className="text-sm text-slate-500 transition-colors hover:text-blue-400"
                  >
                    Política de Privacidade
                  </Link>
                </nav>
              </div>
            </div>
          </div>

          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 text-xs font-medium text-slate-600 md:flex-row">
            <p>{`© ${new Date().getFullYear()} InfraStudio. Todos os direitos reservados.`}</p>
            <div className="flex items-center gap-2">
              Desenvolvido para gerar produtividade.
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}



