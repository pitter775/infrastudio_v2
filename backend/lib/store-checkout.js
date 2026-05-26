import "server-only"

import { randomBytes, randomUUID } from "node:crypto"

import { getMercadoLivreLiveProductByProjectId, reduceMercadoLivreStockForStoreSale } from "@/lib/mercado-livre-connector"
import { getSnapshotProductBySlug } from "@/lib/mercado-livre-store"
import { isStoreProductAvailable, sanitizeText } from "@/lib/mercado-livre-store-core/sanitize"
import { normalizeZipCode } from "@/lib/mercado-livre-shipping"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const STORE_SELECT = "id, projeto_id, slug, nome, ativo"

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeEmail(value) {
  return sanitizeText(value, 180).toLowerCase()
}

function normalizePhone(value) {
  return sanitizeText(value, 40).replace(/[^\d+]/g, "").slice(0, 24)
}

function normalizeDocument(value) {
  return sanitizeText(value, 40).replace(/\D/g, "").slice(0, 18)
}

function buildPublicOrderId() {
  return `loja-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`
}

function buildExternalReference(orderId) {
  return `infrastudio-store:order:${orderId}`
}

function parseExternalReference(value) {
  const parts = sanitizeText(value, 160).split(":")
  if (parts.length !== 3 || parts[0] !== "infrastudio-store" || parts[1] !== "order") {
    return null
  }

  return { orderId: parts[2] }
}

function normalizeBuyer(input = {}) {
  return {
    name: sanitizeText(input.name || input.nome, 160),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone || input.telefone),
    document: normalizeDocument(input.document || input.documento),
  }
}

function normalizeAddress(input = {}) {
  return {
    zipCode: normalizeZipCode(input.zipCode || input.cep),
    street: sanitizeText(input.street || input.rua || input.logradouro, 180),
    number: sanitizeText(input.number || input.numero, 40),
    complement: sanitizeText(input.complement || input.complemento, 120),
    neighborhood: sanitizeText(input.neighborhood || input.bairro, 120),
    city: sanitizeText(input.city || input.cidade, 120),
    state: sanitizeText(input.state || input.estado || input.uf, 40).toUpperCase(),
  }
}

function normalizeShippingOption(input = {}) {
  const amount = toNumber(input.amount ?? input.valor ?? input.cost, 0)
  return {
    id: sanitizeText(input.id, 80),
    name: sanitizeText(input.name || input.nome, 120),
    amount: amount > 0 ? amount : 0,
    currencyId: sanitizeText(input.currencyId || input.currency_id || "BRL", 12) || "BRL",
    estimatedDeliveryTime: sanitizeText(input.estimatedDeliveryTime || input.prazo || "", 120),
    rawSummary: input.rawSummary && typeof input.rawSummary === "object" && !Array.isArray(input.rawSummary) ? input.rawSummary : {},
  }
}

function validateCheckoutInput({ buyer, address, product, quantity }) {
  if (!buyer.name || !buyer.email) {
    return "Informe nome e email para continuar."
  }

  if (!address.zipCode || address.zipCode.length !== 8) {
    return "Informe um CEP válido para entrega."
  }

  if (!product?.id || !isStoreProductAvailable(product)) {
    return "Produto indisponível para compra."
  }

  if (quantity !== 1) {
    return "O checkout inicial aceita 1 unidade por pedido."
  }

  return null
}

function getProductItemId(product) {
  return sanitizeText(product?.itemId || product?.id || product?.mlItemId, 80)
}

function getVariationLabel(variation) {
  const attributes = Array.isArray(variation?.attributeCombinations) ? variation.attributeCombinations : []
  return attributes
    .map((attribute) => [sanitizeText(attribute?.name, 80), sanitizeText(attribute?.valueName || attribute?.value, 120)].filter(Boolean).join(": "))
    .filter(Boolean)
    .join(" / ")
}

function findProductVariation(product, variationId) {
  const normalizedVariationId = sanitizeText(variationId, 80)
  if (!normalizedVariationId) {
    return null
  }

  const variations = Array.isArray(product?.variations) ? product.variations : []
  return variations.find((variation) => sanitizeText(variation?.id, 80) === normalizedVariationId) || null
}

function isPendingStockHoldingOrder(row) {
  const status = sanitizeText(row?.status, 40)
  const paymentStatus = sanitizeText(row?.payment_status, 40)
  return (
    ["aguardando_pagamento", "pago"].includes(status) &&
    ["pendente", "em_analise", "aprovado"].includes(paymentStatus)
  )
}

async function countReservedStockForItem({ supabase, projectId, itemId, variationId }) {
  if (!projectId || !itemId) {
    return 0
  }

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  let query = supabase
    .from("loja_pedido_itens")
    .select("quantidade, loja_pedidos!inner(status, payment_status, created_at)")
    .eq("projeto_id", projectId)
    .eq("mercadolivre_item_id", itemId)
    .gte("loja_pedidos.created_at", since)
    .limit(20)

  if (variationId) {
    query.eq("mercadolivre_variation_id", variationId)
  } else {
    query.is("mercadolivre_variation_id", null)
  }

  const { data, error } = await query

  if (error) {
    console.error("[store-checkout] failed to count reserved stock", error)
    return 0
  }

  return (data || [])
    .filter((row) => isPendingStockHoldingOrder(row.loja_pedidos))
    .reduce((sum, row) => sum + toNumber(row.quantidade), 0)
}

async function reserveCheckoutStock({ supabase, store, product, quantity, orderId, variationId }) {
  const itemId = getProductItemId(product)
  const liveProduct = itemId
    ? await getMercadoLivreLiveProductByProjectId(store.projeto_id, itemId, { supabase })
    : null
  const sourceProduct = liveProduct || product
  const variations = Array.isArray(sourceProduct?.variations) ? sourceProduct.variations : []
  const selectedVariation = variations.length ? findProductVariation(sourceProduct, variationId) : null

  if (variations.length && !selectedVariation) {
    return {
      ok: false,
      error: "Selecione uma variação disponível para continuar.",
      product: sourceProduct || product,
      availableQuantity: 0,
      reservedQuantity: 0,
      reservationId: null,
      variation: null,
    }
  }

  const availableQuantity = selectedVariation
    ? toNumber(selectedVariation.availableQuantity, 0)
    : toNumber(sourceProduct?.availableQuantity ?? sourceProduct?.stock, 0)

  if (!sourceProduct || !isStoreProductAvailable(sourceProduct) || availableQuantity < quantity) {
    return {
      ok: false,
      error: "Produto sem estoque disponível no Mercado Livre neste momento.",
      product: sourceProduct || product,
      availableQuantity: Math.max(0, availableQuantity),
      reservedQuantity: 0,
      reservationId: null,
      variation: selectedVariation,
    }
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const { data: reservationRows, error: reservationError } = await supabase.rpc("loja_reservar_estoque", {
    p_projeto_id: store.projeto_id,
    p_loja_id: store.id,
    p_pedido_id: orderId,
    p_mercadolivre_item_id: itemId,
    p_mercadolivre_variation_id: selectedVariation?.id || null,
    p_quantidade: quantity,
    p_available_quantity: availableQuantity,
    p_expires_at: expiresAt,
  })

  if (reservationError) {
    console.error("[store-checkout] failed to reserve stock via rpc", reservationError)
    const reservedQuantity = await countReservedStockForItem({
      supabase,
      projectId: store.projeto_id,
      itemId,
      variationId: selectedVariation?.id || null,
    })

    if (availableQuantity - reservedQuantity < quantity) {
      return {
        ok: false,
        error: "Este produto acabou de ser reservado em outro checkout. Tente novamente em alguns minutos.",
        product: sourceProduct,
        availableQuantity,
        reservedQuantity,
        reservationId: null,
        variation: selectedVariation,
      }
    }

    return {
      ok: true,
      error: null,
      product: sourceProduct,
      availableQuantity,
      reservedQuantity,
      reservationId: null,
      variation: selectedVariation,
    }
  }

  const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows
  if (!reservation?.ok) {
    return {
      ok: false,
      error: "Este produto acabou de ser reservado em outro checkout. Tente novamente em alguns minutos.",
      product: sourceProduct,
      availableQuantity,
      reservedQuantity: toNumber(reservation?.reserved_quantity, 0),
      reservationId: null,
      variation: selectedVariation,
    }
  }

  return {
    ok: true,
    error: null,
    product: sourceProduct,
    availableQuantity,
    reservedQuantity: toNumber(reservation.reserved_quantity, 0),
    reservationId: reservation.reserva_id || null,
    variation: selectedVariation,
  }
}

async function releaseStockReservation(supabase, reservationId) {
  if (!reservationId) {
    return
  }

  const { error } = await supabase
    .from("loja_estoque_reservas")
    .update({
      status: "liberada",
      updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("status", "ativa")

  if (error) {
    console.error("[store-checkout] failed to release stock reservation", error)
  }
}

export async function releaseStoreOrderReservations(orderId, deps = {}) {
  const normalizedOrderId = sanitizeText(orderId, 80)
  if (!normalizedOrderId) {
    return
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { error } = await supabase
    .from("loja_estoque_reservas")
    .update({
      status: "liberada",
      updated_at: new Date().toISOString(),
    })
    .eq("pedido_id", normalizedOrderId)
    .eq("status", "ativa")

  if (error) {
    console.error("[store-checkout] failed to release order stock reservations", error)
  }
}

export async function cancelStoreCheckoutOrder(orderId, deps = {}) {
  const normalizedOrderId = sanitizeText(orderId, 80)
  if (!normalizedOrderId) {
    return
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  await releaseStoreOrderReservations(normalizedOrderId, { supabase })

  const { error } = await supabase
    .from("loja_pedidos")
    .update({
      status: "cancelado",
      payment_status: "recusado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", normalizedOrderId)
    .eq("status", "aguardando_pagamento")

  if (error) {
    console.error("[store-checkout] failed to cancel checkout order", error)
  }
}

async function getPublicStoreForCheckout(slug, deps = {}) {
  const normalizedSlug = sanitizeText(slug, 80)
  if (!normalizedSlug) {
    return null
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("mercadolivre_lojas")
    .select(STORE_SELECT)
    .eq("slug", normalizedSlug)
    .eq("ativo", true)
    .maybeSingle()

  if (error) {
    console.error("[store-checkout] failed to load store", error)
    return null
  }

  return data?.id && data?.projeto_id ? data : null
}

async function upsertStoreCustomer({ supabase, store, buyer }) {
  const now = new Date().toISOString()
  const payload = {
    projeto_id: store.projeto_id,
    loja_id: store.id,
    nome: buyer.name,
    email: buyer.email || null,
    telefone: buyer.phone || null,
    documento: buyer.document || null,
    updated_at: now,
  }

  let existing = null
  if (buyer.email) {
    const { data, error } = await supabase
      .from("loja_clientes")
      .select("id")
      .eq("projeto_id", store.projeto_id)
      .eq("email", buyer.email)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    existing = data || null
  }

  if (!existing?.id && buyer.phone) {
    const { data, error } = await supabase
      .from("loja_clientes")
      .select("id")
      .eq("projeto_id", store.projeto_id)
      .eq("telefone", buyer.phone)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    existing = data || null
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("loja_clientes")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle()

    if (error) {
      throw error
    }

    return data?.id || existing.id
  }

  const { data, error } = await supabase
    .from("loja_clientes")
    .insert({
      id: randomUUID(),
      ...payload,
      created_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error || !data?.id) {
    throw error || new Error("store_customer_not_created")
  }

  return data.id
}

function mapOrderRow(row) {
  return {
    id: row.id,
    publicId: row.public_id,
    projectId: row.projeto_id,
    storeId: row.loja_id,
    customerId: row.cliente_id,
    status: row.status,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    currencyId: row.currency_id,
    subtotal: toNumber(row.subtotal),
    shippingAmount: toNumber(row.shipping_amount),
    discountAmount: toNumber(row.discount_amount),
    totalAmount: toNumber(row.total_amount),
    buyerName: row.buyer_name || "",
    buyerEmail: row.buyer_email || "",
    buyerPhone: row.buyer_phone || "",
    shippingZipCode: row.shipping_zip_code || "",
    shippingAddress: row.shipping_address || {},
    shippingOption: row.shipping_option || {},
    mercadoPagoPreferenceId: row.mercado_pago_preference_id || "",
    mercadoPagoPaymentId: row.mercado_pago_payment_id || "",
    mercadoPagoStatus: row.mercado_pago_status || "",
    externalReference: row.external_reference || "",
    paidAt: row.paid_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function createStoreCheckoutOrder(input = {}, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const store = await getPublicStoreForCheckout(input.storeSlug || input.slug, { supabase })
  if (!store) {
    return { order: null, product: null, store: null, error: "Loja não encontrada." }
  }

  const productSlug = sanitizeText(input.productSlug || input.produtoSlug, 260)
  const product = await getSnapshotProductBySlug(store.projeto_id, productSlug, { supabase })
  const quantity = Math.min(Math.max(Number(input.quantity || 1) || 1, 1), 1)
  const variationId = sanitizeText(input.variationId || input.variation_id, 80)
  const buyer = normalizeBuyer(input.buyer || input)
  const address = normalizeAddress(input.shippingAddress || input.address || input)
  const shippingOption = normalizeShippingOption(input.shippingOption || {})
  const validationError = validateCheckoutInput({ buyer, address, product, quantity })

  if (validationError) {
    return { order: null, product, store, error: validationError }
  }

  const orderId = randomUUID()
  const stockValidation = await reserveCheckoutStock({ supabase, store, product, quantity, orderId, variationId })
  if (!stockValidation.ok) {
    return { order: null, product: stockValidation.product || product, store, error: stockValidation.error }
  }

  const sellableProduct = {
    ...product,
    ...(stockValidation.product || {}),
    slug: product.slug,
    price: stockValidation.variation?.price || stockValidation.product?.price || product.price,
    variationId: stockValidation.variation?.id || null,
    variationLabel: getVariationLabel(stockValidation.variation) || "",
    variationAttributes: stockValidation.variation?.attributeCombinations || [],
    thumbnail: product.thumbnail || stockValidation.product?.thumbnail || "",
    images: product.images?.length ? product.images : stockValidation.product?.pictures || stockValidation.product?.images || [],
    permalink: product.permalink || stockValidation.product?.permalink || "",
  }
  const subtotal = Number((toNumber(sellableProduct.price) * quantity).toFixed(2))
  const shippingAmount = Number(shippingOption.amount.toFixed(2))
  const totalAmount = Number((subtotal + shippingAmount).toFixed(2))
  const customerId = await upsertStoreCustomer({ supabase, store, buyer })
  const now = new Date().toISOString()
  const externalReference = buildExternalReference(orderId)
  const publicId = buildPublicOrderId()

  const orderPayload = {
    id: orderId,
    public_id: publicId,
    projeto_id: store.projeto_id,
    loja_id: store.id,
    cliente_id: customerId,
    status: "aguardando_pagamento",
    payment_status: "pendente",
    fulfillment_status: "pendente",
    currency_id: sellableProduct.currencyId || "BRL",
    subtotal,
    shipping_amount: shippingAmount,
    discount_amount: 0,
    total_amount: totalAmount,
    buyer_name: buyer.name,
    buyer_email: buyer.email,
    buyer_phone: buyer.phone || null,
    buyer_document: buyer.document || null,
    shipping_zip_code: address.zipCode,
    shipping_address: address,
    shipping_option: shippingOption,
    external_reference: externalReference,
    source: "storefront",
    metadata: {
      productSlug,
      storeSlug: store.slug,
      stock: {
        source: stockValidation.product ? "mercado_livre_live" : "snapshot",
        availableQuantity: stockValidation.availableQuantity,
        reservedQuantity: stockValidation.reservedQuantity,
        reservationId: stockValidation.reservationId,
        variationId: stockValidation.variation?.id || null,
        variationLabel: getVariationLabel(stockValidation.variation) || null,
      },
    },
    created_at: now,
    updated_at: now,
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("loja_pedidos")
    .insert(orderPayload)
    .select("id, public_id, projeto_id, loja_id, cliente_id, status, payment_status, fulfillment_status, currency_id, subtotal, shipping_amount, discount_amount, total_amount, buyer_name, buyer_email, buyer_phone, shipping_zip_code, shipping_address, shipping_option, mercado_pago_preference_id, mercado_pago_payment_id, mercado_pago_status, external_reference, paid_at, created_at, updated_at")
    .maybeSingle()

  if (orderError || !orderRow?.id) {
    console.error("[store-checkout] failed to create order", orderError)
    await releaseStockReservation(supabase, stockValidation.reservationId)
    return { order: null, product, store, error: "Não foi possível criar o pedido." }
  }

  const itemPayload = {
    pedido_id: orderRow.id,
    projeto_id: store.projeto_id,
    mercadolivre_item_id: getProductItemId(sellableProduct) || null,
    mercadolivre_variation_id: stockValidation.variation?.id || null,
    snapshot_product_id: null,
    produto_slug: product.slug || productSlug,
    titulo: getVariationLabel(stockValidation.variation) ? `${sellableProduct.title} - ${getVariationLabel(stockValidation.variation)}` : sellableProduct.title,
    quantidade: quantity,
    unit_price: toNumber(sellableProduct.price),
    total_price: subtotal,
    currency_id: sellableProduct.currencyId || "BRL",
    thumbnail: sellableProduct.thumbnail || null,
    permalink: sellableProduct.permalink || null,
    raw_summary: {
      categoryId: sellableProduct.categoryId || null,
      categoryLabel: sellableProduct.categoryLabel || null,
      itemId: getProductItemId(sellableProduct) || null,
      variationId: stockValidation.variation?.id || null,
      variationLabel: getVariationLabel(stockValidation.variation) || null,
      availableQuantity: stockValidation.availableQuantity,
      reservedQuantity: stockValidation.reservedQuantity,
    },
    variation_attributes: stockValidation.variation?.attributeCombinations || [],
    created_at: now,
    updated_at: now,
  }

  const { error: itemError } = await supabase.from("loja_pedido_itens").insert(itemPayload)

  if (itemError) {
    console.error("[store-checkout] failed to create order item", itemError)
    await releaseStockReservation(supabase, stockValidation.reservationId)
    await supabase.from("loja_pedidos").delete().eq("id", orderRow.id)
    return { order: null, product, store, error: "Não foi possível criar os itens do pedido." }
  }

  return {
    order: mapOrderRow(orderRow),
    product: sellableProduct,
    store,
    error: null,
  }
}

export async function updateStoreOrderPaymentPreference(orderId, input = {}, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("loja_pedidos")
    .update({
      mercado_pago_preference_id: sanitizeText(input.preferenceId, 120) || null,
      metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id, public_id, projeto_id, loja_id, cliente_id, status, payment_status, fulfillment_status, currency_id, subtotal, shipping_amount, discount_amount, total_amount, buyer_name, buyer_email, buyer_phone, shipping_zip_code, shipping_address, shipping_option, mercado_pago_preference_id, mercado_pago_payment_id, mercado_pago_status, external_reference, paid_at, created_at, updated_at")
    .maybeSingle()

  if (error || !data?.id) {
    throw error || new Error("store_order_payment_preference_not_updated")
  }

  return mapOrderRow(data)
}

export async function getStoreOrderByExternalReference(externalReference, deps = {}) {
  const parsed = parseExternalReference(externalReference)
  if (!parsed?.orderId) {
    return null
  }

  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("loja_pedidos")
    .select("id, public_id, projeto_id, loja_id, cliente_id, status, payment_status, fulfillment_status, currency_id, subtotal, shipping_amount, discount_amount, total_amount, buyer_name, buyer_email, buyer_phone, shipping_zip_code, shipping_address, shipping_option, mercado_pago_preference_id, mercado_pago_payment_id, mercado_pago_status, external_reference, paid_at, created_at, updated_at")
    .eq("id", parsed.orderId)
    .eq("external_reference", externalReference)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.id ? mapOrderRow(data) : null
}

export async function getPublicStoreOrder(storeSlug, publicId, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const store = await getPublicStoreForCheckout(storeSlug, { supabase })
  if (!store) {
    return { store: null, order: null, items: [], error: "Loja não encontrada." }
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("loja_pedidos")
    .select("id, public_id, projeto_id, loja_id, cliente_id, status, payment_status, fulfillment_status, currency_id, subtotal, shipping_amount, discount_amount, total_amount, buyer_name, buyer_email, buyer_phone, shipping_zip_code, shipping_address, shipping_option, mercado_pago_preference_id, mercado_pago_payment_id, mercado_pago_status, external_reference, paid_at, created_at, updated_at")
    .eq("loja_id", store.id)
    .eq("public_id", sanitizeText(publicId, 120))
    .maybeSingle()

  if (orderError || !orderRow?.id) {
    return { store, order: null, items: [], error: "Pedido não encontrado." }
  }

  const { data: items, error: itemsError } = await supabase
    .from("loja_pedido_itens")
    .select("id, mercadolivre_item_id, produto_slug, titulo, quantidade, unit_price, total_price, currency_id, thumbnail, permalink")
    .eq("pedido_id", orderRow.id)
    .order("created_at", { ascending: true })
    .limit(20)

  if (itemsError) {
    console.error("[store-checkout] failed to load public order items", itemsError)
  }

  return {
    store,
    order: mapOrderRow(orderRow),
    items: items || [],
    error: null,
  }
}

export async function confirmStoreOrderPayment({ order, payment, rawPayload }, deps = {}) {
  const supabase = deps.supabase ?? getSupabaseAdminClient()
  const status = sanitizeText(payment?.status, 40).toLowerCase()
  const approved = status === "approved"
  const now = new Date().toISOString()
  const paymentId = sanitizeText(payment?.id, 120)

  const updatePayload = {
    mercado_pago_payment_id: paymentId || order.mercadoPagoPaymentId || null,
    mercado_pago_status: status || null,
    payment_status: approved ? "aprovado" : status === "in_process" || status === "pending" ? "em_analise" : "recusado",
    status: approved ? "pago" : status === "cancelled" ? "cancelado" : order.status,
    paid_at: approved ? (payment?.date_approved || now) : order.paidAt,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from("loja_pedidos")
    .update(updatePayload)
    .eq("id", order.id)
    .select("id, public_id, projeto_id, loja_id, cliente_id, status, payment_status, fulfillment_status, currency_id, subtotal, shipping_amount, discount_amount, total_amount, buyer_name, buyer_email, buyer_phone, shipping_zip_code, shipping_address, shipping_option, mercado_pago_preference_id, mercado_pago_payment_id, mercado_pago_status, external_reference, paid_at, created_at, updated_at")
    .maybeSingle()

  if (error || !data?.id) {
    throw error || new Error("store_order_payment_not_confirmed")
  }

  if (approved) {
    const { data: confirmedReservations, error: reservationError } = await supabase
      .from("loja_estoque_reservas")
      .update({
        status: "confirmada",
        updated_at: now,
      })
      .eq("pedido_id", order.id)
      .eq("status", "ativa")
      .select("id, mercadolivre_item_id, mercadolivre_variation_id, quantidade")

    if (reservationError) {
      console.error("[store-checkout] failed to confirm stock reservation", reservationError)
    }

    for (const reservation of confirmedReservations || []) {
      const stockResult = await reduceMercadoLivreStockForStoreSale(
        order.projectId,
        reservation.mercadolivre_item_id,
        reservation.quantidade,
        reservation.mercadolivre_variation_id,
        { supabase },
      )

      const { error: stockSyncError } = await supabase
        .from("loja_estoque_reservas")
        .update({
          metadata: {
            mercadoLivreStockSync: {
              ok: Boolean(stockResult.ok),
              skipped: Boolean(stockResult.skipped),
              previousQuantity: stockResult.previousQuantity ?? null,
              nextQuantity: stockResult.nextQuantity ?? null,
              error: stockResult.error || null,
              syncedAt: new Date().toISOString(),
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservation.id)

      if (stockSyncError) {
        console.error("[store-checkout] failed to save stock sync metadata", stockSyncError)
      }
    }
  } else if (["cancelled", "rejected", "refunded", "charged_back"].includes(status)) {
    await releaseStoreOrderReservations(order.id, { supabase })
  }

  await supabase.from("loja_pedido_pagamentos").insert({
    pedido_id: order.id,
    projeto_id: order.projectId,
    provider: "mercado_pago",
    provider_resource_type: "payment",
    provider_resource_id: paymentId || null,
    status: status || null,
    amount: toNumber(payment?.transaction_amount ?? payment?.total_paid_amount, order.totalAmount),
    currency_id: sanitizeText(payment?.currency_id || order.currencyId || "BRL", 12),
    raw_summary: rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload : {},
  })

  return mapOrderRow(data)
}

export { buildExternalReference, parseExternalReference }
