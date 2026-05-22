import Link from "next/link"
import Image from "next/image"
import { notFound, permanentRedirect } from "next/navigation"
import { ArrowLeft, ChevronDown, FileText, LayoutGrid, Package, Sparkles, Tag } from "lucide-react"

import { StoreFooter } from "@/components/store/store-footer"
import { StoreHeader } from "@/components/store/store-header"
import { StoreProductActions } from "@/components/store/store-product-actions"
import { StoreChatWidgetLoader } from "@/components/store/store-chat-widget-loader"
import { StoreProductHeroGallery } from "@/components/store/store-product-hero-gallery"
import { StoreRelatedProducts } from "@/components/store/store-related-products"
import { StoreSnapshotRefresh } from "@/components/store/store-snapshot-refresh"
import { StoreProductTopSearch } from "@/components/store/store-product-top-search"
import { buildStoreAccentPalette, buildStoreProductHref, buildStoreUrl, formatStoreCurrency, formatStoreInstallmentText } from "@/components/store/store-utils"
import { getPublicMercadoLivreProductPage } from "@/lib/mercado-livre-store"
import { buildStoreProductRef } from "@/lib/mercado-livre-store-core/sanitize"
import {
  buildAbsoluteStoreUrl,
  buildBreadcrumbStructuredData,
  buildProductStructuredData,
  buildStoreProductPath,
  buildStoreProductMetadata,
} from "@/lib/mercado-livre-store-core/seo"

export const revalidate = 300

const HIDDEN_ATTRIBUTE_NAMES = new Set([
  "syi pymes id",
  "utilizações seguras",
  "utilizações seguras",
  "origem do dado do pacote de fábrica",
  "origem do dado do pacote de fabrica",
  "motivo de gtin vazio",
  "regalavel",
])

function sanitizeAttributeName(value) {
  return String(value || "")
    .replace(/\s*da embalagem do vendedor\s*/gi, "")
    .replace(/\s*da embalagem do vendor\s*/gi, "")
    .replace(/\s*do vendedor\s*/gi, "")
    .replace(/\s*do vendor\s*/gi, "")
    .replace(/\s*da embalagem\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function getVisibleCategoryLabel(product) {
  const label = String(product?.categoryLabel || "").trim()
  return label && !/^MLB\d+$/i.test(label) ? label : ""
}

function normalizeAttributeValue(attribute) {
  if (!attribute || typeof attribute !== "object") {
    return ""
  }

  const directValue = String(
    attribute.valueName ||
      attribute.value_name ||
      attribute.value ||
      attribute.valueLabel ||
      attribute.value_label ||
      "",
  ).trim()
  if (directValue && directValue !== "[object Object]") {
    return directValue
  }

  const valueStruct = attribute.valueStruct || attribute.value_struct
  if (valueStruct && typeof valueStruct === "object") {
    const amount = String(valueStruct.number || valueStruct.amount || "").trim()
    const unit = String(valueStruct.unit || valueStruct.unit_name || "").trim()
    const normalized = [amount, unit].filter(Boolean).join(" ").trim()
    if (normalized && normalized !== "[object Object]") {
      return normalized
    }
  }

  const values = Array.isArray(attribute.values) ? attribute.values : Array.isArray(attribute.value_list) ? attribute.value_list : []
  if (values.length) {
    const normalizedValues = values
      .map((item) => {
        if (item && typeof item === "object") {
          const label = String(
            item.name ||
              item.value_name ||
              item.valueName ||
              item.label ||
              item.value ||
              "",
          ).trim()
          if (label && label !== "[object Object]") {
            return label
          }

          const itemStruct = item.value_struct || item.valueStruct
          if (itemStruct && typeof itemStruct === "object") {
            const amount = String(itemStruct.number || itemStruct.amount || "").trim()
            const unit = String(itemStruct.unit || itemStruct.unit_name || "").trim()
            const normalized = [amount, unit].filter(Boolean).join(" ").trim()
            return normalized !== "[object Object]" ? normalized : ""
          }
        }

        const normalized = String(item || "").trim()
        return normalized !== "[object Object]" ? normalized : ""
      })
      .filter(Boolean)

    if (normalizedValues.length) {
      return normalizedValues.join(", ")
    }
  }

  return ""
}

function getAttributeGroupName(attribute) {
  const directGroup = String(
    attribute?.attributeGroupName ||
      attribute?.attribute_group_name ||
      attribute?.attributeGroup ||
      attribute?.attribute_group ||
      attribute?.groupName ||
      attribute?.group_name ||
      "",
  ).trim()

  if (directGroup) {
    return directGroup
  }

  const normalizedName = String(attribute?.name || attribute?.label || "").toLowerCase()
  if (/(altura|largura|comprimento|profundidade|diametro|di[aâ]metro|peso|volume|capacidade|espessura|medida|tamanho)/i.test(normalizedName)) {
    return "Dimensões"
  }
  if (/(kit|unidade|formato de venda|embalagem|quantidade|pe[çc]as por kit)/i.test(normalizedName)) {
    return "Características de venda"
  }

  return "Detalhes do produto"
}

function groupProductAttributes(attributes = []) {
  const groups = new Map()
  const dedupe = new Set()

  for (const attribute of Array.isArray(attributes) ? attributes : []) {
    const name = sanitizeAttributeName(attribute?.name || attribute?.label || "")
    const value = normalizeAttributeValue(attribute)
    if (!name || !value) continue
    if (HIDDEN_ATTRIBUTE_NAMES.has(name.toLowerCase())) continue

    const normalizedKey = `${name.toLowerCase()}::${value.toLowerCase()}`
    if (dedupe.has(normalizedKey)) {
      continue
    }
    dedupe.add(normalizedKey)

    const groupName = getAttributeGroupName(attribute)

    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }

    groups.get(groupName).push({
      id: attribute?.id || name,
      name,
      value,
    })
  }

  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    items,
  }))
    .sort((left, right) => {
      const order = ["Características principais", "Características de venda", "Dimensões", "Outros", "Detalhes do produto"]
      const leftIndex = order.indexOf(left.title)
      const rightIndex = order.indexOf(right.title)
      const normalizedLeft = leftIndex === -1 ? order.length : leftIndex
      const normalizedRight = rightIndex === -1 ? order.length : rightIndex
      if (normalizedLeft !== normalizedRight) {
        return normalizedLeft - normalizedRight
      }
      return left.title.localeCompare(right.title, "pt-BR")
    })
}

function buildDescriptionBlocks(product) {
  const raw = String(product?.descriptionLong || product?.shortDescription || "").trim()
  if (!raw) {
    return []
  }

  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function buildProductPageBackgroundStyle(hero) {
  const mode = hero?.backgroundMode || "solid"
  const imageMode = hero?.imageMode || "cover"
  const baseBackground =
    mode === "gradient"
      ? `linear-gradient(120deg, ${hero?.gradientFrom || "#ffffff"}, ${hero?.gradientTo || "#f5f5f5"})`
      : hero?.solidColor || "#ffffff"

  return {
    base: {
      background: baseBackground,
    },
    image: hero?.imageUrl
      ? {
          backgroundImage: `url(${hero.imageUrl})`,
          backgroundPosition: "center",
          backgroundRepeat: imageMode === "repeat-x" ? "repeat-x" : "no-repeat",
          backgroundSize: imageMode === "repeat-x" ? "auto max(238px, 100%)" : "cover",
          opacity: Number(hero?.imageOpacity ?? 1),
        }
      : null,
    overlay: {
      backgroundColor: hero?.overlayColor || "#ffffff",
      opacity: Number(hero?.overlayOpacity ?? 0.18),
    },
  }
}

function buildChatProductContext(product, store, categoryLabel = "") {
  if (!product) {
    return null
  }

  const useFullChatContext = store?.chatContextFull === true

  const compactLongDescription = String(product.descriptionLong || product.shortDescription || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, useFullChatContext ? 4000 : 600)

  const normalizedAttributes = Array.isArray(product.attributes)
    ? product.attributes
        .map((attribute) => ({
          id: String(attribute?.id || "").trim(),
          nome: String(attribute?.name || attribute?.label || "").trim(),
          valor: normalizeAttributeValue(attribute),
        }))
        .filter((attribute) => attribute.nome && attribute.valor)
        .slice(0, useFullChatContext ? 40 : 10)
    : []

  const material =
    normalizedAttributes.find((attribute) => /material|linha/i.test(attribute.nome))?.valor || ""
  const cor =
    normalizedAttributes.find((attribute) => /cor|color|estampa|acabamento/i.test(attribute.nome))?.valor || ""
  const variationSummary = Array.isArray(product.variations)
    ? product.variations
        .slice(0, useFullChatContext ? 12 : 4)
        .map((variation) =>
          Array.isArray(variation?.attributeCombinations)
            ? variation.attributeCombinations
                .map((attribute) => String(attribute?.valueName || "").trim())
                .filter(Boolean)
                .join(" / ")
            : ""
        )
        .filter(Boolean)
    : []

  return {
    id: product.id || null,
    itemId: product.itemId || product.id || null,
    slug: product.slug || null,
    nome: product.title || "",
    titulo: product.title || "",
    descricao:
      [
        product.price ? formatStoreCurrency(product.price, product.currencyId) : "",
        typeof product.stock === "number" && product.stock > 0 ? `${product.stock} em estoque` : "",
        categoryLabel || "",
      ].filter(Boolean).join(" - "),
    preco: Number(product.price ?? 0) || 0,
    link: product.permalink || "",
    imagem: product.thumbnail || "",
    imagens: Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, useFullChatContext ? 8 : 3) : [],
    videos: Array.isArray(product.videos) ? product.videos.filter(Boolean).slice(0, useFullChatContext ? 4 : 2) : [],
    videoId: product.videoId || product.videos?.[0]?.id || "",
    availableQuantity: Number(product.stock ?? 0) || 0,
    stock: Number(product.stock ?? 0) || 0,
    status: product.status || "",
    condition: product.condition || "",
    warranty: product.warranty || "",
    freeShipping: product.freeShipping === true,
    material,
    cor,
    atributos: normalizedAttributes,
    variacoesResumo: variationSummary,
    descricaoLonga: compactLongDescription,
    contextoCompleto: useFullChatContext,
    categoriaId: product.categoryId || "",
    categoriaLabel: categoryLabel || product.categoryLabel || "",
    lojaNome: store?.name || "",
    currencyId: product.currencyId || "BRL",
    installmentQuantity: Number(product.installmentQuantity ?? 0) || 0,
    installmentAmount: Number(product.installmentAmount ?? 0) || 0,
    installmentRate: Number(product.installmentRate ?? 0) || 0,
    unitPrice: Number(product.unitPrice ?? 0) || 0,
  }
}

function ProductPurchasePanel({
  result,
  palette,
  visibleCategoryLabel,
  attributeGroups,
  descriptionBlocks,
  installmentText,
  className = "",
}) {
  return (
    <section className={`-mx-5 rounded-none bg-white p-5 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.14)] sm:mx-0 sm:rounded-[8px] sm:p-6 ${className}`}>
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{result.store.name}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {visibleCategoryLabel ? (
          <span className="inline-flex items-center gap-2 rounded-[6px] bg-[#faf7f0] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600 shadow-[0_8px_16px_-14px_rgba(15,23,42,0.12)]">
            <Tag className="h-3.5 w-3.5" />
            {visibleCategoryLabel}
          </span>
        ) : null}
      </div>

      <h1 className="mt-4 hidden text-lg font-semibold leading-tight text-slate-950 sm:block sm:text-xl">
        {result.product.title}
      </h1>

      <div className="mt-4 text-2xl font-semibold sm:text-3xl" style={{ color: palette.accentDark }}>
        {formatStoreCurrency(result.product.price, result.product.currencyId)}
      </div>
      {installmentText ? (
        <div className="mt-2 text-base font-normal text-slate-700 sm:text-lg">{installmentText}</div>
      ) : null}
      {typeof result.product.stock === "number" && result.product.stock > 0 ? (
        <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <Package className="h-4 w-4" style={{ color: palette.accentDark }} aria-hidden="true" />
          <span>Estoque</span>
          <span className="font-semibold text-slate-950">{result.product.stock}</span>
        </div>
      ) : null}
      {Number(result.product.unitPrice ?? 0) > 0 ? (
        <div className="mt-1 text-sm text-slate-500">
          Preço por unidade: {formatStoreCurrency(result.product.unitPrice, result.product.currencyId)}
        </div>
      ) : null}
      {result.product.originalPrice > result.product.price ? (
        <div className="mt-2 text-sm text-slate-500 line-through">
          {formatStoreCurrency(result.product.originalPrice, result.product.currencyId)}
        </div>
      ) : null}

      <StoreProductActions
        accentColor={palette.accentDark}
        chatDescription="O chat da loja pode ser aberto daqui para continuar o atendimento a partir desta pagina com mais contexto do produto."
        permalink={result.product.permalink}
        product={result.product}
        storeSlug={result.store.slug}
        widgetId={result.store.widget?.id}
        widgetSlug={result.store.widget?.slug}
      />

      <div className="mt-6 px-1 py-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo da descrição</div>
        <div className="mt-3 grid gap-3 text-sm leading-7 text-slate-700">
          {(descriptionBlocks.length ? descriptionBlocks : ["Este produto está publicado na vitrine da loja com compra final no Mercado Livre."])
            .slice(0, 3)
            .map((block, index) => (
              <p key={`${index}-${block.slice(0, 20)}`}>{block}</p>
            ))}
        </div>
      </div>
    </section>
  )
}

function MobileProductTitle({ product }) {
  return (
    <h1 className="text-[17px] font-semibold leading-snug text-slate-950 min-[390px]:text-[18px] sm:hidden">{product.title}</h1>
  )
}

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
    const palette = buildStoreAccentPalette(result.store.accentColor)
    const unavailableProduct = result.unavailableProduct || null

    return (
      <>
        <StoreSnapshotRefresh storeSlug={result.store.slug} />
        <div className="min-h-screen bg-[#f7f7f5] text-slate-950">
          <StoreHeader store={result.store} activeSection="produtos" />
          <main className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8">
            <Link href={buildStoreUrl(result.store)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />
              Voltar para a loja
            </Link>

            <section className="mt-8 rounded-[8px] border border-slate-200 bg-white px-5 py-8 shadow-[0_12px_34px_-30px_rgba(15,23,42,0.34)] sm:px-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] text-white" style={{ backgroundColor: palette.accentDark }}>
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Produto indisponível</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                    {unavailableProduct?.title
                      ? `${unavailableProduct.title} não está disponível para compra agora.`
                      : "Este produto não está disponível para compra agora."}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Veja abaixo outras opções da loja que ainda estão ativas.
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-10">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[20px] font-normal leading-tight text-slate-700">Outros produtos</h2>
                <Link href={buildStoreUrl(result.store)} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
                  Ver todos
                </Link>
              </div>
              <StoreRelatedProducts products={result.relatedProducts} store={result.store} storeSlug={result.store.slug} accentColor={result.store.accentColor} />
            </section>
          </main>
          <StoreFooter store={result.store} />
        </div>
      </>
    )
  }

  const canonicalProductRef = buildStoreProductRef(result.product.itemId || result.product.id, result.product.slug || result.product.title)
  if (produtoSlug !== canonicalProductRef) {
    permanentRedirect(buildStoreProductHref(result.store, { slug: canonicalProductRef }))
  }

  const visibleCategoryLabel = getVisibleCategoryLabel(result.product)
  const descriptionBlocks = buildDescriptionBlocks(result.product)
  const attributeGroups = groupProductAttributes(result.product.attributes)
  const palette = buildStoreAccentPalette(result.store.accentColor)
  const heroStyle = buildProductPageBackgroundStyle(result.store.visualConfig?.hero || {})
  const installmentText = formatStoreInstallmentText(result.product)
  const chatProductContext = buildChatProductContext(result.product, result.store, visibleCategoryLabel)
  const widgetConfig = result.store.widget
    ? {
        widgetId: result.store.widget.id,
        widget: result.store.widget.slug,
        projeto: result.store.widget.projectId,
        agente: result.store.widget.agentId || undefined,
        title: result.store.widget.title,
        storeSlug: result.store.slug,
        context: {
          conversation: {
            mode: "product_detail",
            source: "mercado_livre_product_detail",
          },
          storefront: {
            kind: "mercado_livre",
            pageKind: "product_detail",
            storeSlug: result.store.slug,
            productSlug: result.product.slug,
          },
          ui: {
            catalogPreferred: true,
            productDetailPreferred: true,
            chatSessionScope: "navigation",
          },
          focus: chatProductContext
            ? {
                domain: "catalog",
                source: "mercado_livre",
                subject: chatProductContext.nome,
                confidence: 0.96,
              }
            : null,
          catalogo: chatProductContext
            ? {
                ultimaBusca: chatProductContext.nome,
                produtoAtual: chatProductContext,
                ultimosProdutos: [chatProductContext],
              }
            : null,
        },
        theme: "light",
        accent: result.store.widget.accent || result.store.accentColor,
        transparent: false,
        src: "/chat-widget.js",
      }
    : null
  const structuredData = buildProductStructuredData(result.store, result.product)
  const breadcrumbStructuredData = buildBreadcrumbStructuredData([
    { name: "Loja", url: buildAbsoluteStoreUrl(`/loja/${result.store.slug}`, result.store) },
    { name: result.store.name, url: buildAbsoluteStoreUrl(`/loja/${result.store.slug}`, result.store) },
    { name: result.product.title, url: buildAbsoluteStoreUrl(buildStoreProductPath(result.store, result.product), result.store) },
  ])

  return (
    <>
      <StoreSnapshotRefresh storeSlug={result.store.slug} />
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
      <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-900">
        <section className="relative min-h-[130px] overflow-x-clip overflow-y-visible pt-[64px] min-[390px]:min-h-[138px] min-[390px]:pt-[70px]" style={heroStyle.base}>
          {heroStyle.image ? <div className="absolute inset-0" style={heroStyle.image} /> : null}
          <div className="absolute inset-0" style={heroStyle.overlay} />
          <StoreHeader store={result.store} activeSection="produtos" />
          <Link
            href={buildStoreUrl(result.store)}
            className="absolute bottom-[-20px] left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#f8fafc] shadow-[0_12px_26px_-12px_rgba(15,23,42,0.34)] transition hover:scale-105 sm:hidden"
            style={{ color: palette.accentDark }}
            aria-label="Voltar para a loja"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="relative mx-auto flex max-w-7xl min-w-0 items-start justify-between gap-4 px-3 py-3 min-[390px]:px-5 sm:px-7 lg:px-10">
            <div className="hidden flex-1 lg:block" />
            <div className="absolute bottom-[-20px] left-3 right-3 z-20 min-w-0 min-[390px]:left-5 min-[390px]:right-5 sm:left-7 sm:right-7 lg:static lg:right-auto lg:z-auto lg:w-[430px]">
              <StoreProductTopSearch
                accentColor={palette.accentDark}
                store={result.store}
                storeSlug={result.store.slug}
              />
            </div>
          </div>
        </section>

        <main>
          <div className="mx-auto max-w-7xl px-3 pb-8 pt-8 min-[390px]:px-5 sm:px-7 sm:pt-2 lg:px-10">
            <Link
              href={buildStoreUrl(result.store)}
              className="relative z-30 -mt-7 mb-5 hidden h-10 w-10 items-center justify-center rounded-full bg-[#f8fafc] shadow-[0_12px_26px_-12px_rgba(15,23,42,0.34)] transition hover:scale-105 sm:flex"
              style={{ color: palette.accentDark }}
              aria-label="Voltar para a loja"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
              <div className="grid gap-5">
                <MobileProductTitle product={result.product} />
                <StoreProductHeroGallery key={result.product.id || result.product.slug} accentColor={result.store.accentColor} product={result.product} title={result.product.title} />

                <ProductPurchasePanel
                  result={result}
                  palette={palette}
                  visibleCategoryLabel={visibleCategoryLabel}
                  attributeGroups={attributeGroups}
                  descriptionBlocks={descriptionBlocks}
                  installmentText={installmentText}
                  className="lg:hidden"
                />

                {attributeGroups.length ? (
                  <section className="-mx-3 rounded-none bg-white p-3 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.14)] min-[390px]:-mx-5 min-[390px]:p-5 sm:mx-0 sm:rounded-[8px] sm:p-6">
                    <style>{`
                      .store-accordion::details-content {
                        block-size: 0;
                        overflow: hidden;
                        transition: block-size 200ms ease-out, content-visibility 200ms ease-out allow-discrete;
                      }
                      .store-accordion[open]::details-content {
                        block-size: auto;
                      }
                    `}</style>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <LayoutGrid className="h-4 w-4" />
                      Características do produto
                    </div>
                    <div className="mt-5 grid gap-3">
                      {attributeGroups.map((group) => (
                        <details
                          key={group.title}
                          className="store-accordion group rounded-[6px] bg-[#fbf8f2] shadow-[0_10px_18px_-18px_rgba(15,23,42,0.14)]"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-semibold text-slate-950 [&::-webkit-details-marker]:hidden">
                            <span className="flex min-w-0 items-center gap-2">
                              <Sparkles className="h-4 w-4 shrink-0" style={{ color: palette.accentDark }} />
                              <span className="truncate">{group.title}</span>
                            </span>
                            <span className="flex items-center gap-2 text-xs font-medium text-slate-500">
                              {group.items.length}
                              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                            </span>
                          </summary>
                          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-open:grid-rows-[1fr]">
                            <div className="overflow-hidden">
                              <div className="grid gap-2 px-4 pb-4 md:grid-cols-2">
                                {group.items.map((item) => (
                                  <div key={`${group.title}-${item.id}-${item.value}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-[6px] bg-white px-3 py-3 text-sm shadow-[0_8px_16px_-16px_rgba(15,23,42,0.18)]">
                                    <div className="text-slate-500">{item.name}</div>
                                    <div className="font-medium text-slate-950">{item.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </section>
                ) : null}

              </div>

              <div className="hidden gap-5 self-start lg:sticky lg:top-[112px] lg:grid">
                <ProductPurchasePanel
                  result={result}
                  palette={palette}
                  visibleCategoryLabel={visibleCategoryLabel}
                  attributeGroups={attributeGroups}
                  descriptionBlocks={descriptionBlocks}
                  installmentText={installmentText}
                />
              </div>
            </div>

            {descriptionBlocks.length ? (
              <section className="relative -mx-3 mt-6 rounded-none bg-white p-3 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.14)] min-[390px]:-mx-5 min-[390px]:p-5 sm:mx-0 sm:rounded-[8px] sm:p-6">
                {result.store.logoUrl ? (
                  <Image
                    src={result.store.logoUrl}
                    alt={result.store.name}
                    width={96}
                    height={96}
                    unoptimized
                    className="absolute right-4 top-4 hidden h-24 w-24 rounded-[8px] object-contain lg:block"
                  />
                ) : null}
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <FileText className="h-4 w-4" />
                  Descrição completa
                </div>
                <div className="mt-5 grid gap-4 text-[15px] leading-8 text-slate-700">
                  <div className="text-lg font-medium text-slate-950">{result.product.title}</div>
                  {descriptionBlocks.map((block, index) => (
                    <p key={`${index}-${block.slice(0, 24)}`} className="whitespace-pre-line">
                      {block}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-14">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[20px] font-normal leading-tight text-slate-700">Outros produtos</h2>
                <Link href={buildStoreUrl(result.store)} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
                  Ver todos
                </Link>
              </div>

              <StoreRelatedProducts products={result.relatedProducts} store={result.store} storeSlug={result.store.slug} accentColor={result.store.accentColor} />
            </section>
          </div>
        </main>
        <StoreFooter store={result.store} />
      </div>
      <StoreChatWidgetLoader config={widgetConfig} />
    </>
  )
}
