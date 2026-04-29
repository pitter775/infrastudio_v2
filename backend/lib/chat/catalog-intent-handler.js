import {
  detectCatalogSearchRefinement,
  hasRecentCatalogSnapshot,
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

function isCatalogLoadMoreMessage(message = "") {
  return (
    /\b(mais|outras|outros|opcoes|modelos)\b/i.test(String(message || "")) ||
    /\b(manda|mande|envia|envie|mostra|mostre|traz|traga)\b[\s\S]{0,40}\btiver(?:em)?\b/i.test(String(message || "")) ||
    /\b(o que tiver|oq tiver|q tiver|qualquer um|qualquer coisa)\b/i.test(String(message || ""))
  )
}

function shouldContinueRecentCatalogListing(inferredDecision, recentCatalogProducts = []) {
  return inferredDecision?.kind === "catalog_load_more" && Array.isArray(recentCatalogProducts) && recentCatalogProducts.length > 0
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
    inferredDecision?.kind === "similar_items_search" || inferredDecision?.kind === "same_type_search"
      ? buildCatalogSimilarSearchCandidates(candidateCurrentCatalogProduct, inferredDecision?.searchCandidates?.[0])
      : []

  const shouldContinueListing =
    shouldContinueRecentCatalogListing(inferredDecision, recentCatalogProducts)

  const shouldExitCurrentProductContext =
    inferredDecision?.kind === "same_type_search" ||
    inferredDecision?.kind === "similar_items_search" ||
    shouldContinueListing

  const stayOnCurrentProduct =
    !shouldContinueListing &&
    (Boolean(implicitSingleRecentProduct) ||
      (referencedCatalogProducts?.length === 1 && !shouldExitCurrentProductContext) ||
      (!shouldExitCurrentProductContext &&
        shouldStayOnCurrentProduct(latestUserMessage, context, candidateCurrentCatalogProduct)))

  const forceNewSearch =
    (inferredDecision?.kind === "catalog_search_refinement" ||
      inferredDecision?.kind === "same_type_search" ||
      inferredDecision?.kind === "similar_items_search") &&
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
    (inferredDecision?.kind === "catalog_load_more" || isCatalogLoadMoreMessage(latestUserMessage))

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
    lastSearchTerm: sanitizeString(contextCatalog.ultimaBusca),
    paginationOffset: forceNewSearch
      ? 0
      : loadMoreCatalogRequested
        ? sanitizeNumber(contextCatalog.paginationNextOffset, sanitizeNumber(contextCatalog.paginationOffset, 0))
        : 0,
    paginationPoolLimit: sanitizeNumber(contextCatalog.paginationPoolLimit, 24),
    hasMoreFromContext: contextCatalog.paginationHasMore === true,
  }
}

export function resolveCatalogDecisionState(input = {}) {
  const context = input.context ?? {}
  const semanticDecision = input.semanticDecision ?? null
  const shouldEvaluateHeuristicCatalogFollowUp =
    (!semanticDecision || semanticDecision.kind === "recent_product_reference_unresolved") &&
    (input.shouldUseCatalog || hasRecentCatalogSnapshot(context) || context?.catalogo?.produtoAtual) &&
    (hasRecentCatalogSnapshot(context) || context?.catalogo?.produtoAtual)

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
