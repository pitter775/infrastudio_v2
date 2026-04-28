import { buildStoreProductRef } from "./sanitize"

const STORE_BASE_URL = "https://www.infrastudio.pro"

function buildStoreProductPath(store, product) {
  return `/loja/${store.slug}/produto/${buildStoreProductRef(product?.itemId || product?.id, product?.slug || product?.title)}`
}

function buildStoreBaseUrl(store) {
  if (store?.customDomainActive === true && store?.customDomain) {
    return `https://${store.customDomain}`
  }

  return STORE_BASE_URL
}

function buildAbsoluteStoreUrl(pathname, store = null) {
  const baseUrl = buildStoreBaseUrl(store)
  const normalizedPath = String(pathname || "").trim()
  if (!normalizedPath) {
    return baseUrl
  }

  return `${baseUrl}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`
}

function buildStoreMetadata(store, options = {}) {
  if (!store) {
    return {
      title: "Loja",
      alternates: {
        canonical: buildAbsoluteStoreUrl("/loja"),
      },
    }
  }

  const query = String(options.query || "").trim()
  const categoryLabel = String(options.categoryLabel || "").trim()
  const canonicalPath = categoryLabel
    ? `/loja/${store.slug}?cat=${encodeURIComponent(String(options.categoryId || "").trim())}`
    : `/loja/${store.slug}`
  const canonical = buildAbsoluteStoreUrl(canonicalPath, store)
  const ogImage = buildAbsoluteStoreUrl(`/loja/${store.slug}/opengraph-image`, store)
  const baseDescription =
    String(store.headline || "").trim() ||
    `Conheca ${store.name} e veja os produtos com atendimento direto pelo chat.`
  const description = categoryLabel
    ? `Veja produtos de ${categoryLabel} em ${store.name}. Atendimento direto pelo chat e compra final no Mercado Livre.`
    : query
      ? `Resultados de busca por ${query} em ${store.name}. Atendimento direto pelo chat e compra final no Mercado Livre.`
      : baseDescription
  const title = categoryLabel
    ? `${categoryLabel} | ${store.name}`
    : query
      ? `${query} | ${store.name}`
      : store.name

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: query
      ? {
          index: false,
          follow: true,
        }
      : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: store.name,
      type: "website",
      images: ogImage ? [{ url: ogImage, alt: store.name }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  }
}

function buildStoreProductMetadata(store, product) {
  if (!store || !product) {
    return {
      title: "Produto",
    }
  }

  const canonical = buildAbsoluteStoreUrl(buildStoreProductPath(store, product), store)
  const description = `Veja preco e detalhes de ${product.title}. Atendimento direto pelo chat.`
  const ogImage = product.thumbnail || store.logoUrl || null

  return {
    title: `${product.title} | ${store.name}`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${product.title} | ${store.name}`,
      description,
      url: canonical,
      siteName: store.name,
      type: "website",
      images: ogImage ? [{ url: ogImage, alt: product.title }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: `${product.title} | ${store.name}`,
      description,
      images: ogImage ? [ogImage] : [],
    },
  }
}

function buildStoreStructuredData(store) {
  if (!store) {
    return null
  }

  const sameAs = Object.values(store.socialLinks || {}).filter(Boolean)

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: store.headline || store.about || "",
    url: buildAbsoluteStoreUrl(`/loja/${store.slug}`, store),
    image: store.logoUrl || undefined,
    telephone: store.contactPhone || store.contactWhatsApp || undefined,
    email: store.contactEmail || undefined,
    address: store.contactAddress || undefined,
    sameAs,
  }
}

function buildStoreCollectionStructuredData(store, products = [], options = {}) {
  if (!store) {
    return null
  }

  const categoryLabel = String(options.categoryLabel || "").trim()
  const categoryId = String(options.categoryId || "").trim()
  const query = String(options.query || "").trim()
  const canonicalPath = categoryLabel && categoryId
    ? `/loja/${store.slug}?cat=${encodeURIComponent(categoryId)}`
    : `/loja/${store.slug}`

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: categoryLabel ? `${store.name} - ${categoryLabel}` : store.name,
    description: categoryLabel
      ? `Catalogo de ${categoryLabel} da loja ${store.name}.`
      : query
        ? `Resultados de busca por ${query} na loja ${store.name}.`
        : store.headline || store.about || "",
    url: buildAbsoluteStoreUrl(canonicalPath, store),
    isPartOf: {
      "@type": "WebSite",
      name: store.name,
      url: buildAbsoluteStoreUrl(`/loja/${store.slug}`, store),
    },
    about: categoryLabel || undefined,
    mainEntity: products.slice(0, 12).map((product) => ({
      "@type": "Product",
      name: product.title,
      url: buildAbsoluteStoreUrl(buildStoreProductPath(store, product), store),
      image: product.thumbnail || undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: product.currencyId || "BRL",
        price: Number(product.price || 0),
        availability:
          typeof product.stock === "number" && product.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    })),
  }
}

function buildBreadcrumbStructuredData(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return null
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

function buildProductStructuredData(store, product) {
  if (!store || !product) {
    return null
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.thumbnail ? [product.thumbnail] : [],
    category: product.categoryId || undefined,
    url: buildAbsoluteStoreUrl(buildStoreProductPath(store, product), store),
    offers: {
      "@type": "Offer",
      priceCurrency: product.currencyId || "BRL",
      price: Number(product.price || 0),
      availability:
        typeof product.stock === "number" && product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: product.permalink || buildAbsoluteStoreUrl(buildStoreProductPath(store, product), store),
    },
    brand: {
      "@type": "Brand",
      name: store.name,
    },
  }
}

export {
  STORE_BASE_URL,
  buildAbsoluteStoreUrl,
  buildBreadcrumbStructuredData,
  buildStoreProductPath,
  buildProductStructuredData,
  buildStoreCollectionStructuredData,
  buildStoreMetadata,
  buildStoreProductMetadata,
  buildStoreStructuredData,
}
