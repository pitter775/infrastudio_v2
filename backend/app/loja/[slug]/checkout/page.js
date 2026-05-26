import { notFound } from "next/navigation"

import { StoreCheckoutForm } from "@/components/store/store-checkout-form"
import { StoreHeader } from "@/components/store/store-header"
import { StoreFooter } from "@/components/store/store-footer"
import { getPublicMercadoLivreProductPage } from "@/lib/mercado-livre-store"

export default async function StoreCheckoutPage({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams
  const productSlug = query?.produto || query?.product || ""

  if (!productSlug) {
    notFound()
  }

  const result = await getPublicMercadoLivreProductPage(slug, productSlug, { forceLiveDetails: true })
  if (!result.store || !result.product || result.store.checkout?.enabled !== true) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <StoreHeader store={result.store} activeSection="produtos" />
      <main className="pt-[72px]">
        <StoreCheckoutForm store={result.store} product={result.product} />
      </main>
      <StoreFooter store={result.store} />
    </div>
  )
}
