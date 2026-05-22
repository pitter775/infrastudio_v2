'use client'

import { cn } from '@/lib/utils'

export const DASHBOARD_CHART_COLORS = {
  revenue: '#38bdf8',
  revenueSoft: '#0ea5e9',
  orders: '#34d399',
  ordersSoft: '#10b981',
  category: '#a78bfa',
  categorySoft: '#22d3ee',
}

export const DASHBOARD_AXIS_TICK = { fill: '#94a3b8', fontSize: 12, fontWeight: 500 }
export const DASHBOARD_GRID_STROKE = 'rgba(148,163,184,0.14)'

export function DashboardChartFrame({ children, className }) {
  return (
    <div
      className={cn(
        'dashboard-mobile-soft-shell relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_16%_12%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.74),rgba(2,6,23,0.34))] p-3',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
      {children}
    </div>
  )
}

export function DashboardChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-xl border border-sky-300/20 bg-[#071224]/95 px-3 py-2 text-xs shadow-[0_22px_60px_-28px_rgba(56,189,248,0.9)] backdrop-blur">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey || item.name} className="flex items-center gap-2 text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_16px_currentColor]" style={{ backgroundColor: item.color || item.fill }} />
          <span>{item.name || item.dataKey}:</span>
          <span className="font-semibold text-slate-100">{formatter ? formatter(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardKpiCard({ icon: Icon, label, value, detail, tone = 'sky' }) {
  const tones = {
    sky: {
      shell: 'from-sky-500/16 via-sky-500/7 to-transparent',
      icon: 'bg-sky-400/12 text-sky-100',
      line: 'from-sky-300/0 via-sky-300/60 to-sky-300/0',
    },
    emerald: {
      shell: 'from-emerald-500/16 via-emerald-500/7 to-transparent',
      icon: 'bg-emerald-400/12 text-emerald-100',
      line: 'from-emerald-300/0 via-emerald-300/60 to-emerald-300/0',
    },
    amber: {
      shell: 'from-amber-500/16 via-amber-500/7 to-transparent',
      icon: 'bg-amber-400/12 text-amber-100',
      line: 'from-amber-300/0 via-amber-300/60 to-amber-300/0',
    },
    violet: {
      shell: 'from-violet-500/16 via-violet-500/7 to-transparent',
      icon: 'bg-violet-400/12 text-violet-100',
      line: 'from-violet-300/0 via-violet-300/60 to-violet-300/0',
    },
  }
  const selectedTone = tones[tone] || tones.sky

  return (
    <div className={cn('dashboard-mobile-soft-shell relative min-h-[168px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-4 shadow-[0_18px_60px_-34px_rgba(0,0,0,0.95)]', selectedTone.shell)}>
      <div className={cn('pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r', selectedTone.line)} />
      <div className={cn('pointer-events-none absolute -right-5 -top-4 flex h-20 w-20 items-center justify-center rounded-full blur-[0.2px]', selectedTone.icon)} />
      <div className="relative z-10 min-w-0 pr-10">
        <p className="text-[11px] font-semibold uppercase leading-5 tracking-[0.18em] text-slate-400">{label}</p>
        <div className={cn('absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-xl shadow-[0_18px_40px_-26px_currentColor]', selectedTone.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="relative z-10 mt-2 min-w-0">
        <p className="w-full whitespace-nowrap text-[1.08rem] font-semibold leading-tight text-white md:text-[1.18rem]">{value}</p>
      </div>
      {detail ? <p className="mt-3 max-w-[13rem] text-[13px] leading-5 text-slate-400">{detail}</p> : null}
    </div>
  )
}

export function DashboardChartPanel({ title, description, children, className }) {
  return (
    <div className={cn('dashboard-mobile-soft-shell relative overflow-hidden rounded-2xl border border-white/10 bg-[#080e1d]/88 p-4 shadow-[0_22px_70px_-40px_rgba(0,0,0,0.95)]', className)}>
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  )
}
