import { searchMercadoLivreProductsForProject } from "@/lib/mercado-livre-connector"
import { resolveRecentCatalogProductReference } from "@/lib/chat/catalog-follow-up"
import { buildProductSearchCandidates, isMercadoLivreListingIntent } from "@/lib/chat/sales-heuristics"

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatCurrency(value, currencyId = "BRL") {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) {
    return ""
  }

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currencyId || "BRL",
    }).format(parsed)
  } catch {
    return `R$ ${parsed.toFixed(2).replace(".", ",")}`
  }
}

function buildMercadoLivreAsset(item, index = 0) {
  const priceLabel = formatCurrency(item?.price, item?.currencyId || "BRL")
  const stockQuantity = sanitizeNumber(item?.availableQuantity, 0)
  const stockLabel = stockQuantity > 0 ? `${stockQuantity} em estoque` : ""

  return {
    id: sanitizeString(item?.id || `mercado-livre-${index + 1}`),
    kind: "product",
    provider: "mercado_livre",
    categoria: "image",
    nome: sanitizeString(item?.title || "Produto"),
    descricao: [priceLabel, stockLabel].filter(Boolean).join(" - "),
    priceLabel,
    targetUrl: sanitizeString(item?.permalink),
    publicUrl: sanitizeString(item?.thumbnail),
    whatsappText: [priceLabel, stockLabel].filter(Boolean).join("\n"),
    metadata: {
      sellerId: sanitizeString(item?.sellerId),
      sellerName: sanitizeString(item?.sellerName),
      status: sanitizeString(item?.status),
      availableQuantity: stockQuantity,
      currencyId: sanitizeString(item?.currencyId || "BRL"),
    },
  }
}

function buildCatalogProductFromItem(item) {
  if (!item) {
    return null
  }

  return {
    id: sanitizeString(item.id),
    nome: sanitizeString(item.title),
    descricao: [formatCurrency(item.price, item.currencyId || "BRL"), sanitizeNumber(item.availableQuantity, 0) > 0 ? `${sanitizeNumber(item.availableQuantity, 0)} em estoque` : ""]
      .filter(Boolean)
      .join(" - "),
    preco: sanitizeNumber(item.price, null),
    link: sanitizeString(item.permalink),
    imagem: sanitizeString(item.thumbnail),
    sellerId: sanitizeString(item.sellerId),
    sellerName: sanitizeString(item.sellerName),
    availableQuantity: sanitizeNumber(item.availableQuantity, 0),
    status: sanitizeString(item.status),
  }
}

function buildMercadoLivreSearchReply(products, searchTerm, connector, paging) {
  if (!Array.isArray(products) || products.length === 0) {
    return searchTerm
      ? "Nao achei itens da loja com esse perfil agora. Se quiser, me diga outro termo e eu tento uma nova busca."
      : "Posso te mostrar produtos da loja. Me diga o que voce procura e eu busco aqui."
  }

  const storeSuffix = connector?.config?.oauthNickname ? ` da loja ${connector.config.oauthNickname}` : " da loja"
  const countLabel = products.length === 1 ? "1 produto" : `${products.length} opcoes`
  const hasMore = paging?.hasMore === true

  return hasMore
    ? `Encontrei ${countLabel}${storeSuffix}. Se quiser, posso trazer mais opcoes depois.`
    : `Encontrei ${countLabel}${storeSuffix}. Me diga qual voce quer ver com mais detalhes.`
}

function buildSelectedProductReply(product) {
  if (!product?.nome) {
    return null
  }

  const pieces = [`Perfeito, vamos seguir com ${product.nome}.`]
  if (product.preco != null) {
    pieces.push(`Preco atual: ${formatCurrency(product.preco)}.`)
  }
  if (sanitizeNumber(product.availableQuantity, 0) > 0) {
    pieces.push(`Estoque atual: ${sanitizeNumber(product.availableQuantity, 0)} unidades.`)
  }
  if (product.status && product.status !== "active") {
    pieces.push(`Status atual no Mercado Livre: ${product.status}.`)
  }
  if (product.link) {
    pieces.push("Se quiser fechar por la, eu tambem posso te mandar o link direto.")
  }
  pieces.push("Se quiser, tambem posso te mostrar outras opcoes parecidas.")

  return pieces.join(" ")
}

function buildCatalogSearchState({ searchTerm, paging, products }) {
  const safeProducts = Array.isArray(products) ? products.map(buildCatalogProductFromItem).filter(Boolean) : []
  return {
    ultimaBusca: sanitizeString(searchTerm),
    paginationOffset: sanitizeNumber(paging?.offset, 0),
    paginationNextOffset: sanitizeNumber(paging?.nextOffset, 0),
    paginationPoolLimit: sanitizeNumber(paging?.poolLimit, 24),
    paginationHasMore: paging?.hasMore === true,
    paginationTotal: sanitizeNumber(paging?.total, 0),
    produtoAtual: safeProducts.length === 1 ? safeProducts[0] : null,
    ultimosProdutos: safeProducts,
  }
}

export function isMercadoLivrePurchaseIntent(message) {
  return /\b(gostei|quero|comprar|manda o link|vou querer)\b/i.test(String(message || ""))
}

export function isMercadoLivreDetailIntent(message) {
  return /\b(garantia|frete|estoque|detalhes|cor|material|serve|combina|link|preco|valor|quanto)\b/i.test(String(message || ""))
}

export function resolveMercadoLivreFlowState(input = {}) {
  const referencedCatalogProducts =
    input.catalogFollowUpDecision?.matchedProducts ??
    (input.resolveRecentCatalogProductReference ?? resolveRecentCatalogProductReference)(input.latestUserMessage, input.context)
  const productSearchCandidates = (input.buildProductSearchCandidates ?? buildProductSearchCandidates)(input.latestUserMessage)
  const contextCatalog = input.context?.catalogo ?? {}
  const loadMoreCatalogRequested = /\b(mais|outras|outros|opcoes|modelos)\b/i.test(String(input.latestUserMessage || ""))

  return {
    productSearchRequested: Boolean(input.detectProductSearch?.(input.latestUserMessage) || productSearchCandidates.length),
    genericMercadoLivreListingRequested: Boolean(
      input.isMercadoLivreListingIntent?.(input.latestUserMessage) ?? isMercadoLivreListingIntent(input.latestUserMessage)
    ),
    loadMoreCatalogRequested,
    referencedCatalogProducts,
    currentCatalogProduct: referencedCatalogProducts?.[0] ?? contextCatalog.produtoAtual ?? null,
    catalogFollowUpDecision: input.catalogFollowUpDecision ?? null,
    productSearchTerm: productSearchCandidates[0] ?? "",
    lastSearchTerm: sanitizeString(contextCatalog.ultimaBusca),
    paginationOffset: loadMoreCatalogRequested
      ? sanitizeNumber(contextCatalog.paginationNextOffset, sanitizeNumber(contextCatalog.paginationOffset, 0))
      : 0,
    paginationPoolLimit: sanitizeNumber(contextCatalog.paginationPoolLimit, 24),
    hasMoreFromContext: contextCatalog.paginationHasMore === true,
  }
}

export async function resolveMercadoLivreHeuristicState(input = {}) {
  const currentProduct = input.currentCatalogProduct ?? input.referencedCatalogProducts?.[0] ?? input.context?.catalogo?.produtoAtual

  if (currentProduct && (isMercadoLivreDetailIntent(input.latestUserMessage) || isMercadoLivrePurchaseIntent(input.latestUserMessage))) {
    const productAsset = currentProduct.link
      ? [
          buildMercadoLivreAsset(
            {
              id: currentProduct.id,
              title: currentProduct.nome,
              price: currentProduct.preco,
              currencyId: "BRL",
              availableQuantity: currentProduct.availableQuantity ?? 0,
              permalink: currentProduct.link,
              thumbnail: currentProduct.imagem,
              sellerId: currentProduct.sellerId,
              sellerName: currentProduct.sellerName,
              status: currentProduct.status,
            },
            0
          ),
        ]
      : []

    return {
      selectedProductSalesReply: buildSelectedProductReply(currentProduct),
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: [],
      mercadoLivreAssets: productAsset,
      catalogSearchState: null,
    }
  }

  if (!input.project?.id) {
    return {
      selectedProductSalesReply: currentProduct ? buildSelectedProductReply(currentProduct) : null,
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: input.mercadoLivreProducts ?? [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
    }
  }

  const shouldSearch =
    input.productSearchRequested ||
    input.genericMercadoLivreListingRequested ||
    input.loadMoreCatalogRequested

  if (!shouldSearch) {
    return {
      selectedProductSalesReply: currentProduct ? buildSelectedProductReply(currentProduct) : null,
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: input.mercadoLivreProducts ?? [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
    }
  }

  const searchTerm = input.loadMoreCatalogRequested
    ? sanitizeString(input.lastSearchTerm) ||
      sanitizeString(input.context?.catalogo?.ultimaBusca) ||
      sanitizeString(input.productSearchTerm) ||
      sanitizeString(input.latestUserMessage)
    : sanitizeString(input.productSearchTerm) ||
      sanitizeString(input.lastSearchTerm) ||
      sanitizeString(input.context?.catalogo?.ultimaBusca) ||
      sanitizeString(input.latestUserMessage)

  const searchOffset = input.loadMoreCatalogRequested ? sanitizeNumber(input.paginationOffset, 0) : 0
  const poolLimit = input.loadMoreCatalogRequested
    ? Math.max(12, sanitizeNumber(input.paginationPoolLimit, 24))
    : Math.max(18, sanitizeNumber(input.paginationPoolLimit, 24))

  const { items, connector, paging, error } = await (input.resolveMercadoLivreSearch ?? searchMercadoLivreProductsForProject)(
    input.project,
    {
      searchTerm,
      limit: 3,
      offset: searchOffset,
      poolLimit,
    }
  )

  if (error) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply: "A loja esta conectada, mas nao consegui buscar os produtos agora. Tente novamente em instantes.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
    }
  }

  const products = Array.isArray(items) ? items : []
  const assets = products.slice(0, 3).map((item, index) => buildMercadoLivreAsset(item, index))
  const catalogSearchState = buildCatalogSearchState({
    searchTerm,
    paging,
    products,
  })

  if (!products.length && input.loadMoreCatalogRequested) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply: "Nao encontrei mais itens nessa faixa da loja. Se quiser, me passe outro termo e eu faço uma nova busca.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: {
        ...catalogSearchState,
        paginationHasMore: false,
      },
    }
  }

  return {
    selectedProductSalesReply: null,
    mercadoLivreHeuristicReply: buildMercadoLivreSearchReply(products, searchTerm, connector, paging),
    mercadoLivreProducts: products,
    mercadoLivreAssets: assets,
    catalogSearchState,
  }
}

export function resolveMercadoLivreHeuristicReply(state) {
  return state?.selectedProductSalesReply ?? state?.mercadoLivreHeuristicReply ?? null
}

export async function resolveMercadoLivreSearch(project, options = {}) {
  return searchMercadoLivreProductsForProject(project, options)
}
