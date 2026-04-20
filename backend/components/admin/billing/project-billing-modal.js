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
    return { label: 'Aguardando confirmacao', tone: 'text-amber-100 border-amber-400/20 bg-amber-500/10' }
  }

  if (summary.billingBlocked && !summary.planId) {
    return { label: 'Sem plano', tone: 'text-rose-100 border-rose-400/20 bg-rose-500/10' }
  }

  if (summary.billingBlocked) {
    return { label: 'Bloqueado', tone: 'text-rose-100 border-rose-400/20 bg-rose-500/10' }
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
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Creditos</div>
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

export function ProjectBillingModal({ open, onOpenChange, summary }) {
  const [plans, setPlans] = useState([])
  const [topUpOffer, setTopUpOffer] = useState(null)
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
        setTopUpOffer(payload?.topUpOffer || null)
      } else {
        setFeedback('Nao foi possivel carregar os planos.')
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
    const freeRemainingTokens = Math.max(0, Number(freePlan.totalTokens) - usedTokens)
    return formatCredits(freeRemainingTokens)
  }, [freePlan?.totalTokens, summary?.isFree, summary?.remainingLabel, summary?.usedTokens])

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
      setFeedback(result.error || 'Nao foi possivel iniciar o checkout.')
      return
    }

    setFeedback('Checkout aberto em nova aba. O projeto fica aguardando confirmacao final do pagamento.')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[740px] overflow-y-auto border-l border-white/10 bg-[#080e1d] p-0 text-slate-300 shadow-[-10px_0_22px_rgba(2,6,23,0.34)]">
        <SheetTitle className="sr-only">Meu Plano</SheetTitle>
        <SheetDescription className="sr-only">Plano atual, upgrade e recarga de creditos do projeto.</SheetDescription>

        <div className="border-b border-white/5 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meu plano</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{summary?.projectName || 'Projeto atual'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Troque o plano ou compre mais creditos sem depender do admin. A liberacao final acontece quando o pagamento for confirmado.
              </p>
            </div>

            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusMeta.tone)}>
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Plano atual</div>
              <div className="mt-1 text-sm font-semibold text-white">{summary?.planName || (summary?.isFree ? 'Free' : 'Sem plano')}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Mensal restante</div>
              <div className="mt-1 text-sm font-semibold text-white">{remainingLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Renovacao</div>
              <div className="mt-1 text-sm font-semibold text-white">{summary?.cycleResetLabel || 'Ciclo mensal'}</div>
            </div>
          </div>

          {summary?.blockedReason ? (
            <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {summary.blockedReason}
            </div>
          ) : null}

          {summary?.subscriptionStatus === 'aguardando_confirmacao' ? (
            <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Existe um upgrade em confirmacao para este projeto. O webhook vai concluir a ativacao quando o Mercado Pago enviar a notificacao.
            </div>
          ) : null}
        </div>

        <div className="px-6 py-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">Planos</h3>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando planos reais do banco...
            </div>
          ) : (
            <div className="grid gap-4">
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

          {topUpOffer ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-amber-300" />
                    <h3 className="text-lg font-semibold text-white">Comprar mais creditos</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {`${formatCredits(topUpOffer.tokens)} por ${formatPlanPrice(topUpOffer.price)}`}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => handleCheckout({ ...topUpOffer, type: 'topup' })}
                  disabled={actionKey === 'topup'}
                  className="h-11 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 text-sm font-semibold text-amber-50 hover:bg-amber-500/15"
                >
                  {actionKey === 'topup' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
                  Comprar mais creditos
                </Button>
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
