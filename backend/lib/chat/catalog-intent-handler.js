import {
  detectCatalogSearchRefinement,
  hasRecentCatalogSnapshot,
  isCatalogLoadMoreIntent,
  normalizeRecentCatalogProducts,
  resolveCatalogReferenceHeuristicReply,
  resolveDeterministicCatalogFollowUpDecision,
  resolveRecentCatalogProductReference,
} from "@/lib/chat/catalog-follow-up"
import { buildCatalogSimilarSearchCandidates } from "@/lib/chat/catalog-state"
import { buildProductSearchCandidates, isMercadoLivreListingIntent } from "@/lib/chat/sales-heuristics"

function sanitizeString(value = "") {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sanitizeStringArray(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => sanitizeString(item)).filter(Boolean))]
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

function getCatalogFocusMode(context = {}) {
  const mode = String(context?.catalogo?.focusMode || "").trim().toLowerCase()
  return mode || null
}

function getCatalogListingSession(context = {}) {
  const session = context?.catalogo?.listingSession
  if (session && typeof session === "object" && !Array.isArray(session)) {
    const matchedProductIds = sanitizeStringArray(session.matchedProductIds)
    const searchTerm = sanitizeString(session.searchTerm)
    const hasSessionIdentity = sanitizeString(session.id) || searchTerm || matchedProductIds.length
    if (hasSessionIdentity) {
      return {
        id: sanitizeString(session.id),
        snapshotId: sanitizeString(session.snapshotId),
        searchTerm,
        matchedProductIds,
        offset: sanitizeNumber(session.offset, 0),
        nextOffset: sanitizeNumber(session.nextOffset, 0),
        poolLimit: sanitizeNumber(session.poolLimit, 24),
        hasMore: session.hasMore === true,
        total: sanitizeNumber(session.total, matchedProductIds.length),
        source: sanitizeString(session.source) || "storefront_snapshot",
      }
    }
  }

  const fallbackSearchTerm = sanitizeString(context?.catalogo?.ultimaBusca)
  const fallbackProducts = Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos : []
  const matchedProductIds = sanitizeStringArray(fallbackProducts.map((item) => item?.id))
  const hasLegacySession =
    fallbackSearchTerm ||
    matchedProductIds.length ||
    sanitizeNumber(context?.catalogo?.paginationNextOffset, 0) > 0 ||
    sanitizeNumber(context?.catalogo?.paginationTotal, 0) > 0 ||
    context?.catalogo?.paginationHasMore === true ||
    sanitizeString(context?.catalogo?.snapshotId)

  if (!hasLegacySession) {
    return null
  }

  return {
    id: "",
    snapshotId: sanitizeString(context?.catalogo?.snapshotId),
    searchTerm: fallbackSearchTerm,
    matchedProductIds,
    offset: sanitizeNumber(context?.catalogo?.paginationOffset, 0),
    nextOffset: sanitizeNumber(context?.catalogo?.paginationNextOffset, 0),
    poolLimit: sanitizeNumber(context?.catalogo?.paginationPoolLimit, 24),
    hasMore: context?.catalogo?.paginationHasMore === true,
    total: sanitizeNumber(context?.catalogo?.paginationTotal, matchedProductIds.length),
    source: "storefront_snapshot",
  }
}

function isStructuredCatalogAction(context = {}) {
  const action = normalizeMessage(context?.ui?.catalogAction || context?.catalogAction || "")
  return action === "load_more" || action === "product_detail"
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

function hasLockedProductDetailContext(context = {}) {
  return Boolean(
    context?.catalogo?.produtoAtual?.nome &&
      (getConversationMode(context) === "product_detail" ||
        context?.ui?.productDetailPreferred === true ||
        context?.storefront?.pageKind === "product_detail")
  )
}

function isMercadoLivrePurchaseIntent(message) {
  return /\b(gostei|quero|comprar|manda o link|vou querer)\b/i.test(String(message || ""))
}

function isMercadoLivreDetailIntent(message) {
  return /\b(garantia|frete|estoque|detalhes|detalhe|mais informac(?:ao|oes)|me fala mais|explica melhor|descricao|especificac(?:ao|oes)|ficha tecnica|cor|material|serve|combina|link|preco|valor|quanto)\b/i.test(
    String(message || "")
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

function shouldTreatMessageAsStorewideCatalogSearch(message, context, productSearchCandidates = [], detectProductSearch = null) {
  if (!hasFocusedCatalogProductContext(context)) {
    return false
  }

  if (normalizeMessage(context?.ui?.catalogAction || context?.catalogAction || "") === "product_detail") {
    return false
  }

  if (typeof detectProductSearch === "function" && detectProductSearch(message) !== true) {
    return false
  }

  if (!Array.isArray(productSearchCandidates) || productSearchCandidates.length === 0) {
    return false
  }

  if (isCatalogLoadMoreIntent(message)) {
    return false
  }

  if (isMercadoLivreDetailIntent(message) || isMercadoLivrePurchaseIntent(message) || isImplicitCurrentProductReference(message)) {
    return false
  }

  return true
}

function shouldStayOnCurrentProduct(message, context, currentProduct) {
  if (!currentProduct?.nome || !hasFocusedCatalogProductContext(context)) {
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

function hasCatalogContinuationAnchor(context = {}, recentCatalogProducts = []) {
  const listingSession = getCatalogListingSession(context)
  const lastSearchTerm = sanitizeString(listingSession?.searchTerm || context?.catalogo?.ultimaBusca)
  const hasRecentProducts = Array.isArray(recentCatalogProducts) && recentCatalogProducts.length > 0
  const hasPaginationContext =
    sanitizeNumber(listingSession?.nextOffset, sanitizeNumber(context?.catalogo?.paginationNextOffset, 0)) > 0 ||
    sanitizeNumber(listingSession?.total, sanitizeNumber(context?.catalogo?.paginationTotal, 0)) > 0 ||
    listingSession?.hasMore === true ||
    context?.catalogo?.paginationHasMore === true
  const hasSnapshotContext = Boolean(sanitizeString(listingSession?.snapshotId || context?.catalogo?.snapshotId))

  return Boolean(lastSearchTerm || hasRecentProducts || hasPaginationContext || hasSnapshotContext)
}

function resolveExplicitCatalogContinuationDecision(message, context = {}, recentCatalogProducts = []) {
  const explicitIndexMap = {
    "1": 0,
    "2": 1,
    "3": 2,
  }
  const explicitAction = normalizeMessage(context?.ui?.catalogAction || context?.catalogAction || "")
  const explicitProductId = sanitizeString(context?.ui?.catalogProductId || context?.catalogProductId)
  const explicitListingSessionId = sanitizeString(context?.ui?.listingSessionId || context?.listingSessionId)
  const listingSession = getCatalogListingSession(context)
  const matchesListingSession =
    !explicitListingSessionId ||
    !sanitizeString(listingSession?.id) ||
    sanitizeString(listingSession?.id) === explicitListingSessionId

  if (explicitAction === "load_more" && hasCatalogContinuationAnchor(context, recentCatalogProducts) && matchesListingSession) {
    return {
      kind: "catalog_load_more",
      confidence: 1,
      reason: "explicit_catalog_load_more_action",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: false,
    }
  }

  if (explicitAction === "load_more") {
    return {
      kind: "explicit_cannot_continue_listing",
      confidence: 1,
      reason: "explicit_catalog_load_more_without_valid_session",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: true,
    }
  }

  if (explicitAction === "product_detail" && explicitProductId) {
    const candidateProducts = [
      ...recentCatalogProducts,
      context?.catalogo?.produtoAtual,
    ].filter(Boolean)
    const selectedProduct = candidateProducts.find((item) => {
      if (sanitizeString(item?.id) !== explicitProductId) {
        return false
      }

      if (!explicitListingSessionId || !sanitizeString(listingSession?.id)) {
        return true
      }

      return sanitizeString(listingSession.id) === explicitListingSessionId
    })
    if (selectedProduct) {
      return {
        kind: "recent_product_reference",
        confidence: 1,
        reason: "explicit_catalog_product_detail_action",
        matchedProducts: [selectedProduct],
        usedLlm: false,
        shouldBlockNewSearch: true,
      }
    }
  }

  if (explicitAction === "product_detail") {
    return {
      kind: "explicit_product_detail_unresolved",
      confidence: 1,
      reason: "explicit_catalog_product_detail_unresolved",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: true,
    }
  }

  const channelKind = String(context?.channel?.kind || context?.canal || "").trim().toLowerCase()
  const normalizedMessage = normalizeMessage(message)
  if (channelKind === "whatsapp" && Object.prototype.hasOwnProperty.call(explicitIndexMap, normalizedMessage)) {
    const selectedProduct = recentCatalogProducts[explicitIndexMap[normalizedMessage]]
    if (selectedProduct) {
      return {
        kind: "recent_product_reference",
        confidence: 1,
        reason: "explicit_catalog_item_command",
        matchedProducts: [selectedProduct],
        usedLlm: false,
        shouldBlockNewSearch: true,
      }
    }
  }

  if (channelKind === "whatsapp" && normalizedMessage === "mais" && hasCatalogContinuationAnchor(context, recentCatalogProducts)) {
    return {
      kind: "catalog_load_more",
      confidence: 1,
      reason: "explicit_catalog_load_more_command",
      matchedProducts: [],
      usedLlm: false,
      shouldBlockNewSearch: false,
    }
  }

  return null
}

function shouldContinueRecentCatalogListing(inferredDecision, context = {}, recentCatalogProducts = []) {
  return inferredDecision?.kind === "catalog_load_more" && hasCatalogContinuationAnchor(context, recentCatalogProducts)
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

function detectCatalogComparisonIntent(message = "") {
  const normalized = normalizeMessage(message)

  if (/\b(vale mais a pena|qual e melhor|qual melhor|melhor opcao|compensa mais|qual voce indica|qual voce recomenda)\b/.test(normalized)) {
    return "best_choice"
  }

  if (/\b(mais caro|maior preco|maior valor|produto mais caro)\b/.test(normalized)) {
    return "highest_price"
  }

  if (/\b(mais barato|menor preco|menor valor|produto mais barato)\b/.test(normalized)) {
    return "lowest_price"
  }

  return null
}

export function normalizeCatalogComparisonIntent(value) {
  return ["best_choice", "highest_price", "lowest_price"].includes(String(value || "")) ? String(value) : null
}

export function resolveCatalogComparisonIndexes(message, products = []) {
  const normalized = normalizeMessage(message)
  const patterns = [
    { pattern: /\b1\b|\bum\b|\bprimeiro\b|\bprimeira\b/, index: 0 },
    { pattern: /\b2\b|\bsegundo\b|\bsegunda\b/, index: 1 },
    { pattern: /\b3\b|\bterceiro\b|\bterceira\b/, index: 2 },
  ]

  return [...new Set(patterns.filter((item) => item.pattern.test(normalized)).map((item) => item.index))].filter((index) => products[index])
}

function buildCatalogAdvantageLines(product) {
  const lines = []
  if (product?.freeShipping) lines.push("frete gratis")
  if (product?.warranty) lines.push(`garantia ${product.warranty}`)
  if (product?.preco != null) lines.push(`preco ${formatCurrency(product.preco)}`)
  if (sanitizeNumber(product?.availableQuantity, 0) > 0) lines.push(`${sanitizeNumber(product.availableQuantity, 0)} em estoque`)
  if (product?.material) lines.push(product.material)
  if (product?.cor) lines.push(product.cor)
  return lines
}

function scoreCatalogBestChoiceProduct(product) {
  let score = 0
  if (Number.isFinite(Number(product?.preco))) score += Math.max(0, 1000 - Number(product.preco)) / 100
  if (sanitizeNumber(product?.availableQuantity, 0) > 0) score += 4
  if (product?.freeShipping) score += 3
  if (product?.warranty) score += 2
  if (product?.material) score += 1
  if (product?.cor) score += 1
  return score
}

function selectCatalogProductByComparison(products, comparisonIntent) {
  const pricedProducts = (Array.isArray(products) ? products : []).filter((item) => Number.isFinite(Number(item?.preco)))
  if (!pricedProducts.length || !comparisonIntent || !["highest_price", "lowest_price"].includes(comparisonIntent)) {
    return null
  }

  return pricedProducts.reduce((selected, item) => {
    if (!selected) {
      return item
    }

    return comparisonIntent === "lowest_price"
      ? Number(item.preco) < Number(selected.preco)
        ? item
        : selected
      : Number(item.preco) > Number(selected.preco)
        ? item
        : selected
  }, null)
}

function buildCatalogComparisonReply(product, comparisonIntent, totalProducts) {
  if (!product?.nome || product?.preco == null || !comparisonIntent) {
    return null
  }

  const intro =
    comparisonIntent === "lowest_price"
      ? "Dos itens que te mostrei, o mais barato e"
      : "Dos itens que te mostrei, o mais caro e"
  const price = formatCurrency(product.preco)
  const detail = totalProducts > 1 ? ` entre ${totalProducts} opcoes recentes` : ""

  return `${intro} ${product.nome}${detail}: ${price}.`
}

function buildCatalogBestChoiceReply(products, selectedIndexes) {
  const comparedProducts = selectedIndexes.map((index) => products[index]).filter(Boolean)
  if (comparedProducts.length < 2) {
    return null
  }

  const ranked = [...comparedProducts].sort((left, right) => scoreCatalogBestChoiceProduct(right) - scoreCatalogBestChoiceProduct(left))
  const winner = ranked[0]
  const runnerUp = ranked[1]
  if (!winner?.nome || !runnerUp?.nome) {
    return null
  }

  const winnerReasons = buildCatalogAdvantageLines(winner).slice(0, 3)
  const runnerReasons = buildCatalogAdvantageLines(runnerUp).slice(0, 2)

  return [
    `Entre ${winner.nome} e ${runnerUp.nome}, eu iria em ${winner.nome}.`,
    winnerReasons.length ? `Ele sai na frente por ${winnerReasons.join(", ")}.` : "",
    runnerReasons.length ? `${runnerUp.nome} ainda pode fazer sentido se o seu foco for ${runnerReasons.join(", ")}.` : "",
    "Se quiser, eu tambem posso te dizer qual dos dois faz mais sentido pelo estilo ou pela faixa de preco.",
  ]
    .filter(Boolean)
    .join(" ")
}

function isConcreteRecentCatalogReferenceDecision(decision) {
  return decision?.kind === "recent_product_reference" && Array.isArray(decision?.matchedProducts) && decision.matchedProducts.length === 1
}

function mergeCatalogSemanticAndHeuristicDecision(semanticDecision, heuristicDecision) {
  if (!semanticDecision) {
    return heuristicDecision ?? null
  }

  if (semanticDecision.kind === "recent_product_reference_unresolved" && isConcreteRecentCatalogReferenceDecision(heuristicDecision)) {
    return heuristicDecision
  }

  return semanticDecision
}

export function resolveCatalogIntentState(input = {}) {
  const latestUserMessage = input.latestUserMessage
  const context = input.context ?? {}
  const contextCatalog = context?.catalogo ?? {}
  const listingSession = getCatalogListingSession(context)
  const recentCatalogProducts = Array.isArray(input.recentCatalogProducts)
    ? input.recentCatalogProducts
    : normalizeRecentCatalogProducts(context)

  const inferredDecision =
    input.catalogDecision ??
    detectCatalogSearchRefinement(latestUserMessage, context, {
      buildProductSearchCandidates: input.buildProductSearchCandidates,
      shouldSearchProducts: input.detectProductSearch,
    })

  const referencedCatalogProducts =
    inferredDecision?.matchedProducts ??
    (input.resolveRecentCatalogProductReference ?? resolveRecentCatalogProductReference)(latestUserMessage, context)

  const productSearchCandidates = (input.buildProductSearchCandidates ?? buildProductSearchCandidates)(latestUserMessage)
  const implicitSingleRecentProduct =
    !referencedCatalogProducts?.length &&
    !contextCatalog.produtoAtual &&
    recentCatalogProducts.length === 1 &&
    isImplicitCurrentProductReference(latestUserMessage)
      ? recentCatalogProducts[0]
      : null

  const candidateCurrentCatalogProduct =
    referencedCatalogProducts?.[0] ?? contextCatalog.produtoAtual ?? implicitSingleRecentProduct ?? null

  const semanticSearchCandidates =
    inferredDecision?.kind === "similar_items_search" ||
    inferredDecision?.kind === "same_type_search" ||
    (inferredDecision?.kind === "catalog_alternative_search" &&
      (inferredDecision?.relation === "same_type" || inferredDecision?.relation === "similar"))
      ? buildCatalogSimilarSearchCandidates(candidateCurrentCatalogProduct, inferredDecision?.searchCandidates?.[0])
      : []
  const storewideCatalogSearchRequested = shouldTreatMessageAsStorewideCatalogSearch(
    latestUserMessage,
    context,
    [...semanticSearchCandidates, ...productSearchCandidates].filter(Boolean),
    input.detectProductSearch
  )

  const shouldContinueListing =
    shouldContinueRecentCatalogListing(inferredDecision, context, recentCatalogProducts)

  const shouldExitCurrentProductContext =
    storewideCatalogSearchRequested ||
    (inferredDecision?.kind === "catalog_search_refinement" && inferredDecision?.usedLlm === true) ||
    inferredDecision?.kind === "same_type_search" ||
    inferredDecision?.kind === "similar_items_search" ||
    inferredDecision?.kind === "catalog_alternative_search" ||
    shouldContinueListing

  const stayOnCurrentProduct =
    !shouldContinueListing &&
    (Boolean(implicitSingleRecentProduct) ||
      (referencedCatalogProducts?.length === 1 && !shouldExitCurrentProductContext) ||
      (!shouldExitCurrentProductContext &&
        shouldStayOnCurrentProduct(latestUserMessage, context, candidateCurrentCatalogProduct)))

  const forceNewSearch =
    (storewideCatalogSearchRequested ||
      inferredDecision?.kind === "catalog_search_refinement" ||
      inferredDecision?.kind === "same_type_search" ||
      inferredDecision?.kind === "similar_items_search" ||
      inferredDecision?.kind === "catalog_alternative_search") &&
    !stayOnCurrentProduct
  const shouldPreserveCurrentCatalogProduct =
    !forceNewSearch && inferredDecision?.kind !== "catalog_load_more"
  const currentCatalogProduct = shouldPreserveCurrentCatalogProduct ? candidateCurrentCatalogProduct : null
  const genericCatalogListingRequested = stayOnCurrentProduct
    ? false
    : Boolean(input.isCatalogListingIntent?.(latestUserMessage) ?? isMercadoLivreListingIntent(latestUserMessage))
  const loadMoreCatalogRequested =
    !forceNewSearch &&
    !stayOnCurrentProduct &&
    !input.catalogComparisonIntent &&
    inferredDecision?.kind === "catalog_load_more"

  return {
    catalogDecision: inferredDecision ?? null,
    referencedCatalogProducts,
    currentCatalogProduct,
    recentCatalogProducts,
    stayOnCurrentProduct,
    forceNewSearch,
    productSearchRequested: stayOnCurrentProduct
      ? false
      : forceNewSearch || Boolean(input.detectProductSearch?.(latestUserMessage)),
    genericCatalogListingRequested,
    loadMoreCatalogRequested,
    productSearchTerm:
      loadMoreCatalogRequested && inferredDecision?.kind !== "catalog_search_refinement"
        ? ""
        : semanticSearchCandidates[0] ??
          inferredDecision?.uncoveredTokens?.[0] ??
          inferredDecision?.searchCandidates?.[0] ??
          productSearchCandidates[0] ??
          "",
    excludeCurrentProductFromSearch: inferredDecision?.excludeCurrentProduct === true,
    priceMaxExclusive:
      inferredDecision?.kind === "catalog_alternative_search" && inferredDecision?.priceConstraint === "below_current"
        ? candidateCurrentCatalogProduct?.preco == null
          ? null
          : sanitizeNumber(candidateCurrentCatalogProduct.preco, null)
        : null,
    allowEmptyCatalogSearch: inferredDecision?.kind === "catalog_alternative_search",
    lastSearchTerm: sanitizeString(listingSession?.searchTerm || contextCatalog.ultimaBusca),
    paginationOffset: forceNewSearch
      ? 0
      : loadMoreCatalogRequested
        ? sanitizeNumber(listingSession?.nextOffset, sanitizeNumber(contextCatalog.paginationNextOffset, sanitizeNumber(contextCatalog.paginationOffset, 0)))
        : 0,
    paginationPoolLimit: sanitizeNumber(listingSession?.poolLimit, sanitizeNumber(contextCatalog.paginationPoolLimit, 24)),
    hasMoreFromContext: listingSession?.hasMore === true || contextCatalog.paginationHasMore === true,
    listingSession,
    hasStructuredCatalogAction: isStructuredCatalogAction(context),
  }
}

export function resolveCatalogDecisionState(input = {}) {
  const context = input.context ?? {}
  const recentCatalogProducts = normalizeRecentCatalogProducts(context)
  const hasCatalogContinuationState = hasCatalogContinuationAnchor(context, recentCatalogProducts)
  const explicitDecision = resolveExplicitCatalogContinuationDecision(
    input.latestUserMessage,
    context,
    recentCatalogProducts
  )
  if (explicitDecision) {
    const catalogReferenceReply = resolveCatalogReferenceHeuristicReply(explicitDecision)

    return {
      explicitDecision,
      heuristicDecision: null,
      catalogDecision: explicitDecision,
      catalogReferenceReply,
    }
  }

  const semanticDecision = input.semanticDecision ?? null
  const shouldEvaluateHeuristicCatalogFollowUp =
    (!semanticDecision || semanticDecision.kind === "recent_product_reference_unresolved") &&
    (input.shouldUseCatalog || hasCatalogContinuationState || context?.catalogo?.produtoAtual) &&
    (hasCatalogContinuationState || context?.catalogo?.produtoAtual)

  const heuristicDecision = shouldEvaluateHeuristicCatalogFollowUp
    ? resolveDeterministicCatalogFollowUpDecision(input.latestUserMessage, context, {
        buildProductSearchCandidates: input.buildProductSearchCandidates,
        shouldSearchProducts: input.shouldSearchProducts,
      })
    : null

  const catalogDecision = mergeCatalogSemanticAndHeuristicDecision(semanticDecision, heuristicDecision)
  const catalogReferenceReply = resolveCatalogReferenceHeuristicReply(catalogDecision)

  return {
    heuristicDecision,
    catalogDecision,
    catalogReferenceReply,
  }
}

function resolveCatalogSemanticComparisonIndexes(indexes, products = []) {
  return [...new Set((Array.isArray(indexes) ? indexes : []).map((item) => Number(item) - 1))]
    .filter((index) => Number.isInteger(index) && index >= 0 && products[index])
}

function isPriceRankingComparisonIntent(value) {
  return value === "highest_price" || value === "lowest_price"
}

export function resolveCatalogComparisonState(input = {}) {
  const products = Array.isArray(input.products) ? input.products.filter(Boolean) : []
  if (!products.length) {
    return {
      comparisonIntent: null,
      comparisonIndexes: [],
      selectedProduct: null,
      comparisonReply: null,
    }
  }

  const comparisonIntent = normalizeCatalogComparisonIntent(input.comparisonIntent) ?? detectCatalogComparisonIntent(input.latestUserMessage)
  const comparisonIndexes = resolveCatalogComparisonIndexes(input.latestUserMessage, products)
  const selectedProduct = selectCatalogProductByComparison(products, comparisonIntent)

  if (selectedProduct) {
    return {
      comparisonIntent,
      comparisonIndexes,
      selectedProduct,
      comparisonReply: buildCatalogComparisonReply(selectedProduct, comparisonIntent, products.length),
    }
  }

  if (comparisonIntent === "best_choice") {
    return {
      comparisonIntent,
      comparisonIndexes,
      selectedProduct: null,
      comparisonReply: buildCatalogBestChoiceReply(products, comparisonIndexes),
    }
  }

  return {
    comparisonIntent,
    comparisonIndexes,
    selectedProduct: null,
    comparisonReply: null,
  }
}

export function resolveCatalogComparisonDecisionState(input = {}) {
  const products = Array.isArray(input.products) ? input.products.filter(Boolean) : []
  const comparisonIntent = normalizeCatalogComparisonIntent(input.comparisonIntent)
  const semanticIndexes = resolveCatalogSemanticComparisonIndexes(input.referencedProductIndexes, products)
  const baseState = resolveCatalogComparisonState({
    latestUserMessage: input.latestUserMessage,
    products,
    comparisonIntent,
  })

  if (!comparisonIntent) {
    return {
      ...baseState,
      comparisonIndexes: semanticIndexes.length ? semanticIndexes : baseState.comparisonIndexes,
    }
  }

  const textualIndexes = resolveCatalogComparisonIndexes(input.latestUserMessage, products)
  const hasExplicitIndexes = textualIndexes.length >= 2
  const hasRecentListContext = input.hasRecentListContext === true
  const allowTextualComparison = isPriceRankingComparisonIntent(comparisonIntent)
    ? hasExplicitIndexes || hasRecentListContext
    : hasExplicitIndexes

  if (!input.isSemanticComparison && !allowTextualComparison) {
    return {
      comparisonIntent,
      comparisonIndexes: textualIndexes,
      selectedProduct: null,
      comparisonReply: null,
    }
  }

  if (comparisonIntent === "best_choice" && semanticIndexes.length >= 2) {
    const indexedProducts = semanticIndexes.map((index) => products[index]).filter(Boolean)
    const semanticState = resolveCatalogComparisonState({
      latestUserMessage: "qual vale mais a pena entre o 1 e o 2",
      products: indexedProducts,
      comparisonIntent,
    })

    return {
      comparisonIntent,
      comparisonIndexes: semanticIndexes,
      selectedProduct: null,
      comparisonReply: semanticState.comparisonReply,
    }
  }

  return {
    ...baseState,
    comparisonIntent,
    comparisonIndexes: semanticIndexes.length ? semanticIndexes : baseState.comparisonIndexes,
  }
}

export function resolveCatalogExecutionState(input = {}) {
  const products =
    Array.isArray(input.products)
      ? input.products.filter(Boolean)
      : Array.isArray(input.context?.catalogo?.ultimosProdutos)
        ? input.context.catalogo.ultimosProdutos.filter(Boolean)
        : []

  const comparisonState = resolveCatalogComparisonState({
    latestUserMessage: input.latestUserMessage,
    products,
    comparisonIntent: input.comparisonIntent,
  })

  const intentState = resolveCatalogIntentState({
    ...input,
    recentCatalogProducts: products.length ? products : input.recentCatalogProducts,
    catalogComparisonIntent: comparisonState.comparisonIntent,
  })

  const action =
    comparisonState.comparisonReply
      ? "comparison"
      : intentState.forceNewSearch
        ? "search"
        : intentState.loadMoreCatalogRequested
          ? "load_more"
          : intentState.currentCatalogProduct?.nome
            ? "current_product"
            : intentState.genericCatalogListingRequested
              ? "listing"
              : "idle"

  return {
    action,
    products,
    comparisonState,
    intentState,
    currentCatalogProduct: intentState.currentCatalogProduct,
    referencedCatalogProducts: intentState.referencedCatalogProducts,
    recentCatalogProducts: intentState.recentCatalogProducts,
  }
}
