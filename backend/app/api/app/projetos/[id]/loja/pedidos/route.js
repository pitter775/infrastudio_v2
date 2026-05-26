import { NextResponse } from "next/server"

import { getProjectForUser } from "@/lib/projetos"
import { getSessionUser } from "@/lib/session"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const ORDER_SELECT = [
  "id",
  "public_id",
  "status",
  "payment_status",
  "fulfillment_status",
  "currency_id",
  "subtotal",
  "shipping_amount",
  "total_amount",
  "buyer_name",
  "buyer_email",
  "buyer_phone",
  "shipping_zip_code",
  "shipping_address",
  "shipping_option",
  "mercado_pago_payment_id",
  "mercado_pago_status",
  "paid_at",
  "created_at",
  "updated_at",
].join(", ")

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapOrder(row, items = []) {
  return {
    id: row.id,
    publicId: row.public_id,
    status: row.status,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    currencyId: row.currency_id || "BRL",
    subtotal: toNumber(row.subtotal),
    shippingAmount: toNumber(row.shipping_amount),
    totalAmount: toNumber(row.total_amount),
    buyerName: row.buyer_name || "",
    buyerEmail: row.buyer_email || "",
    buyerPhone: row.buyer_phone || "",
    shippingZipCode: row.shipping_zip_code || "",
    shippingAddress: row.shipping_address && typeof row.shipping_address === "object" ? row.shipping_address : {},
    shippingOption: row.shipping_option && typeof row.shipping_option === "object" ? row.shipping_option : {},
    mercadoPagoPaymentId: row.mercado_pago_payment_id || "",
    mercadoPagoStatus: row.mercado_pago_status || "",
    paidAt: row.paid_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    items,
  }
}

const FULFILLMENT_STATUSES = new Set(["pendente", "preparando", "enviado", "entregue", "cancelado"])

export async function GET(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20) || 20, 1), 50)
  const offset = Math.max(Number(searchParams.get("offset") || 0) || 0, 0)
  const status = String(searchParams.get("status") || "").trim()
  const paymentStatus = String(searchParams.get("paymentStatus") || "").trim()
  const fulfillmentStatus = String(searchParams.get("fulfillmentStatus") || "").trim()
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from("loja_pedidos")
    .select(ORDER_SELECT, { count: "exact" })
    .eq("projeto_id", project.id)
    .order("created_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq("status", status)
  }

  if (paymentStatus) {
    query = query.eq("payment_status", paymentStatus)
  }

  if (fulfillmentStatus) {
    query = query.eq("fulfillment_status", fulfillmentStatus)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: "Não foi possível listar os pedidos da loja." }, { status: 500 })
  }

  const orderIds = (data || []).map((row) => row.id).filter(Boolean)
  let itemsByOrderId = new Map()

  if (orderIds.length) {
    const { data: items, error: itemError } = await supabase
      .from("loja_pedido_itens")
      .select("pedido_id, id, titulo, quantidade, unit_price, total_price, currency_id, thumbnail, mercadolivre_variation_id, variation_attributes")
      .in("pedido_id", orderIds)
      .order("created_at", { ascending: true })
      .limit(orderIds.length * 10)

    if (!itemError) {
      itemsByOrderId = (items || []).reduce((map, item) => {
        const list = map.get(item.pedido_id) || []
        list.push({
          id: item.id,
          title: item.titulo || "Produto",
          quantity: toNumber(item.quantidade),
          unitPrice: toNumber(item.unit_price),
          totalPrice: toNumber(item.total_price),
          currencyId: item.currency_id || "BRL",
          thumbnail: item.thumbnail || "",
          variationId: item.mercadolivre_variation_id || "",
          variationAttributes: Array.isArray(item.variation_attributes) ? item.variation_attributes : [],
        })
        map.set(item.pedido_id, list)
        return map
      }, new Map())
    }
  }

  return NextResponse.json(
    {
      orders: (data || []).map((row) => mapOrder(row, itemsByOrderId.get(row.id) || [])),
      paging: {
        total: count || 0,
        limit,
        offset,
      },
    },
    { status: 200 },
  )
}

export async function PATCH(request, context) {
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const { id } = await context.params
  const project = await getProjectForUser(id, user)

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const orderId = String(body.orderId || "").trim()
  const fulfillmentStatus = String(body.fulfillmentStatus || "").trim()

  if (!orderId || !FULFILLMENT_STATUSES.has(fulfillmentStatus)) {
    return NextResponse.json({ error: "Status de entrega inválido." }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from("loja_pedidos")
    .update({
      fulfillment_status: fulfillmentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("projeto_id", project.id)
    .select(ORDER_SELECT)
    .maybeSingle()

  if (error || !data?.id) {
    return NextResponse.json({ error: "Não foi possível atualizar o pedido." }, { status: 500 })
  }

  return NextResponse.json({ order: mapOrder(data) }, { status: 200 })
}
