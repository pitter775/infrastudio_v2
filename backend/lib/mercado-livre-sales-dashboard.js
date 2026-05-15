import "server-only"

import { listMercadoLivreOrdersForUser } from "@/lib/mercado-livre-connector"
import { getSupabaseAdminClient } from "@/lib/supabase-admin"

const ORDER_SELECT = [
  "id",
  "mercadolivre_order_id",
  "status",
  "status_detail",
  "currency_id",
  "total_amount",
  "paid_amount",
  "total_items",
  "buyer_nickname",
  "buyer_first_name",
  "buyer_last_name",
  "shipping_id",
  "date_created",
  "date_closed",
  "date_last_updated",
  "synced_at",
].join(", ")

const ITEM_SELECT = [
  "mercadolivre_order_id",
  "item_id",
  "title",
  "quantity",
  "unit_price",
  "currency_id",
  "category_id",
].join(", ")

const SYNC_STATE_SELECT = [
  "projeto_id",
  "connector_id",
  "analytics_enabled",
  "analytics_enabled_at",
  "analytics_enabled_by",
  "analytics_disabled_at",
  "sync_in_progress",
  "sync_mode",
  "last_success_at",
  "last_error_at",
  "last_error_message",
  "last_sync_started_at",
  "last_sync_finished_at",
  "last_order_date_created",
  "last_order_date_updated",
  "total_orders_synced",
  "total_items_synced",
  "updated_at",
].join(", ")

const CANCELLED_STATUSES = new Set(["cancelled", "canceled"])
const PAID_STATUSES = new Set(["paid"])

function normalizeAnalyticsConsent(row) {
  return {
    enabled: row?.analytics_enabled === true,
    enabledAt: row?.analytics_enabled_at || null,
    enabledBy: row?.analytics_enabled_by || null,
    disabledAt: row?.analytics_disabled_at || null,
  }
}

function sanitizeString(value) {
  const normalized = String(value || "").trim()
  return normalized || ""
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toIsoDate(value) {
  const timestamp = Date.parse(sanitizeString(value))
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function toDateOnly(value) {
  const timestamp = Date.parse(sanitizeString(value))
  if (!Number.isFinite(timestamp)) {
    return ""
  }

  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(timestamp))
}

function toDisplayDate(value) {
  const dateOnly = toDateOnly(value)
  if (!dateOnly) {
    return ""
  }

  const [year, month, day] = dateOnly.split("-")
  return `${day}/${month}`
}

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function resolveDateRange(options = {}) {
  const now = new Date()
  const today = startOfDay(now)
  const period = sanitizeString(options.period || "30d")
  let from = null
  let to = now

  if (options.from) {
    const parsedFrom = Date.parse(String(options.from))
    if (Number.isFinite(parsedFrom)) {
      from = startOfDay(new Date(parsedFrom))
    }
  }

  if (options.to) {
    const parsedTo = Date.parse(String(options.to))
    if (Number.isFinite(parsedTo)) {
      to = new Date(parsedTo)
      to.setHours(23, 59, 59, 999)
    }
  }

  if (!from) {
    if (period === "today") {
      from = today
    } else if (period === "7d") {
      from = new Date(today)
      from.setDate(from.getDate() - 6)
    } else if (period === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1)
    } else {
      from = new Date(today)
      from.setDate(from.getDate() - 29)
    }
  }

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

function normalizeOrderRow(row) {
  return {
    id: sanitizeString(row.mercadolivre_order_id),
    snapshotId: row.id,
    status: sanitizeString(row.status),
    statusDetail: sanitizeString(row.status_detail),
    currencyId: sanitizeString(row.currency_id || "BRL"),
    totalAmount: toNumber(row.total_amount),
    paidAmount: row.paid_amount == null ? null : toNumber(row.paid_amount),
    totalItems: toNumber(row.total_items),
    buyerNickname: sanitizeString(row.buyer_nickname),
    buyerFirstName: sanitizeString(row.buyer_first_name),
    buyerLastName: sanitizeString(row.buyer_last_name),
    shippingId: sanitizeString(row.shipping_id),
    dateCreated: row.date_created || null,
    dateClosed: row.date_closed || null,
    dateLastUpdated: row.date_last_updated || null,
    syncedAt: row.synced_at || null,
  }
}

function getRevenueValue(order) {
  const status = sanitizeString(order.status).toLowerCase()
  if (CANCELLED_STATUSES.has(status)) {
    return 0
  }

  return order.paidAmount != null && order.paidAmount > 0 ? order.paidAmount : order.totalAmount
}

function isMercadoLivreCategoryCode(value) {
  return /^MLB\d+$/i.test(sanitizeString(value))
}

function normalizeCategoryName(value) {
  const normalized = sanitizeString(value)
  if (!normalized || isMercadoLivreCategoryCode(normalized)) {
    return ""
  }

  return normalized
}

function resolveCategoryBucket(item, categoryNameMap) {
  const categoryId = sanitizeString(item.category_id)
  const mappedName = normalizeCategoryName(categoryNameMap.get(categoryId))

  if (mappedName) {
    return { key: categoryId || mappedName, name: mappedName, categoryId: categoryId || null }
  }

  if (categoryId && !isMercadoLivreCategoryCode(categoryId)) {
    return { key: categoryId, name: categoryId, categoryId }
  }

  return { key: "unmapped", name: "Categoria não identificada", categoryId: categoryId || null }
}

function buildDashboardPayload({ orders, items, syncState, range, categoryNameMap = new Map() }) {
  const normalizedOrders = orders.map(normalizeOrderRow)
  const totalRevenue = normalizedOrders.reduce((sum, order) => sum + getRevenueValue(order), 0)
  const paidOrders = normalizedOrders.filter((order) => PAID_STATUSES.has(sanitizeString(order.status).toLowerCase()))
  const cancelledOrders = normalizedOrders.filter((order) => CANCELLED_STATUSES.has(sanitizeString(order.status).toLowerCase()))
  const itemsSold = normalizedOrders.reduce((sum, order) => sum + toNumber(order.totalItems), 0)
  const statusBuckets = new Map()
  const salesBuckets = new Map()
  const productBuckets = new Map()
  const categoryBuckets = new Map()

  for (const order of normalizedOrders) {
    const status = sanitizeString(order.status || "sem_status")
    statusBuckets.set(status, (statusBuckets.get(status) || 0) + 1)

    const dateKey = toDateOnly(order.dateCreated)
    if (dateKey) {
      const current = salesBuckets.get(dateKey) || { date: dateKey, label: toDisplayDate(order.dateCreated), "Faturamento": 0, "Pedidos": 0 }
      current.Faturamento += getRevenueValue(order)
      current.Pedidos += 1
      salesBuckets.set(dateKey, current)
    }
  }

  for (const item of items) {
    const key = sanitizeString(item.item_id || item.title)
    if (!key) {
      continue
    }

    const current = productBuckets.get(key) || {
      itemId: sanitizeString(item.item_id),
      title: sanitizeString(item.title || item.item_id || "Produto"),
      quantity: 0,
      revenue: 0,
      currencyId: sanitizeString(item.currency_id || "BRL"),
    }
    const quantity = toNumber(item.quantity)
    current.quantity += quantity
    current.revenue += quantity * toNumber(item.unit_price)
    productBuckets.set(key, current)

    const categoryBucket = resolveCategoryBucket(item, categoryNameMap)
    const category = categoryBuckets.get(categoryBucket.key) || {
      categoryId: categoryBucket.categoryId,
      name: categoryBucket.name,
      revenue: 0,
      quantity: 0,
    }
    category.quantity += quantity
    category.revenue += quantity * toNumber(item.unit_price)
    categoryBuckets.set(categoryBucket.key, category)
  }

  return {
    range,
    summary: {
      grossRevenue: Number(totalRevenue.toFixed(2)),
      ordersCount: normalizedOrders.length,
      paidOrdersCount: paidOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      averageTicket: paidOrders.length ? Number((totalRevenue / paidOrders.length).toFixed(2)) : 0,
      itemsSold,
    },
    salesByDay: [...salesBuckets.values()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((item) => ({
        ...item,
        Faturamento: Number(item.Faturamento.toFixed(2)),
      })),
    ordersByStatus: [...statusBuckets.entries()]
      .map(([status, count]) => ({ status, name: status, value: count }))
      .sort((left, right) => right.value - left.value),
    topProducts: [...productBuckets.values()]
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
      .slice(0, 5)
      .map((item) => ({ ...item, revenue: Number(item.revenue.toFixed(2)) })),
    salesByCategory: [...categoryBuckets.values()]
      .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity)
      .slice(0, 6)
      .map((item) => ({ ...item, Receita: Number(item.revenue.toFixed(2)) })),
    recentOrders: normalizedOrders.slice(0, 4),
    sync: syncState
      ? {
          inProgress: syncState.sync_in_progress === true,
          mode: syncState.sync_mode || null,
          lastSuccessAt: syncState.last_success_at || null,
          lastErrorAt: syncState.last_error_at || null,
          lastErrorMessage: syncState.last_error_message || null,
          lastSyncStartedAt: syncState.last_sync_started_at || null,
          lastSyncFinishedAt: syncState.last_sync_finished_at || null,
          lastOrderDateCreated: syncState.last_order_date_created || null,
          lastOrderDateUpdated: syncState.last_order_date_updated || null,
          totalOrdersSynced: toNumber(syncState.total_orders_synced),
          totalItemsSynced: toNumber(syncState.total_items_synced),
        }
      : null,
    hasSalesData: normalizedOrders.length > 0,
  }
}

function mapOrderForStorage(projectId, connectorId, order) {
  return {
    projeto_id: projectId,
    connector_id: connectorId || null,
    mercadolivre_order_id: sanitizeString(order.id),
    status: sanitizeString(order.status) || null,
    status_detail: sanitizeString(order.statusDetail) || null,
    currency_id: sanitizeString(order.currencyId || "BRL"),
    total_amount: toNumber(order.totalAmount),
    paid_amount: order.paidAmount == null ? null : toNumber(order.paidAmount),
    total_items: toNumber(order.totalItems),
    buyer_id: sanitizeString(order.buyerId) || null,
    buyer_nickname: sanitizeString(order.buyerNickname) || null,
    buyer_first_name: sanitizeString(order.buyerFirstName) || null,
    buyer_last_name: sanitizeString(order.buyerLastName) || null,
    shipping_id: sanitizeString(order.shippingId) || null,
    date_created: toIsoDate(order.dateCreated),
    date_closed: toIsoDate(order.dateClosed),
    date_last_updated: toIsoDate(order.dateLastUpdated),
    tags: Array.isArray(order.tags) ? order.tags : [],
    raw_summary: {
      firstItemId: sanitizeString(order.firstItemId) || null,
      firstItemTitle: sanitizeString(order.firstItemTitle) || null,
    },
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function mapItemForStorage(projectId, orderSnapshotId, order, item) {
  return {
    projeto_id: projectId,
    pedido_snapshot_id: orderSnapshotId,
    mercadolivre_order_id: sanitizeString(order.id),
    item_position: toNumber(item.position),
    item_id: sanitizeString(item.itemId) || null,
    title: sanitizeString(item.title) || null,
    quantity: toNumber(item.quantity),
    unit_price: toNumber(item.unitPrice),
    full_unit_price: item.fullUnitPrice == null ? null : toNumber(item.fullUnitPrice),
    sale_fee: item.saleFee == null ? null : toNumber(item.saleFee),
    currency_id: sanitizeString(item.currencyId || order.currencyId || "BRL"),
    category_id: sanitizeString(item.categoryId) || null,
    variation_id: sanitizeString(item.variationId) || null,
    variation_attributes: Array.isArray(item.variationAttributes) ? item.variationAttributes : [],
    raw_summary: {},
    updated_at: new Date().toISOString(),
  }
}

async function upsertSyncState(supabase, projectId, payload) {
  await supabase.from("mercadolivre_vendas_sync_state").upsert(
    {
      projeto_id: projectId,
      ...payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "projeto_id" },
  )
}

async function loadSyncState(supabase, projectId) {
  const { data, error } = await supabase
    .from("mercadolivre_vendas_sync_state")
    .select(SYNC_STATE_SELECT)
    .eq("projeto_id", projectId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function enableMercadoLivreSalesAnalyticsForUser(project, user) {
  if (!project?.id || (!user?.id && user?.role !== "admin")) {
    return { consent: normalizeAnalyticsConsent(null), error: "Projeto não encontrado." }
  }

  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("mercadolivre_vendas_sync_state")
    .upsert(
      {
        projeto_id: project.id,
        analytics_enabled: true,
        analytics_enabled_at: now,
        analytics_enabled_by: user.id || null,
        analytics_disabled_at: null,
        updated_at: now,
      },
      { onConflict: "projeto_id" },
    )
    .select(SYNC_STATE_SELECT)
    .single()

  if (error) {
    console.error("[mercado-livre-sales] failed to enable analytics consent", error)
    return { consent: normalizeAnalyticsConsent(null), error: "Não foi possível ativar o dashboard analítico." }
  }

  return { consent: normalizeAnalyticsConsent(data), error: null }
}

export async function syncMercadoLivreSalesForUser(project, user, options = {}) {
  const supabase = getSupabaseAdminClient()
  const pageLimit = Math.min(Math.max(toNumber(options.limit, 20), 1), 20)
  const maxPages = Math.min(Math.max(toNumber(options.pages, 5), 1), 10)
  const startedAt = new Date().toISOString()

  let currentSyncState = null
  try {
    currentSyncState = await loadSyncState(supabase, project.id)
  } catch (error) {
    console.error("[mercado-livre-sales] failed to load analytics consent before sync", error)
    return { syncedOrders: 0, syncedItems: 0, connector: null, error: "Não foi possível validar a ativação do dashboard." }
  }

  if (currentSyncState?.analytics_enabled !== true) {
    return { syncedOrders: 0, syncedItems: 0, connector: null, error: "Ative o Dashboard Analítico antes de sincronizar as vendas." }
  }

  await upsertSyncState(supabase, project.id, {
    sync_in_progress: true,
    sync_mode: "manual_incremental",
    last_sync_started_at: startedAt,
    last_error_message: null,
  })

  try {
    let offset = 0
    let connector = null
    const orders = []

    for (let page = 0; page < maxPages; page += 1) {
      const result = await listMercadoLivreOrdersForUser(project, user, { limit: pageLimit, offset })
      connector = result.connector || connector

      if (result.error) {
        throw new Error(result.error)
      }

      const pageOrders = Array.isArray(result.orders) ? result.orders.filter((order) => order?.id) : []
      orders.push(...pageOrders)

      if (!pageOrders.length || !result.paging || result.paging.total <= offset + pageLimit) {
        break
      }

      offset += pageLimit
    }

    if (!orders.length) {
      await upsertSyncState(supabase, project.id, {
        connector_id: connector?.id || null,
        sync_in_progress: false,
        last_success_at: new Date().toISOString(),
        last_sync_finished_at: new Date().toISOString(),
        total_orders_synced: 0,
        total_items_synced: 0,
      })
      return { syncedOrders: 0, syncedItems: 0, connector, error: null }
    }

    const orderRows = orders.map((order) => mapOrderForStorage(project.id, connector?.id, order))
    const { data: upsertedOrders, error: orderError } = await supabase
      .from("mercadolivre_pedidos_snapshot")
      .upsert(orderRows, { onConflict: "projeto_id,mercadolivre_order_id" })
      .select("id, mercadolivre_order_id")

    if (orderError) {
      throw orderError
    }

    const orderIdMap = new Map((upsertedOrders || []).map((row) => [sanitizeString(row.mercadolivre_order_id), row.id]))
    const orderIds = orders.map((order) => sanitizeString(order.id)).filter(Boolean)
    const itemRows = []

    if (orderIds.length) {
      const { error: deleteItemsError } = await supabase
        .from("mercadolivre_pedido_itens_snapshot")
        .delete()
        .eq("projeto_id", project.id)
        .in("mercadolivre_order_id", orderIds)

      if (deleteItemsError) {
        throw deleteItemsError
      }
    }

    for (const order of orders) {
      const snapshotId = orderIdMap.get(sanitizeString(order.id))
      if (!snapshotId) {
        continue
      }

      const items = Array.isArray(order.items) ? order.items : []
      for (const item of items) {
        itemRows.push(mapItemForStorage(project.id, snapshotId, order, item))
      }
    }

    if (itemRows.length) {
      const { error: itemError } = await supabase.from("mercadolivre_pedido_itens_snapshot").insert(itemRows)
      if (itemError) {
        throw itemError
      }
    }

    const lastOrderDateCreated = orders
      .map((order) => toIsoDate(order.dateCreated))
      .filter(Boolean)
      .sort()
      .at(-1)
    const lastOrderDateUpdated = orders
      .map((order) => toIsoDate(order.dateLastUpdated))
      .filter(Boolean)
      .sort()
      .at(-1)

    await upsertSyncState(supabase, project.id, {
      connector_id: connector?.id || null,
      sync_in_progress: false,
      last_success_at: new Date().toISOString(),
      last_sync_finished_at: new Date().toISOString(),
      last_order_date_created: lastOrderDateCreated || null,
      last_order_date_updated: lastOrderDateUpdated || null,
      total_orders_synced: orders.length,
      total_items_synced: itemRows.length,
      last_error_at: null,
      last_error_message: null,
    })

    return { syncedOrders: orders.length, syncedItems: itemRows.length, connector, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível sincronizar as vendas."
    await upsertSyncState(supabase, project.id, {
      sync_in_progress: false,
      last_error_at: new Date().toISOString(),
      last_error_message: message,
      last_sync_finished_at: new Date().toISOString(),
    })

    return { syncedOrders: 0, syncedItems: 0, connector: null, error: message }
  }
}

export async function getMercadoLivreSalesDashboardForUser(project, user, options = {}) {
  if (!project?.id || (!user?.id && user?.role !== "admin")) {
    return { dashboard: null, consent: normalizeAnalyticsConsent(null), error: "Projeto não encontrado." }
  }

  const supabase = getSupabaseAdminClient()
  const range = resolveDateRange(options)
  const limit = Math.min(Math.max(toNumber(options.limit, 2000), 100), 5000)
  let syncState = null

  try {
    syncState = await loadSyncState(supabase, project.id)
  } catch (error) {
    console.error("[mercado-livre-sales] failed to load analytics consent", error)
    return { dashboard: null, consent: normalizeAnalyticsConsent(null), error: "Não foi possível carregar a preferência do dashboard." }
  }

  const consent = normalizeAnalyticsConsent(syncState)
  if (!consent.enabled) {
    return { dashboard: null, consent, error: null }
  }

  const ordersResult = await supabase
    .from("mercadolivre_pedidos_snapshot")
    .select(ORDER_SELECT)
    .eq("projeto_id", project.id)
    .gte("date_created", range.from)
    .lte("date_created", range.to)
    .order("date_created", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (ordersResult.error) {
    console.error("[mercado-livre-sales] failed to load dashboard orders", ordersResult.error)
    return { dashboard: null, consent, error: "Não foi possível carregar o dashboard de vendas." }
  }

  const orders = ordersResult.data || []
  const orderIds = orders.map((order) => sanitizeString(order.mercadolivre_order_id)).filter(Boolean)
  let items = []
  let categoryNameMap = new Map()

  if (orderIds.length) {
    const { data, error } = await supabase
      .from("mercadolivre_pedido_itens_snapshot")
      .select(ITEM_SELECT)
      .eq("projeto_id", project.id)
      .in("mercadolivre_order_id", orderIds)
      .limit(limit * 5)

    if (error) {
      console.error("[mercado-livre-sales] failed to load dashboard items", error)
    } else {
      items = data || []
    }
  }

  const categoryIds = [...new Set(items.map((item) => sanitizeString(item.category_id)).filter(Boolean))]
  if (categoryIds.length) {
    const { data, error } = await supabase
      .from("mercadolivre_produtos_snapshot")
      .select("categoria_id, categoria_nome")
      .eq("projeto_id", project.id)
      .in("categoria_id", categoryIds)
      .limit(categoryIds.length)

    if (!error) {
      categoryNameMap = new Map(
        (data || [])
          .map((row) => [sanitizeString(row.categoria_id), sanitizeString(row.categoria_nome)])
          .filter(([id, name]) => id && name),
      )
    }
  }

  return {
    dashboard: buildDashboardPayload({ orders, items, syncState, range, categoryNameMap }),
    consent,
    error: null,
  }
}

export async function listMercadoLivrePersistedSalesOrdersForUser(project, user, options = {}) {
  if (!project?.id || (!user?.id && user?.role !== "admin")) {
    return { orders: [], paging: { total: 0, limit: 20, offset: 0 }, error: "Projeto não encontrado." }
  }

  const supabase = getSupabaseAdminClient()
  const range = resolveDateRange(options)
  const limit = Math.min(Math.max(toNumber(options.limit, 20), 1), 50)
  const offset = Math.max(toNumber(options.offset, 0), 0)
  const status = sanitizeString(options.status)
  let query = supabase
    .from("mercadolivre_pedidos_snapshot")
    .select(ORDER_SELECT, { count: "exact" })
    .eq("projeto_id", project.id)
    .gte("date_created", range.from)
    .lte("date_created", range.to)
    .order("date_created", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq("status", status)
  }

  const { data, count, error } = await query

  if (error) {
    console.error("[mercado-livre-sales] failed to list persisted orders", error)
    return { orders: [], paging: { total: 0, limit, offset }, error: "Não foi possível listar as vendas sincronizadas." }
  }

  return {
    orders: (data || []).map(normalizeOrderRow),
    paging: {
      total: count || 0,
      limit,
      offset,
    },
    error: null,
  }
}
