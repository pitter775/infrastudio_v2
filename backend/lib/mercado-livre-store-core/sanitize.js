function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function slugifyProduct(value) {
  return slugify(value)
}

function buildStoreProductRef(itemId, slug) {
  const normalizedItemId = sanitizeText(itemId, 80)
  const normalizedSlug = sanitizeText(slug, 180) || slugifyProduct(slug)

  if (!normalizedItemId) {
    return normalizedSlug
  }

  return normalizedSlug ? `${normalizedItemId}-${normalizedSlug}` : normalizedItemId
}

function parseStoreProductRef(value) {
  const normalized = sanitizeText(value, 260)
  const match = normalized.match(/^(MLB\d+)(?:-(.+))?$/i)

  if (!match) {
    return {
      itemId: "",
      slug: normalized,
      raw: normalized,
    }
  }

  return {
    itemId: sanitizeText(match[1], 80),
    slug: sanitizeText(match[2], 180),
    raw: normalized,
  }
}

function sanitizeText(value, max = 0) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return ""
  }

  return max > 0 ? normalized.slice(0, max) : normalized
}

function normalizeMercadoLivreImageUrl(value) {
  const normalized = sanitizeText(value, 500)
  if (!normalized) {
    return ""
  }

  return normalized.replace(/-([A-Z])(\.(jpg|jpeg|png|webp)(\?.*)?)$/i, "-O$2")
}

function sanitizeColor(value) {
  const normalized = sanitizeText(value, 16)
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(normalized) ? normalized : "#0ea5e9"
}

function sanitizePhone(value) {
  return sanitizeText(value, 32)
}

function sanitizeDomain(value) {
  const normalized = sanitizeText(value, 160)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")

  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : ""
}

function sanitizeMenuLinks(value) {
  const list = Array.isArray(value) ? value : []
  return list
    .map((item) => ({
      label: sanitizeText(item?.label, 40),
      href: sanitizeText(item?.href, 160),
    }))
    .filter((item) => item.label && item.href)
    .slice(0, 6)
}

function sanitizeSocialLinks(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {}
  const allowedKeys = ["instagram", "facebook", "tiktok", "youtube", "x"]
  return allowedKeys.reduce((acc, key) => {
    const nextValue = sanitizeText(source[key], 220)
    if (nextValue) {
      acc[key] = nextValue
    }
    return acc
  }, {})
}

function sanitizeFeaturedProducts(value) {
  const list = Array.isArray(value) ? value : []
  return list
    .map((item, index) => ({
      id: sanitizeText(item?.id, 40),
      title: sanitizeText(item?.title, 160),
      thumbnail: sanitizeText(item?.thumbnail, 500),
      permalink: sanitizeText(item?.permalink, 500),
      price: Number(item?.price ?? 0) || 0,
      currencyId: sanitizeText(item?.currencyId, 12) || "BRL",
      order: Number(item?.order ?? index) || index,
    }))
    .filter((item) => item.id && item.title)
    .sort((left, right) => left.order - right.order)
    .slice(0, 8)
}

function buildDefaultMenu() {
  return [
    { label: "Produtos", href: "#produtos" },
    { label: "Sobre nos", href: "#sobre" },
    { label: "Contato", href: "#contato" },
  ]
}

function normalizeStore(row, project = null) {
  const projectSlug = sanitizeText(project?.slug || "", 80)
  const projectName = sanitizeText(project?.nome || project?.name || "", 120) || "Loja"
  const menuLinks = sanitizeMenuLinks(row?.menu_links)
  const featuredProducts = sanitizeFeaturedProducts(row?.destaques)

  return {
    id: row?.id || null,
    projectId: row?.projeto_id || project?.id || null,
    projectSlug,
    slug: sanitizeText(row?.slug, 80) || `${projectSlug || "loja"}-ml`,
    name: sanitizeText(row?.nome, 120) || projectName,
    title: sanitizeText(row?.titulo, 160) || `Compre com atendimento direto na loja ${projectName}`,
    headline:
      sanitizeText(row?.texto_principal, 600) ||
      "Encontre nossos principais produtos com atendimento direto pelo chat da loja e compra segura pelo Mercado Livre.",
    about:
      sanitizeText(row?.sobre_nos, 1200) ||
      "Somos uma loja conectada ao Mercado Livre com atendimento mais rapido, vitrine atualizada e suporte direto pelo chat.",
    accentColor: sanitizeColor(row?.cor_primaria),
    logoUrl: sanitizeText(row?.logo_url, 500),
    theme: "light",
    active: row?.ativo === true,
    chatWidgetActive: row?.chat_widget_ativo !== false,
    chatWidgetId: row?.chat_widget_id || null,
    chatContextFull: row?.chat_contexto_completo === true,
    contactEmail: sanitizeText(row?.email_contato, 120),
    contactPhone: sanitizePhone(row?.telefone_contato),
    contactWhatsApp: sanitizePhone(row?.whatsapp_contato),
    contactAddress: sanitizeText(row?.endereco, 260),
    customDomain: sanitizeDomain(row?.dominio_personalizado),
    customDomainActive: row?.dominio_ativo === true,
    customDomainStatus: sanitizeText(row?.dominio_status, 32) || "pending",
    customDomainNotes: sanitizeText(row?.dominio_observacoes, 500),
    footerText:
      sanitizeText(row?.footer_texto, 240) ||
      "Loja hospedada pela InfraStudio com atendimento integrado e compra final pelo Mercado Livre.",
    menuLinks: menuLinks.length ? menuLinks : buildDefaultMenu(),
    socialLinks: sanitizeSocialLinks(row?.social_links),
    featuredProducts,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
  }
}

function normalizeSnapshotProduct(row) {
  if (!row) {
    return null
  }

  const title = sanitizeText(row.titulo, 180) || "Produto"
  const images = Array.isArray(row.imagens_json)
    ? row.imagens_json.map((item) => normalizeMercadoLivreImageUrl(item)).filter(Boolean).slice(0, 8)
    : []
  const thumbnail = normalizeMercadoLivreImageUrl(row.thumbnail_url) || images[0] || ""
  return {
    id: row.ml_item_id || row.id || null,
    itemId: row.ml_item_id || row.id || null,
    title,
    slug: sanitizeText(row.slug, 180) || slugifyProduct(title),
    price: Number(row.preco ?? 0) || 0,
    originalPrice: Number(row.preco_original ?? 0) || 0,
    installmentQuantity: Number(row.parcelas_quantidade ?? 0) || 0,
    installmentAmount: Number(row.parcelas_valor ?? 0) || 0,
    installmentRate: Number(row.parcelas_taxa ?? 0) || 0,
    unitPrice: Number(row.preco_por_unidade ?? 0) || 0,
    thumbnail,
    images,
    permalink: sanitizeText(row.permalink, 500),
    status: sanitizeText(row.status, 40),
    stock: Number(row.estoque ?? 0) || 0,
    categoryId: sanitizeText(row.categoria_id, 80),
    categoryLabel: sanitizeText(row.categoria_nome, 160),
    shortDescription: sanitizeText(row.descricao_curta, 2000),
    descriptionLong: sanitizeText(row.descricao_longa, 12000),
    attributes: Array.isArray(row.atributos_json) ? row.atributos_json : [],
    updatedAt: row.updated_at || null,
  }
}

function isStoreProductAvailable(product) {
  const status = sanitizeText(product?.status, 40).toLowerCase()
  const stock = Number(product?.stock ?? product?.estoque ?? 0) || 0

  if (status && status !== "active") {
    return false
  }

  return stock > 0
}

function sortSnapshotProducts(items, sort) {
  const list = Array.isArray(items) ? [...items] : []
  const mode = sanitizeText(sort, 32) || "recent"

  if (mode === "price_asc") {
    return list.sort((left, right) => left.price - right.price)
  }

  if (mode === "price_desc") {
    return list.sort((left, right) => right.price - left.price)
  }

  if (mode === "title") {
    return list.sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""), "pt-BR"))
  }

  return list
}

export {
  buildStoreProductRef,
  buildDefaultMenu,
  normalizeSnapshotProduct,
  normalizeStore,
  parseStoreProductRef,
  isStoreProductAvailable,
  sanitizeColor,
  sanitizeDomain,
  sanitizeFeaturedProducts,
  sanitizeMenuLinks,
  sanitizePhone,
  sanitizeSocialLinks,
  sanitizeText,
  slugify,
  slugifyProduct,
  sortSnapshotProducts,
}
