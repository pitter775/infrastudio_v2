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
import { AlertCircle, BarChart3, CheckCircle2, LoaderCircle, LockKeyhole, RefreshCcw, ShieldCheck, ShoppingBag, Sparkles, TrendingUp, WalletCards } from 'lucide-react'

import {
  DASHBOARD_AXIS_TICK,
  DASHBOARD_CHART_COLORS,
  DASHBOARD_GRID_STROKE,
  DashboardChartFrame,
  DashboardChartPanel,
  DashboardChartTooltip,
  DashboardKpiCard,
} from '@/components/admin/charts/dashboard-chart-shell'
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

const MOCK_SALES_BY_DAY = [
  { label: '01/05', Faturamento: 820, Pedidos: 3 },
  { label: '06/05', Faturamento: 1280, Pedidos: 5 },
  { label: '11/05', Faturamento: 960, Pedidos: 4 },
  { label: '16/05', Faturamento: 1760, Pedidos: 7 },
  { label: '21/05', Faturamento: 1420, Pedidos: 6 },
  { label: '26/05', Faturamento: 2140, Pedidos: 8 },
]

const MOCK_STATUS_DATA = [
  { status: 'paid', name: 'Pago', value: 14 },
  { status: 'confirmed', name: 'Confirmado', value: 6 },
  { status: 'payment_in_process', name: 'Pagamento em análise', value: 3 },
]

const MOCK_CATEGORY_DATA = [
  { name: 'Categoria A', Receita: 2400 },
  { name: 'Categoria B', Receita: 1850 },
  { name: 'Categoria C', Receita: 1220 },
]

function RevenueAreaChart({ data, currency }) {
  return (
    <DashboardChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data || []} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="mlRevenueBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DASHBOARD_CHART_COLORS.revenue} stopOpacity={0.52} />
              <stop offset="58%" stopColor={DASHBOARD_CHART_COLORS.revenueSoft} stopOpacity={0.18} />
              <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.revenue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DASHBOARD_GRID_STROKE} vertical={false} strokeDasharray="4 8" />
          <XAxis dataKey="label" tick={DASHBOARD_AXIS_TICK} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={DASHBOARD_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency)} width={86} />
          <Tooltip content={<DashboardChartTooltip formatter={(value) => formatCurrency(value, currency)} />} />
          <Area type="monotone" dataKey="Faturamento" stroke={DASHBOARD_CHART_COLORS.revenue} strokeWidth={3} fill="url(#mlRevenueBlue)" dot={false} activeDot={{ r: 5, fill: '#e0f2fe', stroke: '#0284c7', strokeWidth: 3 }} />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  )
}

function OrdersBarChart({ data }) {
  return (
    <DashboardChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data || []} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="mlOrdersGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac" stopOpacity={0.98} />
              <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.ordersSoft} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DASHBOARD_GRID_STROKE} vertical={false} strokeDasharray="4 8" />
          <XAxis dataKey="label" tick={DASHBOARD_AXIS_TICK} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={DASHBOARD_AXIS_TICK} axisLine={false} tickLine={false} width={58} />
          <Tooltip content={<DashboardChartTooltip formatter={(value) => `${formatNumber(value)} pedidos`} />} />
          <Bar dataKey="Pedidos" fill="url(#mlOrdersGreen)" radius={[10, 10, 4, 4]} maxBarSize={30} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  )
}

function StatusDonutChart({ data }) {
  const total = (data || []).reduce((sum, item) => sum + Number(item.value || 0), 0)

  return (
    <DashboardChartFrame className="grid h-auto gap-3 md:h-72 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
      <div className="relative h-64 md:h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DashboardChartTooltip formatter={(value) => `${formatNumber(value)} pedidos`} />} />
            <Pie data={data || []} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="84%" paddingAngle={3} stroke="rgba(15,23,42,0.9)" strokeWidth={4}>
              {(data || []).map((entry, index) => (
                <Cell key={entry.status || entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-white/10 bg-slate-950/50 px-5 py-4 text-center shadow-[0_18px_60px_-32px_rgba(56,189,248,0.9)] backdrop-blur">
            <p className="text-2xl font-semibold text-white">{formatNumber(total)}</p>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">pedidos</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        {(data || []).map((item, index) => (
          <div key={item.status || item.name} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-semibold text-white">{formatNumber(item.value)}</span>
          </div>
        ))}
      </div>
    </DashboardChartFrame>
  )
}

function CategoryBarChart({ data, currency }) {
  const chartData = (data || []).map((item) => ({
    ...item,
    displayName: formatCategoryAxisLabel(item.name),
  }))

  return (
    <DashboardChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={chartData} layout="vertical" margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="mlCategoryViolet" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={DASHBOARD_CHART_COLORS.category} stopOpacity={0.78} />
              <stop offset="100%" stopColor={DASHBOARD_CHART_COLORS.categorySoft} stopOpacity={0.96} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DASHBOARD_GRID_STROKE} horizontal={false} strokeDasharray="4 8" />
          <XAxis type="number" tick={DASHBOARD_AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, currency)} />
          <YAxis type="category" dataKey="displayName" tick={DASHBOARD_AXIS_TICK} axisLine={false} tickLine={false} width={132} />
          <Tooltip content={<DashboardChartTooltip formatter={(value) => formatCurrency(value, currency)} />} />
          <Bar dataKey="Receita" fill="url(#mlCategoryViolet)" radius={[0, 10, 10, 0]} maxBarSize={24} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </DashboardChartFrame>
  )
}

function formatCategoryAxisLabel(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return 'Sem categoria'
  }

  return normalized.length > 22 ? `${normalized.slice(0, 21)}...` : normalized
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

function formatStoreDashboardTitle(value) {
  const normalized = String(value || '').trim().replace(/\.+/g, ' ').replace(/\s+/g, ' ')
  return normalized || 'Loja Mercado Livre'
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

function AnalyticsConsentModal({ activating, error, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Ativar Dashboard Analítico">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-sky-300/18 bg-[#071224] shadow-[0_28px_90px_-34px_rgba(56,189,248,0.6)]">
        <div className="bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.24),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(52,211,153,0.18),transparent_26%),linear-gradient(135deg,#08111f_0%,#07172a_58%,#05101d_100%)] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-300/25 bg-sky-400/10 text-sky-100 shadow-[0_18px_55px_-30px_rgba(56,189,248,0.9)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Ativar Dashboard Analítico</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Ao ativar o dashboard analítico, a InfraStudio poderá utilizar os dados da sua loja conectada para gerar gráficos, métricas e análises visuais dentro da sua própria conta.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 text-sm leading-6 text-slate-300">
          <p>
            Esses dados são utilizados apenas para exibição e funcionamento das funcionalidades analíticas da plataforma e não são compartilhados com outros usuários.
          </p>
          <p>Você poderá desativar esta funcionalidade quando quiser.</p>
          {error ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-100">
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={activating}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={activating}
              className="h-10 rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-4 text-sm font-semibold text-emerald-50 shadow-[0_18px_50px_-28px_rgba(52,211,153,0.9)] hover:bg-emerald-400/20"
            >
              {activating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Ativar Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsConsentPreview({ activating, error, loading, onActivateClick, onConfirm, onCloseModal, showModal, storeName }) {
  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#071224] shadow-[0_28px_90px_-48px_rgba(0,0,0,0.95)]">
        <div className="pointer-events-none absolute inset-0 z-10 bg-slate-950/18 backdrop-blur-[2px]" />
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-sky-300/18 bg-slate-950/72 p-6 text-center shadow-[0_24px_80px_-36px_rgba(56,189,248,0.75)] backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/25 bg-sky-400/10 text-sky-100">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Ativação opcional</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Dashboard Analítico</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Os dados reais da loja só serão exibidos depois da sua ativação explícita.
            </p>
            <Button
              type="button"
              onClick={onActivateClick}
              className="mt-5 h-11 rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-5 text-sm font-semibold text-emerald-50 shadow-[0_18px_55px_-30px_rgba(52,211,153,0.95)] hover:bg-emerald-400/20"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Ativar Dashboard Analítico
            </Button>
            {loading ? <p className="mt-3 text-xs text-slate-500">Verificando preferência...</p> : null}
          </div>
        </div>

        <div className="select-none opacity-70 blur-[1.5px]">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.20),transparent_30%),radial-gradient(circle_at_82%_16%,rgba(52,211,153,0.15),transparent_27%),linear-gradient(135deg,#070d1d_0%,#08182b_56%,#06131e_100%)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Dashboard de vendas
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white md:text-2xl">{formatStoreDashboardTitle(storeName)}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">Prévia analítica com dados demonstrativos.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DashboardKpiCard icon={WalletCards} label="Faturamento" value="R$ --" detail="Prévia protegida" tone="emerald" />
              <DashboardKpiCard icon={ShoppingBag} label="Pedidos" value="--" detail="Prévia protegida" tone="sky" />
              <DashboardKpiCard icon={TrendingUp} label="Ticket médio" value="R$ --" detail="Prévia protegida" tone="violet" />
              <DashboardKpiCard icon={CheckCircle2} label="Itens vendidos" value="--" detail="Prévia protegida" tone="amber" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
              <DashboardChartPanel title="Evolução de faturamento" description="Demonstração visual antes da ativação.">
                <RevenueAreaChart data={MOCK_SALES_BY_DAY} currency="BRL" />
              </DashboardChartPanel>
              <DashboardChartPanel title="Pedidos por status" description="Distribuição demonstrativa.">
                <StatusDonutChart data={MOCK_STATUS_DATA} />
              </DashboardChartPanel>
            </div>
            <DashboardChartPanel title="Vendas por categoria" description="Dados neutros até a ativação.">
              <CategoryBarChart data={MOCK_CATEGORY_DATA} currency="BRL" />
            </DashboardChartPanel>
          </div>
        </div>
      </div>

      {showModal ? <AnalyticsConsentModal activating={activating} error={error} onClose={onCloseModal} onConfirm={onConfirm} /> : null}
    </div>
  )
}

export function MercadoLivreSalesDashboardPanel({ projectIdentifier, connectorMeta, storeName, onStartOAuth }) {
  const [period, setPeriod] = useState('30d')
  const [dashboard, setDashboard] = useState(null)
  const [analyticsConsent, setAnalyticsConsent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activatingAnalytics, setActivatingAnalytics] = useState(false)
  const [showConsentModal, setShowConsentModal] = useState(false)
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
  const maxProductRevenue = useMemo(
    () => Math.max(...(dashboard?.topProducts || []).map((product) => Number(product.revenue || 0)), 1),
    [dashboard?.topProducts],
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
      setAnalyticsConsent(data.consent || { enabled: false })
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
      if (data.dashboard || analyticsConsent?.enabled) {
        setAnalyticsConsent((current) => current || { enabled: true })
      }
    } catch {
      setError('Não foi possível sincronizar as vendas.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleActivateAnalytics() {
    setActivatingAnalytics(true)
    setError('')

    try {
      const response = await fetch(`/api/app/projetos/${projectIdentifier}/conectores/mercado-livre/sales/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error || 'Não foi possível ativar o dashboard analítico.')
        return
      }

      setAnalyticsConsent(data.consent || { enabled: true })
      setShowConsentModal(false)
      await loadDashboard()
    } catch {
      setError('Não foi possível ativar o dashboard analítico.')
    } finally {
      setActivatingAnalytics(false)
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
  const analyticsEnabled = analyticsConsent?.enabled === true

  if (!analyticsEnabled) {
    return (
      <AnalyticsConsentPreview
        activating={activatingAnalytics}
        error={error}
        loading={loading}
        onActivateClick={() => setShowConsentModal(true)}
        onCloseModal={() => setShowConsentModal(false)}
        onConfirm={handleActivateAnalytics}
        showModal={showConsentModal}
        storeName={connectorMeta.oauthNickname || storeName}
      />
    )
  }

  return (
    <div className="grid animate-in fade-in-0 slide-in-from-bottom-2 duration-500 gap-4">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#071224] shadow-[0_28px_90px_-48px_rgba(0,0,0,0.95)]">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.20),transparent_30%),radial-gradient(circle_at_82%_16%,rgba(52,211,153,0.15),transparent_27%),linear-gradient(135deg,#070d1d_0%,#08182b_56%,#06131e_100%)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200 shadow-[0_18px_50px_-32px_rgba(56,189,248,0.9)]">
                <BarChart3 className="h-3.5 w-3.5" />
                Dashboard de vendas
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white md:text-2xl">{formatStoreDashboardTitle(connectorMeta.oauthNickname || storeName)}</h2>
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
                      ? 'border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-[0_12px_36px_-24px_rgba(56,189,248,0.9)]'
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
                className="h-9 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 text-sm text-emerald-100 shadow-[0_12px_36px_-26px_rgba(52,211,153,0.8)]"
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
                <DashboardKpiCard icon={WalletCards} label="Faturamento" value={formatCurrency(summary.grossRevenue, currency)} detail="Pedidos não cancelados no período." tone="emerald" />
                <DashboardKpiCard icon={ShoppingBag} label="Pedidos" value={formatNumber(summary.ordersCount)} detail={`${formatNumber(summary.paidOrdersCount)} pagos`} tone="sky" />
                <DashboardKpiCard icon={TrendingUp} label="Ticket médio" value={formatCurrency(summary.averageTicket, currency)} detail="Baseado nos pedidos pagos." tone="violet" />
                <DashboardKpiCard icon={CheckCircle2} label="Itens vendidos" value={formatNumber(summary.itemsSold)} detail={`${formatNumber(summary.cancelledOrdersCount)} pedidos cancelados`} tone="amber" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <DashboardChartPanel title="Evolução de faturamento" description="Receita por dia no período selecionado.">
                  <RevenueAreaChart data={dashboard.salesByDay || []} currency={currency} />
                </DashboardChartPanel>
                <DashboardChartPanel title="Pedidos por status" description="Distribuição dos pedidos sincronizados.">
                  <StatusDonutChart data={statusData} />
                </DashboardChartPanel>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <DashboardChartPanel title="Volume de pedidos" description="Quantidade diária de pedidos.">
                  <OrdersBarChart data={dashboard.salesByDay || []} />
                </DashboardChartPanel>
                <DashboardChartPanel title="Produtos mais vendidos" description="Ranking por quantidade vendida.">
                  <div className="grid gap-3">
                    {(dashboard.topProducts || []).map((product, index) => (
                      <div key={`${product.itemId || product.title}-${index}`} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-xs font-semibold text-sky-100">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{product.title}</p>
                          <p className="text-xs text-slate-500">{product.itemId || 'sem código'}</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-200"
                              style={{ width: `${Math.max(6, Math.min(100, (Number(product.revenue || 0) / maxProductRevenue) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-100">{formatCurrency(product.revenue, product.currencyId || currency)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatNumber(product.quantity)} un.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </DashboardChartPanel>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <DashboardChartPanel title="Últimos pedidos" description="Pedidos mais recentes dentro do período.">
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
                </DashboardChartPanel>
                <DashboardChartPanel title="Vendas por categoria" description="Receita agrupada por categoria dos itens.">
                  <CategoryBarChart data={dashboard.salesByCategory || []} currency={currency} />
                </DashboardChartPanel>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
