'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { buildBillingIntentPayload, startBillingCheckout } from '@/lib/public-billing-client'
import { formatCredits, formatPlanPrice } from '@/lib/public-planos'
import { cn } from '@/lib/utils'

function resolveStatusMeta(summary) {
  if (!summary) {
    return { label: 'Sem contexto', tone: 'text-slate-300 border-white/10 bg-white/[0.04]' }
  }

  if (summary.subscriptionStatus === 'aguardando_confirmacao') {
    return { label: 'Aguardando confirmação', tone: 'text-amber-100 border-amber-400/20 bg-amber-500/10' }
  }

  if (summary?.pendingCheckout) {
    return { label: 'Pagamento em andamento', tone: 'text-cyan-100 border-cyan-400/20 bg-cyan-500/10' }
  }

  if (summary.billingBlocked && !summary.planId) {
    return { label: 'Sem plano', tone: 'text-rose-100 border-rose-400/20 bg-rose-500/10' }
  }

  if (summary.billingBlocked) {
    return { label: 'Bloqueado', tone: 'text-rose-100 border-rose-400/20 bg-rose-500/10' }
  }

  if (Number(summary?.topUpAvailableTokens ?? 0) > 0) {
    return { label: 'Créditos extras ativos', tone: 'text-cyan-100 border-cyan-400/20 bg-cyan-500/10' }
  }

  if (summary.isFree) {
    return { label: 'Free', tone: 'text-emerald-100 border-emerald-400/20 bg-emerald-500/10' }
  }

  return { label: 'Ativo', tone: 'text-cyan-100 border-cyan-400/20 bg-cyan-500/10' }
}

function PlanCard({ plan, currentPlanId, onCheckout, loadingKey }) {
  const isCurrentPlan = currentPlanId && currentPlanId === plan.id

  return (
    <div
      className={cn(
        'rounded-3xl border p-5',
        isCurrentPlan
          ? 'border-2 border-emerald-400/70 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(52,211,153,0.24),0_0_28px_rgba(16,185,129,0.14)]'
          : plan.featured
            ? 'border-cyan-400/25 bg-cyan-500/[0.07]'
            : 'border-white/10 bg-white/[0.03]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            {isCurrentPlan ? (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/16 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-50">
                Plano ativo
              </span>
            ) : null}
            {plan.featured ? (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Mais usado
              </span>
            ) : null}
            {plan.isFree ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Free
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">{plan.description || 'Plano conectado ao billing real.'}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-white">{formatPlanPrice(plan.monthlyPrice, plan.isFree)}</div>
          <div className="text-xs text-slate-500">por mes</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Créditos</div>
          <div className="mt-1 text-sm font-semibold text-white">{formatCredits(plan.totalTokens)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Status</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {isCurrentPlan ? 'Plano atual' : plan.isFree ? 'Somente no cadastro inicial' : 'Disponivel agora'}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {isCurrentPlan ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-50">
            Este e o plano ativo deste projeto.
          </div>
        ) : plan.isFree ? (
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            O free fica restrito ao primeiro projeto criado no cadastro.
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => onCheckout(plan)}
            disabled={loadingKey === plan.id}
            className="h-11 w-full rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/15"
          >
            {loadingKey === plan.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Assinar
          </Button>
        )}
      </div>
    </div>
  )
}

function TopUpCard({ offer, onCheckout, loadingKey }) {
  const isLoading = loadingKey === offer.id
  const hasCheckoutUrl = offer?.type === 'topup' || Boolean(String(offer?.checkoutUrl || "").trim())

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{formatPlanPrice(offer.price)}</h3>
            {offer.featured ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                Recarga
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">+ {formatCredits(offer.tokens)}</p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 text-amber-300" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Tokens</div>
          <div className="mt-1 text-sm font-semibold text-white">{formatCredits(offer.tokens)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Pagamento</div>
          <div className="mt-1 text-sm font-semibold text-white">{hasCheckoutUrl ? 'Disponivel agora' : 'Aguardando link'}</div>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          onClick={() => onCheckout(offer)}
          disabled={isLoading || !hasCheckoutUrl}
          className="h-11 w-full rounded-2xl border border-amber-400/20 bg-amber-500/10 text-sm font-semibold text-amber-50 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
          {hasCheckoutUrl ? 'Comprar mais créditos' : 'Link pendente'}
        </Button>
      </div>
    </div>
  )
}

function resolveBasicTestPlan(plans) {
  const basicPlan = (plans || []).find((plan) => plan?.key === 'basic')

  if (!basicPlan?.id) {
    return null
  }

  return {
    ...basicPlan,
    id: `${basicPlan.id}-test-basic-sheet`,
    name: 'Basic Teste',
    description: 'Assinatura de teste por R$ 1 para validar o fluxo e ativar o plano Basic neste projeto.',
    monthlyPrice: 1,
    checkoutPrice: 1,
    featured: false,
    testMode: 'basic_sheet_test',
  }
}

export function ProjectBillingModal({ open, onOpenChange, summary }) {
  const [plans, setPlans] = useState([])
  const [topUpOffers, setTopUpOffers] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionKey, setActionKey] = useState('')
  const [feedback, setFeedback] = useState('')
  const statusMeta = resolveStatusMeta(summary)

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true

    async function loadPlans() {
      setLoading(true)
      const response = await fetch('/api/planos', { cache: 'no-store' }).catch(() => null)
      const payload = await response?.json().catch(() => ({}))

      if (!active) {
        return
      }

      if (response?.ok) {
        setPlans(payload?.plans || [])
        setTopUpOffers(payload?.topUpOffers || (payload?.topUpOffer ? [payload.topUpOffer] : []))
        setIsAdmin(payload?.isAdmin === true)
      } else {
        setFeedback('Não foi possível carregar os planos.')
      }

      setLoading(false)
    }

    loadPlans()

    return () => {
      active = false
    }
  }, [open])

  const orderedPlans = useMemo(
    () => [...plans].sort((first, second) => Number(first?.monthlyPrice || 0) - Number(second?.monthlyPrice || 0)),
    [plans],
  )
  const basicTestPlan = useMemo(() => (isAdmin ? resolveBasicTestPlan(plans) : null), [isAdmin, plans])
  const freePlan = useMemo(
    () => plans.find((plan) => plan?.isFree) || null,
    [plans],
  )
  const currentPlanId = useMemo(() => {
    if (summary?.planId === 'free') {
      return freePlan?.id || 'free'
    }

    return summary?.planId || ''
  }, [freePlan?.id, summary?.planId])
  const remainingLabel = useMemo(() => {
    if (!summary?.isFree || !freePlan?.totalTokens) {
      return summary?.remainingLabel || 'Sem limite'
    }

    const usedTokens = Number(summary?.usedTokens ?? 0)
    const extraCredits = Number(summary?.topUpAvailableTokens ?? 0)
    const totalFreeCapacity = Math.max(0, Number(freePlan.totalTokens) + extraCredits)
    return formatCredits(Math.max(0, totalFreeCapacity - usedTokens))
  }, [freePlan?.totalTokens, summary?.isFree, summary?.remainingLabel, summary?.topUpAvailableTokens, summary?.usedTokens])
  const extraCreditsLabel = useMemo(() => {
    const extraCredits = Number(summary?.topUpAvailableTokens ?? 0)
    return extraCredits > 0 ? formatCredits(extraCredits) : null
  }, [summary?.topUpAvailableTokens])
  const usedLabel = useMemo(() => formatCredits(Number(summary?.usedTokens ?? 0)), [summary?.usedTokens])
  const usagePercentLabel = useMemo(() => {
    if (summary?.isFree && freePlan?.totalTokens) {
      const usedTokens = Number(summary?.usedTokens ?? 0)
      const extraCredits = Number(summary?.topUpAvailableTokens ?? 0)
      const totalFreeCapacity = Math.max(0, Number(freePlan.totalTokens) + extraCredits)

      if (totalFreeCapacity > 0) {
        return `${Math.round((usedTokens / totalFreeCapacity) * 100)}%`
      }
    }

    if (summary?.usagePercent != null && Number.isFinite(Number(summary.usagePercent))) {
      return `${Math.round(Number(summary.usagePercent))}%`
    }

    const usedTokens = Number(summary?.usedTokens ?? 0)
    const monthlyLimit = Number(summary?.monthlyLimit ?? 0)
    if (monthlyLimit > 0) {
      return `${Math.round((usedTokens / monthlyLimit) * 100)}%`
    }

    return '--'
  }, [freePlan, summary])
  const pendingCheckout = summary?.pendingCheckout || null
  const canResumePendingCheckout = Boolean(pendingCheckout?.checkoutUrl)

  async function handleCheckout(item) {
    if (!summary?.projectId) {
      return
    }

    const intent = buildBillingIntentPayload(item, summary.projectId)
    if (!intent) {
      return
    }

    setFeedback('')
    setActionKey(item.id || item.type || '')
    const result = await startBillingCheckout(intent, { source: 'project_billing_modal' })
    setActionKey('')

    if (!result.ok) {
      setFeedback(result.error || 'Não foi possível iniciar o checkout.')
      return
    }

    setFeedback('Checkout aberto em nova aba. O projeto fica aguardando confirmação final do pagamento.')
  }

  function handleResumePendingCheckout() {
    if (!canResumePendingCheckout || typeof window === 'undefined') {
      return
    }

    window.open(pendingCheckout.checkoutUrl, '_blank', 'noopener,noreferrer')
    setFeedback('Pagamento pendente reaberto em nova aba.')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="z-[250]"
        className="z-[251] w-full max-w-[740px] overflow-y-auto border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-[-10px_0_22px_rgba(2,6,23,0.34)]"
      >
        <SheetTitle className="sr-only">Meu Plano</SheetTitle>
        <SheetDescription className="sr-only">Plano atual, upgrade e recarga de créditos do projeto.</SheetDescription>

        <div className="border-b border-white/5 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meu plano</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{summary?.projectName || 'Projeto atual'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Troque o plano ou compre mais créditos sem depender do admin. A liberação final acontece quando o pagamento for confirmado.
              </p>
            </div>

            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusMeta.tone)}>
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Plano atual</div>
              <div className="mt-1 text-sm font-semibold text-white">{summary?.planName || (summary?.isFree ? 'Free' : 'Sem plano')}</div>
              {extraCreditsLabel ? (
                <div className="mt-1 text-xs text-cyan-200">Mantem o plano e soma {extraCreditsLabel} extras.</div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Consumido</div>
              <div className="mt-1 text-sm font-semibold text-white">{usedLabel}</div>
              <div className="mt-1 text-xs text-slate-500">{usagePercentLabel} do limite</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Mensal restante</div>
              <div className="mt-1 text-sm font-semibold text-white">{remainingLabel}</div>
              {summary?.limitLabel ? <div className="mt-1 text-xs text-slate-500">Limite total atual: {summary.limitLabel}</div> : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{extraCreditsLabel ? 'Créditos extras' : 'Renovação'}</div>
              <div className="mt-1 text-sm font-semibold text-white">{extraCreditsLabel || summary?.cycleResetLabel || 'Ciclo mensal'}</div>
              {extraCreditsLabel ? <div className="mt-1 text-xs text-slate-500">Esses créditos ficam somados ao plano atual.</div> : null}
            </div>
          </div>

          {extraCreditsLabel && !pendingCheckout ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
              O projeto continua no plano <span className="font-semibold text-white">{summary?.planName || 'atual'}</span> e agora tem <span className="font-semibold text-white">{extraCreditsLabel}</span> em créditos extras disponíveis.
            </div>
          ) : null}

          {summary?.blockedReason ? (
            <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {summary.blockedReason}
            </div>
          ) : null}

          {summary?.subscriptionStatus === 'aguardando_confirmacao' ? (
            <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Existe um upgrade em confirmação para este projeto. O webhook vai concluir a ativação quando o Mercado Pago enviar a notificação.
            </div>
          ) : null}

          {pendingCheckout ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-4 text-sm text-cyan-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">
                    {pendingCheckout.type === 'topup' ? 'Pagamento de recarga em andamento' : 'Pagamento de plano em andamento'}
                  </div>
                  <div className="mt-1 text-cyan-100/90">
                    {pendingCheckout.type === 'topup'
                      ? `${formatPlanPrice(pendingCheckout.amount || 0)} por ${formatCredits(pendingCheckout.tokens || 0)}`
                      : pendingCheckout.planName || 'Plano selecionado'}
                  </div>
                  <div className="mt-1 text-cyan-100/70">
                    Se você fechou a aba ou quer conferir o pagamento, pode abrir a mesma cobrança novamente.
                  </div>
                </div>
                {canResumePendingCheckout ? (
                  <Button
                    type="button"
                    onClick={handleResumePendingCheckout}
                    className="h-10 rounded-2xl border border-cyan-300/20 bg-cyan-400/15 px-4 text-sm font-semibold text-white hover:bg-cyan-400/20"
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Abrir pagamento novamente
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-6 py-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">Planos</h3>
          </div>

          {basicTestPlan ? (
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-300" />
                <h3 className="text-lg font-semibold text-white">Teste de assinatura</h3>
              </div>
              <PlanCard
                plan={basicTestPlan}
                currentPlanId=""
                onCheckout={handleCheckout}
                loadingKey={actionKey}
              />
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando planos reais do banco...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {orderedPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPlanId={currentPlanId}
                  onCheckout={handleCheckout}
                  loadingKey={actionKey}
                />
              ))}
            </div>
          )}

          {topUpOffers.length ? (
            <div className="mt-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-300" />
                <h3 className="text-lg font-semibold text-white">Comprar mais créditos</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {topUpOffers.map((offer) => (
                  <TopUpCard
                    key={offer.id || `${offer.price}-${offer.tokens}`}
                    offer={{ ...offer, type: 'topup' }}
                    onCheckout={handleCheckout}
                    loadingKey={actionKey}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {feedback ? (
            <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
              {feedback}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
