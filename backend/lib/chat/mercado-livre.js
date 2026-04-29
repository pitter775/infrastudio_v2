import { getMercadoLivreProductByIdForProject, searchMercadoLivreProductsForProject } from "@/lib/mercado-livre-connector"
import { getMercadoLivreStoreSettingsForProject } from "@/lib/mercado-livre-store"
import { detectCatalogSearchRefinement, resolveRecentCatalogProductReference } from "@/lib/chat/catalog-follow-up"
import { buildCatalogSimilarSearchCandidates } from "@/lib/chat/catalog-state"
import { buildProductSearchCandidates, isMercadoLivreListingIntent } from "@/lib/chat/sales-heuristics"

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function sanitizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
  const stockQuantity = sanitizeNumber(item?.availableQuantity, 0)
  const stockLabel = stockQuantity > 0 ? `${stockQuantity} em estoque` : ""
  const productSlug = sanitizeString(item?.slug) || slugifyProduct(item?.title)

  return {
    id: sanitizeString(item?.id || `mercado-livre-${index + 1}`),
    kind: "product",
    provider: "mercado_livre",
    categoria: "image",
    nome: sanitizeString(item?.title || "Produto"),
    slug: productSlug,
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

  return {
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
    ? `Encontrei ${countLabel}${storeSuffix}. Vou te mostrar as principais opcoes agora e posso trazer mais depois.`
    : `Encontrei ${countLabel}${storeSuffix}. Vou te mostrar as opcoes disponiveis agora.`
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

function isMercadoLivreFactualIntent(message) {
  return (
    isMercadoLivrePriceIntent(message) ||
    isMercadoLivreMaterialIntent(message) ||
    isMercadoLivreColorIntent(message) ||
    isMercadoLivreStockIntent(message) ||
    isMercadoLivreWarrantyIntent(message) ||
    isMercadoLivreLinkIntent(message) ||
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
    if (product.link) {
      pushUniqueSentence(pieces, "Se quiser, eu mando o link do anuncio para voce conferir o envio direto por la.")
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
    pushUniqueSentence(pieces, `Variacoes visiveis: ${product.variacoesResumo.join(", ")}.`)
  }
  if (product.descricaoLonga) {
    pushUniqueSentence(pieces, `Resumo: ${product.descricaoLonga.slice(0, 220)}${product.descricaoLonga.length > 220 ? "..." : ""}`)
  }
  if (product.status && product.status !== "active") {
    pushUniqueSentence(pieces, `Status atual no Mercado Livre: ${product.status}.`)
  }
  if (product.link) {
    pushUniqueSentence(pieces, "Se quiser, eu mando o link direto do anuncio.")
  }
  pushUniqueSentence(pieces, "Se quiser, eu tambem comparo com outra opcao da lista.")

  return pieces.join(" ")
}

export function buildFocusedProductFactualReply(product, userMessage = "") {
  if (!product?.nome) {
    return null
  }

  const pieces = []

  if (isMercadoLivrePriceIntent(userMessage)) {
    if (product.preco != null) {
      pieces.push(`O valor atual deste produto e ${formatCurrency(product.preco)}.`)
    } else {
      pieces.push("Nao encontrei o valor exato deste produto no momento.")
    }
  }

  if (isMercadoLivreMaterialIntent(userMessage)) {
    if (product.material) {
      pieces.push(`O material deste produto e ${product.material}.`)
    } else {
      pieces.push("Nao encontrei o material informado deste produto no momento.")
    }
  }

  if (isMercadoLivreColorIntent(userMessage)) {
    if (product.cor) {
      pieces.push(`A cor ou acabamento informado e ${product.cor}.`)
    } else {
      pieces.push("Nao encontrei a cor ou acabamento informado deste produto no momento.")
    }
  }

  if (isMercadoLivreStockIntent(userMessage)) {
    if (sanitizeNumber(product.availableQuantity, 0) > 0) {
      pieces.push(
        `No momento eu vejo ${sanitizeNumber(product.availableQuantity, 0)} unidade${sanitizeNumber(product.availableQuantity, 0) > 1 ? "s" : ""} em estoque.`
      )
    } else {
      pieces.push("Nao encontrei estoque disponivel para este item no momento.")
    }
  }

  if (isMercadoLivreWarrantyIntent(userMessage)) {
    if (product.warranty && !/^sem garantia$/i.test(product.warranty)) {
      pieces.push(`A garantia informada no anuncio e ${product.warranty}.`)
    } else {
      pieces.push("Nao encontrei garantia informada neste anuncio.")
    }
  }

  if (isMercadoLivreDeliveryIntent(userMessage)) {
    pieces.push(
      product.freeShipping
        ? "A entrega e feita pelo Mercado Livre e este anuncio indica frete gratis."
        : "A entrega e feita pelo Mercado Livre e o frete aparece no checkout conforme o seu CEP."
    )
  }

  if (isMercadoLivreLinkIntent(userMessage)) {
    if (product.link) {
      pieces.push(`Se quiser, eu mando o link direto do anuncio: ${product.link}`)
    } else {
      pieces.push("Nao encontrei o link direto deste anuncio no momento.")
    }
  }

  return pieces.length ? pieces.join(" ") : null
}

export function shouldAttachMercadoLivreAssetForMessage(message = "") {
  return isMercadoLivreLinkIntent(message) || isMercadoLivrePurchaseIntent(message)
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

function normalizeRecentCatalogProducts(context) {
  return Array.isArray(context?.catalogo?.ultimosProdutos) ? context.catalogo.ultimosProdutos.filter(Boolean) : []
}

function normalizeComparisonMessage(message) {
  return String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function detectCatalogComparisonIntent(message) {
  const normalized = normalizeComparisonMessage(message)

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

function resolveCatalogComparisonIndexes(message, products) {
  const normalized = normalizeComparisonMessage(message)
  const patterns = [
    { pattern: /\b1\b|\bum\b|\bprimeiro\b|\bprimeira\b/, index: 0 },
    { pattern: /\b2\b|\bsegundo\b|\bsegunda\b/, index: 1 },
    { pattern: /\b3\b|\bterceiro\b|\bterceira\b/, index: 2 },
  ]
  const matchedIndexes = patterns.filter((item) => item.pattern.test(normalized)).map((item) => item.index)
  const uniqueIndexes = [...new Set(matchedIndexes)].filter((index) => products[index])
  return uniqueIndexes
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
  const inferredRefinementDecision =
    input.catalogFollowUpDecision ??
    detectCatalogSearchRefinement(input.latestUserMessage, input.context, {
      buildProductSearchCandidates: input.buildProductSearchCandidates,
      shouldSearchProducts: input.detectProductSearch,
    })
  const referencedCatalogProducts =
    inferredRefinementDecision?.matchedProducts ??
    (input.resolveRecentCatalogProductReference ?? resolveRecentCatalogProductReference)(input.latestUserMessage, input.context)
  const productSearchCandidates = (input.buildProductSearchCandidates ?? buildProductSearchCandidates)(input.latestUserMessage)
  const contextCatalog = input.context?.catalogo ?? {}
  const recentCatalogProducts = normalizeRecentCatalogProducts(input.context)
  const catalogComparisonIntent = detectCatalogComparisonIntent(input.latestUserMessage)
  const implicitSingleRecentProduct =
    !referencedCatalogProducts?.length &&
    !contextCatalog.produtoAtual &&
    recentCatalogProducts.length === 1 &&
    isImplicitCurrentProductReference(input.latestUserMessage)
      ? recentCatalogProducts[0]
      : null
  const candidateCurrentCatalogProduct =
    referencedCatalogProducts?.[0] ?? contextCatalog.produtoAtual ?? implicitSingleRecentProduct ?? null
  const semanticSearchCandidates =
    inferredRefinementDecision?.kind === "similar_items_search" || inferredRefinementDecision?.kind === "same_type_search"
      ? buildCatalogSimilarSearchCandidates(candidateCurrentCatalogProduct, inferredRefinementDecision?.searchCandidates?.[0])
      : []
  const shouldExitCurrentProductContext =
    inferredRefinementDecision?.kind === "same_type_search" ||
    inferredRefinementDecision?.kind === "similar_items_search"
  const stayOnCurrentProduct =
    Boolean(implicitSingleRecentProduct) ||
    (referencedCatalogProducts?.length === 1 && !shouldExitCurrentProductContext) ||
    (!shouldExitCurrentProductContext &&
      shouldStayOnCurrentProduct(input.latestUserMessage, input.context, candidateCurrentCatalogProduct))
  const forceNewSearch =
    (inferredRefinementDecision?.kind === "catalog_search_refinement" || shouldExitCurrentProductContext) && !stayOnCurrentProduct
  const currentCatalogProduct = forceNewSearch ? null : candidateCurrentCatalogProduct
  const loadMoreCatalogRequested =
    !forceNewSearch &&
    !stayOnCurrentProduct &&
    !catalogComparisonIntent &&
    (/\b(mais|outras|outros|opcoes|modelos)\b/i.test(String(input.latestUserMessage || "")) ||
      /\b(manda|mande|envia|envie|mostra|mostre|traz|traga)\b[\s\S]{0,40}\btiver(?:em)?\b/i.test(String(input.latestUserMessage || "")) ||
      /\b(o que tiver|oq tiver|q tiver|qualquer um|qualquer coisa)\b/i.test(String(input.latestUserMessage || "")))

  return {
    productSearchRequested: stayOnCurrentProduct
      ? false
      : forceNewSearch || Boolean(input.detectProductSearch?.(input.latestUserMessage)),
    genericMercadoLivreListingRequested: stayOnCurrentProduct
      ? false
      : Boolean(input.isMercadoLivreListingIntent?.(input.latestUserMessage) ?? isMercadoLivreListingIntent(input.latestUserMessage)),
    forceNewSearch,
    loadMoreCatalogRequested,
    catalogComparisonIntent,
    referencedCatalogProducts,
    currentCatalogProduct,
    recentCatalogProducts,
    catalogFollowUpDecision: inferredRefinementDecision ?? null,
    productSearchTerm:
      loadMoreCatalogRequested && inferredRefinementDecision?.kind !== "catalog_search_refinement"
        ? ""
        :
      semanticSearchCandidates[0] ??
      inferredRefinementDecision?.uncoveredTokens?.[0] ??
      inferredRefinementDecision?.searchCandidates?.[0] ??
      productSearchCandidates[0] ??
      "",
    excludeCurrentProductFromSearch: inferredRefinementDecision?.excludeCurrentProduct === true,
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

export async function resolveMercadoLivreHeuristicState(input = {}) {
  let currentProduct = input.currentCatalogProduct ?? input.referencedCatalogProducts?.[0] ?? input.context?.catalogo?.produtoAtual
  const recentCatalogProducts = Array.isArray(input.recentCatalogProducts) ? input.recentCatalogProducts : normalizeRecentCatalogProducts(input.context)
  const catalogComparisonProduct = selectCatalogProductByComparison(recentCatalogProducts, input.catalogComparisonIntent)
  const catalogComparisonIndexes = resolveCatalogComparisonIndexes(input.latestUserMessage, recentCatalogProducts)
  const projectHasMercadoLivre = hasMercadoLivreConnection(input.project, input.context)
  const focusedProductContext = hasFocusedCatalogProductContext(input.context)

  if (catalogComparisonProduct) {
    return {
      selectedProductSalesReply: null,
      mercadoLivreHeuristicReply: buildCatalogComparisonReply(
        catalogComparisonProduct,
        input.catalogComparisonIntent,
        recentCatalogProducts.length
      ),
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: catalogComparisonProduct,
    }
  }

  if (input.catalogComparisonIntent === "best_choice") {
    const comparisonReply = buildCatalogBestChoiceReply(recentCatalogProducts, catalogComparisonIndexes)
    if (comparisonReply) {
      return {
        selectedProductSalesReply: null,
        mercadoLivreHeuristicReply: comparisonReply,
        mercadoLivreProducts: [],
        mercadoLivreAssets: [],
        catalogSearchState: null,
        selectedCatalogProduct: null,
      }
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
        : await getMercadoLivreStoreSettingsForProject(input.project)
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

  if (currentProduct && (isMercadoLivreDetailIntent(input.latestUserMessage) || isMercadoLivrePurchaseIntent(input.latestUserMessage))) {
    const factualReply = buildFocusedProductFactualReply(currentProduct, input.latestUserMessage)
    const shouldAttachAsset = isMercadoLivreLinkIntent(input.latestUserMessage) || isMercadoLivrePurchaseIntent(input.latestUserMessage)
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
  const freshSearchTerm = refinementSearchTerm || sanitizeString(input.productSearchTerm) || sanitizeString(input.latestUserMessage)
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
  const poolLimit = input.loadMoreCatalogRequested
    ? Math.max(12, sanitizeNumber(input.paginationPoolLimit, 24))
    : Math.max(18, sanitizeNumber(input.paginationPoolLimit, 24))
  const excludeItemIds =
    input.excludeCurrentProductFromSearch && currentProduct?.id
      ? [sanitizeString(currentProduct.id)].filter(Boolean)
      : []

  const { items, connector, paging, error } = await (input.resolveMercadoLivreSearch ?? searchMercadoLivreProductsForProject)(
    input.project,
    {
      searchTerm,
      limit: 3,
      offset: searchOffset,
      poolLimit,
      excludeItemIds,
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
        : "A loja esta conectada, mas nao consegui buscar os produtos agora. Tente novamente em instantes.",
      mercadoLivreProducts: [],
      mercadoLivreAssets: [],
      catalogSearchState: null,
      selectedCatalogProduct: null,
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
      selectedCatalogProduct: null,
    }
  }

  return {
    selectedProductSalesReply: null,
    mercadoLivreHeuristicReply: buildMercadoLivreSearchReply(products, searchTerm, connector, paging),
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
