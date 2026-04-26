import { notFound } from "next/navigation"

import { MercadoLivreStorefront } from "@/components/store/mercado-livre-storefront"
import { StoreChatWidgetLoader } from "@/components/store/store-chat-widget-loader"
import { getPublicMercadoLivreStoreBySlug } from "@/lib/mercado-livre-store"
import {
  buildBreadcrumbStructuredData,
  buildStoreCollectionStructuredData,
  buildStoreMetadata,
  buildStoreStructuredData,
} from "@/lib/mercado-livre-store-core/seo"

export const revalidate = 300

function normalizeVisibleCategoryLabel(value) {
  const label = String(value || "").trim()
  return /^MLB\d+$/i.test(label) ? "" : label
}

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const query = String(resolvedSearchParams?.q || "").trim()
  const categoryId = String(resolvedSearchParams?.cat || "").trim()
  const sort = String(resolvedSearchParams?.sort || "recent").trim() || "recent"
  const result = await getPublicMercadoLivreStoreBySlug(slug, { page: 1, categoryId, sort })
  const categoryLabel = normalizeVisibleCategoryLabel(
    Array.isArray(result.filters?.categories)
      ? result.filters.categories.find((item) => item.id === categoryId)?.label || ""
      : ""
  )

  return buildStoreMetadata(result.store, { query, categoryId, categoryLabel })
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
    console.warn("[mercado-livre-store] public storefront returned notFound", result.diagnostic || { slug })
    notFound()
  }

  const widgetConfig = result.store.widget
    ? {
        widgetId: result.store.widget.id,
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
  const structuredData = buildStoreStructuredData(result.store)
  const activeCategoryLabel = normalizeVisibleCategoryLabel(
    Array.isArray(result.filters?.categories)
      ? result.filters.categories.find((item) => item.id === (result.filters?.categoryId || categoryId))?.label || ""
      : ""
  )
  const collectionStructuredData = buildStoreCollectionStructuredData(result.store, result.products, {
    query,
    categoryId: result.filters?.categoryId || categoryId,
    categoryLabel: activeCategoryLabel,
  })
  const breadcrumbStructuredData = buildBreadcrumbStructuredData([
    { name: "InfraStudio", url: "https://www.infrastudio.pro" },
    { name: result.store.name, url: `https://www.infrastudio.pro/loja/${result.store.slug}` },
  ])

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
      {collectionStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionStructuredData) }}
        />
      ) : null}
      {breadcrumbStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
        />
      ) : null}
      <MercadoLivreStorefront
        store={result.store}
        featuredProducts={result.featuredProducts}
        products={result.products}
        query={query}
        page={page}
        hasMore={Boolean(result.paging?.hasMore)}
        categoryId={result.filters?.categoryId || categoryId}
        categoryLabel={activeCategoryLabel}
        sort={result.filters?.sort || sort}
        categories={Array.isArray(result.filters?.categories) ? result.filters.categories : []}
      />
      <StoreChatWidgetLoader config={widgetConfig} />
    </>
  )
}
