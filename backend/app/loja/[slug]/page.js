import { notFound } from "next/navigation"

import { MercadoLivreStorefront } from "@/components/store/mercado-livre-storefront"
import { StoreChatWidgetLoader } from "@/components/store/store-chat-widget-loader"
import { getPublicMercadoLivreStoreBySlug } from "@/lib/mercado-livre-store"

export const revalidate = 300

export async function generateMetadata({ params }) {
  const { slug } = await params
  const result = await getPublicMercadoLivreStoreBySlug(slug, { page: 1 })
  if (!result.store) {
    return {
      title: "Loja | InfraStudio",
    }
  }

  return {
    title: `${result.store.name} | Loja InfraStudio`,
    description: result.store.headline,
  }
}

export default async function LojaPage({ params, searchParams }) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const query = String(resolvedSearchParams?.q || "").trim()
  const page = Math.max(Number(resolvedSearchParams?.page || 1) || 1, 1)
  const categoryId = String(resolvedSearchParams?.cat || "").trim()
  const sort = String(resolvedSearchParams?.sort || "recent").trim() || "recent"

  const result = await getPublicMercadoLivreStoreBySlug(slug, {
    searchTerm: query,
    page,
    categoryId,
    sort,
  })

  if (!result.store) {
    notFound()
  }

  const widgetConfig = result.store.widget
    ? {
        widget: result.store.widget.slug,
        projeto: result.store.widget.projectId,
        agente: result.store.widget.agentId || undefined,
        title: result.store.widget.title,
        theme: 'light',
        accent: result.store.widget.accent || result.store.accentColor,
        transparent: false,
        src: '/chat-widget.js',
      }
    : null

  return (
    <>
      <MercadoLivreStorefront
        store={result.store}
        featuredProducts={result.featuredProducts}
        products={result.products}
        query={query}
        page={page}
        hasMore={Boolean(result.paging?.hasMore)}
        categoryId={result.filters?.categoryId || categoryId}
        sort={result.filters?.sort || sort}
        categories={Array.isArray(result.filters?.categories) ? result.filters.categories : []}
      />
      <StoreChatWidgetLoader config={widgetConfig} />
    </>
  )
}
