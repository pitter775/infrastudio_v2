"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { CheckCircle2, Clock3 } from "lucide-react"
import { useSearchParams } from "next/navigation"

import {
  BILLING_INTENT_STORAGE_KEY,
  TEST_TOP_UP_OFFER,
  formatCredits,
  normalizePlanKey,
} from "@/lib/public-planos"

function readStoredIntent() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(BILLING_INTENT_STORAGE_KEY)
    return rawValue ? JSON.parse(rawValue) : null
  } catch {
    return null
  }
}

function formatPlanLabel(value) {
  const planKey = normalizePlanKey(value)

  if (planKey === "plus") {
    return "Plus"
  }

  if (planKey === "basic") {
    return "Basic"
  }

  if (planKey === "pro") {
    return "Pro"
  }

  if (planKey === "free") {
    return "Free"
  }

  if (planKey === "scale") {
    return "Scale"
  }

  return value || "Plano"
}

function PagamentoSucessoContent() {
  const searchParams = useSearchParams()
  const [storedIntent] = useState(() => readStoredIntent())
  const [confirmationStatus, setConfirmationStatus] = useState("idle")
  const [confirmationMessage, setConfirmationMessage] = useState("")

  const paymentType = searchParams.get("tipo") || storedIntent?.type || "plan"
  const planName = searchParams.get("plano") || storedIntent?.planName || ""
  const topUpTokens = Number(searchParams.get("tokens") || storedIntent?.tokens || TEST_TOP_UP_OFFER.tokens)
  const topUpPrice = Number(searchParams.get("valor") || storedIntent?.price || TEST_TOP_UP_OFFER.price)
  const paymentStatus = String(
    searchParams.get("status") || searchParams.get("collection_status") || "",
  ).toLowerCase()
  const isPendingPayment = paymentStatus === "pending" || paymentStatus === "in_process"

  useEffect(() => {
    async function ensurePendingCheckout() {
      if (!storedIntent?.projectId || confirmationStatus !== "idle") {
        return
      }

      if (storedIntent?.registeredAt) {
        setConfirmationStatus("success")
        setConfirmationMessage(
          storedIntent.type === "topup"
            ? "A recarga ficou registrada para este projeto e agora aguarda confirmação final."
            : "A troca de plano ficou registrada para este projeto e agora aguarda confirmação final.",
        )
        return
      }

      setConfirmationStatus("loading")

      const response = await fetch(`/api/app/projetos/${storedIntent.projectId}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storedIntent),
      }).catch(() => null)

      const payload = await response?.json().catch(() => ({}))

      if (!response?.ok) {
        setConfirmationStatus("error")
        setConfirmationMessage(payload?.error || "Não foi possível registrar o retorno do pagamento.")
        return
      }

      window.localStorage.removeItem(BILLING_INTENT_STORAGE_KEY)
      setConfirmationStatus("success")
      setConfirmationMessage(
        storedIntent.type === "topup"
          ? "A recarga ficou vinculada ao projeto e agora aguarda confirmação final."
          : "A troca de plano ficou vinculada ao projeto e agora aguarda confirmação final.",
      )
    }

    ensurePendingCheckout()
  }, [confirmationStatus, storedIntent])

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
          <Clock3 className="h-3.5 w-3.5" />
          {isPendingPayment ? "Pagamento em análise" : "Pagamento recebido"}
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          Estamos confirmando seu pagamento
        </h1>

        <p className="mt-4 text-base leading-7 text-slate-300">
          {paymentType === "topup"
            ? "A recarga não troca o plano atual. Quando o Mercado Pago confirmar, os créditos entram como saldo extra no mesmo projeto e valem por 1 mês."
            : "A troca de plano só é aplicada quando o Mercado Pago confirmar oficialmente o pagamento."}
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/60 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div className="space-y-2 text-sm text-slate-300">
              {paymentType === "topup" ? (
                <>
                  <p className="font-semibold text-white">Recarga identificada</p>
                  <p>{`${formatCredits(topUpTokens)} por R$ ${topUpPrice.toFixed(2).replace(".", ",")}`}</p>
                  <p className="text-slate-400">O plano do projeto continua o mesmo. Os créditos extras são consumidos primeiro e valem por 1 mês.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-white">Plano identificado</p>
                  <p>{formatPlanLabel(planName)}</p>
                </>
              )}
              <p className="text-slate-400">
                Esta rota já deixa o retorno preparado para o fluxo definitivo de webhook e confirmação no backend.
              </p>
              {confirmationMessage ? (
                <p className={confirmationStatus === "error" ? "text-rose-300" : "text-emerald-300"}>
                  {confirmationMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/15"
          >
            Voltar para a home
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Ir para o app
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function PagamentoSucessoPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <PagamentoSucessoContent />
    </Suspense>
  )
}
