const STORE_BASE_URL = "https://www.infrastudio.pro"

function buildAbsoluteStoreUrl(pathname) {
  const normalizedPath = String(pathname || "").trim()
  if (!normalizedPath) {
    return STORE_BASE_URL
  }

  return `${STORE_BASE_URL}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`
}

function buildStoreMetadata(store, options = {}) {
  if (!store) {
    return {
      title: "Loja | InfraStudio",
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
  const canonical = buildAbsoluteStoreUrl(canonicalPath)
  const ogImage = store.logoUrl || null
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
      : `${store.name} | Loja InfraStudio`

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
      siteName: "InfraStudio",
      type: "website",
      images: ogImage ? [{ url: ogImage, alt: store.name }] : [],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  }
}

function buildStoreProductMetadata(store, product) {
  if (!store || !product) {
    return {
      title: "Produto | Loja InfraStudio",
    }
  }

  const canonical = buildAbsoluteStoreUrl(`/loja/${store.slug}/produto/${product.slug}`)
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
      siteName: "InfraStudio",
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
    url: buildAbsoluteStoreUrl(`/loja/${store.slug}`),
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
    url: buildAbsoluteStoreUrl(canonicalPath),
    isPartOf: {
      "@type": "WebSite",
      name: "InfraStudio",
      url: STORE_BASE_URL,
    },
    about: categoryLabel || undefined,
    mainEntity: products.slice(0, 12).map((product) => ({
      "@type": "Product",
      name: product.title,
      url: buildAbsoluteStoreUrl(`/loja/${store.slug}/produto/${product.slug}`),
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
    url: buildAbsoluteStoreUrl(`/loja/${store.slug}/produto/${product.slug}`),
    offers: {
      "@type": "Offer",
      priceCurrency: product.currencyId || "BRL",
      price: Number(product.price || 0),
      availability:
        typeof product.stock === "number" && product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: product.permalink || buildAbsoluteStoreUrl(`/loja/${store.slug}/produto/${product.slug}`),
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
  buildProductStructuredData,
  buildStoreCollectionStructuredData,
  buildStoreMetadata,
  buildStoreProductMetadata,
  buildStoreStructuredData,
}
