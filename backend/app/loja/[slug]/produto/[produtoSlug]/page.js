import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Package, ShieldCheck, Tag } from "lucide-react"

import { StoreHeader } from "@/components/store/store-header"
import { StoreProductActions } from "@/components/store/store-product-actions"
import { StoreChatWidgetLoader } from "@/components/store/store-chat-widget-loader"
import { formatStoreCurrency } from "@/components/store/store-utils"
import { getPublicMercadoLivreProductPage } from "@/lib/mercado-livre-store"
import {
  buildAbsoluteStoreUrl,
  buildBreadcrumbStructuredData,
  buildProductStructuredData,
  buildStoreProductMetadata,
} from "@/lib/mercado-livre-store-core/seo"

export const revalidate = 300

export async function generateMetadata({ params }) {
  const { slug, produtoSlug } = await params
  const result = await getPublicMercadoLivreProductPage(slug, produtoSlug)
  return buildStoreProductMetadata(result.store, result.product)
}

export default async function LojaProdutoPage({ params }) {
  const { slug, produtoSlug } = await params
  const result = await getPublicMercadoLivreProductPage(slug, produtoSlug)

  if (!result.store) {
    notFound()
  }

  if (!result.product) {
    notFound()
  }

  const visibleCategoryLabel =
    result.product.categoryLabel && !/^MLB\d+$/i.test(String(result.product.categoryLabel))
      ? result.product.categoryLabel
      : ""
  const productDescription =
    String(result.product.descriptionLong || result.product.shortDescription || "").trim() ||
    "Este produto esta publicado na vitrine da loja com compra final no Mercado Livre."

  const widgetConfig = result.store.widget
    ? {
        widgetId: result.store.widget.id,
        widget: result.store.widget.slug,
        projeto: result.store.widget.projectId,
        agente: result.store.widget.agentId || undefined,
        title: result.store.widget.title,
        theme: "light",
        accent: result.store.widget.accent || result.store.accentColor,
        transparent: false,
        src: "/chat-widget.js",
      }
    : null
  const structuredData = buildProductStructuredData(result.store, result.product)
  const breadcrumbStructuredData = buildBreadcrumbStructuredData([
    { name: "InfraStudio", url: "https://www.infrastudio.pro" },
    { name: result.store.name, url: buildAbsoluteStoreUrl(`/loja/${result.store.slug}`) },
    { name: result.product.title, url: buildAbsoluteStoreUrl(`/loja/${result.store.slug}/produto/${result.product.slug}`) },
  ])

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
      {breadcrumbStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
        />
      ) : null}
      <div className="min-h-screen bg-[#f7f3eb] text-slate-900">
        <StoreHeader store={result.store} activeSection="produtos" headerSolid />
        <main className="pt-[112px] md:pt-[108px]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href={`/loja/${result.store.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar para a loja
          </Link>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <div className="overflow-hidden rounded-[32px] border border-black/5 bg-white p-4 shadow-[0_28px_90px_-44px_rgba(15,23,42,0.42)]">
              <div className="aspect-[4/3] overflow-hidden rounded-[24px] bg-[#efe8da]">
                {result.product.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.product.thumbnail} alt={result.product.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : null}
              </div>
            </div>

            <div className="rounded-[32px] border border-black/5 bg-white p-5 shadow-[0_28px_90px_-44px_rgba(15,23,42,0.42)] sm:p-8">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{result.store.name}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#faf7f0] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                  <Package className="h-3.5 w-3.5" />
                  Produto da loja
                </span>
                {visibleCategoryLabel ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#faf7f0] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                    <Tag className="h-3.5 w-3.5" />
                    {visibleCategoryLabel}
                  </span>
                ) : null}
                {result.product.status ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {result.product.status}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">{result.product.title}</h1>
              <div className="mt-6 text-2xl font-semibold sm:text-3xl" style={{ color: result.store.accentColor }}>
                {formatStoreCurrency(result.product.price, result.product.currencyId)}
              </div>
              {result.product.originalPrice > result.product.price ? (
                <div className="mt-2 text-sm text-slate-500 line-through">
                  {formatStoreCurrency(result.product.originalPrice, result.product.currencyId)}
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 rounded-[24px] border border-black/10 bg-[#faf7f0] px-5 py-4 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4">
                  <span>Compra final</span>
                  <span className="font-medium text-slate-950">Mercado Livre</span>
                </div>
                {visibleCategoryLabel ? (
                  <div className="flex items-center justify-between gap-4">
                    <span>Categoria</span>
                    <span className="font-medium text-slate-950">{visibleCategoryLabel}</span>
                  </div>
                ) : null}
                {typeof result.product.stock === "number" && result.product.stock > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span>Estoque informado</span>
                    <span className="font-medium text-slate-950">{result.product.stock}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-[24px] border border-black/5 bg-[#faf7f0] px-5 py-5 text-sm leading-7 text-slate-700 sm:px-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Descricao completa</div>
                <div className="mt-3 whitespace-pre-line">{productDescription}</div>
              </div>

              {Array.isArray(result.product.attributes) && result.product.attributes.length ? (
                <div className="mt-6 rounded-[24px] border border-black/5 bg-white px-5 py-5 sm:px-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Detalhes do produto</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.product.attributes
                      .filter((attribute) => attribute?.name && attribute?.valueName)
                      .slice(0, 12)
                      .map((attribute) => (
                        <div key={`${attribute.id || attribute.name}-${attribute.valueName}`} className="rounded-[16px] border border-slate-200 bg-[#faf7f0] px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{attribute.name}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">{attribute.valueName}</div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              <StoreProductActions
                accentColor={result.store.accentColor}
                chatDescription="O chat da loja pode ser aberto daqui para continuar o atendimento a partir desta pagina."
                permalink={result.product.permalink}
                product={result.product}
                storeSlug={result.store.slug}
                widgetId={result.store.widget?.id}
                widgetSlug={result.store.widget?.slug}
              />
            </div>
          </div>

          <section className="mt-14">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-slate-950">Outros produtos</h2>
              <Link href={`/loja/${result.store.slug}`} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
                Ver todos
              </Link>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {result.relatedProducts.map((product) => (
                <Link
                  key={product.slug}
                  href={`/loja/${result.store.slug}/produto/${product.slug}`}
                  className="rounded-[24px] border border-black/5 bg-white p-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.42)] transition hover:-translate-y-1"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-[#efe8da]">
                    {product.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="mt-4 line-clamp-2 text-sm font-semibold leading-6 text-slate-950">{product.title}</div>
                  <div className="mt-3 text-base font-semibold" style={{ color: result.store.accentColor }}>
                    {formatStoreCurrency(product.price, product.currencyId)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
        </main>
      </div>
      <StoreChatWidgetLoader config={widgetConfig} />
    </>
  )
}
