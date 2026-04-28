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
          value: sanitizeString(attribute?.value_name || attribute?.value?.name || attribute?.value),
          valueLabel: sanitizeString(attribute?.value_name || attribute?.value?.name || attribute?.value),
          valueStruct: attribute?.value_struct && typeof attribute.value_struct === "object" ? attribute.value_struct : null,
          values: Array.isArray(attribute?.values) ? attribute.values : [],
          value_list: Array.isArray(attribute?.value_list) ? attribute.value_list : [],
          attributeGroupName: sanitizeString(attribute?.attribute_group_name || attribute?.attribute_group_id),
          attribute_group_name: sanitizeString(attribute?.attribute_group_name || attribute?.attribute_group_id),
        }))
        .filter((attribute) => attribute.name)
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
    installmentQuantity: Number(payload?.installments?.quantity ?? 0) || 0,
    installmentAmount: Number(payload?.installments?.amount ?? 0) || 0,
    installmentRate: Number(payload?.installments?.rate ?? 0) || 0,
    unitPrice: Number(payload?.sale_price?.price_per_unit ?? payload?.price_per_unit ?? 0) || 0,
    availableQuantity: Number(payload?.available_quantity ?? 0),
    status: sanitizeString(payload?.status),
    permalink: sanitizeString(payload?.permalink),
    thumbnail: normalizeMercadoLivreImageUrl(payload?.thumbnail),
    sellerId: sanitizeString(payload?.seller_id),
    sellerName: sanitizeString(payload?.seller_name),
    condition: sanitizeString(payload?.condition),
    warranty: sanitizeString(payload?.warranty),
    categoryId: sanitizeString(payload?.category_id),
    categoryName: sanitizeString(payload?.categoryName || payload?.category_name),
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
    itemTitle: sanitizeString(payload?.item_title || payload?.item?.title),
    itemThumbnail: normalizeMercadoLivreImageUrl(payload?.item_thumbnail || payload?.item?.thumbnail),
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

  const titleTokens = normalizeMercadoLivreSearchTokens(item?.title)
  const sellerTokens = normalizeMercadoLivreSearchTokens(item?.sellerName)
  const descriptionTokens = normalizeMercadoLivreSearchTokens([item?.shortDescription, item?.descriptionPlain].filter(Boolean).join(" "))
  const attributeTokens = Array.isArray(item?.attributes)
    ? normalizeMercadoLivreSearchTokens(
        item.attributes
          .flatMap((attribute) => [attribute?.name, attribute?.valueName])
          .filter(Boolean)
          .join(" ")
      )
    : []
  const variationTokens = Array.isArray(item?.variations)
    ? normalizeMercadoLivreSearchTokens(
        item.variations
          .flatMap((variation) =>
            Array.isArray(variation?.attributeCombinations)
              ? variation.attributeCombinations.flatMap((attribute) => [attribute?.name, attribute?.valueName])
              : []
          )
          .filter(Boolean)
          .join(" ")
      )
    : []
  const haystack = [...titleTokens, ...sellerTokens, ...descriptionTokens, ...attributeTokens, ...variationTokens]

  if (!haystack.length) {
    return 0
  }

  let score = 0
  for (const token of tokens) {
    if (titleTokens.includes(token)) {
      score += token.length >= 6 ? 6 : 4
      continue
    }

    if (attributeTokens.includes(token) || variationTokens.includes(token)) {
      score += token.length >= 6 ? 5 : 3
      continue
    }

    if (descriptionTokens.includes(token)) {
      score += token.length >= 6 ? 4 : 2
      continue
    }

    if (sellerTokens.includes(token)) {
      score += 1
      continue
    }

    if (token.length >= 5 && haystack.some((hay) => hay.length >= 5 && (hay.includes(token) || token.includes(hay)))) {
      score += 1
    }
  }

  return score
}
