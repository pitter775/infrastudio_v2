function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function normalizeMercadoLivreImageUrl(value) {
  const normalized = sanitizeString(value)
  if (!normalized) {
    return ""
  }

  return normalized.replace(/-([A-Z])(\.(jpg|jpeg|png|webp)(\?.*)?)$/i, "-O$2")
}

export function mapMercadoLivreItem(payload) {
  const attributes = Array.isArray(payload?.attributes)
    ? payload.attributes
        .map((attribute) => ({
          id: sanitizeString(attribute?.id),
          name: sanitizeString(attribute?.name),
          valueId: sanitizeString(attribute?.value_id),
          valueName: sanitizeString(attribute?.value_name || attribute?.value_struct?.name),
        }))
        .filter((attribute) => attribute.name && attribute.valueName)
    : []

  const pictures = Array.isArray(payload?.pictures)
    ? payload.pictures.map((picture) => normalizeMercadoLivreImageUrl(picture?.secure_url || picture?.url)).filter(Boolean)
    : []
  const variations = Array.isArray(payload?.variations)
    ? payload.variations
        .map((variation) => ({
          id: sanitizeString(variation?.id),
          availableQuantity: Number(variation?.available_quantity ?? 0),
          price: Number(variation?.price ?? payload?.price ?? 0),
          attributeCombinations: Array.isArray(variation?.attribute_combinations)
            ? variation.attribute_combinations
                .map((attribute) => ({
                  id: sanitizeString(attribute?.id),
                  name: sanitizeString(attribute?.name),
                  valueName: sanitizeString(attribute?.value_name),
                }))
                .filter((attribute) => attribute.name && attribute.valueName)
            : [],
        }))
        .filter((variation) => variation.id)
    : []

  return {
    id: sanitizeString(payload?.id),
    title: sanitizeString(payload?.title),
    price: Number(payload?.price ?? 0),
    currencyId: sanitizeString(payload?.currency_id),
    availableQuantity: Number(payload?.available_quantity ?? 0),
    status: sanitizeString(payload?.status),
    permalink: sanitizeString(payload?.permalink),
    thumbnail: normalizeMercadoLivreImageUrl(payload?.thumbnail),
    sellerId: sanitizeString(payload?.seller_id),
    sellerName: sanitizeString(payload?.seller_name),
    condition: sanitizeString(payload?.condition),
    warranty: sanitizeString(payload?.warranty),
    categoryId: sanitizeString(payload?.category_id),
    domainId: sanitizeString(payload?.domain_id),
    officialStoreId: sanitizeString(payload?.official_store_id),
    catalogProductId: sanitizeString(payload?.catalog_product_id),
    acceptsMercadoPago: payload?.accepts_mercadopago === true,
    freeShipping: payload?.shipping?.free_shipping === true,
    logisticType: sanitizeString(payload?.shipping?.logistic_type),
    attributes,
    pictures,
    variations,
    descriptionPlain: sanitizeString(payload?.descriptionPlain || payload?.description_plain),
    shortDescription: sanitizeString(payload?.shortDescription || payload?.short_description),
  }
}

export function mapMercadoLivreOrder(payload) {
  const buyer = payload?.buyer && typeof payload.buyer === "object" ? payload.buyer : {}
  const orderItems = Array.isArray(payload?.order_items) ? payload.order_items : []
  const firstItem = orderItems[0]?.item && typeof orderItems[0].item === "object" ? orderItems[0].item : {}
  const totalItems = orderItems.reduce((sum, item) => sum + (Number(item?.quantity ?? 0) || 0), 0)

  return {
    id: String(payload?.id ?? "").trim(),
    status: sanitizeString(payload?.status),
    statusDetail: sanitizeString(payload?.status_detail),
    totalAmount: Number(payload?.total_amount ?? 0),
    currencyId: sanitizeString(payload?.currency_id || "BRL"),
    dateCreated: sanitizeString(payload?.date_created),
    dateClosed: sanitizeString(payload?.date_closed),
    buyerNickname: sanitizeString(buyer?.nickname),
    buyerFirstName: sanitizeString(buyer?.first_name),
    buyerLastName: sanitizeString(buyer?.last_name),
    buyerId: String(buyer?.id ?? "").trim(),
    shippingId: String(payload?.shipping?.id ?? "").trim(),
    totalItems,
    firstItemTitle: sanitizeString(firstItem?.title),
    firstItemId: sanitizeString(firstItem?.id),
    tags: Array.isArray(payload?.tags) ? payload.tags.map((tag) => sanitizeString(tag)).filter(Boolean) : [],
  }
}

export function mapMercadoLivreQuestion(payload) {
  return {
    id: String(payload?.id ?? "").trim(),
    itemId: sanitizeString(payload?.item_id),
    sellerId: String(payload?.seller_id ?? "").trim(),
    status: sanitizeString(payload?.status),
    text: sanitizeString(payload?.text),
    dateCreated: sanitizeString(payload?.date_created),
    answerText: sanitizeString(payload?.answer?.text),
    answerStatus: sanitizeString(payload?.answer?.status),
    answerDateCreated: sanitizeString(payload?.answer?.date_created),
    fromId: String(payload?.from?.id ?? "").trim(),
    fromNickname: sanitizeString(payload?.from?.nickname),
  }
}

export function normalizeMercadoLivreSearchTokens(value) {
  return sanitizeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

export function scoreMercadoLivreItem(item, searchTerm) {
  const tokens = normalizeMercadoLivreSearchTokens(searchTerm)
  if (!tokens.length) {
    return 0
  }

  const haystack = normalizeMercadoLivreSearchTokens([item?.title, item?.sellerName].filter(Boolean).join(" "))
  if (!haystack.length) {
    return 0
  }

  let score = 0
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 6 ? 3 : 2
      continue
    }

    if (haystack.some((hay) => hay.includes(token) || token.includes(hay))) {
      score += 1
    }
  }

  return score
}
