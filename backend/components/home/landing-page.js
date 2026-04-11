'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpenText,
  BriefcaseBusiness,
  CheckCircle2,
  Menu,
  MessageCircle,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PremiumHomeChatDemo } from '@/components/home/chat-demo'
import { LoginModal } from '@/components/home/login-modal'
import {
  BENEFIT_ITEMS,
  DEMO_FEATURES,
  FOOTER_COMPANY_LINKS,
  FOOTER_SOLUTION_LINKS,
  NICHE_ITEMS,
  SERVICE_ITEMS,
  TECH_STACK,
  USE_CASE_ITEMS,
  WHATSAPP_NUMBER,
} from '@/components/home/data'
import { cn } from '@/lib/utils'

function HomeNavbar({ onLoginClick }) {
  const navItems = useMemo(
    () => [
      { href: '#planos', label: 'Planos', icon: Sparkles },
      { href: '#servicos', label: 'Servi\u00e7os', icon: Sparkles },
      { href: '#como-funciona', label: 'Como funciona', icon: BriefcaseBusiness },
      { href: '#contato', label: 'Contato', icon: BookOpenText },
    ],
    [],
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-slate-950/82 py-4 shadow-[0_12px_50px_rgba(2,6,23,0.42)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden p-1">
            <img src="/logo.png" alt="InfraStudio Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="block text-2xl font-bold tracking-tight text-white">InfraStudio</span>
            <span className="hidden text-xs uppercase tracking-[0.11em] text-slate-500 sm:block">
              Smart Systems Lab
            </span>
          </div>
        </Link>

        <div className="hidden items-center space-x-3 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-blue-300"
              >
                <Icon size={15} className="text-slate-500" />
                {item.label}
              </a>
            )
          })}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="infra-click-pulse inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400"
          >
            <MessageCircle size={15} />
            {'Solicitar or\u00e7amento'}
          </a>
          <button
            type="button"
            onClick={onLoginClick}
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white lg:inline-flex"
          >
            Entrar
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] p-2.5 text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white md:hidden"
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
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-50"
            >
              <MessageCircle size={16} />
              {'Solicitar or\u00e7amento'}
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false)
                onLoginClick()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Entrar
            </button>
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
      className="glass-effect group rounded-2xl p-8 transition-all duration-300 hover:border-blue-500/50"
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-transform duration-300 group-hover:scale-110">
        <Icon size={24} />
      </div>
      <h3 className="mb-3 text-xl font-semibold text-slate-100/88">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
    </motion.div>
  )
}

function UseCaseCard({
  icon: Icon,
  title,
  description,
  salesPitch,
  delay,
  backgroundImage,
  backgroundPosition,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="group relative min-h-[520px] overflow-hidden rounded-[28px] bg-transparent transition-all duration-300 ease-out hover:-translate-y-1"
    >
      <div
        className="absolute inset-0 scale-[1.06] bg-cover bg-no-repeat blur-[2px] saturate-[0.96] transition-all duration-500 ease-out group-hover:scale-[1.1] group-hover:brightness-110"
        style={{ backgroundImage: `url(${backgroundImage})`, backgroundPosition }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between p-7">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/18 text-[#f8fafc] backdrop-blur-xl transition-transform duration-300 group-hover:scale-[1.04]">
          <Icon size={24} />
        </div>

        <div className="max-w-[18rem] rounded-3xl bg-black/12 p-5 backdrop-blur-xl">
          <h3 className="mb-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.04em] text-white">
            {title}
          </h3>
          <p className="text-sm leading-7 text-white/92">{description}</p>
          <p className="mt-4 text-sm font-medium leading-6 text-white">{salesPitch}</p>
        </div>
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

function PricingSection() {
  const plans = [
    {
      name: 'Free',
      price: 'R$ 0',
      description: 'Ideal para testar',
      cta: 'Testar gr\u00e1tis',
      features: ['at\u00e9 10.000 cr\u00e9ditos de IA', 'site e WhatsApp no mesmo fluxo', 'upgrade quando quiser'],
    },
    {
      name: 'Starter',
      price: 'R$ 29,90',
      description: 'Ideal para come\u00e7ar',
      cta: 'Come\u00e7ar agora',
      features: ['at\u00e9 50.000 cr\u00e9ditos de IA', 'opera\u00e7\u00e3o inicial com atendimento real', 'integra\u00e7\u00f5es liberadas'],
    },
    {
      name: 'Pro',
      price: 'R$ 79,90',
      description: 'Melhor custo-benef\u00edcio',
      cta: 'Come\u00e7ar agora',
      featured: true,
      features: ['at\u00e9 200.000 cr\u00e9ditos de IA', 'mais volume para atendimento', 'crescimento sem trocar estrutura'],
    },
    {
      name: 'Business',
      price: 'R$ 149,90',
      description: 'Escalando',
      cta: 'Come\u00e7ar agora',
      features: ['at\u00e9 500.000 cr\u00e9ditos de IA', 'mais folga de consumo', 'mais espa\u00e7o para integra\u00e7\u00f5es'],
    },
  ]

  return (
    <section id="planos" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Voc\u00ea cria quantos projetos quiser</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-zinc-400">
            Cada projeto pode ter o pr\u00f3prio plano, de acordo com o volume e a fase da sua opera\u00e7\u00e3o.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'rounded-2xl border bg-brand-dark p-6 text-left',
                plan.featured ? 'border-blue-500/40 shadow-lg shadow-blue-900/20' : 'border-zinc-800',
              )}
            >
              {plan.featured ? (
                <span className="mb-4 inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs text-white">
                  MAIS USADO
                </span>
              ) : null}

              <span className={cn('font-bold', plan.featured ? 'text-gradient' : 'text-emerald-400')}>
                {plan.name}
              </span>
              <h3 className="mt-2 text-2xl font-bold text-white">
                {plan.price}
                <span className="text-sm text-zinc-400">/m\u00eas</span>
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>

              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                {plan.features.map((feature) => (
                  <PlanFeature key={feature}>{feature}</PlanFeature>
                ))}
              </ul>

              <button
                className={cn(
                  'mt-6 w-full rounded-xl py-2 font-semibold text-white transition',
                  plan.featured
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90'
                    : 'bg-zinc-800 hover:bg-zinc-700',
                )}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-14 text-center font-semibold text-slate-400">
          {'Solu\u00e7\u00f5es adaptadas para diferentes nichos de mercado.'}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {NICHE_ITEMS.map((item) => (
            <div
              key={item.label}
              className="group cursor-default rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center transition-all hover:bg-white/[0.05]"
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

export function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <div className="home-shell min-h-screen bg-grid bg-[#040816] text-slate-100">
      <HomeNavbar onLoginClick={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
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
            {'Tecnologia de ponta e automa\u00e7\u00e3o inteligente'}
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
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/12 px-8 py-4 font-medium text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_28px_rgba(34,211,238,0.22),0_0_60px_rgba(59,130,246,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/50 hover:bg-cyan-400/18"
            >
              <Sparkles size={18} className="animate-pulse text-cyan-200" />
              Testar agora sem cadastro
            </Link>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-slate-100 transition-all hover:bg-white/10"
            >
              Falar com especialista
            </a>
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
                {'Veja na pr\u00e1tica como o atendimento responde com rapidez, mant\u00e9m contexto e segue no canal certo.'}
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
      <section id="onde-usar" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-20 text-center">
            <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-slate-100/88 md:text-[2.35rem]">
              {'Onde voc\u00ea pode usar'}
            </h2>
            <p className="text-slate-400">
              {'O mesmo atendente pode trabalhar em canais diferentes sem mudar a opera\u00e7\u00e3o.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            {USE_CASE_ITEMS.map((item) => (
              <UseCaseCard key={item.title} {...item} />
            ))}
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
              {'Solu\u00e7\u00f5es t\u00e9cnicas'}
            </h2>
            <p className="text-slate-400">
              {'Para conectar, automatizar e expandir a opera\u00e7\u00e3o quando voc\u00ea precisar ir al\u00e9m do atendimento.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {SERVICE_ITEMS.map((item) => (
              <ServiceCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>
      <PricingSection />
      <section id="contato" className="px-4 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="glass-effect relative overflow-hidden rounded-[40px] p-12 text-center shadow-2xl md:p-20">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />
            <h2 className="mb-8 text-3xl font-semibold tracking-[-0.04em] text-slate-100/88 md:text-5xl">
              {'Pronto para o pr\u00f3ximo n\u00edvel?'}
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-400 md:text-xl">
              Fale sobre sua ideia e receba uma proposta personalizada sem compromisso.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 rounded-2xl bg-[#25D366] px-10 py-5 text-xl font-semibold text-white shadow-2xl shadow-[#25D366]/20 transition-all hover:scale-105 hover:bg-[#20ba59]"
            >
              <Smartphone size={24} />
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </section>
      <footer className="relative z-10 border-t border-white/5 bg-brand-dark py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
            <div className="max-w-sm">
              <Link href="/" className="mb-6 flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="h-8 w-8 object-contain" />
                <span className="text-xl font-bold tracking-tight text-white">InfraStudio</span>
              </Link>
              <p className="text-sm leading-relaxed text-slate-500">
                {'Tecnologia sob medida para acelerar neg\u00f3cios brasileiros com intelig\u00eancia e automa\u00e7\u00e3o.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-20">
              <div className="flex flex-col gap-4">
                <span className="text-sm font-bold uppercase tracking-widest text-white">{'Solu\u00e7\u00f5es'}</span>
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
                <span className="text-sm font-bold uppercase tracking-widest text-white">Empresa</span>
                <nav className="flex flex-col gap-3">
                  {FOOTER_COMPANY_LINKS.map((link) => (
                    <a
                      key={link}
                      href="#contato"
                      className="text-sm text-slate-500 transition-colors hover:text-blue-400"
                    >
                      {link}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </div>
          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-8 text-xs font-medium text-slate-600 md:flex-row">
            <p>{`\u00a9 ${new Date().getFullYear()} InfraStudio. Todos os direitos reservados.`}</p>
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
