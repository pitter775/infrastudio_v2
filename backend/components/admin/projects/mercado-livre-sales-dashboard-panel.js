'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertCircle, BarChart3, CheckCircle2, LoaderCircle, RefreshCcw, ShoppingBag, TrendingUp, WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'month', label: 'Mês atual' },
]

const STATUS_LABELS = {
  paid: 'Pago',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  confirmed: 'Confirmado',
  payment_required: 'Aguardando pagamento',
  payment_in_process: 'Pagamento em análise',
  partially_paid: 'Parcialmente pago',
}

const STATUS_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee']

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#071224]/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey || item.name} className="flex items-center gap-2 text-slate-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
          <span>{item.name || item.dataKey}:</span>
          <span className="font-semibold text-slate-100">{formatter ? formatter(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  )
}

function RevenueAreaChart({ data, currency }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data || []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mlRevenueBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency)} width={86} />
          <Tooltip content={<ChartTooltip formatter={(value) => formatCurrency(value, currency)} />} />
          <Area type="monotone" dataKey="Faturamento" stroke="#38bdf8" strokeWidth={2.5} fill="url(#mlRevenueBlue)" activeDot={{ r: 4, fill: '#67e8f9', stroke: '#082f49', strokeWidth: 2 }} />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function OrdersBarChart({ data }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data || []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mlOrdersBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.13)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={58} />
          <Tooltip content={<ChartTooltip formatter={(value) => `${formatNumber(value)} pedidos`} />} />
          <Bar dataKey="Pedidos" fill="url(#mlOrdersBlue)" radius={[8, 8, 3, 3]} maxBarSize={28} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatusDonutChart({ data }) {
  const total = (data || []).reduce((sum, item) => sum + Number(item.value || 0), 0)

  return (
    <div className="relative h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip formatter={(value) => `${formatNumber(value)} pedidos`} />} />
          <Pie data={data || []} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="84%" paddingAngle={2} stroke="rgba(15,23,42,0.88)" strokeWidth={4}>
            {(data || []).map((entry, index) => (
              <Cell key={entry.status || entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-slate-100">{formatNumber(total)}</p>
          <p className="text-xs text-slate-500">pedidos</p>
        </div>
      </div>
    </div>
  )
}

function CategoryBarChart({ data, currency }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data || []} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mlCategoryCyan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.72} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.13)" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency)} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={96} />
          <Tooltip content={<ChartTooltip formatter={(value) => formatCurrency(value, currency)} />} />
          <Bar dataKey="Receita" fill="url(#mlCategoryCyan)" radius={[0, 8, 8, 0]} maxBarSize={22} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatCurrency(value, currency = 'BRL') {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR')
}

function formatDateTime(value) {
  if (!value) {
    return 'nunca'
  }

  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return STATUS_LABELS[normalized] || value || 'Sem status'
}

function getBuyerName(order) {
  const fullName = [order?.buyerFirstName, order?.buyerLastName].filter(Boolean).join(' ').trim()
  if (fullName) {
    return fullName
  }

  const nickname = String(order?.buyerNickname || '').trim()
  return nickname && !/^\d+$/.test(nickname) ? nickname : 'Comprador'
}

function KpiCard({ icon: Icon, label, value, detail, tone = 'sky' }) {
  const tones = {
    sky: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
    emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    amber: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    violet: 'border-violet-400/20 bg-violet-500/10 text-violet-100',
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#080e1d]/80 p-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold text-white">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {detail ? <p className="mt-3 text-sm text-slate-400">{detail}</p> : null}
    </div>
  )
}

function ChartPanel({ title, description, children, className }) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#080e1d]/80 p-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.9)]', className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function MercadoLivreSalesDashboardPanel({ projectIdentifier, connectorMeta, storeName, onStartOAuth }) {
  const [period, setPeriod] = useState('30d')
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const hasConnector = Boolean(connectorMeta?.id)
  const oauthConnected = Boolean(connectorMeta?.oauthConnected)
  const summary = dashboard?.summary || {}
  const currency = dashboard?.recentOrders?.[0]?.currencyId || 'BRL'

  const statusData = useMemo(
    () =>
      (dashboard?.ordersByStatus || []).map((item) => ({
        ...item,
        name: statusLabel(item.status),
      })),
    [dashboard?.ordersByStatus],
  )

  const loadDashboard = useCallback(async () => {
    if (!oauthConnected) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/sales/dashboard?period=${encodeURIComponent(period)}`,
        { cache: 'no-store' },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setDashboard(null)
        setError(data.error || 'Não foi possível carregar o dashboard.')
        return
      }

      setDashboard(data.dashboard || null)
    } catch {
      setDashboard(null)
      setError('Não foi possível carregar o dashboard.')
    } finally {
      setLoading(false)
    }
  }, [oauthConnected, period, projectIdentifier])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  async function handleSyncSales() {
    setSyncing(true)
    setError('')

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/sales/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ period, pages: 5, limit: 20 }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || 'Não foi possível sincronizar as vendas.')
        return
      }

      setDashboard(data.dashboard || null)
    } catch {
      setError('Não foi possível sincronizar as vendas.')
    } finally {
      setSyncing(false)
    }
  }

  if (!hasConnector) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-50">
        <p className="font-semibold">Conecte a loja para liberar o dashboard</p>
        <p className="mt-2 text-amber-50/80">
          O dashboard aparece depois que a conta do Mercado Livre estiver conectada e as vendas forem sincronizadas.
        </p>
      </div>
    )
  }

  if (!oauthConnected) {
    return (
      <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-5 text-sm text-sky-100">
        <p className="font-semibold">Falta conectar a conta da loja</p>
        <p className="mt-2 text-sky-100/80">
          Depois do OAuth, sincronize as vendas para preencher os gráficos do dashboard.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={onStartOAuth}
          className="mt-4 h-10 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 text-sm text-sky-100"
        >
          Conectar conta agora
        </Button>
      </div>
    )
  }

  const hasSalesData = Boolean(dashboard?.hasSalesData)

  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#071224] shadow-[0_24px_70px_-36px_rgba(0,0,0,0.95)]">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(16,185,129,0.13),transparent_24%),linear-gradient(135deg,#070d1d_0%,#08182b_56%,#06131e_100%)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                <BarChart3 className="h-3.5 w-3.5" />
                Dashboard de vendas
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">{connectorMeta.oauthNickname || storeName || 'Loja Mercado Livre'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Visão comercial baseada nos pedidos sincronizados da conta conectada.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriod(option.id)}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-sm font-medium transition',
                    period === option.id
                      ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {option.label}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={handleSyncSales}
                disabled={syncing}
                className="h-9 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 text-sm text-emerald-100"
              >
                <RefreshCcw className={cn('mr-1.5 h-4 w-4', syncing && 'animate-spin')} />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Última sincronização: {formatDateTime(dashboard?.sync?.lastSuccessAt)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Pedidos sincronizados: {formatNumber(dashboard?.sync?.totalOrdersSynced || 0)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
              <LoaderCircle className="h-4 w-4 animate-spin text-sky-300" />
              Carregando dashboard de vendas...
            </div>
          ) : null}

          {!loading && !hasSalesData ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-100">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">Nenhuma venda sincronizada ainda</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Sincronize os pedidos do Mercado Livre para preencher os indicadores e gráficos.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSyncSales}
                    disabled={syncing}
                    className="mt-4 h-10 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 text-sm text-emerald-100"
                  >
                    <RefreshCcw className={cn('mr-1.5 h-4 w-4', syncing && 'animate-spin')} />
                    {syncing ? 'Sincronizando...' : 'Sincronizar vendas'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {hasSalesData ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={WalletCards} label="Faturamento" value={formatCurrency(summary.grossRevenue, currency)} detail="Pedidos não cancelados no período." tone="emerald" />
                <KpiCard icon={ShoppingBag} label="Pedidos" value={formatNumber(summary.ordersCount)} detail={`${formatNumber(summary.paidOrdersCount)} pagos`} tone="sky" />
                <KpiCard icon={TrendingUp} label="Ticket médio" value={formatCurrency(summary.averageTicket, currency)} detail="Baseado nos pedidos pagos." tone="violet" />
                <KpiCard icon={CheckCircle2} label="Itens vendidos" value={formatNumber(summary.itemsSold)} detail={`${formatNumber(summary.cancelledOrdersCount)} pedidos cancelados`} tone="amber" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <ChartPanel title="Evolução de faturamento" description="Receita por dia no período selecionado.">
                  <RevenueAreaChart data={dashboard.salesByDay || []} currency={currency} />
                </ChartPanel>
                <ChartPanel title="Pedidos por status" description="Distribuição dos pedidos sincronizados.">
                  <StatusDonutChart data={statusData} />
                </ChartPanel>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <ChartPanel title="Volume de pedidos" description="Quantidade diária de pedidos.">
                  <OrdersBarChart data={dashboard.salesByDay || []} />
                </ChartPanel>
                <ChartPanel title="Produtos mais vendidos" description="Ranking por quantidade vendida.">
                  <div className="grid gap-3">
                    {(dashboard.topProducts || []).map((product, index) => (
                      <div key={`${product.itemId || product.title}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-500/10 text-xs font-semibold text-sky-100">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{product.title}</p>
                          <p className="text-xs text-slate-500">{product.itemId || 'sem código'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-100">{formatCurrency(product.revenue, product.currencyId || currency)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartPanel>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <ChartPanel title="Últimos pedidos" description="Pedidos mais recentes dentro do período.">
                  <div className="grid gap-2">
                    {(dashboard.recentOrders || []).map((order) => (
                      <div key={order.id} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{getBuyerName(order)}</p>
                          <p className="mt-1 text-xs text-slate-500">Pedido {order.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            {statusLabel(order.status)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                            {formatDateTime(order.dateCreated)}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-emerald-100">
                          {formatCurrency(order.paidAmount || order.totalAmount, order.currencyId || currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartPanel>
                <ChartPanel title="Vendas por categoria" description="Receita agrupada por categoria dos itens.">
                  <CategoryBarChart data={dashboard.salesByCategory || []} currency={currency} />
                </ChartPanel>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
