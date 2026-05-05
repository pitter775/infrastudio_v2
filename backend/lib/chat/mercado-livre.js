import { getMercadoLivreProductByIdForProject, searchMercadoLivreProductsForProject } from "@/lib/mercado-livre-connector"
import { getMercadoLivreStoreChatSettingsForProject } from "@/lib/mercado-livre-store"
import {
  buildCatalogProductFacts,
  buildFocusedCatalogProductCommercialReply,
  buildFocusedCatalogProductFactualResolution,
} from "@/lib/chat/catalog-product-facts"
import { resolveCatalogExecutionState } from "@/lib/chat/catalog-intent-handler"

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildListingSessionId(searchTerm, paging, products) {
  const seed = [
    sanitizeString(searchTerm),
    sanitizeString(paging?.offset),
    sanitizeString(paging?.total),
    ...(Array.isArray(products) ? products.map((item) => sanitizeString(item?.id)).filter(Boolean).slice(0, 6) : []),
  ]
    .filter(Boolean)
    .join(":")

  return seed ? `ml:${Buffer.from(seed).toString("base64url").slice(0, 32)}` : ""
}

function slugifyProduct(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
}

function hasMercadoLivreConnection(project, context) {
  const directConnections = project?.directConnections ?? context?.projeto?.directConnections
  return Number(directConnections?.mercadoLivre ?? 0) > 0
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
  const installmentQuantity = sanitizeNumber(item?.installmentQuantity, 0)
  const installmentAmount = sanitizeNumber(item?.installmentAmount, 0)
  const installmentLabel =
    installmentQuantity > 1 && installmentAmount > 0
      ? `${installmentQuantity}x de ${formatCurrency(installmentAmount, item?.currencyId || "BRL")}`
      : ""
  const stockQuantity = sanitizeNumber(item?.availableQuantity, 0)
  const stockLabel = stockQuantity > 0 ? `${stockQuantity} em estoque` : ""
  const productSlug = sanitizeString(item?.slug) || slugifyProduct(item?.title)
  const images = [...new Set([sanitizeString(item?.thumbnail), ...(Array.isArray(item?.pictures) ? item.pictures : [])].filter(Boolean))].slice(0, 6)
  const summary = sanitizeString(item?.descriptionPlain || item?.shortDescription || item?.descricaoLonga || item?.description)

  return {
    id: sanitizeString(item?.id || `mercado-livre-${index + 1}`),
    kind: "product",
    provider: "mercado_livre",
    categoria: "image",
    nome: sanitizeString(item?.title || "Produto"),
    slug: productSlug,
    descricao: [priceLabel, stockLabel].filter(Boolean).join(" - "),
    resumo: summary,
    priceValue: sanitizeNumber(item?.price, null),
    priceLabel,
    installmentLabel,
    targetUrl: sanitizeString(item?.permalink),
    publicUrl: images[0] ?? "",
    images,
    whatsappText: [priceLabel, stockLabel].filter(Boolean).join("\n"),
    metadata: {
      sellerId: sanitizeString(item?.sellerId),
      sellerName: sanitizeString(item?.sellerName),
      status: sanitizeString(item?.status),
      availableQuantity: stockQuantity,
      priceValue: sanitizeNumber(item?.price, null),
      installmentQuantity,
      installmentAmount,
      installmentLabel,
      summary,
      currencyId: sanitizeString(item?.currencyId || "BRL"),
      condition: sanitizeString(item?.condition),
      warranty: sanitizeString(item?.warranty),
      freeShipping: item?.freeShipping === true,
      productSlug,
      attributes: Array.isArray(item?.attributes) ? item.attributes : [],
    },
  }
}

function getCatalogFocusMode(context = {}) {
  const mode = String(context?.catalogo?.focusMode || "").trim().toLowerCase()
  return mode || null
}

function buildCatalogProductFromItem(item, options = {}) {
  if (!item) {
    return null
  }

  const detailLevel = String(options?.detailLevel || "compact").trim().toLowerCase()
  const isFocused = detailLevel === "focused" || detailLevel === "full"
  const isFull = detailLevel === "full"
  const attributeLimit = isFull ? 40 : isFocused ? 20 : 10
  const variationLimit = isFull ? 12 : isFocused ? 8 : 3
  const imageLimit = isFull ? 8 : isFocused ? 6 : 3
  const descriptionLimit = isFull ? 4000 : isFocused ? 1600 : 320

  const attributes = Array.isArray(item.attributes)
    ? item.attributes
        .map((attribute) => ({
          id: sanitizeString(attribute?.id),
          nome: sanitizeString(attribute?.name),
          valor: sanitizeString(attribute?.valueName),
        }))
        .filter((attribute) => attribute.nome && attribute.valor)
        .slice(0, attributeLimit)
    : []
  const material =
    attributes.find((attribute) => /material/i.test(attribute.nome))?.valor ||
    attributes.find((attribute) => /linea|linha/i.test(attribute.nome))?.valor ||
    ""
  const cor =
    attributes.find((attribute) => /cor|color/i.test(attribute.nome))?.valor ||
    attributes.find((attribute) => /estampa/i.test(attribute.nome))?.valor ||
    ""
  const primaryHighlights = [
    formatCurrency(item.price, item.currencyId || "BRL"),
    sanitizeNumber(item.availableQuantity, 0) > 0 ? `${sanitizeNumber(item.availableQuantity, 0)} em estoque` : "",
    material,
    cor,
    item.freeShipping ? "frete gratis" : "",
  ].filter(Boolean)
  const variationHighlights = Array.isArray(item.variations)
    ? item.variations
        .slice(0, variationLimit)
        .map((variation) =>
          Array.isArray(variation?.attributeCombinations)
            ? variation.attributeCombinations
                .map((attribute) => sanitizeString(attribute?.valueName))
                .filter(Boolean)
                .join(" / ")
            : ""
        )
        .filter(Boolean)
    : []
  const descricaoLonga = sanitizeString(item.descriptionPlain || item.shortDescription).slice(0, descriptionLimit)

  const product = {
    id: sanitizeString(item.id),
    slug: sanitizeString(item.slug) || slugifyProduct(item.title),
    nome: sanitizeString(item.title),
    categoriaLabel: sanitizeString(item.categoryName || item.categoryLabel || item.categoryId),
    descricao: primaryHighlights.join(" - "),
    preco: sanitizeNumber(item.price, null),
    link: sanitizeString(item.permalink),
    imagem: sanitizeString(item.thumbnail),
    sellerId: sanitizeString(item.sellerId),
    sellerName: sanitizeString(item.sellerName),
    availableQuantity: sanitizeNumber(item.availableQuantity, 0),
    status: sanitizeString(item.status),
    condition: sanitizeString(item.condition),
    warranty: sanitizeString(item.warranty),
    freeShipping: item.freeShipping === true,
    material: sanitizeString(material),
    cor: sanitizeString(cor),
    atributos: attributes,
    imagens: Array.isArray(item.pictures) ? item.pictures.filter(Boolean).slice(0, imageLimit) : [],
    descricaoLonga,
    variacoesResumo: variationHighlights,
    contextoDetalhado: isFocused,
    contextoCompleto: isFull,
  }

  return {
    ...product,
    facts: buildCatalogProductFacts(product),
  }
}

function buildMercadoLivreSearchReply(products, searchTerm, connector, paging, options = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    if (options?.isAlternativeSearch === true && options?.priceMaxExclusive != null) {
      return "Não encontrei outra opção mais barata nessa mesma busca agora. Posso tentar outro termo ou ampliar a busca se você quiser."
    }

    return searchTerm
      ? "Não achei itens da loja com esse perfil agora. Se quiser, me diga outro termo e eu tento uma nova busca."
      : "Posso te mostrar produtos da loja. Me diga o que você procura e eu busco aqui."
  }

  const searchTermText = sanitizeString(searchTerm)
  const matchedCount = Math.max(
    sanitizeNumber(
      paging?.filteredTotal ?? (searchTermText ? products.length : paging?.total),
      products.length
    ),
    products.length
  )
  const visibleCount = products.length
  const countLabel = matchedCount === 1 ? "1 produto" : `${matchedCount} opcoes`
  const hasMore = paging?.hasMore === true
  const isLoadMore = options?.isLoadMore === true

  if (isLoadMore) {
    const continuationLabel = visibleCount === 1 ? "1 produto" : `${visibleCount} opcoes`
    return hasMore
      ? `Encontrei mais ${continuationLabel} desta busca. Vou te mostrar agora e, se quiser, posso trazer mais depois.`
      : `Encontrei mais ${continuationLabel} desta busca. Vou te mostrar agora.`
  }

  return hasMore
    ? `Encontrei ${countLabel}. Vou te mostrar ${visibleCount === 1 ? "a principal opcao" : `${visibleCount} opcoes agora`} e posso trazer mais depois.`
    : `Encontrei ${countLabel}. Vou te mostrar as opcoes disponiveis agora.`
}

function extractReportedMercadoLivreCount(reply = "") {
  const normalized = String(reply || "")
  const singularMatch = normalized.match(/\bencontrei\s+1\s+produto\b/i)
  if (singularMatch) {
    return 1
  }

  const pluralMatch = normalized.match(/\bencontrei\s+(\d+)\s+opc(?:ao|oes)\b/i)
  if (pluralMatch) {
    return sanitizeNumber(pluralMatch[1], 0)
  }

  return null
}

export function enforceMercadoLivreSearchReplyCoherence(reply, products, searchTerm, connector, paging, options = {}) {
  const actualMatchedCount = Math.max(sanitizeNumber(paging?.total, 0), Array.isArray(products) ? products.length : 0)
  const reportedCount = extractReportedMercadoLivreCount(reply)

  if (reportedCount == null || reportedCount === actualMatchedCount) {
    return reply
  }

  return buildMercadoLivreSearchReply(products, searchTerm, connector, paging, options)
}

function normalizeMessage(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getConversationMode(context = {}) {
  const mode = String(context?.conversation?.mode || context?.ui?.mode || "").trim().toLowerCase()
  return mode || null
}

function hasFocusedCatalogProductContext(context = {}) {
  const focusMode = getCatalogFocusMode(context)
  if (focusMode === "product_focus" && context?.catalogo?.produtoAtual?.nome) {
    return true
  }

  return Boolean(
    (getConversationMode(context) === "product_detail" ||
      getConversationMode(context) === "product_focus" ||
      context?.ui?.productDetailPreferred === true ||
      context?.storefront?.pageKind === "product_detail") &&
      context?.catalogo?.produtoAtual?.nome
  )
}

function isMercadoLivreDeliveryIntent(message) {
  const normalized = normalizeMessage(message)
  return /\b(entrega|entregam|enviam|envio|frete|retirada|retirar|prazo)\b/.test(normalized)
}

function isMercadoLivrePriceIntent(message) {
  return /\b(preco|valor|custa|custando|quanto|sai por quanto)\b/i.test(String(message || ""))
}

function isMercadoLivreMaterialIntent(message) {
  return /\b(material|de que e feito|do que e feito|qual material)\b/i.test(String(message || ""))
}

function isMercadoLivreColorIntent(message) {
  return /\b(cor|acabamento|estampa)\b/i.test(String(message || ""))
}

function isMercadoLivreStockIntent(message) {
  return /\b(estoque|disponivel|disponibilidade|tem disponivel|quantas unidades)\b/i.test(String(message || ""))
}

function isMercadoLivreWarrantyIntent(message) {
  return /\b(garantia|garantido)\b/i.test(String(message || ""))
}

function isMercadoLivreLinkIntent(message) {
  return /\b(link|anuncio|pagina de compra|comprar agora)\b/i.test(String(message || ""))
}

function isMercadoLivreDimensionIntent(message) {
  return /\b(dimens(?:ao|oes)|medida|medidas|tamanho|altura|largura|comprimento|profundidade|diametro|peso|capacidade)\b/i.test(
    String(message || "")
  )
}

function isMercadoLivreFactualIntent(message) {
  return (
    isMercadoLivrePriceIntent(message) ||
    isMercadoLivreMaterialIntent(message) ||
    isMercadoLivreColorIntent(message) ||
    isMercadoLivreStockIntent(message) ||
    isMercadoLivreWarrantyIntent(message) ||
    isMercadoLivreLinkIntent(message) ||
    isMercadoLivreDimensionIntent(message) ||
    isMercadoLivreDeliveryIntent(message)
  )
}

function pushUniqueSentence(target, sentence) {
  const normalizedSentence = sanitizeString(sentence)
  if (!normalizedSentence) {
    return
  }

  const sentenceKey = normalizeMessage(normalizedSentence)
  const alreadyIncluded = target.some((item) => normalizeMessage(item) === sentenceKey)
  if (!alreadyIncluded) {
    target.push(normalizedSentence)
  }
}

function buildSelectedProductReply(product, userMessage = "") {
  if (!product?.nome) {
    return null
  }

  const pieces = []
  const isDeliveryQuestion = isMercadoLivreDeliveryIntent(userMessage)

  if (isDeliveryQuestion) {
    pushUniqueSentence(pieces, "Sim. A entrega e feita pelo Mercado Livre.")
    if (product.freeShipping) {
      pushUniqueSentence(pieces, "Neste item o anuncio indica frete gratis.")
    } else {
      pushUniqueSentence(pieces, "O valor e o prazo do frete aparecem no checkout do proprio Mercado Livre, conforme o seu CEP.")
    }
    if (sanitizeNumber(product.availableQuantity, 0) > 0) {
      pushUniqueSentence(
        pieces,
        `No momento eu vejo ${sanitizeNumber(product.availableQuantity, 0)} unidade${sanitizeNumber(product.availableQuantity, 0) > 1 ? "s" : ""} disponivel${sanitizeNumber(product.availableQuantity, 0) > 1 ? "is" : ""}.`
      )
    }
    return pieces.join(" ")
  }

  pushUniqueSentence(pieces, `${product.nome}.`)
  if (product.preco != null) {
    pushUniqueSentence(pieces, `Preco atual: ${formatCurrency(product.preco)}.`)
  }
  if (product.material) {
    pushUniqueSentence(pieces, `Material: ${product.material}.`)
  }
  if (product.cor) {
    pushUniqueSentence(pieces, `Cor ou acabamento: ${product.cor}.`)
  }
  if (sanitizeNumber(product.availableQuantity, 0) > 0) {
    pushUniqueSentence(pieces, `Estoque atual: ${sanitizeNumber(product.availableQuantity, 0)} unidade${sanitizeNumber(product.availableQuantity, 0) > 1 ? "s" : ""}.`)
  }
  if (product.freeShipping) {
    pushUniqueSentence(pieces, "O anuncio indica frete gratis no Mercado Livre.")
  }
  if (product.warranty && !/^sem garantia$/i.test(product.warranty)) {
    pushUniqueSentence(pieces, `Garantia informada no anuncio: ${product.warranty}.`)
  }
  if (product.condition && !/^new$/i.test(product.condition)) {
    pushUniqueSentence(pieces, `Condicao do item no anuncio: ${product.condition}.`)
  }
  if (Array.isArray(product.atributos) && product.atributos.length) {
    const highlightedAttributes = product.atributos
      .filter((attribute) => attribute?.nome && attribute?.valor)
      .slice(0, 4)
      .map((attribute) => `${attribute.nome}: ${attribute.valor}`)
    if (highlightedAttributes.length) {
      pushUniqueSentence(pieces, `Detalhes do anuncio: ${highlightedAttributes.join(", ")}.`)
    }
  }
  if (Array.isArray(product.variacoesResumo) && product.variacoesResumo.length) {
    pushUniqueSentence(pieces, `Variações visíveis: ${product.variacoesResumo.join(", ")}.`)
  }
  if (product.descricaoLonga) {
    pushUniqueSentence(pieces, `Resumo: ${product.descricaoLonga.slice(0, 220)}${product.descricaoLonga.length > 220 ? "..." : ""}`)
  }
  if (product.status && product.status !== "active") {
    pushUniqueSentence(pieces, `Status atual no Mercado Livre: ${product.status}.`)
  }
  if (product.link) {
    pushUniqueSentence(pieces, `Link direto: ${product.link}`)
  }
  pushUniqueSentence(pieces, "Se quiser, eu tambem comparo com outra opcao da lista.")

  return pieces.join(" ")
}

export function buildFocusedProductFactualReply(product, userMessage = "", options = {}) {
  return buildFocusedProductFactualResolution(product, userMessage, options)?.reply ?? null
}

export function buildFocusedProductFactualResolution(product, userMessage = "", options = {}) {
  return buildFocusedCatalogProductFactualResolution(product, userMessage, options)
}

export function buildFocusedProductCommercialReply(product, options = {}) {
  return buildFocusedCatalogProductCommercialReply(product, options)
}

export function shouldAttachMercadoLivreAssetForMessage(message = "") {
  return isMercadoLivreLinkIntent(message) || isMercadoLivrePurchaseIntent(message)
}

function buildCatalogSearchState({ searchTerm, paging, products, currentListingSessionId }) {
  const safeProducts = Array.isArray(products) ? products.map(buildCatalogProductFromItem).filter(Boolean) : []
  const listingSessionId = sanitizeString(currentListingSessionId) || buildListingSessionId(searchTerm, paging, safeProducts)
  const snapshotId = listingSessionId ? `${listingSessionId}:snapshot` : ""
  return {
    ultimaBusca: sanitizeString(searchTerm),
    paginationOffset: sanitizeNumber(paging?.offset, 0),
    paginationNextOffset: sanitizeNumber(paging?.nextOffset, 0),
    paginationPoolLimit: sanitizeNumber(paging?.poolLimit, 24),
    paginationHasMore: paging?.hasMore === true,
    paginationTotal: sanitizeNumber(paging?.total, 0),
    produtoAtual: safeProducts.length === 1 ? safeProducts[0] : null,
    ultimosProdutos: safeProducts,
    listingSession: {
      id: listingSessionId,
      snapshotId,
      searchTerm: sanitizeString(searchTerm),
      matchedProductIds: safeProducts.map((item) => sanitizeString(item?.id)).filter(Boolean),
      offset: sanitizeNumber(paging?.offset, 0),
      nextOffset: sanitizeNumber(paging?.nextOffset, 0),
      poolLimit: sanitizeNumber(paging?.poolLimit, 24),
      hasMore: paging?.hasMore === true,
      total: sanitizeNumber(paging?.total, safeProducts.length),
      source: "storefront_snapshot",
    },
    productFocus: safeProducts.length === 1
      ? {
          productId: sanitizeString(safeProducts[0]?.id),
          sourceListingSessionId: listingSessionId,
          detailLevel: "focused",
        }
      : null,
  }
}

function normalizeRecentCatalogProducts(context) {
  return Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos.filter(Boolean) : []
}

function isWhatsAppCatalogChannel(context = {}) {
  const channelKind = String(context?.canal || context?.channel?.kind || "").trim().toLowerCase()
  return channelKind === "whatsapp"
}

export function isMercadoLivrePurchaseIntent(message) {
  return /\b(gostei|quero|comprar|manda o link|vou querer)\b/i.test(String(message || ""))
}

export function isMercadoLivreDetailIntent(message) {
  return /\b(garantia|frete|estoque|detalhes|detalhe|mais informac(?:ao|oes)|me fala mais|explica melhor|descricao|especificac(?:ao|oes)|ficha tecnica|cor|material|serve|combina|link|preco|valor|quanto)\b/i.test(
    String(message || "")
  )
}

function hasStrongProductDetailContext(context) {
  return hasFocusedCatalogProductContext(context)
}

function hasLockedProductDetailContext(context = {}) {
  return Boolean(
    context?.catalogo?.produtoAtual?.nome &&
      (getConversationMode(context) === "product_detail" ||
        context?.ui?.productDetailPreferred === true ||
        context?.storefront?.pageKind === "product_detail")
  )
}

function isExplicitProductContextExitIntent(message) {
  const normalized = normalizeMessage(message)
  if (!normalized) {
    return false
  }

  return (
    /\b(outro|outra|outros|outras|parecido|parecidos|similares|opcoes|modelos)\b/.test(normalized) ||
    /\b(me mostra|mostra|mande|manda|envia|traz)\b[\s\S]{0,30}\b(outro|outra|outros|outras|mais|opcoes|modelos|parecidos)\b/.test(
      normalized
    ) ||
    /\b(quero ver|quero buscar|busca|procura|procuro|buscar)\b/.test(normalized)
  )
}

function isImplicitCurrentProductReference(message) {
  const normalized = normalizeMessage(message)
  if (!normalized) {
    return false
  }

  return (
    isMercadoLivreDetailIntent(message) ||
    isMercadoLivrePurchaseIntent(message) ||
    /\b(esse|essa|desse|dessa|este|esta|dele|dela|aqui|item|produto)\b/.test(normalized)
  )
}

function shouldStayOnCurrentProduct(message, context, currentProduct) {
  if (!currentProduct?.nome || !hasStrongProductDetailContext(context)) {
    return false
  }

  const normalized = normalizeMessage(message)
  if (!normalized) {
    return false
  }

  if (hasLockedProductDetailContext(context) && !isExplicitProductContextExitIntent(message)) {
    return true
  }

  if (isMercadoLivreDetailIntent(message) || isMercadoLivrePurchaseIntent(message)) {
    return true
  }

  if (/\b(esse produto|este produto|desse produto|desse item|esse item|ele|dele)\b/.test(normalized)) {
    return true
  }

  if (
    /\b(qual|quais|como|quanto|tem|vem|serve|combina|mostra|explica)\b/.test(normalized) &&
    /\b(produto|item|material|cor|medida|medidas|tamanho|peso|garantia|frete|estoque|acabamento|descricao|detalhe|detalhes)\b/.test(normalized)
  ) {
    return true
  }

  return false
}

export function resolveMercadoLivreFlowState(input = {}) {
  const executionState = resolveCatalogExecutionState({
    latestUserMessage: input.latestUserMessage,
    context: input.context,
    products: Array.isArray(input.context?.catalogo?.ultimosProdutos) ? input.context.catalogo.ultimosProdutos : [],
    catalogDecision: input.catalogFollowUpDecision,
    detectProductSearch: input.detectProductSearch,
    buildProductSearchCandidates: input.buildProductSearchCandidates,
    isCatalogListingIntent: input.isMercadoLivreListingIntent,
  })

  return {
    ...executionState.intentState,
    catalogComparisonIntent: executionState.comparisonState.comparisonIntent,
    genericMercadoLivreListingRequested: executionState.intentState.genericCatalogListingRequested,
    catalogFollowUpDecision: executionState.intentState.catalogDecision,
    catalogExecutionAction: executionState.action,
  }
}

export async function resolveMercadoLivreHeuristicState(input = {}) {
  let currentProduct = input.currentCatalogProduct ?? input.referencedCatalogProducts?.[0] ?? input.context?.catalogo?.produtoAtual
  const recentCatalogProducts = Array.isArray(input.recentCatalogProducts) ? input.recentCatalogProducts : normalizeRecentCatalogProducts(input.context)
  const executionState = resolveCatalogExecutionState({
    latestUserMessage: input.latestUserMessage,
    context: input.context,
    products: recentCatalogProducts,
    comparisonIntent: input.catalogComparisonIntent,
  })
  const projectHasMercadoLivre = hasMercadoLivreConnection(input.project, input.context)
  const focusedProductContext = hasFocusedCatalogProductContext(input.context)
  const structuredCatalogAction = String(input.context?.ui?.catalogAction || input.context?.catalogAction || "").trim().toLowerCase()
  const listingSession = input.context?.catalogo?.listingSession ?? null

  const hasStructuredListingSession =
    Boolean(sanitizeString(listingSession?.id || listingSession?.snapshotId)) ||
    sanitizeNumber(listingSession?.nextOffset, 0) > 0 ||
    sanitizeNumber(listingSession?.total, 0) > 0 ||
    listingSession?.hasMore === true

  if (structuredCatalogAction === "load_more" && !sanitizeString(listingSession?.searchTerm) && !hasStructuredListingSession) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply:
        "Não consegui continuar essa lista agora. Me passe outro termo e eu faço uma nova busca.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: null,
    }
  }

  if (structuredCatalogAction === "product_detail" && !currentProduct?.id) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply:
        "Não consegui localizar esse item na lista atual. Se quiser, eu faço uma nova busca para você.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: null,
    }
  }

  if (executionState.comparisonState.selectedProduct && executionState.comparisonState.comparisonReply) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply: executionState.comparisonState.comparisonReply,
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: executionState.comparisonState.selectedProduct,
    }
  }

  if (executionState.comparisonState.comparisonIntent === "best_choice" && executionState.comparisonState.comparisonReply) {
      return {
        selectedProductSalesReply: null,
        mercadoLivreHeuristicReply: executionState.comparisonState.comparisonReply,
        mercadoLivreProducts: [],
        mercadoLivreAssets: [],
        catalogSearchState: null,
        selectedCatalogProduct: null,
      }
  }

  const shouldEnrichSelectedProduct =
    Boolean(currentProduct?.id) &&
    Boolean(input.project?.id) &&
    projectHasMercadoLivre &&
    (focusedProductContext || isMercadoLivreDetailIntent(input.latestUserMessage) || isMercadoLivrePurchaseIntent(input.latestUserMessage))

  if (shouldEnrichSelectedProduct) {
    const storeSettings =
      typeof input.resolveMercadoLivreStoreSettings === "function"
        ? await input.resolveMercadoLivreStoreSettings(input.project)
        : await getMercadoLivreStoreChatSettingsForProject(input.project)
    const detailedProductResponse = await (input.resolveMercadoLivreProductById ?? getMercadoLivreProductByIdForProject)(
      input.project,
      currentProduct.id
    )
    if (detailedProductResponse?.item) {
      currentProduct = buildCatalogProductFromItem(detailedProductResponse.item, {
        detailLevel: storeSettings?.chatContextFull === true ? "full" : "focused",
      })
    }
  }

  if (
    currentProduct &&
    (structuredCatalogAction === "product_detail" ||
      isMercadoLivreDetailIntent(input.latestUserMessage) ||
      isMercadoLivrePurchaseIntent(input.latestUserMessage))
  ) {
    const factualReply = buildFocusedProductFactualReply(currentProduct, input.latestUserMessage)
    const shouldAttachAsset =
      structuredCatalogAction === "product_detail" ||
      isMercadoLivreLinkIntent(input.latestUserMessage) ||
      isMercadoLivrePurchaseIntent(input.latestUserMessage)
    const productAsset = currentProduct.link || currentProduct.imagem
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
              descriptionPlain: currentProduct.descricaoLonga,
              sellerId: currentProduct.sellerId,
            sellerName: currentProduct.sellerName,
            status: currentProduct.status,
            condition: currentProduct.condition,
            warranty: currentProduct.warranty,
            freeShipping: currentProduct.freeShipping,
            attributes: Array.isArray(currentProduct.atributos)
              ? currentProduct.atributos.map((attribute) => ({
                  id: attribute.id,
                  name: attribute.nome,
                  valueName: attribute.valor,
                }))
              : [],
          },
          0
        ),
        ]
      : []

    return {
      selectedProductSalesReply: factualReply ?? buildSelectedProductReply(currentProduct, input.latestUserMessage),
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: [],
      mercadoLivreAssets: shouldAttachAsset ? productAsset : [],
      catalogSearchState: null,
      selectedCatalogProduct: currentProduct,
      selectedProductShouldAttachAsset: shouldAttachAsset,
    }
  }

  if (!input.project?.id) {
    return {
      selectedProductSalesReply: currentProduct ? buildSelectedProductReply(currentProduct, input.latestUserMessage) : null,
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: input.mercadoLivreProducts ?? [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: currentProduct ?? null,
    }
  }

  if (!projectHasMercadoLivre) {
    return {
      selectedProductSalesReply: currentProduct ? buildSelectedProductReply(currentProduct, input.latestUserMessage) : null,
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: input.mercadoLivreProducts ?? [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: currentProduct ?? null,
    }
  }

  const shouldSearch =
    input.productSearchRequested ||
    input.genericMercadoLivreListingRequested ||
    input.loadMoreCatalogRequested ||
    input.forceNewSearch

  if (!shouldSearch) {
    return {
      selectedProductSalesReply: currentProduct ? buildSelectedProductReply(currentProduct, input.latestUserMessage) : null,
      mercadoLivreHeuristicReply: null,
      mercadoLivreProducts: input.mercadoLivreProducts ?? [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: currentProduct ?? null,
    }
  }

  const refinementSearchTerm =
    sanitizeString(input.catalogFollowUpDecision?.uncoveredTokens?.[0]) ||
    sanitizeString(input.catalogFollowUpDecision?.searchCandidates?.[0])
  const allowEmptyCatalogSearch = input.allowEmptyCatalogSearch === true || (input.loadMoreCatalogRequested && !sanitizeString(listingSession?.searchTerm))
  const freshSearchTerm =
    refinementSearchTerm ||
    sanitizeString(input.productSearchTerm) ||
    (allowEmptyCatalogSearch ? "" : sanitizeString(input.latestUserMessage))
  const searchTerm = input.forceNewSearch
    ? freshSearchTerm || sanitizeString(input.lastSearchTerm) || sanitizeString(input.context?.catalogo?.ultimaBusca)
    : input.loadMoreCatalogRequested
    ? sanitizeString(input.lastSearchTerm) ||
      sanitizeString(input.context?.catalogo?.ultimaBusca) ||
      freshSearchTerm
    : freshSearchTerm ||
      sanitizeString(input.lastSearchTerm) ||
      sanitizeString(input.context?.catalogo?.ultimaBusca)

  const searchOffset = input.loadMoreCatalogRequested && !input.forceNewSearch ? sanitizeNumber(input.paginationOffset, 0) : 0
  const productDisplayLimit = isWhatsAppCatalogChannel(input.context) ? 3 : 10
  const poolLimit = input.loadMoreCatalogRequested
    ? Math.max(12, sanitizeNumber(input.paginationPoolLimit, 24))
    : Math.max(18, sanitizeNumber(input.paginationPoolLimit, 24))
  const excludeItemIds =
    input.excludeCurrentProductFromSearch && currentProduct?.id
      ? [sanitizeString(currentProduct.id)].filter(Boolean)
      : []
  const shownCatalogProductIds = Array.isArray(input.excludeCatalogProductIds)
    ? input.excludeCatalogProductIds.map((itemId) => sanitizeString(itemId)).filter(Boolean)
    : []
  const effectiveExcludeItemIds = [...new Set([...excludeItemIds, ...shownCatalogProductIds])]

  const { items, connector, paging, error } = await (input.resolveMercadoLivreSearch ?? searchMercadoLivreProductsForProject)(
    input.project,
    {
      searchTerm,
      limit: productDisplayLimit,
      offset: searchOffset,
      poolLimit,
      excludeItemIds: effectiveExcludeItemIds,
      priceMaxExclusive: input.priceMaxExclusive,
      sort: input.priceMaxExclusive != null ? "price_asc" : undefined,
      allowEmptySearch: allowEmptyCatalogSearch,
    }
  )

  if (error) {
    const normalizedError = sanitizeString(error).toLowerCase()
    const shouldSilence =
      normalizedError.includes("nao encontrado para este projeto") ||
      normalizedError.includes("conta do mercado livre ainda nao autorizada") ||
      normalizedError.includes("salve a conexao do mercado livre primeiro")

    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply: shouldSilence
        ? null
        : "A loja está conectada, mas não consegui buscar os produtos agora. Tente novamente em instantes.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: null,
    }
  }

  const products = Array.isArray(items) ? items : []
  const assets = products.slice(0, productDisplayLimit).map((item, index) => buildMercadoLivreAsset(item, index))
  const catalogSearchState = buildCatalogSearchState({
    searchTerm,
    paging,
    products,
    currentListingSessionId: input.loadMoreCatalogRequested ? sanitizeString(listingSession?.id) : "",
  })

  if (!products.length && input.loadMoreCatalogRequested) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply: "Não encontrei mais itens nessa busca no momento. Se quiser, me passe outro termo e eu faço uma nova busca.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: {
        ...catalogSearchState,
        paginationHasMore: false,
        listingSession: catalogSearchState?.listingSession
          ? {
              ...catalogSearchState.listingSession,
              hasMore: false,
            }
          : null,
      },
      selectedCatalogProduct: null,
    }
  }

  return {
    selectedProductSalesReply: null,
    mercadoLivreHeuristicReply: enforceMercadoLivreSearchReplyCoherence(
      buildMercadoLivreSearchReply(products, searchTerm, connector, paging, {
        isLoadMore: input.loadMoreCatalogRequested,
        isAlternativeSearch: input.catalogFollowUpDecision?.kind === "catalog_alternative_search",
        priceMaxExclusive: input.priceMaxExclusive,
      }),
      products,
      searchTerm,
      connector,
      paging,
      {
        isLoadMore: input.loadMoreCatalogRequested,
        isAlternativeSearch: input.catalogFollowUpDecision?.kind === "catalog_alternative_search",
        priceMaxExclusive: input.priceMaxExclusive,
      }
    ),
    mercadoLivreProducts: products,
    mercadoLivreAssets: assets,
    catalogSearchState,
    selectedCatalogProduct: catalogSearchState.produtoAtual ?? null,
  }
}

export function resolveMercadoLivreHeuristicReply(state) {
  return state?.selectedProductSalesReply ?? state?.mercadoLivreHeuristicReply ?? null
}

export async function resolveMercadoLivreSearch(project, options = {}) {
  return searchMercadoLivreProductsForProject(project, options)
}
