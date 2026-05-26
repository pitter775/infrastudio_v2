import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock3 } from "lucide-react"

import { formatStoreCurrency } from "@/components/store/store-utils"
import { getPublicStoreOrder } from "@/lib/store-checkout"

function getStatusLabel(order) {
  if (order.paymentStatus === "aprovado") {
    return "Pagamento aprovado"
  }

  if (order.paymentStatus === "em_analise") {
    return "Pagamento em análise"
  }

  return "Aguardando confirmação"
}

export default async function StorePaymentSuccessPage({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams
  const publicId = query?.pedido || query?.order || ""

  if (!publicId) {
    notFound()
  }

  const result = await getPublicStoreOrder(slug, publicId)
  if (!result.order) {
    notFound()
  }

  const approved = result.order.paymentStatus === "aprovado"

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-[8px] border border-slate-200 bg-white p-6 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.32)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
          {approved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}
          {getStatusLabel(result.order)}
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Pedido recebido</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A loja {result.store.nome} recebeu seu pedido. A confirmação final depende da notificação do Mercado Pago.
        </p>

        <div className="mt-6 rounded-[8px] border border-slate-200 p-4">
          <div className="flex flex-wrap justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pedido</div>
              <div className="mt-1 font-semibold">{result.order.publicId}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total</div>
              <div className="mt-1 font-semibold">{formatStoreCurrency(result.order.totalAmount, result.order.currencyId)}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {result.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0 truncate">{item.titulo}</span>
                <span className="shrink-0 font-semibold">{formatStoreCurrency(item.total_price, item.currency_id)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/loja/${result.store.slug}`} className="inline-flex h-11 items-center justify-center rounded-[6px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:border-slate-300">
            Voltar para a loja
          </Link>
        </div>
      </div>
    </main>
  )
}
